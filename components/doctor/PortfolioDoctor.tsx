"use client";

import { useState, useCallback } from "react";
import { Loader2, FileText, Stethoscope, RotateCcw, CheckCircle2 } from "lucide-react";
import { parseHoldingsCsv } from "@/lib/doctor/portfolio";
import type { Holding, Diagnosis } from "@/lib/doctor/schema";
import type { AnalysisSummary, CsvParseResult } from "@/lib/doctor/portfolio";
import { UploadDropzone } from "./UploadDropzone";
import { CsvDropzone } from "./CsvDropzone";
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
  const [csvImport, setCsvImport] = useState<{ detected: CsvParseResult["detected"]; warnings: string[] } | null>(null);

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

  const handleCsvText = useCallback((text: string) => {
    setError(null);
    const result = parseHoldingsCsv(text);
    if (result.holdings.length === 0) {
      setError(result.errors[0] ?? "No holdings found in CSV. Check the format and try again.");
      return;
    }
    setHoldings(result.holdings);
    setUnresolvedRows([]);
    setImportSource("csv");
    setCsvImport({ detected: result.detected, warnings: result.warnings });
    setStage("review");
  }, []);

  const handleCsvSubmit = () => {
    if (!csv.trim()) {
      setError("Paste rows or upload a file.");
      return;
    }
    handleCsvText(csv);
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
    setCsvImport(null);
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
        />
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="mt-6 space-y-4">
        {csvImport && (
          <div className="surface rounded-xl p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                <CheckCircle2 className="h-3.5 w-3.5" /> Parsed {holdings.length} {holdings.length === 1 ? "holding" : "holdings"}
              </span>
              {csvImport.detected.hasHeader && csvImport.detected.columns ? (
                <span className="text-muted">
                  Detected columns:
                  {" "}<code className="rounded bg-bg/40 px-1.5 py-0.5">{csvImport.detected.columns.symbol}</code>
                  {" → symbol · "}
                  <code className="rounded bg-bg/40 px-1.5 py-0.5">{csvImport.detected.columns.qty}</code>
                  {" → qty · "}
                  <code className="rounded bg-bg/40 px-1.5 py-0.5">{csvImport.detected.columns.avg}</code>
                  {" → avg"}
                </span>
              ) : (
                <span className="text-muted">Positional format (SYMBOL,QTY,AVG)</span>
              )}
              {csvImport.detected.skippedRows > 0 && (
                <span className="text-muted">· skipped {csvImport.detected.skippedRows} non-holding {csvImport.detected.skippedRows === 1 ? "row" : "rows"}</span>
              )}
            </div>
            {csvImport.warnings.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-muted">
                {csvImport.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}
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
          <div className="space-y-3">
            <CsvDropzone onText={handleCsvText} busy={busy} />
            <div className="surface rounded-2xl p-5 shadow-soft">
              <h2 className="text-sm font-semibold">Or paste rows directly</h2>
              <p className="mt-1 text-[11px] text-muted">
                Works with broker exports (headers auto-detected) or the simple <code className="rounded bg-card px-1.5 py-0.5">SYMBOL,QTY,AVG</code> format.
              </p>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={8}
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
            <span className="text-brand">●</span>
            <span>
              <strong>Per-stock quality issues + rebalance ideas</strong> — flags valuation, debt, and concentration moves to consider.
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
