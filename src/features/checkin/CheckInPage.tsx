import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { recordSnapshot } from '../../app/actions';
import { useAdvice, useApp, useFormat } from '../../app/context';
import { ProgressBar } from '../../components/Display';
import { EstimateInput } from '../../components/EstimateInput';
import { Icon } from '../../components/Icon';
import { compareSnapshots, nextCheckInDate, pickReviewItems, type ReviewItem, type SnapshotDiff } from '../../core/checkin';
import { blankToUnknown } from '../../core/estimate';
import type { Asset, CheckIn, Estimate, ID, Liability } from '../../model/types';
import { useActionCommands, useActionTitle } from '../actions/ActionParts';
import { itemName } from '../balance-sheet/NetWorthPage';

const STEPS = ['change', 'review', 'actions', 'feel'] as const;
type Step = (typeof STEPS)[number] | 'done';
const MOODS = [1, 2, 3, 4, 5] as const;

/** 定期回顧（規格 4.10）：目標 1 分鐘內完成 */
export function CheckInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const app = useApp();
  const { repo, pack, data, overview, snapshots, checkIns, today } = app;
  const [step, setStep] = useState<Step>('change');
  const [majorChange, setMajorChange] = useState<boolean | null>(null);
  const [touched, setTouched] = useState<Record<ID, 'same' | 'updated'>>({});
  const [completed, setCompleted] = useState<{ id: ID; title: string }[]>([]);
  const [mood, setMood] = useState<CheckIn['mood']>();
  const [note, setNote] = useState('');
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  // 回顧開始時決定要確認哪些項目，避免更新後清單跳動
  const [items] = useState<ReviewItem[]>(() =>
    pickReviewItems(overview.balanceSheet, { today, staleAfterDays: data.settings.staleAfterDays }),
  );
  const hid = data.household.id;
  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  const finish = async () => {
    setSaving(true);
    try {
      const prev = [...snapshots].reverse().find((s) => s.date < today);
      const snap = await recordSnapshot(repo, pack, hid, 'check_in');
      await repo.saveCheckIn(hid, {
        date: today,
        hadMajorChange: !!majorChange,
        updatedItemIds: Object.entries(touched).filter(([, v]) => v === 'updated').map(([k]) => k),
        completedActionIds: completed.map((c) => c.id),
        snapshotId: snap?.id,
        mood,
        note: note.trim() || undefined,
      });
      await repo.updateSettings(hid, { nextCheckInDate: nextCheckInDate(today, data.settings.checkInFrequency === 'off' ? 'monthly' : data.settings.checkInFrequency) });
      setDiff(snap ? compareSnapshots(prev, snap) : null);
      setDoneCount(checkIns.length + 1);
      setStep('done');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'done') return <DoneView diff={diff} count={doneCount} onHome={() => navigate('/')} />;

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="btn ghost small" onClick={() => navigate(-1)}>
          ‹ {t('common.back')}
        </button>
        <h1>{t('checkin.title')}</h1>
      </header>
      <ProgressBar value={(stepIndex + 1) / STEPS.length} label={t('checkin.progress', { n: stepIndex + 1, total: STEPS.length })} />

      {step === 'change' && (
        <section className="card">
          <h2>{t('checkin.change.title')}</h2>
          <p className="muted small">{t('checkin.change.hint')}</p>
          <div className="chips">
            <button type="button" aria-pressed={majorChange === false} className={majorChange === false ? 'chip active' : 'chip'} onClick={() => setMajorChange(false)}>
              {t('checkin.change.no')}
            </button>
            <button type="button" aria-pressed={majorChange === true} className={majorChange === true ? 'chip active' : 'chip'} onClick={() => setMajorChange(true)}>
              {t('checkin.change.yes')}
            </button>
          </div>
          {majorChange && (
            <ul className="bullets small">
              <li>
                <Link to="/cashflow">{t('checkin.change.cashflow')}</Link>
              </li>
              <li>
                <Link to="/asset/new">{t('checkin.change.asset')}</Link>
              </li>
              <li>
                <Link to="/liability/new">{t('checkin.change.liability')}</Link>
              </li>
            </ul>
          )}
        </section>
      )}

      {step === 'review' && (
        <section className="card">
          <h2>{t('checkin.review.title')}</h2>
          <p className="muted small">{t('checkin.review.hint')}</p>
          {items.length === 0 && <p className="muted">{t('checkin.review.none')}</p>}
          <ul className="review-list">
            {items.map((it) => (
              <ReviewRow key={it.id} item={it} status={touched[it.id]} onDone={(s) => setTouched((x) => ({ ...x, [it.id]: s }))} />
            ))}
          </ul>
        </section>
      )}

      {step === 'actions' && <ActionsStep completed={completed} onComplete={(c) => setCompleted((x) => [...x, c])} />}

      {step === 'feel' && (
        <section className="card">
          <h2>{t('checkin.feel.title')}</h2>
          <div className="chips">
            {MOODS.map((m) => (
              <button key={m} type="button" aria-pressed={mood === m} className={mood === m ? 'chip active' : 'chip'} onClick={() => setMood(mood === m ? undefined : m)}>
                {t(`checkin.feel.mood${m}`)}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('checkin.feel.note')}</span>
            <textarea rows={2} value={note} placeholder={t('checkin.feel.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="muted small">{t('checkin.feel.optional')}</p>
        </section>
      )}

      <div className="step-nav">
        {stepIndex > 0 && (
          <button type="button" className="btn ghost" disabled={saving} onClick={() => setStep(STEPS[stepIndex - 1]!)}>
            {t('common.back')}
          </button>
        )}
        {step === 'feel' ? (
          <button type="button" className="btn primary" disabled={saving} onClick={() => void finish()}>
            {saving ? t('common.saving') : t('checkin.finish')}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => setStep(STEPS[stepIndex + 1]!)}>
            {t('common.next')}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ item, status, onDone }: { item: ReviewItem; status?: 'same' | 'updated'; onDone: (s: 'same' | 'updated') => void }) {
  const { t } = useTranslation();
  const { data, pack, repo, today, overview } = useApp();
  const fmt = useFormat(pack);
  const [editing, setEditing] = useState(false);
  const source: Asset | Liability | undefined =
    item.kind === 'asset' ? data.assets.find((a) => a.id === item.id) : data.liabilities.find((l) => l.id === item.id);
  const money = source ? ('value' in source ? source.value : source.balance) : undefined;
  const [estimate, setEstimate] = useState<Estimate>(() => money?.estimate ?? { mode: 'unknown' });
  if (!source || !money) return null;

  const resolved = [...overview.balanceSheet.assets, ...overview.balanceSheet.liabilities].find((r) => r.item.id === item.id)?.range;
  const hid = data.household.id;
  const { householdId: _h, createdAt: _c, updatedAt: _u, ...rest } = source;

  const save = async (e: Estimate) => {
    const next = { ...money, estimate: blankToUnknown(e) };
    if (item.kind === 'asset') await repo.saveAsset(hid, { ...(rest as Omit<Asset, 'householdId' | 'createdAt' | 'updatedAt'>), value: next });
    else await repo.saveLiability(hid, { ...(rest as Omit<Liability, 'householdId' | 'createdAt' | 'updatedAt'>), balance: next });
  };

  const same = async () => {
    // 精確數字確認沒變，就把日期更新為今天，不再算「過期」
    if (money.estimate.mode === 'exact') await save({ ...money.estimate, asOf: today });
    onDone('same');
  };

  return (
    <li className="review-row">
      <div className="row-between">
        <span>
          {itemName(source, item.kind, t)}
          <small className="muted block">{t(`checkin.review.reason.${item.reason}`)}</small>
        </span>
        <span className="amount">{resolved ? fmt.money(resolved.mid) : '？'}</span>
      </div>
      {status ? (
        <p className="ok small">{t(`checkin.review.${status}`)}</p>
      ) : editing ? (
        <>
          <EstimateInput value={estimate} onChange={setEstimate} pack={pack} today={today} defaultTolerance={data.settings.defaultTolerance} />
          <div className="button-row">
            <button
              type="button"
              className="btn primary small"
              onClick={async () => {
                await save(estimate);
                setEditing(false);
                onDone('updated');
              }}
            >
              {t('common.save')}
            </button>
          </div>
        </>
      ) : (
        <div className="button-row">
          <button type="button" className="btn ghost small" onClick={() => void same()}>
            {t('checkin.review.same')}
          </button>
          <button type="button" className="btn ghost small" onClick={() => setEditing(true)}>
            {t('checkin.review.update')}
          </button>
        </div>
      )}
    </li>
  );
}

function ActionsStep({ completed, onComplete }: { completed: { id: ID; title: string }[]; onComplete: (c: { id: ID; title: string }) => void }) {
  const { t } = useTranslation();
  const { board } = useAdvice();
  const cmd = useActionCommands();
  const title = useActionTitle();
  return (
    <section className="card">
      <h2>{t('checkin.actions.title')}</h2>
      {board.active.length === 0 && completed.length === 0 && <p className="muted">{t('checkin.actions.none')}</p>}
      <ul className="action-list">
        {completed.map((c) => (
          <li key={c.id} className="ok">
            <Icon name="check" size={16} /> {c.title}
          </li>
        ))}
        {board.active.map((a) => (
          <li key={a.action.id}>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={false}
                onChange={async () => {
                  const name = title(a.action);
                  await cmd.complete(a.action);
                  onComplete({ id: a.action.id, title: name });
                }}
              />
              <span>
                {title(a.action)}
                {a.maybeDone && <small className="ok block">{t('actions.maybeDone')}</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DoneView({ diff, count, onHome }: { diff: SnapshotDiff | null; count: number; onHome: () => void }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmt = useFormat(pack);
  return (
    <div className="page">
      <section className="card hero">
        <h1>{t('checkin.done.title')}</h1>
        <p>{t('checkin.done.count', { count })}</p>
        {diff ? (
          <dl className="flow-summary">
            <div>
              <dt>{t('checkin.done.netWorth', { days: diff.days })}</dt>
              <dd className={diff.netWorthChange >= 0 ? 'ok' : 'warn'}>
                {diff.netWorthChange >= 0 ? '+' : '−'}
                {fmt.money(Math.abs(diff.netWorthChange))}
              </dd>
            </div>
            <div>
              <dt>{t('checkin.done.precision')}</dt>
              <dd>
                {diff.precisionChange >= 0 ? '+' : '−'}
                {Math.abs(Math.round(diff.precisionChange * 100))}%
              </dd>
            </div>
            {diff.levelChange > 0 && <p className="ok">{t('checkin.done.levelUp')}</p>}
          </dl>
        ) : (
          <p className="muted small">{t('checkin.done.first')}</p>
        )}
        <p className="muted small">{t('checkin.done.next')}</p>
        <button type="button" className="btn primary" onClick={onHome}>
          {t('checkin.done.home')}
        </button>
      </section>
    </div>
  );
}
