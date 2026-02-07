//! WAL API handlers

use crate::constants::wal::{DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE};
use crate::error::{ApiError, ApiResult};
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
pub struct ListWalQuery {
    pub from: Option<u64>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct WalEntry {
    pub sequence: u64,
    pub offset: u64,
    pub entry_type: String,
    pub instance_id: Option<String>,
    pub machine: Option<String>,
    pub version: Option<u32>,
    pub details: Value,
}

#[derive(Debug, Serialize)]
pub struct WalListResponse {
    pub records: Vec<WalEntry>,
    pub next_offset: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct WalEntryResponse {
    pub sequence: u64,
    pub offset: u64,
    pub entry: Value,
}

/// GET /api/v1/wal
pub async fn list_wal_entries(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListWalQuery>,
) -> ApiResult<Json<WalListResponse>> {
    let from = query.from.unwrap_or(0);
    let limit = query.limit.unwrap_or(DEFAULT_PAGE_SIZE).min(MAX_PAGE_SIZE);

    let result = state.rstmdb.wal_read(from, Some(limit)).await?;

    let records: Vec<WalEntry> = result["records"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|record| {
                    let entry = &record["entry"];
                    WalEntry {
                        sequence: record.u64_or("sequence", 0),
                        offset: record.u64_or("offset", 0),
                        entry_type: entry.str_or_empty("type"),
                        instance_id: entry.str_opt("instance_id"),
                        machine: entry.str_opt("machine"),
                        version: entry.u64_opt("version").map(|v| v as u32),
                        details: entry.clone(),
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    // Only return next_offset if we got a full page of results
    // (indicating there might be more entries)
    let next_offset = if records.len() >= limit as usize {
        result.u64_opt("next_offset")
    } else {
        None
    };

    Ok(Json(WalListResponse {
        records,
        next_offset,
    }))
}

/// GET /api/v1/wal/:offset
pub async fn get_wal_entry(
    State(state): State<Arc<AppState>>,
    Path(offset): Path<u64>,
) -> ApiResult<Json<WalEntryResponse>> {
    let result = state.rstmdb.wal_read(offset, Some(1)).await?;

    let record = result["records"]
        .as_array()
        .and_then(|arr| arr.first())
        .ok_or_else(|| ApiError::not_found("WAL entry"))?;

    Ok(Json(WalEntryResponse {
        sequence: record.u64_or("sequence", 0),
        offset: record.u64_or("offset", offset),
        entry: record["entry"].clone(),
    }))
}

#[derive(Debug, Serialize)]
pub struct WalStatsResponse {
    pub entry_count: u64,
    pub segment_count: u64,
    pub total_size_bytes: u64,
    pub latest_offset: Option<u64>,
    pub io_stats: WalIoStats,
}

#[derive(Debug, Serialize)]
pub struct WalIoStats {
    pub bytes_written: u64,
    pub bytes_read: u64,
    pub writes: u64,
    pub reads: u64,
    pub fsyncs: u64,
}

/// GET /api/v1/wal/stats
pub async fn get_wal_stats(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<WalStatsResponse>> {
    let result = state.rstmdb.wal_stats().await?;
    let io = &result["io_stats"];

    Ok(Json(WalStatsResponse {
        entry_count: result.u64_or("entry_count", 0),
        segment_count: result.u64_or("segment_count", 0),
        total_size_bytes: result.u64_or("total_size_bytes", 0),
        latest_offset: result.u64_opt("latest_offset"),
        io_stats: WalIoStats {
            bytes_written: io.u64_or("bytes_written", 0),
            bytes_read: io.u64_or("bytes_read", 0),
            writes: io.u64_or("writes", 0),
            reads: io.u64_or("reads", 0),
            fsyncs: io.u64_or("fsyncs", 0),
        },
    }))
}
