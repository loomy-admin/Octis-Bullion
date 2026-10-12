# OCTIS BULLION — AGENT CONTEXT & DEVELOPER ACTION GUIDE

> **Persistent Context Directive:**  
> This file acts as the single source of truth for the **Bullion Trading** application located at `c:/Rishi/nextjsprojects/bulion`.  
> Never rebuild existing working modules (Purchase, Sale, Stock, Masters, Reports, Audit). Extend the existing Sequelize/MySQL + Next.js codebase.  
> Maintain clean, professional, disciplined UI aesthetics: avoid excessive box-shadows, jarring hover effects, or gaudy colors. Follow the established neutral/dark luxury design system.

---

## 1. Domain Terminology & Core Concepts

| Term | Plain English Definition in Bullion |
| :--- | :--- |
| **Bullion** | Tradable precious metal (Gold, Silver) recorded strictly by purity (e.g., 24K, 22K, 999) and weight in grams. |
| **Purity** | Metal fineness (e.g. 24K/99.9%, 22K/91.6%). Different purities represent separate physical stock buckets. |
| **Rate** | Price per gram for a specific metal and purity. |
| **Fixed Rate** | Agreed and locked price per gram; does not change when market prices move. |
| **Unfixed Rate** | Metal transaction recorded by weight now, but final price per gram is agreed later. |
| **Rate Block / Booking** | Price reservation for a customer for a defined weight and time window. Has status `ACTIVE` ➔ `FULFILLED` / `EXPIRED` / `CANCELLED`. |
| **Margin** | Markup added to reference rate (Percentage `%` or Fixed `₹/g`). |
| **Stock Movement** | Append-only ledger record of metal physically received, delivered, or adjusted. Stock is never negative. |
| **Payment / Receipt** | Actual money moving into or out of shop accounts. Selecting payment mode on purchase/sale is descriptive only; actual money requires a posted payment transaction. |
| **Landed Per-Gram Cost** | Formula: $[ \text{Ounce Price (\$) } \times \text{USD/INR Rate} + 15\% \text{ Customs Duty} + 3\% \text{ GST} ] \div 31.1\text{g}$. |
| **Rate Cut / Uncut** | Strictly P2; do NOT implement until verified shop business rules are approved. |

---

## 2. Development Priorities & Execution Matrix

```text
================================================================================
                    OCTIS BULLION — ROADMAP & PRIORITY MATRIX
================================================================================
```

### **Priority 0 (P0) — Immediate Core Financials & Fixes [COMPLETED]**
1. **Sales Register Verification & Fix:** Verified Sales Register queries, server actions, client view, and journal logs.
2. **Payment / Receipt System (`/payments`):**
   - Standalone payment transactions separate from invoices with dual-directional posting (`PAYMENT_MADE` & `PAYMENT_RECEIVED`).
   - Split cash denomination counting sheet matching payment amount before counter submission.
   - Reversal support: non-destructive `CANCELLED` status with audit trail.
3. **Party Outstanding & Payment History:**
   - Real-time customer receivable and supplier payable outstanding calculations.
   - Quick payment action button directly inside `/counterparties`.
   - Comprehensive unit test coverage in `tests/unit/payment.test.ts`.

---

### **Priority 1 (P1) — Bullion-Specific Operational Features [COMPLETED]**
4. **Fixed vs Unfixed Rate Deals:**
   - Both Purchases (`/purchases`) and Sales (`/sales`) support `FIXED` vs `UNFIXED` rates.
   - Immediate physical stock receipt/dispatch upon deal confirmation.
   - Interactive "Fix Rate" modal recalculating total invoice amount and updating audit logs.
   - Unit tests in `tests/unit/fixing-rate.test.ts`.
5. **Rate Management + Margin Engine & Landed Cost Calculator (`/rates`):**
   - Live Landed Per-Gram Cost Calculator: $[ \text{USD/oz} \times \text{USD/INR} \times 1.15 \times 1.03 ] \div 31.1\text{g}$.
   - Reference market rate desk with buy/sell margin configuration and live rate broadcasting.
6. **Rate Block / Rate Booking (`/rate-blocks`):**
   - Reserve metal rate for a customer with advance deposit and timer expiration (1h, 2h, 4h, 8h, 24h, 48h).
   - Lifecycle: `ACTIVE` ➔ `FULFILLED` (links to Sale) / `CANCELLED` / `EXPIRED`.
   - Fulfill button seamlessly pre-fills and opens the New Sale modal.
7. **Metal Denominations (Coins & Bars Catalogue & Optimizer Desk at `/denominations`):**
   - Catalogue of standard minted coins and cast bars with making/minting premiums.
   - Weight Decomposition Optimizer tool: decomposes target weight (e.g. 118g) into physical pieces (1x 100g Bar + 1x 10g Coin + 1x 8g Guinea) with itemized premiums.
8. **Cashier Counter Closing & Reconciliation (`/cash-closing`):**
   - Automated end-of-day cash drawer balancing: $\text{Expected} = \text{Opening} + \text{Inflow} - \text{Outflow}$.
   - Physical currency counting sheet (₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1, Coins).
   - Real-time variance calculation (`BALANCED`, `EXCESS`, `SHORTAGE`) with session audit log.
   - Unit tests in `tests/unit/p1-features.test.ts` (106/106 tests passing).

---

### **Priority 2 (P2) — Deferred / Confirmed Later**
9. **Rate Cut / Uncut:**
   - Explicitly on hold until shop business rules and formulas are documented and verified.
10. **Metal + Cash Dual Settlement:**
   - Dual balances (metal grams + cash rupees) pending custom shop specification.
11. **Profit Calculation & FIFO/Weighted Average Verification:**
   - Verification against real shop ledger entries.

---

## 3. Strict Architecture & Design Directives

1. **No Unnecessary Scope:**
   - Do NOT add full double-entry Day Book or Trial Balance (Pawnify handles that; Bullion has its own trade model).
   - Do NOT create duplicate stock tables or competing counterparty masters.
2. **UI & Aesthetic Quality:**
   - Clean, professional dark/light palette with muted slate borders (`border-(--border-primary)`).
   - No tacky, heavy box-shadows.
   - Subtle hover states and micro-interactions.
   - High data density and legible font hierarchy with monospace numbers for weights and amounts.
3. **Financial Precision:**
   - Always use `Decimal` (`decimal.js`) for arithmetic; never JavaScript floating-point math.
   - Stock movements remain append-only and immutable.
