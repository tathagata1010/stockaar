import { z } from "zod";

export const HoldingSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase().trim()),
  qty: z.number().positive().finite(),
  avg: z.number().positive().finite(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const SeverityEnum = z.enum(["high", "med", "low"]);
export type Severity = z.infer<typeof SeverityEnum>;

export const RedFlagSchema = z.object({
  severity: SeverityEnum,
  title: z.string().min(3).max(120),
  message: z.string().min(8).max(500),
  affected_symbols: z.array(z.string()).max(20).default([]),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;

export const QualityIssueSchema = z.object({
  symbol: z.string().min(1).max(20),
  issue: z.string().min(3).max(160),
  evidence: z.string().min(3).max(400),
});
export type QualityIssue = z.infer<typeof QualityIssueSchema>;

export const RebalanceSuggestionSchema = z.object({
  action: z.string().min(3).max(160),
  symbol: z.string().min(1).max(20).nullable().optional(),
  rationale: z.string().min(8).max(400),
});
export type RebalanceSuggestion = z.infer<typeof RebalanceSuggestionSchema>;

export const SectorTiltSchema = z.object({
  dominant: z.string().min(1).max(60),
  pct: z.number().min(0).max(100),
  vs_nifty_pct: z.number(),
});
export type SectorTilt = z.infer<typeof SectorTiltSchema>;

export const DiagnosisSchema = z.object({
  health_score: z.number().int().min(0).max(100),
  doctors_note: z.string().min(8).max(360),
  red_flags: z.array(RedFlagSchema).max(8).default([]),
  quality_issues: z.array(QualityIssueSchema).max(20).default([]),
  rebalance_suggestions: z.array(RebalanceSuggestionSchema).max(8).default([]),
  sector_tilt: SectorTiltSchema.nullable().optional(),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const ParsedHoldingsSchema = z.object({
  holdings: z.array(HoldingSchema).max(100),
  unresolved_rows: z.array(z.string()).max(40).default([]),
});
export type ParsedHoldings = z.infer<typeof ParsedHoldingsSchema>;
