import { z } from "zod";

export const CreateDenominationSchema = z.object({
  metalId: z.string().min(1, "Metal is required"),
  purityId: z.string().min(1, "Purity is required"),
  type: z.enum(["BAR", "COIN"]),
  name: z.string().min(2, "Name is required"),
  weightGrams: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Weight must be greater than 0"),
  premiumAmount: z
    .string()
    .optional()
    .default("0")
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Premium must be >= 0"),
  isActive: z.boolean().optional().default(true),
});

export const UpdateDenominationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  premiumAmount: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Premium must be >= 0"),
  isActive: z.boolean().optional(),
});
