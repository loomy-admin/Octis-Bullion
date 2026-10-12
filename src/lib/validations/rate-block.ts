import { z } from "zod";

export const CreateRateBlockSchema = z.object({
  counterpartyId: z.string().min(1, "Customer / Party is required"),
  metalId: z.string().min(1, "Metal is required"),
  purityId: z.string().min(1, "Purity is required"),
  blockedWeightGrams: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Weight must be greater than 0"),
  blockedRatePerGram: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Rate must be greater than 0"),
  advanceAmount: z
    .string()
    .optional()
    .default("0")
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Advance must be >= 0"),
  validHours: z
    .number()
    .min(1, "Validity must be at least 1 hour")
    .max(168, "Validity cannot exceed 7 days (168h)")
    .default(4),
  notes: z.string().max(500).optional(),
});

export type CreateRateBlockInput = z.infer<typeof CreateRateBlockSchema>;

export const CancelRateBlockSchema = z.object({
  blockId: z.string().min(1),
  reason: z.string().min(3, "Cancellation reason is required"),
});
