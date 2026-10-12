import { PageHeader } from "@/components/page-header";
import { getLiveRates } from "@/lib/services/rate-service";
import { getAllMetals } from "@/lib/services/master-service";
import { requireUser } from "@/lib/auth/session";
import { RatesClient } from "./rates-client";

export const metadata = {
  title: "Rate Desk & Landed Cost Calculator — Bullion",
};

export default async function RatesPage() {
  const user = await requireUser();

  const [rates, metals] = await Promise.all([
    getLiveRates(),
    getAllMetals(true),
  ]);

  const serializedRates = rates.map((r: any) => ({
    id: r.id,
    metalId: r.metalId,
    purityId: r.purityId,
    buyRate: r.buyRate.toString(),
    sellRate: r.sellRate.toString(),
    mcxBenchmarkRate: r.mcxBenchmarkRate ? r.mcxBenchmarkRate.toString() : null,
    usdOunceRate: r.usdOunceRate ? r.usdOunceRate.toString() : null,
    usdInrRate: r.usdInrRate ? r.usdInrRate.toString() : null,
    customsDutyPct: r.customsDutyPct ? r.customsDutyPct.toString() : "15.00",
    gstPct: r.gstPct ? r.gstPct.toString() : "3.00",
    marginPerGram: r.marginPerGram ? r.marginPerGram.toString() : "50.00",
    landedCostPerGram: r.landedCostPerGram ? r.landedCostPerGram.toString() : null,
    isLive: r.isLive,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    metal: r.metal ? { id: r.metal.id, name: r.metal.name, code: r.metal.code } : null,
    purity: r.purity ? { id: r.purity.id, label: r.purity.label, fineness: r.purity.fineness.toString() } : null,
    updatedBy: r.updatedBy ? { id: r.updatedBy.id, name: r.updatedBy.name, email: r.updatedBy.email } : null,
  }));

  const serializedMetals = metals.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    purities: (m.purities || []).map((p: any) => ({
      id: p.id,
      label: p.label,
      fineness: p.fineness.toString(),
      isActive: p.isActive,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Desk & Landed Cost Calculator"
        subtitle="Live spot rate board, customs duty + GST landed per-gram calculator, and catalog price management"
      />
      <RatesClient
        initialRates={serializedRates}
        metals={serializedMetals}
        userRole={user.role}
      />
    </div>
  );
}
