"use client";

import { useMemo, useState } from "react";
import { getEntries, getNode, join, type Cursor, type FSNode } from "@/lib/fs";
import { projects } from "@/lib/data";
import { ChevronRightIcon, FileIcon, FolderIcon, HomeIcon } from "@/components/icons";

type FilesProps = {
  path: Cursor;
  onNavigate: (path: Cursor) => void;
};

export function Files({ path, onNavigate }: FilesProps) {
  // If the path points to a file, resolve the folder and select the file
  const { folderPath, filePath } = useMemo(() => {
    const node = getNode(path);
    if (node && node.type === "file") {
      const idx = path.lastIndexOf("/");
      const folder = idx === 0 ? "/" : path.substring(0, idx);
      return { folderPath: folder, filePath: path };
    }
    return { folderPath: path, filePath: null };
  }, [path]);

  const [localSel, setLocalSel] = useState<{ path: Cursor; file: Cursor } | null>(null);
  const selected = filePath || (localSel && localSel.path === folderPath ? localSel.file : null);

  const entries = useMemo(() => {
    const sorted = [...getEntries(folderPath)].sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1,
    );
    return sorted;
  }, [folderPath]);

  const selectedNode = selected ? getNode(selected) : null;

  const open = (node: FSNode) => {
    const next = join(folderPath, node.name);
    if (node.type === "folder") {
      onNavigate(next);
    } else {
      if (filePath) {
        onNavigate(folderPath);
      }
      setLocalSel({ path: folderPath, file: next });
    }
  };

  const crumbs = useMemo(() => {
    const out: { label: string; path: Cursor }[] = [{ label: "~", path: "/" }];
    let acc = "";
    for (const part of path.split("/").filter(Boolean)) {
      acc = `${acc}/${part}`;
      out.push({ label: part, path: acc });
    }
    return out;
  }, [path]);

  const sidebar: { label: string; path: Cursor; indent?: boolean }[] = [
    { label: "~", path: "/" },
    { label: "projects/", path: "/projects" },
    ...projects.map((p) => ({ label: `${p.slug}/`, path: `/projects/${p.slug}` as Cursor, indent: true })),
    { label: "research/", path: "/research" },
    { label: "systems/", path: "/systems" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#08080c] font-mono">
      {/* path bar */}
      <div data-lenis-prevent className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface-2/50 px-3 py-2 text-[11px] no-scrollbar">
        <button
          type="button"
          onClick={() => onNavigate("/")}
          className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Go to home"
        >
          <HomeIcon className="h-3.5 w-3.5" />
        </button>
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex shrink-0 items-center gap-1">
            <ChevronRightIcon className="h-3 w-3 text-ink-faint" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onNavigate(c.path)}
              className={`rounded px-1 py-0.5 transition-colors ${
                i === crumbs.length - 1 ? "text-accent" : "text-ink-dim hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* sidebar */}
        <aside data-lenis-prevent className="hidden w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line p-2 lg:flex" aria-label="Folders">
          {sidebar.map((item) => {
            const active = folderPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                  item.indent ? "ml-4" : ""
                } ${active ? "bg-accent/10 text-accent" : "text-ink-dim hover:bg-surface-2 hover:text-ink"}`}
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* listing */}
          <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-line-soft px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
              <span className="flex-1">name</span>
              <span className="hidden w-24 shrink-0 text-right sm:block">kind</span>
            </div>
            {entries.length === 0 && <p className="px-3 py-6 text-[11px] text-ink-faint">(empty)</p>}
            {entries.map((e) => {
              const full = join(path, e.name);
              const isSel = selected === full;
              return (
                <button
                  key={e.name}
                  type="button"
                  onClick={() => open(e)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    isSel ? "bg-accent/10" : "hover:bg-surface-2"
                  }`}
                >
                  {e.type === "folder" ? (
                    <FolderIcon className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <FileIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                  )}
                  <span className={`truncate ${e.type === "folder" ? "text-ink" : "text-ink-dim"}`}>{e.name}</span>
                  <span className="ml-auto hidden w-24 shrink-0 text-right font-mono text-[10px] text-ink-faint sm:block">
                    {e.type === "folder" ? "folder" : e.size}
                  </span>
                </button>
              );
            })}
          </div>

          {/* preview */}
          {selectedNode && selectedNode.type === "file" && (
            <div data-lenis-prevent className="max-h-64 min-h-0 shrink-0 overflow-y-auto border-t border-line p-4 lg:max-h-none lg:w-[44%] lg:border-l lg:border-t-0">
              <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                {selectedNode.kind} · {selectedNode.size} · selectable
              </p>
              <h3 className="mt-1.5 text-sm font-medium text-ink">{selectedNode.name}</h3>
              <pre className="mt-3 select-text whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-dim">
                {selectedNode.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
