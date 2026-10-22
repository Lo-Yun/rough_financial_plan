import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useActionParams, useApp } from '../../app/context';
import type { ActiveAction, Suggestion } from '../../core/rules';
import type { UserAction } from '../../model/types';

/** 行動相關的資料庫操作 */
export function useActionCommands() {
  const { repo, data } = useApp();
  const hid = data.household.id;
  const now = () => new Date().toISOString();
  return {
    accept: (s: Suggestion) => repo.saveUserAction(hid, { templateId: s.template.id, params: s.params, status: 'active', acceptedAt: now() }),
    dismiss: (s: Suggestion, reason: NonNullable<UserAction['dismissReason']>) =>
      repo.saveUserAction(hid, {
        templateId: s.template.id,
        params: s.params,
        status: reason === 'already_done' ? 'done' : 'dismissed',
        dismissReason: reason,
        dismissedAt: now(),
        completedAt: reason === 'already_done' ? now() : undefined,
      }),
    complete: (a: UserAction) => repo.saveUserAction(hid, { ...strip(a), status: 'done', completedAt: now() }),
    /** 放棄進行中的行動，不再建議 */
    drop: (a: UserAction) => repo.saveUserAction(hid, { ...strip(a), status: 'dismissed', dismissReason: 'not_relevant', dismissedAt: now() }),
    /** 移除紀錄；若是範本行動，條件成立時會重新出現在建議中 */
    restore: (a: UserAction) => repo.archiveUserAction(a.id),
    addCustom: (title: string) => repo.saveUserAction(hid, { title, status: 'active', acceptedAt: now() }),
  };
}

function strip(a: UserAction) {
  const { householdId: _h, createdAt: _c, updatedAt: _u, ...rest } = a;
  return rest;
}

/** 行動的標題：範本行動用 i18n，自訂行動用使用者輸入的文字 */
export function useActionTitle() {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmtParams = useActionParams();
  return (a: UserAction) => {
    const tpl = a.templateId ? pack.actionTemplates.find((x) => x.id === a.templateId) : undefined;
    return tpl ? t(`${tpl.i18nKey}.title`, fmtParams(a.params)) : (a.title ?? '');
  };
}

export function SuggestionCard({ s, canAccept, compact }: { s: Suggestion; canAccept: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  const fmtParams = useActionParams();
  const cmd = useActionCommands();
  const [showWhy, setShowWhy] = useState(!compact);
  const p = fmtParams(s.params);
  const key = s.template.i18nKey;

  return (
    <div className={`suggestion cat-${s.template.category}`}>
      <p className="suggestion-title">{t(`${key}.title`, p)}</p>
      {showWhy ? (
        <>
          <p className="small">{t(`${key}.why`, p)}</p>
          <p className="small muted">{t(`${key}.how`, p)}</p>
        </>
      ) : (
        <button type="button" className="link-button small" onClick={() => setShowWhy(true)}>
          {t('actions.why')}
        </button>
      )}
      <div className="button-row">
        <button type="button" className="btn primary small" disabled={!canAccept} onClick={() => void cmd.accept(s)}>
          {t('actions.accept')}
        </button>
        <button type="button" className="btn ghost small" onClick={() => void cmd.dismiss(s, 'later')}>
          {t('actions.later')}
        </button>
        {!compact && (
          <>
            <button type="button" className="btn ghost small" onClick={() => void cmd.dismiss(s, 'already_done')}>
              {t('actions.alreadyDone')}
            </button>
            <button type="button" className="btn ghost small" onClick={() => void cmd.dismiss(s, 'not_relevant')}>
              {t('actions.notRelevant')}
            </button>
          </>
        )}
      </div>
      {!canAccept && <p className="muted small">{t('actions.full')}</p>}
    </div>
  );
}

export function ActiveActionRow({ a }: { a: ActiveAction }) {
  const { t } = useTranslation();
  const cmd = useActionCommands();
  const title = useActionTitle();
  const link = a.template?.link;
  return (
    <li className="active-action">
      <label className="toggle-row">
        <input type="checkbox" checked={false} onChange={() => void cmd.complete(a.action)} aria-label={t('actions.markDone')} />
        <span>
          {title(a.action)}
          {a.maybeDone && <small className="ok block">{t('actions.maybeDone')}</small>}
        </span>
      </label>
      {link && (
        <Link to={link} className="small">
          {t('actions.go')} ›
        </Link>
      )}
    </li>
  );
}
