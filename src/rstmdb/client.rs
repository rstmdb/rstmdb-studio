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
        let addr = tokio::net::lookup_host(&config.address)
            .await
            .map_err(|e| ApiError::bad_request(format!("Invalid rstmdb address: {}", e)))?
            .next()
            .ok_or_else(|| {
                ApiError::bad_request(format!(
                    "Could not resolve rstmdb address: {}",
                    config.address
                ))
            })?;

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
