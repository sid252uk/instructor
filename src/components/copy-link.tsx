"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
