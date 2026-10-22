import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../analytics';
import { useApp } from '../../app/context';
import { EstimateInput } from '../../components/EstimateInput';
import { blankToUnknown } from '../../core/estimate';
import type { Asset, AssetCategory, Liability, LiabilityCategory, Liquidity, MoneyEstimate } from '../../model/types';
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

export function ItemEditor() {
  const { kind, id } = useParams();
  if (kind !== 'asset' && kind !== 'liability') return <Navigate to="/" replace />;
  return kind === 'asset' ? <AssetEditor id={id} /> : <LiabilityEditor id={id} />;
}

function useCommon() {
  const app = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return { ...app, navigate, t, hid: app.data.household.id };
}

function AssetEditor({ id }: { id?: string }) {
  const { data, pack, repo, navigate, t, hid } = useCommon();
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
    track({ name: 'item_saved', kind: 'asset', category: draft.category, mode: draft.value.estimate.mode, is_new: !existing });
    navigate('/');
  };

  const archive = async () => {
    if (!existing || !confirm(t('editor.confirmDelete'))) return;
    await repo.archiveAsset(existing.id);
    track({ name: 'item_archived', kind: 'asset', category: existing.category });
    navigate('/');
  };

  return (
    <EditorShell
      title={existing ? itemName(existing, 'asset', t) : t('netWorth.add.asset')}
      onSave={save}
      onDelete={existing ? archive : undefined}
    >
      <CategoryPicker kind="asset" value={draft.category} onChange={(c) => setCategory(c as AssetCategory)} />
      <LabelField value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))} />
      <MoneyField
        value={draft.value}
        onChange={(value) => setDraft((d) => ({ ...d, value }))}
        bracketsKey={ASSET_BRACKETS[draft.category] ?? 'generic_asset'}
      />
      <fieldset className="field">
        <legend>{t('editor.liquidity')}</legend>
        <div className="chips">
          {LIQUIDITIES.map((l) => (
            <button key={l} type="button" className={draft.liquidity === l ? 'chip active' : 'chip'} onClick={() => setDraft((d) => ({ ...d, liquidity: l }))}>
              {t(`liquidity.${l}`)}
            </button>
          ))}
        </div>
        <p className="muted small">{t(`liquidity.${draft.liquidity}Hint`)}</p>
      </fieldset>
      {draft.category === 'real_estate' && (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={!!draft.isPrimaryResidence}
            onChange={(e) => setDraft((d) => ({ ...d, isPrimaryResidence: e.target.checked }))}
          />
          <span>{t('editor.primaryResidence')}</span>
        </label>
      )}
      <NoteField value={draft.note} onChange={(note) => setDraft((d) => ({ ...d, note }))} />
      {draft.category === 'insurance_cash_value' && <p className="muted small">{t('editor.insuranceHint')}</p>}
      {draft.category === 'retirement' && <p className="muted small">{t('editor.retirementHint')}</p>}
    </EditorShell>
  );
}

function LiabilityEditor({ id }: { id?: string }) {
  const { data, pack, repo, navigate, t, hid } = useCommon();
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

  const setCategory = (category: LiabilityCategory) => {
    const def = pack.categories.liability.find((c) => c.key === category)!;
    setDraft((d) => ({
      ...d,
      category,
      secured: def.defaultSecured,
      securedByAssetId: def.defaultSecured ? d.securedByAssetId : undefined,
      isRevolving: category === 'credit_card' ? (d.isRevolving ?? true) : undefined,
    }));
  };

  const save = async () => {
    await repo.saveLiability(hid, { ...draft, balance: { ...draft.balance, estimate: blankToUnknown(draft.balance.estimate) }, id: existing?.id });
    track({ name: 'item_saved', kind: 'liability', category: draft.category, mode: draft.balance.estimate.mode, is_new: !existing });
    navigate('/');
  };

  const archive = async () => {
    if (!existing || !confirm(t('editor.confirmDelete'))) return;
    await repo.archiveLiability(existing.id);
    track({ name: 'item_archived', kind: 'liability', category: existing.category });
    navigate('/');
  };

  return (
    <EditorShell
      title={existing ? itemName(existing, 'liability', t) : t('netWorth.add.liability')}
      onSave={save}
      onDelete={existing ? archive : undefined}
    >
      <CategoryPicker kind="liability" value={draft.category} onChange={(c) => setCategory(c as LiabilityCategory)} />
      <LabelField value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))} />
      <MoneyField
        value={draft.balance}
        onChange={(balance) => setDraft((d) => ({ ...d, balance }))}
        bracketsKey={LIABILITY_BRACKETS[draft.category] ?? 'debt'}
        label={t('editor.balance')}
      />
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={draft.secured}
          onChange={(e) => setDraft((d) => ({ ...d, secured: e.target.checked, securedByAssetId: e.target.checked ? d.securedByAssetId : undefined }))}
        />
        <span>
          {t('editor.secured')}
          <small className="muted block">{t('editor.securedHint')}</small>
        </span>
      </label>
      {draft.secured && activeAssets.length > 0 && (
        <label className="field">
          <span>{t('editor.securedBy')}</span>
          <select
            value={draft.securedByAssetId ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, securedByAssetId: e.target.value || undefined }))}
          >
            <option value="">{t('editor.securedByNone')}</option>
            {activeAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {itemName(a, 'asset', t)}
              </option>
            ))}
          </select>
        </label>
      )}
      {draft.category === 'credit_card' && (
        <label className="toggle-row">
          <input type="checkbox" checked={!!draft.isRevolving} onChange={(e) => setDraft((d) => ({ ...d, isRevolving: e.target.checked }))} />
          <span>
            {t('editor.revolving')}
            <small className="muted block">{t('editor.revolvingHint')}</small>
          </span>
        </label>
      )}
      <NoteField value={draft.note} onChange={(note) => setDraft((d) => ({ ...d, note }))} />
    </EditorShell>
  );
}

function EditorShell({
  title,
  onSave,
  onDelete,
  children,
}: {
  title: string;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page editor">
      <header className="page-head">
        <button type="button" className="btn ghost small" onClick={() => navigate(-1)}>
          ‹ {t('common.back')}
        </button>
        <h1>{title}</h1>
      </header>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void run(onSave)();
        }}
      >
        {children}
        <div className="step-nav">
          {onDelete && (
            <button type="button" className="btn danger ghost" disabled={busy} onClick={() => void run(onDelete)()}>
              {t('common.delete')}
            </button>
          )}
          <button type="submit" className="btn primary" disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoryPicker({ kind, value, onChange }: { kind: 'asset' | 'liability'; value: string; onChange: (c: string) => void }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const defs = kind === 'asset' ? pack.categories.asset : pack.categories.liability;
  return (
    <fieldset className="field">
      <legend>{t('editor.category')}</legend>
      <div className="chips">
        {defs.map((d) => (
          <button key={d.key} type="button" className={value === d.key ? 'chip active' : 'chip'} onClick={() => onChange(d.key)}>
            <span aria-hidden="true">{d.icon}</span> {t(d.i18nKey)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function LabelField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const { t } = useTranslation();
  return (
    <label className="field">
      <span>{t('editor.label')}</span>
      <input value={value ?? ''} placeholder={t('editor.labelPlaceholder')} onChange={(e) => onChange(e.target.value || undefined)} />
    </label>
  );
}

function NoteField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const { t } = useTranslation();
  return (
    <label className="field">
      <span>{t('editor.note')}</span>
      <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    </label>
  );
}

function MoneyField({
  value,
  onChange,
  bracketsKey,
  label,
}: {
  value: MoneyEstimate;
  onChange: (m: MoneyEstimate) => void;
  bracketsKey: string;
  label?: string;
}) {
  const { t } = useTranslation();
  const { pack, today, data } = useApp();
  return (
    <fieldset className="field">
      <legend>{label ?? t('editor.value')}</legend>
      <EstimateInput
        value={value.estimate}
        onChange={(estimate) => onChange({ ...value, estimate })}
        pack={pack}
        today={today}
        defaultTolerance={data.settings.defaultTolerance}
        brackets={value.currency === pack.baseCurrency ? pack.brackets[bracketsKey] : undefined}
        currency={value.currency}
        onCurrencyChange={(currency) => onChange({ ...value, currency })}
      />
    </fieldset>
  );
}
