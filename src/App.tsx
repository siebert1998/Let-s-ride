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

interface AppGroup {
  id: string;
  slug: string;
  name: string;
  mainGroup: string;
  subgroup: string | null;
  visibilityType: 'open' | 'closed';
  effectiveGroupKey: string;
  adminRequiredForRideChanges: boolean;
}

type Page = 'dashboard' | 'history' | 'planner';

const defaultDayIndexes = [0, 1, 2, 3, 4, 5, 6];

const APP_GROUPS: AppGroup[] = [
  {
    id: 'de-vzw',
    slug: 'de-vzw',
    name: 'De VZW',
    mainGroup: 'VZW',
    subgroup: null,
    visibilityType: 'open',
    effectiveGroupKey: 'VZW',
    adminRequiredForRideChanges: false,
  },
  {
    id: 'aquamundo-cycling-team',
    slug: 'aquamundo-cycling-team',
    name: 'AquaMundo Cycling Team',
    mainGroup: 'AquaMundo Cycling Team',
    subgroup: null,
    visibilityType: 'open',
    effectiveGroupKey: 'AquaMundo Cycling Team',
    adminRequiredForRideChanges: false,
  },
  {
    id: 'barumas-vitessen-groep-a',
    slug: 'barumas-vitessen-groep-a',
    name: 'Vitessen Baruma',
    mainGroup: 'Vitessen Baruma',
    subgroup: 'Groep A',
    visibilityType: 'open',
    effectiveGroupKey: 'Vitessen-Groep A',
    adminRequiredForRideChanges: false,
  },
  {
    id: 'barumas-vitessen-groep-b',
    slug: 'barumas-vitessen-groep-b',
    name: 'Vitessen Baruma',
    mainGroup: 'Vitessen Baruma',
    subgroup: 'Groep B',
    visibilityType: 'open',
    effectiveGroupKey: 'Vitessen-Groep B',
    adminRequiredForRideChanges: false,
  },
  {
    id: 'barumas-vitessen-groep-c',
    slug: 'barumas-vitessen-groep-c',
    name: 'Vitessen Baruma',
    mainGroup: 'Vitessen Baruma',
    subgroup: 'Groep C',
    visibilityType: 'open',
    effectiveGroupKey: 'Vitessen-Groep C',
    adminRequiredForRideChanges: false,
  },
  {
    id: 'barumas-vitessen-social-rides',
    slug: 'barumas-vitessen-social-rides',
    name: 'Vitessen Baruma',
    mainGroup: 'Vitessen Baruma',
    subgroup: 'Social rides',
    visibilityType: 'open',
    effectiveGroupKey: 'Vitessen-Social rides',
    adminRequiredForRideChanges: false,
  },
];

const START_GROUPS = [
  { label: 'De VZW', slug: 'de-vzw' },
  { label: 'AquaMundo Cycling Team', slug: 'aquamundo-cycling-team' },
  { label: 'Vitessen Baruma', slug: 'barumas-vitessen-groep-a' },
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
  group: AppGroup;
  subgroupOptions: Array<{ label: string; slug: string }>;
  onSubgroupChange: (slug: string) => void;
}

function DashboardShell({ group, subgroupOptions, onSubgroupChange }: DashboardShellProps): JSX.Element {
  const [weekStartDate, setWeekStartDate] = useState<Date>(getMondayForWeek(new Date()));
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [filledDateKeys, setFilledDateKeys] = useState<string[]>([]);
  const [selectedDayIndexes, setSelectedDayIndexes] = useState<number[]>(defaultDayIndexes);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const effectiveGroupKey = group.effectiveGroupKey;

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

  const selectedSubgroupLabel = group.subgroup ?? subgroupOptions[0]?.label ?? '';
  const showSubgroupSwitcher = subgroupOptions.length > 1;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl2 border border-line bg-panel/80 p-4 shadow-card md:flex-row md:items-start md:justify-between">
        <img src="/LOGO.svg" alt="Let's ride logo" className="h-12 w-auto p-[9px] sm:h-14" />

        <div className="flex flex-wrap items-start justify-end gap-3">
          <TopControls
            selectedMainGroupLabel={group.name}
            showVitessenSubgroups={showSubgroupSwitcher}
            vitessenSubgroups={subgroupOptions.map((option) => option.label)}
            selectedVitessenSubgroup={selectedSubgroupLabel}
            onVitessenSubgroupChange={(subgroupLabel) => {
              const next = subgroupOptions.find((option) => option.label === subgroupLabel);
              if (next) {
                onSubgroupChange(next.slug);
              }
            }}
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
              <div className="absolute right-0 top-12 z-[1000] w-56 rounded-xl border border-line bg-panel p-2 shadow-card">
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
                canEditRoutes
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
          canEditRoutes
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

      <div className="mt-5">
        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          className="text-xs font-semibold text-textMuted transition hover:text-accent"
        >
          Terug naar groepen
        </button>
      </div>
    </div>
  );
}

function GroupSelectionPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <section className="rounded-xl2 border border-line bg-panel/90 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Let&apos;s ride</p>
        <h1 className="mt-2 text-2xl font-extrabold text-textMain">Kies je groep</h1>
        <p className="mt-1 text-sm text-textMuted">Kies een van de 3 bestaande groepen om het dashboard te openen.</p>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {START_GROUPS.map((group) => (
          <button
            key={group.slug}
            type="button"
            onClick={() => navigate(`/${group.slug}`)}
            className="rounded-xl2 border border-line/80 bg-panel/95 p-5 text-left shadow-card transition hover:border-accent/60"
          >
            <p className="text-base font-bold text-textMain">{group.label}</p>
            <p className="mt-2 text-xs font-semibold text-accent">Open dashboard</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupDashboardRoute(): JSX.Element {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const group = useMemo(
    () => APP_GROUPS.find((candidate) => candidate.slug === params.slug) ?? null,
    [params.slug],
  );

  const subgroupOptions = useMemo(() => {
    if (!group?.subgroup) {
      return [];
    }

    return APP_GROUPS.filter((candidate) => candidate.mainGroup === group.mainGroup && candidate.subgroup).map(
      (candidate) => ({ label: candidate.subgroup ?? candidate.name, slug: candidate.slug }),
    );
  }, [group]);

  if (!group) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardShell
      group={group}
      subgroupOptions={subgroupOptions}
      onSubgroupChange={(slug) => {
        navigate(`/${slug}`);
      }}
    />
  );
}

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<GroupSelectionPage />} />
      <Route path="/:slug" element={<GroupDashboardRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
