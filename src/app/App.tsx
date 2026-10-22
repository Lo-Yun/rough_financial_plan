import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { todayISO } from '../core/date';
import { computeOverview } from '../core/overview';
import { resolveAssumptions } from '../core/planning';
import { AppDB } from '../data/db';
import { Repo } from '../data/repo';
import { ItemEditor } from '../features/balance-sheet/ItemEditor';
import { NetWorthPage } from '../features/balance-sheet/NetWorthPage';
import { Onboarding } from '../features/onboarding/Onboarding';
import { defaultPack, getPack } from '../locales';
import { AppContext, type AppState } from './context';
import { loadFinancialData } from './load';

// 淨值頁與資產編輯以外的頁面都延遲載入，縮小首次載入的程式大小
const HistoryPage = lazy(() => import('../features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const CashflowPage = lazy(() => import('../features/cashflow/CashflowPage').then((m) => ({ default: m.CashflowPage })));
const FlowEditor = lazy(() => import('../features/cashflow/FlowEditor').then((m) => ({ default: m.FlowEditor })));
const HealthPage = lazy(() => import('../features/health/HealthPage').then((m) => ({ default: m.HealthPage })));
const PlansPage = lazy(() => import('../features/plans/PlansPage').then((m) => ({ default: m.PlansPage })));
const GoalEditor = lazy(() => import('../features/plans/GoalEditor').then((m) => ({ default: m.GoalEditor })));
const PortfolioPage = lazy(() => import('../features/portfolio/PortfolioPage').then((m) => ({ default: m.PortfolioPage })));
const HoldingsPage = lazy(() => import('../features/portfolio/HoldingsPage').then((m) => ({ default: m.HoldingsPage })));
const HoldingEditor = lazy(() => import('../features/portfolio/HoldingEditor').then((m) => ({ default: m.HoldingEditor })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ActionsPage = lazy(() => import('../features/actions/ActionsPage').then((m) => ({ default: m.ActionsPage })));
const LadderPage = lazy(() => import('../features/ladder/LadderPage').then((m) => ({ default: m.LadderPage })));
const CheckInPage = lazy(() => import('../features/checkin/CheckInPage').then((m) => ({ default: m.CheckInPage })));

const repo = new Repo(new AppDB());

export function App() {
  const { t } = useTranslation();
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const loaded = useLiveQuery(
    () => (householdId ? loadFinancialData(repo, householdId) : undefined),
    [householdId],
  );

  // 第一次開啟，或刪除全部資料後，建立新的家庭
  useEffect(() => {
    if (householdId === null || (loaded && !loaded.data)) {
      void repo.ensureHousehold(defaultPack).then((h) => setHouseholdId(h.id));
    }
  }, [householdId, loaded]);

  const data = loaded?.data ?? null;
  const pack = getPack(data?.household.localeCode);
  const today = todayISO();
  const overview = useMemo(() => (data ? computeOverview(data, pack, today) : null), [data, pack, today]);
  const assumptions = useMemo(() => resolveAssumptions(loaded?.assumptions, pack), [loaded?.assumptions, pack]);

  if (!data || !overview || !loaded) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  const state: AppState = {
    repo,
    pack,
    data,
    snapshots: loaded.snapshots,
    overview,
    today,
    goals: loaded.goals,
    assumptions,
    storedAssumptions: loaded.assumptions,
    holdings: loaded.holdings,
    primaryMember: loaded.primaryMember,
    userActions: loaded.userActions,
    checkIns: loaded.checkIns,
  };

  return (
    <AppContext.Provider value={state}>
      {data.settings.onboardingCompletedAt ? (
        <HashRouter>
          <div className="app-shell">
            <main className="app-main">
              <Suspense fallback={<div className="loading">{t('common.loading')}</div>}>
              <Routes>
                <Route path="/" element={<NetWorthPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/actions" element={<ActionsPage />} />
                <Route path="/ladder" element={<LadderPage />} />
                <Route path="/checkin" element={<CheckInPage />} />
                <Route path="/cashflow" element={<CashflowPage />} />
                <Route path="/health" element={<HealthPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/asset/:id/holdings" element={<HoldingsPage />} />
                <Route path="/asset/:id/holdings/new" element={<HoldingEditor />} />
                <Route path="/asset/:id/holdings/:holdingId" element={<HoldingEditor />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/plans/new" element={<GoalEditor />} />
                <Route path="/plans/:id" element={<GoalEditor />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/asset/new" element={<ItemEditor kind="asset" />} />
                <Route path="/asset/:id" element={<ItemEditor kind="asset" />} />
                <Route path="/liability/new" element={<ItemEditor kind="liability" />} />
                <Route path="/liability/:id" element={<ItemEditor kind="liability" />} />
                <Route path="/income/new" element={<FlowEditor kind="income" />} />
                <Route path="/income/:id" element={<FlowEditor kind="income" />} />
                <Route path="/expense/new" element={<FlowEditor kind="expense" />} />
                <Route path="/expense/:id" element={<FlowEditor kind="expense" />} />
                <Route path="*" element={<NetWorthPage />} />
              </Routes>
              </Suspense>
            </main>
            <nav className="tab-bar" aria-label={t('nav.label')}>
              <NavLink to="/" end>
                <span aria-hidden="true">◎</span>
                {t('nav.netWorth')}
              </NavLink>
              <NavLink to="/cashflow">
                <span aria-hidden="true">⇅</span>
                {t('nav.cashflow')}
              </NavLink>
              <NavLink to="/portfolio">
                <span aria-hidden="true">▣</span>
                {t('nav.portfolio')}
              </NavLink>
              <NavLink to="/health">
                <span aria-hidden="true">♡</span>
                {t('nav.health')}
              </NavLink>
              <NavLink to="/plans">
                <span aria-hidden="true">⚑</span>
                {t('nav.plans')}
              </NavLink>
              <NavLink to="/settings">
                <span aria-hidden="true">⚙</span>
                {t('nav.settings')}
              </NavLink>
            </nav>
          </div>
        </HashRouter>
      ) : (
        <Onboarding />
      )}
    </AppContext.Provider>
  );
}
