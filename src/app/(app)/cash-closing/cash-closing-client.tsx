"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  History,
  Lock,
  Calendar,
  Eye,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getCashSummaryForDateAction,
  recordCashClosingAction,
} from "@/lib/actions/cash-closing-actions";

interface SerializedSummary {
  closingDate: string;
  openingBalance: string;
  totalCashReceived: string;
  totalCashPaid: string;
  expectedBalance: string;
  paymentReceiptsCount: number;
  paymentDisbursementsCount: number;
  cashSalesCount: number;
  cashPurchasesCount: number;
}

interface SerializedClosing {
  id: string;
  closingDate: string;
  shift: string;
  openingBalance: string;
  totalCashReceived: string;
  totalCashPaid: string;
  expectedBalance: string;
  physicalBalance: string;
  difference: string;
  status: "BALANCED" | "EXCESS" | "SHORTAGE";
  denominations: Record<string, number>;
  notes: string | null;
  createdAt: string;
  closedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface Props {
  initialSummary: SerializedSummary;
  initialClosings: SerializedClosing[];
  userRole: string;
  userName: string;
}

const NOTE_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export function CashClosingClient({
  initialSummary,
  initialClosings,
  userRole,
  userName,
}: Props) {
  const router = useRouter();
  const [closings, setClosings] = useState<SerializedClosing[]>(initialClosings);
  const [selectedDate, setSelectedDate] = useState(initialSummary.closingDate);
  const [shift, setShift] = useState<"FULL_DAY" | "MORNING" | "EVENING">("FULL_DAY");
  const [summary, setSummary] = useState<SerializedSummary>(initialSummary);
  const [openingBalance, setOpeningBalance] = useState(initialSummary.openingBalance);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingDate, setFetchingDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected closing to inspect modal
  const [inspectClosing, setInspectClosing] = useState<SerializedClosing | null>(null);

  // Physical Counts Map
  const [counts, setCounts] = useState<Record<string, number>>({
    "500": 0,
    "200": 0,
    "100": 0,
    "50": 0,
    "20": 0,
    "10": 0,
    "5": 0,
    "2": 0,
    "1": 0,
    coins: 0,
  });

  // Re-fetch summary when date changes
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setFetchingDate(true);
    setError(null);

    const res = await getCashSummaryForDateAction(newDate);
    setFetchingDate(false);

    if (res.success && res.data) {
      setSummary({
        closingDate: res.data.closingDate,
        openingBalance: res.data.openingBalance.toString(),
        totalCashReceived: res.data.totalCashReceived.toString(),
        totalCashPaid: res.data.totalCashPaid.toString(),
        expectedBalance: res.data.expectedBalance.toString(),
        paymentReceiptsCount: res.data.paymentReceiptsCount,
        paymentDisbursementsCount: res.data.paymentDisbursementsCount,
        cashSalesCount: res.data.cashSalesCount,
        cashPurchasesCount: res.data.cashPurchasesCount,
      });
      setOpeningBalance(res.data.openingBalance.toString());
    } else {
      setError(res.error || "Failed to load summary for selected date");
    }
  };

  const handleCountChange = (key: string, val: string) => {
    const num = parseInt(val) || 0;
    setCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, num),
    }));
  };

  // Calculations
  const calculations = useMemo(() => {
    const openNum = parseFloat(openingBalance) || 0;
    const recvNum = parseFloat(summary.totalCashReceived) || 0;
    const paidNum = parseFloat(summary.totalCashPaid) || 0;
    const expected = openNum + recvNum - paidNum;

    let physical = 0;
    for (const d of NOTE_DENOMINATIONS) {
      physical += (counts[d.toString()] || 0) * d;
    }
    physical += counts.coins || 0;

    const diff = physical - expected;
    let status: "BALANCED" | "EXCESS" | "SHORTAGE" = "BALANCED";
    if (diff > 0.01) status = "EXCESS";
    else if (diff < -0.01) status = "SHORTAGE";

    return {
      expected,
      physical,
      diff,
      status,
    };
  }, [openingBalance, summary.totalCashReceived, summary.totalCashPaid, counts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await recordCashClosingAction({
      closingDate: selectedDate,
      shift,
      openingBalance,
      totalCashReceived: summary.totalCashReceived,
      totalCashPaid: summary.totalCashPaid,
      denominations: counts,
      notes,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to close cash drawer");
      return;
    }

    setSuccess(
      `Drawer closed successfully for ${selectedDate} (${shift}). Status: ${calculations.status}.`
    );
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Controls */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Cash Counter Closing Session
            </h3>
            <p className="text-xs text-muted-foreground">
              Cashier: <span className="text-foreground font-semibold">{userName}</span> • Role: {userRole}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <label className="font-semibold text-muted-foreground">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-input bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <label className="font-semibold text-muted-foreground">Shift:</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="FULL_DAY">Full Day</option>
              <option value="MORNING">Morning Shift</option>
              <option value="EVENING">Evening Shift</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Main Reconciliation Workspace: 2-Column Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Drawer Summary & Expected Cash (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>SYSTEM CASH AUDIT</span>
              <Calculator className="w-4 h-4 text-primary" />
            </h4>

            {/* Opening Balance */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Opening Cash in Drawer (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Carried forward from last counter closing
              </span>
            </div>

            {/* Inflows & Outflows */}
            <div className="space-y-2 pt-2 border-t border-border text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                  <div>
                    <div className="font-semibold">Cash Receipts Inflow</div>
                    <div className="text-[10px] opacity-80">
                      {summary.paymentReceiptsCount} payment(s), {summary.cashSalesCount} counter cash sale(s)
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  + ₹{parseFloat(summary.totalCashReceived).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <ArrowUpRight className="w-4 h-4" />
                  <div>
                    <div className="font-semibold">Cash Paid Outflow</div>
                    <div className="text-[10px] opacity-80">
                      {summary.paymentDisbursementsCount} disbursal(s), {summary.cashPurchasesCount} purchase(s)
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  - ₹{parseFloat(summary.totalCashPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Expected Result */}
            <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">
                  SYSTEM EXPECTED CASH
                </span>
                <span className="text-[10px] text-muted-foreground">
                  (Opening + Inflow − Outflow)
                </span>
              </div>
              <div className="text-xl font-extrabold font-mono text-foreground">
                ₹{calculations.expected.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Closing Notes */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Closing Remarks / Audit Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. End of day balance verified, night deposit deposited into main safe"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Physical Note Count Sheet (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span>PHYSICAL CURRENCY COUNT (INR NOTE BREAKDOWN)</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  setCounts({
                    "500": 0,
                    "200": 0,
                    "100": 0,
                    "50": 0,
                    "20": 0,
                    "10": 0,
                    "5": 0,
                    "2": 0,
                    "1": 0,
                    coins: 0,
                  })
                }
                className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Clear Count
              </button>
            </div>

            {/* Denomination Notes Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2 px-3">Note Denomination</th>
                    <th className="py-2 px-3 text-center">Physical Piece Count</th>
                    <th className="py-2 px-3 text-right">Subtotal (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {NOTE_DENOMINATIONS.map((d) => {
                    const count = counts[d.toString()] || 0;
                    const subtotal = count * d;
                    return (
                      <tr key={d} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-semibold text-foreground">
                          ₹{d} Notes
                        </td>
                        <td className="py-1 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={count || ""}
                            placeholder="0"
                            onChange={(e) => handleCountChange(d.toString(), e.target.value)}
                            className="w-24 px-2.5 py-1 text-center font-mono font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-foreground">
                          ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Loose Coins Row */}
                  <tr className="hover:bg-muted/20 bg-muted/10">
                    <td className="py-2 px-3 font-semibold text-foreground">
                      Loose Coins / Change
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={counts.coins || ""}
                        placeholder="0.00"
                        onChange={(e) => handleCountChange("coins", e.target.value)}
                        className="w-24 px-2.5 py-1 text-center font-mono font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-foreground">
                      ₹{(counts.coins || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Variance & Status Box */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">TOTAL PHYSICAL COUNT:</span>
                <span className="text-lg font-mono font-bold text-foreground">
                  ₹{calculations.physical.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">EXPECTED CASH IN DRAWER:</span>
                <span className="font-mono text-muted-foreground">
                  ₹{calculations.expected.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Difference Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  calculations.status === "BALANCED"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : calculations.status === "EXCESS"
                    ? "bg-sky-500/10 border-sky-500/20 text-sky-500"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  {calculations.status === "BALANCED" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    DRAWER STATUS: {calculations.status}
                  </span>
                </div>
                <div className="font-mono font-bold text-sm">
                  {calculations.diff >= 0 ? "+" : ""}₹{calculations.diff.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {loading ? "Recording Closing..." : "Confirm & Close Drawer"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* History Log Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
            <History className="w-4 h-4 text-primary" />
            Previous Cash Counter Closings
          </h4>
          <span className="text-xs text-muted-foreground">
            {closings.length} recorded session(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Closing Date</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4 text-right">Opening (₹)</th>
                <th className="py-3 px-4 text-right">Inflow (₹)</th>
                <th className="py-3 px-4 text-right">Outflow (₹)</th>
                <th className="py-3 px-4 text-right">Expected (₹)</th>
                <th className="py-3 px-4 text-right">Physical (₹)</th>
                <th className="py-3 px-4 text-right">Variance (₹)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Closed By</th>
                <th className="py-3 px-4 text-right">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-muted-foreground">
                    No cash drawer closings recorded yet.
                  </td>
                </tr>
              ) : (
                closings.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {c.closingDate}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-foreground border border-border">
                        {c.shift}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      ₹{parseFloat(c.openingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-500 font-medium">
                      +₹{parseFloat(c.totalCashReceived).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-500 font-medium">
                      -₹{parseFloat(c.totalCashPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                      ₹{parseFloat(c.expectedBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      ₹{parseFloat(c.physicalBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          parseFloat(c.difference) === 0
                            ? "text-emerald-500"
                            : parseFloat(c.difference) > 0
                            ? "text-sky-500"
                            : "text-rose-500"
                        }
                      >
                        {parseFloat(c.difference) >= 0 ? "+" : ""}
                        ₹{parseFloat(c.difference).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          c.status === "BALANCED"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : c.status === "EXCESS"
                            ? "bg-sky-500/10 text-sky-500 border-sky-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {c.closedBy?.name || "System"}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground max-w-xs truncate">
                      {c.notes || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
