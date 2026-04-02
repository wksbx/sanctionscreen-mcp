# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-04-01

### Added
- Multi-source PEP and sanctions screening (OFAC, UN, EU, UK HMT, OpenSanctions, EveryPolitician, Wikidata)
- Fuzzy matching with Levenshtein, Jaro-Winkler, Metaphone, and Token Set algorithms
- Interactive MCP App UIs for screening results, entity details, network graphs, and crawl status
- Custom data source support (JSON, CSV, XML, NDJSON)
- Relationship graph traversal
- Batch screening (up to 1000 entities)
- Auth0-based access control with permission scopes
- Scheduled crawls via cron
- Docker and Docker Compose support
- Stdio and HTTP (Streamable HTTP) transport modes
