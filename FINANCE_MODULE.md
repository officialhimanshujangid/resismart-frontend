# ResiSmart — Society Finance & Accounting Module

### The complete guide: concepts, every screen, a full worked example, the accounting behind it, and the roadmap

---

## Table of contents

1. [What this module is](#1-what-this-module-is)
2. [Core ideas you must know](#2-core-ideas-you-must-know)
3. [The Chart of Accounts (the society's "books")](#3-the-chart-of-accounts)
4. [Roles — who can do what](#4-roles--who-can-do-what)
5. [Every admin screen, button by button](#5-every-admin-screen-button-by-button)
6. [The resident screen](#6-the-resident-screen-my-bills)
7. [Full worked example — "Sunrise Residency"](#7-full-worked-example--sunrise-residency)
8. [The accounting engine — every event → debit/credit](#8-the-accounting-engine)
9. [Formulas & rules](#9-formulas--rules)
10. [Settlement modes — how money reaches the society](#10-settlement-modes)
11. [Automation (what runs by itself)](#11-automation)
12. [Edge cases & how they're handled](#12-edge-cases)
13. [Reports reference](#13-reports-reference)
14. [Developer reference](#14-developer-reference)
15. [Future roadmap — what happens next](#15-future-roadmap)
16. [FAQ / troubleshooting](#16-faq--troubleshooting)

---

## 1. What this module is

A full **finance and accounting system** for a housing society — the kind a Chartered Accountant would recognise. It handles the entire money cycle:

> **Charge heads → Invoices → Collections/Receipts → Expenses → Statutory Reports**, all sitting on a **real double‑entry general ledger**.

Because everything is double‑entry, **every report always balances** and there is a complete, tamper‑evident audit trail. It is built for **Indian societies**: financial year starts in April, penal interest on arrears, GST on maintenance, TDS on vendor payments, corpus/sinking funds, and per‑society customisation of every rule.

**One golden rule:** money is stored in **paise** (₹1 = 100 paise) as whole numbers everywhere in the system. The screens display rupees; the database never stores fractions, so there are **no rounding errors, ever**.

---

## 2. Core ideas you must know

| Term | Plain meaning |
|---|---|
| **Charge Head** | A single billable item (Maintenance, Water, Sinking Fund…). You define its price rule once; it becomes a line on every invoice it applies to. |
| **Invoice** (`MaintenanceInvoice`) | **One bill per flat per month**, containing many charge‑head lines + arrears + interest + GST. This is what a resident owes. |
| **Receipt** | A record of money **received** from a flat. One receipt can pay **several** invoices at once (oldest first). |
| **Voucher / Journal Entry** | The accounting record behind every money event. Always **balanced** (total debits = total credits). **Immutable** — never edited, only reversed. |
| **Ledger Account** | A "bucket" in the books (Bank, Cash, Maintenance Income, Sinking Fund…). Every voucher line moves money between two or more buckets. |
| **Debtors (Members' Dues)** | The control account holding **what all members owe**. Its balance always equals the sum of every flat's outstanding. |
| **Members' Advance** | Money paid **in excess** of dues — a credit the flat can use next month. |
| **Fund** | A reserve (Corpus / Sinking / Repair). Money collected under a fund charge head flows straight into the fund, not into income. |
| **Arrears** | Last period's unpaid amount, **carried forward** onto the next invoice for visibility. |
| **Financial Year (FY)** | April–March by default. Invoice/receipt numbers reset every FY (e.g. `INV/2026-27/00001`). |

---

## 3. The Chart of Accounts

On first use, each society is seeded with a standard set of accounts (editable). Codes are stable so the engine can reference them.

| Code | Account | Type | Used for |
|---|---|---|---|
| 1100 | Bank – Current A/c | Asset | Online / bank / UPI money, cleared cheques |
| 1110 | Cash in Hand | Asset | Cash collected at the office |
| 1120 | Undeposited Cheques | Asset | Cheques received but not yet banked |
| 1200 | **Sundry Debtors – Members** | Asset (control) | What members owe (per‑flat) |
| 1300 | Fixed Deposits / Investments | Asset | Money moved to FDs |
| 1400 | TDS Receivable | Asset | TDS others deduct from the society |
| 2100 | **Members' Advance** | Liability (control) | Advances paid by members |
| 2200 | Sundry Creditors – Vendors | Liability (control) | What the society owes vendors |
| 2300 | GST Output Payable | Liability | GST collected, payable to govt |
| 2310 | TDS Payable | Liability | TDS withheld from vendors |
| 2400 | Security Deposits | Liability | Refundable deposits held |
| 3100 | Corpus Fund | Fund | One‑time corpus contributions |
| 3110 | Sinking Fund | Fund | Long‑term repair reserve |
| 3120 | Repair & Maintenance Fund | Fund | Major repairs reserve |
| 3900 | Accumulated Surplus / Opening Balance | Equity | Retained surplus, opening balances |
| 4100 | Maintenance Income | Income | Regular maintenance |
| 4110 | Water Charges | Income | Water |
| 4120 | Parking Charges | Income | Parking |
| 4130 | Non‑Occupancy Charges | Income | Extra charge on rented flats |
| 4140 | Interest on Arrears | Income | Penal interest |
| 4150 | Festival / Ad‑hoc Collection | Income | One‑off collections |
| 4200 | Interest Income (Bank/FD) | Income | Bank/FD interest |
| 4900 | Rounding Off | Income | Rounding differences |
| 5100–5180 | Security, Housekeeping, Electricity, Water, Repairs, Lift AMC, Audit, Admin, Bank charges | Expense | Society running costs |
| 5900 | Rebates & Waivers | Expense | Amounts waived off |

**Normal balance rule:** Assets & Expenses increase on the **debit** side; Liabilities, Income, Funds & Equity increase on the **credit** side.

---

## 4. Roles — who can do what

| Capability | Society Admin | Committee | Resident |
|---|:--:|:--:|:--:|
| Configure Settings / Settlement | ✅ | — | — |
| Create charge heads / generate invoices | ✅ | — | — |
| View invoices & reports | ✅ | ✅ | own only |
| Record walk‑in payments | ✅ | ✅ | — |
| Confirm/reject reported payments | ✅ | ✅ | — |
| Bounce/reverse a receipt | ✅ | — | — |
| Create/approve/pay expenses | ✅ | create/approve* | — |
| Pay own dues, download own docs | — | — | ✅ |

*Above the configured **approval threshold**, the approver must be a **different person** than the creator (maker‑checker).

---

## 5. Every admin screen, button by button

> Path: **Dashboard → Finance Management → …**

### 5.1 Invoices (`/dashboard/finance/invoices`)
The monthly billing hub.

- **Top cards** — Total Billed · Collected · Outstanding · Overdue (count + amount), for the selected period.
- **Filters** — month, status, search (flat / owner / invoice no.).
- **"Generate Invoices"** → dialog:
  1. Pick the **billing month**.
  2. **Preview** (dry‑run): shows *"will create N invoices, estimated ₹X"* and how many are skipped — **no data is written**.
  3. **Generate**: creates one invoice per applicable flat. Re‑running the same month is safe — existing flats are **skipped**, never duplicated.
- **Table row** → click to open the **line‑item breakdown** (each charge, GST, arrears, interest, total). **Download** → the invoice **PDF**.

**What happens behind the scenes on Generate:** for each flat the engine gathers applicable charge heads, prices each, adds arrears + interest + GST + rounding, auto‑applies any advance, and posts a **balanced INVOICE voucher** — `Dr Members' Dues / Cr each income & fund account (+ Cr GST)`.

### 5.2 Collections (`/dashboard/finance/collections`)
Money received + receipt management.

- **"Record Payment"** → choose **flat** (its live outstanding is shown), **mode** (Cash/Cheque/UPI/Bank/Other), **amount**, reference/cheque details. On save the amount is **applied oldest‑invoice‑first (FIFO)**; any surplus becomes **advance credit**.
- **Row actions** (depend on status):
  - **Confirm / Reject** — a resident's reported offline payment.
  - **Deposit** (cheque) — move a cleared cheque from *Undeposited* to *Bank*.
  - **Bounce / reverse** — undo a receipt; its invoices re‑open and the accounting is reversed (never deleted).
  - **Download** — receipt PDF.

### 5.3 Confirmations (`/dashboard/finance/confirmations`)
A focused queue of **resident‑reported offline payments** awaiting approval. **Confirm** applies + posts the money; **Reject** needs a reason and notifies the resident.

### 5.4 Expenses (`/dashboard/finance/expenses`)
Society spending with approvals.

- **"Vendors"** → add vendors, each with optional **TDS section & rate**.
- **"Add Expense"** → vendor (or *Direct*), one or more **expense‑account lines** with amounts, pay‑from account. TDS auto‑computes from the vendor.
- **Row actions**: **Approve** (books the liability; a second approver is forced above threshold) → **Pay** (books the cash/bank payment) → or **Reject**.

### 5.5 Reports (`/dashboard/finance/reports`)
Nine tabs, all derived live from the ledger — see [§13](#13-reports-reference). Period reports have From/To pickers. Balancing statements show a green **"✓ Balanced"** badge.

### 5.6 Charge Heads (`/dashboard/finance/charge-heads`)
Define what appears on invoices. Per head: **category**, **pricing mode** (Uniform / Per‑flat‑size / Per‑sq‑ft / Metered / Percentage / Fixed‑ad‑hoc), **applies‑to** (occupancy + block/flat exemptions), **bill‑to** (owner/occupant), and **GST** (rate + SAC). Edit/deactivate anytime — a head used on past invoices is **deactivated**, not deleted, to protect history.

### 5.7 Funds (`/dashboard/finance/funds`)
Corpus / Sinking / Repair reserves. Balances are **ledger‑backed** — money from fund charge heads accumulates here automatically. **"Reconcile"** re‑syncs the cards from the ledger (also runs nightly). **"Create Fund"** adds one (Corpus/Sinking/Repair auto‑reconcile; Special/General are manual).

### 5.8 Settlement (`/dashboard/finance/settlement`)
Pick **how residents' online payments reach your society**. The form then requires exactly that mode's fields — see [§10](#10-settlement-modes).

### 5.9 Settings (`/dashboard/finance/settings`)
The society's **finance policy**: financial‑year start, auto‑generate day, **late‑fee/interest** rules, **reminders**, **GST**, **rounding**, and **approval threshold**. This is where you tailor the whole module to your society's bye‑laws.

---

## 6. The resident screen (`/dashboard/finance/my-bills`, "My Bills")

A hero showing **Total Outstanding** and **Advance Credit**, plus three tabs:

- **Dues** — every unpaid invoice + **"Pay Now"**.
- **Payments** — all receipts, each with a **PDF** download.
- **Statement** — the flat's running account (every charge & payment with a balance) — like a bank passbook.

**Pay Now** → **Pay Online** (redirects to the gateway, only if the society enabled it) or **Report Offline** (UPI/Bank/Cash/Cheque + reference → lands in the committee's Confirmations queue). The resident can't over‑report beyond what's outstanding.

---

## 7. Full worked example — "Sunrise Residency"

> A registered co‑operative housing society. FY April–March. We'll set it up and run **two months** with real numbers, showing the accounting at each step. All amounts below are in **rupees** (the system stores paise).

### 7.1 The society

**Flats (6, across 2 blocks):**

| Flat | Size | Carpet area | Status | Owner |
|---|---|---|---|---|
| A‑101 | 2BHK | 900 sqft | Owner‑occupied | Rajesh |
| A‑102 | 2BHK | 900 sqft | **Rented** | Meena |
| A‑201 | 3BHK | 1200 sqft | Owner‑occupied | Sanjay |
| B‑101 | 1BHK | 600 sqft | **Vacant** | Priya |
| B‑102 | 2BHK | 900 sqft | Owner‑occupied | Amit |
| B‑201 | 3BHK | 1200 sqft | **Rented** | Neha |

### 7.2 Step 1 — Configure (Settings + Settlement)

- **Settings**: FY start = April; **Late fee** = 2% per month, 0 grace days; **Reminders** on (before due `3,1`; after due `3,7,15`); GST off (this society is below the GST threshold); Rounding = None; Expense approval threshold = ₹10,000.
- **Settlement**: **Our own Razorpay** — paste Key ID/Secret/Webhook Secret; copy the shown webhook URL into the Razorpay dashboard. (Money will land directly in Sunrise's own account.)

### 7.3 Step 2 — Opening balance

The society already has ₹50,000 in the bank. Admin posts an **opening voucher** (Reports/Ledger → manual entry, type *Opening*):

```
Dr  1100 Bank ................. 50,000
    Cr  3900 Accumulated Surplus ...... 50,000
```

### 7.4 Step 3 — Charge Heads

| Code | Name | Pricing | Applies to | Posts to |
|---|---|---|---|---|
| MAINT | Maintenance | Per flat size: 1BHK ₹1,500 · 2BHK ₹2,000 · 3BHK ₹2,500 | All | 4100 Income |
| SINK | Sinking Fund | Per sq.ft ₹1/sqft | All | **3110 Fund** |
| WATER | Water | Uniform ₹300 | All **except** B‑101 (vacant) | 4110 Income |
| PARK | Parking | Uniform ₹500 | All **except** B‑101 (vacant) | 4120 Income |
| NONOCC | Non‑Occupancy | 10% of Maintenance | **Rented only** | 4130 Income |

### 7.5 Step 4 — Generate July 2026 invoices

Preview → *"6 invoices, ₹22,650"* → Generate. Each flat's invoice:

| Flat | Maint | Sinking | Water | Parking | Non‑occ | **Total** |
|---|--:|--:|--:|--:|--:|--:|
| A‑101 (2BHK owner) | 2,000 | 900 | 300 | 500 | — | **3,700** |
| A‑102 (2BHK rented) | 2,000 | 900 | 300 | 500 | 200 | **3,900** |
| A‑201 (3BHK owner) | 2,500 | 1,200 | 300 | 500 | — | **4,500** |
| B‑101 (1BHK vacant) | 1,500 | 600 | — | — | — | **2,100** |
| B‑102 (2BHK owner) | 2,000 | 900 | 300 | 500 | — | **3,700** |
| B‑201 (3BHK rented) | 2,500 | 1,200 | 300 | 500 | 250 | **4,750** |
| **Totals** | 12,500 | 5,700 | 1,500 | 2,500 | 450 | **22,650** |

**The accounting posted (sum of all six INVOICE vouchers):**

```
Dr  1200 Sundry Debtors–Members ....... 22,650
    Cr  4100 Maintenance Income ............. 12,500
    Cr  4110 Water Charges ..................  1,500
    Cr  4120 Parking Charges ................  2,500
    Cr  4130 Non‑Occupancy Charges ..........    450
    Cr  3110 Sinking Fund ...................  5,700
```

Note how **Sinking Fund goes to the fund, not to income** — this is correct society accounting. Debtors now = ₹22,650 (what everyone owes).

### 7.6 Step 5 — Residents pay (July)

1. **Rajesh (A‑101)** → My Bills → Pay Online ₹3,700. Gateway webhook clears it instantly.
   `Dr 1100 Bank 3,700 / Cr 1200 Debtors 3,700` — A‑101 **PAID**.
2. **Meena (A‑102)** → Report Offline, UPI ₹3,900, ref 12345. Treasurer **Confirms**.
   `Dr 1100 Bank 3,900 / Cr 1200 Debtors 3,900` — **PAID**.
3. **Sanjay (A‑201)** pays **₹5,000 cash** at the office (₹500 extra). Admin → Record Payment. FIFO clears his ₹4,500 invoice; **₹500 becomes advance**.
   `Dr 1110 Cash 5,000 / Cr 1200 Debtors 4,500 + Cr 2100 Members' Advance 500` — **PAID**, advance ₹500.
4. **Amit (B‑102)** pays by **cheque ₹3,700**. Recorded → sits in Undeposited. Treasurer **Deposits** it.
   `Dr 1120 Undeposited 3,700 / Cr 1200 Debtors 3,700`, then `Dr 1100 Bank 3,700 / Cr 1120 Undeposited 3,700` — **PAID**.
5. **Priya (B‑101)** and **Neha (B‑201)** don't pay → they'll appear in the **Defaulter** report.

**After July collections:** Debtors outstanding = B‑101 ₹2,100 + B‑201 ₹4,750 = **₹6,850**. Advance = ₹500. Bank movement +₹11,300, Cash +₹5,000.

### 7.7 Step 6 — Society spends (July)

1. **Security** — vendor "SecureGuard" (TDS 2%). Add Expense ₹15,000 to *Security Charges*, pay from Bank. **Approve** (needs a 2nd approver, > ₹10k threshold) → accrual:
   `Dr 5100 Security 15,000 / Cr 2310 TDS Payable 300 + Cr 2200 Creditors 14,700`.
   **Pay** → `Dr 2200 Creditors 14,700 / Cr 1100 Bank 14,700`.
2. **Electricity** — direct (no vendor) ₹4,000 cash. Approve → Pay:
   `Dr 5120 Electricity 4,000 / Cr 1110 Cash 4,000`.

### 7.8 Step 7 — July month‑end reports (they all tie out)

**Income & Expenditure (July)**
| Income | ₹ | | Expenditure | ₹ |
|---|--:|---|---|--:|
| Maintenance | 12,500 | | Security | 15,000 |
| Water | 1,500 | | Electricity | 4,000 |
| Parking | 2,500 | | | |
| Non‑occupancy | 450 | | | |
| **Total income** | **16,950** | | **Total expenditure** | **19,000** |

→ **Deficit ₹2,050** (Sinking Fund ₹5,700 is *not* income — it's a fund.)

**Balance Sheet (as of 31 July)**
| Assets | ₹ | | Liabilities / Funds / Equity | ₹ |
|---|--:|---|---|--:|
| Bank (50,000+11,300−14,700) | 46,600 | | TDS Payable | 300 |
| Cash (5,000−4,000) | 1,000 | | Members' Advance | 500 |
| Members' Dues (Debtors) | 6,850 | | Sinking Fund | 5,700 |
| | | | Accumulated Surplus | 50,000 |
| | | | Current deficit | (2,050) |
| **Total** | **54,450** | | **Total** | **54,450** |

**✓ Balanced.** Assets 54,450 = Liabilities+Funds+Equity 54,450.

**Receipts & Payments (July, cash basis)** — Opening cash+bank ₹50,000; Receipts ₹16,300 (Debtors 15,800 + Advance 500); Payments ₹18,700 (Creditors 14,700 + Electricity 4,000); **Closing ₹47,600** (= Bank 46,600 + Cash 1,000). ✓

**Defaulters** — B‑101 ₹2,100, B‑201 ₹4,750 (total ₹6,850).
**Funds** — Sinking Fund ₹5,700.

### 7.9 Step 8 — August 2026 (arrears + interest + advance in action)

Generate August. What changes:

- **Sanjay (A‑201)** has ₹500 advance → it **auto‑applies** to his ₹4,500 August invoice → outstanding **₹4,000**.
  `Dr 2100 Members' Advance 500 / Cr 1200 Debtors 500`.
- **Priya (B‑101)** — August charges ₹2,100 **+ 2% interest on the ₹2,100 arrear = ₹42** → invoice total ₹2,142. The July ₹2,100 still shows as **"Arrears brought forward"** (informational; not double‑counted). Interest posts `Dr 1200 Debtors 42 / Cr 4140 Interest on Arrears 42`.
- **Neha (B‑201)** — ₹4,750 + 2% of 4,750 = **₹95** → ₹4,845, with ₹4,750 arrears shown.

By end of August the **Defaulter report** shows Priya owing ₹4,242 (₹2,100 + ₹2,142) and Neha ₹9,595 (₹4,750 + ₹4,845) — arrears compounding month over month, exactly as a society bye‑law intends.

### 7.10 Step 9 — A cheque bounces (any time)

Suppose Amit's ₹3,700 cheque later bounces. Admin → Collections → **Bounce**. The system:
- Posts a **reversal**: `Dr 1200 Debtors 3,700 / Cr 1100 Bank 3,700`.
- **Re‑opens** B‑102's invoice (back to unpaid).
- Marks the receipt **BOUNCED** (original entry preserved for audit).

Everything stays balanced and traceable — nothing is ever deleted.

---

## 8. The accounting engine

Every money event posts a **balanced voucher**. The complete map:

| Event | Debit | Credit |
|---|---|---|
| Invoice issued | Members' Dues (1200) | Income heads (4xxx) + Fund heads (31xx) + GST Output (2300) |
| Interest on arrears | Members' Dues | Interest on Arrears (4140) |
| Arrears brought forward | *(no entry — already in Debtors)* | — |
| Payment — cash | Cash (1110) | Members' Dues |
| Payment — cheque received | Undeposited Cheques (1120) | Members' Dues |
| Cheque deposited | Bank (1100) | Undeposited Cheques |
| Payment — online / bank / UPI | Bank (1100) | Members' Dues |
| Overpayment surplus | *(cash/bank)* | Members' Advance (2100) |
| Advance applied to invoice | Members' Advance | Members' Dues |
| Waiver / write‑off | Rebates & Waivers (5900) | Members' Dues |
| Vendor bill (with TDS) | Expense (5xxx) | TDS Payable (2310) + Sundry Creditors (2200) |
| Vendor paid | Sundry Creditors | Bank |
| Direct expense | Expense | Bank / Cash |
| Fund contribution (via invoice) | Members' Dues | Fund (31xx) |
| Opening balances | Assets | Liabilities/Funds + Accumulated Surplus |
| Cheque bounce / reversal | Members' Dues | Bank/Undeposited (reversal) |
| GST remitted to govt | GST Output Payable | Bank |
| TDS deposited | TDS Payable | Bank |

**Guarantees baked in:** every voucher has ≥2 lines, exactly one of debit/credit per line, and **Σdebit = Σcredit** — enforced in a database transaction. Posted vouchers are **immutable**; corrections are **reversing entries** only.

---

## 9. Formulas & rules

- **Per‑sq‑ft charge** = `rate × flat area` (carpet or built‑up, your choice).
- **Percentage charge** = `percent × (maintenance line or running base)` — e.g. non‑occupancy = 10% of maintenance.
- **Interest on arrears** (choose one in Settings):
  - *Flat* = fixed ₹ per overdue invoice.
  - *% per month* = `arrears × rate%`.
  - *% per annum* = `arrears × rate% ÷ 12` per month.
  - *Slab* = rate depends on how many days overdue.
  - Plus optional **grace days**, **cap per invoice**, **minimum charge**.
- **GST** (if enabled): `base × rate%`, split into CGST + SGST (intra‑state). Fund contributions are **not** taxed.
- **Rounding**: none / nearest rupee / round‑up — the difference posts to *Rounding Off*.
- **Advance auto‑apply**: at generation, any advance credit is applied to the new invoice (up to its value); the rest stays as advance.
- **Numbering**: `PREFIX/FY/00001`, e.g. `INV/2026-27/00042`, `RCPT/2026-27/00007` — **gapless** per FY per document type.

---

## 10. Settlement modes

Configured per society; the form asks only for what the chosen mode needs (Save stays disabled until complete).

| Mode | Money goes to | You must provide |
|---|---|---|
| **Offline only** | — (manual tracking) | *(nothing; optional society UPI id)* |
| **Our own Razorpay** | **Your society's** Razorpay account | Key ID + Key Secret + Webhook Secret (stored encrypted) + copy the shown webhook URL into Razorpay |
| **Platform collects & pays out** | Platform, then settled to you | Society payout bank (name, account no., IFSC, bank) |
| **Platform (Route split)** | Auto‑split to your linked account | Razorpay Route linked‑account id (`acc_…`) |

For **Own Razorpay**, residents' payments hit **your** account and the society's own webhook confirms them automatically. Secrets are encrypted with a **dedicated finance key** (separate from login secrets).

---

## 11. Automation (what runs by itself)

- **Invoice generation** — daily check; on each society's configured **generation day** it auto‑creates that month's invoices (if auto‑generate is on).
- **Reminders** — daily at 08:30; emails residents **before** and **after** the due date per your Settings schedule (deduplicated so no one is spammed).
- **Funds reconciliation** — nightly; keeps the fund cards in sync with the ledger.
- **Gateway webhooks** — clear online payments the moment they succeed (idempotent — a replayed webhook never double‑credits).

---

## 12. Edge cases

| Situation | What the system does |
|---|---|
| **Re‑generate the same month** | Skips flats already invoiced — no duplicates. |
| **Resident over‑reports offline** | Blocked — can't report more than outstanding (incl. amounts already awaiting confirmation). |
| **Overpayment** | Surplus becomes **advance**, auto‑applied next month. |
| **Partial payment** | Applied FIFO; invoices go **Partially Paid**. |
| **Cheque bounce** | Reversal entry + invoices re‑open; original preserved. |
| **Duplicate webhook** | Ignored via a unique event id. |
| **Charge head used on past bills** | Deactivated instead of deleted (history intact). |
| **High‑value expense** | Requires a **different** approver (maker‑checker). |
| **Editing a posted voucher** | Not allowed — only reversing entries (immutable ledger). |

---

## 13. Reports reference

| Report | What it shows | How to read it |
|---|---|---|
| **Trial Balance** | Every account's debit/credit balance | Debit total must equal credit total (proof the books are consistent). |
| **Income & Expenditure** | Income vs expenses for the period | Surplus (green) or Deficit (red). Fund contributions & GST are **excluded** from income. |
| **Balance Sheet** | Assets vs Liabilities + Funds + Equity, as‑of | Must balance; shows the society's net position. |
| **Receipts & Payments** | Actual cash/bank in and out (cash basis) | Opening + Receipts − Payments = Closing, head‑wise. |
| **Defaulters** | Flats with outstanding dues | Chase list, sorted by amount, with oldest‑due date. |
| **Collections register** | Every cleared receipt in the period | Reconcile with the bank statement. |
| **Fund statement** | Balance of each fund | Corpus/Sinking/Repair reserves. |
| **GST register** | GST collected on invoices | For GST filing (if enabled). |
| **TDS register** | TDS withheld from vendors | For TDS challan/filing (if enabled). |

Everything is computed **live from the ledger**, so reports can never drift from the underlying transactions.

---

## 14. Developer reference

**Page → API map** (base `/api/v1`):

| UI page | Endpoints |
|---|---|
| Invoices | `finance/society/invoices`, `.../invoices/generate`, `.../invoices/summary`, `.../invoices/:id`, `.../invoices/:id/pdf` |
| Collections | `finance/society/collections/{receipts,pending,flat/:id/outstanding,record}`, `.../receipts/:id/{confirm,reject,bounce,deposit,pdf}` |
| Confirmations | `finance/society/collections/pending`, `.../receipts/:id/{confirm,reject}` |
| Expenses | `finance/society/{expenses,expenses/summary,vendors}`, `.../expenses/:id/{approve,pay,reject}` |
| Reports | `finance/society/reports/{trial-balance,income-expenditure,balance-sheet,receipts-payments,defaulters,collection-register,fund-statement,gst-register,tds-register}` |
| Charge Heads | `finance/society/charge-heads` (GET/POST/PUT/DELETE) |
| Funds | `finance/society/funds`, `.../funds/reconcile` |
| Settlement | `finance/society/settlement` (GET/PUT); webhook `webhooks/razorpay/society/:societyId` |
| Settings | `finance/society/policy` (GET/PUT); ledger: `.../ledger/{accounts,accounts/seed,journal,trial-balance}` |
| My Bills (resident) | `finance/resident/{invoices,outstanding,receipts,statement,pay-online,report-offline}`, `.../{invoices,receipts}/:id/pdf` |

**Backend building blocks:**
- `models/`: `ledger-account`, `journal-entry` (+ embedded lines), `sequence-counter`, `finance-policy`, `charge-head`, `maintenance-invoice`, `meter-reading`, `receipt`, `vendor`, `expense`, `finance-fund`.
- `services/`: `ledger.service` (post/reverse balanced vouchers, trial balance), `chart-of-accounts.seed`, `invoicing.service`, `collections.service`, `expenses.service`, `reports.service`, `funds.service`, `payment-gateway-resolver.service`, `finance-webhook.service`, `finance-policy.service`, `finance-sequence.service`, `society-invoice.service` / `receipt.service` (PDFs).
- `utils/`: `financial-year.util`, `finance-crypto.util` (encrypt gateway secrets), `finance-audit.util`.

**The one source of truth:** every money movement writes an immutable `JournalEntry` whose lines update cached `LedgerAccount` balances. All reports read those balances — nothing is computed twice, nothing can disagree.

**Data migration:** legacy `SocietyBill` rows can be folded into the new invoices with `backend/src/scripts/backfill-invoices.ts` (operator‑run, idempotent, does not touch the ledger).

---

## 15. Future roadmap — what happens next

Planned enhancements (the architecture is already structured for them):

1. **Full Razorpay Route split‑settlement** — today "Platform (Route)" behaves like platform‑collect; next it will auto‑split each payment to the society's linked account in real time.
2. **Bank‑detail key migration** — re‑encrypt existing bank data onto the dedicated finance key (new secrets already use it).
3. **SMS & WhatsApp reminders** — the reminder engine already supports multiple channels; only email is wired today.
4. **Per‑flat ledger PDF / account statement export** — downloadable passbook for each resident.
5. **GST & TDS filing exports** — one‑click GSTR/TDS‑return‑ready files from the registers.
6. **Budgets & variance** — set an annual budget per head and track actual vs budget.
7. **Bulk meter‑reading upload** — CSV import for metered utilities.
8. **Auto bank reconciliation** — match bank‑statement lines to receipts/payments.
9. **Society mobile app** — pay dues, view statement, get reminders on the phone.
10. **Multi‑society consolidation** — for management companies handling many societies.

None of these block day‑to‑day use — the module is fully operational end‑to‑end today.

---

## 16. FAQ / troubleshooting

- **"Online payment isn't enabled"** on My Bills → the society's Settlement mode is *Offline only* (or Own‑Razorpay keys aren't saved). Set it in **Settlement**.
- **A resident's payment isn't reflecting** → if reported offline, it's waiting in **Confirmations**; confirm it. If paid online, the gateway webhook must be configured (Settlement shows the URL).
- **Report doesn't balance** → almost always a missing/one‑sided **opening balance**; post it as an *Opening* voucher.
- **Fund card shows ₹0** → click **Reconcile** (or wait for the nightly job); ensure a **fund charge head** feeds it.
- **Interest not charged** → enable Late fee in **Settings** and check grace days.
- **Wrong invoice amount** → check the **Charge Head** pricing mode, applicability, and (for per‑sq‑ft) that the flat's area is set.

---

*This module turns a society's finances into a proper set of books — bank‑grade accuracy, statutory reports, and full configurability — while staying simple enough for a treasurer to run from a browser.*
