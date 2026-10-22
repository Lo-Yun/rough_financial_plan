import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { syncAssetFromHoldings } from '../../app/actions';
import { useApp, useFormat } from '../../app/context';
import { Toggle } from '../../components/EditorParts';
import { moneyContext } from '../../core/overview';
import { holdingsTotal, holdingValue } from '../../core/portfolio';
import { itemName } from '../balance-sheet/NetWorthPage';

export function HoldingsPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, pack, holdings, repo } = useApp();
  const fmt = useFormat(pack);
  const asset = data.assets.find((a) => a.id === id && !a.archivedAt);
  if (!asset) return <Navigate to="/portfolio" replace />;

  const ctx = moneyContext(data, pack);
  const own = holdings.filter((h) => h.assetId === asset.id);
  const total = holdingsTotal(own, ctx);
  const hid = data.household.id;

  const setFromHoldings = async (on: boolean) => {
    const { id: assetId, householdId: _h, createdAt: _c, updatedAt: _u, ...rest } = asset;
    await repo.saveAsset(hid, { ...rest, id: assetId, valueFromHoldings: on });
    if (on) await syncAssetFromHoldings(repo, pack, hid, assetId);
  };

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="btn ghost small" onClick={() => navigate(-1)}>
          ‹ {t('common.back')}
        </button>
        <h1>{t('holdings.title', { name: itemName(asset, 'asset', t) })}</h1>
      </header>

      <section className="card">
        <p className="muted small">{t('holdings.explain')}</p>
        {own.length > 0 && (
          <>
            <dl className="flow-summary">
              <div>
                <dt>{t('holdings.total')}</dt>
                <dd>{fmt.range(total.total)}</dd>
              </div>
            </dl>
            <Toggle checked={!!asset.valueFromHoldings} onChange={(on) => void setFromHoldings(on)} label={t('holdings.useTotal')} hint={t('holdings.useTotalHint')} />
          </>
        )}
      </section>

      <section className="card items">
        {own.length === 0 && <p className="muted">{t('holdings.empty')}</p>}
        <ul className="item-list">
          {own.map((h) => {
            const v = holdingValue(h, ctx);
            return (
              <li key={h.id}>
                <Link to={`/asset/${asset.id}/holdings/${h.id}`}>
                  <span className="name">
                    {h.name}
                    {h.symbol && <span className="muted"> {h.symbol}</span>}
                    <span className="mode-badge">
                      {t(`portfolio.class.${h.assetClass}`)}
                      {h.quantity !== undefined && h.price && ` · ${t('holdings.qtyPrice', { q: h.quantity.toLocaleString(), p: h.price.value.toLocaleString(), c: h.price.currency, date: h.price.asOf })}`}
                    </span>
                  </span>
                  <span className="amount">{v ? fmt.money(v.mid) : '？'}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link to={`/asset/${asset.id}/holdings/new`} className="btn ghost add">
          + {t('holdings.add')}
        </Link>
      </section>

      <p className="disclaimer">{t('holdings.priceNote')}</p>
    </div>
  );
}
