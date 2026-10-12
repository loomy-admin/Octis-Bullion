"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  TrendingDown,
  Plus,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Send,
  Ban,
  Loader2,
  AlertTriangle,
  Scale,
  Pin,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  createSaleDraftAction,
  postSaleAction,
  createAndPostSaleAction,
  cancelSaleAction,
  fixSaleRateAction,
} from "@/lib/actions/sale-actions";
import { fulfillRateBlockAction } from "@/lib/actions/rate-block-actions";
import { getAvailableStockAction } from "@/lib/actions/stock-actions";
import { formatCurrency, formatGrams, formatDate } from "@/lib/utils/helpers";
import type { PaymentMode, TransactionStatus } from "@/lib/db/types";

interface SaleRow {
  id: string;
  invoiceNumber: string;
  date: string | Date;
  buyerName: string;
  buyerContact?: string | null;
  counterpartyId?: string | null;
  metalId: string;
  purityId: string;
  weightGrams: string;
  ratePerGram: string;
  totalAmount: string;
  paymentMode: PaymentMode;
  notes?: string | null;
  status: TransactionStatus;
  rateType?: "FIXED" | "UNFIXED";
  rateStatus?: "FIXED" | "UNFIXED";
  fixedAt?: string | Date | null;
  provisionalRate?: string | null;
  fixingNotes?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | Date | null;
  createdAt: string | Date;
  metal: { id: string; name: string; code: string };
  purity: { id: string; label: string; fineness: string };
  counterparty?: { id: string; name: string; phone?: string | null } | null;
  createdBy: { id: string; name: string; email: string };
  fixedBy?: { id: string; name: string; email: string } | null;
}

interface SalesClientProps {
  initialSales: SaleRow[];
  metals: Array<{
    id: string;
    name: string;
    code: string;
    purities: Array<{ id: string; label: string; fineness: string; isActive: boolean }>;
  }>;
  buyers: Array<{ id: string; name: string; phone?: string | null }>;
  userRole: "ADMIN" | "STAFF";
}

export function SalesClient({
  initialSales,
  metals,
  buyers,
  userRole,
}: SalesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [metalFilter, setMetalFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const paramRateBlockId = searchParams.get("rateBlockId");
  const paramCounterpartyId = searchParams.get("counterpartyId");
  const paramWeight = searchParams.get("weight");
  const paramRate = searchParams.get("rate");

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [cancellingSale, setCancellingSale] = useState<SaleRow | null>(null);
  const [fixingSale, setFixingSale] = useState<SaleRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (paramRateBlockId) {
      setShowNewModal(true);
    }
  }, [paramRateBlockId]);

  const isAdmin = userRole === "ADMIN";

  const filtered = initialSales.filter((s) => {
    const matchesSearch =
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.buyerName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    const matchesMetal = metalFilter === "ALL" || s.metalId === metalFilter;

    return matchesSearch && matchesStatus && matchesMetal;
  });

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs uppercase font-bold tracking-wider hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search invoice, buyer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#C59A58]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-secondary)] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={metalFilter}
            onChange={(e) => setMetalFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-secondary)] focus:outline-none"
          >
            <option value="ALL">All Metals</option>
            {metals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C59A58] hover:bg-[#af813a] text-white font-semibold text-xs transition shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Sale</span>
        </button>
      </div>

      {/* Sales Register Table */}
      <div className="glass-card overflow-hidden border border-[var(--border-primary)] rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-table-head)] text-[var(--text-tertiary)] uppercase text-[10px] tracking-wider border-b border-[var(--border-primary)]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Metal & Purity</th>
                <th className="py-3 px-4 text-right">Weight</th>
                <th className="py-3 px-4 text-right">Selling Rate/g</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--text-muted)]">
                    No sale transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-[var(--bg-table-hover)] transition-colors ${
                      s.status === "CANCELLED" ? "opacity-60 bg-red-500/5" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-[var(--text-secondary)]">
                      {formatDate(s.date)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#C59A58]">
                      {s.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                      {s.buyerName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {s.metal.name}
                      </span>{" "}
                      <span className="text-[var(--text-muted)]">({s.purity.label})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--text-primary)]">
                      {formatGrams(s.weightGrams)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                      {s.rateStatus === "UNFIXED" ? (
                        <div className="flex flex-col items-end">
                          <span className="text-amber-500 font-semibold">
                            {parseFloat(s.ratePerGram) > 0 ? formatCurrency(s.ratePerGram) : "—"}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            UNFIXED
                          </span>
                        </div>
                      ) : (
                        formatCurrency(s.ratePerGram)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#C59A58]">
                      {s.rateStatus === "UNFIXED" && parseFloat(s.ratePerGram) === 0 ? (
                        <span className="text-amber-500 text-xs font-normal">Pending Fix</span>
                      ) : (
                        formatCurrency(s.totalAmount)
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">
                        {s.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          s.status === "POSTED"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                            : s.status === "DRAFT"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        }`}
                      >
                        {s.status === "POSTED" ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : s.status === "DRAFT" ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSale(s)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#C59A58] hover:bg-black/5 dark:hover:bg-white/5"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {s.rateStatus === "UNFIXED" && s.status !== "CANCELLED" && (
                          <button
                            onClick={() => setFixingSale(s)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition"
                            title="Fix price per gram at prevailing market rate"
                          >
                            <Pin className="w-3 h-3" />
                            <span>Fix Rate</span>
                          </button>
                        )}
                        {s.status === "DRAFT" && (
                          <button
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                const res = await postSaleAction(s.id);
                                if (!res.success) setErrorMsg(res.error || "Failed to post sale");
                              });
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 hover:bg-green-500/20 transition"
                            title="Post sale to stock ledger"
                          >
                            <Send className="w-3 h-3" />
                            <span>Post</span>
                          </button>
                        )}
                        {s.status === "POSTED" && isAdmin && (
                          <button
                            onClick={() => setCancellingSale(s)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition"
                            title="Cancel sale and restore stock"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Cancel</span>
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

      {/* New Sale Modal */}
      {showNewModal && (
        <NewSaleModal
          metals={metals}
          buyers={buyers}
          prefillRateBlock={
            paramRateBlockId
              ? {
                  rateBlockId: paramRateBlockId,
                  counterpartyId: paramCounterpartyId || undefined,
                  weight: paramWeight || undefined,
                  rate: paramRate || undefined,
                }
              : undefined
          }
          onClose={() => setShowNewModal(false)}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}

      {/* View Detail Modal */}
      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onFixRate={() => {
            setFixingSale(selectedSale);
            setSelectedSale(null);
          }}
        />
      )}

      {/* Cancel Reason Modal */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-red-500 flex items-center gap-2">
              <Ban className="w-4 h-4" />
              <span>Cancel Sale {cancellingSale.invoiceNumber}</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              This action will return the physical stock (+{formatGrams(cancellingSale.weightGrams)})
              by creating an immutable SALE_CANCEL movement in the ledger.
            </p>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Reason for Cancellation *
              </label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Order cancelled by buyer, return of bullion, payment failure"
                className="w-full p-2.5 text-xs rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingSale(null);
                  setCancelReason("");
                }}
                className="px-4 py-2 text-xs rounded-xl border border-[var(--border-primary)] font-semibold text-[var(--text-secondary)]"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await cancelSaleAction({
                      id: cancellingSale.id,
                      reason: cancelReason,
                    });
                    if (res.success) {
                      setCancellingSale(null);
                      setCancelReason("");
                    } else {
                      setErrorMsg(res.error || "Failed to cancel sale");
                    }
                  });
                }}
                className="px-4 py-2 text-xs rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fix Rate Modal */}
      {fixingSale && (
        <FixSaleRateModal
          item={fixingSale}
          onClose={() => setFixingSale(null)}
          onSuccess={() => {
            setFixingSale(null);
          }}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Sale Modal with Real-Time Stock Validation
// ---------------------------------------------------------------------------

function NewSaleModal({
  metals,
  buyers,
  prefillRateBlock,
  onClose,
  onError,
}: {
  metals: SalesClientProps["metals"];
  buyers: SalesClientProps["buyers"];
  prefillRateBlock?: {
    rateBlockId: string;
    counterpartyId?: string;
    weight?: string;
    rate?: string;
  };
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => `SAL-${Date.now().toString().slice(-6)}`
  );
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Buyer selection
  const prefillBuyer = buyers.find((b) => b.id === prefillRateBlock?.counterpartyId);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(
    prefillRateBlock?.counterpartyId || ""
  );
  const [buyerName, setBuyerName] = useState(prefillBuyer?.name || "");
  const [buyerContact, setBuyerContact] = useState(prefillBuyer?.phone || "");

  // Metal & purity
  const [metalId, setMetalId] = useState(metals[0]?.id || "");
  const selectedMetal = metals.find((m) => m.id === metalId) || metals[0];
  const activePurities = selectedMetal?.purities.filter((p) => p.isActive) || [];
  const [purityId, setPurityId] = useState(activePurities[0]?.id || "");

  // Available stock tracking
  const [availableStockGrams, setAvailableStockGrams] = useState<string>("0.0000");
  const [checkingStock, setCheckingStock] = useState<boolean>(false);

  // Weight & rate
  const [rateType, setRateType] = useState<"FIXED" | "UNFIXED">("FIXED");
  const [weightGrams, setWeightGrams] = useState(prefillRateBlock?.weight || "");
  const [ratePerGram, setRatePerGram] = useState(prefillRateBlock?.rate || "");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [notes, setNotes] = useState(
    prefillRateBlock ? `Fulfilled from Rate Booking Block #${prefillRateBlock.rateBlockId}` : ""
  );

  const [loading, setLoading] = useState(false);

  // Fetch available stock whenever metalId or purityId changes
  useEffect(() => {
    if (!metalId || !purityId) return;
    let isCurrent = true;

    async function fetchStock() {
      setCheckingStock(true);
      const res = await getAvailableStockAction(metalId, purityId);
      if (isCurrent) {
        setCheckingStock(false);
        if (res.success && res.availableGrams) {
          setAvailableStockGrams(res.availableGrams);
        } else {
          setAvailableStockGrams("0.0000");
        }
      }
    }

    void fetchStock();

    return () => {
      isCurrent = false;
    };
  }, [metalId, purityId]);

  // When metal changes, reset purity
  const handleMetalChange = (newMetalId: string) => {
    setMetalId(newMetalId);
    const m = metals.find((x) => x.id === newMetalId);
    const p = m?.purities.filter((x) => x.isActive) || [];
    setPurityId(p[0]?.id || "");
  };

  const handleBuyerSelect = (id: string) => {
    setSelectedBuyerId(id);
    if (id) {
      const b = buyers.find((x) => x.id === id);
      if (b) {
        setBuyerName(b.name);
        setBuyerContact(b.phone || "");
      }
    } else {
      setBuyerName("");
      setBuyerContact("");
    }
  };

  const weightNum = parseFloat(weightGrams) || 0;
  const rateNum = parseFloat(ratePerGram) || 0;
  const availableNum = parseFloat(availableStockGrams) || 0;
  const isInsufficient = weightNum > availableNum;

  const previewTotal = weightNum > 0 && rateNum > 0 ? (weightNum * rateNum).toFixed(2) : "0.00";

  const handleSave = async (postImmediately: boolean) => {
    if (!buyerName.trim()) {
      onError("Buyer name is required");
      return;
    }
    if (!purityId) {
      onError("Please select an active purity");
      return;
    }
    if (weightNum <= 0) {
      onError("Weight must be greater than 0");
      return;
    }
    if (rateType === "FIXED" && rateNum <= 0) {
      onError("Rate per gram must be greater than 0 for fixed sales");
      return;
    }
    if (postImmediately && isInsufficient) {
      onError(`Cannot post sale: entered weight (${weightNum.toFixed(4)}g) exceeds available stock (${availableNum.toFixed(4)}g).`);
      return;
    }

    setLoading(true);
    const payload = {
      invoiceNumber: invoiceNumber.trim(),
      date: new Date(date),
      buyerName: buyerName.trim(),
      buyerContact: buyerContact.trim() || undefined,
      counterpartyId: selectedBuyerId || undefined,
      metalId,
      purityId,
      weightGrams,
      rateType,
      ratePerGram: rateNum > 0 ? ratePerGram : "0",
      paymentMode,
      notes: notes.trim() || undefined,
    };

    const res = postImmediately
      ? await createAndPostSaleAction(payload)
      : await createSaleDraftAction(payload);

    setLoading(false);
    if (res.success) {
      if (prefillRateBlock?.rateBlockId && res.data?.id) {
        await fulfillRateBlockAction(prefillRateBlock.rateBlockId, res.data.id);
      }
      onClose();
    } else {
      onError(res.error || "Failed to create sale");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#C59A58]" />
            <span>New Sale Entry</span>
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-[#C59A58]/10 text-[#C59A58] font-bold font-mono">
            {invoiceNumber}
          </span>
        </div>

        {prefillRateBlock && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
            <span className="font-semibold">★ Fulfilling Rate Booking</span>
            <span className="font-mono">
              Locked Rate: ₹{prefillRateBlock.rate}/g | {prefillRateBlock.weight}g
            </span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Invoice & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Invoice #</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] font-mono"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Sale Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Buyer Select / Custom */}
          <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-primary)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-primary)]">Buyer / Customer Details</span>
              {buyers.length > 0 && (
                <select
                  value={selectedBuyerId}
                  onChange={(e) => handleBuyerSelect(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] text-[#C59A58] font-semibold"
                >
                  <option value="">Select Existing Customer...</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Buyer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Jewellers"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Contact / Phone</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Metal & Purity Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Precious Metal</label>
              <select
                value={metalId}
                onChange={(e) => handleMetalChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              >
                {metals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Purity</label>
              <select
                value={purityId}
                onChange={(e) => setPurityId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              >
                {activePurities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} (Fineness: {Number(p.fineness).toFixed(4)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Available Stock Badge */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-[var(--text-secondary)]">
                Available Stock ({selectedMetal?.name} - {activePurities.find((p) => p.id === purityId)?.label}):
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
              {checkingStock ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>{formatGrams(availableStockGrams)}</span>
              )}
            </div>
          </div>

          {/* Rate Type Selector */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[var(--text-secondary)]">Rate Agreement Type</label>
            <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRateType("FIXED")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  rateType === "FIXED"
                    ? "bg-[var(--bg-card)] shadow-xs text-[#C59A58]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Fixed Rate Deal
              </button>
              <button
                type="button"
                onClick={() => setRateType("UNFIXED")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  rateType === "UNFIXED"
                    ? "bg-[var(--bg-card)] shadow-xs text-amber-500"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Unfixed Rate Deal (Fix Later)
              </button>
            </div>
            {rateType === "UNFIXED" && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                <span className="font-bold block mb-0.5">Unfixed Rate Agreement</span>
                <p className="text-[11px] leading-relaxed">
                  Physical metal is immediately delivered and deducted from your stock ledger (-grams). The final price per gram can be fixed later at prevailing market rates.
                </p>
              </div>
            )}
          </div>

          {/* Weight & Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Sale Weight (Grams) *</label>
              <input
                type="text"
                required
                placeholder="e.g. 20.0000"
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border font-mono ${
                  isInsufficient
                    ? "border-red-500 focus:border-red-500 text-red-500"
                    : "border-[var(--border-primary)] text-[var(--text-primary)]"
                }`}
              />
              {isInsufficient && (
                <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Exceeds available stock ({formatGrams(availableStockGrams)})</span>
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
                {rateType === "FIXED" ? "Selling Rate / g (₹) *" : "Provisional Rate / g (₹, Optional)"}
              </label>
              <input
                type="text"
                required={rateType === "FIXED"}
                placeholder={rateType === "FIXED" ? "e.g. 7450.00" : "Optional estimate"}
                value={ratePerGram}
                onChange={(e) => setRatePerGram(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] font-mono"
              />
            </div>
          </div>

          {/* Total Preview Pill */}
          <div className="p-3 rounded-xl bg-[#C59A58]/10 border border-[#C59A58]/30 flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)]">
              {rateType === "FIXED" ? "Calculated Sale Total:" : "Provisional Receivable Total:"}
            </span>
            <span className="font-mono font-bold text-sm text-[#C59A58]">
              {rateType === "UNFIXED" && rateNum === 0 ? "Awaiting Price Fix" : formatCurrency(previewTotal)}
            </span>
          </div>

          {/* Payment & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              >
                <option value="CASH">CASH</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">BANK TRANSFER (RTGS/NEFT)</option>
                <option value="CARD">CARD</option>
                <option value="CHEQUE">CHEQUE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">Notes / Reference</label>
              <input
                type="text"
                placeholder="e.g. Counter sale delivery receipt"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-[var(--border-primary)]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[var(--border-primary)] font-semibold text-[var(--text-secondary)] hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#C59A58] text-[#C59A58] font-semibold hover:bg-[#C59A58]/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={loading || isInsufficient}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#C59A58] text-white font-semibold hover:bg-[#af813a] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save & Post to Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sale Detail Modal
// ---------------------------------------------------------------------------

function SaleDetailModal({
  sale,
  onClose,
  onFixRate,
}: {
  sale: SaleRow;
  onClose: () => void;
  onFixRate?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Sale Invoice: {sale.invoiceNumber}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Created on {formatDate(sale.createdAt)} by {sale.createdBy.name}
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              sale.status === "POSTED"
                ? "bg-green-500/10 text-green-600 border border-green-500/20"
                : sale.status === "DRAFT"
                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                : "bg-red-500/10 text-red-600 border border-red-500/20"
            }`}
          >
            {sale.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[var(--text-muted)] block">Buyer:</span>
            <span className="font-semibold text-[var(--text-primary)]">{sale.buyerName}</span>
            {sale.buyerContact && (
              <span className="text-[var(--text-secondary)] block text-[11px]">
                {sale.buyerContact}
              </span>
            )}
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Transaction Date:</span>
            <span className="font-semibold text-[var(--text-primary)]">{formatDate(sale.date)}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Metal:</span>
            <span className="font-semibold text-[var(--text-primary)]">{sale.metal.name}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Purity:</span>
            <span className="font-semibold text-[var(--text-primary)]">{sale.purity.label}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Weight:</span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {formatGrams(sale.weightGrams)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Selling Rate:</span>
            <span className="font-mono font-bold text-[var(--text-secondary)]">
              {formatCurrency(sale.ratePerGram)} / g
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Total Amount:</span>
            <span className="font-mono font-bold text-sm text-[#C59A58]">
              {formatCurrency(sale.totalAmount)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block">Payment Mode:</span>
            <span className="font-semibold text-[var(--text-primary)]">{sale.paymentMode}</span>
          </div>
        </div>

        {sale.notes && (
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-primary)] text-xs">
            <span className="font-semibold text-[var(--text-secondary)] block mb-1">Notes:</span>
            <p className="text-[var(--text-primary)]">{sale.notes}</p>
          </div>
        )}

        {sale.status === "CANCELLED" && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
            <span className="font-bold block mb-1">Cancelled:</span>
            <p>Reason: {sale.cancelReason || "No reason recorded"}</p>
            {sale.cancelledAt && (
              <span className="text-[10px] text-[var(--text-muted)] block mt-1">
                At: {formatDate(sale.cancelledAt)}
              </span>
            )}
          </div>
        )}

        {sale.rateStatus === "UNFIXED" && sale.status !== "CANCELLED" && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-600 dark:text-amber-400 block">Unfixed Rate Bullion Sale</span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                The final invoiced rate for this customer deal is pending market rate fixation.
              </span>
            </div>
            {onFixRate && (
              <button
                onClick={onFixRate}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-amber-600 transition"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>Fix Rate</span>
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-xl bg-[#C59A58] text-white font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fix Sale Rate Modal
// ---------------------------------------------------------------------------

function FixSaleRateModal({
  item,
  onClose,
  onSuccess,
  onError,
}: {
  item: SaleRow;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [fixedRate, setFixedRate] = useState(
    item.provisionalRate || (parseFloat(item.ratePerGram) > 0 ? item.ratePerGram : "")
  );
  const [notes, setNotes] = useState(item.fixingNotes || "");
  const [loading, setLoading] = useState(false);

  const weightNum = parseFloat(item.weightGrams) || 0;
  const rateNum = parseFloat(fixedRate) || 0;
  const newTotal = weightNum > 0 && rateNum > 0 ? (weightNum * rateNum).toFixed(2) : "0.00";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateNum <= 0) {
      onError("Fixed rate must be greater than 0");
      return;
    }

    setLoading(true);
    const res = await fixSaleRateAction({
      id: item.id,
      fixedRatePerGram: fixedRate.trim(),
      fixingNotes: notes.trim() || undefined,
    });
    setLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      onError(res.error || "Failed to fix sale rate");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-500" />
            <span>Fix Market Rate</span>
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold font-mono">
            {item.invoiceNumber}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-primary)] space-y-1.5 text-xs">
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Customer:</span>
            <span className="font-bold text-[var(--text-primary)]">{item.buyerName}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Metal & Purity:</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {item.metal.name} • {item.purity.label}
            </span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Dispatched Weight:</span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {formatGrams(item.weightGrams)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Agreed Selling Rate / Gram (₹) *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. 7450.00"
              value={fixedRate}
              onChange={(e) => setFixedRate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] font-mono font-bold focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Final Invoiced Receivable:
            </span>
            <span className="font-mono font-bold text-base text-amber-600 dark:text-amber-400">
              {formatCurrency(newTotal)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Fixing Reference / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Rate locked per customer call"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] focus:border-[#C59A58] focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-primary)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl border border-[var(--border-primary)] font-semibold text-[var(--text-secondary)] hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || rateNum <= 0}
              className="px-4 py-2 text-xs rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Rate Fix
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
