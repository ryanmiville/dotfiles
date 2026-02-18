#!/usr/bin/env bun
import { createOpencodeClient } from "@opencode-ai/sdk"
import type { Event, Project, Session, AssistantMessage } from "@opencode-ai/sdk"
import { Database as BunDatabase } from "bun:sqlite"
import { $ } from "bun"
import fs from "fs/promises"
import fsSync from "fs"
import os from "os"
import path from "path"
import { CostGuardrailsPlugin } from "../plugins/cost-guardrails"

type Toast = {
  title?: string
  message?: string
  variant?: "info" | "success" | "warning" | "error"
  duration?: number
}

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run") || args.includes("-d")
const keepDb = args.includes("--keep-db") || args.includes("-k")
const showHelp = args.includes("--help") || args.includes("-h")
const listSessions = args.includes("--list") || args.includes("-l")

const sessionIDArg = args.find((a) => !a.startsWith("-"))

function resolveOpencodeDbPath() {
  const envPath = process.env.OPENCODE_DB_PATH
  if (envPath) return envPath
  const home = os.homedir()
  const xdg = process.env.XDG_DATA_HOME
  const linuxPath = path.join(xdg ?? path.join(home, ".local", "share"), "opencode", "opencode.db")
  const macPath = path.join(home, "Library", "Application Support", "opencode", "opencode.db")
  if (fsSync.existsSync(macPath)) return macPath
  if (fsSync.existsSync(linuxPath)) return linuxPath
  return
}

function stateDir() {
  const override = process.env.OPENCODE_COST_GUARD_STATE_DIR
  if (override) return override
  const home = os.homedir()
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config")
  return path.join(xdgConfig, "opencode", "state")
}

function dbPath(id: string) {
  return path.join(stateDir(), `cost-guardrails-${id}.db`)
}

function globalDbPath() {
  return path.join(stateDir(), "cost-guardrails-global.db")
}

function listAvailableSessions(sourceDb: BunDatabase | undefined) {
  if (!sourceDb) {
    console.log("No opencode database found")
    return
  }
  const sessions = sourceDb
    .query("SELECT id, title, directory, time_created FROM session ORDER BY time_created DESC LIMIT 20")
    .all() as { id: string; title: string; directory: string; time_created: number }[]

  console.log("\nRecent sessions:")
  console.log("ID\t\t\t\t\t\tTitle\t\t\tDirectory")
  console.log("-".repeat(100))
  for (const s of sessions) {
    const date = new Date(s.time_created).toLocaleDateString()
    const title = s.title.slice(0, 25).padEnd(25)
    console.log(`${s.id}\t${title}\t${s.directory} (${date})`)
  }
  console.log("")
}

function showHelpText() {
  console.log(`Usage: bun cost-guardrails-replay.ts [options] [sessionID]

Replay a session through the cost guardrails plugin to test thresholds.

Arguments:
  sessionID    Session ID to replay (optional, uses env var or fallback)

Options:
  -d, --dry-run    Don't modify database, just show what would happen
  -k, --keep-db    Don't delete existing guardrails DB before replay
  -l, --list       List available sessions from opencode DB
  -h, --help       Show this help

Environment:
  OPENCODE_COST_GUARD_SESSION_LIMIT     Session limit ($)
  OPENCODE_COST_GUARD_PROJECT_LIMIT     Project limit ($)
  OPENCODE_COST_GUARD_DAILY_LIMIT       Daily limit ($)
  OPENCODE_COST_GUARD_WARNING_PERCENT   Warning threshold (0-1)
  OPENCODE_COST_GUARD_SESSION_ID        Default session ID
  OPENCODE_COST_GUARD_PROJECT_ID        Project ID

Examples:
  bun cost-guardrails-replay.ts -l                    # List sessions
  bun cost-guardrails-replay.ts ses_xxx               # Replay specific session
  bun cost-guardrails-replay.ts -d ses_xxx            # Dry run
  bun cost-guardrails-replay.ts -k ses_xxx            # Keep existing DB
`)
}

if (showHelp) {
  showHelpText()
  process.exit(0)
}

const sourceDbPath = resolveOpencodeDbPath()
const sourceDb = sourceDbPath ? new BunDatabase(sourceDbPath, { readonly: true }) : undefined

if (listSessions) {
  listAvailableSessions(sourceDb)
  sourceDb?.close()
  process.exit(0)
}

process.env.OPENCODE_COST_GUARD_SESSION_LIMIT ??= "0.1"
process.env.OPENCODE_COST_GUARD_PROJECT_LIMIT ??= "0.2"
process.env.OPENCODE_COST_GUARD_WARNING_PERCENT ??= "0.5"

const projectID = process.env.OPENCODE_COST_GUARD_PROJECT_ID ?? "proj_replay"
const sessionID = sessionIDArg ?? process.env.OPENCODE_COST_GUARD_SESSION_ID ?? "ses_replay"

if (dryRun) {
  console.log("DRY RUN: No database changes will be made\n")
}

const now = Date.now()
const directory = process.cwd()
const worktree = directory

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value !== "string") return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function isAssistantData(value: unknown): value is Omit<AssistantMessage, "id" | "sessionID"> {
  if (!value || typeof value !== "object") return false
  return (value as { role?: string }).role === "assistant"
}

const sessionRow = sourceDb
  ? (sourceDb
      .query(
        "SELECT id, project_id, directory, slug, title, version, time_created, time_updated FROM session WHERE id = ?",
      )
      .get(sessionID) as
      | {
          id: string
          project_id: string
          directory: string
          slug: string
          title: string
          version: string
          time_created: number
          time_updated: number
        }
      | undefined)
  : undefined

if (!sessionRow && sourceDb) {
  console.log(`Session not found: ${sessionID}`)
  console.log("\nDid you mean one of these?")
  listAvailableSessions(sourceDb)
  sourceDb?.close()
  process.exit(1)
}

const projectRow = sessionRow
  ? (sourceDb
      ?.query(
        "SELECT id, worktree, vcs, name, icon_url, icon_color, time_created, time_updated, time_initialized, sandboxes, commands FROM project WHERE id = ?",
      )
      .get(sessionRow.project_id) as
      | {
          id: string
          worktree: string
          vcs: string | null
          name: string | null
          icon_url: string | null
          icon_color: string | null
          time_created: number
          time_updated: number
          time_initialized: number | null
          sandboxes: string
          commands: string | null
        }
      | undefined)
  : undefined

const resolvedProjectID = sessionRow?.project_id ?? projectID
const resolvedDirectory = sessionRow?.directory ?? directory
const resolvedWorktree = projectRow?.worktree ?? worktree

const project: Project = {
  id: resolvedProjectID,
  worktree: resolvedWorktree,
  vcs: projectRow?.vcs === "git" ? "git" : undefined,
  time: {
    created: projectRow?.time_created ?? now,
    initialized: projectRow?.time_initialized ?? undefined,
  },
}

const dbFile = dbPath(resolvedProjectID)
const globalFile = globalDbPath()

if (!dryRun && !keepDb) {
  await fs.rm(dbFile, { force: true })
  await fs.rm(globalFile, { force: true })
}

const toasts: Toast[] = []

const client = createOpencodeClient({
  baseUrl: "http://localhost",
  directory: resolvedDirectory,
  fetch: async (request: Request) => {
    const url = new URL(request.url)
    if (url.pathname === "/tui/show-toast") {
      const text = await request.text()
      const body = text ? JSON.parse(text) : {}
      const query = Object.fromEntries(url.searchParams.entries())
      const toast = { ...query, ...body } as Toast
      toasts.push(toast)
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  },
})

const plugin = await CostGuardrailsPlugin({
  client,
  project,
  directory: resolvedDirectory,
  worktree: resolvedWorktree,
  serverUrl: new URL("http://localhost"),
  $,
})

if (!plugin.event) {
  console.log("Plugin has no event hook")
  process.exit(0)
}

const session: Session = {
  id: sessionRow?.id ?? sessionID,
  projectID: resolvedProjectID,
  directory: resolvedDirectory,
  title: sessionRow?.title ?? "Replay",
  version: sessionRow?.version ?? "dev",
  time: {
    created: sessionRow?.time_created ?? now,
    updated: sessionRow?.time_updated ?? now,
  },
}

const rows = sourceDb
  ? (sourceDb
      .query("SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC")
      .all(session.id) as { id: string; time_created: number; data: string }[])
  : []

const realMessages = rows
  .map((row) => {
    const data = parseJson<unknown>(row.data, null)
    if (!isAssistantData(data)) return
    return {
      ...data,
      id: row.id,
      sessionID: session.id,
      time: (data as { time?: { created: number } }).time ?? { created: row.time_created },
    } as AssistantMessage
  })
  .filter((item): item is AssistantMessage => !!item)

function assistant(id: string, cost: number, created: number): AssistantMessage {
  return {
    id,
    sessionID: session.id,
    role: "assistant",
    time: { created },
    parentID: "msg_parent",
    modelID: "model",
    providerID: "provider",
    mode: "default",
    path: { cwd: resolvedDirectory, root: resolvedWorktree },
    cost,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
}

const fallbackMessages = [
  assistant("msg_1", 0.04, now + 1),
  assistant("msg_1", 0.06, now + 2),
  assistant("msg_2", 0.07, now + 3),
]

const messageEvents = (realMessages.length ? realMessages : fallbackMessages).map((info) => ({
  type: "message.updated" as const,
  properties: { info },
}))

const events: Event[] = [{ type: "session.created", properties: { info: session } }, ...messageEvents]

console.log(`Replaying ${messageEvents.length} message(s)...\n`)

for (const event of events) {
  await plugin.event({ event })
}

// If hard limit mode, verify tool.execute.before blocks subsequent calls
if (process.env.OPENCODE_COST_GUARD_HARD_LIMIT === "1" || process.env.OPENCODE_COST_GUARD_HARD_LIMIT === "true") {
  if (plugin["tool.execute.before"]) {
    try {
      await plugin["tool.execute.before"]({ tool: "bash", sessionID: session.id, callID: "test" }, { args: {} })
      console.log("\nHard limit: tool calls NOT blocked (limit was not hit)")
    } catch (e) {
      console.log(`\nHard limit: tool calls BLOCKED — ${e instanceof Error ? e.message : e}`)
    }
  }
}

sourceDb?.close()

if (dryRun) {
  console.log("\nDRY RUN - No changes made")
} else {
  const db = new BunDatabase(dbFile, { readonly: true })
  const totals = db.query("SELECT key, value FROM totals ORDER BY key").all() as { key: string; value: number }[]
  const warnings = db.query("SELECT key FROM warnings ORDER BY key").all() as { key: string }[]
  db.close()

  console.log("\nTotals:")
  for (const row of totals) {
    console.log(`  ${row.key.padEnd(40)} $${row.value.toFixed(4)}`)
  }

  console.log("\nWarnings:")
  if (warnings.length === 0) console.log("  (none)")
  for (const row of warnings) {
    console.log(`  ${row.key}`)
  }

  const fsSync = await import("fs")
  if (fsSync.existsSync(globalFile)) {
    const gdb = new BunDatabase(globalFile, { readonly: true })
    const gTotal = (gdb.query("SELECT COALESCE(SUM(cost), 0) AS value FROM messages").get() as { value: number }).value
    const gWarnings = gdb.query("SELECT key FROM warnings ORDER BY key").all() as { key: string }[]
    gdb.close()
    console.log(`\nGlobal DB: ${globalFile}`)
    console.log(`  Total: $${gTotal.toFixed(4)}`)
    if (gWarnings.length > 0) {
      console.log("  Warnings:")
      for (const row of gWarnings) {
        console.log(`    ${row.key}`)
      }
    }
  }
}

console.log("\nToasts:")
if (toasts.length === 0) console.log("  (none)")
for (const toast of toasts) {
  const variant = toast.variant ?? "info"
  const icon = variant === "error" ? "  " : variant === "warning" ? "  " : "  "
  console.log(`${icon}[${variant.toUpperCase()}] ${toast.title ?? ""}`)
  if (toast.message) console.log(`    ${toast.message}`)
}

console.log("")
