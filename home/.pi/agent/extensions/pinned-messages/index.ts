import type {
	ExtensionAPI,
	SessionEntry,
	SessionManager,
} from "@mariozechner/pi-coding-agent";

type SessionReader = Pick<
	SessionManager,
	"getLeafId" | "getBranch" | "getEntries" | "getLabel"
>;
import { DynamicBorder, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
	Key,
	Markdown,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

// ── Pin = label convention ────────────────────────────────────────────────
// A pin is a pi label with a reserved emoji prefix. Untitled pins are the bare
// prefix; titled pins carry free text after it. Persistence, session-scoping,
// and survival across restarts/forks all come from pi's label system.
const PIN_PREFIX = "📌";

function isPin(label: string | undefined): label is string {
	return label != null && label.startsWith(PIN_PREFIX);
}

function titleOf(label: string): string {
	return label.slice(PIN_PREFIX.length).trim();
}

function pinLabel(title: string): string {
	const t = title.trim();
	return t.length > 0 ? `${PIN_PREFIX} ${t}` : PIN_PREFIX;
}

// ── Message content extraction ──────────────────────────────────────────────
type Role = "user" | "assistant";

interface PinnableEntry {
	id: string;
	role: Role;
	timestamp: string;
	preview: string;
	markdown: string;
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (block && typeof block === "object") {
			const b = block as { type?: string; text?: string };
			if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
			else if (b.type === "image") parts.push("🖼 [image]");
		}
	}
	return parts.join("\n\n");
}

function oneLine(s: string): string {
	return s.replace(/\s+/g, " ").trim();
}

// Build a pinnable view of a message entry, or null if it is not a
// user/assistant message with visible text. Assistant messages that only
// carry thinking/toolCall blocks (no text) are not pin targets.
function toPinnable(entry: SessionEntry): PinnableEntry | null {
	if (entry.type !== "message") return null;
	const msg = entry.message as { role?: string; content?: unknown };
	if (msg.role !== "user" && msg.role !== "assistant") return null;
	const text = extractText(msg.content).trim();
	if (text.length === 0) return null;
	return {
		id: entry.id,
		role: msg.role,
		timestamp: entry.timestamp,
		preview: oneLine(text),
		markdown: text,
	};
}

function relativeTime(iso: string): string {
	const then = Date.parse(iso);
	if (Number.isNaN(then)) return "";
	const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
	if (secs < 60) return `${secs}s ago`;
	const mins = Math.round(secs / 60);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.round(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.round(hrs / 24);
	return `${days}d ago`;
}

// ── Session queries ──────────────────────────────────────────────────────────

// All pinnable messages on the current branch, chronological (oldest first).
function branchPinnables(sm: SessionReader): PinnableEntry[] {
	const leaf = sm.getLeafId();
	// getBranch returns root→leaf (chronological, oldest first).
	const branch = leaf ? sm.getBranch(leaf) : sm.getEntries();
	return branch.map(toPinnable).filter((e): e is PinnableEntry => e !== null);
}

interface PinView extends PinnableEntry {
	title: string; // "" when untitled
}

// All pins across the entire session tree (not just the current branch),
// chronological by the pinned message's timestamp.
function allPins(sm: SessionReader): PinView[] {
	const pins: PinView[] = [];
	for (const entry of sm.getEntries()) {
		const label = sm.getLabel(entry.id);
		if (!isPin(label)) continue;
		const p = toPinnable(entry);
		if (!p) continue;
		pins.push({ ...p, title: titleOf(label) });
	}
	pins.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
	return pins;
}

function lastAssistantOnBranch(sm: SessionReader): string | null {
	const leaf = sm.getLeafId();
	// getBranch returns root→leaf; walk from the end to find the most recent.
	const branch = leaf ? sm.getBranch(leaf) : sm.getEntries();
	for (let i = branch.length - 1; i >= 0; i--) {
		const p = toPinnable(branch[i]!);
		if (p && p.role === "assistant") return p.id;
	}
	return null;
}

// ── Filter helpers ────────────────────────────────────────────────────────────
type RoleFilter = "all" | "assistant" | "user";
const ROLE_CYCLE: RoleFilter[] = ["all", "assistant", "user"];

function matchesRole(role: Role, filter: RoleFilter): boolean {
	return filter === "all" || filter === role;
}

function matchesSearch(haystack: string, search: string): boolean {
	if (search.length === 0) return true;
	return haystack.toLowerCase().includes(search.toLowerCase());
}

// Translate raw key data into a printable character for inline text capture,
// or null if it is not a plain printable key.
function printableChar(data: string): string | null {
	if (data.length === 1) {
		const code = data.charCodeAt(0);
		if (code >= 32 && code !== 127) return data;
	}
	return null;
}

// ── Pin picker: choose an earlier message to pin ───────────────────────────────
interface PickerRow {
	entry: PinnableEntry;
}

class PinPicker implements Component {
	private search = "";
	private filter: RoleFilter = "all";
	private selected = 0;
	private readonly maxVisible = 12;

	constructor(
		private readonly entries: PinnableEntry[],
		private readonly theme: Theme,
		private readonly onPick: (id: string) => void,
		private readonly onCancel: () => void,
	) {}

	private visibleRows(): PickerRow[] {
		return this.entries
			.filter((e) => matchesRole(e.role, this.filter))
			.filter((e) => matchesSearch(e.preview, this.search))
			.map((entry) => ({ entry }));
	}

	handleInput(data: string): void {
		const rows = this.visibleRows();
		if (matchesKey(data, Key.up)) {
			this.selected = this.selected <= 0 ? rows.length - 1 : this.selected - 1;
		} else if (matchesKey(data, Key.down)) {
			this.selected = this.selected >= rows.length - 1 ? 0 : this.selected + 1;
		} else if (matchesKey(data, Key.tab)) {
			const i = ROLE_CYCLE.indexOf(this.filter);
			this.filter = ROLE_CYCLE[(i + 1) % ROLE_CYCLE.length]!;
			this.selected = 0;
		} else if (matchesKey(data, Key.enter)) {
			const row = rows[this.selected];
			if (row) this.onPick(row.entry.id);
		} else if (matchesKey(data, Key.escape)) {
			this.onCancel();
		} else if (matchesKey(data, Key.backspace)) {
			this.search = this.search.slice(0, -1);
			this.selected = 0;
		} else {
			const ch = printableChar(data);
			if (ch !== null) {
				this.search += ch;
				this.selected = 0;
			}
		}
	}

	invalidate(): void {}

	render(width: number): string[] {
		const t = this.theme;
		const rows = this.visibleRows();
		if (this.selected >= rows.length) this.selected = Math.max(0, rows.length - 1);

		const lines: string[] = [];
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		lines.push(t.fg("accent", t.bold(" Pin a message")));
		lines.push(
			t.fg("dim", ` filter: ${this.filter}   search: ${this.search || "—"}`),
		);

		if (rows.length === 0) {
			lines.push(t.fg("warning", " No matching messages"));
		} else {
			const start = Math.max(0, Math.min(this.selected - Math.floor(this.maxVisible / 2), rows.length - this.maxVisible));
			const end = Math.min(rows.length, Math.max(start, 0) + this.maxVisible);
			const from = Math.max(0, start);
			for (let i = from; i < end; i++) {
				const row = rows[i]!;
				const sel = i === this.selected;
				const prefix = sel ? "› " : "  ";
				const meta = `${row.entry.role} · ${relativeTime(row.entry.timestamp)}`;
				const body = ` ${prefix}${row.entry.preview}`;
				const line = truncateToWidth(body, width - visibleWidth(meta) - 2);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(line) - visibleWidth(meta)));
				const styledBody = sel ? t.fg("accent", line) : line;
				lines.push(`${styledBody}${pad}${t.fg("dim", meta)}`);
			}
			if (rows.length > this.maxVisible) {
				lines.push(t.fg("dim", ` ${this.selected + 1}/${rows.length}`));
			}
		}

		lines.push(t.fg("dim", " ↑↓ navigate • tab filter • enter pin • esc cancel"));
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		return lines;
	}
}

// ── Pin browser: list / detail / edit, with staged unpin ───────────────────────
type Mode = "list" | "detail" | "edit";

class PinBrowser implements Component {
	private mode: Mode = "list";
	private search = "";
	private selected: number;
	private editBuffer = "";
	private readonly maxVisible = 12;
	private readonly pendingUnpin = new Set<string>();
	private detailMarkdown?: Markdown;

	constructor(
		private readonly pins: PinView[],
		private readonly theme: Theme,
		private readonly commitUnpin: (id: string) => void,
		private readonly retitle: (id: string, title: string) => void,
		private readonly onClose: () => void,
	) {
		// Start selection on the most recent pin (bottom of the chronological list).
		this.selected = Math.max(0, pins.length - 1);
	}

	private visiblePins(): PinView[] {
		return this.pins.filter((p) =>
			matchesSearch(`${p.title} ${p.preview}`, this.search),
		);
	}

	private current(): PinView | undefined {
		return this.visiblePins()[this.selected];
	}

	private close(): void {
		// Commit point: apply all staged unpins in one pass on close.
		for (const id of this.pendingUnpin) this.commitUnpin(id);
		this.onClose();
	}

	handleInput(data: string): void {
		if (this.mode === "edit") return this.handleEditInput(data);
		if (this.mode === "detail") return this.handleDetailInput(data);
		return this.handleListInput(data);
	}

	private handleListInput(data: string): void {
		const rows = this.visiblePins();
		if (matchesKey(data, Key.up)) {
			this.selected = this.selected <= 0 ? rows.length - 1 : this.selected - 1;
		} else if (matchesKey(data, Key.down)) {
			this.selected = this.selected >= rows.length - 1 ? 0 : this.selected + 1;
		} else if (matchesKey(data, Key.enter)) {
			if (this.current()) {
				this.detailMarkdown = undefined;
				this.mode = "detail";
			}
		} else if (matchesKey(data, Key.ctrl("d"))) {
			this.togglePending();
		} else if (matchesKey(data, Key.ctrl("e"))) {
			this.beginEdit();
		} else if (matchesKey(data, Key.escape)) {
			this.close();
		} else if (matchesKey(data, Key.backspace)) {
			this.search = this.search.slice(0, -1);
			this.selected = 0;
		} else {
			const ch = printableChar(data);
			if (ch !== null) {
				this.search += ch;
				this.selected = 0;
			}
		}
	}

	private handleDetailInput(data: string): void {
		if (matchesKey(data, Key.escape)) {
			this.mode = "list";
		} else if (matchesKey(data, Key.ctrl("d"))) {
			this.togglePending();
			this.mode = "list"; // mark-and-return, per design
		} else if (matchesKey(data, Key.ctrl("e"))) {
			this.beginEdit();
		}
	}

	private handleEditInput(data: string): void {
		if (matchesKey(data, Key.enter)) {
			const pin = this.current();
			if (pin) {
				this.retitle(pin.id, this.editBuffer); // retitle commits immediately
				pin.title = this.editBuffer.trim();
			}
			this.mode = "list";
		} else if (matchesKey(data, Key.escape)) {
			this.mode = "list";
		} else if (matchesKey(data, Key.backspace)) {
			this.editBuffer = this.editBuffer.slice(0, -1);
		} else {
			const ch = printableChar(data);
			if (ch !== null) this.editBuffer += ch;
		}
	}

	private togglePending(): void {
		const pin = this.current();
		if (!pin) return;
		if (this.pendingUnpin.has(pin.id)) this.pendingUnpin.delete(pin.id);
		else this.pendingUnpin.add(pin.id);
	}

	private beginEdit(): void {
		const pin = this.current();
		if (!pin) return;
		this.editBuffer = pin.title;
		this.mode = "edit";
	}

	invalidate(): void {
		this.detailMarkdown = undefined;
	}

	render(width: number): string[] {
		if (this.mode === "detail") return this.renderDetail(width);
		if (this.mode === "edit") return this.renderEdit(width);
		return this.renderList(width);
	}

	private renderList(width: number): string[] {
		const t = this.theme;
		const rows = this.visiblePins();
		if (this.selected >= rows.length) this.selected = Math.max(0, rows.length - 1);

		const lines: string[] = [];
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		lines.push(t.fg("accent", t.bold(" 📌 Pinned messages")));
		if (this.search.length > 0) lines.push(t.fg("dim", ` search: ${this.search}`));

		if (this.pins.length === 0) {
			lines.push(t.fg("muted", " No pinned messages"));
		} else if (rows.length === 0) {
			lines.push(t.fg("warning", " No matching pins"));
		} else {
			const start = Math.max(0, Math.min(this.selected - Math.floor(this.maxVisible / 2), rows.length - this.maxVisible));
			const from = Math.max(0, start);
			const end = Math.min(rows.length, from + this.maxVisible);
			for (let i = from; i < end; i++) {
				const pin = rows[i]!;
				const sel = i === this.selected;
				const pending = this.pendingUnpin.has(pin.id);
				const prefix = sel ? "› " : "  ";
				const labelText = pin.title || pin.preview;
				const meta = `${pin.role} · ${relativeTime(pin.timestamp)}`;
				let body = `${prefix}${pending ? "✗ " : ""}${labelText}`;
				body = truncateToWidth(` ${body}`, width - visibleWidth(meta) - 2);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(body) - visibleWidth(meta)));
				let styled: string;
				if (pending) styled = t.fg("dim", body); // struck/dimmed = slated for removal
				else if (sel) styled = t.fg("accent", body);
				else styled = body;
				lines.push(`${styled}${pad}${t.fg("dim", meta)}`);
			}
			if (rows.length > this.maxVisible) lines.push(t.fg("dim", ` ${this.selected + 1}/${rows.length}`));
		}

		const pendingNote = this.pendingUnpin.size > 0
			? t.fg("warning", `  (${this.pendingUnpin.size} to unpin on close)`)
			: "";
		lines.push(
			t.fg("dim", " ↑↓ navigate • enter reveal • ctrl+d unpin • ctrl+e title • esc close") + pendingNote,
		);
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		return lines;
	}

	private renderDetail(width: number): string[] {
		const t = this.theme;
		const pin = this.current();
		const lines: string[] = [];
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		if (!pin) {
			lines.push(t.fg("warning", " Pin not found"));
		} else {
			const heading = pin.title || `${pin.role} · ${relativeTime(pin.timestamp)}`;
			const pending = this.pendingUnpin.has(pin.id) ? t.fg("warning", "  ✗ (will unpin)") : "";
			lines.push(t.fg("accent", t.bold(` 📌 ${truncateToWidth(heading, width - 6)}`)) + pending);
			if (!this.detailMarkdown) this.detailMarkdown = new Markdown(pin.markdown, 1, 0, getMarkdownTheme());
			lines.push(...this.detailMarkdown.render(width));
		}
		lines.push(t.fg("dim", " ctrl+d unpin • ctrl+e title • esc back"));
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		return lines;
	}

	private renderEdit(width: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		lines.push(t.fg("accent", t.bold(" Set pin title")));
		lines.push(truncateToWidth(` › ${this.editBuffer}`, width) + t.fg("dim", "▌"));
		lines.push(t.fg("dim", " enter save • esc cancel • (empty clears title)"));
		lines.push(...new DynamicBorder((s: string) => t.fg("accent", s)).render(width));
		return lines;
	}
}

export default function (pi: ExtensionAPI) {
	// /pin [title] — quick-pin the most recent assistant message on the branch.
	pi.registerCommand("pin", {
		description: "Pin the last assistant message (optional title)",
		handler: async (args, ctx) => {
			const id = lastAssistantOnBranch(ctx.sessionManager);
			if (!id) {
				ctx.ui.notify("No assistant message to pin", "warning");
				return;
			}
			pi.setLabel(id, pinLabel(args));
			ctx.ui.notify(args.trim() ? `Pinned: ${args.trim()}` : "Pinned", "info");
		},
	});

	// Quick-pin shortcut — pin the most recent assistant message, no title.
	pi.registerShortcut(Key.ctrlShift("p"), {
		description: "Pin the last assistant message",
		handler: (ctx) => {
			const id = lastAssistantOnBranch(ctx.sessionManager);
			if (!id) {
				ctx.ui.notify("No assistant message to pin", "warning");
				return;
			}
			pi.setLabel(id, pinLabel(""));
			ctx.ui.notify("Pinned", "info");
		},
	});

	// /pin-pick — choose an earlier message on the branch to pin.
	pi.registerCommand("pin-pick", {
		description: "Pick an earlier message to pin",
		handler: async (_args, ctx) => {
			const entries = branchPinnables(ctx.sessionManager);
			if (entries.length === 0) {
				ctx.ui.notify("No messages to pin", "warning");
				return;
			}
			await ctx.ui.custom<void>(
				(tui, theme, _kb, done) => {
					const picker = new PinPicker(
						entries,
						theme,
						(id) => {
							pi.setLabel(id, pinLabel(""));
							ctx.ui.notify("Pinned", "info");
							done();
						},
						() => done(),
					);
					return {
						render: (w) => picker.render(w),
						invalidate: () => picker.invalidate(),
						handleInput: (d) => {
							picker.handleInput(d);
							tui.requestRender();
						},
					};
				},
				{ overlay: true },
			);
		},
	});

	// /pins — browse all pins in the session tree.
	pi.registerCommand("pins", {
		description: "Browse pinned messages",
		handler: async (_args, ctx) => {
			const pins = allPins(ctx.sessionManager);
			await ctx.ui.custom<void>(
				(tui, theme, _kb, done) => {
					const browser = new PinBrowser(
						pins,
						theme,
						(id) => pi.setLabel(id, undefined),
						(id, title) => pi.setLabel(id, pinLabel(title)),
						() => done(),
					);
					return {
						render: (w) => browser.render(w),
						invalidate: () => browser.invalidate(),
						handleInput: (d) => {
							browser.handleInput(d);
							tui.requestRender();
						},
					};
				},
				{ overlay: true },
			);
		},
	});
}
