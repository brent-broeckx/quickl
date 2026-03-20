# Phase 1 Manual Validation Checklist (Provider Management)

Use this checklist to validate all Phase 1 exit criteria before updating Roadmap status.

## Preconditions

1. You have at least one valid API key for OpenAI.
2. You have at least one valid API key for Anthropic.
3. Ollama is installed and running locally on `http://localhost:11434`.
4. You are on a developer machine with desktop UI access.

## Automated Checks

Run from project root:

```powershell
npm run typecheck
npm run lint
npm run test
```

Expected:
- `typecheck` exits with 0 errors.
- `lint` exits with 0 lint errors.
- `test` exits with all tests passing.

## Runtime Launch

Run:

```powershell
npm run dev
```

Expected:
- App window opens.
- No Quickl application runtime errors in terminal or renderer console.

## Manual Flow Checklist (Exit Criteria 5-13)

### 5) Add OpenAI provider with real key
- Navigate to Providers page.
- Click Add Provider.
- Choose OpenAI preset.
- Enter valid key.
- Save.

Pass condition:
- OpenAI provider card appears.

Result: [ ] Pass  [ ] Fail
Notes:

### 6) Add Anthropic provider with real key
- Add provider using Anthropic preset.
- Enter valid key.
- Save.

Pass condition:
- Anthropic provider card appears.

Result: [ ] Pass  [ ] Fail
Notes:

### 7) Add Ollama provider (no key)
- Add provider using Ollama preset.
- Leave key blank.
- Save.

Pass condition:
- Ollama provider card appears.

Result: [ ] Pass  [ ] Fail
Notes:

### 8) Test Connection returns real result for each provider type used
- For OpenAI card: click Test.
- For Anthropic card: click Test.
- For Ollama card: click Test.

Pass condition:
- Each provider shows success or clear failure result with latency.
- Result reflects real endpoint reachability.

Result: [ ] Pass  [ ] Fail
Notes:

### 9) Health polling updates every 30s without refresh
- Keep Providers page open.
- Wait at least 2 polling cycles.
- Optionally stop/restart Ollama to force state transitions.

Pass condition:
- Provider status and latency update automatically.
- No page refresh required.

Result: [ ] Pass  [ ] Fail
Notes:

### 10) Remove provider removes list entry and keychain secret
- Remove OpenAI provider from UI.
- Verify card disappears.
- Confirm secret is gone from OS keychain entry for removed provider ID.

Pass condition:
- Provider removed from UI.
- Keychain entry deleted.

Result: [ ] Pass  [ ] Fail
Notes:

### 11) API key never visible in DevTools/network/IPC/logs
- Open renderer DevTools.
- Inspect network payloads and console.
- Inspect provider-related logs.

Pass condition:
- No plaintext API key visible in renderer logs, network requests, or IPC payloads.

Result: [ ] Pass  [ ] Fail
Notes:

### 12) getApiKeyHint returns masked format
- In edit drawer for a provider with key, verify shown hint format.

Pass condition:
- Hint format appears as `sk-...xxxx` (or `(not set)` if missing).

Result: [ ] Pass  [ ] Fail
Notes:

### 13) Dashboard Providers summary card is correct
- Go to Dashboard.
- Validate total provider count.
- Validate healthy count and color state:
  - Green: all healthy
  - Yellow: some degraded
  - Red: any offline
- Click card and verify navigation to Providers page.

Pass condition:
- Counts, color status, and navigation are correct.

Result: [ ] Pass  [ ] Fail
Notes:

## Exit Criteria 14 (Roadmap Update Trigger)

Only after all criteria above pass:
- Update Phase 1 checklist items in `ROADMAP.md` from `[ ]` to `[x]`.
- Add completion note at end of Phase 1 section:

```text
Completed: 2026-03-20
Version tag: v0.2.0-alpha
```

## Final Sign-off

- [x] Criteria 1 passed
- [x] Criteria 2 passed
- [x] Criteria 3 passed
- [x] Criteria 4 passed
- [x] Criteria 5 passed
- [x] Criteria 6 passed
- [x] Criteria 7 passed
- [x] Criteria 8 passed
- [x] Criteria 9 passed
- [x] Criteria 10 passed
- [x] Criteria 11 passed
- [x] Criteria 12 passed
- [x] Criteria 13 passed
- [x] Criteria 14 ready to apply

When all are checked, tell Copilot: "Phase 1 manual validation passed, update ROADMAP now."