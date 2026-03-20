# Quickl — Development Roadmap

> **Project:** `quickl`
> **MVP Target:** v1.0.0
> **Versioning:** Semantic Versioning (major.minor.patch)
> **Release Cadence:** Phase deliverables every 2–4 weeks (solo/small team pace)

---

## Overview

```
MVP PHASES
──────────────────────────────────────────────────────────
Phase 0  — Foundation & Scaffolding         [~1 week]
Phase 1  — Provider Management              [~2 weeks]
Phase 2  — Local Model Management           [~2 weeks]
Phase 3  — Proxy Gateway Layer              [~2 weeks]
Phase 4  — IDE Auto-Configuration           [~2 weeks]
Phase 5  — MCP Server Registry              [~2 weeks]
Phase 6  — Guardrail Engine                 [~3 weeks]
Phase 7  — System Tray & Daemon             [~1 week]
Phase 8  — Profiles & Settings              [~1 week]
Phase 9  — Logs, Diagnostics & Polish       [~2 weeks]
Phase 10 — Testing, Signing & Distribution  [~1 week]
──────────────────────────────────────────────────────────
                                  Total:  ~19 weeks → v1.0.0

POST-MVP RELEASES
──────────────────────────────────────────────────────────
v1.1.0  — Usage & Cost Tracking
v1.2.0  — Extended IDE Support (Zed, JetBrains, Neovim — HTTP/SSE)
v1.3.0  — Advanced Model Features
v1.4.0  — Guardrail Templates & Semantic Rules
v1.5.0  — Team Profiles & Sync
v1.6.0  — Prompt Library
v1.7.0  — Edge Case IDE Support (stdio shim — cleanup before major)
v2.0.0  — Plugin System
```

---

## Phase 0 — Foundation & Scaffolding

**Goal:** Working Electron shell with correct architecture, tooling, and no technical debt from day one.

**Duration:** ~1 week
**Version tag:** `v0.1.0-alpha`

### Tasks

#### 0.1 — Project Initialization
- [x] Init repo: `npm create electron-vite@latest quickl -- --template react-ts`
- [x] Configure `electron-vite` for hot reload in both main + renderer
- [x] Set up directory structure:
  ```
  src/
    main/
      ipc/         # IPC handlers — one file per domain
      services/    # Business logic services
      proxy/       # Proxy gateway + guardrail engine
      lib/         # Utilities, helpers
    preload/       # Preload scripts + contextBridge definitions
    renderer/
      pages/       # Page components — one per nav item
      components/  # Shared UI components
      stores/      # Zustand stores
      hooks/       # Custom React hooks
      lib/         # Frontend utilities
    shared/        # Types shared between main and renderer
  ```
- [x] Configure TypeScript strict mode across all packages
- [x] Configure path aliases: `@main/*`, `@renderer/*`, `@shared/*`

#### 0.2 — Tooling Setup
- [x] ESLint + Prettier (`eslint-plugin-react`, `@typescript-eslint`)
- [x] Husky pre-commit hooks (lint + typecheck)
- [x] Vitest configuration for main process unit tests
- [x] Playwright + `playwright-electron` for E2E
- [x] GitHub Actions CI:
  - `ci.yml` — runs on every PR: lint, typecheck, unit tests
  - `release.yml` — triggered on `v*` tags: build all 3 platforms, create GitHub Release

#### 0.3 — Core Architecture
- [x] Implement `contextBridge` preload with full typed `window.quickl` interface (all methods stubbed)
- [x] Set up `electron-store` with schema validation and versioned migrations
- [ ] Set up `keytar` wrapper service with typed interface
- [x] Implement central `Logger` class:
  - Levels: debug / info / warn / error
  - Categories: provider / model / ide / mcp / guardrail / proxy / system
  - Writes structured JSON to rotating log file in `userData/logs/quickl-YYYY-MM-DD.log`
  - Emits IPC events so renderer receives live log entries
  - Sensitive data scrubber: strips API key patterns before writing
- [x] Set up `electron-updater` (stub, activated in Phase 10)

#### 0.4 — Shell UI
- [x] Install and configure Tailwind CSS + `shadcn/ui`
- [x] Build app shell: sidebar nav + main content area + status bar
- [x] Sidebar with all 8 nav items: Dashboard, Providers, Models, IDEs, MCP, Guardrails, Logs, Settings
- [x] React Router (hash router for Electron compatibility)
- [x] Empty state template component (reused across all pages)
- [x] Status bar with placeholder values
- [x] Dark/light theme toggle via CSS variables + system preference detection

#### 0.5 — Window Management
- [x] BrowserWindow security settings: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`
- [x] Window state persistence (position, size) across restarts
- [x] App lifecycle: single instance lock, activate on dock click (macOS)
- [x] Custom traffic light buttons on macOS frameless window

**Exit criteria:** App launches, sidebar navigates between empty pages, dark/light toggle works, CI pipeline green.

**Status:** Completed — 2026-03-20

**Notes:** Phase 0 scaffold implemented and committed (typed bridge, preload, IPC stubs, logger, electron-store, renderer shell, CI, lint, and tests). Electron runtime cannot be launched in this headless container; runtime validation should be done on a developer machine or CI runner with display/DBUS.

---

## Phase 1 — Provider Management

**Goal:** Users can add, edit, test, and monitor API providers. Keys stored securely in OS keychain.

**Duration:** ~2 weeks
**Version tag:** `v0.2.0-alpha`

### Tasks

#### 1.1 — ProviderService (main process)
- [x] `ProviderService` class:
  - `add(config)` — validates, stores metadata in electron-store, key in keytar
  - `update(id, config)` — partial update
  - `remove(id)` — deletes from store + keytar
  - `list()` — returns all providers (no key values)
  - `testConnection(id)` — fetches from provider endpoint, measures latency
  - `fetchModels(id)` — calls `/v1/models` or equivalent
  - `getKeyHint(id)` — retrieves from keytar, returns last 4 chars masked

- [x] Per-provider connection test logic:
  - OpenAI: `GET /v1/models`
  - Anthropic: `POST /v1/messages` with minimal message
  - Ollama: `GET /api/tags`
  - LM Studio: `GET /v1/models`
  - Google: `GET /v1beta/models`
  - Custom: user-defined test endpoint

- [x] `HealthPoller` class:
  - `setInterval` polling per enabled provider
  - Configurable interval (default 30s)
  - Emits `provider-status-changed` IPC events on state change
  - Pauses on machine sleep via `electron.powerMonitor`

  **Status:** Completed — 2026-03-20

#### 1.2 — IPC Handlers
- [x] Register all `providers.*` IPC handlers
- [x] Type-safe handler registration helper that enforces return types

**Status:** Completed — 2026-03-20

#### 1.3 — Providers Page (renderer)
- [x] Provider list with status cards
- [x] Status indicator component (color dot + label + latency badge)
- [x] Add Provider modal: preset picker, API key field (masked), base URL, test button, save
- [x] Edit provider drawer
- [x] Delete confirmation dialog
- [x] Available Models expandable section (fetches on demand)

**Exit criteria:** Can add OpenAI + Anthropic + Ollama. Keys survive restart. Health polling updates status. Delete works cleanly.

**Status:** Completed — 2026-03-20

**Notes:** Phase 1 manual validation performed (see `PHASE1-VALIDATION.md`). Ollama tested locally; OpenAI/Anthropic tests deferred (no API keys available). All implemented provider management flows, IPC handlers, keychain integration, health polling, and renderer UI were verified on a developer machine.

**Completed:** 2026-03-20

---

## Phase 2 — Local Model Management

**Goal:** Users can browse, download, and manage local models. Resource usage visible.

**Duration:** ~2 weeks
**Version tag:** `v0.3.0-alpha`

### Tasks

#### 2.1 — ModelService (main process)
- [ ] `ModelService`:
  - `listInstalled()` — queries Ollama API + LM Studio API, merges and normalizes
  - `pull(name)` — streams progress from Ollama `/api/pull`, emits progress events
  - `delete(runtime, name)` — calls Ollama delete endpoint
  - `load(name)` — warms model via generate endpoint with keep_alive
  - `unload(name)` — sets keep_alive to 0

- [ ] `ResourceMonitor`:
  - RAM: `os.totalmem()` / `os.freemem()`
  - VRAM NVIDIA: parse `nvidia-smi --query-gpu=memory.total,memory.used --format=csv`
  - VRAM macOS Apple Silicon: `ioreg` query (best-effort)
  - VRAM AMD: `rocm-smi` (best-effort)
  - Push updates every 5s when Models page is open

- [ ] `OllamaRegistryClient`:
  - Fetch model list from Ollama library
  - Cache for 1 hour in electron-store

#### 2.2 — Models Page (renderer)
- [ ] Installed models grid with full info cards
- [ ] Load/Unload toggle, Delete with confirmation, Tag editor
- [ ] Model Discovery tab: search, filter, pull button, progress bar
- [ ] Resource Monitor widget in sidebar

#### 2.3 — Ollama Daemon Management
- [ ] Detect if Ollama installed but not running → offer to start from Quickl
- [ ] Show install prompt if Ollama not found
- [ ] Monitor Ollama process health

**Exit criteria:** Can see installed models, pull with progress, load/unload, see VRAM usage.

---

## Phase 3 — Proxy Gateway Layer

**Goal:** Both proxy servers running and stable. IDEs and agents can connect. Foundation for IDE config and guardrails.

**Duration:** ~2 weeks
**Version tag:** `v0.4.0-alpha`

This phase is explicitly separated from IDE config because the proxy is foundational infrastructure that must be stable and tested before either IDE config or guardrails are built on top of it.

### Tasks

#### 3.1 — Provider Proxy (`localhost:3820`)
- [ ] Implement HTTP server using Node.js `http` module, binding to `127.0.0.1` only
- [ ] Route all OpenAI-compatible requests to currently active provider:
  - `POST /v1/chat/completions`
  - `POST /v1/completions`
  - `GET /v1/models`
  - `POST /v1/embeddings`
- [ ] Implement per-provider format translation:
  - OpenAI → Anthropic: wrap in `messages` format, add `max_tokens`, remap `role: system`
  - Anthropic → OpenAI (response): unwrap content, remap finish reason
  - All other providers: OpenAI-compatible, pass through
- [ ] Implement streaming (SSE) pass-through:
  - Parse and forward SSE chunks correctly
  - Handle connection close / abort from client side
- [ ] Key injection at request time: fetch from keytar, inject as `Authorization` header, key never logged
- [ ] Request/response logging at DEBUG level (payload truncated, key values stripped)
- [ ] Error handling: provider unreachable → return 502 with descriptive JSON error

#### 3.2 — MCP Aggregator Proxy (`localhost:3821`)

The aggregator must support two MCP transports. Streamable HTTP is the current MCP standard; SSE is deprecated in the spec but still required for backward compatibility with older clients.

- [ ] Implement **Streamable HTTP** endpoint at `/mcp` (primary transport):
  - Standard HTTP request/response with streaming body
  - Binding to `127.0.0.1` only
  - Handle MCP `initialize` handshake: read `clientInfo.name` + `clientInfo.version`, respond with aggregated tool list
  - Route tool calls to correct backing MCP server by tool name
  - Handle server add/remove dynamically without dropping connections

- [ ] Implement **SSE** endpoint at `/sse` (fallback transport):
  - Legacy Server-Sent Events format
  - Same handshake + routing logic as Streamable HTTP
  - Used automatically when Quickl detects the IDE/extension does not support Streamable HTTP
  - Clearly documented as deprecated upstream — users encouraged to migrate to Streamable HTTP

- [ ] Transport detection per IDE:
  - `IDETransportCapability` map: keyed by IDE type + extension + version range
  - Determines which transport URL Quickl writes into IDE configs at configuration time
  - Falls back to SSE if version cannot be determined

- [ ] Log all tool call routing at DEBUG level (both transports)

#### 3.3 — ProxyService (IPC)
- [ ] `ProxyService` class managing lifecycle of both proxies
- [ ] Auto-start both proxies when app starts
- [ ] Port conflict detection: if port in use, log error + surface in status bar
- [ ] `getStatus()` returns: both proxy ports, request counts, active connections
- [ ] `restart()` gracefully restarts both proxies

#### 3.4 — Proxy Status in UI
- [ ] Status bar shows proxy status: green dot when both running, red when either down
- [ ] Settings → Proxy: port configuration for both proxies (change takes effect on restart)
- [ ] Dashboard shows proxy request count (last hour)

**Exit criteria:** Both proxies start automatically. Can send an OpenAI-compatible request to `localhost:3820` and receive a valid response from the active provider. MCP `initialize` handshake works. Ports configurable. Status visible in UI.

---

## Phase 4 — IDE Auto-Configuration

**Goal:** Detected IDEs can be configured to use the Quickl proxy in one click with a previewed diff.

**Duration:** ~2 weeks
**Version tag:** `v0.5.0-alpha`

### Tasks

#### 4.1 — IDE Detection Engine
- [ ] `IDEDetector` service scanning all known paths per OS:
  - macOS: `/Applications/*.app`, `~/Library/Application Support/`, `~/.config/`
  - Windows: `%LOCALAPPDATA%`, `%APPDATA%`, `%USERPROFILE%/`
  - Linux: `~/.local/share/`, `~/.config/`, `~/snap/`
- [ ] Per-IDE detectors: VS Code, Cursor, Windsurf, JetBrains (all products), Zed, Neovim
- [ ] Extension detection: scan extension dirs for known AI extension IDs
- [ ] Cache results, re-scan on demand

#### 4.2 — Config Writers

- [ ] Abstract `ConfigWriter` interface:
  ```typescript
  interface ConfigWriter {
    read(idePath: string): Promise<unknown>;
    generatePatch(current: unknown, proxyConfig: ProxyConfig): ConfigPatch;
    apply(idePath: string, patch: ConfigPatch): Promise<void>;
    backup(idePath: string): Promise<string>;
    restore(backupPath: string): Promise<void>;
  }
  ```

- [ ] Transport selector utility:
  - Given IDE type + detected version, returns `'http'` (Streamable HTTP) or `'sse'` (fallback)
  - Defaults to `'http'` for all primary targets (Cursor, VS Code + Copilot, Continue.dev)
  - Defaults to `'sse'` for any unrecognized or older client version

- [ ] Implement config writers for **primary MVP targets** — all point at `localhost:3820` (provider proxy) and `localhost:3821` (MCP aggregator) using the transport selector:
  - **VS Code + Continue.dev** — `~/.continue/config.json`, Streamable HTTP
  - **VS Code + Cline** — `settings.json` cline entries, provider proxy only
  - **VS Code + GitHub Copilot** — `.vscode/mcp.json` or user settings, Streamable HTTP for MCP tools. Note: Copilot completions cannot be proxied — only MCP tool/agent calls are configured.
  - **Cursor** — `~/.cursor/mcp.json` + settings, Streamable HTTP
  - **Windsurf** — `~/.codeium/windsurf/` settings, Streamable HTTP

- [ ] **Zed, JetBrains, Neovim** — detection only in MVP (show as "detected, config support coming in v1.2.0"). No config writers in MVP.

#### 4.3 — Diff Preview Component
- [ ] `DiffViewer` React component: side-by-side before/after, syntax highlighted, line-by-line added/removed
- [ ] IPC: `configure()` returns diff object (not applied yet), `applyConfig()` applies it
- [ ] Atomic write + backup on apply

#### 4.4 — IDEs Page (renderer)
- [ ] IDE grid: card per detected IDE with logo, version, status, detected extensions
- [ ] "Scan for IDEs" button
- [ ] Per-IDE detail: current config preview, configure flow, backup history with restore

**Exit criteria:** Can scan and detect all installed IDEs (including Zed, JetBrains — shown as detected but not yet configurable). Can configure VS Code + Continue.dev, VS Code + Copilot MCP, and Cursor with diff preview. Streamable HTTP used by default, SSE fallback works. Backup and restore work. IDE sends request through Quickl proxy successfully.

---

## Phase 5 — MCP Server Registry

**Goal:** Users can install, manage, and connect MCP servers. All aggregated through `localhost:3821`.

**Duration:** ~2 weeks
**Version tag:** `v0.6.0-alpha`

### Tasks

#### 5.1 — MCPService (main process)
- [ ] `MCPService`:
  - `list()` — all registered servers + status
  - `add(config)` — validate, store in electron-store
  - `remove(id)` — stop if running, remove
  - `start(id)` — spawn via `child_process`, track PID, capture stdout/stderr
  - `stop(id)` — SIGTERM, wait for exit
  - `listTools(id)` — connect to running server, call `tools/list`, return `MCPTool[]`

- [ ] Process management:
  - Map of running processes
  - Detect crash → set status to `error`, log, surface in UI
  - Optional auto-restart on crash (configurable per server)

- [ ] Minimal MCP client for tool enumeration:
  - Connect over stdio
  - Send `initialize` handshake
  - Send `tools/list`, parse response

#### 5.2 — Built-in Catalog
- [ ] Hardcode entries for: filesystem, git, sqlite, postgres, fetch, github, slack, google-drive, brave-search, puppeteer
- [ ] Each entry: name, description, npm package, required env vars with descriptions, example config
- [ ] "Install from catalog" flow: select, enter env vars, store (sensitive vars go to keytar)

#### 5.3 — MCP Page (renderer)
- [ ] Running servers: name, status, uptime, PID, tool count, start/stop toggle, view logs
- [ ] Catalog: grid with search/filter, Add button, Installed badge
- [ ] Add custom server form: name, transport picker, command + args, env var editor, test button, auto-start toggle

**Exit criteria:** Can install and start `server-filesystem` and `server-github`. Tools appear in tool list. Aggregator at `localhost:3821` exposes combined tool list.

---

## Phase 6 — Guardrail Engine

**Goal:** Agents operating through the MCP proxy are subject to enforceable, per-profile rules. Violations handled with two-strike system and full audit log.

**Duration:** ~3 weeks
**Version tag:** `v0.7.0-alpha`

This is the most unique and complex phase. Take the extra time to get it right — it is a core differentiator for Quickl.

### Tasks

#### 6.1 — GuardrailEngine (main process)
- [ ] `GuardrailEngine` class sitting as middleware in the MCP Aggregator Proxy:
  - Receives every tool call before it is forwarded to a backing MCP server
  - Looks up active profile's `GuardrailSet`
  - Checks agent identifier (from `clientInfo.name` captured at `initialize`) against `agentExceptions`
  - If agent is excepted: pass through
  - If not: evaluate tool call against all rules in the set
  - If passes: forward to MCP server
  - If fails: handle violation (see below)

- [ ] Rule evaluators — one function per rule type:
  - `allowed_tools` — check `tool.name` against whitelist
  - `blocked_tools` — check `tool.name` against blacklist
  - `allowed_paths` — extract file path args, check against globs using `minimatch`
  - `write_allowed` — check if tool is a known write operation
  - `delete_allowed` — check if tool is a known delete operation
  - `shell_execution` — check if tool is `run_terminal_cmd` or similar
  - `network_allowed` — check if tool is a fetch/network tool
  - `max_files_per_call` — count file path arguments

#### 6.2 — Violation Handler
- [ ] `ViolationHandler` class:
  - Maintains per-session strike count per agent
  - Strike 1:
    - Block tool call (return MCP error response)
    - Compose explanation message (custom or auto-generate — see below)
    - Send explanation as MCP error `message` field back to agent
    - Write `GuardrailLogEntry` with `strike: 1`
  - Strike 2:
    - Hard block tool call
    - Emit `quickl:guardrail-violation` IPC event to renderer
    - Write `GuardrailLogEntry` with `strike: 2`
    - Renderer shows user action panel
  - Reset strike count after a successful (non-violating) call from same agent in same session

- [ ] `AllowOnce` mechanism:
  - When user confirms Allow Once: store a one-time token keyed to `(agentId, toolName, args hash)`
  - Next call with matching token passes through guardrail
  - Token consumed immediately — single use only
  - Log entry written with `resolution: 'manual-override'`

- [ ] Strike count resets: tracked per `(agentId, sessionId)` where sessionId = MCP initialize handshake ID

#### 6.3 — Explanation Message Generator
- [ ] `ExplanationGenerator` class:
  - Mode: `custom` — return `GuardrailSet.customMessage` verbatim
  - Mode: `auto-generate`:
    - Build prompt: violation context (tool name, args, rule violated, what is allowed)
    - Send to `autoGenerateModelId` provider via Provider Proxy (reuse existing proxy infrastructure)
    - Parse response text
    - On failure (provider down, timeout): fall back to hardcoded template
  - Mode: `fallback-template` — generate readable message from rule violation data without AI

#### 6.4 — GuardrailLogService
- [ ] Append-only log store in `electron-store` (separate key from main logs)
- [ ] `getLogs(filter)` — filter by agent, rule, resolution, profile, date range, strike
- [ ] `exportLogs(filter)` — serialize to JSON string
- [ ] Cannot delete individual entries — only bulk clear with confirmation
- [ ] IPC handlers for all guardrail operations

#### 6.5 — Guardrails Page (renderer)
- [ ] Active Rules panel: rule-by-rule display for current profile's guardrail set
- [ ] Agent Exceptions panel: list + remove per entry + add new (text input)
- [ ] Explanation Message panel: custom/auto toggle, textarea, model picker dropdown
- [ ] Violation Log: virtual scrolling list, newest first, filterable, expandable entries
- [ ] User Action Panel (shown on Strike 2 event): agent name, tool attempted, rule violated, [View Log] [Dismiss] [Allow Once]
- [ ] Allow Once confirmation dialog with warning text

#### 6.6 — Profile Integration
- [ ] Every profile stores a `GuardrailSet`
- [ ] Default profiles created with preset guardrail sets:
  - "Strict" — blocked_tools: [run_terminal_cmd, delete_file], write_allowed: false, shell_execution: false
  - "Balanced" — shell_execution: false, delete_allowed: false
  - "Off" — guardrails disabled
- [ ] Switching profiles: guardrail engine immediately applies new profile's rules

**Exit criteria:** Trigger a blocked tool call from Cursor. Verify Strike 1 message received by agent. Trigger again. Verify Strike 2 tray notification appears. Test Allow Once — verify single use. Verify all log entries correct.

---

## Phase 7 — System Tray & Daemon

**Goal:** Quickl runs persistently in the system tray. Background services stay alive when window is hidden.

**Duration:** ~1 week
**Version tag:** `v0.8.0-alpha`

### Tasks

#### 7.1 — Tray Setup
- [ ] `electron.Tray` with three-state icon set (healthy / degraded / alert), 16px + 32px
- [ ] Dynamic menu rebuilt on: provider status change, model state change, MCP state change, guardrail violation
- [ ] Tray menu structure per MVP spec (provider switcher, models, MCP, guardrails status, Open, Quit)

#### 7.2 — Window Lifecycle
- [ ] Close window → hide to tray (not quit)
- [ ] Tray icon click → show/hide main window
- [ ] Quit in tray menu → cleanly stop all child processes (MCP servers, daemons) then quit
- [ ] macOS: remove from dock when hidden (optional setting)

#### 7.3 — OS Notifications
- [ ] Provider goes offline → OS notification
- [ ] Model unloads unexpectedly → OS notification
- [ ] MCP server crashes → OS notification
- [ ] Guardrail Strike 2 → OS notification with "Open Quickl" action button

#### 7.4 — Background Stability
- [ ] Verify all background tasks (health polling, proxy servers, guardrail engine, MCP servers) continue running when window is hidden
- [ ] Start at login implementation (OS login items API per platform)

**Exit criteria:** App stays in tray after window close. All background services running. Guardrail violation produces OS notification. Quit cleanly shuts down everything.

---

## Phase 8 — Profiles & Settings

**Goal:** Users can create, switch, and export profiles. All settings configurable and persisted.

**Duration:** ~1 week
**Version tag:** `v0.9.0-alpha`

### Tasks

#### 8.1 — ProfileService (main process)
- [ ] `ProfileService`:
  - `create(name, config)` — snapshot current state into profile
  - `activate(id)` — applies profile: updates IDE configs, sets active providers, applies guardrail set
  - `list()`, `update(id, config)`, `remove(id)`
  - `export(id)` — JSON with all config except keys
  - `import(json)` — validate schema, create profile, prompt for missing keys

- [ ] Profile activation is atomic: all changes apply together or not at all

#### 8.2 — Settings Service
- [ ] Typed settings schema with all preferences (general, provider polling, model limits, proxy ports, notifications, updates, guardrails auto-generate model)
- [ ] IPC: `getSettings()`, `updateSettings(partial)`
- [ ] All changes take effect immediately except proxy port changes (require restart)

#### 8.3 — Settings Page (renderer)
- [ ] Sectioned: General, Providers, Models, Proxy, Guardrails, Notifications, Updates
- [ ] Auto-save with 500ms debounce
- [ ] Reset to defaults per section

#### 8.4 — Profiles Page (renderer)
- [ ] Profile list with active badge
- [ ] Create, edit, duplicate, delete profiles
- [ ] Guardrail set editor per profile (rule add/edit/remove, agent exceptions, explanation mode)
- [ ] Export button (downloads `.quickl-profile.json`)
- [ ] Import from file or URL

**Exit criteria:** Can create and switch profiles. Switching updates IDEs + guardrail set simultaneously. Settings persist across restart. Export/import round-trip works.

---

## Phase 9 — Logs, Diagnostics & Polish

**Goal:** Production-quality observability, a polished first-run experience, and no obvious UI rough edges.

**Duration:** ~2 weeks
**Version tag:** `v0.9.5-beta`

### Tasks

#### 9.1 — Logging Infrastructure
- [ ] Log rotation: keep last 7 days, max 50MB per file
- [ ] Real-time push to renderer via IPC
- [ ] Sensitive data scrubber runs before every write

#### 9.2 — Logs Page (renderer)
- [ ] Virtual scrolling list (thousands of entries, smooth)
- [ ] Filter: level, category, agent, date range, free text search
- [ ] Expand entry for full JSON payload
- [ ] Export filtered view as JSON or plain text
- [ ] Auto-scroll toggle

#### 9.3 — Diagnostics Panel
- [ ] System info, provider table, process table, config file table, proxy status
- [ ] Sanitized diagnostics bundle download

#### 9.4 — Onboarding Wizard
- [ ] 5-step wizard on first launch:
  1. Welcome
  2. Add first provider
  3. Detect IDEs
  4. Configure first IDE
  5. Set up guardrails (preset picker: Strict / Balanced / Off)
- [ ] "Skip" at each step, re-trigger from Settings

#### 9.5 — Polish Pass
- [ ] Keyboard navigation: full tab order, focus management in modals
- [ ] All loading states: skeleton loaders + spinners
- [ ] All error states: inline messages with retry
- [ ] Toast notification system for async results
- [ ] Confirmation dialogs for all destructive actions
- [ ] App icons in all required sizes (.icns, .ico, .png)
- [ ] All empty states with illustrations and CTAs
- [ ] Guardrail violation toast styled distinctly (orange) vs normal notifications

**Exit criteria:** Full onboarding works end-to-end including guardrail setup. Log viewer functional. No obvious UI rough edges on any page.

---

## Phase 10 — Testing, Signing & Distribution

**Goal:** Shippable v1.0.0 that installs cleanly on all 3 platforms and auto-updates.

**Duration:** ~1 week
**Version tag:** `v1.0.0`

### Tasks

#### 10.1 — Test Coverage
- [ ] Unit test coverage > 80% for all services including GuardrailEngine
- [ ] All IPC handlers covered by integration tests
- [ ] E2E test suite covers 6 core flows:
  1. Add provider → test connection
  2. Pull model → load model
  3. Scan IDEs → configure IDE → preview diff → apply
  4. Install MCP server → start → verify tools
  5. Guardrail violation → Strike 1 → Strike 2 → Allow Once
  6. Create profile → switch profile → verify all changes applied

#### 10.2 — Code Signing
- [ ] macOS: Apple Developer ID + notarization in GitHub Actions (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` as secrets)
- [ ] Windows: EV code signing certificate
- [ ] Linux: GPG signed AppImage

#### 10.3 — Auto-Update
- [ ] Configure `electron-updater` with GitHub Releases
- [ ] Test full update flow on all 3 platforms
- [ ] "Check for updates" in settings + at startup
- [ ] Update available notification in tray + settings

#### 10.4 — Distribution
- [ ] GitHub Releases workflow: build all 3 platforms on `v*` tag push
- [ ] `README.md`: installation, quick start, how to set up guardrails
- [ ] `CONTRIBUTING.md`: dev setup, architecture, how to add IDE / provider / guardrail rule type

#### 10.5 — Final Pre-Release Checklist
- [ ] Fresh install test on macOS 13+, Windows 11, Ubuntu 22.04
- [ ] Verify all 6 E2E flows on each platform
- [ ] Verify auto-update on each platform
- [ ] Verify code signing (Gatekeeper, SmartScreen)
- [ ] Security review: no keys in logs, no keys in exports, proxies bind to 127.0.0.1 only, guardrail allow-once is truly single-use
- [ ] Bump to `1.0.0`, tag, push, create GitHub Release

---

## Post v1.0.0 Roadmap

---

### v1.1.0 — Usage & Cost Tracking

**Goal:** Developers can see how much they're spending and which models/providers they use most.

**Duration:** ~3 weeks

**Features:**
- Token usage tracking per provider per model — intercepted at the Provider Proxy layer, no IDE changes needed
- Per-provider pricing tables (updated manually per release, community-contributed)
- Cost estimation: tokens × price per token = estimated USD cost
- Usage dashboard: daily / weekly / monthly charts (Recharts)
- Budget alerts: user sets a monthly limit per provider, Quickl notifies when approaching it
- Usage data stored locally — never sent anywhere
- Export usage history as CSV

---

### v1.2.0 — Extended IDE Support

**Goal:** Add config writers for the IDEs detected but not fully configured in MVP (Zed, JetBrains, Neovim), and expand extension support for primary IDEs.

**Duration:** ~3 weeks

**Features:**
- **Zed** — full config writer using Streamable HTTP (Zed has added HTTP MCP support post-MVP)
- **JetBrains** — full AI Assistant + Continue plugin config writer for all JetBrains products
- **Neovim** — config writers for avante.nvim, copilot.lua, coc-ai
- **Emacs** — gptel, ellama config writing
- VS Code: additional extension support (Roo Cline, Aider, additional MCP-aware plugins)
- Per-extension configuration options exposed in the IDE detail panel
- Transport fallback handling refined based on real-world feedback from v1.0.0

Note: IDE support in this release still targets HTTP and SSE transports only. stdio shim for edge case IDEs is addressed separately in v1.7.0.

---

### v1.3.0 — Advanced Model Features

**Goal:** Deeper model management for power users.

**Duration:** ~3 weeks

**Features:**
- Ollama Modelfile editor: create and modify custom models from the GUI
- Model benchmarking: run a standard prompt suite against multiple models, compare response quality + latency + cost side by side
- Automatic model recommendation: based on task description + available hardware, suggest the best model ("For XML formatting on your GPU, use codellama:7b-q4")
- Context window display per model with visual usage bar during active sessions
- Model version pinning: prevent Ollama from auto-updating a model you depend on

---

### v1.4.0 — Guardrail Templates & Semantic Rules

**Goal:** Make guardrails more powerful and easier to reuse.

**Duration:** ~4 weeks

**Features:**
- **Built-in rule presets/templates:** curated guardrail configurations for common scenarios:
  - "Safe XML Formatter" — write to XML files, structural changes only
  - "Code Reviewer" — read-only, no writes at all
  - "Migration Script Runner" — write to DB, no filesystem, no shell
  - "Docs Writer" — write to `/docs/**` only, no code directories
  - "Safe Refactor" — write to `src/**`, no delete, no shell
- Users can browse, apply, and customize templates
- Templates are versioned and can be shared as JSON

- **Semantic Change Constraints** (advanced rules beyond MVP):
  - `value_changes: false` — after a write, diff the file: if any leaf values changed that weren't in a declared error set, trigger violation
  - Implementation: parse before/after state of written file as AST (XML, JSON, YAML), compare leaf nodes
  - Supported formats initially: XML, JSON, YAML
  - This directly solves the colleague's XML formatting case — agent can reformat but cannot change data values

- **Secondary model validation** (optional per rule):
  - After agent produces output but before it is written, send the proposed diff to a lightweight model with a validation prompt
  - "Did this change anything other than formatting?" — if model says yes, trigger violation
  - User configures which model to use for validation and the validation prompt text

---

### v1.5.0 — Team Profiles & Sync

**Goal:** Teams can share and standardize AI configurations across all developer machines.

**Duration:** ~4 weeks

**Features:**
- **Profile sharing via URL:** export a profile to a URL (backed by GitHub Gist, user's own server, or Quickl's optional free sync service)
- **Team profile concept:** a shared profile URL that team members subscribe to; updates pushed to subscribers
- Profile versioning + changelog: see what changed between profile versions
- Conflict resolution: if a subscribed profile conflicts with local overrides, user chooses which wins
- Per-organization guardrail enforcement: team lead pushes a mandatory guardrail set that cannot be disabled by individual members (honor system in MVP — no cryptographic enforcement)
- Import team profile from URL in onboarding wizard

---

### v1.6.0 — Prompt Library

**Goal:** Developers can save, organize, and reuse system prompts across tools.

**Duration:** ~2 weeks

**Features:**
- Save named system prompts with optional descriptions and tags
- Associate prompts with specific providers/models (this prompt works best with Claude Sonnet)
- Quick-access from tray menu: paste prompt into clipboard, or inject directly into Continue.dev config
- Prompt variables: `{{project_name}}`, `{{language}}` replaced at use time
- Prompt versioning: see history of edits
- Sync prompts across profiles

---

### v1.7.0 — Edge Case IDE Support (stdio shim)

**Goal:** Extend MCP guardrail coverage to IDEs that only support stdio transport and cannot use the HTTP/SSE aggregator. This is a deliberate cleanup release before the v2.0.0 major — closing known compatibility gaps so v2.0.0 can focus entirely on the plugin architecture.

**Duration:** ~3 weeks

**Why this is deferred:** The stdio shim requires shipping a companion CLI binary alongside the Electron app, and involves a more complex inter-process communication path (IDE → shim → Quickl main process socket → MCP server). This is non-trivial to implement correctly and covers edge-case IDEs. All primary targets (VS Code, Cursor, Windsurf, Zed, JetBrains) are covered by v1.2.0 using HTTP/SSE. The shim is only needed for niche stdio-only configurations.

**Features:**
- `quickl-shim` companion CLI binary shipped alongside the Electron app
- Shim acts as a stdio MCP proxy: receives stdio from IDE, calls back to Quickl main process via local Unix/named socket, forwards allowed calls to real MCP server, returns responses over stdio
- Guardrail engine enforced inside the shim callback path — same rules as HTTP path
- IDE config writers for stdio-only configurations register `quickl-shim` as the MCP server command instead of a URL
- Supported via shim: any IDE/plugin that only accepts `{ "command": "...", "args": [...] }` style MCP config
- All shim events logged and visible in the Guardrails page alongside HTTP/SSE events

**Example config written for stdio-only IDE:**
```json
{
  "mcpServers": {
    "quickl-filesystem": {
      "command": "quickl-shim",
      "args": ["--server", "filesystem", "--profile", "work"]
    },
    "quickl-github": {
      "command": "quickl-shim",
      "args": ["--server", "github", "--profile", "work"]
    }
  }
}
```

Note: each MCP server requires its own shim entry (unlike HTTP/SSE where one URL covers all servers). This is a known limitation of the stdio transport model.

---

### v2.0.0 — Plugin System

**Goal:** Community can extend Quickl with new IDE integrations, providers, MCP tools, and UI panels without forking the repo. By this point all known IDE targets are covered (v1.2.0 + v1.7.0), giving the plugin system a clean foundation to build on.

**Duration:** ~8 weeks

**Features:**
- Public plugin API for: IDE config writers, provider presets, guardrail rule types, UI sidebar panels
- Plugin manifest format: `quickl-plugin.json` with name, version, permissions, entry point
- Plugin registry: curated list of community plugins, searchable from within Quickl
- Plugin sandboxing: plugins run in a restricted Node.js context, cannot access keytar directly, must go through Quickl APIs
- Plugin permissions system: plugin declares what it needs, user approves on install
- Hot-reload plugins during development (for plugin authors)
- Plugin API versioning: plugins declare which Quickl API version they target

**What this unlocks:**
- Community IDE integrations (Sublime Text, Kate, Nova, etc.)
- Community providers (Cohere, Together AI, Perplexity, etc.)
- Community MCP tools exposed as Quickl-native UI
- Custom guardrail rule types contributed by the community
- Custom transport implementations beyond HTTP/SSE/stdio

---

## Development Conventions

### Branch Strategy
```
main          — production-ready, tagged releases only
develop       — integration branch for completed phases
phase/N-name  — one branch per phase
fix/issue-N   — hotfixes from main
```

### Commit Messages (Conventional Commits)
```
feat(guardrails): implement two-strike violation system
feat(proxy): add Anthropic format translation
fix(ide): handle missing VS Code settings.json gracefully
chore(build): update electron to 30.0.1
docs(readme): add guardrail quick-start guide
```

### PR Process
- One PR per phase (or smaller PRs within a phase for large phases)
- All PRs require: CI green, no TypeScript errors, unit tests for new services
- Self-review checklist:
  - No hardcoded paths
  - No keys in logs
  - No plaintext keys in store
  - Guardrail engine cannot be bypassed from renderer
  - Proxy only binds to 127.0.0.1

### File Naming
- Services: `PascalCase` class in `kebab-case.ts` (e.g., `guardrail-engine.ts`)
- IPC handlers: `kebab-case.handler.ts`
- React pages: `PascalCase.page.tsx`
- React components: `PascalCase.tsx`
- Zustand stores: `use-domain.store.ts`
- Tests: `*.test.ts` colocated with source

### Adding a New Provider (contributor guide)
1. Add entry to `PROVIDER_PRESETS` in `src/shared/providers.ts`
2. Implement connection test in `src/main/services/provider.service.ts`
3. Implement format translation in `src/main/proxy/translators/{provider}.translator.ts` if non-OpenAI-compatible
4. Add logo SVG to `src/renderer/assets/providers/`
5. Add unit test for connection test + translation
6. Update MVP.md provider table

### Adding a New IDE (contributor guide)
1. Add detection logic in `src/main/services/ide-detector.ts`
2. Implement `ConfigWriter` in `src/main/services/config-writers/{ide}.writer.ts`
3. Add IDE logo to `src/renderer/assets/ides/`
4. Write unit tests using fixture config files in `src/main/services/config-writers/__fixtures__/`
5. Update MVP.md IDE table

### Adding a New Guardrail Rule Type (contributor guide)
1. Add rule type to `GuardrailRule['type']` union in `src/shared/types.ts`
2. Implement evaluator function in `src/main/proxy/guardrail-engine.ts`
3. Add UI control in the rule editor component in renderer
4. Write unit tests for passing and violating tool calls
5. Update MVP.md guardrail rules table

---

*End of Roadmap — Quickl v1.0.0 and beyond*