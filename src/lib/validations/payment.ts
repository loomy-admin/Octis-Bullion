import { z } from "zod";

export const CreatePaymentSchema = z.object({
  type: z.enum(["PAYMENT_MADE", "PAYMENT_RECEIVED"]),
  counterpartyId: z.string().min(1, "Counterparty is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "RTGS_NEFT", "OTHER"]).default("CASH"),
  date: z.string().or(z.date()).optional(),
  referenceNumber: z.string().max(128).optional().nullable(),
  linkedPurchaseId: z.string().optional().nullable(),
  linkedSaleId: z.string().optional().nullable(),
  cashDenominations: z
    .object({
      500: z.coerce.number().int().nonnegative().optional(),
      200: z.coerce.number().int().nonnegative().optional(),
      100: z.coerce.number().int().nonnegative().optional(),
      50: z.coerce.number().int().nonnegative().optional(),
      20: z.coerce.number().int().nonnegative().optional(),
      10: z.coerce.number().int().nonnegative().optional(),
      coins: z.coerce.number().int().nonnegative().optional(),
    })
    .optional()
    .nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const CancelPaymentSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  reason: z.string().min(3, "Cancellation reason must be at least 3 characters"),
});
