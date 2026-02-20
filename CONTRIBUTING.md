# Contributing to rstmdb Studio

Thanks for your interest in contributing!

## Getting Started

1. Fork and clone the repository
2. Install dependencies:
   - Rust 1.85+ (`rustup`)
   - Node.js 20+ (`nvm` recommended)
3. Run `cd frontend && npm install`
4. Start a local rstmdb server
5. Run the backend: `cargo run -- serve --config studio.yaml`
6. Run the frontend dev server: `cd frontend && npm run dev`

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Ensure the code compiles: `cargo check`
4. Run tests: `cargo test`
5. Lint the frontend: `cd frontend && npm run lint && npm run type-check`
6. Submit a pull request

## Code Style

- **Rust**: Follow standard Rust formatting (`cargo fmt`)
- **TypeScript**: ESLint configuration is provided (`npm run lint`)
- Keep commits focused and write clear commit messages

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce, expected behavior, and actual behavior
- Include relevant logs or screenshots

## Pull Requests

- Keep PRs focused on a single change
- Update tests if applicable
- Ensure CI passes before requesting review
