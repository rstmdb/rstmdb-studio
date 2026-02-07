//! Embedded static file serving for the frontend SPA

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    response::Response,
};
use rust_embed::RustEmbed;

/// Embedded frontend assets from the dist folder
#[derive(RustEmbed)]
#[folder = "frontend/dist"]
pub struct Assets;

/// Axum handler that serves embedded static files with SPA fallback
pub async fn static_handler(req: Request) -> Response {
    let path = req.uri().path().trim_start_matches('/');

    // Try exact file match first
    if !path.is_empty() {
        if let Some(file) = Assets::get(path) {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            let cache = cache_control(path);
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .header(header::CACHE_CONTROL, cache)
                .body(Body::from(file.data.into_owned()))
                .unwrap();
        }
    }

    // SPA fallback: serve index.html for all non-file paths
    // This enables client-side routing
    if let Some(index) = Assets::get("index.html") {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .header(header::CACHE_CONTROL, "no-cache")
            .body(Body::from(index.data.into_owned()))
            .unwrap();
    }

    // No frontend built - show helpful message
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from(
            "Frontend not built. Run 'npm run build' in the frontend directory.",
        ))
        .unwrap()
}

fn cache_control(path: &str) -> &'static str {
    if path.starts_with("assets/") {
        // Vite hashed assets are immutable
        "public, max-age=31536000, immutable"
    } else if path == "index.html" {
        // Always revalidate index.html
        "no-cache"
    } else {
        // Other static files: cache for 1 hour
        "public, max-age=3600"
    }
}
