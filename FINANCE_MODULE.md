# ResiSmart — Society Finance & Accounting Module

### The complete guide: concepts, every screen, a full worked example, the accounting behind it, and the honest list of what it does not do

> **Doc status.** Everything below was verified against the code on **17 July 2026**. Where the code and this document disagree, the code is right and this document is a bug — please fix it. Section 17 lists the known gaps deliberately, because a document that only describes what works is a sales brochure, not a manual.

---

## Table of contents

1. [What this module is](#1-what-this-module-is)
2. [Core ideas you must know](#2-core-ideas-you-must-know)
3. [Turning features on and off (module toggles)](#3-turning-features-on-and-off)
4. [The Chart of Accounts](#4-the-chart-of-accounts)
5. [Roles — who can do what](#5-roles--who-can-do-what)
6. [Every screen](#6-every-screen)
7. [Full worked example — "Sunrise Residency"](#7-full-worked-example--sunrise-residency)
8. [The accounting engine — every event → debit/credit](#8-the-accounting-engine)
9. [Formulas & rules](#9-formulas--rules)
10. [Indian statutory handling (GST, TDS, mutuality, bye-laws)](#10-indian-statutory-handling)
11. [Settlement — how money reaches the society](#11-settlement)
12. [Automation](#12-automation)
13. [Edge cases & how they are handled](#13-edge-cases)
14. [Reports reference](#14-reports-reference)
15. [Configuration reference](#15-configuration-reference)
16. [Developer reference](#16-developer-reference)
17. [Known gaps & deliberate non-features](#17-known-gaps)
18. [FAQ / troubleshooting](#18-faq--troubleshooting)

---

## 1. What this module is

A full **finance and accounting system** for an Indian housing society — the kind a Chartered Accountant would recognise. It covers the whole money cycle:

> **Charge heads → Invoices → Collections → Expenses → Statutory reports**, all sitting on a **real double-entry general ledger**.

Because everything is double-entry, the statements tie out and there is a complete, tamper-evident audit trail. It is built for Indian societies specifically: April financial year, penal interest on arrears, the GST ₹7,500 RWA exemption, TDS thresholds, corpus/sinking funds, share capital, and per-society customisation of nearly every rule.

**Three golden rules, and they explain most of the design:**

1. **Money is integer paise.** ₹1 = 100 paise, stored as a whole number, everywhere. Screens show rupees; the database never stores a fraction. There is no float arithmetic on money anywhere in the engine.
2. **The ledger is immutable.** Nothing is ever edited or deleted. A mistake is corrected by *reversing* it — an equal-and-opposite entry — leaving both the error and its correction visible. This is what an auditor expects.
3. **Reports are computed from the journal, not from a cache.** Every account carries a cached balance for fast screens, but no statutory report trusts it. This is why a Trial Balance can be run for any date and why a Balance Sheet can never quietly drift.

---

## 2. Core ideas you must know

| Idea | What it means here |
|---|---|
| **Charge head** | A thing you bill for — "Maintenance", "Water", "Parking". Defines the amount, how it is calculated, who it applies to, and which income account it credits. |
| **Invoice** | One bill, for one flat, for one period. Its line items are frozen at issue: changing a charge head later never rewrites a bill already sent. |
| **Receipt** | Money actually received. A receipt is matched against open invoices (oldest first); anything left over becomes **advance**. |
| **Advance** | Money a member has paid ahead. A liability — the society owes them the service. It is applied automatically to the next invoice. |
| **Arrears** | Unpaid dues carried forward. Shown on the next bill for information, but **not re-charged** — the debt already sits in Sundry Debtors. |
| **Voucher / Journal entry** | One accounting event as equal debits and credits. Numbered gaplessly per financial year (`INV/2026-27/00001`). |
| **Fund** | A reserve the society holds for a purpose — corpus, sinking, repairs. Each fund owns a real ledger account; its balance is derived from the ledger, never typed. |
| **Control account** | An account whose detail lives elsewhere. `1200 Sundry Debtors` totals what all members owe; the per-member detail is the invoices. **The two must always agree.** |
| **Financial year** | April–March by default, configurable per society. Every FY starts on the **1st** of the chosen month. |

### Debits and credits, in one table

You never have to type these — the engine does it — but reading a report is easier if you know:

| Account type | Increases with | Example |
|---|---|---|
| ASSET | Debit | Bank, Cash, Sundry Debtors |
| EXPENSE | Debit | Security, Electricity |
| LIABILITY | Credit | Members' Advance, GST Payable |
| INCOME | Credit | Maintenance Income |
| EQUITY / FUND | Credit | Share Capital, Corpus Fund |

**One exception, and it matters:** `1590 Accumulated Depreciation` is an **ASSET that carries a credit balance** (a "contra-asset"). It is subtracted from fixed assets rather than added. Reports handle this centrally; if you write new reporting code, use the shared `sectionAmount()` helper rather than summing by each account's own normal balance. Getting this wrong throws the Balance Sheet out by exactly twice the depreciation — and it has happened here before.

---

## 3. Turning features on and off

**A small society does not have to carry a big society's machinery.**

Nine screens are always on, because you cannot run a society without them:

> Overview · Invoices · Collections · Confirmations · Charge Heads · Reports · Settlement · Settings · My Bills *(the resident's own page)*

Everything else is a **module** you switch on in **Settings → Modules**. Switching one off hides its screens and its setup nags; switching it back on later returns everything untouched — **no data is ever deleted by a toggle.**

| Module | Label in Settings | Gates | On by default? |
|---|---|---|---|
| `EXPENSES` | Expenses & vendors | Expenses | **Yes** |
| `FUNDS` | Funds & reserves | Funds | **Yes** |
| `REFUNDS` | Refunds | Refunds | No |
| `SHARES` | Members & shares | Members & Shares | No |
| `ASSETS` | Fixed assets & depreciation | Fixed Assets | No |
| `INVESTMENTS` | Fixed deposits | Fixed Deposits | No |
| `BUDGET` | Budgeting | Budget | No |
| `BANKING` | Bank reconciliation | Bank Reconciliation | No |
| `PDC` | Post-dated cheques | Post-dated Cheques | No |
| `NOTICES` | Defaulter notices & recovery | Defaulter Notices | No |
| `ACCOUNTING` | Full accounting tools | Chart of Accounts · Vouchers & Journal · Opening Balances | No |
| `IMPORT` | Bulk import | Bulk Import | No |

**A 12-flat society can genuinely run on Invoices + Collections + Reports and nothing else.**

**On upgrade, nothing disappears.** A society that already uses funds or assets keeps them: the first time the module list is asked for, it is **inferred once** from what that society actually has (shares issued? assets? FDs? manual vouchers?), written down, and honoured from then on. "Never chosen" and "chose none" are stored differently on purpose — treating them the same would have hidden working screens from existing societies.

---

## 4. The Chart of Accounts

Seeded automatically on first setup. Idempotent — re-running it never duplicates or overwrites. Societies can add their own accounts (a second bank account, a new expense head); seeded accounts are marked `isSystem` and cannot be deleted, because the engine posts to them by code.

### Assets

| Code | Name | Notes |
|---|---|---|
| 1000 | Cash & Bank Balances | Heading |
| 1100 | Bank – Current A/c | |
| 1105 | Bank – Savings A/c | |
| 1110 | Cash in Hand | |
| 1120 | Undeposited Cheques | Cheques received, not yet banked |
| 1200 | **Sundry Debtors – Members** | Control account, per flat |
| 1300 | Fixed Deposits / Investments | |
| 1400 | TDS Receivable | |
| 1450 | Prepaid Expenses | |
| 1500 | **Fixed Assets** | Heading |
| 1505 | Building & Structure | |
| 1510 | Lift & Elevators | |
| 1520 | Plant & Machinery (pumps, DG, STP) | |
| 1530 | Furniture & Fixtures | |
| 1540 | Computers & Equipment | |
| 1590 | **Accumulated Depreciation** | **Contra-asset — credit balance** |

### Liabilities

| Code | Name | Notes |
|---|---|---|
| 2100 | **Members' Advance** | Control account, per flat |
| 2200 | **Sundry Creditors – Vendors** | Control account, per vendor |
| 2300 | GST Output Payable | |
| 2310 | TDS Payable | |
| 2400 | Security Deposits | |
| 2500 | Outstanding Liabilities (accrued) | |
| 2600 | Income Tax Payable | |
| 2900 | Suspense – Unidentified Receipts | Money in, owner unknown |

### Equity & Funds

| Code | Name | Type |
|---|---|---|
| 3000 | Share Capital | EQUITY |
| 3100 | Corpus Fund | FUND |
| 3110 | Sinking Fund | FUND |
| 3120 | Repair & Maintenance Fund | FUND |
| 3900 | Accumulated Surplus / Opening Balance Equity | EQUITY |

New funds mint their own FUND account automatically, numbered from 3130 up.

### Income — note the tax column

| Code | Name | Taxability |
|---|---|---|
| 4100 | Maintenance Income | MUTUAL |
| 4110 | Water Charges | MUTUAL |
| 4120 | Parking Charges | MUTUAL |
| 4130 | Non-Occupancy Charges | MUTUAL |
| 4140 | Interest on Arrears | MUTUAL |
| 4150 | Festival / Ad-hoc Collection | MUTUAL |
| 4160 | Transfer & NOC Fees | MUTUAL |
| 4200 | Interest Income (Bank/FD) | **TAXABLE** |
| 4210 | Rent from Mobile Towers / Hoardings | **TAXABLE** |
| 4220 | Profit on Sale of Assets | **TAXABLE** |
| 4900 | Rounding Off | MUTUAL |

**Why this column exists:** under the **principle of mutuality**, what members contribute to their own society is not taxable income; what the society earns from outsiders (bank interest, tower rent) is. The Income & Expenditure report splits the two so the society can compute its taxable income for ITR-5. Without the split, nobody can.

### Expenses

| Code | Name |
|---|---|
| 5100 | Security / Guard Charges |
| 5110 | Housekeeping |
| 5120 | Electricity |
| 5130 | Water Expense |
| 5140 | Repairs & Maintenance |
| 5150 | Lift AMC |
| 5160 | Audit / Professional Fees |
| 5170 | Administration |
| 5180 | Bank / Gateway Charges |
| 5190 | Depreciation |
| 5195 | Loss on Sale of Assets |
| 5900 | Rebates & Waivers |

---

## 5. Roles — who can do what

| Action | SOCIETY_ADMIN | SOCIETY_COMMITTEE | RESIDENT |
|---|:--:|:--:|:--:|
| View reports | ✅ | ✅ | ❌ |
| Generate invoices | ✅ | ❌ | ❌ |
| Record a receipt | ✅ | ✅ | ❌ |
| Confirm a receipt | ✅ | ✅ | ❌ |
| Create an expense | ✅ | ✅ | ❌ |
| **Approve / pay an expense** | ✅ | ❌ | ❌ |
| Request a refund | ✅ | ✅ | ❌ |
| **Pay a refund** | ✅ | ❌ | ❌ |
| Post a manual voucher | ✅ | ❌ | ❌ |
| Change settings | ✅ | ❌ | ❌ |
| See own bills, pay online, report an offline payment | ❌ | ❌ | ✅ |

There is no `TREASURER` role. A resident can only ever see **their own flat** — the flat comes from their signed session, not from anything they can send, so there is no id to tamper with.

### Separation of duties

Two controls, both off by default:

- **`approvals.expenseThresholdPaise`** — above this amount, an expense needs a *different* person to approve it than the one who created it. **Default 0 = no such check at any amount.**
- **`approvals.requireDualControlForReceipts`** — when on, whoever recorded a receipt cannot be the one to confirm it into the ledger.

**Both default off deliberately**, because a great many small societies have exactly one admin, and a society that cannot pay its electricity bill without a second officer is a broken society. **If you have two or more officers, turn both on.** They are the difference between an audit trail and an actual control.

---

## 6. Every screen

### Always available

| Screen | Path | What it is for |
|---|---|---|
| **Overview** | `/dashboard/finance/overview` | Cash position, collection efficiency, ageing, top defaulters, pending approvals. The home page. |
| **Invoices** | `/dashboard/finance/invoices` | Generate a period's bills (with a **dry-run preview** first), view, send, download. |
| **Collections** | `/dashboard/finance/collections` | Record money received. Cash, cheque, NEFT, UPI. |
| **Confirmations** | `/dashboard/finance/confirmations` | Approve payments residents have reported themselves. |
| **Charge Heads** | `/dashboard/finance/charge-heads` | What you bill and how much. |
| **Reports** | `/dashboard/finance/reports` | All statements and registers, with PDF/Excel export. |
| **Settlement** | `/dashboard/finance/settlement` | How online money reaches your bank. |
| **Settings** | `/dashboard/finance/settings` | Every rule, and the module switches. |
| **My Bills** *(resident)* | `/dashboard/finance/my-bills` | The resident's own bills; pay online or report an offline payment. |

### Behind a module toggle

| Screen | Path | Module |
|---|---|---|
| Expenses | `/dashboard/finance/expenses` | `EXPENSES` |
| Funds | `/dashboard/finance/funds` | `FUNDS` |
| Refunds | `/dashboard/finance/refunds` | `REFUNDS` |
| Members & Shares | `/dashboard/finance/shares` | `SHARES` |
| Fixed Assets | `/dashboard/finance/assets` | `ASSETS` |
| Fixed Deposits | `/dashboard/finance/investments` | `INVESTMENTS` |
| Budget | `/dashboard/finance/budget` | `BUDGET` |
| Bank Reconciliation | `/dashboard/finance/bank-reconciliation` | `BANKING` |
| Post-dated Cheques | `/dashboard/finance/pdc` | `PDC` |
| Defaulter Notices | `/dashboard/finance/notices` | `NOTICES` |
| Chart of Accounts | `/dashboard/finance/chart-of-accounts` | `ACCOUNTING` |
| Vouchers & Journal | `/dashboard/finance/journal` | `ACCOUNTING` |
| Opening Balances | `/dashboard/finance/opening-balances` | `ACCOUNTING` |
| Bulk Import | `/dashboard/finance/bulk-import` | `IMPORT` |

### The resident's view of paying

On **My Bills**, a resident with an outstanding bill can pay online, or scan a **UPI QR code** generated from the society's own UPI ID **with the amount already filled in** — they scan, their UPI app opens ready to pay, and they confirm. They can also report an offline payment (cash/NEFT), which lands in **Confirmations** for the committee to approve. Nothing a resident reports touches the ledger until an officer confirms it.

---

## 7. Full worked example — "Sunrise Residency"

Every number below is real: integer paise, computed by the same rules the engine uses.

### 7.1 The society

- 2 wings — **Tower A** (2 flats) and **Tower B** (1 flat)
- Flats: A-101, A-102 (both owner-occupied), B-101 (rented out)
- FY starts **April**. GST **not** registered. TDS **on**.
- Maintenance: **₹1,000 per flat per month**, uniform.

### 7.2 Step 1 — Settings

Financial year April. Rounding **nearest rupee**. Late fee **12% per year, simple**, 5 days' grace. Payments settle **dues first, then interest** (`PRINCIPAL_FIRST`). Both dual-control switches **on** (Sunrise has a Secretary and a Treasurer).

### 7.3 Step 2 — Opening balances

Sunrise has been running for years on paper. A-101 already owes **₹5,000**.

They upload a spreadsheet in **Bulk Import → Opening Dues**:

```
Block,Flat Number,Amount Due
A,101,5000.00
```

The system posts **one** opening voucher:

```
Dr  1200 Sundry Debtors (A-101)      ₹5,000
    Cr  3900 Accumulated Surplus              ₹5,000
```

…**and creates an opening invoice** for A-101 marked `OVERDUE` for ₹5,000.

> **Why the invoice matters.** Every path that settles member dues reads open *invoices*, not the ledger. Without one, A-101's ₹5,000 payment would find nothing to pay, be filed as *advance*, and leave the ₹5,000 debit stranded forever with nothing able to clear it — while the Balance Sheet still balanced perfectly. This is exactly the bug the import used to have.

Import once. A second import is **refused with a 409** — double-posted opening dues are silent, and very hard to unpick later. A forced re-import *adds* to the flat's opening bill rather than creating a second one.

### 7.4 Step 3 — Charge heads

| Code | Name | Mode | Amount | Applies to | Credits |
|---|---|---|---|---|---|
| M1 | Maintenance | UNIFORM | ₹1,000 | All flats | 4100 Maintenance Income |

### 7.5 Step 4 — Generate April invoices

Always **preview first** — a dry run showing exactly what will be billed, with no writes.

Three invoices, ₹1,000 each. For each:

```
Dr  1200 Sundry Debtors (flat)       ₹1,000
    Cr  4100 Maintenance Income               ₹1,000
```

Every line is tagged with the flat **and its wing**, which is what makes the Wing-wise report possible with no extra work from the admin.

**Note B-101 is rented — the bill goes to the OWNER,** not the tenant, unless the charge head says otherwise.

### 7.6 Step 5 — A-101 pays their opening dues

₹5,000 cash. FIFO settles the oldest bill first — the opening one:

```
Dr  1110 Cash in Hand                ₹5,000
    Cr  1200 Sundry Debtors (A-101)           ₹5,000
```

Opening invoice → `PAID`. **Debtors for A-101 clears to zero. Nothing stranded, nothing misfiled as advance.**

### 7.7 Step 6 — B-101 overpays by cheque

₹1,500 against a ₹1,000 bill:

```
Dr  1120 Undeposited Cheques         ₹1,500
    Cr  1200 Sundry Debtors (B-101)           ₹1,000
    Cr  2100 Members' Advance (B-101)           ₹500
```

The ₹500 is **advance** — a liability. When the cheque is banked, a contra moves it `1120 → 1100`.

### 7.8 Step 7 — The society spends

Tower B's lift needs a repair: **₹600**, vendor "LiftCo", TDS-registered at 2%.

The expense is created with the line **tagged to Tower B** — because this cost belongs to one wing, not the society.

On approval (accrual):

```
Dr  5150 Lift AMC (Tower B)            ₹600
    Cr  2310 TDS Payable                        ₹12
    Cr  2200 Sundry Creditors (LiftCo)         ₹588
```

Security guards cost **₹500** and serve everyone — that line is left as **Common**, not tagged to any wing.

### 7.9 Step 8 — May invoices: arrears, interest and advance together

B-101's ₹500 advance is applied automatically:

```
May bill                    ₹1,000
Less advance applied        −₹500
Outstanding                  ₹500
```

```
Dr  2100 Members' Advance (B-101)      ₹500
    Cr  1200 Sundry Debtors (B-101)             ₹500
```

A-102 never paid April. By June, **two** months are unpaid — April ₹1,000 **and** May ₹1,000 — so arrears are ₹2,000 and interest at 12%/year simple for a month is:

```
₹2,000 × 12% ÷ 12 = ₹20.00
```

> **This is where "simple" earns its keep.** By June the ₹2,010 owed includes ₹10 of interest already charged in May. Charging interest on the whole ₹2,010 gives **₹20.10** — interest on interest. Charging it on the ₹2,000 of *dues* gives **₹20.00**. Ten paise on one bill; on a real defaulter's balance, compounding monthly against a bye-law that says *21% simple*, it is the sort of thing a member disputes and wins. The engine now charges interest on **dues only** unless you explicitly choose compounding.

### 7.10 Step 9 — B-101's cheque bounces

Nothing was ever collected, so B-101 owes **April ₹1,000 + May ₹1,000 = ₹2,000**.

The system:
1. Restores the April invoice — including exactly how much of it was penalty.
2. **Claws back the ₹500 advance that the May bill already ate**, putting May back to ₹1,000 owed.
3. Reverses the deposit contra, if the cheque had been banked.
4. Reverses the receipt.

> **Why step 2 exists.** Reversing the receipt alone removes ₹500 of advance that is no longer there — pushing Members' Advance *negative*, a debit balance on a liability — while May keeps claiming it was part-funded by a cheque that bounced. The defaulter register would then chase B-101 for ₹1,500 instead of ₹2,000, and every integrity check would still pass, because the totals still tie.

### 7.11 Step 10 — Month-end

Run **Trial Balance** (ties), **Income & Expenditure** (this FY only, with last year alongside), **Balance Sheet** (assets = liabilities + funds + surplus), and **Wing-wise I&E**:

| | Income | Expenditure | Surplus |
|---|---|---|---|
| Tower A | ₹2,000 | ₹0 | ₹2,000 |
| Tower B | ₹1,000 | ₹600 | ₹400 |
| *Common* | ₹0 | ₹500 | (₹500) |
| **Total** | **₹3,000** | **₹1,100** | **₹1,900** |

Common costs are **not** split across wings — that needs a rule the society must agree (per flat? per square foot? per share?), and inventing one produces numbers that look official and are not. **The totals tie back exactly to the Income & Expenditure statement**, which is the property that makes the report safe to quote in a meeting.

---

## 8. The accounting engine

Every event, and exactly what it posts.

| Event | Debit | Credit |
|---|---|---|
| Invoice issued | 1200 Debtors | 4xxx Income (+ 2300 GST, ± 4900 Rounding) |
| Advance applied to a bill | 2100 Members' Advance | 1200 Debtors |
| Cash/NEFT received | 1110 / 1100 | 1200 Debtors (+ 2100 for any excess) |
| Cheque received | 1120 Undeposited Cheques | 1200 Debtors (+ 2100 excess) |
| Cheque banked | 1100 Bank | 1120 Undeposited Cheques |
| Cheque bounced | *reverses all of the above, and un-applies any advance a later bill consumed* | |
| Expense approved (accrual) | 5xxx Expense | 2200 Creditors (+ 2310 TDS Payable) |
| Expense paid | 2200 Creditors | 1100 Bank |
| Fund-tagged expense | *the fund's own 3xxx account* | 2200 / 1100 |
| Waiver / write-off | 5900 Rebates & Waivers | 1200 Debtors |
| Refund paid | 2100 Members' Advance | 1100 Bank |
| Depreciation run | 5190 Depreciation | 1590 Accumulated Depreciation |
| FD interest accrued | 1300 Investments | 4200 Interest Income *(or the owning fund's account)* |
| Share issued | 1100 Bank | 3000 Share Capital |
| Opening balances | 1200 / 1100 / … | 3900 Accumulated Surplus |
| Unidentified money | 1100 Bank | 2900 Suspense |

**Reversal rule.** `reverseJournal` posts an equal-and-opposite entry and marks the original reversed. It never edits or deletes. It carries every dimension through — flat, vendor, fund and **wing** — because a reversal that dropped the wing would leave that wing permanently overstated while the books still balanced.

---

## 9. Formulas & rules

**Interest on arrears**

Charged per invoice run, by `lateFee.mode`:

| Mode | Interest |
|---|---|
| `PERCENT_PER_ANNUM` *(default)* | `base × rate% ÷ 100 ÷ 12` — one month's twelfth |
| `PERCENT_PER_MONTH` | `base × rate% ÷ 100` |
| `FLAT` | `flatAmountPaise`, regardless of size |
| `SLAB` | `base × the rate of the slab the days-overdue falls in` |

- **`base` is the crux.** With `compounding = SIMPLE` (the default) it is **dues only**. With `COMPOUND` it is **dues + unpaid interest**. See §7.9.
- **Days overdue is a gate, not a multiplier** — nothing is charged until `graceDays` is exceeded, but the charge is then a whole period, not prorated per day.
- `minChargePaise` **raises** a non-zero charge up to that floor; it does not suppress small ones.
- `capPerInvoicePaise` caps it.
- Nothing at all is charged unless `lateFee.enabled` is on.

**Payment appropriation**

FIFO by due date — the oldest bill first. Within a bill, `allocation.interestOrder` decides:

- **`PRINCIPAL_FIRST` (default)** — dues first, penalty last. What most bye-laws want, and it shrinks next month's interest base.
- **`INTEREST_FIRST`** — the lender convention.

**Rounding**

`NONE`, `NEAREST_RUPEE`, or `CEIL_RUPEE`, applied per invoice. The difference posts to the account named in `rounding.accountCode` (default `4900`).

**Pricing modes on a charge head**

| Mode | Bills |
|---|---|
| `UNIFORM` | The same amount to every flat |
| `PER_FLAT_SIZE` | A rate per flat-size band (1BHK, 2BHK…) |
| `PER_SQFT` | A rate × the flat's area |
| `METERED` | A rate × metered units read for that flat |
| `PERCENTAGE` | A percentage of another charge head |
| `FLAT_ADHOC` | A one-off amount per flat |
| `PER_QUANTITY` | A rate × a per-flat quantity — e.g. 2 parking slots × ₹500 |

**Document numbering**

Gapless, per financial year, per document type: `INV/2026-27/00001`. Prefix, padding and template are configurable for **invoices, receipts, vouchers and journal entries**.

---

## 10. Indian statutory handling

### GST — the ₹7,500 exemption, and the argument about it

An RWA's maintenance collection is exempt up to **₹7,500 per member per month**. Above it, there are **two live readings** and societies genuinely follow both:

| `gst.exemptionBasis` | Reading | Authority |
|---|---|---|
| `FULL_IF_EXCEEDS` *(default)* | Cross ₹7,500 and GST applies to **all** of it | CBIC Circular 109/28/2019 |
| `EXCESS_ONLY` | GST applies only to the **excess** over ₹7,500 | Madras HC, *Greenwood Owners Association* (2021) |

**This is configurable, deliberately.** The circular was partly quashed and the department appealed; hard-coding either reading would be a liability. Ask your society's CA which basis to use.

Also modelled: the **₹20 lakh aggregate-turnover registration threshold**, and a per-charge-head `countsTowardRwaExemption` flag — property tax and common-area electricity are excluded from the ₹7,500 computation.

### TDS

Section-wise rates and **thresholds** — 194C (₹30,000 single bill / ₹1,00,000 aggregate), 194J, 194I. Quarterly **Form 26Q** data and **Form 16A** certificates.

Two behaviours worth knowing:

- **The aggregate test wins.** Once the year's total to a vendor crosses the limit, the whole year becomes liable — including earlier bills that were under the single-bill limit and had nothing withheld. The catch-up lands on the bill that crosses the line.
- **The catch-up is capped at the bill.** ₹99,000 then ₹2,000 at 10% wants ₹10,100 out of a ₹2,000 bill. You cannot withhold more than you are paying, so it withholds ₹2,000 and recovers the rest from that vendor's next bill.

**The master switch in Settings is real** — turning TDS off stops deduction even for a vendor marked TDS-applicable. On upgrade, a society already deducting keeps deducting: the answer is inferred once from its own vendors rather than assumed.

### Bye-law guardrails

Advisory warnings, per-state configurable, **never hard blocks** — the committee is responsible, not the software:

- Interest ≤ **21% p.a.**, and **simple, not compound**
- Non-occupancy charges ≤ **10% of service charges**
- Sinking fund ≥ **0.25% p.a. of construction cost**
- Transfer fee cap

### Other statutory pieces

**Share capital & the members' register** (the "J Form" in Maharashtra — template-driven, because the form differs by state) · **fixed asset register with depreciation** · **bank reconciliation** (auditors ask for it) · **period lock** after audit sign-off · **suspense account** for UPI/NEFT money that arrives without a usable reference.

---

## 11. Settlement

| Mode | How money moves |
|---|---|
| `OFFLINE_ONLY` | Cash, cheque, NEFT and UPI only. No gateway. |
| `OWN_KEYS` | The society's own Razorpay account. Money goes straight to them. |
| `PLATFORM_ROUTE` | Routed through the platform to the society's account. |
| `PLATFORM_COLLECT_PAYOUT` | The platform collects and pays out. |

Bank account numbers are stored **encrypted**; only the last 4 digits are ever displayed. Gateway webhooks are verified by **HMAC signature** against the society's own secret and are replay-protected — a forged clearance would need that secret.

---

## 12. Automation

| Job | What it does |
|---|---|
| Invoice generation | Issues a period's bills on schedule |
| Due reminders | Emails before and after the due date, per policy |
| Late fee / interest | Applied at the next invoice run |
| FD maturity alerts | Warns before a deposit matures |
| Depreciation | Posts on a schedule, with a dry-run preview |

**Reminders are email only today.** SMS, WhatsApp and push can be selected and are recorded, but nothing is sent — that needs a provider and credentials. The Settings screen says so on the screen rather than letting you believe otherwise.

---

## 13. Edge cases & how they are handled

| Situation | Behaviour |
|---|---|
| Member overpays | Excess becomes advance, applied automatically to the next bill |
| Member pays part | Invoice → `PARTIALLY_PAID`; the balance keeps ageing |
| **Cheque bounces after its advance was spent** | The advance is clawed back from the bill that consumed it (see §7.10) |
| Cheque bounces after being banked | Both the deposit contra and the receipt are reversed |
| Flat is rented | The **owner** is billed unless the charge head says otherwise |
| Flat sold mid-year | Dues follow the flat; the register records the transfer |
| Money arrives with no reference | Park it in `2900 Suspense`, reallocate when identified |
| One-time levy | Bills **once** — `isRecurring` is honoured |
| Audit finished | Lock the period; back-dated entries are refused |
| A wing is deleted after costs were tagged to it | Those costs still appear, labelled "Unknown wing", so the totals still tie |
| Two societies, same vendor id | Rejected — every lookup is scoped to the society |

---

## 14. Reports reference

Every report takes a **financial-year or date picker**, shows a **previous-year comparative** where meaningful, supports **drill-down to the vouchers behind any figure**, and exports to **PDF and Excel**.

### Statutory statements

| Report | What it is | Who asks for it |
|---|---|---|
| **Income & Expenditure** | What the society earned and spent this FY | AGM and the annual audit |
| **Balance Sheet** | What it owns and owes on a date | AGM, alongside the I&E |
| **Receipts & Payments** | Money actually in and out, ignoring what was billed | Required at the AGM too |
| **Trial Balance** | Every account and its balance | Usually the auditor's first ask |

### Registers

| Report | What it is |
|---|---|
| **Defaulters** | Who owes what, in 0–30 / 30–60 / 60–90 / 90+ buckets |
| **Collections** | Every payment received, with receipt number and mode |
| **Wing-wise I&E** | Each wing's income and costs side by side; common costs shown separately |
| **GST** | Invoice by invoice, totalled by month, with the CGST/SGST split |
| **TDS** | Per vendor with PAN and section, totalled by quarter for Form 26Q |

### Funds

| Report | What it is |
|---|---|
| **Fund Statement** | The balance in each fund — corpus, sinking, repair, and any you created |

> **On the Trial Balance "balanced" badge.** A trial balance built from balanced journals *always* ties — it is arithmetically incapable of doing otherwise, so a green badge there proves very little. The signal worth reading is the **drift check**: whether any account's cached balance has diverged from the entries behind it. That is the one that can actually catch something.

---

## 15. Configuration reference

**Settings → Finance.** Every value below is honoured by the engine.

| Setting | Default | Notes |
|---|---|---|
| `financialYear.startMonth` | `4` (April) | Every FY starts on the **1st** of it |
| `billing.dueDays` | `15` | Days after issue |
| `lateFee.enabled` | `false` | **The master switch — nothing is charged until this is on** |
| `lateFee.mode` | `PERCENT_PER_ANNUM` | `FLAT` / `PERCENT_PER_MONTH` / `PERCENT_PER_ANNUM` / `SLAB` |
| `lateFee.ratePercent` | `21` | Per month or per annum, depending on `mode`. 21% p.a. is the common bye-law cap |
| `lateFee.compounding` | `SIMPLE` | `SIMPLE` / `COMPOUND` |
| `lateFee.graceDays` | `0` | Days |
| `lateFee.flatAmountPaise` | — | Paise, for `FLAT` mode |
| `lateFee.slabs` | — | `{uptoDays, ratePercent}[]`, for `SLAB` mode |
| `lateFee.minChargePaise` | — | Floor: **raises** a non-zero charge |
| `lateFee.capPerInvoicePaise` | — | Ceiling |
| `allocation.interestOrder` | `PRINCIPAL_FIRST` | `PRINCIPAL_FIRST` / `INTEREST_FIRST` |
| `rounding.mode` | `NONE` | `NONE` / `NEAREST_RUPEE` / `CEIL_RUPEE` |
| `rounding.accountCode` | `4900` | Where the difference posts |
| `gst.enabled` | `false` | |
| `gst.defaultRatePercent` | `18` | % |
| `gst.defaultSac` | — | SAC code |
| `gst.rwaExemptionPerMemberPaise` | `750000` (₹7,500) | Per member per month |
| `gst.exemptionBasis` | `FULL_IF_EXCEEDS` | `FULL_IF_EXCEEDS` / `EXCESS_ONLY` — see §10 |
| `gst.registrationThresholdPaise` | ₹20 lakh | Aggregate turnover |
| `gst.placeOfSupplyState` | — | Drives CGST/SGST vs IGST |
| `tds.enabled` | **inferred once** from your vendors, then honoured | See §10 |
| `advance.autoApply` | `true` | Apply advance to the next bill automatically |
| `rebate.enabled` | `false` | Early-payment rebate |
| `rebate.percent` | `5` | % — applies only when enabled |
| `rebate.withinDays` | `15` | Days — applies only when enabled |
| `approvals.expenseThresholdPaise` | **`0` = no check at any amount** | Above this, an expense needs a different approver |
| `approvals.requireDualControlForReceipts` | **`false`** | Recorder ≠ confirmer |
| `approvals.refundRequiresApproval` | `true` | Requester ≠ approver |
| `reminders.enabled` | `false` | |
| `reminders.beforeDueDays` | `[3, 1]` | |
| `reminders.afterDueDays` | `[3, 7, 15]` | |
| `reminders.channels` | `EMAIL` | **Only email is actually delivered** |
| `numbering.{invoice,receipt,voucher,journal}` | prefixes `INV` / `RCP` / `VCH` / `JV` | prefix · padding · template |
| `lock.lockedUpToDate` | — | Refuses entries on or before this date |
| `modules` | **inferred once** from your data | See §3 |
| `settlement.mode` | `OFFLINE_ONLY` | See §11 |

---

## 16. Developer reference

### Services

| File | Responsibility |
|---|---|
| `ledger.service.ts` | `postJournal`, `reverseJournal` — **the only writer of ledger balances** |
| `invoicing.service.ts` | Bill generation, GST, interest, arrears, advance |
| `collections.service.ts` | Receipts, FIFO allocation, cheque clearing, bounce |
| `allocation.util.ts` | `splitPayment` — the shared dues/penalty split |
| `adjustments.service.ts` | Waivers, write-offs, rebates, refunds |
| `expenses.service.ts` | Expenses, vendors, TDS |
| `reports.service.ts` | Every statement and register |
| `reporting-period.service.ts` | `accountMovements`, `accountMovementsByBlock`, `driftFrom` — period-scoped truth |
| `funds.service.ts` | Funds and their ledger accounts |
| `finance-modules.service.ts` | Module toggles and inference |
| `chart-of-accounts.seed.ts` | The default COA + `ACCOUNT_CODES` |
| `bulk-import.service.ts` | Spreadsheet import of flats, members, opening dues |
| `finance-sequence.service.ts` | Gapless numbering |

### Rules for anyone changing this code

1. **`npx tsc --noEmit` is the gate.** The backend dev server runs transpile-only and will happily run code that does not typecheck.
2. **Never do float arithmetic on money.** Round once, at the boundary, to integer paise.
3. **Never write `currentBalancePaise` yourself.** `postJournal` owns it, inside the transaction.
4. **A field that is declared, validated and rendered but never read is a bug**, not a stub. This module has produced that exact defect at least eight times — `fundId`, `billTo`, `isRecurring`, `waivedPaise`, `openingBalancePaise`, `lateFee.compounding`, `tds.enabled`, `requireDualControlForReceipts`. If you add a setting, add the test that proves the engine reads it.
5. **If you mutate denormalised state on the way in, restore it on the way out.** Every reversal path must undo exactly what the forward path did — including anything a *later* document consumed.
6. **Import `config/timezone` first** in any script. It pins Asia/Kolkata.

### Verification

Thirteen suites, **777 assertions**, run against a real database with a throwaway `societyId` and self-cleaning teardown. They never touch existing data.

```bash
npx ts-node src/scripts/verify-phase-a.ts             # 46  FY-scoped reports, opening balances, funds
npx ts-node src/scripts/verify-phase-b.ts             # 70  reports, registers, exports
npx ts-node src/scripts/verify-phase-c.ts             # 82  GST, TDS, share capital, period lock
npx ts-node src/scripts/verify-phase-c-assets.ts      # 59  assets, depreciation, disposal
npx ts-node src/scripts/verify-phase-c-bank.ts        # 60  bank reconciliation
npx ts-node src/scripts/verify-phase-c-import.ts      # 83  bulk import
npx ts-node src/scripts/verify-phase-d-adjustments.ts # 56  waivers, refunds, interest
npx ts-node src/scripts/verify-phase-d-budget.ts      # 99  budget vs actual, AGM pack
npx ts-node src/scripts/verify-phase-d-investments.ts # 61  FDs and accruals
npx ts-node src/scripts/verify-phase-d-notices.ts     # 62  defaulter notices, recovery
npx ts-node src/scripts/verify-modules.ts             # 33  module toggles
npx ts-node src/scripts/verify-wing-cost-centres.ts   # 24  per-wing cost centres
npx ts-node src/scripts/verify-final-audit.ts         # 42  the final-audit defects
```

> ⚠️ **Do not run `src/verify.ts`.** It calls `Society.deleteMany({})` and will wipe real data. It predates these suites.

---

## 17. Known gaps

An honest list. Nothing here is hidden behind optimistic wording.

### Not built

| Gap | Impact | Why not |
|---|---|---|
| **SMS / WhatsApp / push reminders** | Channels are selectable and recorded; **only email is actually sent**. The Settings screen says so. | Needs a provider and credentials. |
| **Society GSTIN/PAN on documents** | Both are captured in Settings but do not appear on an invoice or the GST register. **A GST-registered society's tax invoice legally requires its GSTIN** — if you are registered, check your invoice template before relying on it. | Not yet wired. |
| **`meterType` on a charge head** | Cosmetic label only; metered billing matches readings by charge head, not by meter type. | Harmless. |
| **Per-wing balance sheet** | Wing-wise reporting covers income and expenditure only. | Debtors-per-wing would need receipt-side wing tagging; nobody has asked. |

### Deliberate non-features

- **Common costs are not apportioned across wings.** Requires a rule the society must choose; a default would produce official-looking fiction.
- **Both separation-of-duties controls default off.** A single-admin society must be able to function. **Turn them on if you have two officers.**
- **No year-end closing entries.** Reports derive from the journal, so closing is unnecessary. The period **lock** is a control, not a correctness crutch.

### Not yet driven in a browser

**The 23 finance pages have been verified by typecheck, production build, and API-contract assertions — but not clicked through with real data**, because the assistant that built them cannot log in. The engine underneath is covered by 777 assertions against a real database; the *screens* are the thinner part of that story. Drive them once before real money moves.

### If you are upgrading an existing society

Five behaviours changed. Run an **invoice dry-run and compare it against last month before you generate**:

1. Rented flats now bill the **owner**.
2. Societies under ₹7,500/member/month **stop** being charged GST.
3. Vendors under the TDS thresholds **stop** having tax deducted.
4. One-time levies **stop** re-billing every month.
5. Income & Expenditure shows **this FY only**, not lifetime totals.

---

## 18. FAQ / troubleshooting

**"My Balance Sheet doesn't balance."**
It cannot, arithmetically, unless something posted outside `postJournal`. Run the Trial Balance and read the **drift** section — that is the check that can actually catch something.

**"A member paid but still shows as a defaulter."**
Check the receipt is `CLEARED`, not `PENDING_CONFIRMATION`. A resident-reported payment does nothing until an officer confirms it in **Confirmations**.

**"Interest looks too high."**
Check `lateFee.compounding`. On `SIMPLE` the base is dues only; on `COMPOUND` it includes unpaid interest. Most bye-laws require simple, capped at 21% a year.

**"I turned off TDS but it still deducted."**
Fixed. If you are on an older build, the switch was decorative and deduction ran off each vendor's own flag.

**"I imported opening dues, the member paid, and they still show as owing."**
Fixed — the import now creates a real opening invoice. On an older build the payment was misfiled as advance and the debit stranded. Check for an `OPENING` invoice on the flat; if there is none, the import predates the fix.

**"The wing report doesn't match the Income & Expenditure."**
It must, and there is a test asserting exactly that. If it does not, that is a bug worth reporting immediately.

**"Can a small society use this without all the machinery?"**
Yes — see §3. Turn off what you do not need. Nothing is deleted, and you can turn it back on whenever you like.
