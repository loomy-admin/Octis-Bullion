import { z } from "zod";

export const RecordCashClosingSchema = z.object({
  closingDate: z.string().min(10, "Closing date is required (YYYY-MM-DD)"),
  shift: z.enum(["MORNING", "EVENING", "FULL_DAY"]).default("FULL_DAY"),
  openingBalance: z
    .string()
    .optional()
    .default("0")
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Opening balance must be >= 0"),
  totalCashReceived: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Cash received must be >= 0"),
  totalCashPaid: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Cash paid must be >= 0"),
  denominations: z.record(z.string(), z.number().int().min(0)),
  notes: z.string().max(500).optional(),
});

export type RecordCashClosingInput = z.infer<typeof RecordCashClosingSchema>;
