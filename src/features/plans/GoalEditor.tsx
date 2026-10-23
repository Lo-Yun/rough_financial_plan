import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp, usePlanningContext } from '../../app/context';
import { ChipPicker, EditorShell, LabelField, MoneyField, Toggle } from '../../components/EditorParts';
import { blankToUnknown } from '../../core/estimate';
import { AUTO_TARGET_TYPES, DEFAULT_RETURN_PROFILE, projectGoal } from '../../core/planning';
import type { Goal, GoalParams, GoalType, MoneyEstimate, ReturnProfile } from '../../model/types';
import { itemName } from '../balance-sheet/NetWorthPage';
import { goalName } from './PlansPage';
import { ProjectionView } from './ProjectionView';

const GOAL_TYPES: GoalType[] = ['emergency_fund', 'debt_payoff', 'home_down_payment', 'retirement_fi', 'education', 'big_purchase', 'custom'];
const PROFILES: ReturnProfile[] = ['cash', 'balanced', 'growth'];

type Draft = Omit<Goal, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>;

function isGoalType(x: string | null): x is GoalType {
  return !!x && (GOAL_TYPES as string[]).includes(x);
}

export function GoalEditor() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { goals } = useApp();
  const existing = id ? goals.find((g) => g.id === id) : undefined;
  const [type, setType] = useState<GoalType | null>(existing?.type ?? (isGoalType(search.get('type')) ? (search.get('type') as GoalType) : null));

  if (id && !existing) return <Navigate to="/plans" replace />;
  if (!type) return <TypeChooser onPick={setType} />;
  return <GoalForm key={type} type={type} existing={existing} />;
}

function TypeChooser({ onPick }: { onPick: (t: GoalType) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="btn ghost small" onClick={() => navigate(-1)}>
          ‹ {t('common.back')}
        </button>
        <h1>{t('plans.add')}</h1>
      </header>
      {GOAL_TYPES.map((g) => (
        <button key={g} type="button" className="card type-card" onClick={() => onPick(g)}>
          <strong>{t(`plans.type.${g}.name`)}</strong>
          <span className="muted small block">{t(`plans.type.${g}.desc`)}</span>
        </button>
      ))}
    </div>
  );
}

function defaultParams(type: GoalType, ctx: { pack: ReturnType<typeof useApp>['pack']; highInterestIds: string[]; allDebtIds: string[] }): GoalParams | undefined {
  switch (type) {
    case 'emergency_fund':
      return { kind: 'emergency_fund', months: 6 };
    case 'retirement_fi':
      return { kind: 'retirement_fi' };
    case 'home_down_payment':
      return {
        kind: 'home_down_payment',
        homePrice: { estimate: { mode: 'approx', value: 0 }, currency: ctx.pack.baseCurrency },
        downPaymentRatio: ctx.pack.homeDefaults.downPaymentRatio,
        feesRatio: ctx.pack.homeDefaults.feesRatio,
      };
    case 'debt_payoff':
      return { kind: 'debt_payoff', liabilityIds: ctx.highInterestIds.length ? ctx.highInterestIds : ctx.allDebtIds, strategy: 'avalanche' };
    default:
      return undefined;
  }
}

function GoalForm({ type, existing }: { type: GoalType; existing?: Goal }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { repo, data, pack, overview, goals } = useApp();
  const planning = usePlanningContext();
  const hid = data.household.id;
  const debtIds = overview.debts.map((d) => d.liability.id);
  const highInterestIds = overview.debts.filter((d) => d.isHighInterest).map((d) => d.liability.id);
  const assets = data.assets.filter((a) => !a.archivedAt);
  const needsTarget = !AUTO_TARGET_TYPES.includes(type);

  const [draft, setDraft] = useState<Draft>(
    () =>
      existing ?? {
        type,
        priority: (goals.at(-1)?.priority ?? 0) + 1,
        status: 'active',
        params: defaultParams(type, { pack, highInterestIds, allDebtIds: debtIds }),
        target: needsTarget ? { estimate: { mode: 'approx', value: 0 }, currency: pack.baseCurrency } : undefined,
      },
  );
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const params = draft.params;

  const normalizeMoney = (m: MoneyEstimate | undefined) => (m ? { ...m, estimate: blankToUnknown(m.estimate) } : undefined);
  const normalized: Draft = {
    ...draft,
    target: normalizeMoney(draft.target),
    monthlyContribution: normalizeMoney(draft.monthlyContribution),
    params: params?.kind === 'home_down_payment' ? { ...params, homePrice: normalizeMoney(params.homePrice)! } : params,
  };
  const preview = projectGoal({ ...normalized, id: existing?.id ?? 'preview', householdId: hid, createdAt: '', updatedAt: '' }, planning);

  const save = async () => {
    await repo.saveGoal(hid, { ...normalized, id: existing?.id });
    navigate('/plans');
  };

  const archive = async () => {
    if (!existing || !confirm(t('plans.confirmDelete'))) return;
    await repo.archiveGoal(existing.id);
    navigate('/plans');
  };

  return (
    <EditorShell title={existing ? goalName(existing, t) : t(`plans.type.${type}.name`)} onSave={save} onDelete={existing ? archive : undefined}>
      <section className="preview-box" aria-live="polite">
        <p className="eyebrow">{t('plans.preview')}</p>
        <ProjectionView goal={normalized as Goal} p={preview} />
      </section>

      <p className="muted small">{t(`plans.type.${type}.desc`)}</p>
      <LabelField value={draft.name} onChange={(name) => set({ name })} placeholder={t(`plans.type.${type}.name`)} />

      {params?.kind === 'emergency_fund' && (
        <ChipPicker
          legend={t('plans.field.months')}
          options={[3, 6, 12].map((m) => ({ key: String(m), label: t('duration.months', { count: m }) }))}
          value={String(params.months)}
          onChange={(m) => set({ params: { ...params, months: Number(m) } })}
          hint={t('plans.field.monthsHint')}
        />
      )}

      {params?.kind === 'retirement_fi' && (
        <ChipPicker
          legend={t('plans.field.swr')}
          options={['0.03', '0.035', '0.04'].map((r) => ({ key: r, label: `${Number(r) * 100}%` }))}
          value={String(params.withdrawalRate ?? planning.assumptions.safeWithdrawalRate)}
          onChange={(r) => set({ params: { ...params, withdrawalRate: Number(r) } })}
          hint={t('plans.field.swrHint')}
        />
      )}

      {params?.kind === 'home_down_payment' && (
        <>
          <MoneyField
            label={t('plans.field.homePrice')}
            value={params.homePrice}
            onChange={(homePrice) => set({ params: { ...params, homePrice } })}
            bracketsKey="real_estate"
          />
          <ChipPicker
            legend={t('plans.field.downPayment')}
            options={['0.2', '0.3', '0.4'].map((r) => ({ key: r, label: `${Math.round(Number(r) * 100)}%` }))}
            value={String(params.downPaymentRatio)}
            onChange={(r) => set({ params: { ...params, downPaymentRatio: Number(r) } })}
            hint={t('plans.field.downPaymentHint', { fees: Math.round(params.feesRatio * 100) })}
          />
        </>
      )}

      {params?.kind === 'debt_payoff' && (
        <>
          <fieldset className="field">
            <legend>{t('plans.field.debts')}</legend>
            {overview.debts.length === 0 && <p className="muted small">{t('plans.field.noDebts')}</p>}
            {overview.debts.map((d) => (
              <Toggle
                key={d.liability.id}
                checked={params.liabilityIds.includes(d.liability.id)}
                onChange={(on) =>
                  set({
                    params: {
                      ...params,
                      liabilityIds: on ? [...params.liabilityIds, d.liability.id] : params.liabilityIds.filter((x) => x !== d.liability.id),
                    },
                  })
                }
                label={itemName(d.liability, 'liability', t)}
                hint={t('plans.field.debtInfo', { rate: (d.rate.mid * 100).toFixed(1) })}
              />
            ))}
          </fieldset>
          <ChipPicker
            legend={t('plans.field.strategy')}
            options={(['avalanche', 'snowball'] as const).map((s) => ({ key: s, label: t(`plans.strategy.${s}`) }))}
            value={params.strategy}
            onChange={(strategy) => set({ params: { ...params, strategy } })}
            hint={t(`plans.strategy.${params.strategy}Hint`)}
          />
        </>
      )}

      {needsTarget && draft.target && <MoneyField label={t('plans.field.target')} value={draft.target} onChange={(target) => set({ target })} />}

      <label className="field">
        <span>{t('plans.field.date')}</span>
        <input type="date" min={planning.today} value={draft.targetDate ?? ''} onChange={(e) => set({ targetDate: e.target.value || undefined })} />
        <small className="muted">{t('plans.field.dateHint')}</small>
      </label>

      <Toggle
        checked={!!draft.monthlyContribution}
        onChange={(on) =>
          set({
            monthlyContribution: on ? { estimate: { mode: 'approx', value: Math.max(0, Math.round(overview.surplus?.mid ?? 0)) }, currency: pack.baseCurrency } : undefined,
          })
        }
        label={t(type === 'debt_payoff' ? 'plans.field.extraToggle' : 'plans.field.contributionToggle')}
        hint={t(type === 'debt_payoff' ? 'plans.field.extraHint' : 'plans.field.contributionHint')}
      />
      {draft.monthlyContribution && (
        <MoneyField label={t(type === 'debt_payoff' ? 'plans.proj.extra' : 'plans.field.contribution')} value={draft.monthlyContribution} onChange={(monthlyContribution) => set({ monthlyContribution })} />
      )}

      {type !== 'debt_payoff' && (
        <>
          <ChipPicker
            legend={t('plans.field.profile')}
            options={PROFILES.map((p) => ({ key: p, label: t(`plans.profile.${p}.name`) }))}
            value={draft.returnProfile ?? DEFAULT_RETURN_PROFILE[type]}
            onChange={(returnProfile) => set({ returnProfile })}
            hint={t(`plans.profile.${draft.returnProfile ?? DEFAULT_RETURN_PROFILE[type]}.desc`)}
          />
          {assets.length > 0 && (
            <fieldset className="field">
              <legend>{t('plans.field.linked')}</legend>
              <p className="muted small">{t(`plans.field.linkedHint.${type === 'emergency_fund' || type === 'retirement_fi' ? type : 'other'}`)}</p>
              {assets.map((a) => (
                <Toggle
                  key={a.id}
                  checked={!!draft.linkedAssets?.some((l) => l.assetId === a.id)}
                  onChange={(on) => {
                    const rest = (draft.linkedAssets ?? []).filter((l) => l.assetId !== a.id);
                    const next = on ? [...rest, { assetId: a.id, share: 1 }] : rest;
                    set({ linkedAssets: next.length ? next : undefined });
                  }}
                  label={itemName(a, 'asset', t)}
                />
              ))}
            </fieldset>
          )}
        </>
      )}
    </EditorShell>
  );
}
