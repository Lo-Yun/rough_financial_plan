import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAdvice, useApp, useFormat } from '../../app/context';
import { ProgressBar, RangeValue } from '../../components/Display';
import { monthsToNextLevel, worryFreeSpending } from '../../core/ladder';
import { scenarioRates } from '../../core/planning';
import { SuggestionCard } from '../actions/ActionParts';

/** 財富階梯完整頁（規格 4.8） */
export function LadderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { overview, pack, assumptions } = useApp();
  const { board } = useAdvice();
  const fmt = useFormat(pack);
  const p = overview.ladder;
  const nw = overview.balanceSheet.netWorth;
  const rates = scenarioRates('balanced', assumptions);
  const surplus = overview.surplus?.mid ?? null;
  const months = monthsToNextLevel(p, nw.mid, surplus, rates.neutral);
  const worryFree = worryFreeSpending(nw.mid);
  const levels = [...pack.wealthLadder].reverse();

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="btn ghost small" onClick={() => navigate(-1)}>
          ‹ {t('common.back')}
        </button>
        <h1>{t('ladder.title')}</h1>
      </header>

      <section className="card hero">
        <p className="eyebrow">{t('ladder.youAreAt')}</p>
        <h2>
          <span className="level-badge">L{p.level}</span> {t(`ladder.level${p.level}.name`)}
        </h2>
        <RangeValue range={nw} pack={pack} />
        {p.spansLevels && <p className="muted small">{t('ladder.spans', { a: p.levelAtLow, b: p.levelAtHigh })}</p>}
        {p.nextLevelMin !== null && (
          <>
            <ProgressBar value={p.progress} label={t('ladder.progressLabel')} />
            <p className="small">
              {months === null
                ? t('ladder.eta.never')
                : months === 0
                  ? t('ladder.eta.reached')
                  : t('ladder.eta.months', { duration: fmt.duration(months), level: p.level + 1, amount: fmt.money(p.nextLevelMin) })}
            </p>
            <p className="muted small">{t('ladder.eta.assumption', { surplus: fmt.money(Math.max(0, surplus ?? 0)), rate: fmt.pct(rates.neutral) })}</p>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t('ladder.focusTitle')}</h2>
        <p>{t(`ladder.level${p.level}.desc`)}</p>
        {board.suggestions.slice(0, 2).map((s) => (
          <SuggestionCard key={s.template.id} s={s} canAccept={board.canAcceptMore} compact />
        ))}
      </section>

      {nw.mid > 0 && (
        <section className="card">
          <h2>{t('ladder.rule.title')}</h2>
          <p>{t('ladder.rule.body', { amount: fmt.money(worryFree) })}</p>
          <p className="muted small">{t('ladder.rule.explain')}</p>
        </section>
      )}

      <section className="card">
        <h2>{t('ladder.allLevels')}</h2>
        <ol className="ladder-list">
          {levels.map((def, i) => {
            const upper = i === 0 ? null : levels[i - 1]!.minNetWorth;
            const lower = Number.isFinite(def.minNetWorth) ? def.minNetWorth : null;
            return (
              <li key={def.level} className={def.level === p.level ? 'current' : ''}>
                <div className="ladder-row">
                  <span className="level-badge">L{def.level}</span>
                  <strong>{t(`${def.i18nKey}.name`)}</strong>
                  <span className="muted small">
                    {lower === null
                      ? t('ladder.below', { v: fmt.money(upper!) })
                      : upper === null
                        ? t('ladder.above', { v: fmt.money(lower) })
                        : `${fmt.money(lower)} ～ ${fmt.money(upper)}`}
                  </span>
                </div>
                {def.level === p.level && <p className="small">{t('ladder.here')}</p>}
              </li>
            );
          })}
        </ol>
        <p className="muted small">{t('ladder.source')}</p>
      </section>
    </div>
  );
}
