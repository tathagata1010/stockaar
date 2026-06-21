"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { UploadCloud, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onImage: (base64: string, mimeType: string) => void;
  disabled?: boolean;
  busy?: boolean;
};

const MAX_DIM = 1024;
const JPEG_QUALITY = 0.82;
const SKIP_COMPRESS_BYTES = 700 * 1024;

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mimeType: file.type || "image/jpeg" };
}

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.size < SKIP_COMPRESS_BYTES) return fileToBase64(file);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mimeType: "image/jpeg" };
}

export function UploadDropzone({ onImage, disabled, busy }: Props) {
  const [drag, setDrag] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setCompressing(true);
      setPreviewUrl(URL.createObjectURL(file));
      try {
        const { base64, mimeType } = await compressImage(file);
        onImage(base64, mimeType);
      } finally {
        setCompressing(false);
      }
    },
    [onImage],
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = [...(e.clipboardData?.items ?? [])].find((it) => it.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

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
        "surface relative flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition",
        drag ? "border-brand bg-brand/5" : "border-border",
        disabled && "opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {previewUrl ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-40 w-64 overflow-hidden rounded-lg ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
          </div>
          <p className="text-xs text-muted">
            {compressing || busy ? "Reading screenshot…" : "Ready — click Diagnose below."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/30">
            <UploadCloud className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">Drop a broker screenshot here</p>
            <p className="mt-1 text-xs text-muted">
              Zerodha · Groww · Upstox · Angel One — paste from clipboard works too.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="btn-brand mt-1 inline-flex items-center gap-2"
          >
            {compressing || busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            Choose image
          </button>
        </>
      )}
    </div>
  );
}
