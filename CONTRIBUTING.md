# Contributing to PEP Collector

Thanks for your interest in contributing! This document explains how to get started.

## Development Setup

1. **Prerequisites**: Node.js >= 20, pnpm, Docker (optional)

2. **Clone and install**:
   ```bash
   git clone https://github.com/pep-collector/pep-collector.git
   cd pep-collector
   pnpm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Neo4j and Auth0 credentials
   ```

4. **Run locally**:
   ```bash
   pnpm dev          # HTTP mode with hot reload
   pnpm dev:stdio    # Stdio mode
   ```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Write tests for new functionality
3. Run the full test suite: `pnpm test`
4. Run type checking: `pnpm lint`
5. Make sure your code builds: `pnpm build`

## Pull Request Process

1. Update documentation if your change affects the public API or configuration
2. Ensure CI passes (tests, type check, build)
3. Keep PRs focused — one feature or fix per PR
4. Write a clear description of what changed and why

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Include your Node.js version, OS, and MCP client

## Code Style

- TypeScript strict mode is enforced
- Use Zod for runtime validation at system boundaries
- Keep Neo4j queries parameterized (never interpolate user input into Cypher)
- Use the `logger` module instead of `console.log`/`console.error`

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
