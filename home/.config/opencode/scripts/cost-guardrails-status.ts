#!/usr/bin/env bun
import { Database as BunDatabase } from "bun:sqlite"
import fs from "fs"
import path from "path"
import os from "os"

const args = process.argv.slice(2)
const projectID = args[0] ?? process.env.OPENCODE_COST_GUARD_PROJECT_ID

function stateDir() {
  const override = process.env.OPENCODE_COST_GUARD_STATE_DIR
  if (override) return override
  const home = os.homedir()
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config")
  return path.join(xdgConfig, "opencode", "state")
}

function projectDbPath(id: string) {
  return path.join(stateDir(), `cost-guardrails-${id}.db`)
}

function globalDbPath() {
  return path.join(stateDir(), "cost-guardrails-global.db")
}

function listProjects() {
  const dir = stateDir()
  if (!fs.existsSync(dir)) {
    console.log("No state directory found")
    return
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("cost-guardrails-") && f.endsWith(".db") && f !== "cost-guardrails-global.db")
  if (files.length === 0) {
    console.log("No guardrails databases found")
    return
  }
  console.log("Available projects:")
  for (const file of files) {
    const match = file.match(/cost-guardrails-(.+)\.db$/)
    if (match) console.log(`  ${match[1]}`)
  }
}

function showGlobal() {
  const file = globalDbPath()
  if (!fs.existsSync(file)) {
    console.log("\nNo global guardrails database found")
    return
  }
  const db = new BunDatabase(file, { readonly: true })
  const totalCost = (db.query("SELECT COALESCE(SUM(cost), 0) as total FROM messages").get() as { total: number }).total
  const msgCount = (db.query("SELECT COUNT(*) as count FROM messages").get() as { count: number }).count
  const warnings = db.query("SELECT key FROM warnings ORDER BY key").all() as { key: string }[]
  const projects = db
    .query(
      "SELECT DISTINCT project_id, COALESCE(SUM(cost), 0) as cost FROM messages GROUP BY project_id ORDER BY cost DESC",
    )
    .all() as { project_id: string; cost: number }[]
  db.close()

  console.log(`\nGlobal DB: ${file}`)
  console.log(`Messages: ${msgCount}`)
  console.log(`Total Cost: $${totalCost.toFixed(4)}`)
  if (projects.length > 0) {
    console.log("\nPer-project breakdown:")
    for (const row of projects) {
      console.log(`  ${row.project_id.slice(0, 20).padEnd(20)} $${row.cost.toFixed(4)}`)
    }
  }
  if (warnings.length > 0) {
    console.log("\nSystem warnings triggered:")
    for (const row of warnings) {
      const type = row.key.includes(":limit") ? "  " : "  "
      console.log(`${type}${row.key}`)
    }
  } else {
    console.log("\nNo system warnings triggered")
  }
}

function showHelp() {
  console.log(`Usage: bun cost-guardrails-status.ts [projectID]

Show cost guardrails status for a project and global totals.

Arguments:
  projectID    Project ID to inspect (optional, uses env var or lists all)

Environment:
  OPENCODE_COST_GUARD_PROJECT_ID    Default project ID
  OPENCODE_COST_GUARD_STATE_DIR     Override state directory

Examples:
  bun cost-guardrails-status.ts                    # List all projects + global
  bun cost-guardrails-status.ts proj_replay        # Show specific project + global
`)
}

if (args.includes("-h") || args.includes("--help")) {
  showHelp()
  process.exit(0)
}

if (!projectID) {
  listProjects()
  showGlobal()
  process.exit(0)
}

const file = projectDbPath(projectID)
if (!fs.existsSync(file)) {
  console.log(`No guardrails database found for project: ${projectID}`)
  console.log("")
  listProjects()
  showGlobal()
  process.exit(1)
}

const db = new BunDatabase(file, { readonly: true })

const totals = db.query("SELECT key, value FROM totals ORDER BY key").all() as { key: string; value: number }[]
const warnings = db.query("SELECT key FROM warnings ORDER BY key").all() as { key: string }[]
const messageCount = (db.query("SELECT COUNT(*) as count FROM messages").get() as { count: number }).count
const totalCost = (db.query("SELECT COALESCE(SUM(cost), 0) as total FROM messages").get() as { total: number }).total

db.close()

console.log(`\nProject: ${projectID}`)
console.log(`Messages: ${messageCount}`)
console.log(`Total Cost: $${totalCost.toFixed(4)}`)
console.log("")

if (totals.length > 0) {
  console.log("Totals:")
  for (const row of totals) {
    const icon = row.key.includes("session") ? "  " : "  "
    console.log(`${icon}${row.key.padEnd(40)} $${row.value.toFixed(4)}`)
  }
  console.log("")
}

if (warnings.length > 0) {
  console.log("Warnings triggered:")
  for (const row of warnings) {
    const type = row.key.includes(":limit") ? "  " : "  "
    console.log(`${type}${row.key}`)
  }
} else {
  console.log("No warnings triggered")
}

showGlobal()

console.log("")
