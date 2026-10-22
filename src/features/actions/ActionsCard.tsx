import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAdvice, useApp } from '../../app/context';
import { isCheckInDue } from '../../core/checkin';
import { ActiveActionRow, SuggestionCard } from './ActionParts';

/** 淨值頁上的「回顧提醒」與「下一步行動」 */
export function ActionsCard() {
  const { t } = useTranslation();
  const { data, checkIns, today } = useApp();
  const { board } = useAdvice();
  const due = isCheckInDue(data.settings, checkIns.at(-1)?.date, today);
  const top = board.canAcceptMore ? board.suggestions[0] : undefined;

  return (
    <>
      {due && (
        <Link to="/checkin" className="card next-step checkin-due">
          <p className="eyebrow">{t('checkin.dueTitle')}</p>
          <p>{t('checkin.dueBody')}</p>
          <span className="chevron" aria-hidden="true">›</span>
        </Link>
      )}

      <section className="card actions-card">
        <header className="section-head">
          <h2>{t('actions.cardTitle')}</h2>
          <Link to="/actions" className="small">
            {t('actions.all', { count: board.suggestions.length })} ›
          </Link>
        </header>
        {board.active.length > 0 && (
          <ul className="action-list">
            {board.active.map((a) => (
              <ActiveActionRow key={a.action.id} a={a} />
            ))}
          </ul>
        )}
        {top && <SuggestionCard s={top} canAccept compact />}
        {board.active.length === 0 && !top && <p className="muted">{t('actions.noSuggestions')}</p>}
      </section>
    </>
  );
}
