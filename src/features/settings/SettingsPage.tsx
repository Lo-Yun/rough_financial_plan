import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configureAnalytics, track } from '../../analytics';
import { useApp } from '../../app/context';
import { isIOS, isStandalone, useInstallPrompt } from '../../app/pwa';
import { BackupError, buildExport, inspectExport, parseExport } from '../../data/backup';
import type { FxRate } from '../../model/types';

const TOLERANCES = [0.1, 0.15, 0.2, 0.3];
const STALE_DAYS = [90, 180, 365];

export function SettingsPage() {
  const { t } = useTranslation();
  const { data, pack, repo } = useApp();
  const s = data.settings;
  const hid = data.household.id;
  const update = (patch: Parameters<typeof repo.updateSettings>[1]) => repo.updateSettings(hid, patch);

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('settings.title')}</h1>
      </header>

      <FxSection />

      <section className="card">
        <h2>{t('settings.estimates.title')}</h2>
        <fieldset className="field">
          <legend>{t('settings.estimates.tolerance')}</legend>
          <div className="chips">
            {TOLERANCES.map((v) => (
              <button key={v} type="button" className={s.defaultTolerance === v ? 'chip active' : 'chip'} onClick={() => void update({ defaultTolerance: v })}>
                ±{Math.round(v * 100)}%
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>{t('settings.estimates.stale')}</legend>
          <div className="chips">
            {STALE_DAYS.map((v) => (
              <button key={v} type="button" className={s.staleAfterDays === v ? 'chip active' : 'chip'} onClick={() => void update({ staleAfterDays: v })}>
                {t('settings.estimates.days', { count: v })}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <BackupSection />

      <section className="card">
        <h2>{t('settings.analytics.title')}</h2>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={s.analyticsEnabled}
            onChange={async (e) => {
              const enabled = e.target.checked;
              await update({ analyticsEnabled: enabled });
              configureAnalytics({ enabled });
              if (enabled) track({ name: 'analytics_enabled' });
            }}
          />
          <span>{t('settings.analytics.label')}</span>
        </label>
        <p className="muted small">{t('settings.analytics.detail')}</p>
      </section>

      <InstallSection />

      <section className="card">
        <h2>{t('settings.danger.title')}</h2>
        <button
          type="button"
          className="btn danger"
          onClick={async () => {
            if (!confirm(t('settings.danger.confirm1'))) return;
            if (prompt(t('settings.danger.confirm2')) !== t('settings.danger.keyword')) return;
            await repo.deleteAll();
          }}
        >
          {t('settings.danger.deleteAll')}
        </button>
      </section>

      <section className="card about">
        <h2>{t('settings.about.title')}</h2>
        <p className="muted small">{t('settings.about.version', { version: __APP_VERSION__, pack: pack.version })}</p>
        <p className="muted small">{t('settings.about.stats')}</p>
        <p className="disclaimer">{t('common.disclaimer')}</p>
      </section>
    </div>
  );
}

function FxSection() {
  const { t } = useTranslation();
  const { data, pack, repo, today } = useApp();
  const rates = data.settings.fxRates;
  const used = new Set(
    [...data.assets.map((a) => a.value.currency), ...data.liabilities.map((l) => l.balance.currency)].filter(
      (c) => c !== data.household.baseCurrency,
    ),
  );
  const currencies = pack.commonCurrencies.filter((c) => c !== data.household.baseCurrency);

  const setRate = (currency: string, value: string) => {
    const n = Number(value);
    const others = rates.filter((r) => r.currency !== currency);
    const next: FxRate[] = n > 0 ? [...others, { currency, rateToBase: n, asOf: today }] : others;
    void repo.updateSettings(data.household.id, { fxRates: next });
  };

  return (
    <section className="card">
      <h2>{t('settings.fx.title')}</h2>
      <p className="muted small">{t('settings.fx.hint', { base: data.household.baseCurrency })}</p>
      <div className="fx-grid">
        {currencies.map((c) => {
          const r = rates.find((x) => x.currency === c);
          return (
            <label key={c} className={used.has(c) && !r ? 'fx-row missing' : 'fx-row'}>
              <span className="code">{c}</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder={used.has(c) ? t('settings.fx.required') : '—'}
                defaultValue={r?.rateToBase ?? ''}
                onBlur={(e) => setRate(c, e.target.value)}
              />
              <small className="muted">{r ? t('settings.fx.asOf', { date: r.asOf }) : ''}</small>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function BackupSection() {
  const { t } = useTranslation();
  const { data, repo } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const doExport = async () => {
    const text = await buildExport(await repo.exportAll(), { appVersion: __APP_VERSION__, password: password || undefined });
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rough-financial-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await repo.updateSettings(data.household.id, { lastBackupAt: new Date().toISOString() });
    track({ name: 'backup_exported', encrypted: !!password });
    setMessage({ kind: 'ok', text: t('backup.exported') });
  };

  const doImport = async (file: File) => {
    setMessage(null);
    try {
      const text = await file.text();
      const header = inspectExport(text);
      const pw = header.encrypted ? (prompt(t('backup.askPassword')) ?? '') : undefined;
      const payload = await parseExport(text, pw);
      if (!confirm(t('backup.confirmImport'))) return;
      await repo.importAll(payload);
      track({ name: 'backup_imported' });
      setMessage({ kind: 'ok', text: t('backup.imported') });
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'invalid_format';
      setMessage({ kind: 'error', text: t(`backup.error.${code}`) });
    }
  };

  return (
    <section className="card">
      <h2>{t('backup.title')}</h2>
      <p className="muted small">{t('backup.explain')}</p>
      <p className="small">
        {data.settings.lastBackupAt
          ? t('backup.last', { date: data.settings.lastBackupAt.slice(0, 10) })
          : t('backup.never')}
      </p>
      <label className="field">
        <span>{t('backup.password')}</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <small className="muted">{t('backup.passwordHint')}</small>
      </label>
      <div className="button-row">
        <button type="button" className="btn primary" onClick={() => void doExport()}>
          {t('backup.export')}
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          {t('backup.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void doImport(f);
          }}
        />
      </div>
      {message && <p className={message.kind === 'error' ? 'warn small' : 'ok small'}>{message.text}</p>}
    </section>
  );
}

function InstallSection() {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  if (isStandalone()) return null;
  return (
    <section className="card">
      <h2>{t('pwa.title')}</h2>
      <p className="muted small">{t('pwa.why')}</p>
      {install.canPrompt ? (
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            const outcome = await install.prompt();
            if (outcome) track({ name: 'install_prompt', outcome });
          }}
        >
          {t('pwa.install')}
        </button>
      ) : (
        <p className="small">{isIOS() ? t('pwa.iosInstall') : t('pwa.manual')}</p>
      )}
    </section>
  );
}
