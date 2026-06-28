import { z } from "zod";

// Trigger config — what the user picks per alert. At least one must be present.

export const PriceTriggerSchema = z.object({
  condition: z.enum(["above", "below"]),
  target: z.number().positive().max(1_000_000),
});

export const MoveTriggerSchema = z.object({
  pctAbs: z.number().positive().max(50),
});

export const VolumeTriggerSchema = z.object({
  multiple: z.number().positive().min(1.1).max(20),
});

export const NewsTriggerSchema = z.object({
  enabled: z.literal(true),
});

export const TriggersSchema = z
  .object({
    price: PriceTriggerSchema.optional(),
    move: MoveTriggerSchema.optional(),
    volume: VolumeTriggerSchema.optional(),
    news: NewsTriggerSchema.optional(),
  })
  .refine((t) => Object.keys(t).length > 0, {
    message: "Enable at least one trigger.",
  });

export type Triggers = z.infer<typeof TriggersSchema>;
export type TriggerKind = "price" | "move" | "volume" | "news";

// What we persist in alert_notifications.payload.

export const PriceNotificationPayload = z.object({
  current: z.number(),
  target: z.number(),
  condition: z.enum(["above", "below"]),
});
export const MoveNotificationPayload = z.object({
  current: z.number(),
  changePct: z.number(),
  threshold: z.number(),
});
export const VolumeNotificationPayload = z.object({
  volume: z.number(),
  avg20d: z.number(),
  multiple: z.number(),
});
export const NewsNotificationPayload = z.object({
  url: z.string().url(),
  title: z.string(),
  publisher: z.string(),
  publishedAt: z.number(),
  materiality: z.number().min(0).max(10),
});

// AlertRow shape returned by the API. Includes the legacy price columns so the
// API stays backward compatible with any cached UI bundles.
export const AlertRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  symbol: z.string(),
  exchange: z.enum(["NSE", "BSE"]),
  label: z.string().nullable().optional(),
  triggers: TriggersSchema,
  status: z.enum(["active", "paused"]),
  last_notified_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AlertRow = z.infer<typeof AlertRowSchema>;

export const CreateAlertBodySchema = z.object({
  symbol: z.string().trim().toUpperCase().min(1).max(20),
  exchange: z.enum(["NSE", "BSE"]).default("NSE"),
  label: z.string().trim().max(80).optional(),
  triggers: TriggersSchema,
});

export const PatchAlertBodySchema = z.object({
  triggers: TriggersSchema.optional(),
  status: z.enum(["active", "paused"]).optional(),
  label: z.string().trim().max(80).nullable().optional(),
});
