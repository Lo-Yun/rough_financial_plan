import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { syncAssetFromHoldings } from '../../app/actions';
import { useApp } from '../../app/context';
import { AmountField } from '../../components/AmountField';
import { ChipPicker, EditorShell, MoneyField } from '../../components/EditorParts';
import { blankToUnknown } from '../../core/estimate';
import { ASSET_CLASSES } from '../../core/portfolio';
import type { Holding } from '../../model/types';

type Draft = Omit<Holding, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>;

export function HoldingEditor() {
  const { id: assetId, holdingId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, pack, holdings, repo, today } = useApp();
  const asset = data.assets.find((a) => a.id === assetId && !a.archivedAt);
  const existing = holdingId ? holdings.find((h) => h.id === holdingId) : undefined;
  const [draft, setDraft] = useState<Draft>(
    () =>
      existing ?? {
        assetId: assetId!,
        name: '',
        assetClass: asset?.category === 'crypto' ? 'crypto' : 'equity_domestic',
        quantity: undefined,
        price: { value: 0, currency: asset?.value.currency ?? pack.baseCurrency, asOf: today },
      },
  );
  const [mode, setMode] = useState<'priced' | 'value'>(existing?.marketValue && existing.quantity === undefined ? 'value' : 'priced');
  if (!asset || (holdingId && !existing)) return <Navigate to="/portfolio" replace />;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const back = `/asset/${asset.id}/holdings`;
  const hid = data.household.id;
  const priceValid = mode === 'value' || ((draft.quantity ?? 0) > 0 && (draft.price?.value ?? 0) > 0);

  const save = async () => {
    const row: Draft =
      mode === 'priced'
        ? { ...draft, marketValue: undefined }
        : {
            ...draft,
            quantity: undefined,
            price: undefined,
            marketValue: draft.marketValue && { ...draft.marketValue, estimate: blankToUnknown(draft.marketValue.estimate) },
          };
    await repo.saveHolding(hid, { ...row, name: row.name.trim() || row.symbol || t('holdings.unnamed'), id: existing?.id });
    await syncAssetFromHoldings(repo, pack, hid, asset.id);
    navigate(back);
  };

  const archive = async () => {
    if (!existing || !confirm(t('editor.confirmDelete'))) return;
    await repo.archiveHolding(existing.id);
    await syncAssetFromHoldings(repo, pack, hid, asset.id);
    navigate(back);
  };

  return (
    <EditorShell title={existing ? existing.name : t('holdings.add')} onSave={save} onDelete={existing ? archive : undefined} saveDisabled={!priceValid}>
      <label className="field">
        <span>{t('holdings.name')}</span>
        <input value={draft.name} placeholder={t('holdings.namePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('holdings.symbol')}</span>
        <input value={draft.symbol ?? ''} placeholder="0050" onChange={(e) => set({ symbol: e.target.value || undefined })} />
      </label>
      <ChipPicker
        legend={t('holdings.class')}
        options={ASSET_CLASSES.map((c) => ({ key: c, label: t(`portfolio.class.${c}`) }))}
        value={draft.assetClass}
        onChange={(assetClass) => set({ assetClass })}
        hint={t('holdings.classHint')}
      />
      <ChipPicker
        legend={t('holdings.valueMode')}
        options={[
          { key: 'priced' as const, label: t('holdings.mode.priced') },
          { key: 'value' as const, label: t('holdings.mode.value') },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          if (m === 'value' && !draft.marketValue) set({ marketValue: { estimate: { mode: 'approx', value: 0 }, currency: asset.value.currency } });
          if (m === 'priced' && !draft.price) set({ price: { value: 0, currency: asset.value.currency, asOf: today } });
        }}
      />
      {mode === 'priced' && draft.price ? (
        <>
          <label className="field">
            <span>{t('holdings.quantity')}</span>
            <input
              inputMode="decimal"
              value={draft.quantity ?? ''}
              onChange={(e) => set({ quantity: e.target.value === '' || !Number.isFinite(Number(e.target.value)) ? undefined : Number(e.target.value) })}
            />
          </label>
          <AmountField
            pack={pack}
            label={t('holdings.price')}
            value={draft.price.value || undefined}
            onChange={(v) => set({ price: { ...draft.price!, value: v ?? 0, asOf: today } })}
            placeholder={t('holdings.pricePlaceholder')}
          />
          <label className="inline-field">
            <span>{t('estimate.currency')}</span>
            <select value={draft.price.currency} onChange={(e) => set({ price: { ...draft.price!, currency: e.target.value } })}>
              {pack.commonCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">{t('holdings.priceDate', { date: draft.price.asOf })}</p>
        </>
      ) : (
        draft.marketValue && <MoneyField label={t('holdings.marketValue')} value={draft.marketValue} onChange={(marketValue) => set({ marketValue })} />
      )}
    </EditorShell>
  );
}
