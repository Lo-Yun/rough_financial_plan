import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import type { CategoryDef } from '../model/localePack';
import type { MoneyEstimate } from '../model/types';
import { EstimateInput } from './EstimateInput';
import { Icon, isIconName } from './Icon';

// 各種編輯頁共用的表單元件

export function EditorShell({
  title,
  onSave,
  onDelete,
  children,
  saveDisabled,
}: {
  title: string;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  children: ReactNode;
  saveDisabled?: boolean;
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
          <button type="submit" className="btn primary" disabled={busy || saveDisabled}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** 單選標籤列 */
export function ChipPicker<K extends string>({
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  legend: string;
  options: { key: K; label: string; icon?: string }[];
  value: K | undefined;
  onChange: (k: K) => void;
  hint?: string;
}) {
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((o) => (
          <button key={o.key} type="button" aria-pressed={value === o.key} className={value === o.key ? 'chip active' : 'chip'} onClick={() => onChange(o.key)}>
            {isIconName(o.icon) && <Icon name={o.icon} size={16} />}
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="muted small">{hint}</p>}
    </fieldset>
  );
}

export function CategoryPicker<K extends string>({ defs, value, onChange }: { defs: CategoryDef<K>[]; value: K; onChange: (k: K) => void }) {
  const { t } = useTranslation();
  return (
    <ChipPicker
      legend={t('editor.category')}
      options={defs.map((d) => ({ key: d.key, label: t(d.i18nKey), icon: d.icon }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function LabelField({ value, onChange, placeholder }: { value?: string; onChange: (v: string | undefined) => void; placeholder?: string }) {
  const { t } = useTranslation();
  return (
    <label className="field">
      <span>{t('editor.label')}</span>
      <input value={value ?? ''} placeholder={placeholder ?? t('editor.labelPlaceholder')} onChange={(e) => onChange(e.target.value || undefined)} />
    </label>
  );
}

export function NoteField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const { t } = useTranslation();
  return (
    <label className="field">
      <span>{t('editor.note')}</span>
      <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small className="muted block">{hint}</small>}
      </span>
    </label>
  );
}

export function MoneyField({
  value,
  onChange,
  bracketsKey,
  label,
  hint,
}: {
  value: MoneyEstimate;
  onChange: (m: MoneyEstimate) => void;
  bracketsKey?: string;
  label: string;
  hint?: string;
}) {
  const { pack, today, data } = useApp();
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {hint && <p className="muted small">{hint}</p>}
      <EstimateInput
        value={value.estimate}
        onChange={(estimate) => onChange({ ...value, estimate })}
        pack={pack}
        today={today}
        defaultTolerance={data.settings.defaultTolerance}
        brackets={bracketsKey && value.currency === pack.baseCurrency ? pack.brackets[bracketsKey] : undefined}
        currency={value.currency}
        onCurrencyChange={(currency) => onChange({ ...value, currency })}
      />
    </fieldset>
  );
}

/**
 * 百分比輸入（例如利率 2.2），內部值為小數（0.022）。
 * 空白代表未填，交給呼叫端決定預設值。
 */
export function PercentField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  hint?: string;
}) {
  const toText = (v: number | undefined) => (v === undefined ? '' : String(Math.round(v * 10000) / 100));
  const [text, setText] = useState(toText(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? undefined : Number(text) / 100;
    if (parsed !== value) setText(toText(value));
  }, [value]);
  const invalid = text.trim() !== '' && !Number.isFinite(Number(text));
  return (
    <label className="field">
      <span>{label}</span>
      <div className="suffix-input">
        <input
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          aria-invalid={invalid}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            onChange(e.target.value.trim() === '' || !Number.isFinite(n) ? undefined : n / 100);
          }}
        />
        <span aria-hidden="true">%</span>
      </div>
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
