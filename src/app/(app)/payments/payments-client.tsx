"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils/helpers";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Loader2,
  Receipt,
  Building,
  Coins,
  History,
  Lock,
} from "lucide-react";
import {
  createPaymentAction,
  cancelPaymentAction,
  getPartyOutstandingAction,
} from "@/lib/actions/payment-actions";

interface CounterpartyItem {
  id: string;
  name: string;
  phone: string | null;
  type: "SUPPLIER" | "CUSTOMER" | "BOTH";
}

interface PaymentItem {
  id: string;
  paymentNumber: string;
  type: "PAYMENT_MADE" | "PAYMENT_RECEIVED";
  counterpartyId: string;
  partyName: string;
  date: string;
  amount: string;
  paymentMode: string;
  referenceNumber: string | null;
  linkedPurchaseId: string | null;
  linkedSaleId: string | null;
  cashDenominations: any;
  status: "POSTED" | "CANCELLED";
  cancelReason: string | null;
  cancelledAt: string | null;
  notes: string | null;
  counterparty: CounterpartyItem | null;
  purchase: { id: string; invoiceNumber: string; totalAmount: string } | null;
  sale: { id: string; invoiceNumber: string; totalAmount: string } | null;
  createdBy: { id: string; name: string; email: string } | null;
}

interface PaymentsClientProps {
  initialPayments: PaymentItem[];
  counterparties: CounterpartyItem[];
  purchases: Array<{ id: string; invoiceNumber: string; counterpartyId: string | null; supplierName: string; totalAmount: string }>;
  sales: Array<{ id: string; invoiceNumber: string; counterpartyId: string | null; buyerName: string; totalAmount: string }>;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function PaymentsClient({
  initialPayments,
  counterparties,
  purchases,
  sales,
  currentUser,
}: PaymentsClientProps) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [search, setSearch] = useState("");
  const [typeTab, setTypeTab] = useState<"ALL" | "PAYMENT_RECEIVED" | "PAYMENT_MADE">("ALL");
  const [statusTab, setStatusTab] = useState<"ALL" | "POSTED" | "CANCELLED">("ALL");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formType, setFormType] = useState<"PAYMENT_RECEIVED" | "PAYMENT_MADE">("PAYMENT_RECEIVED");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER">("CASH");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [linkedPurchaseId, setLinkedPurchaseId] = useState("");
  const [linkedSaleId, setLinkedSaleId] = useState("");
  const [notes, setNotes] = useState("");
  const [denoms, setDenoms] = useState<{ [key: string]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0,
  });

  // Slip & Ledger Modals
  const [selectedSlip, setSelectedSlip] = useState<PaymentItem | null>(null);
  const [cancelModalItem, setCancelModalItem] = useState<PaymentItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [partyLedger, setPartyLedger] = useState<any | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Calculated physical cash sum
  const calculatedCashTotal =
    (denoms[500] || 0) * 500 +
    (denoms[200] || 0) * 200 +
    (denoms[100] || 0) * 100 +
    (denoms[50] || 0) * 50 +
    (denoms[20] || 0) * 20 +
    (denoms[10] || 0) * 10 +
    (denoms.coins || 0);

  const amountNum = parseFloat(amount) || 0;
  const cashDiff = amountNum - calculatedCashTotal;

  // Filtered Payments
  const filtered = payments.filter((p) => {
    if (typeTab !== "ALL" && p.type !== typeTab) return false;
    if (statusTab !== "ALL" && p.status !== statusTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNumber = p.paymentNumber.toLowerCase().includes(q);
      const matchParty = p.partyName.toLowerCase().includes(q);
      const matchRef = (p.referenceNumber || "").toLowerCase().includes(q);
      if (!matchNumber && !matchParty && !matchRef) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalReceived = payments
    .filter((p) => p.type === "PAYMENT_RECEIVED" && p.status === "POSTED")
    .reduce((acc, p) => acc + parseFloat(p.amount), 0);

  const totalPaid = payments
    .filter((p) => p.type === "PAYMENT_MADE" && p.status === "POSTED")
    .reduce((acc, p) => acc + parseFloat(p.amount), 0);

  const netCashFlow = totalReceived - totalPaid;

  // Available counterparties based on selected form type
  const availableCounterparties = counterparties.filter((c) => {
    if (formType === "PAYMENT_RECEIVED") {
      return c.type === "CUSTOMER" || c.type === "BOTH";
    }
    return c.type === "SUPPLIER" || c.type === "BOTH";
  });

  // Linked invoice choices
  const availablePurchases = purchases.filter((p) => p.counterpartyId === counterpartyId);
  const availableSales = sales.filter((s) => s.counterpartyId === counterpartyId);

  // Handle Create Payment
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!counterpartyId) {
      setErrorMsg("Please select a counterparty");
      return;
    }
    if (amountNum <= 0) {
      setErrorMsg("Payment amount must be greater than zero");
      return;
    }
    if (paymentMode === "CASH" && calculatedCashTotal > 0 && cashDiff !== 0) {
      setErrorMsg(
        `Physical cash denominations total (₹${calculatedCashTotal}) does not match payment amount (₹${amountNum})`
      );
      return;
    }

    startTransition(async () => {
      const payload: any = {
        type: formType,
        counterpartyId,
        amount: amountNum,
        paymentMode,
        date,
        referenceNumber: referenceNumber.trim() || null,
        linkedPurchaseId: linkedPurchaseId || null,
        linkedSaleId: linkedSaleId || null,
        notes: notes.trim() || null,
      };

      if (paymentMode === "CASH" && calculatedCashTotal > 0) {
        payload.cashDenominations = denoms;
      }

      const res = await createPaymentAction(payload);
      if (res.success && res.data) {
        setPayments([res.data as any, ...payments]);
        setSuccessMsg(`Payment ${res.data.paymentNumber} posted successfully!`);
        setShowCreateModal(false);
        resetForm();
      } else {
        setErrorMsg(res.error || "Failed to create payment");
      }
    });
  };

  // Handle Cancel / Reversal
  const handleCancelPayment = () => {
    if (!cancelModalItem || !cancelReason.trim()) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await cancelPaymentAction({
        paymentId: cancelModalItem.id,
        reason: cancelReason.trim(),
      });

      if (res.success && res.data) {
        setPayments(
          payments.map((p) => (p.id === cancelModalItem.id ? (res.data as any) : p))
        );
        setSuccessMsg(`Payment ${cancelModalItem.paymentNumber} reversed successfully!`);
        setCancelModalItem(null);
        setCancelReason("");
      } else {
        setErrorMsg(res.error || "Failed to reverse payment");
      }
    });
  };

  // Load Party Ledger
  const handleOpenPartyLedger = async (cId: string) => {
    setLoadingLedger(true);
    setPartyLedger(null);
    try {
      const res = await getPartyOutstandingAction(cId);
      if (res.success && res.data) {
        setPartyLedger(res.data);
      } else {
        setErrorMsg(res.error || "Failed to load party ledger");
      }
    } catch {
      setErrorMsg("Failed to load party ledger");
    } finally {
      setLoadingLedger(false);
    }
  };

  const resetForm = () => {
    setCounterpartyId("");
    setAmount("");
    setReferenceNumber("");
    setLinkedPurchaseId("");
    setLinkedSaleId("");
    setNotes("");
    setDenoms({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, coins: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Total Received (Inflow)
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {formatCurrency(totalReceived)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">Customer Collections</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Total Paid (Outflow)
            </div>
            <div className="text-xl font-bold font-mono text-amber-400">
              {formatCurrency(totalPaid)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">Supplier Disbursals</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Net Cash Movement
            </div>
            <div
              className={`text-xl font-bold font-mono ${
                netCashFlow >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(netCashFlow)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">Received − Paid</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#C59A58]/10 text-[#C59A58] border border-[#C59A58]/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Total Transactions
            </div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {payments.length}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              {payments.filter((p) => p.status === "POSTED").length} Posted •{" "}
              {payments.filter((p) => p.status === "CANCELLED").length} Reversed
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar & Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Tabs */}
          <div className="p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center gap-1 text-xs">
            <button
              onClick={() => setTypeTab("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                typeTab === "ALL"
                  ? "bg-[#C59A58] text-white font-semibold"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeTab("PAYMENT_RECEIVED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeTab === "PAYMENT_RECEIVED"
                  ? "bg-emerald-600 text-white font-semibold"
                  : "text-[var(--text-secondary)] hover:text-emerald-400"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Receipts
            </button>
            <button
              onClick={() => setTypeTab("PAYMENT_MADE")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeTab === "PAYMENT_MADE"
                  ? "bg-amber-600 text-white font-semibold"
                  : "text-[var(--text-secondary)] hover:text-amber-400"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Payments
            </button>
          </div>

          {/* Status Tabs */}
          <div className="p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center gap-1 text-xs">
            {(["ALL", "POSTED", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusTab(st)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusTab === st
                    ? "bg-white/10 text-white font-semibold"
                    : "text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {st === "ALL" ? "All Status" : st}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search & Create Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment #, party, ref..."
              className="pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58] w-56"
            />
          </div>

          <button
            onClick={() => {
              setFormType("PAYMENT_RECEIVED");
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Receive Money</span>
          </button>

          <button
            onClick={() => {
              setFormType("PAYMENT_MADE");
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Pay Money</span>
          </button>

          <button
            onClick={() => router.push("/cash-closing")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] hover:border-[#C59A58] text-[var(--text-primary)] font-semibold text-xs transition cursor-pointer"
          >
            <Lock className="w-4 h-4 text-[#C59A58]" />
            <span>Drawer Closing</span>
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-[var(--text-muted)] uppercase text-[10px] tracking-wider border-b border-[var(--border-primary)]">
              <tr>
                <th className="py-3 px-4">Payment # & Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Counterparty</th>
                <th className="py-3 px-4">Mode / Ref</th>
                <th className="py-3 px-4">Linked Invoice</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    No payment transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-white/2 transition-colors ${
                      p.status === "CANCELLED" ? "opacity-60 bg-red-500/5" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#C59A58]">{p.paymentNumber}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{formatDate(p.date)}</div>
                    </td>
                    <td className="py-3 px-4">
                      {p.type === "PAYMENT_RECEIVED" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ArrowDownLeft className="w-3 h-3" />
                          RECEIVED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <ArrowUpRight className="w-3 h-3" />
                          PAID
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)]">{p.partyName}</span>
                        {p.counterpartyId && (
                          <button
                            onClick={() => handleOpenPartyLedger(p.counterpartyId)}
                            title="View Party Ledger & Outstanding"
                            className="text-[var(--text-muted)] hover:text-[#C59A58] transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {p.counterparty?.phone && (
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          {p.counterparty.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[var(--text-secondary)] font-semibold">
                        {p.paymentMode}
                      </span>
                      {p.referenceNumber && (
                        <div className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-[120px] mt-0.5">
                          Ref: {p.referenceNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.purchase ? (
                        <span className="text-[11px] font-mono text-amber-400">
                          Pur: {p.purchase.invoiceNumber}
                        </span>
                      ) : p.sale ? (
                        <span className="text-[11px] font-mono text-emerald-400">
                          Sale: {p.sale.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">On Account</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div
                        className={`font-mono font-bold text-sm ${
                          p.type === "PAYMENT_RECEIVED" ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {formatCurrency(p.amount)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {p.status === "POSTED" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          POSTED
                        </span>
                      ) : (
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                            REVERSED
                          </span>
                          {p.cancelReason && (
                            <div className="text-[9px] text-red-400/80 mt-0.5 max-w-[120px] truncate" title={p.cancelReason}>
                              {p.cancelReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSlip(p)}
                          title="Print Payment Slip"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {p.status === "POSTED" && currentUser.role === "ADMIN" && (
                          <button
                            onClick={() => {
                              setCancelModalItem(p);
                              setCancelReason("");
                            }}
                            title="Reverse Payment (Admin)"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== CREATE PAYMENT MODAL ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    formType === "PAYMENT_RECEIVED"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {formType === "PAYMENT_RECEIVED" ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <h3 className="font-bold text-base text-[var(--text-primary)]">
                  {formType === "PAYMENT_RECEIVED"
                    ? "Record Payment Received (Customer Receipt)"
                    : "Record Payment Made (Supplier Disbursal)"}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFormType("PAYMENT_RECEIVED");
                  setCounterpartyId("");
                }}
                className={`py-2 rounded-lg transition ${
                  formType === "PAYMENT_RECEIVED"
                    ? "bg-emerald-600 text-white"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                Money Received (Customer)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormType("PAYMENT_MADE");
                  setCounterpartyId("");
                }}
                className={`py-2 rounded-lg transition ${
                  formType === "PAYMENT_MADE"
                    ? "bg-amber-600 text-white"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                Money Paid (Supplier)
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* Counterparty Selection */}
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-secondary)]">
                  Counterparty ({formType === "PAYMENT_RECEIVED" ? "Customer" : "Supplier"}) *
                </label>
                <select
                  value={counterpartyId}
                  onChange={(e) => setCounterpartyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                  required
                >
                  <option value="">-- Select Counterparty --</option>
                  {availableCounterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""} [{c.type}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text-secondary)]">Amount (INR) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#C59A58]">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full pl-8 pr-3 py-2 font-mono font-bold text-sm rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text-secondary)]">Payment Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                    required
                  />
                </div>
              </div>

              {/* Payment Mode & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text-secondary)]">Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                  >
                    <option value="CASH">Cash at Counter</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / Online QR</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="RTGS_NEFT">RTGS / NEFT</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text-secondary)]">
                    Reference # / Cheque / UTR
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UTR-987241, Cheque 0021"
                    className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                  />
                </div>
              </div>

              {/* Cash Denominations (Requirement 9 & 10) */}
              {paymentMode === "CASH" && (
                <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#C59A58] flex items-center gap-1.5">
                      <Coins className="w-4 h-4" />
                      Physical Cash Denomination Counter
                    </span>
                    <span className="text-[11px] font-mono">
                      Denom Sum:{" "}
                      <strong
                        className={
                          cashDiff === 0 && calculatedCashTotal > 0
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }
                      >
                        ₹{calculatedCashTotal.toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1 text-center">
                    {[
                      { note: 500, label: "₹500" },
                      { note: 200, label: "₹200" },
                      { note: 100, label: "₹100" },
                      { note: 50, label: "₹50" },
                      { note: 20, label: "₹20" },
                      { note: 10, label: "₹10" },
                      { note: "coins", label: "Coins ₹" },
                    ].map((item) => (
                      <div key={item.note} className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">{item.label}</span>
                        <input
                          type="number"
                          min="0"
                          value={denoms[item.note] || ""}
                          onChange={(e) =>
                            setDenoms({
                              ...denoms,
                              [item.note]: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="w-full py-1 text-center font-mono font-bold text-xs rounded-lg bg-black/40 border border-white/10 focus:outline-none focus:border-[#C59A58]"
                        />
                      </div>
                    ))}
                  </div>

                  {amountNum > 0 && calculatedCashTotal > 0 && cashDiff !== 0 && (
                    <div className="text-[11px] text-red-400 flex items-center gap-1 pt-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Difference: ₹{Math.abs(cashDiff).toLocaleString("en-IN")}{" "}
                      {cashDiff > 0 ? "short" : "excess"} of payment amount.
                    </div>
                  )}
                </div>
              )}

              {/* Optional Linked Invoice */}
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-secondary)]">
                  Optional: Link to Invoice ({formType === "PAYMENT_RECEIVED" ? "Sale" : "Purchase"})
                </label>
                {formType === "PAYMENT_RECEIVED" ? (
                  <select
                    value={linkedSaleId}
                    onChange={(e) => setLinkedSaleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                  >
                    <option value="">-- None / On Account --</option>
                    {availableSales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.invoiceNumber} (₹{parseFloat(s.totalAmount).toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={linkedPurchaseId}
                    onChange={(e) => setLinkedPurchaseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                  >
                    <option value="">-- None / On Account --</option>
                    {availablePurchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.invoiceNumber} (₹{parseFloat(p.totalAmount).toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-secondary)]">Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Part payment against invoice, full settlement"
                  className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[#C59A58]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`px-5 py-2 rounded-xl text-white font-bold flex items-center gap-2 cursor-pointer ${
                    formType === "PAYMENT_RECEIVED"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Post Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PARTY OUTSTANDING / LEDGER MODAL ==================== */}
      {(partyLedger || loadingLedger) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#C59A58]" />
                  <span>Party Outstanding & Ledger Statement</span>
                </h3>
                {partyLedger && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {partyLedger.counterparty.name} [{partyLedger.counterparty.type}]
                  </p>
                )}
              </div>
              <button
                onClick={() => setPartyLedger(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingLedger ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="w-5 h-5 animate-spin text-[#C59A58]" />
                <span>Computing live outstanding balance...</span>
              </div>
            ) : partyLedger ? (
              <div className="space-y-5 text-xs">
                {/* Summary Scorecard */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      Total Purchases
                    </div>
                    <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                      {formatCurrency(partyLedger.totalPurchasesAmount.toString())}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">
                      Paid: {formatCurrency(partyLedger.totalPaymentsMade.toString())}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      Total Sales
                    </div>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      {formatCurrency(partyLedger.totalSalesAmount.toString())}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">
                      Received: {formatCurrency(partyLedger.totalPaymentsReceived.toString())}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#C59A58]/10 border border-[#C59A58]/30">
                    <div className="text-[10px] text-[#E4BE85] uppercase tracking-wider font-semibold">
                      Net Outstanding
                    </div>
                    <div className="text-base font-bold font-mono text-[#E4BE85] mt-0.5">
                      {formatCurrency(partyLedger.netOutstanding.toString())}
                    </div>
                    <div className="text-[10px] text-[#A69A8E] mt-1">
                      {partyLedger.netOutstanding >= 0 ? "Receivable from Party" : "Payable to Party"}
                    </div>
                  </div>
                </div>

                {/* Chronological Ledger Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-[var(--text-primary)]">
                    Transaction History & Payments
                  </h4>
                  <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-[var(--text-muted)] text-[10px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference #</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-primary)]">
                        {partyLedger.recentTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-[var(--text-muted)]">
                              No history recorded yet for this party.
                            </td>
                          </tr>
                        ) : (
                          partyLedger.recentTransactions.map((tx: any, idx: number) => (
                            <tr key={`${tx.id}-${idx}`} className="hover:bg-white/2">
                              <td className="py-2 px-3 text-[var(--text-muted)] font-mono">
                                {formatDate(tx.date)}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    tx.type === "SALE" || tx.type === "PAYMENT_RECEIVED"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-amber-500/10 text-amber-400"
                                  }`}
                                >
                                  {tx.type}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[#C59A58]">{tx.reference}</td>
                              <td className="py-2 px-3 text-right font-mono font-semibold">
                                {formatCurrency(tx.amount.toString())}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================== CANCELLATION / REVERSAL MODAL ==================== */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-base">Reverse Payment Transaction</h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <strong>Non-Destructive Audit Rule:</strong> Reversing payment{" "}
              <strong className="font-mono text-white">{cancelModalItem.paymentNumber}</strong> (₹
              {parseFloat(cancelModalItem.amount).toLocaleString("en-IN")}) will restore the
              party's outstanding balance. The record will remain permanently preserved as{" "}
              <strong className="text-red-400">CANCELLED</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Reason for Reversal *
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Wrong amount entered / customer cheque bounced"
                className="w-full px-3 py-2 rounded-xl bg-black/25 border border-[var(--border-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || isPending}
                onClick={handleCancelPayment}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Reversal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRINTABLE COUNTER SLIP MODAL ==================== */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="text-center pb-3 border-b border-zinc-200">
              <div className="text-lg font-black tracking-tight text-zinc-900">OCTIS BULLION TRADE</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
                Official {selectedSlip.type === "PAYMENT_RECEIVED" ? "Money Receipt" : "Payment Voucher"}
              </div>
            </div>

            {/* Slip Meta */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Voucher No:</span>
                <span className="font-mono font-bold text-zinc-900">{selectedSlip.paymentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Date:</span>
                <span className="font-medium text-zinc-900">{formatDate(selectedSlip.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Party Name:</span>
                <span className="font-bold text-zinc-900">{selectedSlip.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Payment Mode:</span>
                <span className="font-semibold text-zinc-900 font-mono">{selectedSlip.paymentMode}</span>
              </div>
              {selectedSlip.referenceNumber && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ref / UTR:</span>
                  <span className="font-mono text-zinc-900">{selectedSlip.referenceNumber}</span>
                </div>
              )}
            </div>

            {/* Amount Box */}
            <div className="p-3.5 rounded-xl bg-zinc-100 border border-zinc-200 text-center space-y-0.5">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Total Amount {selectedSlip.type === "PAYMENT_RECEIVED" ? "Received" : "Paid"}
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900">
                ₹{parseFloat(selectedSlip.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Notes */}
            {selectedSlip.notes && (
              <div className="text-[11px] text-zinc-600 italic bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                "{selectedSlip.notes}"
              </div>
            )}

            {/* Watermark for Cancelled */}
            {selectedSlip.status === "CANCELLED" && (
              <div className="p-2 rounded-lg bg-red-100 border border-red-300 text-red-700 text-center text-xs font-bold uppercase tracking-widest">
                CANCELLED / REVERSED
              </div>
            )}

            {/* Signatures */}
            <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[11px] text-zinc-500">
              <div className="border-t border-zinc-300 pt-1">Party Signature</div>
              <div className="border-t border-zinc-300 pt-1">Authorized Cashier</div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
              <button
                onClick={() => setSelectedSlip(null)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-zinc-800"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
