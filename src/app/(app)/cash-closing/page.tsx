import { PageHeader } from "@/components/page-header";
import {
  getCashSummaryForDate,
  listCashClosings,
} from "@/lib/services/cash-closing-service";
import { requireUser } from "@/lib/auth/session";
import { CashClosingClient } from "./cash-closing-client";

export const metadata = {
  title: "Cashier Counter Closing & Reconciliation — Bullion",
};

export default async function CashClosingPage() {
  const user = await requireUser();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [todaySummary, recentClosings] = await Promise.all([
    getCashSummaryForDate(todayStr),
    listCashClosings(30),
  ]);

  const serializedSummary = {
    closingDate: todaySummary.closingDate,
    openingBalance: todaySummary.openingBalance.toString(),
    totalCashReceived: todaySummary.totalCashReceived.toString(),
    totalCashPaid: todaySummary.totalCashPaid.toString(),
    expectedBalance: todaySummary.expectedBalance.toString(),
    paymentReceiptsCount: todaySummary.paymentReceiptsCount,
    paymentDisbursementsCount: todaySummary.paymentDisbursementsCount,
    cashSalesCount: todaySummary.cashSalesCount,
    cashPurchasesCount: todaySummary.cashPurchasesCount,
  };

  const serializedClosings = recentClosings.map((c: any) => ({
    id: c.id,
    closingDate: c.closingDate ? new Date(c.closingDate).toISOString().slice(0, 10) : "",
    shift: c.shift,
    openingBalance: c.openingBalance.toString(),
    totalCashReceived: c.totalCashReceived.toString(),
    totalCashPaid: c.totalCashPaid.toString(),
    expectedBalance: c.expectedBalance.toString(),
    physicalBalance: c.physicalBalance.toString(),
    difference: c.difference.toString(),
    status: c.status,
    denominations: c.denominations,
    notes: c.notes,
    createdAt: new Date(c.createdAt).toISOString(),
    closedBy: c.closedBy
      ? {
          id: c.closedBy.id,
          name: c.closedBy.name,
          email: c.closedBy.email,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cashier Drawer Closing & Day Reconciliation"
        subtitle="End-of-day cash drawer balancing: tally physical notes (₹500, ₹200, ₹100...) against system inflows/outflows with automated variance reporting."
      />
      <CashClosingClient
        initialSummary={serializedSummary}
        initialClosings={serializedClosings}
        userRole={user.role}
        userName={user.name || "Cashier"}
      />
    </div>
  );
}
