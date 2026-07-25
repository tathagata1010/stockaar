import { getRecentGuidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, Megaphone } from "lucide-react";

const DIRECTION_STYLE: Record<string, { icon: React.ReactNode; tone: string }> = {
  up: { icon: <ArrowUpRight className="h-3.5 w-3.5" />, tone: "text-accent bg-accent/15" },
  down: { icon: <ArrowDownRight className="h-3.5 w-3.5" />, tone: "text-danger bg-danger/15" },
  flat: { icon: <ArrowRight className="h-3.5 w-3.5" />, tone: "text-muted bg-bg-2" },
  mixed: { icon: <ArrowRight className="h-3.5 w-3.5" />, tone: "text-warning bg-warning/15" },
};

export async function GuidanceCard({ symbol }: { symbol: string }) {
  const rows = await getRecentGuidance({ symbol, limit: 3 }).catch(() => []);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Megaphone className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Management guidance
          </div>
          <div className="text-[10px] text-muted">Extracted from filings</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg/40 px-3 py-4 text-center text-[11px] text-muted">
          No recent management guidance filed.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const style = DIRECTION_STYLE[r.direction] ?? DIRECTION_STYLE.flat;
            return (
              <li key={r.id} className="rounded-xl bg-bg/40 p-2.5 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md", style.tone)}>
                    {style.icon}
                  </span>
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-fg/80">
                    {r.metric}
                  </span>
                </div>
                {r.value_text && (
                  <div className="mt-1 text-sm font-bold tabular-nums text-fg">
                    {r.value_text}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted">
                  <span className="truncate">{r.timeframe ?? "—"}</span>
                  <span className="shrink-0">{formatRelative(r.filed_at)}</span>
                </div>
                {r.filing?.pdf_url && (
                  <a
                    href={r.filing.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-brand hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    Source filing
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
