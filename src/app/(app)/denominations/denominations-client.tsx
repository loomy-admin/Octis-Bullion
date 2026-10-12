"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Coins,
  Calculator,
  Plus,
  Search,
  Sparkles,
  Layers,
  Edit2,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  Percent,
  Check,
  TrendingUp,
  Table,
  BadgeIndianRupee,
  ArrowRightLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createDenominationAction,
  updateDenominationAction,
  calculateDenominationBreakdownAction,
  getDenominationRateBoardAction,
  seedStandardDenominationsAction,
} from "@/lib/actions/denomination-actions";

interface DenominationItem {
  id: string;
  metalId: string;
  purityId: string;
  type: "BAR" | "COIN";
  name: string;
  weightGrams: string;
  premiumAmount: string;
  isActive: boolean;
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
}

export interface RateBoardItem {
  id: string;
  name: string;
  type: "BAR" | "COIN";
  weightGrams: number;
  premiumAmount: number;
  metalAmount: number;
  totalAmount: number;
  effectiveRatePerGram: number;
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

interface RateItem {
  metalId: string;
  purityId: string;
  sellRate: string;
  buyRate: string;
}

interface Props {
  initialDenominations: DenominationItem[];
  metals: MetalItem[];
  rates: RateItem[];
  userRole: string;
}

export function DenominationsClient({
  initialDenominations,
  metals,
  rates,
  userRole,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"calculator" | "rate-board" | "catalogue">("calculator");
  const [denominations, setDenominations] = useState<DenominationItem[]>(initialDenominations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculator State
  const [calcMode, setCalcMode] = useState<"WEIGHT" | "BUDGET">("WEIGHT");
  const [calcMetalId, setCalcMetalId] = useState(metals[0]?.id || "");
  const [calcPurityId, setCalcPurityId] = useState(metals[0]?.purities[0]?.id || "");
  const [calcWeight, setCalcWeight] = useState("118");
  const [calcBudget, setCalcBudget] = useState("500000");
  const [calcRate, setCalcRate] = useState("7500");
  const [breakdownResult, setBreakdownResult] = useState<any>(null);

  // Rate Board State
  const [rbMetalId, setRbMetalId] = useState(metals[0]?.id || "");
  const [rbPurityId, setRbPurityId] = useState(metals[0]?.purities[0]?.id || "");
  const [rbRate, setRbRate] = useState("7500");
  const [rateBoardItems, setRateBoardItems] = useState<RateBoardItem[]>([]);
  const [rbLoading, setRbLoading] = useState(false);

  // Keep calc purity synced with metal
  const calcPurities = useMemo(() => {
    return metals.find((m) => m.id === calcMetalId)?.purities || [];
  }, [metals, calcMetalId]);

  useEffect(() => {
    if (calcPurities.length > 0 && !calcPurities.some((p) => p.id === calcPurityId)) {
      setCalcPurityId(calcPurities[0].id);
    }
  }, [calcPurities, calcPurityId]);

  // Keep rate board purity synced with metal
  const rbPurities = useMemo(() => {
    return metals.find((m) => m.id === rbMetalId)?.purities || [];
  }, [metals, rbMetalId]);

  useEffect(() => {
    if (rbPurities.length > 0 && !rbPurities.some((p) => p.id === rbPurityId)) {
      setRbPurityId(rbPurities[0].id);
    }
  }, [rbPurities, rbPurityId]);

  // Auto-fill live rate if available for Calculator
  useEffect(() => {
    const live = rates.find((r) => r.metalId === calcMetalId && r.purityId === calcPurityId);
    if (live && live.sellRate && parseFloat(live.sellRate) > 0) {
      setCalcRate(live.sellRate);
    }
  }, [calcMetalId, calcPurityId, rates]);

  // Auto-fill live rate if available for Rate Board
  useEffect(() => {
    const live = rates.find((r) => r.metalId === rbMetalId && r.purityId === rbPurityId);
    if (live && live.sellRate && parseFloat(live.sellRate) > 0) {
      setRbRate(live.sellRate);
    }
  }, [rbMetalId, rbPurityId, rates]);

  // Fetch Rate Board data
  const fetchRateBoard = useCallback(async () => {
    if (!rbMetalId || !rbPurityId || !rbRate || parseFloat(rbRate) <= 0) return;
    setRbLoading(true);
    const res = await getDenominationRateBoardAction(rbMetalId, rbPurityId, rbRate);
    setRbLoading(false);
    if (res.success && res.data) {
      setRateBoardItems(res.data.items);
    }
  }, [rbMetalId, rbPurityId, rbRate]);

  useEffect(() => {
    if (activeTab === "rate-board") {
      void fetchRateBoard();
    }
  }, [activeTab, fetchRateBoard]);

  // Catalogue Filters
  const [catMetalFilter, setCatMetalFilter] = useState("ALL");
  const [catTypeFilter, setCatTypeFilter] = useState<"ALL" | "BAR" | "COIN">("ALL");
  const [catSearch, setCatSearch] = useState("");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DenominationItem | null>(null);
  const [editPremium, setEditPremium] = useState("");

  // Add Form State
  const [addForm, setAddForm] = useState({
    metalId: metals[0]?.id || "",
    purityId: metals[0]?.purities[0]?.id || "",
    type: "COIN" as "BAR" | "COIN",
    name: "",
    weightGrams: "",
    premiumAmount: "0",
  });

  const addPurities = useMemo(() => {
    return metals.find((m) => m.id === addForm.metalId)?.purities || [];
  }, [metals, addForm.metalId]);

  useEffect(() => {
    if (addPurities.length > 0 && !addPurities.some((p) => p.id === addForm.purityId)) {
      setAddForm((prev) => ({ ...prev, purityId: addPurities[0].id }));
    }
  }, [addPurities, addForm.purityId]);

  // Handle Calculate
  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetVal = calcMode === "BUDGET" ? calcBudget : calcWeight;
    const res = await calculateDenominationBreakdownAction(
      targetVal,
      calcMetalId,
      calcPurityId,
      calcRate,
      {
        calculationMode: calcMode,
        budgetAmount: calcMode === "BUDGET" ? calcBudget : undefined,
      }
    );

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to calculate breakdown");
      return;
    }

    setBreakdownResult(res.data);
  };

  // Run calculation once on mount if we have denominations
  useEffect(() => {
    if (denominations.length > 0 && !breakdownResult) {
      void calculateDenominationBreakdownAction(
        calcWeight,
        calcMetalId,
        calcPurityId,
        calcRate,
        { calculationMode: "WEIGHT" }
      ).then((res) => {
        if (res.success) setBreakdownResult(res.data);
      });
    }
  }, [denominations.length]);

  // Handle Seed
  const handleSeed = async () => {
    setLoading(true);
    const res = await seedStandardDenominationsAction();
    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to seed catalogue");
    } else {
      router.refresh();
    }
  };

  // Handle Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createDenominationAction({
      metalId: addForm.metalId,
      purityId: addForm.purityId,
      type: addForm.type,
      name: addForm.name,
      weightGrams: addForm.weightGrams,
      premiumAmount: addForm.premiumAmount,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create denomination");
      return;
    }

    setIsAddModalOpen(false);
    setAddForm({
      metalId: metals[0]?.id || "",
      purityId: metals[0]?.purities[0]?.id || "",
      type: "COIN",
      name: "",
      weightGrams: "",
      premiumAmount: "0",
    });
    router.refresh();
  };

  // Handle Edit Premium
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setLoading(true);
    setError(null);

    const res = await updateDenominationAction({
      id: editingItem.id,
      premiumAmount: editPremium,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to update premium");
      return;
    }

    setEditingItem(null);
    router.refresh();
  };

  const filteredCatalogue = useMemo(() => {
    return denominations.filter((d) => {
      if (catMetalFilter !== "ALL" && d.metalId !== catMetalFilter) return false;
      if (catTypeFilter !== "ALL" && d.type !== catTypeFilter) return false;
      if (catSearch) {
        const q = catSearch.toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !d.weightGrams.includes(q)) return false;
      }
      return true;
    });
  }, [denominations, catMetalFilter, catTypeFilter, catSearch]);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("calculator")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "calculator"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Breakdown & Budget Taker
          </button>
          <button
            onClick={() => setActiveTab("rate-board")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "rate-board"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table className="w-4 h-4" />
            Live Denomination Rate Board
          </button>
          <button
            onClick={() => setActiveTab("catalogue")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "catalogue"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4" />
            Coins & Bars Catalogue ({denominations.length})
          </button>
        </div>

        {activeTab === "catalogue" && denominations.length === 0 && (
          <button
            onClick={handleSeed}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Seed Standard Catalogue (1g to 1kg)
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {error}
        </div>
      )}

      {/* TAB 1: CALCULATOR (WEIGHT + BUDGET TAKER) */}
      {activeTab === "calculator" && (
        <div className="space-y-6">
          {/* Input Box */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Physical Bullion Breakdown & Budget Optimizer
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculate the exact allocation of physical minted coins and cast bars by either target weight or total customer budget.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCalcMode("WEIGHT")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    calcMode === "WEIGHT"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  By Weight (grams)
                </button>
                <button
                  type="button"
                  onClick={() => setCalcMode("BUDGET")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    calcMode === "BUDGET"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BadgeIndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                  By Budget (₹ Amount)
                </button>
              </div>
            </div>

            <form onSubmit={handleCalculate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Metal</label>
                <select
                  value={calcMetalId}
                  onChange={(e) => setCalcMetalId(e.target.value)}
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
                <label className="block text-xs font-semibold text-foreground mb-1">Purity</label>
                <select
                  value={calcPurityId}
                  onChange={(e) => setCalcPurityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {calcPurities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({parseFloat(p.purityPercentage).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>

              {calcMode === "WEIGHT" ? (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Target Weight (grams) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value)}
                    placeholder="e.g. 118"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-foreground">Customer Budget (₹) *</label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ~{(parseFloat(calcBudget || "0") / (parseFloat(calcRate) || 1)).toFixed(2)}g
                    </span>
                  </div>
                  <input
                    type="number"
                    step="100"
                    required
                    value={calcBudget}
                    onChange={(e) => setCalcBudget(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary text-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Rate (₹ per gram) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={calcRate}
                  onChange={(e) => setCalcRate(e.target.value)}
                  placeholder="e.g. 7500"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  {calcMode === "BUDGET" ? "Allocate from Budget" : "Decompose Weight"}
                </button>
              </div>
            </form>
          </div>

          {/* Results Display */}
          {breakdownResult && (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                  <span className="text-xs text-muted-foreground font-medium">
                    {breakdownResult.calculationMode === "BUDGET" ? "BUDGET COMMITTED" : "ALLOCATED WEIGHT"}
                  </span>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    {breakdownResult.calculationMode === "BUDGET"
                      ? `₹${(breakdownResult.budgetAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : `${breakdownResult.allocatedWeightGrams.toFixed(3)} g`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {breakdownResult.calculationMode === "BUDGET"
                      ? `Equiv: ${breakdownResult.targetWeightGrams.toFixed(3)}g (Alloc: ${breakdownResult.allocatedWeightGrams.toFixed(3)}g)`
                      : `Target: ${breakdownResult.targetWeightGrams.toFixed(3)} g`}
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                  <span className="text-xs text-muted-foreground font-medium">PURE METAL VALUE</span>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    ₹{breakdownResult.metalTotalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {breakdownResult.allocatedWeightGrams.toFixed(3)}g @ ₹{breakdownResult.ratePerGram.toFixed(2)}/g
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                  <span className="text-xs text-muted-foreground font-medium">TOTAL MAKING / MINTING</span>
                  <div className="text-xl font-bold mt-1 text-amber-500">
                    + ₹{breakdownResult.totalPremiumAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Fabrication & certification premiums
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                  <span className="text-xs text-muted-foreground font-medium">FINAL INVOICE BILL</span>
                  <div className="text-xl font-bold mt-1 text-emerald-500">
                    ₹{breakdownResult.grandTotalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Gross bill including premiums
                  </div>
                </div>
              </div>

              {/* Budget Mode: Change / Balance refund alert */}
              {breakdownResult.calculationMode === "BUDGET" &&
                breakdownResult.unallocatedBudgetAmount !== undefined &&
                breakdownResult.unallocatedBudgetAmount > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Unspent Budget / Change to Return to Customer:
                    </span>
                    <span className="font-mono font-bold text-sm">
                      ₹{breakdownResult.unallocatedBudgetAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

              {/* Remainder Alert if target couldn't be covered completely */}
              {breakdownResult.unallocatedWeightGrams > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Unallocated remainder: {breakdownResult.unallocatedWeightGrams.toFixed(3)}g could not be matched by standard catalogue units.
                  </span>
                  <span className="font-mono font-semibold">
                    Cut piece / Granules value: ₹{(breakdownResult.unallocatedWeightGrams * breakdownResult.ratePerGram).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Physical Vault Picking List Table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-emerald-500" />
                    Vault Picking Checklist (Physical Denominations)
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {breakdownResult.items.length} denomination line(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Qty</th>
                        <th className="py-2.5 px-4">Denomination</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4 text-right">Unit Weight</th>
                        <th className="py-2.5 px-4 text-right">Total Weight</th>
                        <th className="py-2.5 px-4 text-right">Minting Premium</th>
                        <th className="py-2.5 px-4 text-right">Metal Value</th>
                        <th className="py-2.5 px-4 text-right">Total Line Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {breakdownResult.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-3 px-4 font-bold text-foreground font-mono text-sm">
                            {item.quantity} ×
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">
                            {item.name}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                item.type === "BAR"
                                  ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {item.weightGrams.toFixed(3)}g
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                            {item.totalWeightGrams.toFixed(3)}g
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-amber-500">
                            ₹{item.totalPremium.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            <span className="text-[10px] text-muted-foreground block">
                              (₹{item.unitPremium}/pc)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            ₹{item.metalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                            ₹{item.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE DENOMINATION RATE BOARD */}
      {activeTab === "rate-board" && (
        <div className="space-y-6">
          {/* Rate Selector Header */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Table className="w-4 h-4 text-primary" />
                  Live Denomination Retail Rate Matrix
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Converts live base metal rate into denomination-wise retail customer prices (Base metal + making/minting premium).
                </p>
              </div>

              <button
                type="button"
                onClick={() => void fetchRateBoard()}
                disabled={rbLoading}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50 self-start sm:self-auto flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {rbLoading ? "Updating..." : "Refresh Board"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Metal</label>
                <select
                  value={rbMetalId}
                  onChange={(e) => setRbMetalId(e.target.value)}
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
                <label className="block text-xs font-semibold text-foreground mb-1">Purity</label>
                <select
                  value={rbPurityId}
                  onChange={(e) => setRbPurityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {rbPurities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({parseFloat(p.purityPercentage).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Live Rate (₹ per gram)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rbRate}
                  onChange={(e) => setRbRate(e.target.value)}
                  placeholder="e.g. 7500"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Quick Highlight Cards */}
          {rateBoardItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { weight: 1, label: "1g Coin" },
                { weight: 10, label: "10g Coin" },
                { weight: 100, label: "100g Bar" },
                { weight: 1000, label: "1kg Good Delivery" },
              ].map((pill) => {
                const item = rateBoardItems.find(
                  (i) => Math.abs(i.weightGrams - pill.weight) < 0.01
                );
                return (
                  <div
                    key={pill.weight}
                    className="p-3 rounded-xl border border-border bg-card/60 shadow-xs flex flex-col justify-between"
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                      {pill.label}
                    </span>
                    <div className="text-lg font-bold font-mono text-foreground mt-1">
                      {item ? `₹${item.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {item ? `₹${item.effectiveRatePerGram.toFixed(1)}/g eff.` : "Not in catalogue"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rate Board Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                Physical Denomination Rate Matrix (@ ₹{parseFloat(rbRate || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}/g)
              </h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                {rateBoardItems.length} active denomination(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Denomination</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Unit Weight</th>
                    <th className="py-2.5 px-4 text-right">Base Metal Value</th>
                    <th className="py-2.5 px-4 text-right">Making / Minting Premium</th>
                    <th className="py-2.5 px-4 text-right">Final Retail Price</th>
                    <th className="py-2.5 px-4 text-right">Effective ₹/g</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rateBoardItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No active denominations found for this metal and purity.
                      </td>
                    </tr>
                  ) : (
                    rateBoardItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {item.name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              item.type === "BAR"
                                ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                          {item.weightGrams.toFixed(3)}g
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          ₹{item.metalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-500">
                          + ₹{item.premiumAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500 text-sm">
                          ₹{item.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          ₹{item.effectiveRatePerGram.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setCalcWeight(item.weightGrams.toString());
                              setCalcMetalId(rbMetalId);
                              setCalcPurityId(rbPurityId);
                              setCalcRate(rbRate);
                              setCalcMode("WEIGHT");
                              setActiveTab("calculator");
                            }}
                            className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted/50 text-[11px] font-semibold text-primary transition-colors cursor-pointer"
                          >
                            Decompose
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATALOGUE MASTER */}
      {activeTab === "catalogue" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={catMetalFilter}
                onChange={(e) => setCatMetalFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Metals</option>
                {metals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border">
                {["ALL", "BAR", "COIN"].map((tp) => (
                  <button
                    key={tp}
                    onClick={() => setCatTypeFilter(tp as any)}
                    className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                      catTypeFilter === tp
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {tp}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search denomination..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary w-48"
                />
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
          </div>

          {/* Master Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Metal</th>
                    <th className="py-3 px-4">Purity</th>
                    <th className="py-3 px-4 text-right">Standard Weight</th>
                    <th className="py-3 px-4 text-right">Minting / Making Premium</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCatalogue.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-muted-foreground">
                        No denominations registered. Click &quot;Seed Standard Catalogue&quot; or &quot;Add Item&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalogue.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {d.name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              d.type === "BAR"
                                ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            }`}
                          >
                            {d.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{d.metal?.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{d.purity?.name}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {parseFloat(d.weightGrams).toFixed(3)} g
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-500">
                          ₹{parseFloat(d.premiumAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          {d.isActive ? (
                            <span className="text-[10px] font-semibold text-emerald-500">ACTIVE</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-muted-foreground">INACTIVE</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingItem(d);
                              setEditPremium(d.premiumAmount);
                            }}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-foreground mb-1">
              Add New Metal Denomination
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Register a minted coin or cast bar in the system catalogue
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Denomination Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5g Lakshmi Gold Coin"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Metal</label>
                  <select
                    value={addForm.metalId}
                    onChange={(e) => setAddForm({ ...addForm, metalId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  >
                    {metals.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Purity</label>
                  <select
                    value={addForm.purityId}
                    onChange={(e) => setAddForm({ ...addForm, purityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  >
                    {addPurities.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Type</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  >
                    <option value="COIN">COIN</option>
                    <option value="BAR">BAR</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Weight (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="5.000"
                    value={addForm.weightGrams}
                    onChange={(e) => setAddForm({ ...addForm, weightGrams: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Premium (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="350"
                    value={addForm.premiumAmount}
                    onChange={(e) => setAddForm({ ...addForm, premiumAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Premium Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Update Minting Premium: {editingItem.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Standard weight: {parseFloat(editingItem.weightGrams).toFixed(3)}g
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Premium Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPremium}
                  onChange={(e) => setEditPremium(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                >
                  Save Premium
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
