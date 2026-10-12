"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Scale,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Coins,
  Wallet,
  ArrowRightLeft,
  Calendar,
  User,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  recordPartySettlementAction,
  cancelPartySettlementAction,
  getPartyDualBalanceAction,
} from "@/lib/actions/settlement-actions";

interface CounterpartyItem {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

interface MetalItem {
  id: string;
  name: string;
  code: string;
  purities: {
    id: string;
    name: string;
    label: string;
    purityPercentage: string;
  }[];
}

interface SettlementItem {
  id: string;
  settlementNumber: string;
  counterpartyId: string;
  date: string;
  metalId: string;
  purityId: string;
  metalSettledGrams: string;
  metalDirection: "DELIVER_TO_PARTY" | "RECEIVE_FROM_PARTY";
  cashSettledAmount: string;
  cashDirection: "PAY_TO_PARTY" | "RECEIVE_FROM_PARTY";
  paymentMode: string;
  referenceNumber: string | null;
  preMetalBalanceGrams: string;
  postMetalBalanceGrams: string;
  preCashBalance: string;
  postCashBalance: string;
  status: "POSTED" | "CANCELLED";
  notes: string | null;
  counterparty?: CounterpartyItem | null;
  metal?: { id: string; name: string; code: string } | null;
  purity?: { id: string; name: string; label: string } | null;
  payment?: { id: string; paymentNumber: string; amount: string; status: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
}

interface Props {
  initialSettlements: SettlementItem[];
  initialTotalCount: number;
  counterparties: CounterpartyItem[];
  metals: MetalItem[];
  userRole: string;
}

export function SettlementsClient({
  initialSettlements,
  initialTotalCount,
  counterparties,
  metals,
  userRole,
}: Props) {
  const router = useRouter();
  const [settlements, setSettlements] = useState<SettlementItem[]>(initialSettlements);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "POSTED" | "CANCELLED">("ALL");
  const [search, setSearch] = useState("");

  // Record Settlement Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState(counterparties[0]?.id || "");
  const [fetchingPartyBalance, setFetchingPartyBalance] = useState(false);
  const [partyDualBalance, setPartyDualBalance] = useState<any>(null);

  // Form State
  const [formMetalId, setFormMetalId] = useState(metals[0]?.id || "");
  const [formPurityId, setFormPurityId] = useState(metals[0]?.purities[0]?.id || "");
  const [metalGrams, setMetalGrams] = useState("80");
  const [metalDir, setMetalDir] = useState<"DELIVER_TO_PARTY" | "RECEIVE_FROM_PARTY">("DELIVER_TO_PARTY");
  const [cashAmount, setCashAmount] = useState("30000");
  const [cashDir, setCashDir] = useState<"PAY_TO_PARTY" | "RECEIVE_FROM_PARTY">("RECEIVE_FROM_PARTY");
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Cancel Modal
  const [cancellingSettlement, setCancellingSettlement] = useState<SettlementItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Keep purity synced with selected metal
  const formPurities = useMemo(() => {
    return metals.find((m) => m.id === formMetalId)?.purities || [];
  }, [metals, formMetalId]);

  useEffect(() => {
    if (formPurities.length > 0 && !formPurities.some((p) => p.id === formPurityId)) {
      setFormPurityId(formPurities[0].id);
    }
  }, [formPurities, formPurityId]);

  // Fetch party dual balance when party changes in modal
  const fetchDualBalance = async (partyId: string) => {
    if (!partyId) return;
    setFetchingPartyBalance(true);
    const res = await getPartyDualBalanceAction(partyId);
    setFetchingPartyBalance(false);
    if (res.success && res.data) {
      setPartyDualBalance(res.data);
    }
  };

  useEffect(() => {
    if (isRecordModalOpen && selectedPartyId) {
      void fetchDualBalance(selectedPartyId);
    }
  }, [isRecordModalOpen, selectedPartyId]);

  // Current Metal & Cash Balances for Selected Party
  const currentPartyCashBalance = useMemo(() => {
    if (!partyDualBalance) return 50000;
    return partyDualBalance.cashOutstanding.netOutstanding;
  }, [partyDualBalance]);

  const currentPartyMetalBalance = useMemo(() => {
    if (!partyDualBalance) return 100;
    const match = partyDualBalance.metalBalances.find(
      (b: any) => b.metalId === formMetalId && b.purityId === formPurityId
    );
    return match ? match.netWeightGrams : 100;
  }, [partyDualBalance, formMetalId, formPurityId]);

  // Projected Balances
  const projectedRemainingMetal = useMemo(() => {
    const pre = parseFloat(currentPartyMetalBalance.toString()) || 0;
    const settle = parseFloat(metalGrams || "0") || 0;
    return metalDir === "DELIVER_TO_PARTY" ? pre - settle : pre + settle;
  }, [currentPartyMetalBalance, metalGrams, metalDir]);

  const projectedRemainingCash = useMemo(() => {
    const pre = parseFloat(currentPartyCashBalance.toString()) || 0;
    const settle = parseFloat(cashAmount || "0") || 0;
    return cashDir === "RECEIVE_FROM_PARTY" ? pre - settle : pre + settle;
  }, [currentPartyCashBalance, cashAmount, cashDir]);

  // Handle Record Submit
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await recordPartySettlementAction({
      counterpartyId: selectedPartyId,
      metalId: formMetalId,
      purityId: formPurityId,
      metalSettledGrams: metalGrams,
      metalDirection: metalDir,
      cashSettledAmount: cashAmount,
      cashDirection: cashDir,
      paymentMode,
      referenceNumber: reference,
      currentMetalBalanceGrams: currentPartyMetalBalance,
      currentCashBalance: currentPartyCashBalance,
      notes,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to record settlement");
      return;
    }

    setIsRecordModalOpen(false);
    setNotes("");
    setReference("");
    router.refresh();
  };

  // Handle Cancel Submit
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSettlement) return;
    setLoading(true);
    setError(null);

    const res = await cancelPartySettlementAction({
      settlementId: cancellingSettlement.id,
      reason: cancelReason,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to cancel settlement");
      return;
    }

    setCancellingSettlement(null);
    setCancelReason("");
    router.refresh();
  };

  // Filtered List
  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      if (partyFilter !== "ALL" && s.counterpartyId !== partyFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const partyName = s.counterparty?.name?.toLowerCase() || "";
        const num = s.settlementNumber.toLowerCase();
        const ref = s.referenceNumber?.toLowerCase() || "";
        if (!partyName.includes(q) && !num.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }, [settlements, partyFilter, statusFilter, search]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const posted = settlements.filter((s) => s.status === "POSTED");
    const totalMetal = posted.reduce((sum, s) => sum + parseFloat(s.metalSettledGrams || "0"), 0);
    const totalCash = posted.reduce((sum, s) => sum + parseFloat(s.cashSettledAmount || "0"), 0);
    const uniqueParties = new Set(posted.map((s) => s.counterpartyId)).size;
    return {
      postedCount: posted.length,
      totalMetalGrams: totalMetal,
      totalCashAmount: totalCash,
      partiesCount: uniqueParties,
    };
  }, [settlements]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <span className="text-xs text-muted-foreground font-medium uppercase">
            POSTED DUAL SETTLEMENTS
          </span>
          <div className="text-xl font-bold mt-1 text-foreground">
            {summaryMetrics.postedCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Across {summaryMetrics.partiesCount} counterparties
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <span className="text-xs text-muted-foreground font-medium uppercase">
            TOTAL PHYSICAL METAL SETTLED
          </span>
          <div className="text-xl font-bold mt-1 text-amber-500 font-mono">
            {summaryMetrics.totalMetalGrams.toFixed(4)} g
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Pure metal handed over / received
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <span className="text-xs text-muted-foreground font-medium uppercase">
            TOTAL CASH RECONCILED
          </span>
          <div className="text-xl font-bold mt-1 text-emerald-500 font-mono">
            ₹{summaryMetrics.totalCashAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Cleared against outstanding party ledgers
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase">
            SETTLEMENT ACTION
          </span>
          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Dual Settlement
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Party Filter */}
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Counterparties</option>
            {counterparties.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name} ({cp.type})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border">
            {(["ALL", "POSTED", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  statusFilter === st
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SET #, party, ref..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Settlements Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            Dual Metal & Cash Settlement Journal
          </h3>
          <span className="text-[11px] text-muted-foreground font-medium">
            {filteredSettlements.length} settlement transaction(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-4">Settlement #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Counterparty</th>
                <th className="py-2.5 px-4 text-right">Metal Settled</th>
                <th className="py-2.5 px-4 text-right">Cash Settled</th>
                <th className="py-2.5 px-4 text-right">Remaining Metal</th>
                <th className="py-2.5 px-4 text-right">Remaining Cash</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No dual settlements found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {s.settlementNumber}
                      {s.referenceNumber && (
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          Ref: {s.referenceNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(s.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground block">
                        {s.counterparty?.name || "Unknown Party"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {s.counterparty?.type} {s.counterparty?.phone ? `• ${s.counterparty.phone}` : ""}
                      </span>
                    </td>

                    {/* Metal Settled Column */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-amber-500 block">
                        {parseFloat(s.metalSettledGrams).toFixed(4)} g
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {s.metalDirection === "DELIVER_TO_PARTY" ? "Delivered to party" : "Received from party"}
                        {s.purity?.name ? ` (${s.purity.name})` : ""}
                      </span>
                    </td>

                    {/* Cash Settled Column */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-emerald-500 block">
                        ₹{parseFloat(s.cashSettledAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {s.cashDirection === "RECEIVE_FROM_PARTY" ? "Received from party" : "Paid to party"} ({s.paymentMode})
                      </span>
                    </td>

                    {/* Remaining Metal Column */}
                    <td className="py-3 px-4 text-right font-mono">
                      <span className="text-foreground font-semibold block">
                        {parseFloat(s.postMetalBalanceGrams).toFixed(4)} g
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        From: {parseFloat(s.preMetalBalanceGrams).toFixed(4)}g
                      </span>
                    </td>

                    {/* Remaining Cash Column */}
                    <td className="py-3 px-4 text-right font-mono">
                      <span className="text-foreground font-semibold block">
                        ₹{parseFloat(s.postCashBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        From: ₹{parseFloat(s.preCashBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          s.status === "POSTED"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}
                      >
                        {s.status === "POSTED" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {s.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {s.status === "POSTED" && userRole === "ADMIN" && (
                        <button
                          onClick={() => setCancellingSettlement(s)}
                          className="px-2 py-1 rounded-lg border border-border text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          Cancel / Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD DUAL SETTLEMENT MODAL */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Record Metal + Cash Dual Settlement
                </h3>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* 1. Counterparty Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Counterparty *
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {counterparties.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} ({cp.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Balances Pill Display */}
              <div className="p-3 rounded-xl border border-border bg-muted/30 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                    CURRENT OPEN CASH LEDGER
                  </span>
                  <div className="text-base font-bold font-mono text-emerald-500 mt-0.5">
                    ₹{parseFloat(currentPartyCashBalance.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {currentPartyCashBalance >= 0 ? "Customer owes shop" : "Shop owes party"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                    CURRENT OPEN METAL HOLDING
                  </span>
                  <div className="text-base font-bold font-mono text-amber-500 mt-0.5">
                    {parseFloat(currentPartyMetalBalance.toString()).toFixed(4)} g
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Selected metal & purity balance
                  </span>
                </div>
              </div>

              {/* 2. Metal Settlement Fields */}
              <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 text-amber-500">
                  <Coins className="w-3.5 h-3.5" />
                  Physical Bullion Metal Settlement
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">Metal</label>
                    <select
                      value={formMetalId}
                      onChange={(e) => setFormMetalId(e.target.value)}
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
                    <label className="block text-[11px] font-semibold text-foreground mb-1">Purity</label>
                    <select
                      value={formPurityId}
                      onChange={(e) => setFormPurityId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {formPurities.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({parseFloat(p.purityPercentage).toFixed(1)}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Metal Settled (grams) *
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={metalGrams}
                      onChange={(e) => setMetalGrams(e.target.value)}
                      placeholder="e.g. 80.0000"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary text-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Metal Flow Direction *
                    </label>
                    <select
                      value={metalDir}
                      onChange={(e) => setMetalDir(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="DELIVER_TO_PARTY">Deliver to Party (Shop Vault Stock Out)</option>
                      <option value="RECEIVE_FROM_PARTY">Receive from Party (Shop Vault Stock In)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Cash Settlement Fields */}
              <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 text-emerald-500">
                  <Wallet className="w-3.5 h-3.5" />
                  Money / Cash Ledger Settlement
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Cash Settled (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="e.g. 30000"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary text-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Cash Flow Direction *
                    </label>
                    <select
                      value={cashDir}
                      onChange={(e) => setCashDir(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="RECEIVE_FROM_PARTY">Receive from Party (Party Pays Shop)</option>
                      <option value="PAY_TO_PARTY">Pay to Party (Shop Pays Party)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Payment Mode *
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="RTGS_NEFT">RTGS / NEFT</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Live Dynamic Reconciliation Preview Card (Example from spec) */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                <span className="text-[11px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Post-Settlement Projected Balances
                </span>
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase">
                      REMAINING METAL POSITION
                    </span>
                    <div className="text-lg font-mono font-bold text-foreground">
                      {projectedRemainingMetal.toFixed(4)} g
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      {currentPartyMetalBalance.toFixed(4)}g − {parseFloat(metalGrams || "0").toFixed(4)}g
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase">
                      REMAINING CASH POSITION
                    </span>
                    <div className="text-lg font-mono font-bold text-foreground">
                      ₹{projectedRemainingCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      ₹{parseFloat(currentPartyCashBalance.toString()).toLocaleString("en-IN")} − ₹{parseFloat(cashAmount || "0").toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Reference & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Reference / Voucher # (Optional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. DUAL-SETTLEMENT-01"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Settle partial metal advance & cash"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {loading ? "Posting..." : "Confirm & Post Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL SETTLEMENT MODAL */}
      {cancellingSettlement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-foreground">
                  Cancel Dual Settlement
                </h3>
              </div>
              <button
                onClick={() => setCancellingSettlement(null)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cancelling settlement <strong className="text-foreground">{cancellingSettlement.settlementNumber}</strong> will automatically reverse both the physical metal movement and cash payment transaction.
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Cancellation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Settled incorrect metal weight or cash amount"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCancellingSettlement(null)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading || !cancelReason.trim()}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {loading ? "Reversing..." : "Confirm Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
