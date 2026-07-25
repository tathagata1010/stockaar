import { Building2, Globe, MapPin, Users, Landmark, Info } from "lucide-react";
import type { Fundamentals } from "@/lib/fundamentals";
import { formatCompactINR } from "@/lib/utils";
import { ExpandableText } from "@/components/ui/ExpandableText";

function fmtEmployees(n?: number): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function normalizeUrl(raw?: string): { href: string; display: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const display = href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  return { href, display };
}

export function AboutCompany({
  name,
  symbol,
  fundamentals,
  fallbackSector,
  fallbackIndustry,
}: {
  name: string;
  symbol: string;
  fundamentals: Fundamentals | null;
  fallbackSector?: string;
  fallbackIndustry?: string;
}) {
  const summary = fundamentals?.longBusinessSummary?.trim();
  const industry = fundamentals?.industry ?? fallbackIndustry;
  const sector = fundamentals?.sector ?? fallbackSector;
  const site = normalizeUrl(fundamentals?.website);
  const location = [fundamentals?.city, fundamentals?.country].filter(Boolean).join(", ");
  const employees = fundamentals?.fullTimeEmployees;
  const marketCap = fundamentals?.marketCap;

  const hasAny = summary || industry || sector || site || location || employees !== undefined || marketCap !== undefined;
  if (!hasAny) {
    return (
      <div className="surface rounded-2xl p-6 shadow-soft">
        <div className="flex items-center gap-2 text-muted">
          <Info className="h-4 w-4" />
          <p className="text-sm">Company profile is not available for {symbol} yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface rounded-2xl p-6 shadow-soft">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted">
        <Building2 className="h-3.5 w-3.5" />
        About {name}
      </div>

      {summary && (
        <ExpandableText lines={4} className="mt-3 text-sm leading-relaxed text-fg/85">
          {summary}
        </ExpandableText>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(sector || industry) && (
          <Stat
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Business"
            value={industry ?? sector ?? ""}
            sub={industry && sector && industry !== sector ? sector : undefined}
          />
        )}
        {location && (
          <Stat
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Headquarters"
            value={location}
          />
        )}
        {employees !== undefined && (
          <Stat
            icon={<Users className="h-3.5 w-3.5" />}
            label="Employees"
            value={fmtEmployees(employees)}
          />
        )}
        {marketCap !== undefined && (
          <Stat
            icon={<Landmark className="h-3.5 w-3.5" />}
            label="Market cap"
            value={formatCompactINR(marketCap)}
          />
        )}
        {site && (
          <Stat
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Website"
            value={
              <a
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                {site.display}
              </a>
            }
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-bg/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
