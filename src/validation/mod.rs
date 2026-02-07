//! State machine definition validation

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationWarning {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// Validate a state machine definition
pub fn validate_definition(definition: &Value) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Schema validation
    validate_schema(definition, &mut errors);

    // If schema is valid, do semantic validation
    if errors.is_empty() {
        validate_semantics(definition, &mut errors, &mut warnings);
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    }
}

fn validate_schema(definition: &Value, errors: &mut Vec<ValidationError>) {
    // Check required fields
    if !definition.is_object() {
        errors.push(ValidationError {
            code: "INVALID_TYPE".to_string(),
            message: "Definition must be a JSON object".to_string(),
            path: Some("$".to_string()),
        });
        return;
    }

    // states
    match definition.get("states") {
        None => {
            errors.push(ValidationError {
                code: "MISSING_FIELD".to_string(),
                message: "Missing required field 'states'".to_string(),
                path: Some("$.states".to_string()),
            });
        }
        Some(states) => {
            if !states.is_array() {
                errors.push(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "'states' must be an array".to_string(),
                    path: Some("$.states".to_string()),
                });
            } else if let Some(arr) = states.as_array() {
                if arr.is_empty() {
                    errors.push(ValidationError {
                        code: "EMPTY_ARRAY".to_string(),
                        message: "'states' array cannot be empty".to_string(),
                        path: Some("$.states".to_string()),
                    });
                }
                for (i, state) in arr.iter().enumerate() {
                    if !state.is_string() {
                        errors.push(ValidationError {
                            code: "INVALID_TYPE".to_string(),
                            message: format!("State at index {} must be a string", i),
                            path: Some(format!("$.states[{}]", i)),
                        });
                    }
                }
            }
        }
    }

    // initial
    match definition.get("initial") {
        None => {
            errors.push(ValidationError {
                code: "MISSING_FIELD".to_string(),
                message: "Missing required field 'initial'".to_string(),
                path: Some("$.initial".to_string()),
            });
        }
        Some(initial) => {
            if !initial.is_string() {
                errors.push(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "'initial' must be a string".to_string(),
                    path: Some("$.initial".to_string()),
                });
            }
        }
    }

    // transitions
    match definition.get("transitions") {
        None => {
            errors.push(ValidationError {
                code: "MISSING_FIELD".to_string(),
                message: "Missing required field 'transitions'".to_string(),
                path: Some("$.transitions".to_string()),
            });
        }
        Some(transitions) => {
            if !transitions.is_array() {
                errors.push(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "'transitions' must be an array".to_string(),
                    path: Some("$.transitions".to_string()),
                });
            } else if let Some(arr) = transitions.as_array() {
                for (i, transition) in arr.iter().enumerate() {
                    validate_transition(transition, i, errors);
                }
            }
        }
    }
}

fn validate_transition(transition: &Value, index: usize, errors: &mut Vec<ValidationError>) {
    let path_prefix = format!("$.transitions[{}]", index);

    if !transition.is_object() {
        errors.push(ValidationError {
            code: "INVALID_TYPE".to_string(),
            message: format!("Transition at index {} must be an object", index),
            path: Some(path_prefix),
        });
        return;
    }

    // from
    match transition.get("from") {
        None => {
            errors.push(ValidationError {
                code: "MISSING_FIELD".to_string(),
                message: "Transition missing required field 'from'".to_string(),
                path: Some(format!("{}.from", path_prefix)),
            });
        }
        Some(from) => {
            if !from.is_string() && !from.is_array() {
                errors.push(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "'from' must be a string or array of strings".to_string(),
                    path: Some(format!("{}.from", path_prefix)),
                });
            }
        }
    }

    // event
    match transition.get("event") {
        None => {
            errors.push(ValidationError {
                code: "MISSING_FIELD".to_string(),
                message: "Transition missing required field 'event'".to_string(),
                path: Some(format!("{}.event", path_prefix)),
            });
        }
        Some(event) => {
            if !event.is_string() {
                errors.push(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "'event' must be a string".to_string(),
                    path: Some(format!("{}.event", path_prefix)),
                });
            }
        }
    }

    // to
    match transition.get("to") {
        None => {
            errors.push(ValidationError {
                code: "MISSING_FIELD".to_string(),
                message: "Transition missing required field 'to'".to_string(),
                path: Some(format!("{}.to", path_prefix)),
            });
        }
        Some(to) => {
            if !to.is_string() {
                errors.push(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "'to' must be a string".to_string(),
                    path: Some(format!("{}.to", path_prefix)),
                });
            }
        }
    }

    // guard (optional)
    if let Some(guard) = transition.get("guard") {
        if !guard.is_string() {
            errors.push(ValidationError {
                code: "INVALID_TYPE".to_string(),
                message: "'guard' must be a string".to_string(),
                path: Some(format!("{}.guard", path_prefix)),
            });
        }
    }
}

fn validate_semantics(
    definition: &Value,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
) {
    // Collect states
    let states: HashSet<String> = definition["states"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|s| s.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    // Check initial state exists
    if let Some(initial) = definition["initial"].as_str() {
        if !states.contains(initial) {
            errors.push(ValidationError {
                code: "INVALID_INITIAL_STATE".to_string(),
                message: format!("Initial state '{}' not in states list", initial),
                path: Some("$.initial".to_string()),
            });
        }
    }

    // Check transitions reference valid states
    let mut referenced_states: HashSet<String> = HashSet::new();
    let mut incoming_transitions: HashSet<String> = HashSet::new();
    let mut outgoing_transitions: HashSet<String> = HashSet::new();

    if let Some(transitions) = definition["transitions"].as_array() {
        for (i, transition) in transitions.iter().enumerate() {
            // Check 'from' states
            let from_states: Vec<&str> = if let Some(from) = transition["from"].as_str() {
                vec![from]
            } else if let Some(arr) = transition["from"].as_array() {
                arr.iter().filter_map(|s| s.as_str()).collect()
            } else {
                vec![]
            };

            for from in &from_states {
                if !states.contains(*from) {
                    errors.push(ValidationError {
                        code: "INVALID_STATE".to_string(),
                        message: format!("Transition 'from' state '{}' not in states list", from),
                        path: Some(format!("$.transitions[{}].from", i)),
                    });
                }
                outgoing_transitions.insert(from.to_string());
            }

            // Check 'to' state
            if let Some(to) = transition["to"].as_str() {
                if !states.contains(to) {
                    errors.push(ValidationError {
                        code: "INVALID_STATE".to_string(),
                        message: format!("Transition 'to' state '{}' not in states list", to),
                        path: Some(format!("$.transitions[{}].to", i)),
                    });
                }
                incoming_transitions.insert(to.to_string());
                referenced_states.insert(to.to_string());
            }

            for from in from_states {
                referenced_states.insert(from.to_string());
            }
        }
    }

    // Check for duplicate states
    if let Some(states_arr) = definition["states"].as_array() {
        let mut seen: HashSet<&str> = HashSet::new();
        for (i, state) in states_arr.iter().enumerate() {
            if let Some(s) = state.as_str() {
                if seen.contains(s) {
                    errors.push(ValidationError {
                        code: "DUPLICATE_STATE".to_string(),
                        message: format!("Duplicate state '{}'", s),
                        path: Some(format!("$.states[{}]", i)),
                    });
                }
                seen.insert(s);
            }
        }
    }

    // Warnings: unreachable states (no incoming transitions except initial)
    let initial = definition["initial"].as_str().unwrap_or("");
    for state in &states {
        if state != initial && !incoming_transitions.contains(state) {
            warnings.push(ValidationWarning {
                code: "UNREACHABLE_STATE".to_string(),
                message: format!("State '{}' has no incoming transitions", state),
                path: None,
            });
        }
    }

    // Warnings: dead-end states (no outgoing transitions)
    for state in &states {
        if !outgoing_transitions.contains(state) {
            warnings.push(ValidationWarning {
                code: "DEAD_END_STATE".to_string(),
                message: format!(
                    "State '{}' has no outgoing transitions (terminal state)",
                    state
                ),
                path: None,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_valid_definition() {
        let def = json!({
            "states": ["pending", "confirmed", "shipped"],
            "initial": "pending",
            "transitions": [
                { "from": "pending", "event": "CONFIRM", "to": "confirmed" },
                { "from": "confirmed", "event": "SHIP", "to": "shipped" }
            ]
        });

        let result = validate_definition(&def);
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_missing_fields() {
        let def = json!({});

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert_eq!(result.errors.len(), 3); // states, initial, transitions
    }

    #[test]
    fn test_invalid_initial_state() {
        let def = json!({
            "states": ["pending", "confirmed"],
            "initial": "unknown",
            "transitions": []
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.code == "INVALID_INITIAL_STATE"));
    }

    #[test]
    fn test_empty_states_array() {
        let def = json!({
            "states": [],
            "initial": "pending",
            "transitions": []
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "EMPTY_ARRAY"));
    }

    #[test]
    fn test_invalid_state_type() {
        let def = json!({
            "states": ["pending", 123, "done"],
            "initial": "pending",
            "transitions": []
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "INVALID_TYPE"));
    }

    #[test]
    fn test_duplicate_states() {
        let def = json!({
            "states": ["pending", "done", "pending"],
            "initial": "pending",
            "transitions": []
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "DUPLICATE_STATE"));
    }

    #[test]
    fn test_invalid_transition_from_state() {
        let def = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [
                { "from": "unknown", "event": "COMPLETE", "to": "done" }
            ]
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "INVALID_STATE"));
    }

    #[test]
    fn test_invalid_transition_to_state() {
        let def = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [
                { "from": "pending", "event": "COMPLETE", "to": "unknown" }
            ]
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "INVALID_STATE"));
    }

    #[test]
    fn test_transition_with_array_from() {
        let def = json!({
            "states": ["pending", "review", "done"],
            "initial": "pending",
            "transitions": [
                { "from": ["pending", "review"], "event": "COMPLETE", "to": "done" }
            ]
        });

        let result = validate_definition(&def);
        assert!(result.valid);
    }

    #[test]
    fn test_transition_missing_fields() {
        let def = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [
                { "from": "pending" }
            ]
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        // Should have errors for missing 'event' and 'to'
        assert!(result.errors.iter().any(|e| e.message.contains("'event'")));
        assert!(result.errors.iter().any(|e| e.message.contains("'to'")));
    }

    #[test]
    fn test_transition_with_guard() {
        let def = json!({
            "states": ["pending", "approved", "rejected"],
            "initial": "pending",
            "transitions": [
                { "from": "pending", "event": "REVIEW", "to": "approved", "guard": "ctx.score > 50" },
                { "from": "pending", "event": "REVIEW", "to": "rejected", "guard": "ctx.score <= 50" }
            ]
        });

        let result = validate_definition(&def);
        assert!(result.valid);
    }

    #[test]
    fn test_unreachable_state_warning() {
        let def = json!({
            "states": ["pending", "orphan", "done"],
            "initial": "pending",
            "transitions": [
                { "from": "pending", "event": "COMPLETE", "to": "done" }
            ]
        });

        let result = validate_definition(&def);
        assert!(result.valid); // Warnings don't make it invalid
        assert!(result
            .warnings
            .iter()
            .any(|w| w.code == "UNREACHABLE_STATE"));
    }

    #[test]
    fn test_dead_end_state_warning() {
        let def = json!({
            "states": ["pending", "done"],
            "initial": "pending",
            "transitions": [
                { "from": "pending", "event": "COMPLETE", "to": "done" }
            ]
        });

        let result = validate_definition(&def);
        assert!(result.valid);
        // 'done' has no outgoing transitions (terminal state)
        assert!(result.warnings.iter().any(|w| w.code == "DEAD_END_STATE"));
    }

    #[test]
    fn test_not_an_object() {
        let def = json!("not an object");

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.message.contains("JSON object")));
    }

    #[test]
    fn test_states_not_an_array() {
        let def = json!({
            "states": "not an array",
            "initial": "pending",
            "transitions": []
        });

        let result = validate_definition(&def);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.message.contains("'states' must be an array")));
    }
}
