import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { todayISO } from '../core/date';
import { computeOverview } from '../core/overview';
import { AppDB } from '../data/db';
import { Repo } from '../data/repo';
import { ItemEditor } from '../features/balance-sheet/ItemEditor';
import { NetWorthPage } from '../features/balance-sheet/NetWorthPage';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SettingsPage } from '../features/settings/SettingsPage';
import { defaultPack, getPack } from '../locales';
import { AppContext, type AppState } from './context';
import { loadFinancialData } from './load';

// 圖表套件較大，歷史頁面延遲載入
const HistoryPage = lazy(() => import('../features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })));

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

  if (!data || !overview || !loaded) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  const state: AppState = { repo, pack, data, snapshots: loaded.snapshots, overview, today };

  return (
    <AppContext.Provider value={state}>
      {data.settings.onboardingCompletedAt ? (
        <HashRouter>
          <div className="app-shell">
            <main className="app-main">
              <Routes>
                <Route path="/" element={<NetWorthPage />} />
                <Route
                  path="/history"
                  element={
                    <Suspense fallback={<div className="loading">{t('common.loading')}</div>}>
                      <HistoryPage />
                    </Suspense>
                  }
                />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/:kind/new" element={<ItemEditor />} />
                <Route path="/:kind/:id" element={<ItemEditor />} />
              </Routes>
            </main>
            <nav className="tab-bar" aria-label={t('nav.label')}>
              <NavLink to="/" end>
                <span aria-hidden="true">◎</span>
                {t('nav.netWorth')}
              </NavLink>
              <NavLink to="/history">
                <span aria-hidden="true">↗</span>
                {t('nav.history')}
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
