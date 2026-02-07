//! Configuration management

use crate::constants;
use figment::{
    providers::{Env, Format, Serialized, Yaml},
    Figment,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub rstmdb: RstmdbConfig,
    pub auth: AuthConfig,
    pub data_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub tls: TlsConfig,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TlsConfig {
    pub enabled: bool,
    pub cert_path: Option<String>,
    pub key_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RstmdbConfig {
    pub address: String,
    pub token: Option<String>,
    #[serde(default)]
    pub tls: RstmdbTlsConfig,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RstmdbTlsConfig {
    pub enabled: bool,
    pub ca_cert_path: Option<String>,
    pub insecure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(default = "default_session_idle_timeout")]
    pub session_idle_timeout: String,
    #[serde(default = "default_session_max_lifetime")]
    pub session_max_lifetime: String,
    #[serde(default = "default_lockout_attempts")]
    pub lockout_attempts: u32,
    #[serde(default = "default_lockout_duration")]
    pub lockout_duration: String,
}

fn default_session_idle_timeout() -> String {
    constants::auth::DEFAULT_SESSION_IDLE_TIMEOUT.to_string()
}

fn default_session_max_lifetime() -> String {
    constants::auth::DEFAULT_SESSION_MAX_LIFETIME.to_string()
}

fn default_lockout_attempts() -> u32 {
    constants::auth::DEFAULT_LOCKOUT_ATTEMPTS
}

fn default_lockout_duration() -> String {
    constants::auth::DEFAULT_LOCKOUT_DURATION.to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: constants::server::DEFAULT_HOST.to_string(),
                port: constants::server::DEFAULT_PORT,
                tls: TlsConfig::default(),
            },
            rstmdb: RstmdbConfig {
                address: constants::rstmdb::DEFAULT_ADDRESS.to_string(),
                token: None,
                tls: RstmdbTlsConfig::default(),
            },
            auth: AuthConfig {
                session_idle_timeout: default_session_idle_timeout(),
                session_max_lifetime: default_session_max_lifetime(),
                lockout_attempts: default_lockout_attempts(),
                lockout_duration: default_lockout_duration(),
            },
            data_dir: constants::DEFAULT_DATA_DIR.to_string(),
        }
    }
}

impl Config {
    pub fn load(
        config_path: &PathBuf,
        host: &str,
        port: u16,
        rstmdb_addr: &str,
        rstmdb_token: Option<String>,
    ) -> anyhow::Result<Self> {
        // CLI overrides
        let cli_overrides = Config {
            server: ServerConfig {
                host: host.to_string(),
                port,
                tls: TlsConfig::default(),
            },
            rstmdb: RstmdbConfig {
                address: rstmdb_addr.to_string(),
                token: rstmdb_token,
                tls: RstmdbTlsConfig::default(),
            },
            ..Default::default()
        };

        let config: Config = Figment::new()
            .merge(Serialized::defaults(Config::default()))
            .merge(Yaml::file(config_path))
            .merge(Env::prefixed("STUDIO_").split("_"))
            .merge(Serialized::defaults(cli_overrides))
            .extract()?;

        Ok(config)
    }
}
