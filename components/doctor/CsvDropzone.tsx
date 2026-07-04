"use client";

import { useState, useCallback, useRef } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onText: (text: string) => void;
  busy?: boolean;
  disabled?: boolean;
};

const MAX_BYTES = 2 * 1024 * 1024; // 2MB — broker CSV exports are tiny

export function CsvDropzone({ onText, busy, disabled }: Props) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const looksLikeCsv =
        file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel" ||
        /\.(csv|tsv|txt)$/i.test(file.name);
      if (!looksLikeCsv) {
        setError("Upload a .csv (or .tsv/.txt) export from your broker.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("File too large — keep under 2MB.");
        return;
      }
      try {
        const text = await file.text();
        setActiveFile(file.name);
        onText(text);
      } catch {
        setError("Could not read file.");
      }
    },
    [onText],
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={cn(
        "surface flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition",
        drag ? "border-brand bg-brand/5" : "border-border",
        disabled && "opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/30">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
      </div>
      <div>
        <p className="text-sm font-semibold">
          {activeFile ? `Loaded ${activeFile}` : "Drop your broker CSV export"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          Zerodha Console · Groww · Upstox · Angel One · ICICI Direct — column names auto-detected.
        </p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="btn-ghost mt-1 inline-flex items-center gap-2 text-xs disabled:opacity-50"
      >
        <UploadCloud className="h-3.5 w-3.5" />
        {activeFile ? "Replace file" : "Choose file"}
      </button>
      {error && (
        <p className="text-[11px] text-danger">{error}</p>
      )}
    </div>
  );
}
