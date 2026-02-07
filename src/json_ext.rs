//! JSON value extraction helpers
//!
//! Provides convenient extension methods for extracting values from serde_json::Value

use serde_json::Value;

/// Extension trait for serde_json::Value with convenient extraction methods
pub trait ValueExt {
    /// Extract a string field, returning empty string if not found
    fn str_or_empty(&self, key: &str) -> String;

    /// Extract an optional string field
    fn str_opt(&self, key: &str) -> Option<String>;

    /// Extract a u64 field with a default value
    fn u64_or(&self, key: &str, default: u64) -> u64;

    /// Extract an optional u64 field
    fn u64_opt(&self, key: &str) -> Option<u64>;

    /// Extract a u32 field with a default value
    fn u32_or(&self, key: &str, default: u32) -> u32;

    /// Extract an i64 field with a default value
    fn i64_or(&self, key: &str, default: i64) -> i64;

    /// Extract an array of u32 values from a field
    fn u32_array(&self, key: &str) -> Vec<u32>;

    /// Extract an array of strings from a field
    fn string_array(&self, key: &str) -> Vec<String>;
}

impl ValueExt for Value {
    fn str_or_empty(&self, key: &str) -> String {
        self[key].as_str().unwrap_or("").to_string()
    }

    fn str_opt(&self, key: &str) -> Option<String> {
        self[key].as_str().map(String::from)
    }

    fn u64_or(&self, key: &str, default: u64) -> u64 {
        self[key].as_u64().unwrap_or(default)
    }

    fn u64_opt(&self, key: &str) -> Option<u64> {
        self[key].as_u64()
    }

    fn u32_or(&self, key: &str, default: u32) -> u32 {
        self[key].as_u64().map(|v| v as u32).unwrap_or(default)
    }

    fn i64_or(&self, key: &str, default: i64) -> i64 {
        self[key].as_i64().unwrap_or(default)
    }

    fn u32_array(&self, key: &str) -> Vec<u32> {
        self[key]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|n| n as u32))
                    .collect()
            })
            .unwrap_or_default()
    }

    fn string_array(&self, key: &str) -> Vec<String> {
        self[key]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_str_or_empty() {
        let v = json!({"name": "test"});
        assert_eq!(v.str_or_empty("name"), "test");
        assert_eq!(v.str_or_empty("missing"), "");
    }

    #[test]
    fn test_str_or_empty_with_null() {
        let v = json!({"name": null});
        assert_eq!(v.str_or_empty("name"), "");
    }

    #[test]
    fn test_str_opt() {
        let v = json!({"name": "test", "empty": null});
        assert_eq!(v.str_opt("name"), Some("test".to_string()));
        assert_eq!(v.str_opt("missing"), None);
        assert_eq!(v.str_opt("empty"), None);
    }

    #[test]
    fn test_u64_or() {
        let v = json!({"count": 42, "zero": 0});
        assert_eq!(v.u64_or("count", 0), 42);
        assert_eq!(v.u64_or("zero", 99), 0);
        assert_eq!(v.u64_or("missing", 100), 100);
    }

    #[test]
    fn test_u64_opt() {
        let v = json!({"count": 42});
        assert_eq!(v.u64_opt("count"), Some(42));
        assert_eq!(v.u64_opt("missing"), None);
    }

    #[test]
    fn test_u32_or() {
        let v = json!({"version": 5});
        assert_eq!(v.u32_or("version", 1), 5);
        assert_eq!(v.u32_or("missing", 1), 1);
    }

    #[test]
    fn test_i64_or() {
        let v = json!({"timestamp": -1234567890, "positive": 100});
        assert_eq!(v.i64_or("timestamp", 0), -1234567890);
        assert_eq!(v.i64_or("positive", 0), 100);
        assert_eq!(v.i64_or("missing", -1), -1);
    }

    #[test]
    fn test_u32_array() {
        let v = json!({"versions": [1, 2, 3]});
        assert_eq!(v.u32_array("versions"), vec![1, 2, 3]);
        assert_eq!(v.u32_array("missing"), Vec::<u32>::new());
    }

    #[test]
    fn test_u32_array_with_mixed_types() {
        // Non-numeric values should be filtered out
        let v = json!({"versions": [1, "invalid", 3, null, 5]});
        assert_eq!(v.u32_array("versions"), vec![1, 3, 5]);
    }

    #[test]
    fn test_u32_array_empty() {
        let v = json!({"versions": []});
        assert_eq!(v.u32_array("versions"), Vec::<u32>::new());
    }

    #[test]
    fn test_string_array() {
        let v = json!({"features": ["auth", "wal", "clustering"]});
        assert_eq!(
            v.string_array("features"),
            vec![
                "auth".to_string(),
                "wal".to_string(),
                "clustering".to_string()
            ]
        );
    }

    #[test]
    fn test_string_array_empty() {
        let v = json!({"features": []});
        assert_eq!(v.string_array("features"), Vec::<String>::new());
        assert_eq!(v.string_array("missing"), Vec::<String>::new());
    }

    #[test]
    fn test_string_array_with_mixed_types() {
        let v = json!({"features": ["valid", 123, "also_valid", null]});
        assert_eq!(
            v.string_array("features"),
            vec!["valid".to_string(), "also_valid".to_string()]
        );
    }
}
