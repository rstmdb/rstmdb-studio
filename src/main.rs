//! rstmdb Studio - Web UI for managing rstmdb instances

mod api;
mod auth;
mod config;
mod constants;
mod error;
mod json_ext;
mod rstmdb;
mod static_files;
mod validation;

use crate::config::Config;
use crate::rstmdb::StudioClient;
use crate::static_files::static_handler;
use axum::{
    routing::{get, post},
    Router,
};
use clap::{Parser, Subcommand};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tower_sessions::{MemoryStore, SessionManagerLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Parser)]
#[command(name = "rstmdb-studio")]
#[command(about = "Web UI for managing rstmdb instances")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize admin user
    Init {
        /// Admin username
        #[arg(long, default_value = "admin")]
        admin_user: String,

        /// Admin password
        #[arg(long)]
        admin_pass: String,

        /// Data directory
        #[arg(long, default_value = "~/.rstmdb-studio")]
        data_dir: PathBuf,
    },

    /// Start the web server
    Serve {
        /// Configuration file path
        #[arg(short, long, default_value = "studio.yaml")]
        config: PathBuf,

        /// Server bind address
        #[arg(long, env = "STUDIO_HOST", default_value = "0.0.0.0")]
        host: String,

        /// Server port
        #[arg(short, long, env = "STUDIO_PORT", default_value = "8080")]
        port: u16,

        /// rstmdb server address
        #[arg(long, env = "RSTMDB_ADDR", default_value = "127.0.0.1:7401")]
        rstmdb_addr: String,

        /// rstmdb auth token
        #[arg(long, env = "RSTMDB_TOKEN")]
        rstmdb_token: Option<String>,
    },
}

/// Application state shared across handlers
pub struct AppState {
    pub config: Config,
    pub rstmdb: StudioClient,
    pub auth_store: auth::AuthStore,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Init {
            admin_user,
            admin_pass,
            data_dir,
        } => {
            init_admin(&admin_user, &admin_pass, &data_dir).await?;
        }
        Commands::Serve {
            config,
            host,
            port,
            rstmdb_addr,
            rstmdb_token,
        } => {
            serve(config, &host, port, &rstmdb_addr, rstmdb_token).await?;
        }
    }

    Ok(())
}

async fn init_admin(
    username: &str,
    password: &str,
    data_dir: &std::path::Path,
) -> anyhow::Result<()> {
    let data_dir = shellexpand::tilde(&data_dir.to_string_lossy()).to_string();
    let data_dir = PathBuf::from(data_dir);

    // Create data directory
    std::fs::create_dir_all(&data_dir)?;

    // Initialize auth store
    let auth_path = data_dir.join("auth.json");
    let auth_store = auth::AuthStore::new(&auth_path);

    // Create admin user
    auth_store.create_user(username, password)?;

    tracing::info!(
        username = username,
        path = %auth_path.display(),
        "Admin user created successfully"
    );

    println!("Admin user '{}' created successfully!", username);
    println!("Auth data stored at: {}", auth_path.display());

    Ok(())
}

async fn serve(
    config_path: PathBuf,
    host: &str,
    port: u16,
    rstmdb_addr: &str,
    rstmdb_token: Option<String>,
) -> anyhow::Result<()> {
    // Load configuration
    let config = Config::load(&config_path, host, port, rstmdb_addr, rstmdb_token)?;

    tracing::info!(
        rstmdb_addr = %config.rstmdb.address,
        "Connecting to rstmdb server"
    );

    // Connect to rstmdb
    let rstmdb = StudioClient::connect(&config.rstmdb).await?;

    tracing::info!("Connected to rstmdb server");

    // Load auth store
    let auth_path =
        PathBuf::from(shellexpand::tilde(&config.data_dir).to_string()).join("auth.json");
    let auth_store = auth::AuthStore::new(&auth_path);

    if !auth_store.has_users() {
        tracing::warn!("No admin user configured. Run 'rstmdb-studio init' to create one.");
    }

    // Create app state
    let state = Arc::new(AppState {
        config: config.clone(),
        rstmdb,
        auth_store,
    });

    // Build router
    let app = create_router(state);

    // Start server
    let addr: SocketAddr = format!("{}:{}", config.server.host, config.server.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!(%addr, "Starting rstmdb Studio");
    println!("\n  rstmdb Studio running at http://{}\n", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

fn create_router(state: Arc<AppState>) -> Router {
    // Session store (in-memory for simplicity, use Redis/DB in production)
    let session_store = MemoryStore::default();
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false) // Set to true in production with HTTPS
        .with_http_only(true)
        .with_same_site(tower_sessions::cookie::SameSite::Lax);

    // API routes
    let api = Router::new()
        // Auth routes
        .route("/auth/login", post(api::auth::login))
        .route("/auth/logout", post(api::auth::logout))
        .route("/auth/me", get(api::auth::me))
        .route("/auth/csrf", get(api::auth::csrf_token))
        // Machine routes
        .route("/machines", get(api::machines::list_machines))
        .route("/machines/:name", get(api::machines::get_machine))
        .route(
            "/machines/:name/versions/:version",
            get(api::machines::get_machine_version),
        )
        .route(
            "/machines/:name/versions",
            post(api::machines::create_machine_version),
        )
        .route("/machines/validate", post(api::machines::validate_machine))
        // Instance routes
        .route("/instances", get(api::instances::list_instances))
        .route("/instances/:id", get(api::instances::get_instance))
        .route(
            "/instances/:id/history",
            get(api::instances::get_instance_history),
        )
        // WAL routes
        .route("/wal", get(api::wal::list_wal_entries))
        .route("/wal/stats", get(api::wal::get_wal_stats))
        .route("/wal/:offset", get(api::wal::get_wal_entry))
        // Server routes
        .route("/server/info", get(api::server::info))
        .route("/server/health", get(api::server::health));

    // Health endpoints (no auth required)
    let health = Router::new()
        .route("/healthz", get(api::server::healthz))
        .route("/readyz", get(api::server::readyz));

    // CORS configuration
    // Note: credentials require specific origins/headers, not wildcards
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .nest("/api/v1", api)
        .merge(health)
        // Serve embedded frontend - fallback handles SPA routing
        .fallback(static_handler)
        .layer(session_layer)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
