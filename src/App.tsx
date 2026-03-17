import { User } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AuthPage } from './components/AuthPage';
import { GroupCreatePage } from './components/GroupCreatePage';
import { GroupDirectoryPage } from './components/GroupDirectoryPage';
import { GroupRequestsPage } from './components/GroupRequestsPage';
import { GroupStartPage } from './components/GroupStartPage';
import { MembersPage } from './components/MembersPage';
import { PlannerPage } from './components/PlannerPage';
import { RideHistoryPage } from './components/RideHistoryPage';
import { RouteCard } from './components/RouteCard';
import { TopControls } from './components/TopControls';
import { getSupabaseClient } from './lib/supabase';
import {
  ensureProfileForUser,
  ensureGlobalAdminAccessIfEligible,
  fetchGroupBySlug,
  fetchGroups,
  fetchMembershipForGroup,
  fetchMembershipsForUser,
  type AppGroup,
} from './services/groups';
import { fetchCompletedRideDateKeysByGroup } from './services/routes';

interface RouteSlot {
  key: string;
  title: string;
  dayIndex: number;
}

type Page = 'dashboard' | 'history' | 'planner' | 'requests' | 'members';

const VITESSEN_MAIN_GROUP = 'Vitessen';
const defaultDayIndexes = [0, 1, 2, 3, 4, 5, 6];

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
  isAdmin: boolean;
  vitessenOptions: Array<{ label: string; slug: string }>;
  onVitessenSubgroupChange: (slug: string) => void;
  onSignOut: () => Promise<void>;
}

function DashboardShell({
  group,
  isAdmin,
  vitessenOptions,
  onVitessenSubgroupChange,
  onSignOut,
}: DashboardShellProps): JSX.Element {
  const [weekStartDate, setWeekStartDate] = useState<Date>(getMondayForWeek(new Date()));
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [filledDateKeys, setFilledDateKeys] = useState<string[]>([]);
  const [selectedDayIndexes, setSelectedDayIndexes] = useState<number[]>(defaultDayIndexes);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [adminRequiredForRideChanges, setAdminRequiredForRideChanges] = useState<boolean>(
    group.adminRequiredForRideChanges,
  );

  const effectiveGroupKey = group.effectiveGroupKey;
  const canEditRoutes = !adminRequiredForRideChanges || isAdmin;

  useEffect(() => {
    setAdminRequiredForRideChanges(group.adminRequiredForRideChanges);
  }, [group.adminRequiredForRideChanges, group.id]);

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

  const selectedVitessenLabel = group.subgroup ?? vitessenOptions[0]?.label ?? '';

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl2 border border-line bg-panel/80 p-4 shadow-card md:flex-row md:items-start md:justify-between">
        <img src="/LOGO.svg" alt="Let's ride logo" className="h-12 w-auto p-[9px] sm:h-14" />

        <div className="flex flex-wrap items-start justify-end gap-3">
          <TopControls
            selectedMainGroupLabel={group.name}
            showVitessenSubgroups={group.mainGroup === VITESSEN_MAIN_GROUP}
            vitessenSubgroups={vitessenOptions.map((option) => option.label)}
            selectedVitessenSubgroup={selectedVitessenLabel}
            onVitessenSubgroupChange={(subgroupLabel) => {
              const next = vitessenOptions.find((option) => option.label === subgroupLabel);
              if (next) {
                onVitessenSubgroupChange(next.slug);
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
                    setActivePage('members');
                    setIsMenuOpen(false);
                  }}
                  className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    activePage === 'members'
                      ? 'bg-accent text-black'
                      : 'text-textMain hover:bg-panelSoft hover:text-accent'
                  }`}
                >
                  Leden
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
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('requests');
                      setIsMenuOpen(false);
                    }}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                      activePage === 'requests'
                        ? 'bg-accent text-black'
                        : 'text-textMain hover:bg-panelSoft hover:text-accent'
                    }`}
                  >
                    Ledenaanvragen
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void onSignOut();
                    setIsMenuOpen(false);
                  }}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-textMain transition hover:bg-panelSoft hover:text-accent"
                >
                  Uitloggen
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
                canEditRoutes={canEditRoutes}
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
          canEditRoutes={canEditRoutes}
          onRouteSaved={(dateKey) => {
            const date = new Date(`${dateKey}T00:00:00`);
            setWeekStartDate(getMondayForWeek(date));
            setRefreshTick((current) => current + 1);
            setActivePage('dashboard');
          }}
        />
      ) : activePage === 'members' ? (
        <MembersPage
          groupId={group.id}
          groupName={group.name}
          canManageMembers={isAdmin}
          adminRequiredForRideChanges={adminRequiredForRideChanges}
          onAdminRequiredChanged={setAdminRequiredForRideChanges}
        />
      ) : activePage === 'requests' ? (
        <GroupRequestsPage groupId={group.id} groupName={group.name} />
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

interface GroupDashboardRouteProps {
  user: User;
  onSignOut: () => Promise<void>;
}

function GroupDashboardRoute({ user, onSignOut }: GroupDashboardRouteProps): JSX.Element {
  const params = useParams<{ groupSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<AppGroup | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [vitessenOptions, setVitessenOptions] = useState<Array<{ label: string; slug: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async (): Promise<void> => {
      setIsLoading(true);
      setIsAuthorized(false);

      try {
        const slug = params.groupSlug;
        if (!slug) {
          setIsAuthorized(false);
          return;
        }

        const loadedGroup = await fetchGroupBySlug(slug);
        if (!loadedGroup) {
          setIsAuthorized(false);
          return;
        }

        const membership = await fetchMembershipForGroup(user.id, loadedGroup.id);
        if (!membership || membership.status !== 'active') {
          setIsAuthorized(false);
          return;
        }

        if (cancelled) {
          return;
        }

        setGroup(loadedGroup);
        setIsAuthorized(true);
        setIsAdmin(membership.role === 'admin');

        if (loadedGroup.mainGroup === VITESSEN_MAIN_GROUP) {
          const [allGroups, userMemberships] = await Promise.all([
            fetchGroups('', 'all'),
            fetchMembershipsForUser(user.id),
          ]);

          const activeGroupIds = new Set(
            userMemberships.filter((candidate) => candidate.status === 'active').map((candidate) => candidate.groupId),
          );

          const options = allGroups
            .filter((candidate) => candidate.mainGroup === VITESSEN_MAIN_GROUP && activeGroupIds.has(candidate.id))
            .map((candidate) => ({ label: candidate.subgroup ?? candidate.name, slug: candidate.slug }));

          setVitessenOptions(options);
        } else {
          setVitessenOptions([]);
        }
      } catch {
        if (!cancelled) {
          setIsAuthorized(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRoute();

    return () => {
      cancelled = true;
    };
  }, [params.groupSlug, user.id]);

  if (isLoading) {
    return <p className="p-6 text-sm text-textMuted">Groep laden...</p>;
  }

  if (!isAuthorized || !group) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardShell
      group={group}
      isAdmin={isAdmin}
      vitessenOptions={vitessenOptions}
      onVitessenSubgroupChange={(slug) => {
        navigate(`/group/${slug}`);
      }}
      onSignOut={onSignOut}
    />
  );
}

function AppShell({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<GroupStartPage />} />
      <Route path="/groups" element={<GroupDirectoryPage userId={user.id} />} />
      <Route path="/groups/new" element={<GroupCreatePage userId={user.id} />} />
      <Route path="/group/:groupSlug" element={<GroupDashboardRoute user={user} onSignOut={onSignOut} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const initializeUser = async (nextUser: User | null): Promise<void> => {
      setUser(nextUser);

      if (!nextUser) {
        return;
      }

      try {
        await ensureProfileForUser(nextUser);
        await ensureGlobalAdminAccessIfEligible(nextUser);
      } catch {
        // Keep app usable even if bootstrap sync fails.
      }
    };

    const loadUser = async (): Promise<void> => {
      const { data } = await supabase.auth.getUser();
      await initializeUser(data.user ?? null);
      setIsLoadingAuth(false);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void initializeUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async (): Promise<void> => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  };

  if (isLoadingAuth) {
    return <p className="p-6 text-sm text-textMuted">Sessie laden...</p>;
  }

  if (!user) {
    return <AuthPage onAuthenticated={() => undefined} />;
  }

  return <AppShell user={user} onSignOut={handleSignOut} />;
}

export default App;
