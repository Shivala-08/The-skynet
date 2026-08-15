"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { about, contact, projects, researchLog } from "@/lib/data";
import { displayPath, getEntries, getNode, resolve, type Cursor } from "@/lib/fs";
import { fetchSiteStatus, formatAge, formatDateTime } from "@/lib/status";

type Tone = "default" | "dim" | "accent" | "ok" | "err";

type Line = {
  text: string;
  tone?: Tone;
  prompt?: string;
  /** If true, render text as raw HTML (for animations). */
  html?: boolean;
};

type ExecResult = {
  lines: Line[];
  cwd?: Cursor;
  clear?: boolean;
  async?: {
    question: string;
    history: { role: "user" | "assistant"; content: string }[];
  };
  /** Set when the command needs the result of an async onOpen() call. */
  pendingOpen?: { arg: string; cwd: Cursor };
  /** Set when the command streams a deploy replay from /api/deploy. */
  deploy?: boolean;
  /** Set when the command fetches live site telemetry from /api/status. */
  status?: boolean;
};

type TerminalProps = {
  onOpen: (target: string, cwd: Cursor) => boolean | Promise<boolean>;
  onExit: () => void;
  /** A command to run automatically (e.g. from the status widget). */
  commandRequest?: string | null;
  /** Called after commandRequest has been executed, so the parent can reset it. */
  onCommandRequestHandled?: () => void;
};

const HELP = [
  "Available commands",
  "  help                show this message",
  "  ask <question>      ask the AI assistant anything",
  "  about               who is behind this OS",
  "  projects            list the builds",
  "  research            read the research log",
  "  contact             contact channels",
  "  whoami              current user",
  "  date                current date and time",
  "  echo <text>         print text",
  "  pwd                 print working directory",
  "  ls [path]           list directory contents",
  "  cd <path>           change directory",
  "  cat <file>          print a file",
  "  deploy              replay the last real production build (not a live trigger)",
  "  status              live site telemetry (commit, deploy time, visits)",
  "  open <target>       open files · terminal · a section · a project",
  "  clear               clear the terminal",
  "  exit                close the terminal",
];

function projectLines(): Line[] {
  const lines: Line[] = projects.map((p) => ({
    text: `${p.name.padEnd(16)} [${p.status}]  ${p.tagline}`,
    tone: "accent",
  }));
  lines.push(
    { text: "", tone: "dim" },
    { text: "Run 'open <project>' to browse its folder, or 'cat projects/<slug>/README.md'.", tone: "dim" },
  );
  return lines;
}

function researchLines(): Line[] {
  return researchLog.flatMap((r) => [
    { text: `${String(r.id).padStart(2, "0")}  ${r.title.padEnd(24)} ${r.status}`, tone: "default" },
    { text: `     ${r.note}`, tone: "dim" },
  ]);
}

function contactLines(): Line[] {
  return [
    { text: `email     ${contact.email}`, tone: "default" },
    { text: `github    ${contact.github}`, tone: "default" },
    { text: `linkedin  ${contact.linkedin}`, tone: "default" },
    { text: `resume    ${contact.resume}`, tone: "default" },
    { text: "", tone: "dim" },
    { text: contact.note, tone: "dim" },
  ];
}

function aboutLines(): Line[] {
  return [
    { text: `${about.name} — ${about.role}`, tone: "accent" },
    ...about.bio.map((b) => ({ text: b, tone: "dim" as Tone })),
    { text: "", tone: "dim" },
    { text: `focus: ${about.focus.join(" · ")}`, tone: "dim" },
  ];
}

function exec(raw: string, cwd: Cursor, onExit: () => void): ExecResult {
  const text = raw.trim();
  if (!text) return { lines: [] };

  const [cmd, ...args] = text.split(/\s+/);
  const arg = args.join(" ").trim();
  const err = (m: string): ExecResult => ({ lines: [{ text: m, tone: "err" }] });
  const ok = (lines: Line[]): ExecResult => ({ lines });

  switch (cmd.toLowerCase()) {
    case "help":
      return ok(HELP.map((l) => ({ text: l, tone: l.startsWith("Available") ? "accent" : undefined })));
    case "clear":
    case "cls":
      return { lines: [], clear: true };
    case "about":
      return ok(aboutLines());
    case "whoami":
      return ok([{ text: "skynet@ailab-os" }, { text: "role: AI/ML student — builder of this OS", tone: "dim" }]);
    case "date":
      return ok([{ text: new Date().toString() }]);
    case "echo":
      return ok([{ text: arg }]);
    case "pwd":
      return ok([{ text: displayPath(cwd) }]);
    case "ls": {
      const target = args[0] ? resolve(cwd, args[0]) : cwd;
      if (!target) return err(`ls: cannot access '${args[0] ?? ""}': no such file or directory`);
      const node = getNode(target);
      if (!node || node.type !== "folder") return err(`ls: '${args[0] ?? "."}' is not a directory`);
      const entries = getEntries(target);
      if (entries.length === 0) return ok([{ text: "(empty)", tone: "dim" }]);
      return ok(
        entries.map((e) =>
          e.type === "folder"
            ? { text: `${e.name}/`, tone: "accent" as Tone }
            : { text: e.name, tone: "default" as Tone },
        ),
      );
    }
    case "cd": {
      if (!args[0]) return { lines: [], cwd: "/" };
      const target = resolve(cwd, args[0]);
      if (!target) return err(`cd: no such directory: ${args[0]}`);
      if (getNode(target)?.type !== "folder") return err(`cd: not a directory: ${args[0]}`);
      return { lines: [], cwd: target };
    }
    case "cat": {
      if (!args[0]) return err("cat: missing file operand");
      const target = resolve(cwd, args[0]);
      const node = target ? getNode(target) : null;
      if (!node) return err(`cat: ${args[0]}: no such file`);
      if (node.type === "folder") return err(`cat: ${args[0]}: is a directory`);
      return ok(node.content.split("\n").map((l) => ({ text: l })));
    }
    case "projects":
      return ok(projectLines());
    case "research":
      return ok(researchLines());
    case "contact":
      return ok(contactLines());
    case "open": {
      if (!arg) return err("open: usage: open <files | terminal | research | builds | systems | about | contact | <project>>");
      return { lines: [], pendingOpen: { arg, cwd } };
    }
    case "ask": {
      if (!arg) return err("ask: usage: ask <your question>");
      return {
        lines: [],
        async: { question: arg, history: [] },
      };
    }
    case "deploy":
      return { lines: [], deploy: true };
    case "status":
      return { lines: [], status: true };
    case "sudo":
      if (arg.toLowerCase() === "hire-skynet") {
        return ok([
          { text: "Permission granted. Initiating contact protocol...", tone: "ok" },
          { text: "", tone: "dim" },
          { text: `email     ${contact.email}`, tone: "default" },
          { text: `github    ${contact.github}`, tone: "default" },
          { text: `linkedin  ${contact.linkedin}`, tone: "default" },
          { text: `resume    ${contact.resume}`, tone: "default" },
        ]);
      }
      return ok([{ text: "Permission denied. This incident has been reported to the lab.", tone: "err" }]);
    case "coffee":
      return ok([
        { text: "Brewing a fresh cup...", tone: "accent" },
        { text: "", tone: "dim" },
        { text: "Done. Coffee is ready. Productivity +15%.", tone: "ok" },
      ]);
    case "exit":
      onExit();
      return { lines: [] };
    default:
      return err(`command not found: ${cmd}. Try 'help'.`);
  }
}

const THINKING_MARKER = '<span class="animate-thinking"';
const DEPLOY_CONNECT_MARKER = "▸ connecting to deployforge";
const STATUS_FETCH_MARKER = "▸ fetching site telemetry";

const PAD = "─".repeat(31);
const BANNER = [`┌${PAD}┐`, `│   SKYNET // AI LAB OS · v1.0  │`, `└${PAD}┘`].join("\n");

export function Terminal({ onOpen, onExit, commandRequest, onCommandRequestHandled }: TerminalProps) {
  const [lines, setLines] = useState<Line[]>([
    { text: BANNER, tone: "dim" },
    { text: "", tone: "dim" },
    { text: "Welcome to SKYNET // AI LAB OS.", tone: "dim" },
    { text: "Type 'help' to list available commands.", tone: "dim" },
    { text: "Type 'ask <question>' to chat with the AI assistant.", tone: "accent" },
  ]);
  const [cwd, setCwd] = useState<Cursor>("/");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  // Tracks the single in-flight async job (ask/deploy/status). These all
  // mutate the output buffer by position, so only one may run at a time —
  // otherwise two streams would overwrite each other's lines.
  const busyRef = useRef<"ask" | "deploy" | "status" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, cwd]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const prompt = `skynet@ailab-os:${displayPath(cwd)}$ `;

  // Removes the transient status line that starts with `marker` (e.g. the
  // "thinking…" indicator or a "▸ fetching…" line) wherever it sits in the
  // buffer. Jobs never assume their marker is the last line, so unrelated
  // output typed mid-stream can't make them delete the wrong line.
  const dropLineStarting = (prev: Line[], marker: string): Line[] => {
    const idx = prev.findIndex((l) => l.text.startsWith(marker));
    return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
  };

  const streamAsk = useCallback(async (question: string) => {
    setIsLoading(true);
    const userMsg = { role: "user" as const, content: question };
    const allMessages = [...chatHistoryRef.current, userMsg];

    // Add the user's question to display
    setLines((prev) => [...prev, { text: `ask ${question}`, prompt }]);

    // Start streaming indicator
    setLines((prev) => [
      ...prev,
      {
        text: '<span class="animate-thinking"><span></span><span></span><span></span></span> thinking',
        tone: "accent",
        html: true,
      },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let detail = errText || res.statusText;
        try {
          const parsed = JSON.parse(detail) as { error?: string };
          if (parsed.error) detail = parsed.error;
        } catch {
          // Not JSON — show the raw body.
        }
        setLines((prev) => [
          ...dropLineStarting(prev, THINKING_MARKER),
          { text: `Error: ${detail}`, tone: "err" },
        ]);
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLines((prev) => [
          ...dropLineStarting(prev, THINKING_MARKER),
          { text: "Error: no response body", tone: "err" },
        ]);
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let answer = "";

      // Replace "thinking..." with empty answer line
      setLines((prev) => [...dropLineStarting(prev, THINKING_MARKER), { text: "", tone: "default" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        answer += chunk;

        // Update the last line with the streaming answer
        setLines((prev) => {
          const filtered = prev.slice(0, -1);
          return [...filtered, { text: answer, tone: "default" }];
        });
      }

      // Save to chat history
      chatHistoryRef.current = [...allMessages, { role: "assistant", content: answer }];
    } catch (error) {
      setLines((prev) => [
        ...dropLineStarting(prev, THINKING_MARKER),
        { text: `Error: ${error instanceof Error ? error.message : "Network error"}`, tone: "err" },
      ]);
    } finally {
      setIsLoading(false);
      busyRef.current = null;
    }
  }, [prompt]);

  // Streams the /api/deploy replay (real historical build log) into the
  // terminal. The input stays enabled while streaming (like a real terminal
  // job); a second `deploy` while one is running fails gracefully instead of
  // stacking.
  const streamDeploy = useCallback(async () => {
    busyRef.current = "deploy";
    setLines((prev) => [...prev, { text: "▸ connecting to deployforge replay…", tone: "dim" }]);

    try {
      const res = await fetch("/api/deploy");
      if (!res.ok) {
        setLines((prev) => [
          ...prev.slice(0, -1),
          { text: `deploy: replay failed (${res.status} ${res.statusText})`, tone: "err" },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLines((prev) => [
          ...dropLineStarting(prev, DEPLOY_CONNECT_MARKER),
          { text: "deploy: no response body", tone: "err" },
        ]);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        const parsed = lines
          .map((l) => {
            const t = l.trim();
            if (!t) return null;
            try {
              return JSON.parse(t) as { text?: string; tone?: Tone };
            } catch {
              return null;
            }
          })
          .filter((p): p is { text: string; tone?: Tone } => !!p && typeof p.text === "string");

        if (parsed.length > 0) {
          setLines((prev) => [
            // Drop the "connecting…" line once the first log line lands.
            ...dropLineStarting(prev, DEPLOY_CONNECT_MARKER),
            ...parsed.map((p) => ({ text: p.text, tone: p.tone ?? "default" })),
          ]);
        }
      }
    } catch (error) {
      setLines((prev) => [
        ...dropLineStarting(prev, DEPLOY_CONNECT_MARKER),
        {
          text: `deploy: replay failed — ${error instanceof Error ? error.message : "network error"}`,
          tone: "err",
        },
      ]);
    } finally {
      busyRef.current = null;
    }
  }, []);

  // Fetches real site telemetry from /api/status and renders it as a panel.
  // Every number comes from the server — commit/deploy time are baked at
  // build time, visits are a real KV counter (shown only when live).
  const runStatus = useCallback(async () => {
    busyRef.current = "status";
    setLines((prev) => [...prev, { text: "▸ fetching site telemetry…", tone: "dim" }]);
    try {
      const data = await fetchSiteStatus();

      const lines: Line[] = [
        { text: "", tone: "dim" },
        { text: "SITE TELEMETRY", tone: "accent" },
        { text: `status       ${data.status}`, tone: "ok" },
        { text: `environment  ${data.build.environment}`, tone: "default" },
        { text: `commit       ${data.build.commit}${data.build.branch ? ` (${data.build.branch})` : ""}`, tone: "default" },
        { text: `deployed     ${formatDateTime(data.build.deployedAt)}`, tone: "default" },
        { text: `deploy age   ${formatAge(data.build.deployedAt)}`, tone: "default" },
        {
          text: `visits       ${data.visits != null ? data.visits.toLocaleString() : "unavailable"}`,
          tone: data.visits != null ? "ok" : "dim",
        },
      ];
      if (data.telemetry.visitCounter === "not-configured") {
        lines.push({
          text: "  (visit counter needs KV_REST_API_URL + KV_REST_API_TOKEN — omitted rather than faked)",
          tone: "dim",
        });
      }
      lines.push({ text: "", tone: "dim" });

      setLines((prev) => [...dropLineStarting(prev, STATUS_FETCH_MARKER), ...lines]);
    } catch (error) {
      setLines((prev) => [
        ...dropLineStarting(prev, STATUS_FETCH_MARKER),
        {
          text: `status: failed to fetch telemetry — ${error instanceof Error ? error.message : "network error"}`,
          tone: "err",
        },
      ]);
    } finally {
      busyRef.current = null;
    }
  }, []);

  // Executes a command string through the same path as typing it into the
  // prompt — shared by submit() and the commandRequest prop (status widget).
  const runCommand = useCallback(
    (cmd: string) => {
      const result = exec(cmd, cwd, onExit);

      // Async commands (ask/deploy/status) each rewrite the tail of the
      // output buffer, so only one may run at a time. Anything sent while a
      // job streams fails gracefully — never silently, never interleaved.
      // The busy flag is only set once we know the command actually starts a
      // job (e.g. `ask` with no question just prints usage and must not block).
      const rejectBusy = (word: string) => {
        setLines((prev) => [
          ...prev,
          { text: cmd, prompt },
          {
            text: `${word}: a ${busyRef.current} job is already running — wait for it to finish.`,
            tone: "err",
          },
        ]);
      };

      if (result.pendingOpen) {
        // onOpen may resolve asynchronously (it can lazy-load the filesystem
        // module), so push the prompt now and append the result when it lands.
        setLines((prev) => [...prev, { text: cmd, prompt }]);
        const { arg, cwd: ocwd } = result.pendingOpen;
        Promise.resolve(onOpen(arg, ocwd)).then((opened) => {
          setLines((prev) => [
            ...prev,
            opened
              ? { text: `opening ${arg}…`, tone: "ok" as Tone }
              : { text: `open: unknown target: ${arg}`, tone: "err" as Tone },
          ]);
        });
      } else if (result.async) {
        if (busyRef.current) {
          rejectBusy("ask");
        } else {
          busyRef.current = "ask";
          streamAsk(result.async.question);
        }
      } else if (result.deploy) {
        if (busyRef.current) {
          rejectBusy("deploy");
        } else {
          busyRef.current = "deploy";
          setLines((prev) => [...prev, { text: cmd, prompt }]);
          streamDeploy();
        }
      } else if (result.status) {
        if (busyRef.current) {
          rejectBusy("status");
        } else {
          busyRef.current = "status";
          setLines((prev) => [...prev, { text: cmd, prompt }]);
          runStatus();
        }
      } else {
        setLines((prev) => [...prev, { text: cmd, prompt }, ...result.lines]);
      }

      if (result.cwd) setCwd(result.cwd);
      if (result.clear) setLines([]);
      if (cmd.trim()) setHistory((h) => [...h, cmd]);
      setHIdx(-1);
    },
    [cwd, onExit, onOpen, prompt, streamAsk, streamDeploy, runStatus],
  );

  const submit = () => {
    const cmd = input;
    runCommand(cmd);
    setInput("");
  };

  // External command request (e.g. clicking the status widget): open the
  // terminal, run the command, then tell the parent it was handled.
  useEffect(() => {
    if (!commandRequest) return;
    runCommand(commandRequest);
    onCommandRequestHandled?.();
  }, [commandRequest, runCommand, onCommandRequestHandled]);

  const navHistory = (dir: 1 | -1) => {
    if (history.length === 0) return;
    const idx = Math.min(Math.max(hIdx + dir, -1), history.length - 1);
    setHIdx(idx);
    setInput(idx === -1 ? "" : history[idx]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navHistory(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navHistory(-1);
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setInput("");
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#050507] font-mono text-[13px] leading-relaxed"
      onPointerDown={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-4 py-3" role="log" aria-label="Terminal output">
        {lines.map((line, i) => (
          <p key={i} className={`whitespace-pre-wrap break-words ${toneClass(line.tone)}`}>
            {line.prompt && <span className="text-accent">{line.prompt}</span>}
            {line.html ? (
              <span dangerouslySetInnerHTML={{ __html: line.text }} />
            ) : (
              line.text
            )}
          </p>
        ))}
        <div className="flex items-center">
          <span className="shrink-0 text-accent">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent text-ink caret-accent outline-none disabled:opacity-50"
            aria-label="Terminal input"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder={isLoading ? "AI is thinking..." : ""}
          />
        </div>
      </div>
    </div>
  );
}

function toneClass(tone?: Tone): string {
  switch (tone) {
    case "dim":
      return "text-ink-dim";
    case "accent":
      return "text-accent";
    case "ok":
      return "text-accent";
    case "err":
      return "text-red-400"; // errors stay red — universal terminal convention
    default:
      return "text-ink";
  }
}


