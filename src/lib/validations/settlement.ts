import { z } from "zod";

export const RecordSettlementSchema = z.object({
  counterpartyId: z.string().min(1, "Counterparty is required"),
  date: z.string().optional(),
  metalId: z.string().min(1, "Metal is required"),
  purityId: z.string().min(1, "Purity is required"),
  metalSettledGrams: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val) && val >= 0, "Metal weight must be 0 or greater"),
  metalDirection: z.enum(["DELIVER_TO_PARTY", "RECEIVE_FROM_PARTY"]),
  cashSettledAmount: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val) && val >= 0, "Cash amount must be 0 or greater"),
  cashDirection: z.enum(["PAY_TO_PARTY", "RECEIVE_FROM_PARTY"]),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "RTGS_NEFT", "OTHER"]).default("CASH"),
  referenceNumber: z.string().max(100).optional().nullable(),
  currentMetalBalanceGrams: z.union([z.number(), z.string()]).optional().nullable(),
  currentCashBalance: z.union([z.number(), z.string()]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => data.metalSettledGrams > 0 || data.cashSettledAmount > 0,
  "Either metal weight or cash amount must be greater than zero"
);

export const CancelSettlementSchema = z.object({
  settlementId: z.string().min(1, "Settlement ID is required"),
  reason: z.string().min(3, "Cancellation reason must be at least 3 characters"),
});
