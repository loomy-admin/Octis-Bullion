# Bullion Trading System — The 16 Core Business Rules
## Business Logic Specification & Operations Guide

**Audience:** Shop Owners, Bullion Traders, Accountants, and Operations Managers.  
**System Purpose:** End-to-end Bullion Trading and Vault Management platform covering physical metal movements, live rate pricing, multi-tranche payments, denomination packaging, and party ledger settlements.

---

## 1. Master Rulebook Summary

| # | Business Rule | Category | Where in Application | Business Purpose |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Tri-Partite Isolation Principle** | Core Architecture | Purchases, Sales, Payments | Physical metal delivery, rate locking, and money movement are kept strictly separate. |
| **2** | **Fixed vs. Unfixed Rate Deals** | Trading Logic | Purchases, Sales | Allows booking metal immediately with fixed pricing or locking final price later. |
| **3** | **International Landed Cost Benchmark** | Rate Engine | Rates Desk | Converts live world market USD/oz price to domestic landed cost per gram in INR. |
| **4** | **Bifurcated Margin Engine (₹ Fixed vs %)** | Rate Engine | Rates Desk | Calculates retail buying and selling quotes using fixed rupees or percentage margins. |
| **5** | **Rate Booking / Rate Block Commitment** | Price Protection | Rate Booking Desk | Locks a promised rate for a customer for a defined time window without rate spike risk. |
| **6** | **Physical Metal Denominations & Premiums** | Master Catalogue | Coins & Bars Catalogue | Catalogues standard minted coins and cast bars with exact making/minting premiums. |
| **7** | **Budget-to-Weight Calculator & Vault Taker** | Sales Calculator | Physical Breakdown Tool | Converts customer rupee budget into target grams and allocates optimal vault units. |
| **8** | **Live Denomination Retail Rate Matrix** | Pricing Board | Live Rate Board | Live retail pricing board showing exact unit price and effective rate per gram. |
| **9** | **Independent Multi-Tranche Payment Ledger** | Accounting | Payments Desk | Tracks money paid and received independently with full support for partial payments. |
| **10** | **Physical Cash Note Denomination Sheet** | Cash Security | Record Payment Dialog | Requires cashier to verify note counts (₹500, ₹200, etc.) matching total payment. |
| **11** | **Cash Counter Closing & Reconciliation** | Daily Operations | Counter Closing Desk | Compares theoretical drawer cash with cashier's physical count (Balanced/Excess/Short). |
| **12** | **Metal + Cash Dual Settlement Ledger** | Dual Khata | Dual Settlements Desk | Simultaneously settles open metal commitments and cash balances in a single entry. |
| **13** | **Real-Time Party Outstanding Reconciliation** | Credit Control | Counterparties Directory | Tracks live supplier payables, customer receivables, and net outstanding balances. |
| **14** | **Append-Only Stock & Anti-Negative Guard** | Inventory Audit | Stock Vault, Adjustments | Vault balance is derived from verified physical movements; prevents negative stock. |
| **15** | **Strict Anti-Deletion & Reversal Audit** | Compliance & Audit | All Transaction Modules | Posted records can never be deleted; cancellations require reason and reversal audit. |
| **16** | **Rate Cut / Uncut Deferred Isolation** | Trade Clearing | Policy On Hold | Kept on hold until written shop trading formulas are formally confirmed. |

---

## 2. Detailed Breakdown of the 16 Business Rules

### Rule 1: The Tri-Partite Isolation Principle (Metal vs Pricing vs Cash)
* **The Rule:** Physical bullion handover, price fixing, and monetary payments are three completely independent events.
* **Plain English Explanation:**
  * Booking a sale or purchase does **not** assume money was received or paid.
  * Selecting a payment mode (such as "Cash" or "RTGS") on an invoice is descriptive only.
  * Real money movement requires an actual posted payment entry in the payment ledger.
* **Where to See in Application:**
  * Open **Sales**. Create a sale. The physical stock reduces immediately upon metal delivery, but the customer's balance remains unpaid until a receipt is recorded under **Payments**.

---

### Rule 2: Fixed vs. Unfixed Rate Deal Lifecycle
* **The Rule:**
  * **FIXED RATE:** Buyer and seller agree on the per-gram rate when the deal is booked. Once booked, future market price fluctuations will never alter this transaction.
  * **UNFIXED RATE:** Metal moves immediately (physical handover happens), but the final financial price is agreed upon later. At fixing time, the shop locks the agreed rate, timestamp, and final value without altering posted historical records.
* **Calculation:**
  ```text
  If Deal is FIXED:
  Total Invoice Value = Agreed Rate per Gram * Deal Weight in Grams

  If Deal is UNFIXED:
  Total Invoice Value = 0 (Marked as "Pending Valuation" until Rate is Fixed)
  ```
* **Where to See in Application:**
  * Open **Sales** or **Purchases**. Click **"New Sale"** or **"New Purchase"** and choose *Rate Status* = **`UNFIXED`**.
  * The invoice shows an amber `UNFIXED` badge.
  * Click the **"Fix Rate"** button on the row to enter the agreed per-gram rate and lock the final invoice total.

---

### Rule 3: International Landed Cost Benchmark Formula
* **The Rule:** Converts international spot market gold and silver prices (USD per Troy Ounce) into domestic landed cost per gram in Indian Rupees (INR) including statutory customs duty (15%) and GST (3%).
* **Step-by-Step Formula:**
  ```text
  Step 1: Convert USD Ounce Price to INR
  Base Price in INR = (USD Price per Ounce) * (USD to INR Exchange Rate)

  Step 2: Add Customs Duty (15%) and GST (3%)
  Total Landed Cost per Ounce = Base Price in INR * 1.15 * 1.03

  Step 3: Divide by 31.10 grams (1 Troy Ounce = 31.10 grams)
  Landed Cost per Gram = Total Landed Cost per Ounce / 31.10
  ```
* **Real Numbers Example:**
  ```text
  Inputs:
  - Gold Ounce Price: $4,306
  - USD to INR Rate: 95.85

  Calculation:
  1) 4,306 * 95.85 = 4,12,730.10 INR (Base Ounce Price)
  2) 4,12,730.10 * 1.15 * 1.03 = 4,87,021.52 INR (With Duty & GST)
  3) 4,87,021.52 / 31.10 = ₹15,659.84 per gram

  Result: Landed Cost = ₹15,659.84 / gram
  ```
* **Where to See in Application:**
  * Open **Rates Desk**. The **International Benchmark Landed Cost Desk** provides interactive inputs for USD/oz, exchange rate, duty, and GST, showing the calculated per-gram cost in real-time.

---

### Rule 4: Bifurcated Margin Engine (Fixed ₹ vs Percentage %)
* **The Rule:** Shop quotes given to customers or suppliers are calculated from the market reference rate using either a fixed rupee amount or a percentage margin.
* **Step-by-Step Formula:**
  ```text
  Option A: Fixed Rupee Margin (₹)
  Final Quote = Reference Rate + Fixed Rupee Amount per Gram
  Example: ₹30,000 + ₹500 = ₹30,500 / gram

  Option B: Percentage Margin (%)
  Final Quote = Reference Rate + (Reference Rate * Margin Percentage / 100)
  Example: ₹30,000 + (30,000 * 2 / 100) = ₹30,600 / gram
  ```
* **Where to See in Application:**
  * Open **Rates Desk**. Click **"Update Market Rate"** to toggle between `FIXED (₹)` and `PERCENTAGE (%)` margin modes to see buying and selling quotes recalculate instantly.

---

### Rule 5: Rate Booking / Rate Block Commitment & Expiry
* **The Rule:** A customer can book/block a specific rate for an agreed metal weight for a defined time window (e.g., 2 hours).
* **State Lifecycle:**
  ```text
  ACTIVE ---> FULFILLED (Converted into a Sale)
         ---> CANCELLED (Customer cancels)
         ---> EXPIRED (Time window expires without purchase)
  ```
  * A rate block protects the customer against rate spikes during payment or collection.
  * A rate block does **not** create a completed sale or payment until fulfilled.
* **Where to See in Application:**
  * Open **Rate Booking**. Click **"Book Rate"** to enter customer, metal, weight, agreed rate, and expiry duration. Click **"Fulfill"** on an active block to turn it directly into a pre-filled sale invoice.

---

### Rule 6: Physical Metal Denominations & Fabrication Premiums
* **The Rule:** Bullion is catalogued by **Metal -> Purity -> Form (Bar or Coin) -> Weight** with explicit making/minting premiums per unit.
* **Standard Denominations:**
  * Coins: 1g, 2g, 5g, 8g Guinea, 10g, 20g
  * Bars: 50g, 100g, 1kg (1000g)
* **Where to See in Application:**
  * Open **Coins & Bars**. Select the **"Coins & Bars Catalogue"** tab to view standard minted coins and cast bars with weights and fabrication premiums.

---

### Rule 7: Budget-to-Weight Calculator & Optimal Vault Taker
* **The Rule:** Customers can purchase bullion by **Target Weight in grams** or by a **Rupee Budget Amount**.
* **Step-by-Step Formula:**
  ```text
  Step 1: Calculate Target Weight from Budget
  Target Weight in Grams = Customer Budget in Rupees / Current Rate per Gram

  Step 2: Allocate Physical Units from Vault
  The vault optimizer allocates the largest available coins and bars.

  Step 3: Calculate Total Bill
  Pure Metal Value = Allocated Weight in Grams * Rate per Gram
  Making Premium Total = Sum of Making Premiums for all allocated pieces
  Grand Total Bill = Pure Metal Value + Making Premium Total

  Step 4: Calculate Change to Return to Customer
  Customer Change / Refund = Customer Budget - Grand Total Bill
  ```
* **Real Numbers Example:**
  ```text
  Customer Budget: ₹5,00,000
  Current Rate: ₹7,500 / gram

  1) Target Weight = 5,00,000 / 7,500 = 66.6667 grams
  2) Vault Allocates:
     - 1x 50g Cast Bar
     - 1x 10g Minted Coin
     - 1x 5g Minted Coin
     - 1x 1g Minted Coin
     Total Allocated Weight = 66.000 grams

  3) Financial Breakdown:
     - Metal Value = 66 * 7,500 = ₹4,95,000.00
     - Making Premiums = ₹1,800.00
     - Grand Total Bill = ₹4,96,800.00

  4) Refund to Customer = 5,00,000 - 4,96,800 = ₹3,200.00 cash change returned
  ```
* **Where to See in Application:**
  * Open **Coins & Bars** -> Click **"Breakdown & Budget Taker"** tab -> Toggle **"By Budget (₹ Amount)"** -> Enter ₹5,00,000 -> View allocated units and refund banner.

---

### Rule 8: Live Denomination Retail Rate Matrix Board
* **The Rule:** Converts live market metal rates into ready-to-sell retail shelf prices for each physical coin and bar.
* **Step-by-Step Formula:**
  ```text
  Base Metal Value = Piece Weight in Grams * Current Rate per Gram
  Final Retail Customer Price = Base Metal Value + Making/Minting Premium
  Effective Rate per Gram = Final Retail Customer Price / Piece Weight
  ```
* **Real Numbers Example (At ₹15,000 / gram):**
  ```text
  Denomination | Piece Weight | Base Metal Value | Minting Premium | Final Retail Price
  1g Coin      | 1.000g       | ₹15,000          | ₹150            | ₹15,150
  5g Coin      | 5.000g       | ₹75,000          | ₹350            | ₹75,350
  10g Coin     | 10.000g      | ₹1,50,000        | ₹500            | ₹1,50,500
  50g Bar      | 50.000g      | ₹7,50,000        | ₹1,200          | ₹7,51,200
  100g Bar     | 100.000g     | ₹15,00,000       | ₹1,800          | ₹15,01,800
  1kg Bar      | 1000.000g    | ₹1,50,00,000     | ₹5,000          | ₹1,50,05,000
  ```
* **Where to See in Application:**
  * Open **Coins & Bars** -> Click **"Live Denomination Rate Board"** tab to view retail pricing cards and the complete price matrix.

---

### Rule 9: Independent Multi-Tranche Payment Ledger
* **The Rule:** Payments and receipts exist in an independent ledger supporting partial payments, advances, and multiple installments.
* **Step-by-Step Formula:**
  ```text
  Remaining Balance = Invoice Amount - (Payment 1 + Payment 2 + Payment 3 + ...)
  ```
* **Real Numbers Example:**
  ```text
  Purchase Invoice: ₹10,00,000

  Payment 1: ₹3,00,000 paid  ---> Remaining Balance = ₹7,00,000
  Payment 2: ₹2,00,000 paid  ---> Remaining Balance = ₹5,00,000
  Payment 3: ₹5,00,000 paid  ---> Remaining Balance = ₹0 (Fully Settled)
  ```
* **Where to See in Application:**
  * Open **Payments**. Click **"Record Payment"** to post payments made to suppliers or receipts received from customers, optionally linked to an invoice.

---

### Rule 10: Physical Cash Note Denomination Verification
* **The Rule:** When physical cash is received or paid, the cashier must enter currency note counts. The note sheet must match the payment amount before posting.
* **Step-by-Step Formula:**
  ```text
  Total Cash Amount = 
      (Number of ₹500 notes * 500)
    + (Number of ₹200 notes * 200)
    + (Number of ₹100 notes * 100)
    + (Number of ₹50 notes * 50)
    + (Number of ₹20 notes * 20)
    + (Number of ₹10 notes * 10)
    + (Coins Total)

  Validation Check: Total Cash Amount MUST EQUAL Payment Amount
  ```
* **Real Numbers Example:**
  ```text
  Payment Amount: ₹50,000
  Cashier Enters:
  - 100 notes of ₹500 (100 * 500 = ₹50,000)
  Result: Matches! Payment is allowed to post.
  ```
* **Where to See in Application:**
  * Open **Payments** -> Click **"Record Payment"** -> Choose `Payment Mode = CASH` -> Note sheet appears automatically.

---

### Rule 11: Cashier Counter Closing & Variance Reconciliation
* **The Rule:** Reconciles physical counter cash against theoretical register inflow and outflow at daily closing.
* **Step-by-Step Formula:**
  ```text
  Step 1: Calculate Expected Cash in Drawer
  Expected Cash = Opening Cash + Cash Received (Inflow) - Cash Paid (Outflow)

  Step 2: Calculate Cash Variance
  Cash Variance = Physical Cash Counted - Expected Cash

  Step 3: Determine Outcome
  - If Variance = 0  ---> BALANCED (Cash drawer matches perfectly)
  - If Variance > 0  ---> EXCESS   (Extra cash in drawer)
  - If Variance < 0  ---> SHORTAGE (Missing cash in drawer)
  ```
* **Where to See in Application:**
  * Open **Drawer Closing**. View expected drawer cash, enter physical note counts, and submit daily closing.

---

### Rule 12: Metal + Cash Dual Settlement Ledger (Dual Balance Khata)
* **The Rule:** Bullion parties hold concurrent open balances in both physical metal and money. Settlements can settle both at the same time.
* **Step-by-Step Formula:**
  ```text
  Remaining Metal Balance = Pre-Settlement Metal - Settled Metal
  Remaining Cash Balance  = Pre-Settlement Cash  - Settled Cash
  ```
* **Real Numbers Example:**
  ```text
  Before Settlement:
  - Customer Metal Balance = 100.000g Gold
  - Customer Cash Balance  = ₹50,000

  Settlement Recorded:
  - Metal Settled = 80.000g Gold (Delivered to Customer)
  - Cash Settled  = ₹30,000 Cash (Received from Customer)

  After Settlement (Remaining Balances):
  - Remaining Metal = 100g - 80g = 20.000g Gold
  - Remaining Cash  = ₹50,000 - ₹30,000 = ₹20,000 Cash
  ```
* **Where to See in Application:**
  * Open **Dual Settlement**. Click **"Record Dual Settlement"** -> Select customer -> Enter 80g metal and ₹30,000 cash -> View live projected remaining balances card.

---

### Rule 13: Real-Time Party Outstanding Reconciliation
* **The Rule:** Computes live counterparty balances from purchases, sales, and payments.
* **Step-by-Step Formula:**
  ```text
  Supplier Payable Outstanding   = Total Purchases Value - Total Payments Made
  Customer Receivable Outstanding = Total Sales Value - Total Receipts Received
  Net Outstanding                = Customer Receivable - Supplier Payable
  ```
* **Where to See in Application:**
  * Open **Counterparties**. View sales, purchases, and net outstanding per party with direct buttons to view ledger (**Payments**) or settle (**Dual Settlement**).

---

### Rule 14: Append-Only Stock & Anti-Negative Guard
* **The Rule:** Vault stock is calculated strictly from append-only movement logs. Stock can never go below zero.
* **Step-by-Step Formula:**
  ```text
  Physical Stock = Opening Stock + Purchases - Sales + Increase Adjustments - Decrease Adjustments

  Validation Guard:
  Physical Stock MUST ALWAYS BE >= 0 (Transactions causing negative stock are blocked)
  ```
* **Where to See in Application:**
  * Open **Stock** to view current vault holdings by metal and purity. Open **Adjustments** to audit manual stock adjustments.

---

### Rule 15: Strict Anti-Deletion & Reasoned Atomic Reversal
* **The Rule:** Posted business records (Purchases, Sales, Payments, Settlements) **can never be deleted**.
* **Reversal Guard:**
  * Cancelling a transaction creates a linked reversing entry.
  * Every reversal requires an explanation reason saved to the audit trail.
* **Where to See in Application:**
  * On **Sales**, **Purchases**, **Payments**, or **Dual Settlement**, clicking **"Cancel / Reverse"** opens a dialog requiring a mandatory reason before reversing the effect.

---

### Rule 16: Rate Cut / Uncut Deferred Isolation
* **The Rule:** Rate Cut and Rate Uncut remain deferred until written shop formulas are provided. No assumptions or dummy double-entry logic may be deployed.
* **Status:** **Controlled Policy Hold**.

---

## 3. Operational Navigation Cheatsheet

### Quick Application Menu Guide

| Functional Area | Menu Name | What You Can Do |
| :--- | :--- | :--- |
| **Dual Settlements** | **Dual Settlement** | Settle physical metal and cash balances simultaneously for clients and suppliers. |
| **Denomination Taker** | **Coins & Bars** | Use the Budget-to-Weight calculator and view the live retail rate board. |
| **Rates & Landed Cost** | **Rates Desk** | Set live market reference rates and calculate landed per-gram cost in INR. |
| **Payment Ledger** | **Payments** | Record customer receipts and supplier payments with physical note counting sheets. |
| **Counter Closing** | **Drawer Closing** | Perform cashier end-of-day cash drawer balancing and identify shortages or excess. |
| **Rate Booking** | **Rate Booking** | Reserve and lock guaranteed per-gram rates for customers with countdown timers. |
| **Sales & Purchases** | **Sales** / **Purchases** | Book fixed or unfixed rate metal deals; lock rates later using the Fix Rate dialog. |
| **Stock Vault** | **Stock** | View physical bullion on-hand inventory separated by metal and purity fineness. |
| **Party Directory** | **Counterparties** | View customer receivables, supplier payables, and initiate one-click settlements. |
