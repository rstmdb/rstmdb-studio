//! Authentication API handlers

use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_sessions::Session;

// Session keys
const SESSION_USER_KEY: &str = "user";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUser {
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub username: String,
    pub logged_in: bool,
}

/// POST /api/v1/auth/login
pub async fn login(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(req): Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    // Verify credentials
    if !state.auth_store.verify(&req.username, &req.password) {
        return Err(ApiError::unauthorized());
    }

    // Store user in session
    let session_user = SessionUser {
        username: req.username.clone(),
    };
    session
        .insert(SESSION_USER_KEY, session_user)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to store session");
            ApiError::internal("Failed to create session")
        })?;

    // Explicitly save session to ensure cookie is set before response
    session.save().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to save session");
        ApiError::internal("Failed to save session")
    })?;

    tracing::info!(username = %req.username, "User logged in");

    Ok(Json(LoginResponse {
        username: req.username,
    }))
}

/// POST /api/v1/auth/logout
pub async fn logout(session: Session) -> ApiResult<Json<serde_json::Value>> {
    // Clear session
    session.flush().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to flush session");
        ApiError::internal("Failed to logout")
    })?;

    Ok(Json(serde_json::json!({ "logged_out": true })))
}

/// GET /api/v1/auth/me
pub async fn me(session: Session) -> ApiResult<Json<MeResponse>> {
    // Get user from session
    let user: Option<SessionUser> = session.get(SESSION_USER_KEY).await.map_err(|e| {
        tracing::error!(error = %e, "Failed to read session");
        ApiError::internal("Session error")
    })?;

    match user {
        Some(u) => Ok(Json(MeResponse {
            username: u.username,
            logged_in: true,
        })),
        None => Ok(Json(MeResponse {
            username: String::new(),
            logged_in: false,
        })),
    }
}
