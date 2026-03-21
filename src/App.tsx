import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { PlannerPage } from './components/PlannerPage';
import { RideHistoryPage } from './components/RideHistoryPage';
import { RouteCard } from './components/RouteCard';
import { fetchSharedGroups, upsertSharedGroups, type SharedGroup } from './services/groupsShared';
import { TopControls } from './components/TopControls';
import { fetchCompletedRideDateKeysByGroup } from './services/routes';

interface RouteSlot {
  key: string;
  title: string;
  dayIndex: number;
}

type AppGroup = SharedGroup;

type Page = 'dashboard' | 'history' | 'planner';

const defaultDayIndexes = [0, 1, 2, 3, 4, 5, 6];

const DEFAULT_APP_GROUPS: AppGroup[] = [
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

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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

interface GroupSelectionPageProps {
  groups: AppGroup[];
}

function GroupSelectionPage({ groups }: GroupSelectionPageProps): JSX.Element {
  const navigate = useNavigate();

  const mainGroupCards = useMemo(() => {
    const grouped = new Map<string, AppGroup[]>();

    groups.forEach((group) => {
      const current = grouped.get(group.mainGroup) ?? [];
      current.push(group);
      grouped.set(group.mainGroup, current);
    });

    return Array.from(grouped.values())
      .map((groupItems) => {
        const primary = groupItems.find((item) => item.subgroup === null) ?? groupItems[0];
        return {
          slug: primary.slug,
          label: primary.name,
          subgroupCount: groupItems.filter((item) => item.subgroup).length,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <section className="rounded-xl2 border border-line bg-panel/90 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Let&apos;s ride</p>
        <h1 className="mt-2 text-2xl font-extrabold text-textMain">Kies je groep</h1>
        <p className="mt-1 text-sm text-textMuted">Kies een groep om het dashboard te openen.</p>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {mainGroupCards.map((group) => (
          <button
            key={group.slug}
            type="button"
            onClick={() => navigate(`/${group.slug}`)}
            className="rounded-xl2 border border-line/80 bg-panel/95 p-5 text-left shadow-card transition hover:border-accent/60"
          >
            <p className="text-base font-bold text-textMain">{group.label}</p>
            {group.subgroupCount > 0 ? (
              <p className="mt-1 text-xs font-semibold text-textMuted">{group.subgroupCount} subgroepen</p>
            ) : null}
            <p className="mt-2 text-xs font-semibold text-accent">Open dashboard</p>
          </button>
        ))}
      </div>
    </div>
  );
}

interface GroupAdminPageProps {
  groups: AppGroup[];
  onCreateGroupSet: (groupName: string, subgroups: string[]) => Promise<boolean>;
  onAddSubgroupToGroup: (mainGroup: string, subgroupName: string) => Promise<boolean>;
  onRenameGroup: (mainGroup: string, newName: string) => Promise<boolean>;
}

function GroupAdminPage({ groups, onCreateGroupSet, onAddSubgroupToGroup, onRenameGroup }: GroupAdminPageProps): JSX.Element {
  const [groupName, setGroupName] = useState<string>('');
  const [subgroups, setSubgroups] = useState<string[]>([]);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [newSubgroupDrafts, setNewSubgroupDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const groupedOverview = useMemo(() => {
    const grouped = new Map<string, { name: string; subgroups: string[] }>();

    groups.forEach((group) => {
      const current = grouped.get(group.mainGroup) ?? { name: group.name, subgroups: [] };
      if (group.subgroup) {
        current.subgroups.push(group.subgroup);
      }
      grouped.set(group.mainGroup, current);
    });

    return Array.from(grouped.entries())
      .map(([mainGroup, values]) => ({ mainGroup, name: values.name, subgroups: values.subgroups }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const cleanName = groupName.trim();
    const cleanSubgroups = subgroups
      .map((value) => value.trim())
      .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

    if (!cleanName) {
      setError('Groepsnaam is verplicht.');
      return;
    }

    const created = await onCreateGroupSet(cleanName, cleanSubgroups);
    if (!created) {
      setError('Groep(en) konden niet opgeslagen worden.');
      return;
    }

    setGroupName('');
    setSubgroups([]);
    setSuccess('Groep(en) aangemaakt.');
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <section className="rounded-xl2 border border-line bg-panel/90 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Verborgen beheer</p>
        <h1 className="mt-2 text-2xl font-extrabold text-textMain">Groepen beheren</h1>
        <p className="mt-1 text-sm text-textMuted">Maak hier nieuwe groepen aan met optionele subgroepen.</p>
      </section>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl2 border border-line/80 bg-panel/95 p-5 shadow-card">
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Groepsnaam"
          required
          className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
        />

        <div className="rounded-lg border border-line bg-panelSoft p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Subgroepen (optioneel)</p>
            <button
              type="button"
              onClick={() => setSubgroups((current) => [...current, ''])}
              className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
            >
              + Subgroep
            </button>
          </div>

          {subgroups.length === 0 ? <p className="mt-2 text-xs text-textMuted">Geen subgroepen toegevoegd.</p> : null}

          <div className="mt-2 space-y-2">
            {subgroups.map((subgroup, index) => (
              <div key={`subgroup-${index}`} className="flex items-center gap-2">
                <input
                  value={subgroup}
                  onChange={(event) =>
                    setSubgroups((current) =>
                      current.map((value, valueIndex) => (valueIndex === index ? event.target.value : value)),
                    )
                  }
                  placeholder={`Subgroep ${index + 1}`}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setSubgroups((current) => current.filter((_, valueIndex) => valueIndex !== index))}
                  className="rounded-md border border-line bg-panel px-2 py-2 text-xs font-semibold text-textMuted transition hover:border-red-400 hover:text-red-300"
                  aria-label="Verwijder subgroep"
                  title="Verwijder subgroep"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
        {success ? <p className="text-xs font-semibold text-accent">{success}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-textMain transition hover:border-accent hover:text-accent"
          >
            Terug
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accentStrong"
          >
            Groep(en) aanmaken
          </button>
        </div>
      </form>

      <section className="mt-4 rounded-xl2 border border-line/80 bg-panel/95 p-5 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-wide text-textMuted">Bestaande groepen</h2>
        <div className="mt-2 space-y-2">
          {groupedOverview.map((groupInfo) => (
            <div key={groupInfo.mainGroup} className="rounded-lg border border-line bg-panelSoft px-3 py-3">
              <p className="text-sm font-semibold text-textMain">{groupInfo.name}</p>
              <p className="text-xs text-textMuted">
                {groupInfo.subgroups.length > 0 ? `Subgroepen: ${groupInfo.subgroups.join(', ')}` : 'Geen subgroepen'}
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
                <input
                  value={renameDrafts[groupInfo.mainGroup] ?? groupInfo.name}
                  onChange={(event) =>
                    setRenameDrafts((current) => ({ ...current, [groupInfo.mainGroup]: event.target.value }))
                  }
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                    const nextName = (renameDrafts[groupInfo.mainGroup] ?? groupInfo.name).trim();
                    if (!nextName) {
                      setError('Nieuwe naam mag niet leeg zijn.');
                      return;
                    }

                    const renamed = await onRenameGroup(groupInfo.mainGroup, nextName);
                    if (!renamed) {
                      setError('Naam kon niet aangepast worden.');
                      return;
                    }

                    setError('');
                    setSuccess('Groepsnaam aangepast.');
                    setRenameDrafts((current) => ({ ...current, [groupInfo.mainGroup]: nextName }));
                    })();
                  }}
                  className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
                >
                  Naam aanpassen
                </button>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
                <input
                  value={newSubgroupDrafts[groupInfo.mainGroup] ?? ''}
                  onChange={(event) =>
                    setNewSubgroupDrafts((current) => ({ ...current, [groupInfo.mainGroup]: event.target.value }))
                  }
                  placeholder="Nieuwe subgroep"
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                    const subgroupName = (newSubgroupDrafts[groupInfo.mainGroup] ?? '').trim();
                    if (!subgroupName) {
                      setError('Subgroepnaam is verplicht.');
                      return;
                    }

                    const added = await onAddSubgroupToGroup(groupInfo.mainGroup, subgroupName);
                    if (!added) {
                      setError('Subgroep bestaat al of kon niet toegevoegd worden.');
                      return;
                    }

                    setError('');
                    setSuccess('Subgroep toegevoegd.');
                    setNewSubgroupDrafts((current) => ({ ...current, [groupInfo.mainGroup]: '' }));
                    })();
                  }}
                  className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
                >
                  Subgroep toevoegen
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface GroupDashboardRouteProps {
  groups: AppGroup[];
}

function GroupDashboardRoute({ groups }: GroupDashboardRouteProps): JSX.Element {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const group = useMemo(() => groups.find((candidate) => candidate.slug === params.slug) ?? null, [groups, params.slug]);

  const subgroupOptions = useMemo(() => {
    if (!group?.subgroup) {
      return [];
    }

    return groups.filter((candidate) => candidate.mainGroup === group.mainGroup && candidate.subgroup).map((candidate) => ({
      label: candidate.subgroup ?? candidate.name,
      slug: candidate.slug,
    }));
  }, [group, groups]);

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
  const [groups, setGroups] = useState<AppGroup[]>(DEFAULT_APP_GROUPS);
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);
  const [groupsError, setGroupsError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async (): Promise<void> => {
      setIsLoadingGroups(true);
      setGroupsError('');

      try {
        let loaded = await fetchSharedGroups();

        if (loaded.length === 0) {
          await upsertSharedGroups(DEFAULT_APP_GROUPS);
          loaded = await fetchSharedGroups();
        }

        if (!cancelled) {
          setGroups(loaded.length > 0 ? loaded : DEFAULT_APP_GROUPS);
        }
      } catch (error) {
        if (!cancelled) {
          setGroups(DEFAULT_APP_GROUPS);
          setGroupsError(error instanceof Error ? error.message : 'Kon groepen niet laden.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGroups(false);
        }
      }
    };

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistGroups = async (next: AppGroup[]): Promise<boolean> => {
    try {
      await upsertSharedGroups(next);
      setGroupsError('');
      return true;
    } catch (error) {
      setGroupsError(error instanceof Error ? error.message : 'Kon groepen niet synchroniseren.');
      return false;
    }
  };

  const applyGroupsUpdate = async (producer: (current: AppGroup[]) => AppGroup[]): Promise<boolean> => {
    let previous: AppGroup[] = [];
    let next: AppGroup[] = [];

    setGroups((current) => {
      previous = current;
      next = producer(current);
      return next;
    });

    const saved = await persistGroups(next);
    if (!saved) {
      setGroups(previous);
      return false;
    }

    return true;
  };

  const handleCreateGroupSet = async (groupName: string, subgroups: string[]): Promise<boolean> => {
    return applyGroupsUpdate((current) => {
      const cleanName = groupName.trim();
      const now = Date.now().toString(36);

      const groupEntries: AppGroup[] =
        subgroups.length > 0
          ? subgroups.map((subgroup, index) => {
              const subgroupSlug = `${slugify(cleanName)}-${slugify(subgroup)}-${now}-${index + 1}`;
              return {
                id: subgroupSlug,
                slug: subgroupSlug,
                name: cleanName,
                mainGroup: cleanName,
                subgroup,
                visibilityType: 'open',
                effectiveGroupKey: `${cleanName}-${subgroup}-${now}-${index + 1}`,
                adminRequiredForRideChanges: false,
              };
            })
          : [
              {
                id: `${slugify(cleanName)}-${now}`,
                slug: `${slugify(cleanName)}-${now}`,
                name: cleanName,
                mainGroup: cleanName,
                subgroup: null,
                visibilityType: 'open',
                effectiveGroupKey: `${cleanName}-${now}`,
                adminRequiredForRideChanges: false,
              },
            ];

      return [...current, ...groupEntries];
    });
  };

  const handleAddSubgroupToGroup = async (mainGroup: string, subgroupName: string): Promise<boolean> => {
    let wasAdded = false;

    const saved = await applyGroupsUpdate((current) => {
      const parentGroup = current.find((group) => group.mainGroup === mainGroup);
      if (!parentGroup) {
        return current;
      }

      const subgroupExists = current.some(
        (group) => group.mainGroup === mainGroup && (group.subgroup ?? '').toLowerCase() === subgroupName.toLowerCase(),
      );

      if (subgroupExists) {
        return current;
      }

      const now = Date.now().toString(36);
      const subgroupSlug = `${slugify(parentGroup.name)}-${slugify(subgroupName)}-${now}`;
      const entry: AppGroup = {
        id: subgroupSlug,
        slug: subgroupSlug,
        name: parentGroup.name,
        mainGroup: parentGroup.mainGroup,
        subgroup: subgroupName,
        visibilityType: 'open',
        effectiveGroupKey: `${parentGroup.mainGroup}-${subgroupName}-${now}`,
        adminRequiredForRideChanges: false,
      };

      wasAdded = true;
      return [...current, entry];
    });

    return wasAdded && saved;
  };

  const handleRenameGroup = async (mainGroup: string, newName: string): Promise<boolean> => {
    let wasRenamed = false;

    const saved = await applyGroupsUpdate((current) => {
      const hasSource = current.some((group) => group.mainGroup === mainGroup);
      if (!hasSource) {
        return current;
      }

      wasRenamed = true;
      const next = current.map((group) =>
        group.mainGroup === mainGroup
          ? {
              ...group,
              name: newName,
              mainGroup: newName,
            }
          : group,
      );
      return next;
    });

    return wasRenamed && saved;
  };

  if (isLoadingGroups) {
    return <p className="p-6 text-sm text-textMuted">Groepen laden...</p>;
  }

  return (
    <>
      {groupsError ? (
        <div className="mx-auto mt-4 max-w-[1200px] rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          Groepen konden niet gesynchroniseerd worden met Supabase. Fallback actief: {groupsError}
        </div>
      ) : null}
    <Routes>
      <Route path="/" element={<GroupSelectionPage groups={groups} />} />
      <Route
        path="/beheer/groepen"
        element={
          <GroupAdminPage
            groups={groups}
            onCreateGroupSet={handleCreateGroupSet}
            onAddSubgroupToGroup={handleAddSubgroupToGroup}
            onRenameGroup={handleRenameGroup}
          />
        }
      />
      <Route path="/:slug" element={<GroupDashboardRoute groups={groups} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
