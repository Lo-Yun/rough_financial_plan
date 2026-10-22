import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp, useFormat } from '../../app/context';
import { CategoryPicker, ChipPicker, EditorShell, LabelField, MoneyField, NoteField, PercentField, Toggle } from '../../components/EditorParts';
import { resolveDebt } from '../../core/debt';
import { blankToUnknown } from '../../core/estimate';
import { moneyContext } from '../../core/overview';
import { ASSET_CLASSES, normalizeAllocation } from '../../core/portfolio';
import type { Asset, AssetCategory, AssetClass, Liability, LiabilityCategory, Liquidity } from '../../model/types';
import { itemName } from './NetWorthPage';

const LIQUIDITIES: Liquidity[] = ['liquid', 'semi_liquid', 'illiquid'];

/** 依類別挑選輸入級距 */
const ASSET_BRACKETS: Partial<Record<AssetCategory, string>> = {
  cash: 'cash',
  investment: 'investment',
  real_estate: 'real_estate',
  vehicle: 'vehicle',
};
const LIABILITY_BRACKETS: Partial<Record<LiabilityCategory, string>> = { mortgage: 'mortgage' };

export function ItemEditor({ kind }: { kind: 'asset' | 'liability' }) {
  const { id } = useParams();
  return kind === 'asset' ? <AssetEditor id={id} /> : <LiabilityEditor id={id} />;
}

function useCommon() {
  const app = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return { ...app, navigate, t, hid: app.data.household.id };
}

function AssetEditor({ id }: { id?: string }) {
  const { data, pack, repo, navigate, t, hid, holdings } = useCommon();
  const existing = id ? data.assets.find((a) => a.id === id && !a.archivedAt) : undefined;
  const [draft, setDraft] = useState<Omit<Asset, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>>(
    () =>
      existing ?? {
        ownerId: 'joint',
        category: 'cash',
        value: { estimate: { mode: 'range', low: 0, high: 0 }, currency: pack.baseCurrency },
        liquidity: 'liquid',
      },
  );
  if (id && !existing) return <Navigate to="/" replace />;

  const setCategory = (category: AssetCategory) => {
    const def = pack.categories.asset.find((c) => c.key === category)!;
    setDraft((d) => ({
      ...d,
      category,
      liquidity: def.defaultLiquidity,
      isPrimaryResidence: category === 'real_estate' ? d.isPrimaryResidence : undefined,
    }));
  };

  const save = async () => {
    await repo.saveAsset(hid, { ...draft, value: { ...draft.value, estimate: blankToUnknown(draft.value.estimate) }, id: existing?.id });
    navigate('/');
  };

  const archive = async () => {
    if (!existing || !confirm(t('editor.confirmDelete'))) return;
    await repo.archiveAsset(existing.id);
    navigate('/');
  };

  return (
    <EditorShell
      title={existing ? itemName(existing, 'asset', t) : t('netWorth.add.asset')}
      onSave={save}
      onDelete={existing ? archive : undefined}
    >
      <CategoryPicker defs={pack.categories.asset} value={draft.category} onChange={setCategory} />
      <LabelField value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))} />
      <MoneyField
        label={t('editor.value')}
        value={draft.value}
        onChange={(value) => setDraft((d) => ({ ...d, value }))}
        bracketsKey={ASSET_BRACKETS[draft.category] ?? 'generic_asset'}
        hint={draft.valueFromHoldings ? t('allocation.valueFromHoldingsHint') : undefined}
      />
      <ChipPicker
        legend={t('editor.liquidity')}
        options={LIQUIDITIES.map((l) => ({ key: l, label: t(`liquidity.${l}`) }))}
        value={draft.liquidity}
        onChange={(liquidity) => setDraft((d) => ({ ...d, liquidity }))}
        hint={t(`liquidity.${draft.liquidity}Hint`)}
      />
      {draft.category === 'real_estate' && (
        <Toggle checked={!!draft.isPrimaryResidence} onChange={(isPrimaryResidence) => setDraft((d) => ({ ...d, isPrimaryResidence }))} label={t('editor.primaryResidence')} />
      )}
      {(draft.category === 'cash' || pack.categories.asset.find((c) => c.key === draft.category)?.inPortfolio) && (
        <AllocationEditor
          value={draft.allocation}
          defaultAllocation={pack.categories.asset.find((c) => c.key === draft.category)!.defaultAllocation}
          onChange={(allocation) => setDraft((d) => ({ ...d, allocation }))}
          holdingsCount={existing ? holdings.filter((h) => h.assetId === existing.id).length : 0}
          holdingsLink={existing ? `/asset/${existing.id}/holdings` : undefined}
        />
      )}
      <NoteField value={draft.note} onChange={(note) => setDraft((d) => ({ ...d, note }))} />
      {draft.category === 'insurance_cash_value' && <p className="muted small">{t('editor.insuranceHint')}</p>}
      {draft.category === 'retirement' && <p className="muted small">{t('editor.retirementHint')}</p>}
    </EditorShell>
  );
}

function LiabilityEditor({ id }: { id?: string }) {
  const { data, pack, repo, navigate, t, hid, today } = useCommon();
  const fmt = useFormat(pack);
  const existing = id ? data.liabilities.find((l) => l.id === id && !l.archivedAt) : undefined;
  const [draft, setDraft] = useState<Omit<Liability, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>>(
    () =>
      existing ?? {
        ownerId: 'joint',
        category: 'personal_loan',
        balance: { estimate: { mode: 'range', low: 0, high: 0 }, currency: pack.baseCurrency },
        secured: false,
      },
  );
  if (id && !existing) return <Navigate to="/" replace />;

  const activeAssets = data.assets.filter((a) => !a.archivedAt);
  const def = pack.categories.liability.find((c) => c.key === draft.category)!;
  const rateValue = draft.annualRate && draft.annualRate.mode !== 'unknown' && draft.annualRate.mode !== 'range' ? draft.annualRate.value : undefined;
  const paidInFull = draft.category === 'credit_card' && !draft.isRevolving;

  // 即時推算每月還款，讓使用者知道沒填時系統怎麼算
  const preview = resolveDebt(
    { ...draft, id: 'preview', householdId: hid, createdAt: '', updatedAt: '', balance: { ...draft.balance, estimate: blankToUnknown(draft.balance.estimate) } },
    moneyContext(data, pack),
    pack,
  );

  const setCategory = (category: LiabilityCategory) => {
    const next = pack.categories.liability.find((c) => c.key === category)!;
    setDraft((d) => ({
      ...d,
      category,
      secured: next.defaultSecured,
      securedByAssetId: next.defaultSecured ? d.securedByAssetId : undefined,
      isRevolving: category === 'credit_card' ? (d.isRevolving ?? true) : undefined,
    }));
  };

  const save = async () => {
    await repo.saveLiability(hid, { ...draft, balance: { ...draft.balance, estimate: blankToUnknown(draft.balance.estimate) }, id: existing?.id });
    navigate('/');
  };

  const archive = async () => {
    if (!existing || !confirm(t('editor.confirmDelete'))) return;
    await repo.archiveLiability(existing.id);
    navigate('/');
  };

  return (
    <EditorShell
      title={existing ? itemName(existing, 'liability', t) : t('netWorth.add.liability')}
      onSave={save}
      onDelete={existing ? archive : undefined}
    >
      <CategoryPicker defs={pack.categories.liability} value={draft.category} onChange={setCategory} />
      <LabelField value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))} />
      <MoneyField
        label={t('editor.balance')}
        value={draft.balance}
        onChange={(balance) => setDraft((d) => ({ ...d, balance }))}
        bracketsKey={LIABILITY_BRACKETS[draft.category] ?? 'debt'}
      />
      {draft.category === 'credit_card' && (
        <Toggle
          checked={!!draft.isRevolving}
          onChange={(isRevolving) => setDraft((d) => ({ ...d, isRevolving }))}
          label={t('editor.revolving')}
          hint={t('editor.revolvingHint')}
        />
      )}
      {!paidInFull && (
        <>
          <PercentField
            label={t('editor.rate')}
            value={rateValue}
            onChange={(v) => setDraft((d) => ({ ...d, annualRate: v === undefined ? undefined : { mode: 'exact', value: v, asOf: today } }))}
            placeholder={String(Math.round(def.defaultAnnualRate * 1000) / 10)}
            hint={t('editor.rateHint', { pct: Math.round(def.defaultAnnualRate * 1000) / 10 })}
          />
          <Toggle
            checked={!!draft.monthlyPayment}
            onChange={(on) =>
              setDraft((d) => ({
                ...d,
                monthlyPayment: on ? { estimate: { mode: 'approx', value: Math.round(preview?.payment.mid ?? 0) }, currency: d.balance.currency } : undefined,
              }))
            }
            label={t('editor.knowPayment')}
          />
          {draft.monthlyPayment ? (
            <MoneyField label={t('editor.payment')} value={draft.monthlyPayment} onChange={(monthlyPayment) => setDraft((d) => ({ ...d, monthlyPayment }))} />
          ) : (
            preview && (
              <p className="muted small">
                {t('editor.derivedPayment', { amount: fmt.money(preview.payment.mid), months: def.defaultTermMonths })}
              </p>
            )
          )}
        </>
      )}
      <Toggle
        checked={draft.secured}
        onChange={(secured) => setDraft((d) => ({ ...d, secured, securedByAssetId: secured ? d.securedByAssetId : undefined }))}
        label={t('editor.secured')}
        hint={t('editor.securedHint')}
      />
      {draft.secured && activeAssets.length > 0 && (
        <label className="field">
          <span>{t('editor.securedBy')}</span>
          <select value={draft.securedByAssetId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, securedByAssetId: e.target.value || undefined }))}>
            <option value="">{t('editor.securedByNone')}</option>
            {activeAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {itemName(a, 'asset', t)}
              </option>
            ))}
          </select>
        </label>
      )}
      <NoteField value={draft.note} onChange={(note) => setDraft((d) => ({ ...d, note }))} />
    </EditorShell>
  );
}

/** 資產類別配置：單一類別，或「混合」時輸入各類別百分比 */
function AllocationEditor({
  value,
  defaultAllocation,
  onChange,
  holdingsCount,
  holdingsLink,
}: {
  value: Asset['allocation'];
  defaultAllocation: Asset['allocation'];
  onChange: (a: Asset['allocation']) => void;
  holdingsCount: number;
  holdingsLink?: string;
}) {
  const { t } = useTranslation();
  const effective = normalizeAllocation(value) ?? normalizeAllocation(defaultAllocation) ?? { other: 1 };
  const keys = Object.keys(effective) as AssetClass[];
  const [mixed, setMixed] = useState(keys.length > 1);
  const single = keys.length === 1 ? keys[0] : undefined;
  const total = Object.values(value ?? {}).reduce((s, v) => s + (v ?? 0), 0);

  return (
    <fieldset className="field">
      <legend>{t('allocation.title')}</legend>
      {holdingsCount > 0 ? (
        <p className="muted small">{t('allocation.fromHoldings', { count: holdingsCount })}</p>
      ) : (
        <>
          <div className="chips">
            {ASSET_CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={!mixed && single === c} className={!mixed && single === c ? 'chip active' : 'chip'}
                onClick={() => {
                  setMixed(false);
                  onChange({ [c]: 1 });
                }}
              >
                {t(`portfolio.class.${c}`)}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={mixed} className={mixed ? 'chip active' : 'chip'}
              onClick={() => {
                setMixed(true);
                onChange(effective);
              }}
            >
              {t('allocation.mixed')}
            </button>
          </div>
          {!value && <p className="muted small">{t('allocation.usingDefault')}</p>}
          {mixed && (
            <>
              {ASSET_CLASSES.map((c) => (
                <PercentField
                  key={c}
                  label={t(`portfolio.class.${c}`)}
                  value={value?.[c]}
                  onChange={(v) => {
                    const next = { ...value, [c]: v };
                    if (!v) delete next[c];
                    onChange(Object.keys(next).length ? next : undefined);
                  }}
                />
              ))}
              <p className={Math.abs(total - 1) > 0.001 ? 'warn small' : 'muted small'}>{t('allocation.sum', { pct: Math.round(total * 100) })}</p>
            </>
          )}
        </>
      )}
      {holdingsLink && (
        <Link to={holdingsLink} className="small">
          {t('allocation.holdingsLink', { count: holdingsCount })} ›
        </Link>
      )}
    </fieldset>
  );
}
