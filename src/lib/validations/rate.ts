import { z } from "zod";

const positiveDecimalString = (field: string) =>
  z
    .string()
    .min(1, `${field} is required`)
    .refine(
      (v) => {
        const n = parseFloat(v);
        return !isNaN(n) && n > 0;
      },
      { message: `${field} must be a positive number` }
    );

export const SetRateSchema = z.object({
  metalId: z.string().min(1, "Metal is required"),
  purityId: z.string().min(1, "Purity is required"),
  buyRate: positiveDecimalString("Buy rate"),
  sellRate: positiveDecimalString("Sell rate"),
  mcxBenchmarkRate: z.string().optional(),
  usdOunceRate: z.string().optional(),
  usdInrRate: z.string().optional(),
  customsDutyPct: z.string().optional(),
  gstPct: z.string().optional(),
  marginPerGram: z.string().optional(),
});

export const LandedCostCalculatorSchema = z.object({
  usdOuncePrice: z.string().min(1, "Ounce price is required"),
  usdInrRate: z.string().min(1, "USD/INR rate is required"),
  customsDutyPct: z.string().optional(),
  gstPct: z.string().optional(),
  marginPerGram: z.string().optional(),
});

export type SetRateInput = z.infer<typeof SetRateSchema>;
export type LandedCostCalculatorInput = z.infer<typeof LandedCostCalculatorSchema>;
