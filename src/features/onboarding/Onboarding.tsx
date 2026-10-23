import { canUseDemo, enterDemo } from '../../app/demo';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { recordSnapshot } from '../../app/actions';
import { useApp, useFormat } from '../../app/context';
import { requestPersistentStorage } from '../../app/pwa';
import { blankToUnknown, resolveEstimate } from '../../core/estimate';
import { EstimateInput } from '../../components/EstimateInput';
import { PrecisionRing, ProgressBar, RangeValue } from '../../components/Display';
import { statKeys, type Bracket, type LocalePack } from '../../model/localePack';
import type { Estimate, HouseholdType, LiabilityCategory } from '../../model/types';
import { LadderSummary } from '../balance-sheet/LadderSummary';

const STEPS = [
  'welcome',
  'household',
  'income',
  'bonus',
  'expense',
  'cash',
  'investment',
  'home',
  'vehicle',
  'debts',
  'result',
] as const;
type Step = (typeof STEPS)[number];

const HOUSEHOLD_TYPES: HouseholdType[] = ['single', 'couple', 'couple_with_children', 'single_parent', 'other'];
const DEBT_TYPES = ['mortgage', 'car_loan', 'personal_loan', 'credit_card', 'student_loan'] as const satisfies readonly LiabilityCategory[];
type DebtType = (typeof DEBT_TYPES)[number];
const BONUS_CHOICES = [0, 1, 2, 3, 4, 6] as const;

interface Answers {
  householdType: HouseholdType;
  birthYear?: number;
  hasIncome: boolean;
  income: Estimate;
  /** null = 不確定 */
  bonusMonths: number | null;
  expense: Estimate;
  cash: Estimate;
  investment: Estimate | null;
  home: Estimate | null;
  vehicle: Estimate | null;
  debts: Partial<Record<DebtType, Estimate>>;
}

const EMPTY_RANGE: Estimate = { mode: 'range', low: 0, high: 0 };

export function Onboarding() {
  const { t } = useTranslation();
  const app = useApp();
  const { repo, pack, data, today } = app;
  const tol = data.settings.defaultTolerance;
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [a, setA] = useState<Answers>({
    householdType: data.household.householdType,
    hasIncome: true,
    income: EMPTY_RANGE,
    bonusMonths: null,
    expense: EMPTY_RANGE,
    cash: EMPTY_RANGE,
    investment: null,
    home: null,
    vehicle: null,
    debts: {},
  });
  const step: Step = STEPS[stepIndex]!;
  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));
  const expenseStatKey = statKeys.monthlyExpenseTotal(a.householdType);

  const go = async (delta: number) => {
    let nextIndex = stepIndex + delta;
    // 沒有收入就跳過年終題
    if (STEPS[nextIndex] === 'bonus' && !a.hasIncome) nextIndex += delta;
    if (STEPS[nextIndex] === 'result') {
      setSaving(true);
      try {
        await save();
      } finally {
        setSaving(false);
      }
    }
    setStepIndex(nextIndex);
    window.scrollTo(0, 0);
  };

  async function save() {
    const hid = data.household.id;
    const base = pack.baseCurrency;
    const money = (estimate: Estimate) => ({ estimate, currency: base });
    const liquidityOf = (key: string) => pack.categories.asset.find((c) => c.key === key)!.defaultLiquidity;

    await repo.clearFinancialItems(hid);
    await repo.updateHousehold(hid, { householdType: a.householdType });
    if (a.birthYear) await repo.updatePrimaryMember(hid, { birthYear: { mode: 'exact', value: a.birthYear, asOf: today } });

    if (a.hasIncome) {
      const income = blankToUnknown(a.income, statKeys.monthlyIncomePerEarner);
      await repo.saveIncome(hid, {
        ownerId: 'joint',
        category: 'salary',
        amount: money(income),
        frequency: 'monthly',
        isRecurring: true,
        basis: 'net',
      });
      const r = resolveEstimate(income, { statistics: pack.statistics, defaultTolerance: tol });
      if (r && a.bonusMonths) {
        const m = a.bonusMonths;
        const bonus: Estimate = r.low === r.high ? { mode: 'approx', value: r.mid * m } : { mode: 'range', low: r.low * m, high: r.high * m };
        await repo.saveIncome(hid, {
          ownerId: 'joint',
          category: 'bonus',
          amount: money(bonus),
          frequency: 'yearly',
          isRecurring: false,
          basis: 'net',
        });
      }
    }

    await repo.saveExpense(hid, {
      ownerId: 'joint',
      category: 'other',
      label: t('onboarding.expense.itemLabel'),
      amount: money(blankToUnknown(a.expense, expenseStatKey)),
      frequency: 'monthly',
      essential: true,
    });

    await repo.saveAsset(hid, { ownerId: 'joint', category: 'cash', value: money(blankToUnknown(a.cash)), liquidity: liquidityOf('cash') });
    if (a.investment) {
      await repo.saveAsset(hid, { ownerId: 'joint', category: 'investment', value: money(blankToUnknown(a.investment)), liquidity: liquidityOf('investment') });
    }
    const home = a.home
      ? await repo.saveAsset(hid, {
          ownerId: 'joint',
          category: 'real_estate',
          subtype: 'primary_residence',
          label: t('onboarding.home.itemLabel'),
          value: money(blankToUnknown(a.home)),
          liquidity: 'illiquid',
          isPrimaryResidence: true,
        })
      : null;
    const vehicle = a.vehicle
      ? await repo.saveAsset(hid, { ownerId: 'joint', category: 'vehicle', value: money(blankToUnknown(a.vehicle)), liquidity: liquidityOf('vehicle') })
      : null;

    for (const k of DEBT_TYPES) {
      const e = a.debts[k];
      if (!e) continue;
      const def = pack.categories.liability.find((c) => c.key === k)!;
      await repo.saveLiability(hid, {
        ownerId: 'joint',
        category: k,
        balance: money(blankToUnknown(e)),
        secured: def.defaultSecured,
        securedByAssetId: k === 'mortgage' ? home?.id : k === 'car_loan' ? vehicle?.id : undefined,
        isRevolving: k === 'credit_card' ? true : undefined,
      });
    }

    await recordSnapshot(repo, pack, hid, 'onboarding');
    void requestPersistentStorage();
  }

  const finish = async () => {
    await repo.updateSettings(data.household.id, { onboardingCompletedAt: new Date().toISOString() });
  };

  const estimateProps = { pack, today, defaultTolerance: tol };
  const progress = stepIndex / (STEPS.length - 1);

  return (
    <div className="onboarding">
      {step !== 'welcome' && step !== 'result' && (
        <ProgressBar value={progress} label={t('onboarding.progress', { n: stepIndex, total: STEPS.length - 2 })} />
      )}

      {step === 'welcome' && (
        <section className="card hero">
          {/* 文字中的 \n 是刻意的換行 */}
          <h1 className="pre-line">{t('onboarding.welcome.title')}</h1>
          <p className="lead pre-line">{t('onboarding.welcome.lead')}</p>
          <ul className="bullets">
            <li>{t('onboarding.welcome.point1')}</li>
            <li>{t('onboarding.welcome.point2')}</li>
            <li>{t('onboarding.welcome.point3')}</li>
          </ul>
          <p className="disclaimer">{t('common.disclaimer')}</p>
        </section>
      )}

      {step === 'household' && (
        <Question title={t('onboarding.household.title')}>
          <div className="chips">
            {HOUSEHOLD_TYPES.map((h) => (
              <button key={h} type="button" aria-pressed={a.householdType === h} className={a.householdType === h ? 'chip active' : 'chip'} onClick={() => set({ householdType: h })}>
                {t(`householdType.${h}`)}
              </button>
            ))}
          </div>
          <label className="inline-field">
            <span>{t('onboarding.household.birthYear')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1920}
              max={new Date().getFullYear()}
              placeholder="1990"
              value={a.birthYear ?? ''}
              onChange={(e) => set({ birthYear: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
          <p className="muted small">{t('onboarding.household.birthYearHint')}</p>
        </Question>
      )}

      {step === 'income' && (
        <Question title={t('onboarding.income.title')} hint={t('onboarding.income.hint')}>
          <YesNo value={a.hasIncome} onChange={(v) => set({ hasIncome: v })} yes={t('onboarding.income.has')} no={t('onboarding.income.none')} />
          {a.hasIncome && (
            <EstimateInput
              {...estimateProps}
              value={a.income}
              onChange={(income) => set({ income })}
              brackets={pack.brackets.monthly_income}
              statKey={statKeys.monthlyIncomePerEarner}
            />
          )}
        </Question>
      )}

      {step === 'bonus' && (
        <Question title={t('onboarding.bonus.title')} hint={t('onboarding.bonus.hint')}>
          <div className="chips">
            {BONUS_CHOICES.map((m) => (
              <button key={m} type="button" aria-pressed={a.bonusMonths === m} className={a.bonusMonths === m ? 'chip active' : 'chip'} onClick={() => set({ bonusMonths: m })}>
                {m === 0 ? t('onboarding.bonus.none') : t('onboarding.bonus.months', { count: m })}
              </button>
            ))}
            <button type="button" aria-pressed={a.bonusMonths === null} className={a.bonusMonths === null ? 'chip active' : 'chip'} onClick={() => set({ bonusMonths: null })}>
              {t('estimate.mode.unknown')}
            </button>
          </div>
        </Question>
      )}

      {step === 'expense' && (
        <Question title={t('onboarding.expense.title')} hint={t('onboarding.expense.hint')}>
          <EstimateInput
            {...estimateProps}
            value={a.expense}
            onChange={(expense) => set({ expense })}
            brackets={pack.brackets.monthly_expense}
            statKey={expenseStatKey}
          />
        </Question>
      )}

      {step === 'cash' && (
        <Question title={t('onboarding.cash.title')} hint={t('onboarding.cash.hint')}>
          <EstimateInput {...estimateProps} value={a.cash} onChange={(cash) => set({ cash })} brackets={pack.brackets.cash} />
        </Question>
      )}

      {step === 'investment' && (
        <OptionalEstimate
          title={t('onboarding.investment.title')}
          hint={t('onboarding.investment.hint')}
          value={a.investment}
          onChange={(investment) => set({ investment })}
          brackets={pack.brackets.investment}
          estimateProps={estimateProps}
        />
      )}

      {step === 'home' && (
        <OptionalEstimate
          title={t('onboarding.home.title')}
          hint={t('onboarding.home.hint')}
          value={a.home}
          onChange={(home) => set({ home })}
          brackets={pack.brackets.real_estate}
          estimateProps={estimateProps}
        />
      )}

      {step === 'vehicle' && (
        <OptionalEstimate
          title={t('onboarding.vehicle.title')}
          hint={t('onboarding.vehicle.hint')}
          value={a.vehicle}
          onChange={(vehicle) => set({ vehicle })}
          brackets={pack.brackets.vehicle}
          estimateProps={estimateProps}
        />
      )}

      {step === 'debts' && (
        <Question title={t('onboarding.debts.title')} hint={t('onboarding.debts.hint')}>
          <div className="chips">
            {DEBT_TYPES.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={!!a.debts[k]}
                className={a.debts[k] ? 'chip active' : 'chip'}
                onClick={() => {
                  const debts = { ...a.debts };
                  if (debts[k]) delete debts[k];
                  else debts[k] = EMPTY_RANGE;
                  set({ debts });
                }}
              >
                {t(`onboarding.debts.type.${k}`)}
              </button>
            ))}
          </div>
          {DEBT_TYPES.filter((k) => a.debts[k]).map((k) => (
            <div key={k} className="sub-question">
              <h3>{t('onboarding.debts.howMuch', { type: t(`onboarding.debts.type.${k}`) })}</h3>
              <EstimateInput
                {...estimateProps}
                value={a.debts[k]!}
                onChange={(e) => set({ debts: { ...a.debts, [k]: e } })}
                brackets={k === 'mortgage' ? pack.brackets.mortgage : pack.brackets.debt}
              />
            </div>
          ))}
          {Object.keys(a.debts).length === 0 && <p className="muted">{t('onboarding.debts.noneSelected')}</p>}
        </Question>
      )}

      {step === 'result' && <Result onFinish={finish} />}

      {step !== 'result' && (
        <div className="step-nav">
          {stepIndex > 0 && (
            <button type="button" className="btn ghost" onClick={() => void go(-1)} disabled={saving}>
              {t('common.back')}
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => void go(1)} disabled={saving}>
            {saving ? t('common.saving') : step === 'welcome' ? t('onboarding.welcome.start') : STEPS[stepIndex + 1] === 'result' ? t('onboarding.seeResult') : t('common.next')}
          </button>
        </div>
      )}

      {step === 'welcome' && canUseDemo() && (
        <p className="demo-entry">
          <button type="button" className="btn link" onClick={enterDemo}>
            {t('demo.tryFirst')}
          </button>
        </p>
      )}
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card question">
      <h2>{title}</h2>
      {hint && <p className="muted">{hint}</p>}
      {children}
    </section>
  );
}

function YesNo({ value, onChange, yes, no }: { value: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <div className="chips">
      <button type="button" aria-pressed={value} className={value ? 'chip active' : 'chip'} onClick={() => onChange(true)}>
        {yes}
      </button>
      <button type="button" aria-pressed={!value} className={!value ? 'chip active' : 'chip'} onClick={() => onChange(false)}>
        {no}
      </button>
    </div>
  );
}

function OptionalEstimate(props: {
  title: string;
  hint: string;
  value: Estimate | null;
  onChange: (e: Estimate | null) => void;
  brackets?: Bracket[];
  estimateProps: { pack: LocalePack; today: string; defaultTolerance: number };
}) {
  const { t } = useTranslation();
  return (
    <Question title={props.title} hint={props.hint}>
      <YesNo
        value={props.value !== null}
        onChange={(v) => props.onChange(v ? (props.value ?? EMPTY_RANGE) : null)}
        yes={t('common.yes')}
        no={t('common.no')}
      />
      {props.value && (
        <EstimateInput {...props.estimateProps} value={props.value} onChange={props.onChange} brackets={props.brackets} />
      )}
    </Question>
  );
}

function Result({ onFinish }: { onFinish: () => Promise<void> }) {
  const { t } = useTranslation();
  const { overview, pack } = useApp();
  const fmt = useFormat(pack);
  const bs = overview.balanceSheet;
  const surplus = overview.surplus;
  const pct = Math.round(overview.precision.score * 100);

  return (
    <div className="result">
      <section className="card hero">
        <p className="eyebrow">{t('onboarding.result.netWorth')}</p>
        <RangeValue range={bs.netWorth} pack={pack} size="lg" />
        <div className="precision-row">
          <PrecisionRing score={overview.precision.score} />
          <p>{t('onboarding.result.precision', { pct })}</p>
        </div>
        {bs.unresolvedCount > 0 && <p className="muted small">{t('netWorth.unresolved', { count: bs.unresolvedCount })}</p>}
      </section>

      {surplus && (
        <section className="card">
          <h3>{t('onboarding.result.surplus')}</h3>
          <p className="big">{surplus.mid >= 0 ? fmt.money(surplus.mid) : t('onboarding.result.deficit', { v: fmt.money(-surplus.mid) })}</p>
          <p className="muted small">{t('onboarding.result.surplusRange', { range: fmt.range(surplus) })}</p>
        </section>
      )}

      <LadderSummary />

      <section className="card">
        <h3>{t('onboarding.result.nextTitle')}</h3>
        <p>{t('onboarding.result.nextBody')}</p>
      </section>

      <div className="step-nav">
        <button type="button" className="btn primary" onClick={() => void onFinish()}>
          {t('onboarding.result.enter')}
        </button>
      </div>
    </div>
  );
}
