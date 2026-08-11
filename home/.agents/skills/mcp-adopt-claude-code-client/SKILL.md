---
name: mcp-adopt-claude-code-client
disable-model-invocation: true
description: Adopt a Claude Code OAuth client so a rejected Pi MCP server can authenticate.
---

# Adopt a Claude Code OAuth client for Pi

When an MCP server works in Claude Code but Pi's dynamically registered OAuth client is rejected — org restrictions, admin approval gates, issuer mismatches — adopt Claude Code's already-approved client.

## 1 — Find the server's project directory in Claude Code

Claude Code's MCP logs live under `~/Library/Caches/claude-cli-nodejs/`. Directory names are project paths with `/` replaced by `-`.

```bash
ls ~/Library/Caches/claude-cli-nodejs/ | grep mcp-logs
```

Pick the project directory where the server was used. List its `mcp-logs-*` subdirectories to find the server name.

## 2 — Extract the client ID and redirect URI

Search the server's log files for `client_id` in the authorization URL:

```bash
grep -h "client_id" ~/Library/Caches/claude-cli-nodejs/<PROJECT>/mcp-logs-<SERVER>/*.jsonl | head -3
```

The authorization URL contains both values as query parameters:

- `client_id=<VALUE>` — the registered OAuth client
- `redirect_uri=<URL-ENCODED>` — typically `http://localhost:<PORT>/callback`

Extract and decode both. Confirm the client ID appears consistently across sessions — a changed ID means Claude Code re-registered.

## 3 — Configure Pi

Edit `~/.pi/agent/mcp.json` (source of truth: `~/dotfiles/home/.pi/agent/mcp.json`). Add the `oauth` block to the server entry:

```json
"<server-name>": {
  "url": "<same URL Claude Code uses>",
  "oauth": {
    "clientId": "<extracted client ID>",
    "redirectUri": "<extracted redirect URI>",
    "skipIssuerMetadataValidation": true
  }
}
```

**Match the URL exactly** to what Claude Code uses (check the `"url"` field in the log's HTTP transport options line). The client was registered against that URL; a different one breaks the registration.

`skipIssuerMetadataValidation` bypasses RFC 8414 §3.3 issuer checks. Pi enforces this strictly; Claude Code does not. Many MCP servers (Atlassian, others) return a different issuer in their OAuth metadata than the URL you connect to.

## 4 — Clear stale Pi tokens

Remove Pi's old token file so the next auth uses the new client:

```bash
rm ~/.pi/agent/mcp-oauth/<server-name>/tokens.json 2>/dev/null
```

## 5 — Authenticate and verify

Restart Pi (the config is cached per session). On connect, Pi opens the OAuth flow in the browser using the adopted client. Complete the browser auth, then test:

```
mcp({ connect: "<server-name>" })
mcp({ tool: "<server>_<any_read_tool>", args: {} })
```

A successful tool call confirms the adoption worked. If port 3118 (or whatever the redirect URI port is) is busy, close Claude Code first.
