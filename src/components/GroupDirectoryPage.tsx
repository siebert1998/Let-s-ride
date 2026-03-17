import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppGroup, GroupMembership, GroupVisibility, MembershipStatus } from '../services/groups';
import { fetchGroups, fetchMembershipsForUser, requestJoinGroup } from '../services/groups';

interface GroupDirectoryPageProps {
  userId: string;
}

type VisibilityFilter = 'all' | GroupVisibility;

export function GroupDirectoryPage({ userId }: GroupDirectoryPageProps): JSX.Element {
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  const loadData = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const [groupsData, membershipsData] = await Promise.all([
        fetchGroups(searchTerm, visibilityFilter),
        fetchMembershipsForUser(userId),
      ]);
      setGroups(groupsData);
      setMemberships(membershipsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kon groepen niet laden.');
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadData();
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, visibilityFilter]);

  const membershipsByGroupId = useMemo(() => {
    const map = new Map<string, GroupMembership>();
    memberships.forEach((membership) => map.set(membership.groupId, membership));
    return map;
  }, [memberships]);

  const groupedCards = useMemo(() => {
    const vitessenGroups = groups.filter((group) => group.mainGroup === 'Vitessen');
    const regularGroups = groups.filter((group) => group.mainGroup !== 'Vitessen');

    if (vitessenGroups.length === 0) {
      return regularGroups.map((group) => ({ kind: 'single' as const, group }));
    }

    return [
      ...regularGroups.map((group) => ({ kind: 'single' as const, group })),
      { kind: 'vitessen-bundle' as const, groups: vitessenGroups },
    ];
  }, [groups]);

  const joinGroup = async (group: AppGroup): Promise<void> => {
    setError('');

    try {
      const status = await requestJoinGroup(userId, group);
      setMemberships((current) => {
        const existing = current.find((membership) => membership.groupId === group.id);
        if (existing) {
          return current.map((membership) =>
            membership.groupId === group.id ? { ...membership, status, role: membership.role } : membership,
          );
        }

        return [
          ...current,
          {
            id: `${group.id}-${userId}`,
            groupId: group.id,
            userId,
            role: 'member',
            status,
          },
        ];
      });

      if (status === 'active') {
        navigate(`/group/${group.slug}`);
      }
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Kon groepsaanvraag niet uitvoeren.');
    }
  };

  const handleGroupClick = async (group: AppGroup): Promise<void> => {
    const membership = membershipsByGroupId.get(group.id);

    if (membership?.status === 'active') {
      navigate(`/group/${group.slug}`);
      return;
    }

    if (membership?.status === 'pending') {
      return;
    }

    await joinGroup(group);
  };

  const labelForStatus = (status: MembershipStatus): string => {
    if (status === 'active') return 'Lid';
    if (status === 'pending') return 'In afwachting';
    return 'Geweigerd';
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <section className="rounded-xl2 border border-line bg-panel/90 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Groepen</p>
        <h1 className="mt-2 text-2xl font-extrabold text-textMain">Zoek en kies een groep</h1>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Zoek op groepsnaam, hoofdgroep of subgroep"
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />
          <select
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
            className="rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          >
            <option value="all">Alle</option>
            <option value="open">Open</option>
            <option value="closed">Gesloten</option>
          </select>
        </div>

        {error ? <p className="mt-3 text-xs font-semibold text-red-400">{error}</p> : null}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <p className="text-sm text-textMuted">Groepen laden...</p> : null}

        {!isLoading && groupedCards.length === 0 ? (
          <p className="text-sm text-textMuted">Geen groepen gevonden.</p>
        ) : null}

        {groupedCards.map((card) => {
          if (card.kind === 'single') {
            const group = card.group;
            const membership = membershipsByGroupId.get(group.id);
            const isActive = membership?.status === 'active';
            const isPending = membership?.status === 'pending';
            const canOpen = isActive;

            return (
              <article
                key={group.id}
                className="cursor-pointer rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card transition hover:border-accent/60"
                onClick={() => {
                  void handleGroupClick(group);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-textMain">{group.name}</h2>
                    <p className="text-xs text-textMuted">
                      {group.mainGroup}
                      {group.subgroup ? ` • ${group.subgroup}` : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      group.visibilityType === 'open'
                        ? 'border border-accent/50 bg-accent/10 text-accent'
                        : 'border border-line bg-panelSoft text-textMuted'
                    }`}
                  >
                    {group.visibilityType === 'open' ? 'Open' : 'Gesloten'}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  {membership ? (
                    <span className="text-xs font-semibold text-textMuted">Status: {labelForStatus(membership.status)}</span>
                  ) : (
                    <span className="text-xs text-textMuted">Nog geen lidmaatschap</span>
                  )}

                  {canOpen ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleGroupClick(group);
                      }}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accentStrong"
                    >
                      Meerijden
                    </button>
                  ) : isPending ? (
                    <button
                      type="button"
                      disabled
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMuted opacity-70"
                    >
                      In afwachting
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleGroupClick(group);
                      }}
                      className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
                    >
                      {group.visibilityType === 'open' ? 'Meerijden' : 'Vraag toegang'}
                    </button>
                  )}
                </div>
              </article>
            );
          }

          const vitessenGroups = card.groups;
          const activeVitessenGroup = vitessenGroups.find(
            (group) => membershipsByGroupId.get(group.id)?.status === 'active',
          );
          const hasPendingVitessen = vitessenGroups.some(
            (group) => membershipsByGroupId.get(group.id)?.status === 'pending',
          );
          const defaultJoinGroup = vitessenGroups.find((group) => group.visibilityType === 'open') ?? vitessenGroups[0];
          const bundleCanOpen = Boolean(activeVitessenGroup);
          const subgroupLabels = vitessenGroups.map((group) => group.subgroup).filter(Boolean).join(', ');

          return (
            <article
              key="vitessen-bundle"
              className="cursor-pointer rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card transition hover:border-accent/60"
              onClick={() => {
                if (activeVitessenGroup) {
                  navigate(`/group/${activeVitessenGroup.slug}`);
                  return;
                }

                if (!hasPendingVitessen) {
                  void joinGroup(defaultJoinGroup);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-textMain">Vitessen Baruma</h2>
                  <p className="text-xs text-textMuted">{subgroupLabels}</p>
                </div>
                <span className="rounded-md border border-line bg-panelSoft px-2 py-0.5 text-[11px] font-semibold text-textMuted">
                  Gegroepeerd
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                {bundleCanOpen ? (
                  <span className="text-xs font-semibold text-textMuted">Status: Lid</span>
                ) : hasPendingVitessen ? (
                  <span className="text-xs font-semibold text-textMuted">Status: In afwachting</span>
                ) : (
                  <span className="text-xs text-textMuted">Nog geen lidmaatschap</span>
                )}

                {bundleCanOpen ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (activeVitessenGroup) {
                        navigate(`/group/${activeVitessenGroup.slug}`);
                      }
                    }}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accentStrong"
                  >
                    Meerijden
                  </button>
                ) : hasPendingVitessen ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMuted opacity-70"
                  >
                    In afwachting
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void joinGroup(defaultJoinGroup);
                    }}
                    className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
                  >
                    {defaultJoinGroup.visibilityType === 'open' ? 'Meerijden' : 'Vraag toegang'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
