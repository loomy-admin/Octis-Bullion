"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  BookmarkCheck,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Coins,
  Shield,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createRateBlockAction,
  cancelRateBlockAction,
} from "@/lib/actions/rate-block-actions";

interface SerializedBlock {
  id: string;
  blockNumber: string;
  counterpartyId: string;
  metalId: string;
  purityId: string;
  blockedWeightGrams: string;
  blockedRatePerGram: string;
  totalBlockedAmount: string;
  advanceAmount: string;
  validUntil: string;
  status: "ACTIVE" | "FULFILLED" | "EXPIRED" | "CANCELLED";
  fulfilledSaleId: string | null;
  notes: string | null;
  createdAt: string;
  counterparty: {
    id: string;
    name: string;
    phone?: string | null;
    type: string;
  } | null;
  metal: {
    id: string;
    name: string;
    code: string;
  } | null;
  purity: {
    id: string;
    name: string;
    purityPercentage: string;
  } | null;
  fulfilledSale: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    status: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
  } | null;
}

interface CounterpartyItem {
  id: string;
  name: string;
  phone?: string | null;
  type: string;
}

interface MetalItem {
  id: string;
  name: string;
  code: string;
  purities: {
    id: string;
    name: string;
    purityPercentage: string;
  }[];
}

interface Props {
  initialBlocks: SerializedBlock[];
  counterparties: CounterpartyItem[];
  metals: MetalItem[];
  userRole: string;
}

export function RateBlocksClient({
  initialBlocks,
  counterparties,
  metals,
  userRole,
}: Props) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<SerializedBlock[]>(initialBlocks);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<SerializedBlock | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states for Book Modal
  const [formData, setFormData] = useState({
    counterpartyId: "",
    metalId: metals[0]?.id || "",
    purityId: metals[0]?.purities[0]?.id || "",
    blockedWeightGrams: "",
    blockedRatePerGram: "",
    advanceAmount: "0",
    validHours: 4,
    notes: "",
  });

  // Keep purity synced when metal changes
  const availablePurities = useMemo(() => {
    const m = metals.find((x) => x.id === formData.metalId);
    return m?.purities || [];
  }, [metals, formData.metalId]);

  useEffect(() => {
    if (availablePurities.length > 0 && !availablePurities.some((p) => p.id === formData.purityId)) {
      setFormData((prev) => ({ ...prev, purityId: availablePurities[0].id }));
    }
  }, [availablePurities, formData.purityId]);

  // Derived calculations for Booking modal
  const modalCalculations = useMemo(() => {
    const weight = parseFloat(formData.blockedWeightGrams) || 0;
    const rate = parseFloat(formData.blockedRatePerGram) || 0;
    const advance = parseFloat(formData.advanceAmount) || 0;
    const total = weight * rate;
    const balance = Math.max(0, total - advance);
    return { total, balance, advance };
  }, [formData.blockedWeightGrams, formData.blockedRatePerGram, formData.advanceAmount]);

  // Metrics summary
  const metrics = useMemo(() => {
    const activeBlocks = blocks.filter((b) => b.status === "ACTIVE");
    const activeCount = activeBlocks.length;
    const totalGrams = activeBlocks.reduce((acc, b) => acc + parseFloat(b.blockedWeightGrams || "0"), 0);
    const totalValue = activeBlocks.reduce((acc, b) => acc + parseFloat(b.totalBlockedAmount || "0"), 0);
    const totalAdvance = activeBlocks.reduce((acc, b) => acc + parseFloat(b.advanceAmount || "0"), 0);

    return {
      activeCount,
      totalGrams,
      totalValue,
      totalAdvance,
    };
  }, [blocks]);

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesNumber = b.blockNumber.toLowerCase().includes(q);
        const matchesParty = b.counterparty?.name.toLowerCase().includes(q);
        const matchesNotes = b.notes?.toLowerCase().includes(q);
        if (!matchesNumber && !matchesParty && !matchesNotes) return false;
      }
      return true;
    });
  }, [blocks, statusFilter, search]);

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createRateBlockAction({
      counterpartyId: formData.counterpartyId,
      metalId: formData.metalId,
      purityId: formData.purityId,
      blockedWeightGrams: formData.blockedWeightGrams,
      blockedRatePerGram: formData.blockedRatePerGram,
      advanceAmount: formData.advanceAmount,
      validHours: Number(formData.validHours),
      notes: formData.notes,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to book rate");
      return;
    }

    setIsBookModalOpen(false);
    setFormData({
      counterpartyId: "",
      metalId: metals[0]?.id || "",
      purityId: metals[0]?.purities[0]?.id || "",
      blockedWeightGrams: "",
      blockedRatePerGram: "",
      advanceAmount: "0",
      validHours: 4,
      notes: "",
    });
    router.refresh();
  };

  const handleCancelBlock = async () => {
    if (!selectedBlock || !cancelReason.trim()) return;
    setLoading(true);
    setError(null);

    const res = await cancelRateBlockAction({
      blockId: selectedBlock.id,
      reason: cancelReason.trim(),
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to cancel block");
      return;
    }

    setIsCancelModalOpen(false);
    setSelectedBlock(null);
    setCancelReason("");
    router.refresh();
  };

  const formatRemainingTime = (validUntilStr: string, status: string) => {
    if (status !== "ACTIVE") return null;
    const diff = new Date(validUntilStr).getTime() - Date.now();
    if (diff <= 0) return "Expired just now";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>ACTIVE BOOKINGS</span>
            <BookmarkCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight">
            {metrics.activeCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pending physical sale execution</p>
        </div>

        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>RESERVED WEIGHT</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight">
            {metrics.totalGrams.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g
          </div>
          <p className="text-xs text-muted-foreground mt-1">Locked gold/silver inventory</p>
        </div>

        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>BOOKED ORDER VALUE</span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight">
            ₹{metrics.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Gross locked turnover</p>
        </div>

        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>ADVANCE DEPOSITS HELD</span>
            <Wallet className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight text-emerald-500">
            ₹{metrics.totalAdvance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Cash/bank security margin</p>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border w-fit overflow-x-auto">
          {["ALL", "ACTIVE", "FULFILLED", "EXPIRED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search party or block #..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            onClick={() => setIsBookModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Book Rate
          </button>
        </div>
      </div>

      {/* Rate Blocks Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Block #</th>
                <th className="py-3 px-4">Customer / Party</th>
                <th className="py-3 px-4">Metal & Purity</th>
                <th className="py-3 px-4 text-right">Weight (g)</th>
                <th className="py-3 px-4 text-right">Locked Rate (₹/g)</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
                <th className="py-3 px-4 text-right">Advance (₹)</th>
                <th className="py-3 px-4">Validity / Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <BookmarkCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No rate bookings found</p>
                    <p className="text-[11px] mt-0.5">Click &quot;Book Rate&quot; to reserve a price for a customer</p>
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((block) => {
                  const remaining = formatRemainingTime(block.validUntil, block.status);
                  return (
                    <tr key={block.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        {block.blockNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          {block.counterparty?.name || "Direct Customer"}
                        </div>
                        {block.counterparty?.phone && (
                          <div className="text-[11px] text-muted-foreground">
                            {block.counterparty.phone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{block.metal?.name}</span>{" "}
                        <span className="text-muted-foreground">({block.purity?.name})</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {parseFloat(block.blockedWeightGrams).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                        ₹{parseFloat(block.blockedRatePerGram).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        ₹{parseFloat(block.totalBlockedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-500 font-semibold">
                        ₹{parseFloat(block.advanceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(block.validUntil).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {remaining && (
                            <span className="text-[10px] font-medium text-amber-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {remaining}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {block.status === "ACTIVE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            ACTIVE
                          </span>
                        )}
                        {block.status === "FULFILLED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                            FULFILLED
                          </span>
                        )}
                        {block.status === "EXPIRED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                            EXPIRED
                          </span>
                        )}
                        {block.status === "CANCELLED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            CANCELLED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {block.status === "ACTIVE" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                router.push(
                                  `/sales?rateBlockId=${block.id}&counterpartyId=${block.counterpartyId}&weight=${block.blockedWeightGrams}&rate=${block.blockedRatePerGram}`
                                );
                              }}
                              className="px-2.5 py-1 rounded-md bg-emerald-500 text-white font-medium text-[11px] hover:bg-emerald-600 transition-colors cursor-pointer flex items-center gap-1"
                              title="Create Sale using locked rate"
                            >
                              Fulfill Sale
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBlock(block);
                                setIsCancelModalOpen(true);
                              }}
                              className="p-1 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer"
                              title="Cancel rate booking"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {block.status === "FULFILLED" && block.fulfilledSale && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Inv #{block.fulfilledSale.invoiceNumber}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Rate Modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-emerald-500" />
                  Book Metal Rate (Price Reservation)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fix a price for a customer with advance deposit and timer expiry
                </p>
              </div>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                  {error}
                </div>
              )}

              {/* Counterparty Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Customer / Counterparty *
                </label>
                <select
                  required
                  value={formData.counterpartyId}
                  onChange={(e) => setFormData({ ...formData, counterpartyId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Customer / Party...</option>
                  {counterparties.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} {cp.phone ? `(${cp.phone})` : ""} [{cp.type}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Metal & Purity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Metal *</label>
                  <select
                    value={formData.metalId}
                    onChange={(e) => setFormData({ ...formData, metalId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {metals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Purity *</label>
                  <select
                    value={formData.purityId}
                    onChange={(e) => setFormData({ ...formData, purityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {availablePurities.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({parseFloat(p.purityPercentage).toFixed(1)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weight & Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Blocked Weight (grams) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="e.g. 50.000"
                    value={formData.blockedWeightGrams}
                    onChange={(e) => setFormData({ ...formData, blockedWeightGrams: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Locked Rate (₹ per gram) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 7550.00"
                    value={formData.blockedRatePerGram}
                    onChange={(e) => setFormData({ ...formData, blockedRatePerGram: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Advance Amount & Expiry Timer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Advance Deposit Collected (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.advanceAmount}
                    onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary text-emerald-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Valid For (Hours)
                  </label>
                  <select
                    value={formData.validHours}
                    onChange={(e) => setFormData({ ...formData, validHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={2}>2 Hours</option>
                    <option value={4}>4 Hours (Standard)</option>
                    <option value={8}>8 Hours (Full Shift)</option>
                    <option value={24}>24 Hours (Next Day)</option>
                    <option value={48}>48 Hours (2 Days)</option>
                  </select>
                </div>
              </div>

              {/* Order Calculation Preview Box */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Blocked Value:</span>
                  <span className="font-mono font-bold text-foreground">
                    ₹{modalCalculations.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Advance Received:</span>
                  <span className="font-mono text-emerald-500 font-semibold">
                    - ₹{modalCalculations.advance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold">
                  <span className="text-foreground">Payable at Fulfillment:</span>
                  <span className="font-mono text-primary font-bold">
                    ₹{modalCalculations.balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes / Terms</label>
                <input
                  type="text"
                  placeholder="e.g. Deposit paid via UPI, customer will pick 50g bar by 6 PM"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Booking..." : "Confirm Rate Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Rate Block Modal */}
      {isCancelModalOpen && selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Cancel Rate Booking #{selectedBlock.blockNumber}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Are you sure you want to cancel the price lock for {selectedBlock.counterparty?.name}?
              {parseFloat(selectedBlock.advanceAmount) > 0 && (
                <span className="block mt-1 text-amber-500 font-medium">
                  Note: An advance of ₹{parseFloat(selectedBlock.advanceAmount).toFixed(2)} was recorded.
                </span>
              )}
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-foreground mb-1">
                Reason for cancellation *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Customer cancelled order, refund processed"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setSelectedBlock(null);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading || !cancelReason.trim()}
                onClick={handleCancelBlock}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
