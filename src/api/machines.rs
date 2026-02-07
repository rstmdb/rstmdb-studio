//! State machine API handlers

use crate::error::{ApiError, ApiResult};
use crate::json_ext::ValueExt;
use crate::validation::{validate_definition, ValidationResult};
use crate::AppState;
use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct MachineListItem {
    pub machine: String,
    pub versions: Vec<u32>,
    pub latest_version: u32,
    pub states_count: usize,
    pub transitions_count: usize,
}

#[derive(Debug, Serialize)]
pub struct MachineListResponse {
    pub items: Vec<MachineListItem>,
}

#[derive(Debug, Serialize)]
pub struct MachineResponse {
    pub machine: String,
    pub versions: Vec<u32>,
}

#[derive(Debug, Serialize)]
pub struct MachineVersionResponse {
    pub machine: String,
    pub version: u32,
    pub definition: Value,
    pub checksum: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMachineVersionRequest {
    pub version: Option<u32>,
    pub definition: Value,
    /// Version to compare against to detect changes
    pub base_version: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct CreateMachineVersionResponse {
    pub machine: String,
    pub version: u32,
    pub checksum: String,
    pub created: bool,
}

#[derive(Debug, Deserialize)]
pub struct ValidateRequest {
    pub definition: Value,
}

/// Extract states and transitions count from a machine definition
fn get_definition_counts(def: &Value) -> (usize, usize) {
    let states = def["definition"]["states"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    let transitions = def["definition"]["transitions"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    (states, transitions)
}

/// GET /api/v1/machines
pub async fn list_machines(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<MachineListResponse>> {
    let result = state.rstmdb.list_machines().await?;

    let mut items: Vec<MachineListItem> = Vec::new();

    if let Some(items_arr) = result["items"].as_array() {
        for item in items_arr {
            let machine = item.str_or_empty("machine");
            let versions = item.u32_array("versions");
            let latest_version = versions.iter().max().copied().unwrap_or(1);

            // Fetch definition for latest version to get states/transitions count
            let (states_count, transitions_count) =
                if let Ok(def) = state.rstmdb.get_machine(&machine, latest_version).await {
                    get_definition_counts(&def)
                } else {
                    (0, 0)
                };

            items.push(MachineListItem {
                machine,
                versions,
                latest_version,
                states_count,
                transitions_count,
            });
        }
    }

    Ok(Json(MachineListResponse { items }))
}

/// GET /api/v1/machines/:name
pub async fn get_machine(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> ApiResult<Json<MachineResponse>> {
    let result = state.rstmdb.list_machines().await?;

    // Find the machine in the list
    let machine_info = result["items"].as_array().and_then(|items| {
        items
            .iter()
            .find(|item| item["machine"].as_str() == Some(&name))
    });

    match machine_info {
        Some(info) => Ok(Json(MachineResponse {
            machine: name,
            versions: info.u32_array("versions"),
        })),
        None => Err(ApiError::not_found("Machine")),
    }
}

/// GET /api/v1/machines/:name/versions/:version
pub async fn get_machine_version(
    State(state): State<Arc<AppState>>,
    Path((name, version)): Path<(String, u32)>,
) -> ApiResult<Json<MachineVersionResponse>> {
    let result = state.rstmdb.get_machine(&name, version).await?;

    Ok(Json(MachineVersionResponse {
        machine: name,
        version,
        definition: result["definition"].clone(),
        checksum: result.str_or_empty("checksum"),
    }))
}

/// Compare two machine definitions, ignoring meta._builderPositions
fn definitions_equal(a: &Value, b: &Value) -> bool {
    if a["states"] != b["states"] {
        return false;
    }
    if a["initial"] != b["initial"] {
        return false;
    }
    if a["transitions"] != b["transitions"] {
        return false;
    }

    // Compare meta (excluding _builderPositions)
    let mut a_meta = a["meta"].clone();
    let mut b_meta = b["meta"].clone();
    if let Some(obj) = a_meta.as_object_mut() {
        obj.remove("_builderPositions");
    }
    if let Some(obj) = b_meta.as_object_mut() {
        obj.remove("_builderPositions");
    }
    a_meta == b_meta
}

/// POST /api/v1/machines/:name/versions
pub async fn create_machine_version(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<CreateMachineVersionRequest>,
) -> ApiResult<Json<CreateMachineVersionResponse>> {
    // Validate definition first
    let validation = validate_definition(&req.definition);
    if !validation.valid {
        return Err(
            ApiError::validation_error("Invalid state machine definition")
                .with_details(serde_json::to_value(&validation).unwrap()),
        );
    }

    // If base_version provided, check if definition changed
    if let Some(base_ver) = req.base_version {
        let base_data = state.rstmdb.get_machine(&name, base_ver).await?;
        let base_def = &base_data["definition"];

        if definitions_equal(&req.definition, base_def) {
            tracing::info!(
                machine = %name,
                version = base_ver,
                "Definition unchanged, skipping version creation"
            );
            return Ok(Json(CreateMachineVersionResponse {
                machine: name,
                version: base_ver,
                checksum: base_data.str_or_empty("checksum"),
                created: false,
            }));
        }
    }

    // Determine version for new definition
    let version = if let Some(v) = req.version {
        v
    } else if let Some(base_ver) = req.base_version {
        // Use base_version + 1
        base_ver + 1
    } else {
        // Get from list
        let machines = state.rstmdb.list_machines().await?;
        let latest = machines["items"]
            .as_array()
            .and_then(|items| {
                items
                    .iter()
                    .find(|item| item["machine"].as_str() == Some(&name))
            })
            .map(|info| info.u32_array("versions"))
            .and_then(|versions| versions.into_iter().max())
            .unwrap_or(0);
        latest + 1
    };

    // Create the machine version
    let result = state
        .rstmdb
        .put_machine(&name, version, req.definition)
        .await?;

    tracing::info!(
        machine = %name,
        version = version,
        created = result.created,
        "Machine version created"
    );

    Ok(Json(CreateMachineVersionResponse {
        machine: result.machine,
        version: result.version,
        checksum: result.checksum,
        created: result.created,
    }))
}

/// POST /api/v1/machines/validate
pub async fn validate_machine(
    Json(req): Json<ValidateRequest>,
) -> ApiResult<Json<ValidationResult>> {
    let result = validate_definition(&req.definition);
    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_definitions_equal_identical() {
        let a = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [{"from": "pending", "event": "COMPLETE", "to": "done"}]
        });
        let b = a.clone();
        assert!(definitions_equal(&a, &b));
    }

    #[test]
    fn test_definitions_equal_different_states() {
        let a = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": []
        });
        let b = json!({
            "states": ["pending", "completed"],
            "initial": "pending",
            "transitions": []
        });
        assert!(!definitions_equal(&a, &b));
    }

    #[test]
    fn test_definitions_equal_different_initial() {
        let a = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": []
        });
        let b = json!({
            "states": ["pending", "done"],
            "initial": "done",
            "transitions": []
        });
        assert!(!definitions_equal(&a, &b));
    }

    #[test]
    fn test_definitions_equal_different_transitions() {
        let a = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [{"from": "pending", "event": "COMPLETE", "to": "done"}]
        });
        let b = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [{"from": "pending", "event": "FINISH", "to": "done"}]
        });
        assert!(!definitions_equal(&a, &b));
    }

    #[test]
    fn test_definitions_equal_ignores_builder_positions() {
        let a = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [],
            "meta": {
                "_builderPositions": {"pending": {"x": 100, "y": 200}},
                "description": "Test machine"
            }
        });
        let b = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [],
            "meta": {
                "_builderPositions": {"pending": {"x": 300, "y": 400}},
                "description": "Test machine"
            }
        });
        assert!(definitions_equal(&a, &b));
    }

    #[test]
    fn test_definitions_equal_different_meta() {
        let a = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [],
            "meta": {"description": "Machine A"}
        });
        let b = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [],
            "meta": {"description": "Machine B"}
        });
        assert!(!definitions_equal(&a, &b));
    }

    #[test]
    fn test_definitions_equal_no_meta() {
        let a = json!({
            "states": ["pending"],
            "initial": "pending",
            "transitions": []
        });
        let b = json!({
            "states": ["pending"],
            "initial": "pending",
            "transitions": []
        });
        assert!(definitions_equal(&a, &b));
    }

    #[test]
    fn test_get_definition_counts() {
        let def = json!({
            "definition": {
                "states": ["a", "b", "c"],
                "transitions": [
                    {"from": "a", "to": "b"},
                    {"from": "b", "to": "c"}
                ]
            }
        });
        let (states, transitions) = get_definition_counts(&def);
        assert_eq!(states, 3);
        assert_eq!(transitions, 2);
    }

    #[test]
    fn test_get_definition_counts_empty() {
        let def = json!({});
        let (states, transitions) = get_definition_counts(&def);
        assert_eq!(states, 0);
        assert_eq!(transitions, 0);
    }
}
