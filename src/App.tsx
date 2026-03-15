import { useEffect, useMemo, useState } from 'react';
import { RideHistoryPage } from './components/RideHistoryPage';
import { RouteCard } from './components/RouteCard';
import { TopControls } from './components/TopControls';
import { fetchCompletedRideDateKeysByGroup } from './services/routes';

interface RouteSlot {
  key: string;
  title: string;
}

type Page = 'dashboard' | 'history';
type View = 'group-select' | 'app';

interface MainGroup {
  id: string;
  label: string;
}

const mainGroups: readonly MainGroup[] = [
  { id: 'VZW', label: 'De VZW' },
  { id: 'AquaMundo Cycling Team', label: 'AquaMundo Cycling Team' },
  { id: 'Vitessen', label: "Baruma's Vitessen" },
] as const;

const vitessenSubgroups = ['Groep A', 'Groep B', 'Groep C'] as const;

const getMondayForWeek = (anchor: Date): Date => {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffFromMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffFromMonday);
  return start;
};

const formatRouteTitle = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  return formatter.format(date);
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App(): JSX.Element {
  const [weekStartDate, setWeekStartDate] = useState<Date>(getMondayForWeek(new Date()));
  const [selectedMainGroupId, setSelectedMainGroupId] = useState<string | null>(null);
  const [selectedVitessenSubgroup, setSelectedVitessenSubgroup] = useState<string>(vitessenSubgroups[0]);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [activeView, setActiveView] = useState<View>('group-select');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [filledDateKeys, setFilledDateKeys] = useState<string[]>([]);
  const selectedMainGroupLabel = useMemo(
    () => mainGroups.find((group) => group.id === selectedMainGroupId)?.label ?? '',
    [selectedMainGroupId],
  );

  const effectiveGroupKey = useMemo(() => {
    if (!selectedMainGroupId) {
      return '';
    }

    if (selectedMainGroupId === 'Vitessen') {
      return `Vitessen-${selectedVitessenSubgroup}`;
    }

    return selectedMainGroupId;
  }, [selectedMainGroupId, selectedVitessenSubgroup]);

  useEffect(() => {
    if (!effectiveGroupKey) {
      setFilledDateKeys([]);
      return;
    }

    let cancelled = false;

    const loadFilledDays = async (): Promise<void> => {
      try {
        const dates = await fetchCompletedRideDateKeysByGroup(effectiveGroupKey);
        if (!cancelled) {
          setFilledDateKeys(dates);
        }
      } catch {
        if (!cancelled) {
          setFilledDateKeys([]);
        }
      }
    };

    void loadFilledDays();

    return () => {
      cancelled = true;
    };
  }, [effectiveGroupKey]);

  const routeSlots = useMemo<RouteSlot[]>(() => {
    const monday = getMondayForWeek(weekStartDate);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        key: toDateKey(date),
        title: formatRouteTitle(date),
      };
    });
  }, [weekStartDate]);

  if (activeView === 'group-select') {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[900px] items-center justify-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-xl2 border border-line bg-panel/90 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Welkom</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-textMain">Let&apos;s ride</h1>
          <p className="mt-2 text-sm text-textMuted">Kies eerst je groep om het dashboard te openen.</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {mainGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setSelectedMainGroupId(group.id);
                  setActiveView('app');
                }}
                className="rounded-xl border border-line bg-panelSoft px-4 py-5 text-left transition hover:border-accent hover:bg-panel"
              >
                <p className="text-sm font-bold text-textMain">{group.label}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!selectedMainGroupId) {
    return <></>;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl2 border border-line bg-panel/80 p-4 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Cycling Dashboard</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-textMain">Let&apos;s ride</h1>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-3">
          <TopControls
            selectedMainGroupLabel={selectedMainGroupLabel}
            showVitessenSubgroups={selectedMainGroupId === 'Vitessen'}
            vitessenSubgroups={vitessenSubgroups}
            selectedVitessenSubgroup={selectedVitessenSubgroup}
            onVitessenSubgroupChange={setSelectedVitessenSubgroup}
            weekStartDate={weekStartDate}
            onPreviousWeek={() =>
              setWeekStartDate((currentDate) => {
                const nextDate = new Date(currentDate);
                nextDate.setDate(nextDate.getDate() - 7);
                return getMondayForWeek(nextDate);
              })
            }
            onNextWeek={() =>
              setWeekStartDate((currentDate) => {
                const nextDate = new Date(currentDate);
                nextDate.setDate(nextDate.getDate() + 7);
                return getMondayForWeek(nextDate);
              })
            }
            onToday={() => setWeekStartDate(getMondayForWeek(new Date()))}
            onSelectWeekDate={(date) => setWeekStartDate(getMondayForWeek(date))}
            filledDateKeys={filledDateKeys}
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((value) => !value)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-textMain transition hover:border-accent hover:text-accent"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 top-12 z-[1000] w-52 rounded-xl border border-line bg-panel p-2 shadow-card">
                <button
                  type="button"
                  onClick={() => {
                    setActivePage('dashboard');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    activePage === 'dashboard'
                      ? 'bg-accent text-black'
                      : 'text-textMain hover:bg-panelSoft hover:text-accent'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePage('history');
                    setIsMenuOpen(false);
                  }}
                  className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    activePage === 'history'
                      ? 'bg-accent text-black'
                      : 'text-textMain hover:bg-panelSoft hover:text-accent'
                  }`}
                >
                  Ritgeschiedenis
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {activePage === 'dashboard' ? (
        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {routeSlots.map((slot) => (
            <RouteCard
              key={`${effectiveGroupKey}-${slot.key}`}
              title={slot.title}
              storageId={`group-${effectiveGroupKey}-day-${slot.key}`}
              initialNotes=""
            />
          ))}
        </main>
      ) : (
        <RideHistoryPage selectedGroup={effectiveGroupKey} />
      )}
    </div>
  );
}

export default App;
