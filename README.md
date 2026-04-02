# PEP Collector

MCP App server for PEP (Politically Exposed Person) and sanctions screening. Aggregates data from international sanctions lists and provides fuzzy matching search — all accessible through MCP tools with interactive UIs inside any compatible MCP client.

## Features

- **Multi-source screening** — OFAC, UN, EU, UK HMT, OpenSanctions, EveryPolitician, Wikidata
- **Fuzzy matching** — Levenshtein, Jaro-Winkler, Metaphone, Token Set algorithms with configurable weights
- **Interactive UIs** — Results tables, entity profile cards, network graphs rendered in MCP client
- **Custom sources** — Add your own JSON, CSV, XML, or NDJSON data sources
- **Relationship graphs** — Traverse entity connections (family, associates, directors, beneficial owners)
- **Self-hosted** — Bring your own Neo4j database and Auth0 tenant

## Prerequisites

- **Node.js** >= 20 (with pnpm) — or **Docker**
- **Neo4j** database (v5+) — cloud-hosted [Neo4j Aura](https://neo4j.com/cloud/aura/) or self-hosted
- **Auth0** tenant — for access control (required for HTTP transport; skipped for local stdio)

## Neo4j Setup

The server creates all required schema automatically on startup (indexes, constraints, full-text indexes). You just need a running Neo4j instance.

### Option A: Neo4j Aura (cloud — recommended)

1. Create a free instance at [console.neo4j.io](https://console.neo4j.io/)
2. Note the **Connection URI** (e.g. `neo4j+s://xxxxxxxx.databases.neo4j.io`), **Username**, and **Password**
3. Set these as `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` in your `.env`

### Option B: Docker Compose (local)

The included `docker-compose.yml` starts a local Neo4j instance alongside the server:

```bash
cp .env.example .env
# Set NEO4J_URI=neo4j://neo4j:7687 and NEO4J_USERNAME=neo4j, NEO4J_PASSWORD=changeme
docker compose up
```

Neo4j Browser will be available at `http://localhost:7474`.

### Option C: Self-hosted

Run Neo4j 5+ anywhere and point `NEO4J_URI` to it. The server supports `neo4j://`, `neo4j+s://` (TLS), and `bolt://` protocols.

### Schema created at startup

The server automatically creates the following when it connects:

- **Nodes:** Person, Company, Country, SanctionsList, CrawlRun, DataSource
- **Uniqueness constraints** on all node IDs
- **Full-text indexes** on Person(normalizedName, fullName) and Company(normalizedName, name) for fuzzy search
- **Composite indexes** on Person(normalizedName, dateOfBirth) and CrawlRun(source, date)

## Auth0 Setup

Auth0 provides JWT-based access control with two permission scopes. This is required for HTTP transport; stdio mode grants all permissions automatically.

1. **Create an API** in your Auth0 tenant
   - Set the **Identifier** (audience) to match your `AUTH0_AUDIENCE` env var (e.g. `https://pep-collector/api`)
2. **Add two Permissions** to the API:
   - `screen:read` — access to screening tools
   - `admin:manage` — access to admin tools (source management, crawls, config)
3. **Create two Roles:**
   - `user` — assign `screen:read`
   - `admin` — assign both `screen:read` and `admin:manage`
4. **Enable "Add Permissions in the Access Token"** in the API Settings tab
5. **Create a Machine-to-Machine Application** and authorize it for your API with the desired permissions
6. Use the M2M app's Client ID and Client Secret to request tokens:

```bash
curl --request POST \
  --url https://YOUR_TENANT.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://pep-collector/api",
    "grant_type": "client_credentials"
  }'
```

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your Neo4j and Auth0 credentials
docker compose up
```

The MCP server will be available at `http://localhost:3000/mcp`.

### Manual

```bash
pnpm install
pnpm build
pnpm start
```

For stdio transport (local MCP client):

```bash
pnpm start:stdio
```

## MCP Client Configuration

### Option 1: Docker (recommended)

Build the image once:

```bash
docker build -t pep-collector .
```

Then add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pep-collector": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io",
        "-e", "NEO4J_USERNAME=neo4j",
        "-e", "NEO4J_PASSWORD=your-password",
        "-e", "AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com",
        "-e", "AUTH0_AUDIENCE=https://pep-collector/api",
        "pep-collector",
        "node", "dist/main.js", "--stdio"
      ]
    }
  }
}
```

> **Note:** The `-i` flag keeps stdin open for MCP stdio transport. The `--rm` flag removes the container when it exits.

### Option 2: Remote (HTTP)

Run the server with Docker Compose or on any host:

```bash
# With Docker Compose (includes a local Neo4j instance)
cp .env.example .env
# Edit .env with your credentials
docker compose up -d

# Or run the image standalone
docker run -d -p 3000:3000 --env-file .env pep-collector
```

Then configure your MCP client to connect to the remote endpoint:

**Claude Desktop** — add a streamable HTTP server:

```json
{
  "mcpServers": {
    "pep-collector": {
      "type": "streamable-http",
      "url": "http://your-server:3000/mcp",
      "headers": {
        "Authorization": "Bearer <AUTH0_ACCESS_TOKEN>"
      }
    }
  }
}
```

**Other MCP clients** — point to `http://your-server:3000/mcp` and include an `Authorization: Bearer <token>` header. Obtain a token from your Auth0 tenant using the Machine-to-Machine application credentials (see [Auth0 Setup](#auth0-setup)).

### Option 3: Local Node.js (no Docker)

```json
{
  "mcpServers": {
    "pep-collector": {
      "command": "node",
      "args": ["/path/to/pep-collector/dist/main.js", "--stdio"],
      "env": {
        "NEO4J_URI": "neo4j+s://your-instance.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password",
        "AUTH0_ISSUER_BASE_URL": "https://your-tenant.auth0.com",
        "AUTH0_AUDIENCE": "https://pep-collector/api"
      }
    }
  }
}
```

Requires building first: `pnpm install && pnpm build`.

## Data Sources

### Built-in sources

Seven sanctions and PEP lists are pre-configured and enabled by default:

| Source | Data | Format | Risk | Entities |
|--------|------|--------|------|----------|
| **OFAC SDN** | US Treasury Specially Designated Nationals | XML | HIGH | Person, Company |
| **UN Consolidated** | UN Security Council sanctions | XML | HIGH | Person, Company |
| **EU Financial Sanctions** | EU restrictive measures | XML | HIGH | Person, Company |
| **UK HMT** | UK financial sanctions targets | CSV | HIGH | Person, Company |
| **OpenSanctions** | Aggregated global sanctions (FtM schema) | NDJSON | HIGH | Person, Company |
| **EveryPolitician** | Politicians worldwide (Popolo format) | JSON | MEDIUM | Person |
| **Wikidata PEPs** | Politically exposed persons via SPARQL | JSON | MEDIUM | Person |

### Custom sources

Add your own data sources via the `create_source` tool. Supported formats:

- **JSON** — any HTTP JSON API with configurable field mapping (dot-path field resolution)
- **CSV** — configurable delimiter, column mapping, date format parsing
- **XML** — tag-based extraction with attribute support
- **NDJSON** — newline-delimited JSON with optional filtering

Custom sources are stored in Neo4j and can be enabled/disabled, tested, and crawled independently.

## How Crawling Works

### Pipeline

Each crawl (per source) follows this pipeline:

1. **Fetch** — downloads raw data from the source URL
2. **Normalize** — transforms raw records into a standard entity format (name, aliases, DOB, nationality, role, risk level)
3. **Deduplicate** — groups entities by normalized name + DOB, merges aliases/nationalities, keeps highest risk level
4. **Generate IDs** — deterministic SHA-256 hash of `normalizedName|dateOfBirth|source` for stable deduplication across runs
5. **Upsert** — MERGE into Neo4j (creates or updates Person/Company nodes)
6. **Record** — creates a CrawlRun node tracking status, record count, timing, and errors

### Name normalization

Before matching or deduplication, all names go through a 7-step normalization:

1. Transliteration (non-Latin scripts to Latin)
2. Diacritics removal (NFD decomposition)
3. Lowercasing
4. Honorific stripping (35 titles: mr, dr, sheikh, president, senator, etc.)
5. Non-alpha character removal (keeps spaces and hyphens)
6. Whitespace normalization

### Scheduling

- **On-demand** — use the `trigger_crawl` tool to crawl one or all sources
- **Scheduled** — set `CRAWL_SCHEDULE` to a cron expression (e.g. `0 2 * * *` for daily at 2am)
- **Per-source** — crawl a single source by ID, or omit to crawl all enabled sources

### Monitoring

Use `get_crawl_status` for a dashboard of recent crawl runs with timing, record counts, and errors per source. Use `get_data_status` for a quick freshness overview.

## Matching Algorithm

Screening searches use a two-stage pipeline:

### Stage 1: Candidate retrieval

The search term is normalized and run against Neo4j full-text indexes (Lucene) to retrieve up to `RETRIEVE_LIMIT` (default 20) rough candidates.

### Stage 2: Re-ranking

Each candidate is scored with four fuzzy matching algorithms, combined using configurable weights:

| Algorithm | Default Weight | Strength |
|-----------|---------------|----------|
| **Levenshtein** | 0.25 | Edit distance — catches typos and minor spelling variations |
| **Jaro-Winkler** | 0.25 | Prefix-weighted similarity — good for names with matching beginnings |
| **Double Metaphone** | 0.25 | Phonetic encoding — catches names that sound alike across languages |
| **Token Set** | 0.25 | Word-level Dice coefficient — handles reordered or partial name tokens |

Optional boosts are applied:
- **Date of birth match**: +0.05
- **Nationality match**: +0.03

Results below `minScore` (default 0.6) are filtered out. Use `update_matching_config` to tune weights and threshold.

## MCP Tools

### User Tools (screen:read)

| Tool | Description |
|------|-------------|
| `screen_person` | Fuzzy search for individuals with interactive results UI |
| `screen_company` | Fuzzy search for companies with interactive results UI |
| `batch_screen` | Screen up to 1000 entities with batch results UI |
| `get_entity_details` | Full entity profile with interactive detail card |
| `get_entity_network` | Relationship graph visualization |
| `get_source_coverage` | View active data sources and coverage |
| `get_data_status` | Data freshness per source |

### Admin Tools (admin:manage)

| Tool | Description |
|------|-------------|
| `list_sources` | List configured data sources |
| `create_source` | Add a custom data source |
| `update_source` | Modify source configuration |
| `delete_source` | Remove a custom source |
| `test_source` | Test-fetch and validate a source |
| `trigger_crawl` | Manually trigger data crawl |
| `get_crawl_status` | Crawl history dashboard with interactive UI |
| `get_matching_config` | View matching algorithm config |
| `update_matching_config` | Adjust matching weights and threshold |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEO4J_URI` | Yes | Neo4j connection URI (`neo4j+s://`, `neo4j://`, or `bolt://`) |
| `NEO4J_USERNAME` | Yes | Neo4j username |
| `NEO4J_PASSWORD` | Yes | Neo4j password |
| `AUTH0_ISSUER_BASE_URL` | Yes | Auth0 tenant URL (e.g. `https://your-tenant.auth0.com`) |
| `AUTH0_AUDIENCE` | Yes | Auth0 API identifier/audience |
| `PORT` | No | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: allow all) |
| `CRAWL_SCHEDULE` | No | Cron expression for scheduled crawls (e.g. `0 2 * * *`) |
| `RETRIEVE_LIMIT` | No | Max candidates retrieved from Neo4j per search (default: 20) |
| `MAX_RESULTS` | No | Max results returned per search (default: 10) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache License 2.0 — see [LICENSE](LICENSE)
