import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp, useFormat } from '../../app/context';
import { ProgressBar } from '../../components/Display';

/**
 * 財富階梯（Maggiulli）位置摘要。
 * 快速估算的結果頁不在路由內，不能用 Link，所以連結要由呼叫端開啟。
 */
export function LadderSummary({ showLink = false }: { showLink?: boolean }) {
  const { t } = useTranslation();
  const { overview, pack } = useApp();
  const fmt = useFormat(pack);
  const p = overview.ladder;
  const def = pack.wealthLadder.find((d) => d.level === p.level)!;

  return (
    <section className="card ladder">
      <p className="eyebrow">{t('ladder.title')}</p>
      <h3>
        <span className="level-badge">L{p.level}</span> {t(`${def.i18nKey}.name`)}
      </h3>
      <p>{t(`${def.i18nKey}.desc`)}</p>
      {p.isNegative && <p className="warn">{t('ladder.negative')}</p>}
      {p.spansLevels && <p className="muted small">{t('ladder.spans', { a: p.levelAtLow, b: p.levelAtHigh })}</p>}
      {p.nextLevelMin !== null && (
        <>
          <ProgressBar value={p.progress} label={t('ladder.progressLabel')} />
          <p className="muted small">
            {t('ladder.next', { level: p.level + 1, amount: fmt.money(p.nextLevelMin) })}
          </p>
        </>
      )}
      {showLink && (
        <Link to="/ladder" className="small">
          {t('ladder.detailLink')} ›
        </Link>
      )}
    </section>
  );
}
