"use client";

import { openProjectInFiles } from "@/lib/events";
import { FolderIcon } from "@/components/icons";

export function OpenInFilesLink({ slug }: { slug: string }) {
  return (
    <button
      type="button"
      onClick={() => openProjectInFiles(slug)}
      className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent-soft transition-colors hover:bg-accent/20"
    >
      <FolderIcon className="h-3.5 w-3.5" />
      Open in Files
    </button>
  );
}
