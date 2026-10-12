import { PageHeader } from "@/components/page-header";
import { listDenominations } from "@/lib/services/denomination-service";
import { getAllMetals } from "@/lib/services/master-service";
import { getLiveRates } from "@/lib/services/rate-service";
import { requireUser } from "@/lib/auth/session";
import { DenominationsClient } from "./denominations-client";

export const metadata = {
  title: "Metal Denominations & Physical Breakdown — Bullion",
};

export default async function DenominationsPage() {
  const user = await requireUser();

  const [denominations, metals, liveRates] = await Promise.all([
    listDenominations(),
    getAllMetals(true),
    getLiveRates(),
  ]);

  const serializedDenominations = denominations.map((d: any) => ({
    id: d.id,
    metalId: d.metalId,
    purityId: d.purityId,
    type: d.type,
    name: d.name,
    weightGrams: d.weightGrams.toString(),
    premiumAmount: d.premiumAmount ? d.premiumAmount.toString() : "0.00",
    isActive: d.isActive,
    metal: d.metal
      ? {
          id: d.metal.id,
          name: d.metal.name,
          code: d.metal.code,
        }
      : null,
    purity: d.purity
      ? {
          id: d.purity.id,
          name: d.purity.name,
          purityPercentage: d.purity.purityPercentage.toString(),
        }
      : null,
  }));

  const serializedMetals = metals.map((m: any) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    purities: m.purities.map((p: any) => ({
      id: p.id,
      name: p.name,
      purityPercentage: p.purityPercentage.toString(),
    })),
  }));

  const serializedRates = liveRates.map((r: any) => ({
    metalId: r.metalId,
    purityId: r.purityId,
    sellRate: r.sellRate.toString(),
    buyRate: r.buyRate.toString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coins, Bars & Physical Breakdown Desk"
        subtitle="Catalogue of physical gold/silver denominations with minting premiums, plus real-time weight decomposition optimizer."
      />
      <DenominationsClient
        initialDenominations={serializedDenominations}
        metals={serializedMetals}
        rates={serializedRates}
        userRole={user.role}
      />
    </div>
  );
}
