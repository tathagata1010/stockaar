"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, Sparkles, X } from "lucide-react";
import { subscribeToast, type Toast, type ToastTone } from "@/lib/toast";

const TONE_STYLE: Record<ToastTone, { bar: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }> = {
  default: { bar: "from-brand via-brand-2 to-accent", icon: Sparkles,      iconColor: "text-brand" },
  success: { bar: "from-accent via-brand to-brand-2", icon: CheckCircle2,  iconColor: "text-accent" },
  info:    { bar: "from-brand via-brand-2 to-accent", icon: Info,          iconColor: "text-brand" },
  warn:    { bar: "from-warning via-warning to-brand", icon: AlertTriangle, iconColor: "text-warning" },
  danger:  { bar: "from-danger via-danger to-brand",  icon: XCircle,       iconColor: "text-danger" },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsub = subscribeToast((t) => {
      setToasts((prev) => [...prev, t]);
      const tm = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
        timers.delete(tm);
      }, t.durationMs);
      timers.add(tm);
    });
    return () => {
      unsub();
      for (const tm of timers) clearTimeout(tm);
      timers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const style = TONE_STYLE[t.tone];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            role="status"
            className="surface pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-card/95 p-3 pr-8 shadow-pop fade-up-1 backdrop-blur"
          >
            <span className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${style.bar}`} />
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconColor}`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-fg">{t.title}</div>
              {t.description && <div className="mt-0.5 text-[11px] text-muted">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="absolute right-2 top-2 rounded p-0.5 text-muted hover:text-fg"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
