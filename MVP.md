# Quickl — MVP Specification (v1.0.0)

> **Project:** `quickl`
> **Target Platform:** macOS, Windows, Linux
> **Framework:** Electron + React + TypeScript
> **Goal:** A unified desktop control panel for all AI providers, local models, and developer tooling — the "Docker Desktop for AI" with a built-in local AI proxy gateway and agent guardrail system.

---

## Table of Contents

1. [Vision & Problem Statement](#1-vision--problem-statement)
2. [Target Users](#2-target-users)
3. [Core Principles](#3-core-principles)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Proxy Gateway Architecture](#6-proxy-gateway-architecture)
7. [Feature Specification](#7-feature-specification)
   - 7.1 Provider Management
   - 7.2 Local Model Management
   - 7.3 IDE Auto-Configuration
   - 7.4 MCP Server Registry
   - 7.5 Guardrail Engine
   - 7.6 System Tray Daemon
   - 7.7 Settings & Profiles
   - 7.8 Logs & Diagnostics
8. [UI/UX Specification](#8-uiux-specification)
9. [Data Model](#9-data-model)
10. [IPC Contract](#10-ipc-contract)
11. [Security Model](#11-security-model)
12. [Testing Strategy](#12-testing-strategy)
13. [Build & Distribution](#13-build--distribution)
14. [Out of Scope for MVP](#14-out-of-scope-for-mvp)

---

## 1. Vision & Problem Statement

Modern developers use a scattered set of AI tools:

- **Cloud providers** (OpenAI, Anthropic, Mistral, Groq, Google) — each with their own API key, base URL, and settings
- **Local runners** (Ollama, LM Studio, vLLM, Jan) — each running its own daemon with no unified visibility
- **IDE integrations** (Cursor, VS Code, Continue, Cline, Zed) — each requiring manual config file editing to point at the right provider
- **MCP Servers** — scattered across repos, each needing to be manually started and registered per IDE
- **AI Agents** — given broad system access with no guardrails, making them unpredictable and risky for real tasks

There is no single place to:
- See the health and status of all AI services at once
- Manage API keys securely
- Download, activate, or deactivate local models
- Auto-wire an IDE with one click
- Route all AI traffic through a single local proxy
- Control what agents are allowed to do and enforce those limits

**Quickl** is that place. It runs as a system tray app with a built-in local AI proxy gateway, manages your AI infrastructure the way Docker Desktop manages containers, and adds a guardrail engine that makes agentic AI safe to use on real systems.

---

## 2. Target Users

**Primary:** Developers using AI tooling daily — Cursor, Continue.dev, Cline, or similar IDE tools alongside local models or API providers.

**Secondary:** Teams that want to standardize AI config and agent safety rules across all developer machines.

**Not targeted in MVP:** Non-technical end users, enterprise SSO, multi-user environments.

---

## 3. Core Principles

1. **Local-first.** No telemetry, no cloud account required. Everything runs on the user's machine.
2. **Non-destructive.** Quickl never deletes models, API keys, or configs without explicit confirmation. It only adds or updates, and always shows diffs before writing.
3. **Additive integration.** IDE configs are patched, not replaced. Existing settings survive.
4. **Provider-agnostic.** Cloud and local providers are treated as interchangeable endpoints behind a unified abstraction.
5. **Transparent.** The user can always see exactly what config will be written, what an agent is trying to do, and why it was blocked.
6. **Safe by default.** Guardrails are on by default per profile. Trust is never granted automatically — only explicitly by the user.

---

## 4. Tech Stack

### Desktop Shell
| Layer | Technology | Reason |
|---|---|---|
| Desktop framework | **Electron 30+** | Cross-platform, mature, large ecosystem |
| Frontend | **React 18 + TypeScript** | Component model, strong typing |
| Styling | **Tailwind CSS + shadcn/ui** | Consistent design system, fast iteration |
| State management | **Zustand** | Lightweight, no boilerplate |
| IPC | **Electron contextBridge + ipcMain/ipcRenderer** | Secure, typed communication |
| Persistence | **electron-store** | Simple key-value, schema-validated |

### Backend (Main Process)
| Layer | Technology | Reason |
|---|---|---|
| Provider health checks | **Node.js `node-fetch`** | Lightweight HTTP pings |
| Local proxy server | **Node.js `http` module** | No external dependency, full control |
| Ollama integration | **Ollama Node SDK / REST** | Direct API access |
| Process management | **Node.js `child_process`** | Spawn/kill local daemons |
| File system | **Node.js `fs/promises`** | Config file reading/writing |
| Keychain | **`keytar`** | OS-native secure credential storage |
| Auto-updater | **`electron-updater`** | Delta updates via GitHub Releases |

### Tooling & Build
| Tool | Purpose |
|---|---|
| Vite + `electron-vite` | Fast HMR for Electron during development |
| `electron-builder` | Package and sign for mac/win/linux |
| ESLint + Prettier | Code style |
| Vitest | Unit tests |
| Playwright | E2E tests for Electron |
| GitHub Actions | CI/CD pipeline |

---

## 5. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS                         │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐              │
│  │ ProviderSvc  │  │  ModelSvc    │  │   IDESvc      │              │
│  │ - Health poll│  │ - List/pull  │  │ - Detect IDEs │              │
│  │ - Key store  │  │ - Start/stop │  │ - Write config│              │
│  │ - CRUD       │  │ - VRAM stats │  │ - Read config │              │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘              │
│         │                 │                   │                      │
│  ┌──────┴─────────────────┴───────────────────┴──────────────────┐  │
│  │                    IPC Bridge (contextBridge)                  │  │
│  └──────────────────────────────┬─────────────────────────────────┘  │
│                                 │                                    │
│  ┌──────────────┐  ┌────────────┴──┐  ┌──────────────┐              │
│  │  MCPSvc      │  │  DaemonMgr    │  │  StoreSvc    │              │
│  │ - Registry   │  │ - Ollama proc │  │ - electron-  │              │
│  │ - Start/stop │  │ - vLLM proc   │  │   store      │              │
│  │ - Health     │  │ - Port alloc  │  │ - keytar     │              │
│  └──────┬───────┘  └───────────────┘  └──────────────┘              │
│         │                                                            │
│  ┌──────┴──────────────────────────────────────────────────────┐    │
│  │                    PROXY GATEWAY LAYER                       │    │
│  │                                                              │    │
│  │  ┌─────────────────────────┐  ┌──────────────────────────┐  │    │
│  │  │  Provider Proxy         │  │  MCP Aggregator Proxy    │  │    │
│  │  │  localhost:3820         │  │  localhost:3821           │  │    │
│  │  │  OpenAI-compatible API  │  │  MCP SSE multiplexer     │  │    │
│  │  └──────────┬──────────────┘  └───────────┬──────────────┘  │    │
│  │             │                             │                  │    │
│  │  ┌──────────┴─────────────────────────────┴──────────────┐  │    │
│  │  │               GUARDRAIL ENGINE                        │  │    │
│  │  │  - Intercepts every MCP tool call pre-execution       │  │    │
│  │  │  - Enforces profile rules per identified agent        │  │    │
│  │  │  - Two-strike system + user notification              │  │    │
│  │  │  - Full audit log of all events                       │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ contextBridge
┌──────────────────────────────────┴───────────────────────────────────┐
│                        RENDERER PROCESS (React)                      │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ │
│  │Dashboard │ │Providers │ │  Models  │ │   IDEs    │ │   MCP    │ │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘ └──────────┘ │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│  │Guardrails│ │  Logs    │ │Settings  │                             │
│  └──────────┘ └──────────┘ └──────────┘                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Zustand Store                           │   │
│  │  providers | models | ides | mcpServers | guardrails | logs  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        SYSTEM TRAY DAEMON                            │
│  Menu | Quick-switch provider | Health | Guardrail alerts            │
└──────────────────────────────────────────────────────────────────────┘
```

### Process Boundaries

- **Main Process** handles all I/O: file system, network, process spawning, keychain, proxy servers.
- **Renderer Process** is purely UI — it never touches the filesystem or network directly.
- **contextBridge** exposes a typed `window.quickl` API that the renderer calls via IPC.
- **Proxy Gateway Layer** runs entirely in the main process, intercepting all AI traffic.

---

## 6. Proxy Gateway Architecture

Quickl is not just a control panel — it is also a **local AI proxy gateway**. This is a foundational architectural decision that enables IDE auto-configuration, seamless provider switching, and the guardrail engine.

### Why a Proxy?

Without a proxy, every IDE must be individually reconfigured when a user switches provider. With the Quickl proxy, all tools point at `localhost:3820` permanently — switching providers in Quickl takes effect instantly across every connected tool.

This positions Quickl in the same category as tools like **LiteLLM**, **Portkey**, and **OpenRouter**, but with key differences: Quickl is local, GUI-managed, key-secure, and guardrail-aware.

### Layer 1 — Provider Proxy (`localhost:3820`)

An OpenAI-compatible HTTP proxy that accepts requests from IDEs and agents and forwards them to whichever provider is currently active.

```
IDE / Agent (Cursor, Cline, Continue, etc.)
         │
         │  POST http://localhost:3820/v1/chat/completions
         ▼
  Quickl Provider Proxy
         │
         ├─ ① Look up active provider for current profile
         ├─ ② Translate request format if needed (OpenAI ↔ Anthropic)
         ├─ ③ Inject API key from keytar (in-memory only, never logged)
         └─ ④ Forward to provider endpoint
              │
              ├──► https://api.anthropic.com/v1/messages
              ├──► https://api.openai.com/v1/chat/completions
              ├──► http://localhost:11434/api/chat  (Ollama)
              └──► https://api.mistral.ai/v1/chat/completions
```

**Format translation:** Anthropic uses a different request/response shape from the OpenAI standard. Quickl translates transparently so IDEs only ever speak OpenAI-compatible format. Streaming (SSE) is fully supported and passed through correctly.

**Key injection:** API keys are fetched from keytar at request time, injected into the outbound request, and never stored anywhere else. The key exists in memory only for the duration of forwarding a single request.

### Layer 2 — MCP Aggregator Proxy (`localhost:3821`)

An MCP aggregator that multiplexes all running MCP servers behind a single endpoint, supporting both current and legacy MCP transports.

```
IDE / Agent
         │
         │  Streamable HTTP  →  http://localhost:3821/mcp   (primary)
         │  SSE              →  http://localhost:3821/sse   (fallback)
         ▼
  Quickl MCP Aggregator
         │
         ├──► @mcp/server-filesystem  (stdio)
         ├──► @mcp/server-github      (stdio)
         ├──► @mcp/server-postgres    (stdio)
         └──► custom-server           (http)
```

IDEs register only one MCP endpoint and automatically get access to all MCP servers Quickl manages. Adding or removing a server requires no IDE reconfiguration.

#### MCP Transport Support

The MCP specification has evolved. Quickl supports both transports so it works with current and older clients:

| Transport | Status in MCP spec | Quickl support | Used by |
|---|---|---|---|
| **Streamable HTTP** | Current standard | ✓ Primary (`/mcp`) | Cursor, VS Code Copilot (new), Continue.dev |
| **SSE** | Deprecated, still supported | ✓ Fallback (`/sse`) | Older Continue.dev, any SSE-configured client |
| **stdio** | Local processes only | Post-MVP (v1.7.0) | Zed, some JetBrains configs |

Quickl defaults to Streamable HTTP for all new IDE configurations. SSE is written instead only when Quickl detects the IDE/extension does not support Streamable HTTP.

#### IDE-Specific MCP Config Written by Quickl

Each IDE gets a single MCP entry pointing at the aggregator. The transport is chosen per IDE:

**Cursor** (`~/.cursor/mcp.json`) — Streamable HTTP:
```json
{
  "mcpServers": {
    "quickl": {
      "url": "http://localhost:3821/mcp",
      "type": "http"
    }
  }
}
```

**VS Code + GitHub Copilot** (`.vscode/mcp.json` or user settings) — Streamable HTTP:
```json
{
  "servers": {
    "quickl": {
      "url": "http://localhost:3821/mcp",
      "type": "http"
    }
  }
}
```

**VS Code + Continue.dev** (`~/.continue/config.json`) — Streamable HTTP:
```json
{
  "mcpServers": [{
    "name": "quickl",
    "transport": { "type": "http", "url": "http://localhost:3821/mcp" }
  }]
}
```

**Fallback SSE** (for any client that does not support Streamable HTTP):
```json
{ "url": "http://localhost:3821/sse", "type": "sse" }
```

#### GitHub Copilot — Important Distinction

GitHub Copilot has two separate concerns in Quickl:

- **Completions (chat, autocomplete)** — hardwired to GitHub's backend. Cannot be routed through Quickl's provider proxy. Quickl manages other tools alongside Copilot for these features.
- **MCP tools / agent calls** — fully configurable via VS Code's `mcp.json`. Points at `localhost:3821` and guardrails apply. ✓

This means Copilot users get full guardrail enforcement on their agent tool calls even though completions bypass Quickl.

### Layer 3 — Guardrail Engine

Middleware inside the MCP Aggregator Proxy that intercepts every tool call before it reaches an MCP server. See Section 7.5 for full specification.

### Headless Use

Both proxy layers run as long as Quickl is running — including when the main window is hidden to the tray. Developers can use Quickl purely as a headless local AI gateway without opening the GUI.

---

## 7. Feature Specification

---

### 7.1 Provider Management

**What it does:** Manages connections to AI API providers — both cloud and local OpenAI-compatible endpoints.

#### Supported Providers (MVP)

| Provider | Type | Base URL | Auth |
|---|---|---|---|
| OpenAI | Cloud | `https://api.openai.com/v1` | API Key |
| Anthropic / Claude | Cloud | `https://api.anthropic.com` | API Key |
| Google Gemini | Cloud | `https://generativelanguage.googleapis.com` | API Key |
| Mistral | Cloud | `https://api.mistral.ai/v1` | API Key |
| Groq | Cloud | `https://api.groq.com/openai/v1` | API Key |
| Ollama | Local | `http://localhost:11434` | None |
| LM Studio | Local | `http://localhost:1234/v1` | None |
| vLLM | Local | Configurable | Optional key |
| Jan | Local | `http://localhost:1337/v1` | None |
| Custom (OpenAI-compatible) | Both | User-defined | Optional key |

#### Features

**Adding a provider:**
- Select from list or choose "Custom"
- Enter API key (stored via `keytar`, never in plaintext)
- Optional: custom base URL override
- Test connection button — sends minimal valid request, shows latency
- Save → provider appears with status indicator

**Provider status indicators:**
- 🟢 Online & authenticated
- 🟡 Reachable but not authenticated (key issue)
- 🔴 Unreachable (network/service down)
- ⚫ Disabled (manually toggled off)

**Polling:** Background health checks every 30 seconds per enabled provider. Configurable interval.

**Provider card shows:** name + logo, status badge, latency (ms), available models, last checked, quick actions (Test, Edit, Disable, Remove).

**API Key management:** Keys in OS keychain via `keytar`. Never in `electron-store` or any plaintext file. Always masked in UI: `sk-...xxxx`. Export/import excludes keys.

---

### 7.2 Local Model Management

**What it does:** A unified interface for managing locally-running AI models across all supported runtimes.

#### Supported Runtimes (MVP)
- **Ollama** (primary), **LM Studio**, **vLLM**, **Jan**

#### Features

**Model Library View:** Lists all locally installed models across all runtimes. Each card shows: name, family, parameter size, quantization, disk size, runtime, status (Loaded / Available / Downloading), VRAM usage, actions.

**Model Discovery (Ollama):** Browse Ollama registry, search/filter by family/size/task, one-click pull with real-time progress bar.

**Resource Monitor:** Total RAM, VRAM total/used (nvidia-smi / ioreg on macOS / rocm-smi), CPU, which models are loaded, estimated remaining capacity.

**Model Actions:** Load, Unload, Set as Default, Delete (with confirmation), Tag.

---

### 7.3 IDE Auto-Configuration

**What it does:** Detects installed AI-enabled IDEs and configures them to use the Quickl proxy — one click, zero manual editing.

#### Supported IDEs (MVP)

| IDE | Config Location | Config Format |
|---|---|---|
| VS Code | `~/.vscode/settings.json` | JSON |
| Cursor | `~/.cursor/mcp.json` + settings | JSON |
| Windsurf | `~/.codeium/windsurf/` | JSON |
| JetBrains | `~/.config/JetBrains/*/options/` | XML |
| Zed | `~/.config/zed/settings.json` | JSON |
| Neovim | `~/.config/nvim/` | Lua/JSON |

#### Configuration Strategy

All IDEs are configured to point at `localhost:3820` (Provider Proxy) and `localhost:3821` (MCP Aggregator). This means:

- Switching providers requires **zero IDE reconfiguration**
- Adding an MCP server makes it **immediately available** in all IDEs
- IDE configs never contain API keys — only the localhost proxy addresses

**MCP transport per IDE:** Quickl writes Streamable HTTP by default. If the detected IDE or extension version does not support it, Quickl falls back to SSE automatically — determined at configuration time based on the detected IDE version.

**GitHub Copilot note:** Copilot completions are hardwired to GitHub's backend and cannot be proxied. However, Copilot's MCP agent/tool calls are fully configurable and point at `localhost:3821` — guardrails apply to all Copilot agent tool calls.

#### Configuration Wizard

1. Review detected config (current state of config file)
2. Choose default provider (sets active in proxy for this IDE)
3. Preview diff — exact line-by-line highlighted diff of what will change
4. Confirm & Apply — atomic write, backup created at `*.quickl-backup`
5. Verify — ping proxy through IDE config path

---

### 7.4 MCP Server Registry

**What it does:** Registry and lifecycle manager for MCP servers, all aggregated behind a single endpoint.

**Built-in catalog:** filesystem, git, sqlite, postgres, fetch/web, github, slack, google-drive, brave-search, puppeteer.

**Lifecycle:** Start / Stop servers, view PID + uptime + tools exposed, health indicator per server.

**Install from:** built-in catalog, npm package name, local path, GitHub URL.

**Auto-aggregation:** All running servers are automatically available through `localhost:3821`. No per-IDE registration needed when adding/removing servers.

---

### 7.5 Guardrail Engine

**What it does:** Intercepts every agent MCP tool call before execution and enforces user-defined rules. Prevents agents from going out of scope, modifying things they shouldn't, or taking destructive actions.

This is only possible because Quickl owns the MCP proxy layer — all agent tool calls flow through Quickl, so enforcement requires no changes to the agent or IDE.

#### Rule Scope: Per-Profile, Per-Agent Exceptions

Guardrail sets are defined at the **profile level**:

- Rules are always on for the profile — no per-session setup
- Individual agents can be exempted by name when needed
- Config hierarchy: **Profile rules → check agent exceptions → enforce or skip**

```
Profile "Work"
  Guardrail Set: strict
    Rules:
      - blocked_tools: [run_terminal_cmd, delete_file]
      - allowed_paths: ["src/**/*.xml"]
      - write_allowed: true
      - shell_execution: false
  Agent Exceptions:
      - "my-trusted-agent": guardrails disabled
```

#### Agent Identification

Agents are identified from the MCP `initialize` handshake:

```json
{ "clientInfo": { "name": "cursor", "version": "0.48.0" } }
```

Quickl uses `clientInfo.name` as the agent identifier. If absent, identifier defaults to `"unknown-agent"` and full profile guardrails apply — the safest fallback.

#### Available Rules (MVP)

| Rule | Description |
|---|---|
| `allowed_tools` | Whitelist of MCP tool names the agent may call |
| `blocked_tools` | Blacklist of tool names always rejected |
| `allowed_paths` | File glob patterns the agent may read/write |
| `write_allowed` | Whether any write operations are permitted |
| `delete_allowed` | Whether delete operations are permitted |
| `shell_execution` | Whether shell/terminal commands are permitted |
| `network_allowed` | Whether outbound network tool calls are permitted |
| `max_files_per_call` | Maximum files touched in a single tool call |

#### Violation Handling: Two-Strike System

```
Agent attempts MCP tool call
          │
  Guardrail Engine evaluates
          │
      VIOLATION
          │
  ┌───────▼──────────────────────────────────────┐
  │  STRIKE 1                                    │
  │  - Tool call blocked                         │
  │  - Explanation message sent back to agent    │
  │  - Event logged (strike: 1)                  │
  └───────┬──────────────────────────────────────┘
          │
  Agent retries
          │
      VIOLATION AGAIN
          │
  ┌───────▼──────────────────────────────────────┐
  │  STRIKE 2                                    │
  │  - Tool call hard blocked                    │
  │  - User notified: tray notification + toast  │
  │  - Event logged (strike: 2)                  │
  └───────┬──────────────────────────────────────┘
          │
  ┌───────▼──────────────────────────────────────┐
  │  USER ACTION PANEL                           │
  │                                              │
  │  ⚠ Agent "cursor" blocked                   │
  │  Attempted: write_file → src/data.xml        │
  │  Rule violated: allowed_paths                │
  │                                              │
  │  [View Log]  [Dismiss]  [Allow Once ›]       │
  └───────┬──────────────────────────────────────┘
          │ if Allow Once clicked
  ┌───────▼──────────────────────────────────────┐
  │  CONFIRMATION DIALOG                         │
  │                                              │
  │  "Are you sure? This will allow the agent    │
  │   to bypass your guardrail rules for this    │
  │   one action only. This cannot be undone."   │
  │                                              │
  │  [Cancel]        [Yes, allow this once]      │
  └───────┬──────────────────────────────────────┘
          │ if confirmed
  Override logged + action executes
```

Key points:
- **Allow Once** is a single-action exception. The guardrail stays fully active for all subsequent calls.
- The override is logged with `resolution: 'manual-override'` — complete audit trail.
- If Strike 1 works and the agent self-corrects, this is logged as `resolution: 'agent-self-corrected'`.

#### Explanation Message Mode

On Strike 1, an explanation is sent back to the agent. The user controls how it is composed, per profile:

**Custom message mode:**
- User writes their own text in a textarea
- Sent verbatim to the agent on every Strike 1
- Good for domain-specific or team-standard language

**Auto-generate mode:**
- Toggle: "Auto-generate explanation using AI"
- Quickl sends the violation context to a lightweight model chosen by the user:
  - Prefers cheap/free: Gemini Flash, GPT-4o-mini, or a locally running Ollama model
  - Model selection is in Settings → Guardrails → Auto-generate model
- Generates a contextual explanation describing what was attempted, which rule was violated, and what the agent should do instead
- Falls back to a hardcoded template if the generation model is unavailable

#### Guardrail Log Entry Schema

```typescript
interface GuardrailLogEntry {
  id: string;
  timestamp: Date;

  // Agent
  agentId: string;           // from MCP clientInfo.name
  agentVersion: string;      // from MCP clientInfo.version
  profileId: string;
  profileName: string;

  // What was attempted
  toolCallAttempted: {
    name: string;            // e.g. "write_file"
    arguments: unknown;      // full args, sanitized
  };

  // Violation
  ruleViolated: string;      // e.g. "allowed_paths"
  ruleDetail: string;        // human-readable explanation

  // Strike
  strike: 1 | 2;
  explanationSent: string | null;
  explanationMode: 'custom' | 'auto-generated' | 'fallback-template' | null;
  agentRetryAttempt: unknown | null;  // what the agent tried after Strike 1

  // Resolution
  resolution: 'blocked' | 'manual-override' | 'agent-self-corrected';
  overrideConfirmedBy: 'user' | null;
  notes: string | null;
}
```

#### Guardrails Page (UI)

Dedicated sidebar page with:
- **Active Rules** — rules for the current profile, rule by rule
- **Agent Exceptions** — agents exempt in this profile, with remove button
- **Add Exception** — type agent name (e.g. "cursor"), save
- **Violation Log** — filterable list of all guardrail entries, newest first. Click to expand full detail including tool call arguments. Export as JSON.
- **Explanation Message** — toggle custom/auto-generate, textarea, model picker

---

### 7.6 System Tray Daemon

#### Tray Icon States
- 🟢 All providers healthy, no active violations
- 🟡 One or more providers degraded
- 🔴 Provider offline or active Strike 2 guardrail alert

#### Tray Menu
```
● Quickl                              [status dot]
─────────────────────────────────────────────────
Active Provider: Claude Sonnet        [●]
  Switch to: GPT-4o
  Switch to: Ollama / llama3.2
─────────────────────────────────────────────────
Local Models
  ● llama3.2:3b   [loaded] 2.1GB VRAM
  ○ codellama:7b  [available]
─────────────────────────────────────────────────
MCP Servers
  ● filesystem    [running]
  ● github        [running]
─────────────────────────────────────────────────
Guardrails        [● Active — Work profile]
─────────────────────────────────────────────────
Open Quickl...
Preferences...
Quit
```

#### Background Tasks
- Health polling continues when window is hidden
- MCP servers and proxy layers stay running
- Guardrail engine stays active
- Strike 2 violations surface as OS notifications

---

### 7.7 Settings & Profiles

#### Profile System

A **Profile** is a named configuration snapshot containing:
- Active providers + default models
- IDE configuration mapping
- MCP servers to auto-start
- **Guardrail set** — rules enforced for this profile
- **Agent exceptions** — agents that bypass guardrails in this profile
- Explanation message mode (custom or auto-generate) + model selection

Profiles can be switched instantly — IDE configs, active provider, and guardrail set all update in under 1 second.

Profiles are exportable as `.quickl-profile.json` (no API keys included) and importable from file or URL.

**Example profiles:**
- `Work` — Claude Sonnet, strict guardrails (no shell, path restrictions), GitHub MCP
- `Personal` — Ollama only, relaxed guardrails (read-only)
- `Agent Lab` — GPT-4o, guardrails off for a specific trusted custom agent

#### Guardrail Settings (per profile)
- Toggle guardrails on/off for the profile
- Rule editor: add/edit/remove rules
- Agent exceptions management
- Explanation mode: custom textarea or auto-generate with model picker

---

### 7.8 Logs & Diagnostics

#### Log Viewer
- Unified stream: system logs + guardrail events in one place
- Filter by level, category (Provider / Model / IDE / MCP / Guardrail / Proxy / System), agent, date
- Virtual scrolling for performance with thousands of entries
- Click any entry to expand full JSON payload
- Export as JSON or plain text

#### Diagnostics Panel
- System info, provider status table, process table, config file table
- Proxy status: ports, request count, active connections
- One-click sanitized diagnostics bundle for bug reports (keys stripped)

#### Dashboard Activity Feed
- Last 20 events across all categories including guardrail violations
- Guardrail events shown with orange accent to distinguish from normal logs

---

## 8. UI/UX Specification

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ● Quickl  [traffic lights]                          [search]    │
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                   │
│  Dashboard   │              MAIN CONTENT AREA                   │
│  Providers   │                                                   │
│  Models      │                                                   │
│  IDEs        │                                                   │
│  MCP         │                                                   │
│  Guardrails  │                                                   │
│  Logs        │                                                   │
│  Settings    │                                                   │
│              ├───────────────────────────────────────────────────┤
│              │  STATUS BAR: provider | proxy | guardrails | health│
└──────────────┴───────────────────────────────────────────────────┘
```

### Design Tokens
- Window minimum size: 900×600px, sidebar: 200px fixed
- Font: Inter (bundled), Icons: Lucide React
- Colors: neutral grays + status accents (green/yellow/red/blue/orange for guardrail alerts)
- Animations: 150ms ease transitions

### Dashboard Page
1. Status summary — 5 cards: Providers, Models, IDEs, MCP, Guardrails (X violations today)
2. Quick actions — Add Provider, Pull Model, Configure IDE, Add MCP Server
3. Activity feed — last 20 events including guardrail events
4. Resource usage — RAM + VRAM mini bars

### Onboarding Flow (First Launch Wizard)
1. Welcome
2. Add first provider
3. Detect IDEs
4. Configure first IDE
5. Set up guardrails — choose preset: "Strict", "Balanced", or "Off" for default profile

---

## 9. Data Model

```typescript
interface Provider {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  preset: ProviderPreset | null;
  baseUrl: string;
  authType: 'api-key' | 'none' | 'bearer';
  keychainKey: string | null;      // reference into OS keychain, NOT the key
  enabled: boolean;
  defaultModel: string | null;
  lastChecked: Date | null;
  lastLatencyMs: number | null;
  status: 'online' | 'degraded' | 'offline' | 'unknown';
  createdAt: Date;
}

interface LocalModel {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeMb: number;
  runtime: 'ollama' | 'lmstudio' | 'vllm' | 'jan';
  status: 'loaded' | 'available' | 'downloading';
  downloadProgress: number | null;
  vramUsageMb: number | null;
  lastUsed: Date | null;
  tags: string[];
}

interface IDE {
  id: string;
  name: string;
  type: IDEType;
  installPath: string;
  version: string | null;
  detectedExtensions: string[];
  configuredByQuickl: boolean;
  configFilePath: string;
  currentProviderId: string | null;
  lastConfiguredAt: Date | null;
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  transport: 'stdio' | 'http' | 'sse';
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'running' | 'stopped' | 'error';
  pid: number | null;
  port: number | null;
  exposedTools: MCPTool[];
  autoStart: boolean;
}

interface GuardrailRule {
  type: 'allowed_tools' | 'blocked_tools' | 'allowed_paths' | 'write_allowed'
      | 'delete_allowed' | 'shell_execution' | 'network_allowed' | 'max_files_per_call';
  value: unknown;
  description: string;
}

interface GuardrailSet {
  id: string;
  name: string;
  enabled: boolean;
  rules: GuardrailRule[];
  agentExceptions: string[];           // agent clientInfo.name values exempt from rules
  explanationMode: 'custom' | 'auto-generate';
  customMessage: string | null;
  autoGenerateModelId: string | null;  // provider+model used for generation
}

interface Profile {
  id: string;
  name: string;
  defaultProviderId: string;
  ideConfigs: Record<string, string>;  // IDE id → provider id
  mcpAutoStart: string[];
  guardrailSet: GuardrailSet;
  isActive: boolean;
  createdAt: Date;
}

interface GuardrailLogEntry {
  id: string;
  timestamp: Date;
  agentId: string;
  agentVersion: string;
  profileId: string;
  profileName: string;
  toolCallAttempted: { name: string; arguments: unknown; };
  ruleViolated: string;
  ruleDetail: string;
  strike: 1 | 2;
  explanationSent: string | null;
  explanationMode: 'custom' | 'auto-generated' | 'fallback-template' | null;
  agentRetryAttempt: unknown | null;
  resolution: 'blocked' | 'manual-override' | 'agent-self-corrected';
  overrideConfirmedBy: 'user' | null;
  notes: string | null;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'provider' | 'model' | 'ide' | 'mcp' | 'guardrail' | 'proxy' | 'system';
  message: string;
  payload: Record<string, unknown> | null;
}
```

---

## 10. IPC Contract

```typescript
interface QuicklBridge {
  providers: {
    list(): Promise<Provider[]>;
    add(config: AddProviderInput): Promise<Provider>;
    update(id: string, config: Partial<Provider>): Promise<Provider>;
    remove(id: string): Promise<void>;
    testConnection(id: string): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
    listModels(id: string): Promise<string[]>;
    setApiKey(id: string, key: string): Promise<void>;
    getApiKeyHint(id: string): Promise<string>;
  };

  models: {
    list(): Promise<LocalModel[]>;
    pull(runtime: string, name: string): Promise<void>;
    remove(runtime: string, name: string): Promise<void>;
    load(runtime: string, name: string): Promise<void>;
    unload(runtime: string, name: string): Promise<void>;
    getResourceStats(): Promise<ResourceStats>;
    search(query: string): Promise<OllamaRegistryResult[]>;
  };

  ides: {
    list(): Promise<IDE[]>;
    scan(): Promise<IDE[]>;
    configure(ideId: string, providerId: string, options?: ConfigOptions): Promise<ConfigDiff>;
    applyConfig(ideId: string, diff: ConfigDiff): Promise<void>;
    resetConfig(ideId: string): Promise<void>;
    readCurrentConfig(ideId: string): Promise<unknown>;
  };

  mcp: {
    list(): Promise<MCPServer[]>;
    catalog(): Promise<MCPCatalogEntry[]>;
    add(config: AddMCPInput): Promise<MCPServer>;
    remove(id: string): Promise<void>;
    start(id: string): Promise<void>;
    stop(id: string): Promise<void>;
    listTools(id: string): Promise<MCPTool[]>;
  };

  guardrails: {
    getSet(profileId: string): Promise<GuardrailSet>;
    updateSet(profileId: string, set: Partial<GuardrailSet>): Promise<GuardrailSet>;
    addRule(profileId: string, rule: GuardrailRule): Promise<GuardrailSet>;
    removeRule(profileId: string, ruleType: string): Promise<GuardrailSet>;
    addAgentException(profileId: string, agentId: string): Promise<void>;
    removeAgentException(profileId: string, agentId: string): Promise<void>;
    getLogs(filter?: GuardrailLogFilter): Promise<GuardrailLogEntry[]>;
    resolveViolation(logId: string, action: 'dismiss' | 'allow-once'): Promise<void>;
    exportLogs(filter?: GuardrailLogFilter): Promise<string>;
  };

  profiles: {
    list(): Promise<Profile[]>;
    create(name: string, config: ProfileConfig): Promise<Profile>;
    activate(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    export(id: string): Promise<string>;
    import(json: string): Promise<Profile>;
  };

  logs: {
    list(filter?: LogFilter): Promise<LogEntry[]>;
    export(filter?: LogFilter): Promise<string>;
    clear(): Promise<void>;
    onNewEntry(callback: (entry: LogEntry) => void): () => void;
  };

  proxy: {
    getStatus(): Promise<ProxyStatus>;
    restart(): Promise<void>;
  };

  system: {
    getDiagnostics(): Promise<DiagnosticsReport>;
    openDataDirectory(): Promise<void>;
    checkForUpdates(): Promise<UpdateCheckResult>;
    getVersion(): Promise<string>;
  };
}
```

Events pushed from main → renderer:
- `quickl:provider-status-changed`
- `quickl:model-pull-progress` — `{ name, progress: 0-100 }`
- `quickl:model-status-changed`
- `quickl:mcp-server-status-changed`
- `quickl:guardrail-violation` — Strike 2 alert requiring user action
- `quickl:log-entry`

---

## 11. Security Model

### API Key Storage
- Keys in OS keychain via `keytar`. `electron-store` holds only a reference key name.
- Keys loaded into memory only for duration of a single proxy request.
- Keys never logged, never sent to renderer, never written to any file.

### Proxy Security
- Provider Proxy binds to `127.0.0.1:3820` only — never `0.0.0.0`.
- MCP Aggregator binds to `127.0.0.1:3821` only.
- No external access without explicit user-initiated tunneling.

### Guardrail Integrity
- Rules evaluated in main process — renderer cannot bypass them.
- `allow-once` overrides require explicit user confirmation and are always logged.
- Guardrail log entries are append-only — cannot be deleted individually.

### Config File Safety
- Atomic writes (temp file → rename). Backup created before every write.
- Diff always shown before applying.

### Renderer Isolation
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`.

---

## 12. Testing Strategy

### Unit Tests (Vitest)
- All services: `ProviderService`, `ModelService`, `IDEService`, `MCPService`, `GuardrailEngine`, `ProxyGateway`
- Guardrail rule evaluation: each rule type with passing and violating tool calls
- Two-strike state transitions: verify correct progression
- Allow-once: verify single-use and correct log entry creation
- Explanation message: custom mode, auto-generate mode, fallback mode

### Integration Tests
- IPC handlers with mocked services
- Proxy request forwarding: mock provider endpoint, verify format translation
- Guardrail integration: tool call through proxy, verify blocked/allowed correctly

### E2E Tests (Playwright for Electron)
- Full onboarding including guardrail preset selection
- Add provider → test → configure IDE
- Pull model → load → unload
- Guardrail violation: trigger Strike 1, agent retry, Strike 2, dismiss, allow-once
- Profile switch → verify IDE config + guardrail set updated

### Manual Test Matrix (pre-release)
- macOS 13+, Windows 11, Ubuntu 22.04
- All 6 IDEs detected and configured
- Guardrail: trigger violation via Cline in VS Code, verify agent receives Strike 1 explanation, then Strike 2 user notification

---

## 13. Build & Distribution

```bash
npm run dev           # Vite + Electron with HMR
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E
npm run build:mac     # .dmg (signed + notarized)
npm run build:win     # .exe NSIS installer
npm run build:linux   # .AppImage + .deb
```

Release artifacts via GitHub Releases. Auto-update via `electron-updater` on startup + every 4 hours. Update channels: `stable` (default), `beta` (opt-in).

---

## 14. Out of Scope for MVP

- Team/shared profiles with cloud sync
- Fine-tuning job management
- Model benchmarking/comparison runner
- Prompt library
- Cost tracking / usage analytics
- Web UI version
- Plugin system / extension API
- Guardrail template library (community presets)
- Semantic change constraint rules (AST diffing)
- Automatic agent trust scoring
- Multi-machine sync
- Enterprise SSO / LDAP
- Ollama Modelfile editor
- Custom MCP server builder

---

*End of MVP Specification — v1.0.0*