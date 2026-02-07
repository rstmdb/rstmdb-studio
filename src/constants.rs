//! Application constants
//!
//! Centralized constants for the rstmdb-studio application.

/// WAL API constants
pub mod wal {
    /// Default number of WAL entries per page
    pub const DEFAULT_PAGE_SIZE: u64 = 50;
    /// Maximum number of WAL entries per request
    pub const MAX_PAGE_SIZE: u64 = 1000;
}

/// Instance API constants
pub mod instances {
    /// Maximum WAL entries to scan for instance history
    pub const HISTORY_MAX_WAL_SCAN: u64 = 10000;
}

/// WAL entry types (as returned by rstmdb)
pub mod wal_entry_types {
    pub const CREATE_INSTANCE: &str = "create_instance";
    pub const APPLY_EVENT: &str = "apply_event";
}

/// History event types (as returned by Studio API)
pub mod history_event_types {
    pub const CREATED: &str = "created";
    pub const TRANSITION: &str = "transition";
}

/// Server defaults
pub mod server {
    pub const DEFAULT_HOST: &str = "0.0.0.0";
    pub const DEFAULT_PORT: u16 = 8080;
}

/// rstmdb connection defaults
pub mod rstmdb {
    pub const DEFAULT_ADDRESS: &str = "127.0.0.1:7401";
}

/// Authentication defaults
pub mod auth {
    pub const DEFAULT_SESSION_IDLE_TIMEOUT: &str = "2h";
    pub const DEFAULT_SESSION_MAX_LIFETIME: &str = "24h";
    pub const DEFAULT_LOCKOUT_ATTEMPTS: u32 = 10;
    pub const DEFAULT_LOCKOUT_DURATION: &str = "5m";
}

/// Data directory
pub const DEFAULT_DATA_DIR: &str = "~/.rstmdb-studio";
