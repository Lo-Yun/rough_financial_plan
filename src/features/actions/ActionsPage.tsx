import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdvice } from '../../app/context';
import { Icon } from '../../components/Icon';
import { MAX_ACTIVE } from '../../core/rules';
import { ActiveActionRow, SuggestionCard, useActionCommands, useActionTitle } from './ActionParts';

export function ActionsPage() {
  const { t } = useTranslation();
  const { board } = useAdvice();
  const cmd = useActionCommands();
  const title = useActionTitle();
  const [custom, setCustom] = useState('');

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('actions.title')}</h1>
      </header>
      <p className="muted small">{t('actions.explain', { max: MAX_ACTIVE })}</p>

      <section className="card">
        <h2>{t('actions.active', { count: board.active.length, max: MAX_ACTIVE })}</h2>
        {board.active.length === 0 && <p className="muted">{t('actions.noActive')}</p>}
        <ul className="action-list">
          {board.active.map((a) => (
            <ActiveActionRow key={a.action.id} a={a} />
          ))}
        </ul>
        {board.active.length > 0 && (
          <details className="small">
            <summary>{t('actions.dropTitle')}</summary>
            <ul className="action-list">
              {board.active.map((a) => (
                <li key={a.action.id} className="row-between">
                  <span>{title(a.action)}</span>
                  <button type="button" className="btn ghost small" onClick={() => void cmd.drop(a.action)}>
                    {t('actions.drop')}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <form
          className="custom-action"
          onSubmit={(e) => {
            e.preventDefault();
            if (!custom.trim() || !board.canAcceptMore) return;
            void cmd.addCustom(custom.trim());
            setCustom('');
          }}
        >
          <input value={custom} placeholder={t('actions.customPlaceholder')} onChange={(e) => setCustom(e.target.value)} />
          <button type="submit" className="btn ghost small" disabled={!custom.trim() || !board.canAcceptMore}>
            {t('actions.addCustom')}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>{t('actions.suggested')}</h2>
        {board.suggestions.length === 0 && <p className="muted">{t('actions.noSuggestions')}</p>}
        {board.suggestions.map((s) => (
          <SuggestionCard key={s.template.id} s={s} canAccept={board.canAcceptMore} />
        ))}
      </section>

      {board.done.length > 0 && (
        <section className="card">
          <h2>{t('actions.done', { count: board.done.length })}</h2>
          <ul className="action-list">
            {board.done.map((a) => (
              <li key={a.id} className="row-between">
                <span>
                  <Icon name="check" size={16} /> {title(a)}
                  <small className="muted block">{a.completedAt?.slice(0, 10)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {board.dismissed.length > 0 && (
        <section className="card">
          <h2>{t('actions.dismissed')}</h2>
          <ul className="action-list">
            {board.dismissed.map((a) => (
              <li key={a.id} className="row-between">
                <span>
                  {title(a)}
                  <small className="muted block">{t(`actions.reason.${a.dismissReason ?? 'not_relevant'}`)}</small>
                </span>
                <button type="button" className="btn ghost small" onClick={() => void cmd.restore(a)}>
                  {t('actions.restore')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="disclaimer">{t('actions.disclaimer')}</p>
    </div>
  );
}
