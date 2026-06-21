"use client";

import { useState, useCallback } from "react";
import { Loader2, FileText, Stethoscope, RotateCcw } from "lucide-react";
import { parseCsv } from "@/lib/doctor/portfolio";
import type { Holding, Diagnosis } from "@/lib/doctor/schema";
import type { AnalysisSummary } from "@/lib/doctor/portfolio";
import { UploadDropzone } from "./UploadDropzone";
import { HoldingsEditor } from "./HoldingsEditor";
import { DiagnosisReport } from "./DiagnosisReport";

const ANON_GATE_KEY = "sb:doctorUsedAnon";
const ANON_DAILY_LIMIT = 3;

type Stage = "input" | "review" | "report";

type DiagnoseResponse = {
  importId: string | null;
  diagnosis: Diagnosis;
  analysis: AnalysisSummary;
  source: "llm" | "cache" | "fallback";
};

const SAMPLE_CSV = `RELIANCE,10,2400
TCS,5,3500
HDFCBANK,15,1450
INFY,8,1600`;

export function PortfolioDoctor() {
  const [stage, setStage] = useState<Stage>("input");
  const [mode, setMode] = useState<"screenshot" | "csv">("screenshot");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [unresolvedRows, setUnresolvedRows] = useState<string[]>([]);
  const [importSource, setImportSource] = useState<"screenshot" | "csv" | "manual">("manual");

  const [report, setReport] = useState<DiagnoseResponse | null>(null);

  const handleImage = useCallback(async (base64: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/doctor/parse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      const parsed: Holding[] = json.holdings ?? [];
      if (parsed.length === 0 && (json.unresolvedRows ?? []).length === 0) {
        throw new Error("No holdings detected. Try a clearer screenshot or use CSV paste.");
      }
      setHoldings(parsed);
      setUnresolvedRows(json.unresolvedRows ?? []);
      setImportSource("screenshot");
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCsvSubmit = () => {
    setError(null);
    const { holdings: parsed, errors } = parseCsv(csv);
    if (errors.length > 0 && parsed.length === 0) {
      setError(errors[0] ?? "Could not parse CSV.");
      return;
    }
    if (parsed.length === 0) {
      setError("Add at least one holding.");
      return;
    }
    setHoldings(parsed);
    setUnresolvedRows([]);
    setImportSource("csv");
    setStage("review");
  };

  const validHoldings = holdings.filter((h) => h.symbol && h.qty > 0 && h.avg > 0);

  const handleDiagnose = async () => {
    if (validHoldings.length === 0) {
      setError("Need at least 1 valid holding.");
      return;
    }
    if (typeof window !== "undefined" && Number(localStorage.getItem(ANON_GATE_KEY) ?? "0") >= ANON_DAILY_LIMIT) {
      setError("Free anon limit reached — sign up to keep diagnosing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/doctor/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: validHoldings, source: importSource }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setReport(json);
      setStage("report");
      if (typeof window !== "undefined") {
        const used = Number(localStorage.getItem(ANON_GATE_KEY) ?? "0") + 1;
        localStorage.setItem(ANON_GATE_KEY, String(used));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnosis failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStage("input");
    setHoldings([]);
    setUnresolvedRows([]);
    setReport(null);
    setError(null);
    setCsv("");
  };

  if (stage === "report" && report) {
    return (
      <div className="mt-6 space-y-4">
        <button onClick={reset} className="btn-ghost inline-flex items-center gap-2 text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          Diagnose another portfolio
        </button>
        <DiagnosisReport
          diagnosis={report.diagnosis}
          analysis={report.analysis}
          source={report.source}
          isPro={false}
        />
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="mt-6 space-y-4">
        <HoldingsEditor
          value={holdings}
          unresolvedRows={unresolvedRows}
          onChange={setHoldings}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDiagnose}
            disabled={busy || validHoldings.length === 0}
            className="btn-brand inline-flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
            {busy ? "Diagnosing…" : `Diagnose ${validHoldings.length} holdings`}
          </button>
          <button onClick={reset} className="btn-ghost text-xs">
            Start over
          </button>
        </div>
        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("screenshot")}
            className={`btn-${mode === "screenshot" ? "brand" : "ghost"} text-xs`}
          >
            Screenshot
          </button>
          <button
            onClick={() => setMode("csv")}
            className={`btn-${mode === "csv" ? "brand" : "ghost"} text-xs`}
          >
            Paste CSV
          </button>
        </div>
        {mode === "screenshot" ? (
          <UploadDropzone onImage={handleImage} busy={busy} />
        ) : (
          <div className="surface rounded-2xl p-5 shadow-soft">
            <h2 className="text-sm font-semibold">Paste your holdings</h2>
            <p className="mt-1 text-[11px] text-muted">
              Format: <code className="rounded bg-card px-1.5 py-0.5">SYMBOL,QTY,AVG_PRICE</code> · one per line.
            </p>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={10}
              placeholder={SAMPLE_CSV}
              className="mt-3 w-full rounded-lg border border-border bg-bg/40 p-3 font-mono text-sm focus:border-brand focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCsvSubmit}
                disabled={!csv.trim()}
                className="btn-brand inline-flex items-center gap-2 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Continue
              </button>
              <button onClick={() => setCsv(SAMPLE_CSV)} className="btn-ghost text-xs">
                Try sample
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>

      <aside className="surface relative overflow-hidden rounded-2xl p-6 shadow-soft">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
        <h3 className="text-sm font-semibold">What you'll get</h3>
        <ul className="mt-3 space-y-2.5 text-xs text-fg/85">
          <li className="flex gap-2">
            <span className="text-brand">●</span>
            <span>
              <strong>Health score</strong> — 0–100, accounting for concentration, sector tilt, and cluster risks.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand">●</span>
            <span>
              <strong>Doctor's note</strong> — 2–3 brutally honest sentences a senior friend would tell you.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand">●</span>
            <span>
              <strong>Red flags</strong> — concentration risks, sector overweights, diversification gaps.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand">●</span>
            <span>
              <strong>Sector tilt vs Nifty 50</strong> — see exactly where you over/underweight the market.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted">●</span>
            <span className="text-muted">
              <strong>Per-stock quality issues + rebalance ideas</strong> — Pro only.
            </span>
          </li>
        </ul>
        <p className="mt-5 text-[10px] text-muted">
          Nothing leaves your browser except the holdings data we need to fetch live prices and run the
          diagnosis. We never store screenshots.
        </p>
      </aside>
    </div>
  );
}
