/**
 * pi-skill-toggle
 *
 * Extension to enable/disable skills from loading into pi context.
 * Usage: /skills - Opens the skill toggle UI
 *
 * Disabled skills are persisted via settings.json using the -path pattern.
 * Changes take effect on next pi restart (or /reload).
 *
 * Matches pi's deduplication behavior: first skill with a given name wins.
 * When a skill has duplicates (same name, different paths), disabling it
 * disables ALL paths to ensure the skill is fully disabled.
 *
 * Inspired by pi-skill-palette.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type DisableMode = "enabled" | "hidden" | "disabled";

interface SkillInfo {
  name: string;
  description: string;
  filePath: string; // Primary path (first found, shown to user)
  allPaths: string[]; // All paths with this name (for disabling all)
  pathInfos: SkillPathInfo[];
  mode: DisableMode;
  disableModelInvocation: boolean; // True if frontmatter has disable-model-invocation: true
  hasDuplicates: boolean; // True if multiple paths share this name
  supportsHidden: boolean; // False for package skills (full disable/enable only)
}

interface SkillToggleResult {
  action: "toggle" | "cancel" | "apply";
  changes: Map<string, DisableMode>; // skill name -> new mode
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme
// ═══════════════════════════════════════════════════════════════════════════

interface ToggleTheme {
  border: string;
  title: string;
  enabled: string;
  hidden: string;
  disabled: string;
  selected: string;
  selectedText: string;
  searchIcon: string;
  placeholder: string;
  description: string;
  hint: string;
  changed: string;
  duplicate: string;
}

const DEFAULT_THEME: ToggleTheme = {
  border: "2", // dim
  title: "2", // dim
  enabled: "32", // green
  hidden: "33", // yellow
  disabled: "31", // red
  selected: "36", // cyan
  selectedText: "36", // cyan
  searchIcon: "2", // dim
  placeholder: "2;3", // dim italic
  description: "2", // dim
  hint: "2", // dim
  changed: "33", // yellow
  duplicate: "35", // magenta
};

function loadTheme(): ToggleTheme {
  const configPath = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "skill-toggle",
    "theme.json",
  );
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const custom = JSON.parse(content) as Partial<ToggleTheme>;
      return { ...DEFAULT_THEME, ...custom };
    }
  } catch {
    // Ignore errors, use default
  }
  return DEFAULT_THEME;
}

function fg(code: string, text: string): string {
  if (!code) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

const toggleTheme = loadTheme();

// ═══════════════════════════════════════════════════════════════════════════
// Settings Management
// ═══════════════════════════════════════════════════════════════════════════

const AGENT_DIR = path.join(os.homedir(), ".pi", "agent");
const PROJECT_DIR = process.cwd();
const PROJECT_PI_DIR = path.join(PROJECT_DIR, ".pi");
const USER_SETTINGS_PATH = path.join(AGENT_DIR, "settings.json");
const PROJECT_SETTINGS_PATH = path.join(PROJECT_PI_DIR, "settings.json");

type SettingsScope = "user" | "project";

type PackageEntry =
  | string
  | {
      source: string;
      extensions?: string[];
      skills?: string[];
      prompts?: string[];
      themes?: string[];
      [key: string]: unknown;
    };

interface Settings {
  skills?: string[];
  packages?: PackageEntry[];
  [key: string]: unknown;
}

interface ScopedSettings {
  scope: SettingsScope;
  path: string;
  baseDir: string;
  settings: Settings;
  originalSerialized: string;
}

type SkillPathSource =
  | {
      kind: "top-level";
      scope: SettingsScope;
      baseDir: string;
      external: boolean;
    }
  | {
      kind: "package";
      scope: SettingsScope;
      source: string;
      packageRoot: string;
      pattern: string;
    };

interface SkillPathInfo {
  filePath: string;
  realPath: string;
  source: SkillPathSource;
}

function loadSettingsFile(settingsPath: string): Settings {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch {
    // Ignore
  }
  return {};
}

function saveSettingsFile(settingsPath: string, settings: Settings): void {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function loadScopedSettings(): ScopedSettings[] {
  const userSettings = loadSettingsFile(USER_SETTINGS_PATH);
  const projectSettings = loadSettingsFile(PROJECT_SETTINGS_PATH);
  return [
    {
      scope: "user",
      path: USER_SETTINGS_PATH,
      baseDir: AGENT_DIR,
      settings: userSettings,
      originalSerialized: JSON.stringify(userSettings),
    },
    {
      scope: "project",
      path: PROJECT_SETTINGS_PATH,
      baseDir: PROJECT_PI_DIR,
      settings: projectSettings,
      originalSerialized: JSON.stringify(projectSettings),
    },
  ];
}

function scopedSettingsByScope(scopes: ScopedSettings[]): Map<SettingsScope, ScopedSettings> {
  return new Map(scopes.map((entry) => [entry.scope, entry]));
}

function normalizePath(p: string): string {
  const trimmed = p.trim();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/"))
    return path.join(os.homedir(), trimmed.slice(2));
  if (trimmed.startsWith("~")) return path.join(os.homedir(), trimmed.slice(1));
  return path.resolve(trimmed);
}

function resolveSettingsPath(entryPath: string, baseDir: string): string {
  if (path.isAbsolute(entryPath)) return path.normalize(entryPath);
  if (entryPath.startsWith("~")) return path.normalize(normalizePath(entryPath));
  return path.normalize(path.join(baseDir, entryPath));
}

function isSameOrChild(candidate: string, parent: string): boolean {
  const normalizedCandidate = path.normalize(candidate);
  const normalizedParent = path.normalize(parent);
  return (
    normalizedCandidate === normalizedParent ||
    normalizedCandidate.startsWith(normalizedParent + path.sep)
  );
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

function stripPatternPrefix(pattern: string): string {
  return pattern.startsWith("!") || pattern.startsWith("+") || pattern.startsWith("-")
    ? pattern.slice(1)
    : pattern;
}

function hasGlobPattern(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?");
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function matchesPatternValue(value: string, pattern: string): boolean {
  const normalizedValue = toPosixPath(value);
  const normalizedPattern = toPosixPath(pattern).replace(/^\.\//, "");
  if (hasGlobPattern(normalizedPattern)) {
    return globToRegExp(normalizedPattern).test(normalizedValue);
  }
  return normalizedValue === normalizedPattern;
}

function skillPatternCandidates(filePath: string, baseDir: string): string[] {
  const rel = toPosixPath(path.relative(baseDir, filePath));
  const name = path.basename(filePath);
  const filePathPosix = toPosixPath(path.normalize(filePath));
  const candidates = [rel, name, filePathPosix];

  if (name === "SKILL.md") {
    const parentDir = path.dirname(filePath);
    candidates.push(
      toPosixPath(path.relative(baseDir, parentDir)),
      path.basename(parentDir),
      toPosixPath(path.normalize(parentDir)),
    );
  }

  return candidates.filter(Boolean);
}

function matchesAnyPattern(filePath: string, patterns: string[], baseDir: string): boolean {
  const candidates = skillPatternCandidates(filePath, baseDir);
  return patterns.some((pattern) =>
    candidates.some((candidate) => matchesPatternValue(candidate, pattern)),
  );
}

function matchesAnyExactPattern(filePath: string, patterns: string[], baseDir: string): boolean {
  const candidates = skillPatternCandidates(filePath, baseDir);
  return patterns.some((pattern) => {
    const normalizedPattern = toPosixPath(pattern).replace(/^\.\//, "");
    return candidates.some((candidate) => toPosixPath(candidate) === normalizedPattern);
  });
}

function applyPatterns(allPaths: string[], patterns: string[], baseDir: string): Set<string> {
  const includes: string[] = [];
  const excludes: string[] = [];
  const forceIncludes: string[] = [];
  const forceExcludes: string[] = [];

  for (const pattern of patterns) {
    if (pattern.startsWith("+")) forceIncludes.push(pattern.slice(1));
    else if (pattern.startsWith("-")) forceExcludes.push(pattern.slice(1));
    else if (pattern.startsWith("!")) excludes.push(pattern.slice(1));
    else includes.push(pattern);
  }

  let result =
    includes.length === 0
      ? [...allPaths]
      : allPaths.filter((filePath) => matchesAnyPattern(filePath, includes, baseDir));

  if (excludes.length > 0) {
    result = result.filter((filePath) => !matchesAnyPattern(filePath, excludes, baseDir));
  }

  for (const filePath of allPaths) {
    if (!result.includes(filePath) && matchesAnyExactPattern(filePath, forceIncludes, baseDir)) {
      result.push(filePath);
    }
  }

  if (forceExcludes.length > 0) {
    result = result.filter(
      (filePath) => !matchesAnyExactPattern(filePath, forceExcludes, baseDir),
    );
  }

  return new Set(result);
}

function topLevelDisableMatches(
  entry: string,
  source: Extract<SkillPathSource, { kind: "top-level" }>,
  filePath: string,
): boolean {
  if (!entry.startsWith("-")) return false;
  const rawPath = entry.slice(1);
  const entryPath = resolveSettingsPath(rawPath, source.baseDir);
  const skillDir = path.dirname(filePath);
  return entryPath === path.normalize(filePath) || entryPath === path.normalize(skillDir);
}

function isTopLevelSkillDisabled(
  filePath: string,
  source: Extract<SkillPathSource, { kind: "top-level" }>,
  scopedSettings: Map<SettingsScope, ScopedSettings>,
): boolean {
  const scoped = scopedSettings.get(source.scope);
  const skills = scoped?.settings.skills ?? [];
  return skills.some((entry) =>
    typeof entry === "string" && topLevelDisableMatches(entry, source, filePath),
  );
}

function isPackageSkillDisabled(
  filePath: string,
  source: Extract<SkillPathSource, { kind: "package" }>,
  scopedSettings: Map<SettingsScope, ScopedSettings>,
): boolean {
  const pkg = findPackageEntry(scopedSettings.get(source.scope)?.settings, source.source);
  if (!pkg || typeof pkg === "string") return false;
  const filters = pkg.skills;
  if (filters === undefined) return false;
  if (filters.length === 0) return true;
  const enabled = applyPatterns([filePath], filters, source.packageRoot);
  return !enabled.has(filePath);
}

function isSkillPathDisabled(
  info: SkillPathInfo,
  scopedSettings: Map<SettingsScope, ScopedSettings>,
): boolean {
  if (info.source.kind === "package") {
    return isPackageSkillDisabled(info.filePath, info.source, scopedSettings);
  }
  return isTopLevelSkillDisabled(info.filePath, info.source, scopedSettings);
}

function relativePattern(baseDir: string, filePath: string): string {
  return toPosixPath(path.relative(baseDir, filePath));
}

function packageSkillPattern(packageRoot: string, skillFilePath: string): string {
  if (path.basename(skillFilePath) === "SKILL.md") {
    return relativePattern(packageRoot, path.dirname(skillFilePath));
  }
  return relativePattern(packageRoot, skillFilePath);
}

function topLevelSkillPattern(info: SkillPathInfo): string {
  if (info.source.kind !== "top-level" || info.source.external) {
    return path.dirname(info.filePath);
  }
  return relativePattern(info.source.baseDir, path.dirname(info.filePath));
}

function findPackageEntry(settings: Settings | undefined, source: string): PackageEntry | undefined {
  return (settings?.packages ?? []).find((pkg) =>
    typeof pkg === "string" ? pkg === source : pkg.source === source,
  );
}

function packageSourceString(pkg: PackageEntry): string {
  return typeof pkg === "string" ? pkg : pkg.source;
}

function parseNpmName(spec: string): string {
  const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
  return match?.[1] ?? spec;
}

function packageIdentity(source: string, scope: SettingsScope, baseDir: string): string {
  if (source.startsWith("npm:")) {
    return `npm:${parseNpmName(source.slice("npm:".length).trim())}`;
  }

  const git = parseGitSource(source);
  if (git) return `git:${git.host}/${git.repoPath}`;

  return `local:${resolveSettingsPath(source, baseDir)}`;
}

interface ConfiguredPackage {
  entry: PackageEntry;
  source: string;
  scope: SettingsScope;
  baseDir: string;
  packageRoot: string;
}

function getConfiguredPackages(scopes: ScopedSettings[]): ConfiguredPackage[] {
  const candidates: ConfiguredPackage[] = [];

  for (const scoped of scopes) {
    for (const entry of scoped.settings.packages ?? []) {
      const source = packageSourceString(entry);
      const packageRoot = resolvePackageRoot(source, scoped.scope, scoped.baseDir);
      if (!packageRoot || !fs.existsSync(packageRoot)) continue;
      candidates.push({ entry, source, scope: scoped.scope, baseDir: scoped.baseDir, packageRoot });
    }
  }

  const byIdentity = new Map<string, ConfiguredPackage>();
  for (const pkg of candidates) {
    const identity = packageIdentity(pkg.source, pkg.scope, pkg.baseDir);
    const existing = byIdentity.get(identity);
    if (!existing || (pkg.scope === "project" && existing.scope === "user")) {
      byIdentity.set(identity, pkg);
    }
  }

  return Array.from(byIdentity.values());
}

function resolvePackageRoot(
  source: string,
  scope: SettingsScope,
  settingsBaseDir: string,
): string | undefined {
  if (source.startsWith("npm:")) {
    const name = parseNpmName(source.slice("npm:".length).trim());
    const base = scope === "project" ? PROJECT_PI_DIR : AGENT_DIR;
    return path.join(base, "npm", "node_modules", name);
  }

  const git = parseGitSource(source);
  if (git) {
    const base = scope === "project" ? PROJECT_PI_DIR : AGENT_DIR;
    return path.join(base, "git", git.host, git.repoPath);
  }

  return resolveSettingsPath(source, settingsBaseDir);
}

function parseGitSource(source: string): { host: string; repoPath: string } | undefined {
  let raw = source;
  if (raw.startsWith("git:")) raw = raw.slice("git:".length);

  raw = raw.replace(/\.git(?=@|$)/, "");

  const sshMatch = raw.match(/^git@([^:]+):(.+?)(?:@[^/]+)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], repoPath: stripGitRef(sshMatch[2]) };
  }

  const protocolMatch = raw.match(/^(?:https?|ssh|git):\/\/([^/]+)\/(.+)$/);
  if (protocolMatch) {
    return { host: protocolMatch[1], repoPath: stripGitRef(protocolMatch[2]) };
  }

  const shorthandMatch = raw.match(/^([^/]+\.[^/]+)\/(.+)$/);
  if (source.startsWith("git:") && shorthandMatch) {
    return { host: shorthandMatch[1], repoPath: stripGitRef(shorthandMatch[2]) };
  }

  return undefined;
}

function stripGitRef(repoPath: string): string {
  const cleaned = repoPath.replace(/\.git$/, "");
  const atIndex = cleaned.lastIndexOf("@");
  return atIndex > 0 ? cleaned.slice(0, atIndex) : cleaned;
}

function updateTopLevelSettings(
  info: SkillPathInfo,
  newMode: DisableMode,
  scoped: ScopedSettings,
): void {
  if (info.source.kind !== "top-level") return;

  const current = scoped.settings.skills ?? [];
  const pattern = topLevelSkillPattern(info);
  const updated = current.filter(
    (entry) =>
      typeof entry !== "string" ||
      !topLevelDisableMatches(entry, info.source as Extract<SkillPathSource, { kind: "top-level" }>, info.filePath),
  );

  if (newMode === "disabled") {
    updated.push(`-${pattern}`);
  }

  scoped.settings.skills = updated;
}

function updatePackageSettings(
  info: SkillPathInfo,
  newMode: DisableMode,
  scoped: ScopedSettings,
): void {
  if (info.source.kind !== "package") return;

  const packages = [...(scoped.settings.packages ?? [])];
  const index = packages.findIndex((pkg) => packageSourceString(pkg) === info.source.source);
  if (index === -1) return;

  let pkg = packages[index];
  if (typeof pkg === "string") {
    pkg = { source: pkg };
    packages[index] = pkg;
  }

  const current = pkg.skills ?? [];
  const pattern = info.source.pattern;
  const updated = current.filter((entry) => stripPatternPrefix(entry) !== pattern);

  if (newMode === "disabled") {
    updated.push(`-${pattern}`);
  } else if (pkg.skills !== undefined) {
    if (current.length === 0) {
      updated.push(pattern);
    } else {
      const enabledByUpdated =
        updated.length === 0 || applyPatterns([info.filePath], updated, info.source.packageRoot).has(info.filePath);
      if (!enabledByUpdated) updated.push(pattern);
    }
  }

  if (updated.length > 0) {
    pkg.skills = updated;
  } else {
    delete pkg.skills;
  }

  const onlySource = Object.keys(pkg).length === 1 && pkg.source === info.source.source;
  if (onlySource) {
    packages[index] = pkg.source;
  }

  scoped.settings.packages = packages;
}

/**
 * Update settings/frontmatter to reflect enabled/hidden/disabled changes.
 * Package skills only support full disable/enable via package filters.
 */
function applyChanges(
  changes: Map<string, DisableMode>,
  skillsByName: Map<string, SkillInfo>,
): void {
  const scopes = loadScopedSettings();
  const scopeMap = scopedSettingsByScope(scopes);
  const skillsToHide: SkillInfo[] = [];
  const skillsToUnhide: SkillInfo[] = [];

  for (const [skillName, requestedMode] of changes) {
    const skill = skillsByName.get(skillName);
    if (!skill) continue;

    const newMode = skill.supportsHidden ? requestedMode : requestedMode === "disabled" ? "disabled" : "enabled";

    for (const info of skill.pathInfos) {
      const scoped = scopeMap.get(info.source.scope);
      if (!scoped) continue;

      if (info.source.kind === "package") {
        updatePackageSettings(info, newMode, scoped);
      } else {
        updateTopLevelSettings(info, newMode, scoped);
      }
    }

    if (skill.supportsHidden && newMode === "hidden") {
      skillsToHide.push(skill);
    } else if (skill.supportsHidden && newMode === "enabled") {
      skillsToUnhide.push(skill);
    }
  }

  for (const scoped of scopes) {
    if (JSON.stringify(scoped.settings) !== scoped.originalSerialized) {
      saveSettingsFile(scoped.path, scoped.settings);
    }
  }

  for (const skill of skillsToHide) {
    try {
      updateSkillFrontmatter(skill.filePath, true);
    } catch (error) {
      console.error(`Failed to update frontmatter for ${skill.name}: ${error}`);
    }
  }

  for (const skill of skillsToUnhide) {
    try {
      updateSkillFrontmatter(skill.filePath, false);
    } catch (error) {
      console.error(`Failed to update frontmatter for ${skill.name}: ${error}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Skill Discovery
// ═══════════════════════════════════════════════════════════════════════════

type SkillFormat = "recursive" | "claude";

interface SkillDirConfig {
  dir: string;
  format: SkillFormat;
  source: SkillPathSource;
}

interface RawSkill {
  name: string;
  description: string;
  filePath: string;
  realPath: string;
  disableModelInvocation: boolean;
  pathInfo: SkillPathInfo;
}

/**
 * Scan a directory for skills (raw, before deduplication)
 */
function scanSkillDir(
  dir: string,
  format: SkillFormat,
  skills: RawSkill[],
  visitedRealPaths: Set<string>,
  source: SkillPathSource,
  visitedDirs?: Set<string>,
): void {
  if (!fs.existsSync(dir)) return;

  const visited = visitedDirs ?? new Set<string>();
  let realDir: string;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    realDir = dir;
  }
  if (visited.has(realDir)) return;
  visited.add(realDir);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;

      const entryPath = path.join(dir, entry.name);

      let isDirectory = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try {
          const stats = fs.statSync(entryPath);
          isDirectory = stats.isDirectory();
          isFile = stats.isFile();
        } catch {
          continue;
        }
      }

      if (format === "recursive") {
        if (isDirectory) {
          scanSkillDir(entryPath, format, skills, visitedRealPaths, source, visited);
        } else if (isFile && entry.name === "SKILL.md") {
          loadRawSkill(entryPath, skills, visitedRealPaths, source);
        }
      } else if (format === "claude") {
        if (!isDirectory) continue;
        const skillFile = path.join(entryPath, "SKILL.md");
        if (!fs.existsSync(skillFile)) continue;
        loadRawSkill(skillFile, skills, visitedRealPaths, source);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

function loadRawSkill(
  filePath: string,
  skills: RawSkill[],
  visitedRealPaths: Set<string>,
  source: SkillPathSource,
): void {
  try {
    let realPath: string;
    try {
      realPath = fs.realpathSync(filePath);
    } catch {
      realPath = filePath;
    }

    if (visitedRealPaths.has(realPath)) return;
    visitedRealPaths.add(realPath);

    const content = fs.readFileSync(filePath, "utf-8");
    const skillDir = path.dirname(filePath);
    const parentDirName = path.basename(skillDir);
    const { name, description, disableModelInvocation } = parseFrontmatter(
      content,
      parentDirName,
    );

    if (!description) return;

    const pathInfo: SkillPathInfo = { filePath, realPath, source };
    skills.push({
      name,
      description,
      filePath,
      realPath,
      disableModelInvocation,
      pathInfo,
    });
  } catch {
    // Skip invalid skill files
  }
}

function collectSkillFiles(dir: string, files: string[], visitedDirs?: Set<string>): void {
  if (!fs.existsSync(dir)) return;

  const visited = visitedDirs ?? new Set<string>();
  let realDir: string;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    realDir = dir;
  }
  if (visited.has(realDir)) return;
  visited.add(realDir);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      const entryPath = path.join(dir, entry.name);
      let isDirectory = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try {
          const stats = fs.statSync(entryPath);
          isDirectory = stats.isDirectory();
          isFile = stats.isFile();
        } catch {
          continue;
        }
      }
      if (isDirectory) collectSkillFiles(entryPath, files, visited);
      else if (isFile && entry.name === "SKILL.md") files.push(entryPath);
    }
  } catch {
    // Skip inaccessible directories
  }
}

function collectSkillFilesFromPath(entryPath: string): string[] {
  if (!fs.existsSync(entryPath)) return [];
  try {
    const stats = fs.statSync(entryPath);
    if (stats.isFile()) return path.basename(entryPath) === "SKILL.md" ? [entryPath] : [];
    if (stats.isDirectory()) {
      const files: string[] = [];
      collectSkillFiles(entryPath, files);
      return files;
    }
  } catch {
    // Ignore
  }
  return [];
}

function expandSimpleGlob(pattern: string): string[] {
  if (!hasGlobPattern(pattern)) return fs.existsSync(pattern) ? [pattern] : [];

  const normalized = path.normalize(pattern);
  const parts = normalized.split(path.sep);
  const firstGlob = parts.findIndex((part) => hasGlobPattern(part));
  const root = firstGlob <= 0 ? path.sep : parts.slice(0, firstGlob).join(path.sep);
  const matcher = globToRegExp(toPosixPath(normalized));
  const matches: string[] = [];

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        if (entry.name === "node_modules") continue;
        const fullPath = path.join(dir, entry.name);
        const normalizedFullPath = toPosixPath(path.normalize(fullPath));
        if (matcher.test(normalizedFullPath)) matches.push(fullPath);
        if (entry.isDirectory()) walk(fullPath);
      }
    } catch {
      // Ignore
    }
  };

  walk(root || path.sep);
  return matches;
}

function readPiSkillsManifest(packageRoot: string): string[] | undefined {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const skills = pkg?.pi?.skills;
    return Array.isArray(skills) ? skills.filter((entry) => typeof entry === "string") : undefined;
  } catch {
    return undefined;
  }
}

function collectPackageSkillFiles(packageRoot: string): string[] {
  const manifestSkills = readPiSkillsManifest(packageRoot);
  if (manifestSkills !== undefined) {
    if (manifestSkills.length === 0) return [];
    const sourceEntries = manifestSkills.filter((entry) => !["!", "+", "-"].includes(entry[0]));
    const paths = sourceEntries.flatMap((entry) =>
      expandSimpleGlob(path.resolve(packageRoot, entry)).flatMap(collectSkillFilesFromPath),
    );
    const manifestOverrides = manifestSkills.filter((entry) => ["!", "+", "-"].includes(entry[0]));
    return Array.from(applyPatterns(paths, manifestOverrides, packageRoot));
  }

  return collectSkillFilesFromPath(path.join(packageRoot, "skills"));
}

function scanPackageSkills(
  pkg: ConfiguredPackage,
  rawSkills: RawSkill[],
  visitedRealPaths: Set<string>,
): void {
  for (const filePath of collectPackageSkillFiles(pkg.packageRoot)) {
    const source: SkillPathSource = {
      kind: "package",
      scope: pkg.scope,
      source: pkg.source,
      packageRoot: pkg.packageRoot,
      pattern: packageSkillPattern(pkg.packageRoot, filePath),
    };
    loadRawSkill(filePath, rawSkills, visitedRealPaths, source);
  }
}

function parseFrontmatter(
  content: string,
  fallbackName: string,
): { name: string; description: string; disableModelInvocation: boolean } {
  if (!content.startsWith("---")) {
    return {
      name: fallbackName,
      description: "",
      disableModelInvocation: false,
    };
  }

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return {
      name: fallbackName,
      description: "",
      disableModelInvocation: false,
    };
  }

  const frontmatter = content.slice(4, endIndex);
  let name = fallbackName;
  let description = "";
  let disableModelInvocation = false;

  for (const line of frontmatter.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === "name") name = value;
    if (key === "description") description = value;
    if (key === "disable-model-invocation") {
      disableModelInvocation = value.toLowerCase() === "true";
    }
  }

  return { name, description, disableModelInvocation };
}

/**
 * Set or update a frontmatter field in a SKILL.md file.
 * Creates frontmatter block if it doesn't exist.
 */
function setFrontmatterField(
  content: string,
  key: string,
  value: string,
): string {
  if (!content.startsWith("---")) {
    return `---\n${key}: ${value}\n---\n${content}`;
  }

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return `---\n${key}: ${value}\n---\n${content}`;
  }

  const frontmatter = content.slice(4, endIndex);
  const rest = content.slice(endIndex + 4);
  const lines = frontmatter.split("\n");

  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const colonIndex = lines[i].indexOf(":");
    if (colonIndex === -1) continue;
    const lineKey = lines[i].slice(0, colonIndex).trim();
    if (lineKey === key) {
      lines[i] = `${key}: ${value}`;
      found = true;
      break;
    }
  }

  if (!found) lines.push(`${key}: ${value}`);

  return `---\n${lines.join("\n")}\n---${rest}`;
}

/**
 * Remove a frontmatter field from a SKILL.md file.
 */
function removeFrontmatterField(content: string, key: string): string {
  if (!content.startsWith("---")) return content;

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return content;

  const frontmatter = content.slice(4, endIndex);
  const rest = content.slice(endIndex + 4);
  const lines = frontmatter.split("\n");

  const filteredLines = lines.filter((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) return true;
    const lineKey = line.slice(0, colonIndex).trim();
    return lineKey !== key;
  });

  return `---\n${filteredLines.join("\n")}\n---${rest}`;
}

/**
 * Update a SKILL.md file's disable-model-invocation field.
 * Creates backup before modifying.
 */
function updateSkillFrontmatter(
  filePath: string,
  disableModelInvocation: boolean,
): void {
  const content = fs.readFileSync(filePath, "utf-8");

  const backupPath = filePath + ".bak";
  fs.writeFileSync(backupPath, content);

  const newContent = disableModelInvocation
    ? setFrontmatterField(content, "disable-model-invocation", "true")
    : removeFrontmatterField(content, "disable-model-invocation");

  fs.writeFileSync(filePath, newContent);

  try {
    fs.unlinkSync(backupPath);
  } catch {
    // Ignore
  }
}

function configuredSkillDirs(scopes: ScopedSettings[]): SkillDirConfig[] {
  const dirs: SkillDirConfig[] = [
    {
      dir: path.join(os.homedir(), ".codex", "skills"),
      format: "recursive",
      source: { kind: "top-level", scope: "user", baseDir: path.join(os.homedir(), ".codex"), external: true },
    },
    {
      dir: path.join(os.homedir(), ".claude", "skills"),
      format: "claude",
      source: { kind: "top-level", scope: "user", baseDir: path.join(os.homedir(), ".claude"), external: true },
    },
    {
      dir: path.join(process.cwd(), ".claude", "skills"),
      format: "claude",
      source: { kind: "top-level", scope: "project", baseDir: path.join(process.cwd(), ".claude"), external: true },
    },
    {
      dir: path.join(AGENT_DIR, "skills"),
      format: "recursive",
      source: { kind: "top-level", scope: "user", baseDir: AGENT_DIR, external: false },
    },
    {
      dir: path.join(os.homedir(), ".pi", "skills"),
      format: "recursive",
      source: { kind: "top-level", scope: "user", baseDir: path.join(os.homedir(), ".pi"), external: true },
    },
    {
      dir: path.join(PROJECT_PI_DIR, "skills"),
      format: "recursive",
      source: { kind: "top-level", scope: "project", baseDir: PROJECT_PI_DIR, external: false },
    },
    {
      dir: path.join(os.homedir(), ".agents", "skills"),
      format: "recursive",
      source: { kind: "top-level", scope: "user", baseDir: path.join(os.homedir(), ".agents"), external: false },
    },
  ];

  for (const scoped of scopes) {
    for (const entry of scoped.settings.skills ?? []) {
      if (typeof entry !== "string" || entry.startsWith("-") || entry.startsWith("!")) continue;
      const rawPath = entry.startsWith("+") ? entry.slice(1) : entry;
      const dir = resolveSettingsPath(rawPath, scoped.baseDir);
      dirs.push({
        dir,
        format: "recursive",
        source: {
          kind: "top-level",
          scope: scoped.scope,
          baseDir: path.dirname(dir),
          external: true,
        },
      });
    }
  }

  return dirs;
}

/**
 * Load all skills from known directories, deduplicating by name (matching pi's behavior)
 */
function loadAllSkills(): {
  skills: SkillInfo[];
  byName: Map<string, SkillInfo>;
} {
  const scopes = loadScopedSettings();
  const scopeMap = scopedSettingsByScope(scopes);
  const rawSkills: RawSkill[] = [];
  const visitedRealPaths = new Set<string>();

  for (const { dir, format, source } of configuredSkillDirs(scopes)) {
    scanSkillDir(dir, format, rawSkills, visitedRealPaths, source);
  }

  for (const pkg of getConfiguredPackages(scopes)) {
    scanPackageSkills(pkg, rawSkills, visitedRealPaths);
  }

  const byName = new Map<string, SkillInfo>();
  const infosByName = new Map<string, SkillPathInfo[]>();

  for (const raw of rawSkills) {
    if (!infosByName.has(raw.name)) infosByName.set(raw.name, []);
    infosByName.get(raw.name)!.push(raw.pathInfo);

    if (!byName.has(raw.name)) {
      byName.set(raw.name, {
        name: raw.name,
        description: raw.description,
        filePath: raw.filePath,
        allPaths: [],
        pathInfos: [],
        mode: "enabled",
        disableModelInvocation: raw.disableModelInvocation,
        hasDuplicates: false,
        supportsHidden: raw.pathInfo.source.kind !== "package",
      });
    }
  }

  for (const [name, skill] of byName) {
    const pathInfos = infosByName.get(name) ?? [];
    skill.pathInfos = pathInfos;
    skill.allPaths = pathInfos.map((info) => info.filePath);
    skill.hasDuplicates = pathInfos.length > 1;
    skill.supportsHidden = pathInfos.every((info) => info.source.kind !== "package");

    const isDisabled = pathInfos.length > 0 && pathInfos.every((info) => isSkillPathDisabled(info, scopeMap));
    if (isDisabled) {
      skill.mode = "disabled";
    } else if (skill.supportsHidden && skill.disableModelInvocation) {
      skill.mode = "hidden";
    } else {
      skill.mode = "enabled";
    }
  }

  const skills = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return { skills, byName };
}

// ═══════════════════════════════════════════════════════════════════════════
// Fuzzy Filter
// ═══════════════════════════════════════════════════════════════════════════

function fuzzyScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText.includes(lowerQuery)) {
    return 100 + (lowerQuery.length / lowerText.length) * 50;
  }

  let score = 0;
  let queryIndex = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10 + consecutiveBonus;
      consecutiveBonus += 5;
      queryIndex++;
    } else {
      consecutiveBonus = 0;
    }
  }

  return queryIndex === lowerQuery.length ? score : 0;
}

function filterSkills(skills: SkillInfo[], query: string): SkillInfo[] {
  if (!query.trim()) return skills;

  const scored = skills
    .map((skill) => ({
      skill,
      score: Math.max(
        fuzzyScore(query, skill.name),
        fuzzyScore(query, skill.description) * 0.8,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.skill);
}

// ═══════════════════════════════════════════════════════════════════════════
// UI Component
// ═══════════════════════════════════════════════════════════════════════════

class SkillToggleComponent {
  private allSkills: SkillInfo[];
  private filtered: SkillInfo[];
  private selected = 0;
  private query = "";
  private changes = new Map<string, DisableMode>(); // skill NAME -> new mode
  private inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly INACTIVITY_MS = 120000; // 2 minutes

  constructor(
    skills: SkillInfo[],
    private done: (result: SkillToggleResult) => void,
  ) {
    this.allSkills = skills;
    this.filtered = skills;
    this.resetInactivityTimeout();
  }

  private resetInactivityTimeout(): void {
    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
    this.inactivityTimeout = setTimeout(() => {
      this.cleanup();
      this.done({ action: "cancel", changes: new Map() });
    }, SkillToggleComponent.INACTIVITY_MS);
  }

  private getEffectiveMode(skill: SkillInfo): DisableMode {
    if (this.changes.has(skill.name)) {
      return this.changes.get(skill.name)!;
    }
    return skill.mode;
  }

  handleInput(data: string): void {
    this.resetInactivityTimeout();

    if (matchesKey(data, "escape")) {
      this.cleanup();
      this.done({ action: "cancel", changes: new Map() });
      return;
    }

    // Enter/Space toggles hidden for local skills, full disable for package skills
    if (matchesKey(data, "return") || data === " ") {
      const skill = this.filtered[this.selected];
      if (skill) {
        const currentMode = this.getEffectiveMode(skill);
        const originalMode = skill.mode;
        const newMode: DisableMode = skill.supportsHidden
          ? currentMode === "enabled" ? "hidden" : "enabled"
          : currentMode === "disabled" ? "enabled" : "disabled";

        // If toggling back to original state, remove from changes
        if (newMode === originalMode) {
          this.changes.delete(skill.name);
        } else {
          this.changes.set(skill.name, newMode);
        }
      }
      return;
    }

    // 'd' or Ctrl+D toggles full disable (enabled/hidden <-> disabled)
    if (data === "d" || matchesKey(data, "ctrl+d")) {
      const skill = this.filtered[this.selected];
      if (skill) {
        const currentMode = this.getEffectiveMode(skill);
        const originalMode = skill.mode;
        // Toggle: disabled <-> enabled
        const newMode: DisableMode =
          currentMode === "disabled" ? "enabled" : "disabled";

        if (newMode === originalMode) {
          this.changes.delete(skill.name);
        } else {
          this.changes.set(skill.name, newMode);
        }
      }
      return;
    }

    // Ctrl+S to save and exit
    if (matchesKey(data, "ctrl+s")) {
      this.cleanup();
      this.done({ action: "apply", changes: this.changes });
      return;
    }

    if (matchesKey(data, "up")) {
      if (this.filtered.length > 0) {
        this.selected =
          this.selected === 0 ? this.filtered.length - 1 : this.selected - 1;
      }
      return;
    }

    if (matchesKey(data, "down")) {
      if (this.filtered.length > 0) {
        this.selected =
          this.selected === this.filtered.length - 1 ? 0 : this.selected + 1;
      }
      return;
    }

    if (matchesKey(data, "backspace")) {
      if (this.query.length > 0) {
        this.query = this.query.slice(0, -1);
        this.updateFilter();
      }
      return;
    }

    // Printable character
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.query += data;
      this.updateFilter();
    }
  }

  private updateFilter(): void {
    this.filtered = filterSkills(this.allSkills, this.query);
    this.selected = 0;
  }

  render(width: number): string[] {
    const innerW = width - 2;
    const lines: string[] = [];

    const t = toggleTheme;
    const border = (s: string) => fg(t.border, s);
    const title = (s: string) => fg(t.title, s);
    const enabled = (s: string) => fg(t.enabled, s);
    const disabled = (s: string) => fg(t.disabled, s);
    const selected = (s: string) => fg(t.selected, s);
    const selectedText = (s: string) => fg(t.selectedText, s);
    const searchIcon = (s: string) => fg(t.searchIcon, s);
    const placeholder = (s: string) => fg(t.placeholder, s);
    const description = (s: string) => fg(t.description, s);
    const hint = (s: string) => fg(t.hint, s);
    const changed = (s: string) => fg(t.changed, s);
    const duplicate = (s: string) => fg(t.duplicate, s);
    const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
    const italic = (s: string) => `\x1b[3m${s}\x1b[23m`;

    const visLen = visibleWidth;

    const row = (content: string) =>
      border("│") +
      truncateToWidth(" " + content, innerW, "…", true) +
      border("│");
    const emptyRow = () => border("│") + " ".repeat(innerW) + border("│");

    // Count pending changes
    const pendingCount = this.changes.size;
    const enabledCount = this.allSkills.filter(
      (s) => this.getEffectiveMode(s) === "enabled",
    ).length;
    const hiddenCount = this.allSkills.filter(
      (s) => this.getEffectiveMode(s) === "hidden",
    ).length;
    const disabledCount = this.allSkills.filter(
      (s) => this.getEffectiveMode(s) === "disabled",
    ).length;
    const totalCount = this.allSkills.length;

    // Top border with title
    const titleText = ` Skills (${enabledCount} on, ${hiddenCount} hidden, ${disabledCount} off) `;
    const borderLen = innerW - visLen(titleText);
    const leftBorder = Math.floor(borderLen / 2);
    const rightBorder = borderLen - leftBorder;
    lines.push(
      border("╭" + "─".repeat(leftBorder)) +
        title(titleText) +
        border("─".repeat(rightBorder) + "╮"),
    );

    lines.push(emptyRow());

    // Search input
    const cursor = selected("│");
    const searchIconChar = searchIcon("◎");
    const queryDisplay = this.query
      ? `${this.query}${cursor}`
      : `${cursor}${placeholder(italic("type to filter..."))}`;
    lines.push(row(`${searchIconChar}  ${queryDisplay}`));

    lines.push(emptyRow());

    // Pending changes indicator
    if (pendingCount > 0) {
      lines.push(
        row(
          changed(
            `⚠ ${pendingCount} pending change${pendingCount === 1 ? "" : "s"} (Ctrl+S to save)`,
          ),
        ),
      );
      lines.push(emptyRow());
    }

    // Divider
    lines.push(border("├" + "─".repeat(innerW) + "┤"));

    // Skills list
    const maxVisible = 12;
    const startIndex = Math.max(
      0,
      Math.min(
        this.selected - Math.floor(maxVisible / 2),
        this.filtered.length - maxVisible,
      ),
    );
    const endIndex = Math.min(startIndex + maxVisible, this.filtered.length);

    if (this.filtered.length === 0) {
      lines.push(emptyRow());
      lines.push(row(hint(italic("No matching skills"))));
      lines.push(emptyRow());
    } else {
      lines.push(emptyRow());
      for (let i = startIndex; i < endIndex; i++) {
        const skill = this.filtered[i];
        const isSelected = i === this.selected;
        const mode = this.getEffectiveMode(skill);
        const hasChanged = this.changes.has(skill.name);

        // Build the skill line - icons: ● enabled, ◐ hidden, ○ disabled
        const prefix = isSelected ? selected("▸") : border("·");
        let statusIcon: string;
        if (mode === "enabled") {
          statusIcon = enabled("●");
        } else if (mode === "hidden") {
          statusIcon = fg(t.hidden, "◐");
        } else {
          statusIcon = disabled("○");
        }
        const changedMarker = hasChanged ? changed("*") : " ";
        const dupMarker = skill.hasDuplicates ? duplicate("²") : " ";
        const nameStr = isSelected
          ? bold(selectedText(skill.name))
          : skill.name;
        const maxDescLen = Math.max(0, innerW - visLen(skill.name) - 18);
        const descStr =
          maxDescLen > 3
            ? description(truncateToWidth(skill.description, maxDescLen, "…"))
            : "";

        const separator = descStr ? `  ${border("—")}  ` : "";
        const skillLine = `${prefix} ${statusIcon}${changedMarker}${dupMarker}${nameStr}${separator}${descStr}`;
        lines.push(row(skillLine));
      }
      lines.push(emptyRow());

      // Scroll indicator
      if (this.filtered.length > maxVisible) {
        const countStr = `${this.selected + 1}/${this.filtered.length}`;
        lines.push(row(hint(countStr)));
        lines.push(emptyRow());
      }
    }

    // Divider
    lines.push(border("├" + "─".repeat(innerW) + "┤"));

    lines.push(emptyRow());

    // Footer hints
    const baseHints = `${italic("↑↓")} navigate  ${italic("enter/space")} hide/toggle pkg  ${italic("d")} disable  ${italic("ctrl+s")} save  ${italic("esc")} cancel`;
    lines.push(row(hint(baseHints)));

    // Legend for markers
    lines.push(
      row(
        hint(
          `${enabled("●")} on  ${fg(t.hidden, "◐")} hidden (manual only)  ${disabled("○")} disabled  ${duplicate("²")} duplicates`,
        ),
      ),
    );

    // Bottom border
    lines.push(border(`╰${"─".repeat(innerW)}╯`));

    return lines;
  }

  private cleanup(): void {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
  }

  invalidate(): void {}

  dispose(): void {
    this.cleanup();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export default function skillToggleExtension(pi: ExtensionAPI): void {
  // Register the /skills command
  pi.registerCommand("skills-toggle", {
    description: "Toggle skills on/off (changes require restart)",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const { skills, byName } = loadAllSkills();

      if (skills.length === 0) {
        ctx.ui.notify("No skills found", "warning");
        return;
      }

      const result = await ctx.ui.custom<SkillToggleResult>(
        (_tui, _theme, _keybindings, done) =>
          new SkillToggleComponent(skills, (r) => done(r)),
        { overlay: true, overlayOptions: { anchor: "center", width: 80 } },
      );

      if (result.action === "apply" && result.changes.size > 0) {
        try {
          applyChanges(result.changes, byName);

          const enabledCount = Array.from(result.changes.values()).filter(
            (v) => v === "enabled",
          ).length;
          const hiddenCount = Array.from(result.changes.values()).filter(
            (v) => v === "hidden",
          ).length;
          const disabledCount = Array.from(result.changes.values()).filter(
            (v) => v === "disabled",
          ).length;

          const parts: string[] = [];
          if (enabledCount > 0) parts.push(`${enabledCount} enabled`);
          if (hiddenCount > 0) parts.push(`${hiddenCount} hidden`);
          if (disabledCount > 0) parts.push(`${disabledCount} disabled`);

          ctx.ui.notify(
            `Skills updated: ${parts.join(", ")}. Use /reload or restart for changes to take effect.`,
            "success",
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          ctx.ui.notify(`Failed to save settings: ${msg}`, "error");
        }
      } else if (result.action === "cancel") {
        // Silent cancel
      }
    },
  });
}
