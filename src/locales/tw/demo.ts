import { ulid } from 'ulid';
import { addMonthsISO } from '../../core/checkin';
import { buildSnapshotData, computeOverview, moneyContext, type FinancialData } from '../../core/overview';
import { holdingsEstimateForAsset, holdingsTotal } from '../../core/portfolio';
import { defaultSettings, type ExportPayload } from '../../data/repo';
import { SCHEMA_VERSION } from '../../data/db';
import type { LocalePack } from '../../model/localePack';
import type {
  Asset,
  CheckIn,
  Estimate,
  ExpenseItem,
  Goal,
  Holding,
  IncomeItem,
  ISODate,
  Liability,
  MoneyEstimate,
  Snapshot,
  UserAction,
} from '../../model/types';

// 示範資料（規格 4.11）：一個虛構的雙薪、有一個小孩、有房貸的家庭。
// 數字刻意混用「大約／範圍／精確」，並帶一年的歷史快照，讓每個頁面都有東西可以看。

/** 歷史快照的月數 */
const HISTORY_MONTHS = 12;

const twd = (estimate: Estimate): MoneyEstimate => ({ estimate, currency: 'TWD' });
const approx = (value: number): Estimate => ({ mode: 'approx', value });

export function buildTwDemo(pack: LocalePack, today: ISODate): ExportPayload {
  const householdId = ulid();
  const start = addMonthsISO(today, -HISTORY_MONTHS);
  const createdAt = `${start}T09:00:00.000Z`;
  const base = { householdId, createdAt, updatedAt: createdAt };
  const exact = (value: number): Estimate => ({ mode: 'exact', value, asOf: today, source: 'manual' });

  const id = {
    cash: ulid(),
    usd: ulid(),
    brokerage: ulid(),
    pension: ulid(),
    insurance: ulid(),
    home: ulid(),
    car: ulid(),
    mortgage: ulid(),
    carLoan: ulid(),
  };

  const settings = {
    ...defaultSettings(householdId, pack),
    fxRates: [{ currency: 'USD', rateToBase: 32, asOf: today }],
    onboardingCompletedAt: createdAt,
    // 示範模式不需要備份提醒
    lastBackupAt: `${today}T00:00:00.000Z`,
  };

  const incomes: IncomeItem[] = [
    { ...base, id: ulid(), ownerId: 'joint', category: 'salary', label: '本人薪資', amount: twd(exact(65_000)), frequency: 'monthly', isRecurring: true, basis: 'net' },
    { ...base, id: ulid(), ownerId: 'joint', category: 'salary', label: '伴侶薪資', amount: twd({ mode: 'range', low: 48_000, high: 55_000 }), frequency: 'monthly', isRecurring: true, basis: 'net' },
    { ...base, id: ulid(), ownerId: 'joint', category: 'bonus', label: '年終獎金', amount: twd(approx(180_000)), frequency: 'yearly', isRecurring: false, basis: 'net' },
  ];

  const expense = (category: string, label: string, amount: Estimate, frequency: ExpenseItem['frequency'], essential: boolean): ExpenseItem => ({
    ...base,
    id: ulid(),
    ownerId: 'joint',
    category,
    label,
    amount: twd(amount),
    frequency,
    essential,
  });
  const expenses: ExpenseItem[] = [
    expense('housing', '社區管理費', exact(3_200), 'monthly', true),
    expense('food', '伙食', approx(22_000), 'monthly', true),
    expense('utilities', '水電瓦斯', approx(3_500), 'monthly', true),
    expense('telecom', '手機與網路', exact(1_800), 'monthly', true),
    expense('transport', '油錢、停車、大眾運輸', approx(6_000), 'monthly', true),
    expense('children_education', '小孩學費與才藝', { mode: 'range', low: 12_000, high: 18_000 }, 'monthly', true),
    expense('family_support', '孝親費', exact(10_000), 'monthly', true),
    expense('insurance', '保險費', approx(60_000), 'yearly', true),
    expense('shopping', '購物', approx(6_000), 'monthly', false),
    expense('leisure_travel', '旅遊', approx(80_000), 'yearly', false),
  ];

  const holdings: Holding[] = [
    { ...base, id: ulid(), assetId: id.brokerage, symbol: '0050', name: '台灣 50', assetClass: 'equity_domestic', quantity: 2_000, price: { value: 190, currency: 'TWD', asOf: today } },
    { ...base, id: ulid(), assetId: id.brokerage, symbol: 'VT', name: '全世界股票 ETF', assetClass: 'equity_global', quantity: 40, price: { value: 125, currency: 'USD', asOf: today } },
    { ...base, id: ulid(), assetId: id.brokerage, name: '美國公債 ETF', assetClass: 'bond', marketValue: twd(approx(150_000)) },
  ];

  const mortgagePayment = 30_000;
  const carPayment = 9_000;

  /**
   * monthsAgo 個月前的資產負債。越早投資與存款越少、房貸越多；
   * 房子與車子的估值不變，讓歷史曲線的變化來自存錢與還債。
   */
  function balanceSheetAt(monthsAgo: number, brokerageValue: Estimate): { assets: Asset[]; liabilities: Liability[] } {
    const k = monthsAgo;
    const grow = (v: number, monthly: number) => Math.round(v / (1 + monthly) ** k / 1_000) * 1_000;
    const asset = (a: Omit<Asset, keyof typeof base>): Asset => ({ ...base, ...a });
    const liability = (l: Omit<Liability, keyof typeof base>): Liability => ({ ...base, ...l });
    return {
      assets: [
        asset({ id: id.cash, ownerId: 'joint', category: 'cash', label: '活存與定存', value: twd(k === 0 ? approx(350_000) : approx(grow(350_000, 0.006))), liquidity: 'liquid' }),
        asset({ id: id.usd, ownerId: 'joint', category: 'cash', label: '美元定存', value: { estimate: { mode: 'exact', value: 8_000, asOf: today }, currency: 'USD' }, liquidity: 'liquid' }),
        asset({
          id: id.brokerage,
          ownerId: 'joint',
          category: 'investment',
          label: '證券帳戶',
          value: twd(k === 0 ? brokerageValue : approx(grow(estimateMid(brokerageValue), 0.012))),
          liquidity: 'semi_liquid',
          valueFromHoldings: true,
        }),
        asset({
          id: id.pension,
          ownerId: 'joint',
          category: 'retirement',
          label: '勞退個人專戶（兩人）',
          value: twd(k === 0 ? { mode: 'range', low: 400_000, high: 500_000 } : approx(grow(450_000, 0.008))),
          liquidity: 'illiquid',
          allocation: { equity_global: 0.6, bond: 0.4 },
        }),
        asset({ id: id.insurance, ownerId: 'joint', category: 'insurance_cash_value', label: '儲蓄險解約金', value: twd(approx(grow(300_000, 0.004))), liquidity: 'illiquid' }),
        asset({ id: id.home, ownerId: 'joint', category: 'real_estate', label: '自住房', value: twd(approx(12_000_000)), liquidity: 'illiquid', isPrimaryResidence: true }),
        asset({ id: id.car, ownerId: 'joint', category: 'vehicle', label: '家用車', value: twd(approx(450_000)), liquidity: 'illiquid' }),
      ],
      liabilities: [
        liability({
          id: id.mortgage,
          ownerId: 'joint',
          category: 'mortgage',
          label: '房貸',
          balance: twd(approx(7_800_000 + k * 16_000)),
          annualRate: exact(0.0218),
          monthlyPayment: twd(exact(mortgagePayment)),
          secured: true,
          securedByAssetId: id.home,
        }),
        liability({
          id: id.carLoan,
          ownerId: 'joint',
          category: 'car_loan',
          label: '車貸',
          balance: twd(approx(300_000 + k * 8_000)),
          annualRate: approx(0.035),
          monthlyPayment: twd(exact(carPayment)),
          secured: true,
          securedByAssetId: id.car,
        }),
      ],
    };
  }

  const household = {
    id: householdId,
    name: '示範家庭',
    localeCode: pack.code,
    baseCurrency: pack.baseCurrency,
    householdType: 'couple_with_children' as const,
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    updatedAt: createdAt,
  };
  const dataAt = (monthsAgo: number, brokerageValue: Estimate): FinancialData => ({
    household,
    settings,
    incomes,
    expenses,
    ...balanceSheetAt(monthsAgo, brokerageValue),
  });

  // 證券帳戶的金額＝持股加總，與 App 內「用持股加總」的算法一致
  const probe = dataAt(0, approx(0));
  const brokerageValue = holdingsEstimateForAsset(holdingsTotal(holdings, moneyContext(probe, pack)), today);
  const current = dataAt(0, brokerageValue);

  const snapshots: Snapshot[] = [];
  const checkIns: CheckIn[] = [];
  // 最近一次回顧在一個月前，所以今天剛好該做回顧
  for (let k = HISTORY_MONTHS; k >= 1; k--) {
    const date = addMonthsISO(today, -k);
    const data = dataAt(k, brokerageValue);
    const trigger: Snapshot['trigger'] = k === HISTORY_MONTHS ? 'onboarding' : 'check_in';
    const ts = `${date}T12:00:00.000Z`;
    const snap: Snapshot = { ...buildSnapshotData(data, computeOverview(data, pack, date), pack, date, trigger), id: ulid(), householdId, createdAt: ts, updatedAt: ts };
    snapshots.push(snap);
    if (trigger === 'check_in') {
      checkIns.push({ id: ulid(), householdId, createdAt: ts, updatedAt: ts, date, hadMajorChange: false, updatedItemIds: [id.cash, id.brokerage], completedActionIds: [], snapshotId: snap.id });
    }
  }

  const goal = (g: Omit<Goal, keyof typeof base | 'id' | 'status'>): Goal => ({ ...base, id: ulid(), status: 'active', ...g });
  const goals: Goal[] = [
    goal({ type: 'emergency_fund', priority: 1, params: { kind: 'emergency_fund', months: 6 } }),
    goal({ type: 'education', name: '小孩大學教育金', priority: 2, target: twd(approx(1_200_000)), targetDate: addMonthsISO(today, 12 * 14), returnProfile: 'balanced', monthlyContribution: twd(approx(5_000)) }),
    goal({ type: 'retirement_fi', priority: 3, params: { kind: 'retirement_fi' }, returnProfile: 'growth' }),
  ];

  const doneAt = `${addMonthsISO(today, -2)}T12:00:00.000Z`;
  const userActions: UserAction[] = [
    { ...base, id: ulid(), title: '把所有保單整理成一張表', status: 'done', acceptedAt: createdAt, completedAt: doneAt, updatedAt: doneAt },
    { ...base, id: ulid(), title: '問銀行房貸能不能降息', status: 'active', acceptedAt: doneAt, updatedAt: doneAt },
  ];

  const primaryId = ulid();
  return {
    household,
    members: [
      { id: primaryId, householdId, displayName: '', birthYear: { mode: 'exact', value: Number(today.slice(0, 4)) - 36, asOf: today }, isPrimary: true, createdAt, updatedAt: createdAt },
    ],
    incomeItems: incomes,
    expenseItems: expenses,
    assets: current.assets,
    liabilities: current.liabilities,
    snapshots,
    goals,
    holdings,
    userActions,
    checkIns,
    settings,
    assumptions: { householdId, targetAllocation: { preset: 'balanced' } },
  };
}

function estimateMid(e: Estimate): number {
  switch (e.mode) {
    case 'range':
      return (e.low + e.high) / 2;
    case 'approx':
    case 'exact':
      return e.value;
    default:
      return 0;
  }
}
