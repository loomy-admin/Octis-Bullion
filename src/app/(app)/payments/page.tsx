import { PageHeader } from "@/components/page-header";
import { getPaymentsList } from "@/lib/services/payment-service";
import { listCounterparties } from "@/lib/services/counterparty-service";
import { listPurchases } from "@/lib/services/purchase-service";
import { listSales } from "@/lib/services/sale-service";
import { requireUser } from "@/lib/auth/session";
import { PaymentsClient } from "./payments-client";

export const metadata = {
  title: "Payments & Receipts — Bullion",
};

export default async function PaymentsPage() {
  const user = await requireUser();

  const [{ payments }, counterparties, purchases, sales] = await Promise.all([
    getPaymentsList({ limit: 100 }),
    listCounterparties({ isActive: true }),
    listPurchases(),
    listSales(),
  ]);

  const serializedPayments = payments.map((p) => {
    const raw = p.toJSON() as any;
    return {
      id: raw.id,
      paymentNumber: raw.paymentNumber,
      type: raw.type,
      counterpartyId: raw.counterpartyId,
      partyName: raw.partyName,
      date: new Date(raw.date).toISOString(),
      amount: raw.amount.toString(),
      paymentMode: raw.paymentMode,
      referenceNumber: raw.referenceNumber,
      linkedPurchaseId: raw.linkedPurchaseId,
      linkedSaleId: raw.linkedSaleId,
      cashDenominations: raw.cashDenominations,
      status: raw.status,
      cancelReason: raw.cancelReason,
      cancelledAt: raw.cancelledAt ? new Date(raw.cancelledAt).toISOString() : null,
      notes: raw.notes,
      createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
      counterparty: raw.counterparty ? {
        id: raw.counterparty.id,
        name: raw.counterparty.name,
        phone: raw.counterparty.phone,
        type: raw.counterparty.type,
      } : null,
      purchase: raw.purchase ? {
        id: raw.purchase.id,
        invoiceNumber: raw.purchase.invoiceNumber,
        totalAmount: raw.purchase.totalAmount.toString(),
      } : null,
      sale: raw.sale ? {
        id: raw.sale.id,
        invoiceNumber: raw.sale.invoiceNumber,
        totalAmount: raw.sale.totalAmount.toString(),
      } : null,
      createdBy: raw.createdBy ? {
        id: raw.createdBy.id,
        name: raw.createdBy.name,
        email: raw.createdBy.email,
      } : null,
    };
  });

  const serializedCounterparties = counterparties.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || null,
    type: c.type,
  }));

  const openPurchases = purchases
    .filter((p) => p.status === "POSTED")
    .map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      counterpartyId: p.counterpartyId || null,
      supplierName: p.supplierName,
      totalAmount: p.totalAmount.toString(),
    }));

  const openSales = sales
    .filter((s) => s.status === "POSTED")
    .map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      counterpartyId: s.counterpartyId || null,
      buyerName: s.buyerName,
      totalAmount: s.totalAmount.toString(),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Receipts"
        subtitle="Manage supplier payments, customer collections, cash denominations, and party balance ledgers"
      />
      <PaymentsClient
        initialPayments={serializedPayments}
        counterparties={serializedCounterparties}
        purchases={openPurchases}
        sales={openSales}
        currentUser={{
          id: user.id,
          name: user.name,
          role: user.role,
        }}
      />
    </div>
  );
}
