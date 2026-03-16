import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { PlannerPage } from './components/PlannerPage';
import { RideHistoryPage } from './components/RideHistoryPage';
import { RouteCard } from './components/RouteCard';
import { TopControls } from './components/TopControls';
import { fetchCompletedRideDateKeysByGroup } from './services/routes';

interface RouteSlot {
  key: string;
  title: string;
  dayIndex: number;
}

type Page = 'dashboard' | 'history' | 'planner';

interface VitessenSubgroup {
  label: string;
  slug: string;
}

const VITESSEN_ID = 'Vitessen';
const defaultDayIndexes = [0, 1, 2, 3, 4, 5, 6];

const mainGroups = [
  { id: 'VZW', label: 'De VZW', path: '/de-vzw' },
  { id: 'AquaMundo Cycling Team', label: 'AquaMundo Cycling Team', path: '/aquamundo-cycling-team' },
  { id: VITESSEN_ID, label: "Baruma's Vitessen", path: '/barumas-vitessen' },
] as const;

const vitessenSubgroups: readonly VitessenSubgroup[] = [
  { label: 'Groep A', slug: 'groep-a' },
  { label: 'Groep B', slug: 'groep-b' },
  { label: 'Groep C', slug: 'groep-c' },
  { label: 'Social rides', slug: 'social-rides' },
] as const;

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

interface DashboardShellProps {
  mainGroupId: string;
  mainGroupLabel: string;
  selectedVitessenSubgroup?: string;
  onVitessenSubgroupChange?: (subgroup: string) => void;
}

function DashboardShell({
  mainGroupId,
  mainGroupLabel,
  selectedVitessenSubgroup,
  onVitessenSubgroupChange,
}: DashboardShellProps): JSX.Element {
  const [weekStartDate, setWeekStartDate] = useState<Date>(getMondayForWeek(new Date()));
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [filledDateKeys, setFilledDateKeys] = useState<string[]>([]);
  const [selectedDayIndexes, setSelectedDayIndexes] = useState<number[]>(defaultDayIndexes);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const effectiveGroupKey = useMemo(() => {
    if (mainGroupId === VITESSEN_ID && selectedVitessenSubgroup) {
      return `${VITESSEN_ID}-${selectedVitessenSubgroup}`;
    }

    return mainGroupId;
  }, [mainGroupId, selectedVitessenSubgroup]);

  useEffect(() => {
    const storageKey = `letsride:day-filter:${effectiveGroupKey}`;
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      setSelectedDayIndexes(defaultDayIndexes);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setSelectedDayIndexes(defaultDayIndexes);
        return;
      }

      const nextIndexes = parsed.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 6);
      setSelectedDayIndexes(nextIndexes.length > 0 ? [...new Set(nextIndexes)].sort((a, b) => a - b) : []);
    } catch {
      setSelectedDayIndexes(defaultDayIndexes);
    }
  }, [effectiveGroupKey, refreshTick]);

  useEffect(() => {
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
        dayIndex: index,
      };
    });
  }, [weekStartDate]);

  const visibleRouteSlots = useMemo(
    () => routeSlots.filter((slot) => selectedDayIndexes.includes(slot.dayIndex)),
    [routeSlots, selectedDayIndexes],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl2 border border-line bg-panel/80 p-4 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Cycling Dashboard</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-textMain">Let&apos;s ride</h1>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-3">
          <TopControls
            selectedMainGroupLabel={mainGroupLabel}
            showVitessenSubgroups={mainGroupId === VITESSEN_ID}
            vitessenSubgroups={vitessenSubgroups.map((subgroup) => subgroup.label)}
            selectedVitessenSubgroup={selectedVitessenSubgroup ?? vitessenSubgroups[0].label}
            onVitessenSubgroupChange={(subgroup) => onVitessenSubgroupChange?.(subgroup)}
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
            selectedDayIndexes={selectedDayIndexes}
            onSaveDayIndexes={(indexes) => {
              setSelectedDayIndexes(indexes);
              localStorage.setItem(`letsride:day-filter:${effectiveGroupKey}`, JSON.stringify(indexes));
            }}
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
                    setActivePage('planner');
                    setIsMenuOpen(false);
                  }}
                  className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    activePage === 'planner'
                      ? 'bg-accent text-black'
                      : 'text-textMain hover:bg-panelSoft hover:text-accent'
                  }`}
                >
                  Ritplanner
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
        visibleRouteSlots.length > 0 ? (
          <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleRouteSlots.map((slot) => (
              <RouteCard
                key={`${effectiveGroupKey}-${slot.key}`}
                title={slot.title}
                storageId={`group-${effectiveGroupKey}-day-${slot.key}`}
                initialNotes=""
              />
            ))}
          </main>
        ) : (
          <div className="rounded-xl2 border border-line/80 bg-panel/95 p-5 text-sm text-textMuted shadow-card">
            Geen dagen geselecteerd. Open "Filter dagen" en kies minstens 1 dag.
          </div>
        )
      ) : activePage === 'planner' ? (
        <PlannerPage
          effectiveGroupKey={effectiveGroupKey}
          onRouteSaved={(dateKey) => {
            const date = new Date(`${dateKey}T00:00:00`);
            setWeekStartDate(getMondayForWeek(date));
            setRefreshTick((current) => current + 1);
            setActivePage('dashboard');
          }}
        />
      ) : (
        <RideHistoryPage selectedGroup={effectiveGroupKey} />
      )}
    </div>
  );
}

function GroupSelectPage(): JSX.Element {
  const navigate = useNavigate();

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
                if (group.id === VITESSEN_ID) {
                  navigate('/barumas-vitessen/groep-a');
                  return;
                }

                navigate(group.path);
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

function VzwDashboardPage(): JSX.Element {
  return <DashboardShell mainGroupId="VZW" mainGroupLabel="De VZW" />;
}

function AquaMundoDashboardPage(): JSX.Element {
  return <DashboardShell mainGroupId="AquaMundo Cycling Team" mainGroupLabel="AquaMundo Cycling Team" />;
}

function VitessenDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams<{ subgroupSlug: string }>();

  const subgroup = vitessenSubgroups.find((candidate) => candidate.slug === params.subgroupSlug);
  if (!subgroup) {
    return <Navigate to="/barumas-vitessen/groep-a" replace />;
  }

  return (
    <DashboardShell
      mainGroupId={VITESSEN_ID}
      mainGroupLabel="Baruma's Vitessen"
      selectedVitessenSubgroup={subgroup.label}
      onVitessenSubgroupChange={(nextSubgroupLabel) => {
        const nextSubgroup = vitessenSubgroups.find((candidate) => candidate.label === nextSubgroupLabel);
        if (!nextSubgroup) {
          return;
        }

        navigate(`/barumas-vitessen/${nextSubgroup.slug}`);
      }}
    />
  );
}

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<GroupSelectPage />} />
      <Route path="/de-vzw" element={<VzwDashboardPage />} />
      <Route path="/aquamundo-cycling-team" element={<AquaMundoDashboardPage />} />
      <Route path="/barumas-vitessen/:subgroupSlug" element={<VitessenDashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
