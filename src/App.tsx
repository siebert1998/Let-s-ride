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

const groups = ['VZW', 'AquaMundo Cycling Team'] as const;

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
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [filledDateKeys, setFilledDateKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadFilledDays = async (): Promise<void> => {
      try {
        const dates = await fetchCompletedRideDateKeysByGroup(selectedGroup);
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
  }, [selectedGroup]);

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

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl2 border border-line bg-panel/80 p-4 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Cycling Dashboard</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-textMain">Let&apos;s ride</h1>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-3">
          <TopControls
            groups={groups}
            selectedGroup={selectedGroup}
            onGroupChange={setSelectedGroup}
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
              key={`${selectedGroup}-${slot.key}`}
              title={slot.title}
              storageId={`group-${selectedGroup}-day-${slot.key}`}
              initialNotes=""
            />
          ))}
        </main>
      ) : (
        <RideHistoryPage selectedGroup={selectedGroup} />
      )}
    </div>
  );
}

export default App;
