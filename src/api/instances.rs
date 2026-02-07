//! Instance API handlers

use crate::constants::{history_event_types, instances::HISTORY_MAX_WAL_SCAN, wal_entry_types};
use crate::error::ApiResult;
use crate::json_ext::ValueExt;
use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListInstancesQuery {
    /// Machine name (required for listing instances)
    pub machine: String,
    /// Filter by state
    pub state: Option<String>,
    /// Maximum number of results (default 100)
    pub limit: Option<u32>,
    /// Offset for pagination
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct InstanceListItem {
    pub id: String,
    pub machine: String,
    pub version: u32,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_wal_offset: u64,
}

#[derive(Debug, Serialize)]
pub struct InstanceListResponse {
    pub items: Vec<InstanceListItem>,
    pub total: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct InstanceResponse {
    pub instance_id: String,
    pub machine: String,
    pub version: u32,
    pub state: String,
    pub ctx: Value,
    pub last_wal_offset: u64,
}

#[derive(Debug, Serialize)]
pub struct HistoryEvent {
    pub offset: u64,
    pub event_type: String,
    pub event: Option<String>,
    pub from_state: Option<String>,
    pub to_state: String,
    pub timestamp: i64,
    pub ctx: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct InstanceHistoryResponse {
    pub instance_id: String,
    pub events: Vec<HistoryEvent>,
}

/// GET /api/v1/instances?machine=xxx
pub async fn list_instances(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListInstancesQuery>,
) -> ApiResult<Json<InstanceListResponse>> {
    let result = state
        .rstmdb
        .list_instances(
            &query.machine,
            query.state.as_deref(),
            query.limit,
            query.offset,
        )
        .await?;

    let items: Vec<InstanceListItem> = result
        .instances
        .into_iter()
        .map(|i| InstanceListItem {
            id: i.id,
            machine: i.machine,
            version: i.version,
            state: i.state,
            created_at: i.created_at,
            updated_at: i.updated_at,
            last_wal_offset: i.last_wal_offset,
        })
        .collect();

    Ok(Json(InstanceListResponse {
        items,
        total: result.total,
        has_more: result.has_more,
    }))
}

/// GET /api/v1/instances/:id
pub async fn get_instance(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<InstanceResponse>> {
    let result = state.rstmdb.get_instance(&id).await?;

    Ok(Json(InstanceResponse {
        instance_id: result.instance_id,
        machine: result.machine,
        version: result.version,
        state: result.state,
        ctx: result.ctx,
        last_wal_offset: result.last_wal_offset,
    }))
}

/// GET /api/v1/instances/:id/history
pub async fn get_instance_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<InstanceHistoryResponse>> {
    // Get instance info first to know the WAL range
    let instance = state.rstmdb.get_instance(&id).await?;

    // Read WAL entries - start from 0 and scan (TODO: optimize with index)
    let wal_result = state.rstmdb.wal_read(0, Some(HISTORY_MAX_WAL_SCAN)).await?;

    let mut events = Vec::new();

    if let Some(records) = wal_result["records"].as_array() {
        for record in records {
            let entry = &record["entry"];
            let entry_instance = entry.str_or_empty("instance_id");

            if entry_instance != id {
                continue;
            }

            let offset = record.u64_or("offset", 0);
            let entry_type = entry.str_or_empty("type");
            let timestamp = entry.i64_or("timestamp", 0);

            let event = match entry_type.as_str() {
                wal_entry_types::CREATE_INSTANCE => Some(HistoryEvent {
                    offset,
                    event_type: history_event_types::CREATED.to_string(),
                    event: None,
                    from_state: None,
                    to_state: entry.str_or_empty("initial_state"),
                    timestamp,
                    ctx: entry.get("initial_ctx").cloned(),
                }),
                wal_entry_types::APPLY_EVENT => Some(HistoryEvent {
                    offset,
                    event_type: history_event_types::TRANSITION.to_string(),
                    event: Some(entry.str_or_empty("event")),
                    from_state: Some(entry.str_or_empty("from_state")),
                    to_state: entry.str_or_empty("to_state"),
                    timestamp,
                    ctx: entry.get("ctx").cloned(),
                }),
                _ => None,
            };

            if let Some(e) = event {
                events.push(e);
            }

            // Stop if we've reached the instance's last known offset
            if offset >= instance.last_wal_offset {
                break;
            }
        }
    }

    // Reverse to show newest first
    events.reverse();

    Ok(Json(InstanceHistoryResponse {
        instance_id: id,
        events,
    }))
}
