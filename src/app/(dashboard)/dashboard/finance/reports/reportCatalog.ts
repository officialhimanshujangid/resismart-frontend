/**
 * What each report is, in words a committee member can act on.
 *
 * The old page showed nine bare tabs ("Trial Balance", "GST") and assumed the
 * reader already knew which one their auditor wanted. Most society admins are
 * volunteers, not accountants — the explanation is the feature.
 */
export type PeriodKind = 'FY' | 'RANGE' | 'ASOF';

export interface ReportMeta {
  key: string;
  label: string;
  group: string;
  /** What the report is. */
  what: string;
  /** Who asks for it and when. */
  who: string;
  period: PeriodKind;
}

export const GROUPS = ['Statutory statements', 'Registers', 'Funds'] as const;

export const REPORTS: ReportMeta[] = [
  {
    key: 'income-expenditure',
    label: 'Income & Expenditure',
    group: 'Statutory statements',
    what: 'Everything the society earned and spent during the financial year, and whether it ended the year in surplus or deficit.',
    who: 'Presented to members at the AGM and required for the annual audit. Your auditor will ask for this and the Balance Sheet together.',
    period: 'FY',
  },
  {
    key: 'balance-sheet',
    label: 'Balance Sheet',
    group: 'Statutory statements',
    what: 'What the society owns and is owed, against what it owes and holds in funds — on one particular date.',
    who: 'Presented at the AGM alongside the Income & Expenditure. The two totals must match, which the badge below confirms.',
    period: 'FY',
  },
  {
    key: 'receipts-payments',
    label: 'Receipts & Payments',
    group: 'Statutory statements',
    what: 'Actual money that moved in and out of the bank and cash box — regardless of what was billed. Bills raised but unpaid do not appear here.',
    who: 'Required at the AGM alongside the Income & Expenditure. Co-operative societies are expected to present both.',
    period: 'RANGE',
  },
  {
    key: 'trial-balance',
    label: 'Trial Balance',
    group: 'Statutory statements',
    what: 'Every account and its balance, in one list. The working paper the other statements are built from.',
    who: 'Usually the first thing an auditor asks for. Use it to spot an account sitting somewhere it should not be.',
    period: 'ASOF',
  },
  {
    key: 'wing-wise',
    label: 'Wing-wise I&E',
    group: 'Registers',
    what: 'What each wing was billed and what was spent on it, side by side. Costs shared by the whole society sit in their own column rather than being split across wings.',
    who: 'Committees of multi-wing complexes, when members ask whether one wing is subsidising another. Skip it if your society is a single building.',
    period: 'FY',
  },
  {
    key: 'defaulters',
    label: 'Defaulters',
    group: 'Registers',
    what: 'Who owes money and for how long, split by how overdue each bill is.',
    who: 'The committee, for chasing recovery. Anything in the 90-days-plus column is where to start.',
    period: 'ASOF',
  },
  {
    key: 'collection-register',
    label: 'Collections',
    group: 'Registers',
    what: 'Every payment received in the period, with its receipt number and mode.',
    who: 'Whoever reconciles the bank statement — tick these off against what the bank actually shows.',
    period: 'RANGE',
  },
  {
    key: 'gst-register',
    label: 'GST',
    group: 'Registers',
    what: 'GST charged to members, invoice by invoice and totalled month by month, with the taxable value and the CGST/SGST split.',
    who: 'Whoever files your GSTR returns. Only relevant if the society is GST-registered.',
    period: 'RANGE',
  },
  {
    key: 'tds-register',
    label: 'TDS',
    group: 'Registers',
    what: 'Tax deducted from vendor payments, listed per vendor with PAN and section, and totalled by quarter.',
    who: 'Whoever files your quarterly Form 26Q. A vendor with no PAN blocks the return, so those are flagged.',
    period: 'RANGE',
  },
  {
    key: 'fund-statement',
    label: 'Fund Statement',
    group: 'Funds',
    what: 'The balance sitting in each society fund — corpus, sinking, repair and any you have created.',
    who: 'Members at the AGM, who are entitled to know what the reserves hold.',
    period: 'ASOF',
  },
];

export const reportByKey = (key: string) => REPORTS.find(r => r.key === key);
