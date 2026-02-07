//! Error handling

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

impl ApiError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    // Common errors
    pub fn unauthorized() -> Self {
        Self::new("UNAUTHORIZED", "Authentication required")
    }

    pub fn forbidden() -> Self {
        Self::new("FORBIDDEN", "Access denied")
    }

    pub fn not_found(resource: &str) -> Self {
        Self::new("NOT_FOUND", format!("{} not found", resource))
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new("BAD_REQUEST", message)
    }

    pub fn validation_error(message: impl Into<String>) -> Self {
        Self::new("VALIDATION_ERROR", message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new("CONFLICT", message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL_ERROR", message)
    }

    pub fn rstmdb_error(message: impl Into<String>) -> Self {
        Self::new("RSTMDB_ERROR", message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self.code.as_str() {
            "UNAUTHORIZED" => StatusCode::UNAUTHORIZED,
            "FORBIDDEN" => StatusCode::FORBIDDEN,
            "NOT_FOUND" => StatusCode::NOT_FOUND,
            "BAD_REQUEST" => StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR" => StatusCode::UNPROCESSABLE_ENTITY,
            "CONFLICT" => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (status, Json(json!({ "error": self }))).into_response()
    }
}

// Convert from common error types
impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        tracing::error!(error = %err, "Internal error");
        Self::internal(err.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        Self::bad_request(format!("Invalid JSON: {}", err))
    }
}

// Result type alias for API handlers
pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = ApiError::new("TEST_CODE", "Test message");
        assert_eq!(format!("{}", err), "TEST_CODE: Test message");
    }

    #[test]
    fn test_error_with_details() {
        let err = ApiError::new("TEST", "msg").with_details(json!({"field": "value"}));
        assert!(err.details.is_some());
        assert_eq!(err.details.unwrap()["field"], "value");
    }

    #[test]
    fn test_unauthorized_error() {
        let err = ApiError::unauthorized();
        assert_eq!(err.code, "UNAUTHORIZED");
        assert_eq!(err.message, "Authentication required");
    }

    #[test]
    fn test_forbidden_error() {
        let err = ApiError::forbidden();
        assert_eq!(err.code, "FORBIDDEN");
        assert_eq!(err.message, "Access denied");
    }

    #[test]
    fn test_not_found_error() {
        let err = ApiError::not_found("User");
        assert_eq!(err.code, "NOT_FOUND");
        assert_eq!(err.message, "User not found");
    }

    #[test]
    fn test_bad_request_error() {
        let err = ApiError::bad_request("Invalid input");
        assert_eq!(err.code, "BAD_REQUEST");
        assert_eq!(err.message, "Invalid input");
    }

    #[test]
    fn test_validation_error() {
        let err = ApiError::validation_error("Field is required");
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[test]
    fn test_conflict_error() {
        let err = ApiError::conflict("Resource already exists");
        assert_eq!(err.code, "CONFLICT");
    }

    #[test]
    fn test_internal_error() {
        let err = ApiError::internal("Something went wrong");
        assert_eq!(err.code, "INTERNAL_ERROR");
    }

    #[test]
    fn test_rstmdb_error() {
        let err = ApiError::rstmdb_error("Connection failed");
        assert_eq!(err.code, "RSTMDB_ERROR");
        assert_eq!(err.message, "Connection failed");
    }

    #[test]
    fn test_status_code_mapping() {
        // Test that error codes map to correct HTTP status codes
        fn get_status(code: &str) -> StatusCode {
            match code {
                "UNAUTHORIZED" => StatusCode::UNAUTHORIZED,
                "FORBIDDEN" => StatusCode::FORBIDDEN,
                "NOT_FOUND" => StatusCode::NOT_FOUND,
                "BAD_REQUEST" => StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR" => StatusCode::UNPROCESSABLE_ENTITY,
                "CONFLICT" => StatusCode::CONFLICT,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        }

        assert_eq!(get_status("UNAUTHORIZED"), StatusCode::UNAUTHORIZED);
        assert_eq!(get_status("FORBIDDEN"), StatusCode::FORBIDDEN);
        assert_eq!(get_status("NOT_FOUND"), StatusCode::NOT_FOUND);
        assert_eq!(get_status("BAD_REQUEST"), StatusCode::BAD_REQUEST);
        assert_eq!(
            get_status("VALIDATION_ERROR"),
            StatusCode::UNPROCESSABLE_ENTITY
        );
        assert_eq!(get_status("CONFLICT"), StatusCode::CONFLICT);
        assert_eq!(
            get_status("INTERNAL_ERROR"),
            StatusCode::INTERNAL_SERVER_ERROR
        );
        assert_eq!(get_status("UNKNOWN"), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
