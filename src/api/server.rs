//! Server info and health API handlers

use crate::error::ApiResult;
use crate::json_ext::ValueExt;
use crate::AppState;
use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Serialize)]
pub struct ServerInfoResponse {
    pub studio_version: String,
    pub rstmdb: RstmdbInfo,
}

#[derive(Debug, Serialize)]
pub struct RstmdbInfo {
    pub connected: bool,
    pub server_name: String,
    pub server_version: String,
    pub protocol_version: u32,
    pub features: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub rstmdb_connected: bool,
    pub latency_ms: u64,
}

/// Health status values
mod health_status {
    pub const HEALTHY: &str = "healthy";
    pub const UNHEALTHY: &str = "unhealthy";
}

/// GET /api/v1/server/info
pub async fn info(State(state): State<Arc<AppState>>) -> ApiResult<Json<ServerInfoResponse>> {
    let rstmdb_info = state.rstmdb.info().await?;

    Ok(Json(ServerInfoResponse {
        studio_version: env!("CARGO_PKG_VERSION").to_string(),
        rstmdb: RstmdbInfo {
            connected: true,
            server_name: rstmdb_info
                .str_opt("server_name")
                .unwrap_or_else(|| "rstmdb".to_string()),
            server_version: rstmdb_info
                .str_opt("server_version")
                .unwrap_or_else(|| "unknown".to_string()),
            protocol_version: rstmdb_info.u32_or("protocol_version", 1),
            features: rstmdb_info.string_array("features"),
        },
    }))
}

/// GET /api/v1/server/health
pub async fn health(State(state): State<Arc<AppState>>) -> ApiResult<Json<HealthResponse>> {
    let start = Instant::now();
    let connected = state.rstmdb.ping().await.is_ok();
    let latency_ms = start.elapsed().as_millis() as u64;

    let status = if connected {
        health_status::HEALTHY
    } else {
        health_status::UNHEALTHY
    };

    Ok(Json(HealthResponse {
        status: status.to_string(),
        rstmdb_connected: connected,
        latency_ms,
    }))
}

/// GET /healthz - Liveness probe
pub async fn healthz() -> StatusCode {
    StatusCode::OK
}

/// GET /readyz - Readiness probe
pub async fn readyz(State(state): State<Arc<AppState>>) -> StatusCode {
    if state.rstmdb.ping().await.is_ok() {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}
