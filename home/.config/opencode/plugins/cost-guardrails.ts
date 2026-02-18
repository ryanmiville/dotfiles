import type { Plugin } from "@opencode-ai/plugin"
import type { Event, AssistantMessage, Message } from "@opencode-ai/sdk"
import fs from "fs"
import { Database as BunDatabase } from "bun:sqlite"
import path from "path"
import os from "os"

type Limits = {
  session?: number
  project?: number
  daily?: number
  weekly?: number
  monthly?: number
  system?: number
  systemDaily?: number
  systemWeekly?: number
  systemMonthly?: number
  warning: number
  hard: boolean
}

const SessionPrefix = "session"
const ProjectPrefix = "project"
const DailyPrefix = "daily"
const WeeklyPrefix = "weekly"
const MonthlyPrefix = "monthly"
const SystemPrefix = "system"

function numberFromEnv(value: string | undefined) {
  if (!value) return
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return
  return parsed
}

function readLimits(): Limits {
  const session = numberFromEnv(process.env.OPENCODE_COST_GUARD_SESSION_LIMIT)
  const project = numberFromEnv(process.env.OPENCODE_COST_GUARD_PROJECT_LIMIT)
  const daily = numberFromEnv(process.env.OPENCODE_COST_GUARD_DAILY_LIMIT)
  const weekly = numberFromEnv(process.env.OPENCODE_COST_GUARD_WEEKLY_LIMIT)
  const monthly = numberFromEnv(process.env.OPENCODE_COST_GUARD_MONTHLY_LIMIT)
  const system = numberFromEnv(process.env.OPENCODE_COST_GUARD_SYSTEM_LIMIT)
  const systemDaily = numberFromEnv(process.env.OPENCODE_COST_GUARD_SYSTEM_DAILY_LIMIT)
  const systemWeekly = numberFromEnv(process.env.OPENCODE_COST_GUARD_SYSTEM_WEEKLY_LIMIT)
  const systemMonthly = numberFromEnv(process.env.OPENCODE_COST_GUARD_SYSTEM_MONTHLY_LIMIT)
  const warningRaw = numberFromEnv(process.env.OPENCODE_COST_GUARD_WARNING_PERCENT)
  const hard =
    process.env.OPENCODE_COST_GUARD_HARD_LIMIT === "1" || process.env.OPENCODE_COST_GUARD_HARD_LIMIT === "true"
  if (warningRaw === undefined)
    return {
      session,
      project,
      daily,
      weekly,
      monthly,
      system,
      systemDaily,
      systemWeekly,
      systemMonthly,
      warning: 0.8,
      hard,
    }
  const warning = warningRaw > 1 ? warningRaw / 100 : warningRaw
  return { session, project, daily, weekly, monthly, system, systemDaily, systemWeekly, systemMonthly, warning, hard }
}

function formatCost(value: number) {
  return `$${value.toFixed(2)}`
}

function warnKey(prefix: string, id: string) {
  return `${prefix}:${id}:warn`
}

function limitKey(prefix: string, id: string) {
  return `${prefix}:${id}:limit`
}

function isAssistant(message: Message): message is AssistantMessage {
  return message.role === "assistant"
}

function stateDir() {
  const override = process.env.OPENCODE_COST_GUARD_STATE_DIR
  if (override) return override
  const home = os.homedir()
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config")
  return path.join(xdgConfig, "opencode", "state")
}

function projectDbPath(projectID: string) {
  return path.join(stateDir(), `cost-guardrails-${projectID}.db`)
}

function globalDbPath() {
  return path.join(stateDir(), "cost-guardrails-global.db")
}

function initDb(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new BunDatabase(file, { create: true })
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("CREATE TABLE IF NOT EXISTS totals (key TEXT PRIMARY KEY, value REAL NOT NULL)")
  db.exec(
    "CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, cost REAL NOT NULL, time INTEGER NOT NULL DEFAULT 0)",
  )
  db.exec("CREATE TABLE IF NOT EXISTS warnings (key TEXT PRIMARY KEY)")
  const columns = db.query("PRAGMA table_info(messages)").all() as { name: string }[]
  if (!columns.some((column) => column.name === "time")) {
    db.exec("ALTER TABLE messages ADD COLUMN time INTEGER NOT NULL DEFAULT 0")
  }
  return db
}

function initGlobalDb(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new BunDatabase(file, { create: true })
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec("PRAGMA journal_mode = WAL")
  db.exec(
    "CREATE TABLE IF NOT EXISTS messages (id TEXT NOT NULL, project_id TEXT NOT NULL, session_id TEXT NOT NULL, cost REAL NOT NULL, time INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, project_id))",
  )
  db.exec("CREATE TABLE IF NOT EXISTS warnings (key TEXT PRIMARY KEY)")
  return db
}

function totalKey(prefix: string, id: string) {
  return `${prefix}:${id}`
}

function periodID(prefix: string, time: number) {
  const date = new Date(time)
  if (prefix === MonthlyPrefix) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  const start = periodStart(prefix, date)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
}

function periodStart(prefix: string, date: Date) {
  if (prefix === DailyPrefix) return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (prefix === WeeklyPrefix) {
    const offset = (date.getDay() + 6) % 7
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset)
  }
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function periodRange(prefix: string, time: number) {
  const start = periodStart(prefix, new Date(time))
  if (prefix === DailyPrefix) return { start: start.getTime(), end: start.getTime() + 24 * 60 * 60 * 1000 }
  if (prefix === WeeklyPrefix) return { start: start.getTime(), end: start.getTime() + 7 * 24 * 60 * 60 * 1000 }
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  return { start: start.getTime(), end: end.getTime() }
}

export const CostGuardrailsPlugin: Plugin = async (input) => {
  const limits = readLimits()
  const hasPerProject = limits.session || limits.project || limits.daily || limits.weekly || limits.monthly
  const hasSystem = limits.system || limits.systemDaily || limits.systemWeekly || limits.systemMonthly
  if (!hasPerProject && !hasSystem) return {}

  const projectID = input.project.id
  const db = hasPerProject ? initDb(projectDbPath(projectID)) : undefined
  const globalDb = hasSystem ? initGlobalDb(globalDbPath()) : undefined

  const warnings = new Set(
    ((db?.query("SELECT key FROM warnings").all() as { key: string }[]) ?? []).map((row) => row.key),
  )
  let blocked: string | undefined

  if (
    db &&
    !(db.query("SELECT key FROM totals WHERE key = ?").get(totalKey(ProjectPrefix, projectID)) as { key: string })
  ) {
    db.run("INSERT OR IGNORE INTO totals (key, value) VALUES (?, 0)", [totalKey(ProjectPrefix, projectID)])
  }

  async function notify(kind: "warning" | "error", title: string, message: string) {
    await input.client.tui.showToast({
      query: {
        directory: input.directory,
      },
      body: {
        title,
        message,
        variant: kind,
      },
    })
  }

  async function checkSession(sessionID: string, total: number, limit: number): Promise<boolean> {
    const warnAt = limit * limits.warning
    if (total >= limit && !warnings.has(limitKey(SessionPrefix, sessionID))) {
      warnings.add(limitKey(SessionPrefix, sessionID))
      db!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [limitKey(SessionPrefix, sessionID)])
      await notify(
        "error",
        "Session budget exceeded",
        `Session ${sessionID} reached ${formatCost(total)} of ${formatCost(limit)}.`,
      )
      return true
    }
    if (limits.warning <= 0) return false
    if (total >= warnAt && !warnings.has(warnKey(SessionPrefix, sessionID))) {
      warnings.add(warnKey(SessionPrefix, sessionID))
      db!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [warnKey(SessionPrefix, sessionID)])
      await notify(
        "warning",
        "Session budget warning",
        `Session ${sessionID} reached ${formatCost(total)} of ${formatCost(limit)}.`,
      )
    }
    return false
  }

  async function checkProject(total: number, limit: number): Promise<boolean> {
    const warnAt = limit * limits.warning
    if (total >= limit && !warnings.has(limitKey(ProjectPrefix, projectID))) {
      warnings.add(limitKey(ProjectPrefix, projectID))
      db!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [limitKey(ProjectPrefix, projectID)])
      await notify(
        "error",
        "Project budget exceeded",
        `Project ${projectID} reached ${formatCost(total)} of ${formatCost(limit)}.`,
      )
      return true
    }
    if (limits.warning <= 0) return false
    if (total >= warnAt && !warnings.has(warnKey(ProjectPrefix, projectID))) {
      warnings.add(warnKey(ProjectPrefix, projectID))
      db!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [warnKey(ProjectPrefix, projectID)])
      await notify(
        "warning",
        "Project budget warning",
        `Project ${projectID} reached ${formatCost(total)} of ${formatCost(limit)}.`,
      )
    }
    return false
  }

  async function checkPeriod(prefix: string, limit: number, time: number): Promise<boolean> {
    const range = periodRange(prefix, time)
    const total =
      (
        db!
          .query("SELECT COALESCE(SUM(cost), 0) AS value FROM messages WHERE time >= ? AND time < ?")
          .get(range.start, range.end) as { value: number }
      )?.value ?? 0
    const warnAt = limit * limits.warning
    const suffix = `${projectID}:${periodID(prefix, time)}`
    if (total >= limit && !warnings.has(limitKey(prefix, suffix))) {
      warnings.add(limitKey(prefix, suffix))
      db!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [limitKey(prefix, suffix)])
      await notify(
        "error",
        `${prefix} budget exceeded`,
        `Project ${projectID} reached ${formatCost(total)} of ${formatCost(limit)} ${prefix}.`,
      )
      return true
    }
    if (limits.warning <= 0) return false
    if (total >= warnAt && !warnings.has(warnKey(prefix, suffix))) {
      warnings.add(warnKey(prefix, suffix))
      db!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [warnKey(prefix, suffix)])
      await notify(
        "warning",
        `${prefix} budget warning`,
        `Project ${projectID} reached ${formatCost(total)} of ${formatCost(limit)} ${prefix}.`,
      )
    }
    return false
  }

  async function checkSystem(subPrefix: string, limit: number, time: number): Promise<boolean> {
    const warnAt = limit * limits.warning
    let total: number
    let suffix: string
    if (subPrefix === "") {
      // all-time system total
      total =
        (globalDb!.query("SELECT COALESCE(SUM(cost), 0) AS value FROM messages").get() as { value: number })?.value ?? 0
      suffix = "all"
    } else {
      const range = periodRange(subPrefix, time)
      total =
        (
          globalDb!
            .query("SELECT COALESCE(SUM(cost), 0) AS value FROM messages WHERE time >= ? AND time < ?")
            .get(range.start, range.end) as { value: number }
        )?.value ?? 0
      suffix = periodID(subPrefix, time)
    }
    const fullPrefix = subPrefix ? `${SystemPrefix}:${subPrefix}` : SystemPrefix
    if (total >= limit && !warnings.has(limitKey(fullPrefix, suffix))) {
      warnings.add(limitKey(fullPrefix, suffix))
      globalDb!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [limitKey(fullPrefix, suffix)])
      await notify(
        "error",
        `System${subPrefix ? ` ${subPrefix}` : ""} budget exceeded`,
        `System reached ${formatCost(total)} of ${formatCost(limit)}${subPrefix ? ` ${subPrefix}` : ""}.`,
      )
      return true
    }
    if (limits.warning <= 0) return false
    if (total >= warnAt && !warnings.has(warnKey(fullPrefix, suffix))) {
      warnings.add(warnKey(fullPrefix, suffix))
      globalDb!.run("INSERT OR IGNORE INTO warnings (key) VALUES (?)", [warnKey(fullPrefix, suffix)])
      await notify(
        "warning",
        `System${subPrefix ? ` ${subPrefix}` : ""} budget warning`,
        `System reached ${formatCost(total)} of ${formatCost(limit)}${subPrefix ? ` ${subPrefix}` : ""}.`,
      )
    }
    return false
  }

  function updateTotal(id: string, delta: number) {
    db!.run(
      "INSERT INTO totals (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value",
      [id, delta],
    )
  }

  function getTotal(id: string) {
    const row = db!.query("SELECT value FROM totals WHERE key = ?").get(id) as { value: number } | undefined
    return row?.value ?? 0
  }

  return {
    event: async ({ event }: { event: Event }) => {
      if (event.type === "session.created") {
        const sessionID = event.properties.info.id
        db?.run("INSERT OR IGNORE INTO totals (key, value) VALUES (?, 0)", [totalKey(SessionPrefix, sessionID)])
        return
      }
      if (event.type === "session.deleted") {
        const sessionID = event.properties.info.id
        db?.run("DELETE FROM totals WHERE key = ?", [totalKey(SessionPrefix, sessionID)])
        db?.run("DELETE FROM messages WHERE session_id = ?", [sessionID])
        db?.run("DELETE FROM warnings WHERE key IN (?, ?)", [
          warnKey(SessionPrefix, sessionID),
          limitKey(SessionPrefix, sessionID),
        ])
        warnings.delete(warnKey(SessionPrefix, sessionID))
        warnings.delete(limitKey(SessionPrefix, sessionID))
        if (db) {
          const total = db.query("SELECT COALESCE(SUM(cost), 0) AS value FROM messages").get() as { value: number }
          db.run(
            "INSERT INTO totals (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [totalKey(ProjectPrefix, projectID), total.value],
          )
        }
        return
      }
      if (event.type !== "message.updated") return
      if (!isAssistant(event.properties.info)) return

      const message = event.properties.info
      const sessionID = message.sessionID
      const time = message.time?.created ?? Date.now()

      if (db) {
        const row = db.query("SELECT cost FROM messages WHERE id = ?").get(message.id) as { cost: number } | undefined
        const previous = row?.cost ?? 0
        const delta = message.cost - previous
        if (delta <= 0) return

        db.run(
          "INSERT INTO messages (id, session_id, cost, time) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET cost = excluded.cost, session_id = excluded.session_id, time = excluded.time",
          [message.id, sessionID, message.cost, time],
        )
        updateTotal(totalKey(SessionPrefix, sessionID), delta)
        updateTotal(totalKey(ProjectPrefix, projectID), delta)

        const hitLimits: string[] = []

        if (limits.session) {
          if (await checkSession(sessionID, getTotal(totalKey(SessionPrefix, sessionID)), limits.session)) {
            hitLimits.push("session")
          }
        }
        if (limits.project) {
          if (await checkProject(getTotal(totalKey(ProjectPrefix, projectID)), limits.project)) {
            hitLimits.push("project")
          }
        }
        if (limits.daily) {
          if (await checkPeriod(DailyPrefix, limits.daily, time)) {
            hitLimits.push("daily")
          }
        }
        if (limits.weekly) {
          if (await checkPeriod(WeeklyPrefix, limits.weekly, time)) {
            hitLimits.push("weekly")
          }
        }
        if (limits.monthly) {
          if (await checkPeriod(MonthlyPrefix, limits.monthly, time)) {
            hitLimits.push("monthly")
          }
        }

        if (limits.hard && hitLimits.length > 0) {
          blocked = `Cost limit exceeded (${hitLimits.join(", ")}). Spending has been halted.`
        }
      }

      if (globalDb) {
        // Upsert into global DB regardless of per-project delta (use message.cost as source of truth)
        const globalRow = globalDb
          .query("SELECT cost FROM messages WHERE id = ? AND project_id = ?")
          .get(message.id, projectID) as { cost: number } | undefined
        const globalPrevious = globalRow?.cost ?? 0
        const globalDelta = message.cost - globalPrevious
        if (globalDelta > 0) {
          globalDb.run(
            "INSERT INTO messages (id, project_id, session_id, cost, time) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id, project_id) DO UPDATE SET cost = excluded.cost, session_id = excluded.session_id, time = excluded.time",
            [message.id, projectID, sessionID, message.cost, time],
          )

          const systemHits: string[] = []
          if (limits.system) {
            if (await checkSystem("", limits.system, time)) systemHits.push("system")
          }
          if (limits.systemDaily) {
            if (await checkSystem(DailyPrefix, limits.systemDaily, time)) systemHits.push("system daily")
          }
          if (limits.systemWeekly) {
            if (await checkSystem(WeeklyPrefix, limits.systemWeekly, time)) systemHits.push("system weekly")
          }
          if (limits.systemMonthly) {
            if (await checkSystem(MonthlyPrefix, limits.systemMonthly, time)) systemHits.push("system monthly")
          }

          if (limits.hard && systemHits.length > 0) {
            blocked = `Cost limit exceeded (${systemHits.join(", ")}). Spending has been halted.`
          }
        }
      }
    },
    "tool.execute.before": async () => {
      if (blocked) throw new Error(blocked)
      if (globalDb) {
        const systemBlocked = globalDb.query("SELECT key FROM warnings WHERE key LIKE 'system:%:limit'").get()
        if (systemBlocked) throw new Error("Cost limit exceeded (system). Spending has been halted.")
      }
    },
  }
}
