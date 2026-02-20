//! User authentication store

use super::password::{hash_password, verify_password};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct AuthData {
    users: HashMap<String, User>,
}

/// Authentication store backed by a JSON file
pub struct AuthStore {
    path: PathBuf,
    data: RwLock<AuthData>,
}

impl AuthStore {
    pub fn new(path: &PathBuf) -> Self {
        let data = if path.exists() {
            let content = std::fs::read_to_string(path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AuthData::default()
        };

        Self {
            path: path.clone(),
            data: RwLock::new(data),
        }
    }

    /// Check if any users exist
    pub fn has_users(&self) -> bool {
        !self.data.read().users.is_empty()
    }

    /// Create a new user
    pub fn create_user(&self, username: &str, password: &str) -> anyhow::Result<()> {
        let password_hash = hash_password(password)?;
        let now = Utc::now();

        let user = User {
            username: username.to_string(),
            password_hash,
            created_at: now,
            updated_at: now,
        };

        {
            let mut data = self.data.write();
            data.users.insert(username.to_string(), user);
        }

        self.save()?;
        Ok(())
    }

    /// Verify user credentials
    pub fn verify(&self, username: &str, password: &str) -> bool {
        let data = self.data.read();
        if let Some(user) = data.users.get(username) {
            verify_password(password, &user.password_hash)
        } else {
            false
        }
    }

    /// Save to file
    fn save(&self) -> anyhow::Result<()> {
        let data = self.data.read();
        let content = serde_json::to_string_pretty(&*data)?;

        // Ensure parent directory exists
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(&self.path, content)?;
        Ok(())
    }
}
