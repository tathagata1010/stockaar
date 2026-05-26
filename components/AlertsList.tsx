"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatINR, cn } from "@/lib/utils";
import { Trash2, ArrowUp, ArrowDown, CheckCircle2, Circle } from "lucide-react";

type Alert = {
  id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  condition: "above" | "below";
  target_price: number;
  status: "active" | "triggered" | "cancelled";
  created_at: string;
  triggered_at: string | null;
};

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  const router = useRouter();

  async function remove(id: string) {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted">No alerts yet. Create one above to be notified by email when a stock crosses your target.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Condition</th>
            <th className="px-4 py-3 text-right">Target</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const up = a.condition === "above";
            return (
              <tr key={a.id} className="border-b border-border last:border-0 transition-colors hover:bg-bg/40">
                <td className="px-4 py-3">
                  <Link href={`/stock/${a.symbol}`} className="font-semibold hover:text-brand">
                    {a.symbol}
                  </Link>
                  <span className="ml-2 text-xs text-muted">{a.exchange}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                    up ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger",
                  )}>
                    {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {up ? "Above" : "Below"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatINR(a.target_price)}</td>
                <td className="px-4 py-3">
                  {a.status === "active" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted"><Circle className="h-3 w-3 fill-current text-accent animate-pulse-soft" /> Active</span>
                  ) : a.status === "triggered" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-accent"><CheckCircle2 className="h-3 w-3" /> Triggered</span>
                  ) : (
                    <span className="text-xs text-muted">Cancelled</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(a.id)}
                    aria-label="Remove alert"
                    className="rounded-md p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
