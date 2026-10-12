"use client";

import React, { useState, useTransition } from "react";
import {
  TrendingUp,
  Calculator,
  RefreshCw,
  Edit2,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles,
  DollarSign,
  Percent,
} from "lucide-react";
import {
  setMetalRateAction,
  calculateLandedCostAction,
} from "@/lib/actions/rate-actions";
import { formatCurrency, formatDate } from "@/lib/utils/helpers";
import { calculateLandedCost } from "@/lib/services/rate-service";
import { any } from "zod";

interface RateRow {
  id: string;
  metalId: string;
  purityId: string;
  buyRate: string;
  sellRate: string;
  mcxBenchmarkRate?: string | null;
  usdOunceRate?: string | null;
  usdInrRate?: string | null;
  customsDutyPct?: string | null;
  gstPct?: string | null;
  marginPerGram?: string | null;
  landedCostPerGram?: string | null;
  isLive: boolean;
  updatedAt: string;
  metal?: { id: string; name: string; code: string } | null;
  purity?: { id: string; label: string; fineness: string } | null;
  updatedBy?: { id: string; name: string; email: string } | null;
}

interface RatesClientProps {
  initialRates: RateRow[];
  metals: Array<{
    id: string;
    name: string;
    code: string;
    purities: Array<{ id: string; label: string; fineness: string; isActive: boolean }>;
  }>;
  userRole: "ADMIN" | "STAFF";
}

export function RatesClient({ initialRates, metals, userRole }: RatesClientProps) {
  const isAdmin = userRole === "ADMIN";
  const [rates, setRates] = useState<RateRow[]>(initialRates);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Calculator State
  const [usdOuncePrice, setUsdOuncePrice] = useState("2750.00");
  const [usdInrRate, setUsdInrRate] = useState("86.50");
  const [customsDutyPct, setCustomsDutyPct] = useState("15.00");
  const [gstPct, setGstPct] = useState("3.00");
  const [marginPerGram, setMarginPerGram] = useState("50.00");

  // Edit Rate Modal State
  const [editingRate, setEditingRate] = useState<{
    metalId: string;
    purityId: string;
    metalName: string;
    purityLabel: string;
    buyRate: string;
    sellRate: string;
    marginPerGram: string;
    mcxRate: string;
  } | null>(null);

  // Live Landed Cost Calculation
  const calc = calculateLandedCost({
    usdOuncePrice,
    usdInrRate,
    customsDutyPct,
    gstPct,
    marginPerGram,
  });

  const handleApplyToBoard = (metalId: string, purityId: string) => {
    startTransition(async () => {
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await setMetalRateAction({
        metalId,
        purityId,
        buyRate: calc.recommendedBuyRate,
        sellRate: calc.recommendedSellRate,
        usdOunceRate: usdOuncePrice,
        usdInrRate,
        customsDutyPct,
        gstPct,
        marginPerGram,
      });

      if (res.success && res.data) {
        setSuccessMsg("Landed rates applied successfully to rate desk!");
        setRates((prev) => {
          const filtered = prev.filter((r) => !(r.metalId === metalId && r.purityId === purityId));
          return [res.data as unknown as RateRow, ...filtered];
        });
      } else {
        setErrorMsg(res.error || "Failed to update rate desk");
      }
    });
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Section: Landed Cost Calculator */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--border-primary)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C59A58]/10 text-[#C59A58]">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Landed Per-Gram Cost Calculator
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Formula: ($/oz × USD/INR × (1 + Customs Duty) × (1 + GST)) ÷ 31.10g
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
            Live Math Engine
          </span>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
              London / Spot ($/oz)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono">$</span>
              <input
                type="text"
                value={usdOuncePrice}
                onChange={(e) => setUsdOuncePrice(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)] focus:border-[#C59A58] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
              USD / INR Forex
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono">₹</span>
              <input
                type="text"
                value={usdInrRate}
                onChange={(e) => setUsdInrRate(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)] focus:border-[#C59A58] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
              Customs Duty (%)
            </label>
            <div className="relative">
              <input
                type="text"
                value={customsDutyPct}
                onChange={(e) => setCustomsDutyPct(e.target.value)}
                className="w-full pl-3 pr-7 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)] focus:border-[#C59A58] focus:outline-hidden"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono">%</span>
            </div>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
              GST / IGST (%)
            </label>
            <div className="relative">
              <input
                type="text"
                value={gstPct}
                onChange={(e) => setGstPct(e.target.value)}
                className="w-full pl-3 pr-7 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)] focus:border-[#C59A58] focus:outline-hidden"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono">%</span>
            </div>
          </div>

          <div>
            <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
              Retail Margin (₹/g)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono">₹</span>
              <input
                type="text"
                value={marginPerGram}
                onChange={(e) => setMarginPerGram(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)] focus:border-[#C59A58] focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Step-by-Step Breakdown Output */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-primary)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block tracking-wider">
              1. Base Value / Ounce
            </span>
            <div className="text-base font-bold font-mono text-[var(--text-primary)]">
              {formatCurrency(calc.baseInrPerOz)}
            </div>
            <span className="text-[10px] text-[var(--text-secondary)]">
              ${usdOuncePrice} × ₹{usdInrRate}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-primary)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block tracking-wider">
              2. Total Duty & GST / Oz
            </span>
            <div className="text-base font-bold font-mono text-[var(--text-secondary)]">
              {formatCurrency(
                (parseFloat(calc.dutyAmountPerOz) + parseFloat(calc.gstAmountPerOz)).toFixed(2)
              )}
            </div>
            <span className="text-[10px] text-[var(--text-secondary)]">
              Duty: {formatCurrency(calc.dutyAmountPerOz)} + GST: {formatCurrency(calc.gstAmountPerOz)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#C59A58]/10 border border-[#C59A58]/30 space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#C59A58] block tracking-wider">
              3. Pure Landed Cost / g
            </span>
            <div className="text-lg font-bold font-mono text-[#C59A58]">
              {formatCurrency(calc.landedCostPerGram)}
            </div>
            <span className="text-[10px] text-[var(--text-secondary)]">
              {formatCurrency(calc.totalLandedPerOz)} ÷ 31.1g
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-green-500/10 border border-green-500/30 space-y-1">
            <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400 block tracking-wider">
              4. Rec. Sell Rate (with margin)
            </span>
            <div className="text-lg font-bold font-mono text-green-600 dark:text-green-400">
              {formatCurrency(calc.recommendedSellRate)}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
              <span>Buy: {formatCurrency(calc.recommendedBuyRate)}</span>
              <span>Spread: ₹{(parseFloat(marginPerGram) * 2).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action bar for calculator */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-[var(--text-muted)]">
            Apply computed rate directly to active board purities:
          </p>
          <div className="flex items-center gap-2">
            {metals.map((m) =>
              m.purities
                .filter((p) => p.isActive)
                .map((p) => (
                  <button
                    key={`${m.id}_${p.id}`}
                    disabled={isPending}
                    onClick={() => handleApplyToBoard(m.id, p.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/5 hover:bg-[#C59A58]/10 hover:text-[#C59A58] border border-[var(--border-primary)] transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>
                      Apply to {m.name} {p.label}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Active Spot Rate Desk Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#C59A58]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Live Rate Desk & Trade Boards
            </h3>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            Updated in real-time across invoices
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[var(--text-secondary)]">
                <th className="py-3 px-4 font-semibold">Metal</th>
                <th className="py-3 px-4 font-semibold">Purity</th>
                <th className="py-3 px-4 font-semibold text-right">Shop Buying Rate (₹/g)</th>
                <th className="py-3 px-4 font-semibold text-right">Shop Selling Rate (₹/g)</th>
                <th className="py-3 px-4 font-semibold text-right">Spread (₹)</th>
                <th className="py-3 px-4 font-semibold text-right">Landed Cost</th>
                <th className="py-3 px-4 font-semibold">Last Updated</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {metals.flatMap((m) =>
                m.purities
                  .filter((p) => p.isActive)
                  .map((p) => {
                    const activeRate = rates.find(
                      (r) => r.metalId === m.id && r.purityId === p.id
                    );
                    const buyNum = activeRate ? parseFloat(activeRate.buyRate) : 0;
                    const sellNum = activeRate ? parseFloat(activeRate.sellRate) : 0;
                    const spread = sellNum > 0 && buyNum > 0 ? (sellNum - buyNum).toFixed(2) : "—";

                    return (
                      <tr
                        key={`${m.id}-${p.id}`}
                        className="hover:bg-[var(--bg-table-hover)] transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                          {m.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono font-semibold bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">
                            {p.label} ({Number(p.fineness).toFixed(4)})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {activeRate ? formatCurrency(activeRate.buyRate) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#C59A58]">
                          {activeRate ? formatCurrency(activeRate.sellRate) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                          {spread !== "—" ? formatCurrency(spread) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[var(--text-muted)]">
                          {activeRate?.landedCostPerGram
                            ? formatCurrency(activeRate.landedCostPerGram)
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)] text-[11px]">
                          {activeRate ? formatDate(activeRate.updatedAt) : "Not Configured"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() =>
                              setEditingRate({
                                metalId: m.id,
                                purityId: p.id,
                                metalName: m.name,
                                purityLabel: p.label,
                                buyRate: activeRate?.buyRate || "",
                                sellRate: activeRate?.sellRate || "",
                                marginPerGram: activeRate?.marginPerGram || "50.00",
                                mcxRate: activeRate?.mcxBenchmarkRate || "",
                              })
                            }
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#C59A58] hover:bg-black/5 dark:hover:bg-white/5 transition"
                            title="Edit Rate"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rate Modal */}
      {editingRate && (
        <EditRateModal
          data={editingRate}
          onClose={() => setEditingRate(null)}
          onSuccess={(newRate) => {
            setRates((prev) => {
              const filtered = prev.filter(
                (r) => !(r.metalId === newRate.metalId && r.purityId === newRate.purityId)
              );
              return [newRate, ...filtered];
            });
            setEditingRate(null);
            setSuccessMsg(`Rates updated for ${editingRate.metalName} ${editingRate.purityLabel}`);
          }}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Rate Modal Component
// ---------------------------------------------------------------------------

function EditRateModal({
  data,
  onClose,
  onSuccess,
  onError,
}: {
  data: {
    metalId: string;
    purityId: string;
    metalName: string;
    purityLabel: string;
    buyRate: string;
    sellRate: string;
    marginPerGram: string;
    mcxRate: string;
  };
  onClose: () => void;
  onSuccess: (rate: RateRow) => void;
  onError: (msg: string) => void;
}) {
  const [buyRate, setBuyRate] = useState(data.buyRate);
  const [sellRate, setSellRate] = useState(data.sellRate);
  const [mcxBenchmarkRate, setMcxBenchmarkRate] = useState(data.mcxRate);
  const [marginPerGram, setMarginPerGram] = useState(data.marginPerGram);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const buyNum = parseFloat(buyRate);
    const sellNum = parseFloat(sellRate);

    if (isNaN(buyNum) || buyNum <= 0) {
      onError("Buying rate must be positive");
      return;
    }
    if (isNaN(sellNum) || sellNum <= 0) {
      onError("Selling rate must be positive");
      return;
    }
    if (sellNum < buyNum) {
      onError("Selling rate cannot be lower than buying rate");
      return;
    }

    setLoading(true);
    const res = await setMetalRateAction({
      metalId: data.metalId,
      purityId: data.purityId,
      buyRate: buyRate.trim(),
      sellRate: sellRate.trim(),
      mcxBenchmarkRate: mcxBenchmarkRate.trim() || undefined,
      marginPerGram: marginPerGram.trim() || undefined,
    });
    setLoading(false);

    if (res.success && res.data) {
      onSuccess(res.data as unknown as RateRow);
    } else {
      onError(res.error || "Failed to update rates");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#C59A58]" />
            <span>
              Update {data.metalName} ({data.purityLabel})
            </span>
          </h3>
          <button onClick={onClose} className="text-xs text-[var(--text-muted)] hover:underline">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
                Shop Buying Rate (₹/g) *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={buyRate}
                onChange={(e) => setBuyRate(e.target.value)}
                placeholder="e.g. 7150.00"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
                Shop Selling Rate (₹/g) *
              </label>
              <input
                type="text"
                required
                value={sellRate}
                onChange={(e) => setSellRate(e.target.value)}
                placeholder="e.g. 7250.00"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)] font-bold text-[#C59A58]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
                Retail Margin (₹/g)
              </label>
              <input
                type="text"
                value={marginPerGram}
                onChange={(e) => setMarginPerGram(e.target.value)}
                placeholder="e.g. 50.00"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-[var(--text-secondary)]">
                MCX Benchmark (Optional)
              </label>
              <input
                type="text"
                value={mcxBenchmarkRate}
                onChange={(e) => setMcxBenchmarkRate(e.target.value)}
                placeholder="e.g. 76000/10g"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] font-mono text-[var(--text-primary)]"
              />
            </div>
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
              disabled={loading}
              className="px-4 py-2 text-xs rounded-xl bg-[#C59A58] text-white font-bold hover:bg-[#af813a] disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Rates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
