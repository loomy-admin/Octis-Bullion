import { PageHeader } from "@/components/page-header";
import { getRateBlocks } from "@/lib/services/rate-block-service";
import { listCounterparties } from "@/lib/services/counterparty-service";
import { getAllMetals } from "@/lib/services/master-service";
import { requireUser } from "@/lib/auth/session";
import { RateBlocksClient } from "./rate-blocks-client";

export const metadata = {
  title: "Rate Booking & Price Reservations — Bullion",
};

export default async function RateBlocksPage() {
  const user = await requireUser();

  const [rateBlocks, counterparties, metals] = await Promise.all([
    getRateBlocks({ status: "ALL" }),
    listCounterparties({ isActive: true }),
    getAllMetals(true),
  ]);

  const serializedBlocks = rateBlocks.map((b: any) => ({
    id: b.id,
    blockNumber: b.blockNumber,
    counterpartyId: b.counterpartyId,
    metalId: b.metalId,
    purityId: b.purityId,
    blockedWeightGrams: b.blockedWeightGrams.toString(),
    blockedRatePerGram: b.blockedRatePerGram.toString(),
    totalBlockedAmount: b.totalBlockedAmount.toString(),
    advanceAmount: b.advanceAmount ? b.advanceAmount.toString() : "0.00",
    validUntil: new Date(b.validUntil).toISOString(),
    status: b.status,
    fulfilledSaleId: b.fulfilledSaleId,
    notes: b.notes,
    createdAt: new Date(b.createdAt).toISOString(),
    counterparty: b.counterparty
      ? {
          id: b.counterparty.id,
          name: b.counterparty.name,
          phone: b.counterparty.phone,
          type: b.counterparty.type,
        }
      : null,
    metal: b.metal
      ? {
          id: b.metal.id,
          name: b.metal.name,
          code: b.metal.code,
        }
      : null,
    purity: b.purity
      ? {
          id: b.purity.id,
          name: b.purity.name,
          purityPercentage: b.purity.purityPercentage.toString(),
        }
      : null,
    fulfilledSale: b.fulfilledSale
      ? {
          id: b.fulfilledSale.id,
          invoiceNumber: b.fulfilledSale.invoiceNumber,
          totalAmount: b.fulfilledSale.totalAmount.toString(),
          status: b.fulfilledSale.status,
        }
      : null,
    createdBy: b.createdBy
      ? {
          id: b.createdBy.id,
          name: b.createdBy.name,
        }
      : null,
  }));

  const serializedCounterparties = counterparties.map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    type: c.type,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Booking & Reservations"
        subtitle="Lock in metal rates with advance deposits, timer expirations, and one-click fulfillment into sales invoices."
      />
      <RateBlocksClient
        initialBlocks={serializedBlocks}
        counterparties={serializedCounterparties}
        metals={serializedMetals}
        userRole={user.role}
      />
    </div>
  );
}
