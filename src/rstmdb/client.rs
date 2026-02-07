//! rstmdb client wrapper for Studio

use crate::config::RstmdbConfig;
use crate::error::ApiError;
use rstmdb_client::{Client, ConnectionConfig};
use serde_json::Value;
use std::future::Future;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Studio client wrapping rstmdb-client with auto-reconnect
pub struct StudioClient {
    client: Arc<RwLock<Client>>,
    config: RstmdbConfig,
}

impl StudioClient {
    /// Connect to rstmdb server
    pub async fn connect(config: &RstmdbConfig) -> Result<Self, ApiError> {
        let client = Self::create_client(config).await?;

        Ok(Self {
            client: Arc::new(RwLock::new(client)),
            config: config.clone(),
        })
    }

    /// Create a new client connection
    async fn create_client(config: &RstmdbConfig) -> Result<Client, ApiError> {
        let addr = config
            .address
            .parse()
            .map_err(|e| ApiError::bad_request(format!("Invalid rstmdb address: {}", e)))?;

        let mut conn_config = ConnectionConfig::new(addr).with_client_name("rstmdb-studio");

        if let Some(ref token) = config.token {
            conn_config = conn_config.with_auth_token(token);
        }

        let client = Client::new(conn_config);

        client
            .connect()
            .await
            .map_err(|e| ApiError::rstmdb_error(format!("Failed to connect to rstmdb: {}", e)))?;

        // Start read loop in background
        let conn = client.connection();
        tokio::spawn(async move {
            let _ = conn.read_loop().await;
        });

        // Give read loop time to start
        tokio::task::yield_now().await;

        Ok(client)
    }

    /// Execute an operation with auto-reconnect on connection failure
    async fn with_reconnect<T, F, Fut>(&self, op_name: &str, op: F) -> Result<T, ApiError>
    where
        F: Fn(Arc<RwLock<Client>>) -> Fut,
        Fut: Future<Output = Result<T, rstmdb_client::ClientError>>,
    {
        // First attempt
        let result = op(self.client.clone()).await;

        match result {
            Ok(v) => Ok(v),
            Err(e) => {
                let err_str = e.to_string();
                // Check if it's a connection error
                if err_str.contains("not connected")
                    || err_str.contains("channel closed")
                    || err_str.contains("connection")
                {
                    tracing::info!("Connection lost, reconnecting to rstmdb...");

                    // Reconnect
                    let mut client = self.client.write().await;
                    let _ = client.close().await;
                    *client = Self::create_client(&self.config).await?;
                    drop(client);

                    tracing::info!("Reconnected to rstmdb server");

                    // Retry the operation
                    op(self.client.clone())
                        .await
                        .map_err(|e| ApiError::rstmdb_error(format!("{} failed: {}", op_name, e)))
                } else {
                    Err(ApiError::rstmdb_error(format!("{} failed: {}", op_name, e)))
                }
            }
        }
    }

    /// Ping the server
    pub async fn ping(&self) -> Result<(), ApiError> {
        self.with_reconnect("Ping", |client| async move {
            let c = client.read().await;
            c.ping().await
        })
        .await
    }

    /// Get server info
    pub async fn info(&self) -> Result<Value, ApiError> {
        self.with_reconnect("Info", |client| async move {
            let c = client.read().await;
            c.info().await
        })
        .await
    }

    /// List all machines
    pub async fn list_machines(&self) -> Result<Value, ApiError> {
        self.with_reconnect("List machines", |client| async move {
            let c = client.read().await;
            c.list_machines().await
        })
        .await
    }

    /// Get machine definition
    pub async fn get_machine(&self, name: &str, version: u32) -> Result<Value, ApiError> {
        let name = name.to_string();
        let result = self
            .with_reconnect("Get machine", |client| {
                let name = name.clone();
                async move {
                    let c = client.read().await;
                    c.get_machine(&name, version).await
                }
            })
            .await?;
        Ok(serde_json::to_value(result).unwrap_or(Value::Null))
    }

    /// Create or update machine definition
    pub async fn put_machine(
        &self,
        name: &str,
        version: u32,
        definition: Value,
    ) -> Result<PutMachineResult, ApiError> {
        let name = name.to_string();
        let result = self
            .with_reconnect("Put machine", |client| {
                let name = name.clone();
                let definition = definition.clone();
                async move {
                    let c = client.read().await;
                    c.put_machine(&name, version, definition).await
                }
            })
            .await?;
        Ok(PutMachineResult {
            machine: result.machine,
            version: result.version,
            checksum: result.stored_checksum,
            created: result.created,
        })
    }

    /// Get instance
    pub async fn get_instance(&self, id: &str) -> Result<InstanceResult, ApiError> {
        let id = id.to_string();
        let result = self
            .with_reconnect("Get instance", |client| {
                let id = id.clone();
                async move {
                    let c = client.read().await;
                    c.get_instance(&id).await
                }
            })
            .await
            .map_err(|e| {
                if e.to_string().contains("not found") {
                    ApiError::not_found("Instance")
                } else {
                    e
                }
            })?;
        Ok(InstanceResult {
            instance_id: id,
            machine: result.machine,
            version: result.version,
            state: result.state,
            ctx: result.ctx,
            last_wal_offset: result.last_wal_offset,
        })
    }

    /// Create instance
    pub async fn create_instance(
        &self,
        machine: &str,
        version: u32,
        instance_id: Option<&str>,
        initial_ctx: Option<Value>,
    ) -> Result<CreateInstanceResult, ApiError> {
        let machine = machine.to_string();
        let instance_id = instance_id.map(|s| s.to_string());
        let result = self
            .with_reconnect("Create instance", |client| {
                let machine = machine.clone();
                let instance_id = instance_id.clone();
                let initial_ctx = initial_ctx.clone();
                async move {
                    let c = client.read().await;
                    c.create_instance(&machine, version, instance_id.as_deref(), initial_ctx, None)
                        .await
                }
            })
            .await?;
        Ok(CreateInstanceResult {
            instance_id: result.instance_id,
            state: result.state,
            wal_offset: result.wal_offset,
        })
    }

    /// Delete instance
    pub async fn delete_instance(&self, id: &str) -> Result<(), ApiError> {
        let id = id.to_string();
        self.with_reconnect("Delete instance", |client| {
            let id = id.clone();
            async move {
                let c = client.read().await;
                c.delete_instance(&id, None).await
            }
        })
        .await
        .map_err(|e| {
            if e.to_string().contains("not found") {
                ApiError::not_found("Instance")
            } else {
                e
            }
        })?;
        Ok(())
    }

    /// Apply event to instance
    pub async fn apply_event(
        &self,
        instance_id: &str,
        event: &str,
        payload: Option<Value>,
        expected_state: Option<&str>,
    ) -> Result<ApplyEventResult, ApiError> {
        let instance_id = instance_id.to_string();
        let event = event.to_string();
        let expected_state = expected_state.map(|s| s.to_string());
        let result = self
            .with_reconnect("Apply event", |client| {
                let instance_id = instance_id.clone();
                let event = event.clone();
                let payload = payload.clone();
                let expected_state = expected_state.clone();
                async move {
                    let c = client.read().await;
                    c.apply_event(
                        &instance_id,
                        &event,
                        payload,
                        expected_state.as_deref(),
                        None,
                    )
                    .await
                }
            })
            .await
            .map_err(|e| {
                let msg = e.to_string();
                if msg.contains("INVALID_TRANSITION") {
                    ApiError::new("INVALID_TRANSITION", msg)
                } else if msg.contains("GUARD_FAILED") {
                    ApiError::new("GUARD_FAILED", msg)
                } else if msg.contains("STATE_MISMATCH") {
                    ApiError::new("STATE_MISMATCH", msg)
                } else if msg.contains("not found") {
                    ApiError::not_found("Instance")
                } else {
                    e
                }
            })?;
        Ok(ApplyEventResult {
            from_state: result.from_state,
            to_state: result.to_state,
            ctx: result.ctx.unwrap_or(Value::Null),
            wal_offset: result.wal_offset,
            applied: result.applied,
            event_id: result.event_id,
        })
    }

    /// Read WAL entries
    pub async fn wal_read(&self, from: u64, limit: Option<u64>) -> Result<Value, ApiError> {
        self.with_reconnect("WAL read", |client| async move {
            let c = client.read().await;
            c.wal_read(from, limit).await
        })
        .await
    }

    /// Get WAL statistics
    pub async fn wal_stats(&self) -> Result<Value, ApiError> {
        self.with_reconnect("WAL stats", |client| async move {
            let c = client.read().await;
            c.wal_stats().await
        })
        .await
    }

    /// List instances for a specific machine with optional state filter and pagination
    pub async fn list_instances(
        &self,
        machine: &str,
        state: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<ListInstancesResult, ApiError> {
        let machine = machine.to_string();
        let state = state.map(|s| s.to_string());
        let result = self
            .with_reconnect("List instances", |client| {
                let machine = machine.clone();
                let state = state.clone();
                async move {
                    let c = client.read().await;
                    c.list_instances(Some(&machine), state.as_deref(), limit, offset)
                        .await
                }
            })
            .await?;
        Ok(ListInstancesResult {
            instances: result
                .instances
                .into_iter()
                .map(|i| InstanceSummary {
                    id: i.id,
                    machine: i.machine,
                    version: i.version,
                    state: i.state,
                    created_at: i.created_at,
                    updated_at: i.updated_at,
                    last_wal_offset: i.last_wal_offset,
                })
                .collect(),
            total: result.total,
            has_more: result.has_more,
        })
    }
}

// Result types

#[derive(Debug, serde::Serialize)]
pub struct PutMachineResult {
    pub machine: String,
    pub version: u32,
    pub checksum: String,
    pub created: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct InstanceResult {
    pub instance_id: String,
    pub machine: String,
    pub version: u32,
    pub state: String,
    pub ctx: Value,
    pub last_wal_offset: u64,
}

#[derive(Debug, serde::Serialize)]
pub struct CreateInstanceResult {
    pub instance_id: String,
    pub state: String,
    pub wal_offset: u64,
}

#[derive(Debug, serde::Serialize)]
pub struct ApplyEventResult {
    pub from_state: String,
    pub to_state: String,
    pub ctx: Value,
    pub wal_offset: u64,
    pub applied: bool,
    pub event_id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct ListInstancesResult {
    pub instances: Vec<InstanceSummary>,
    pub total: u64,
    pub has_more: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct InstanceSummary {
    pub id: String,
    pub machine: String,
    pub version: u32,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_wal_offset: u64,
}
