import { useEffect, useState } from 'react';
import {
  fetchMembersForGroup,
  type GroupMemberView,
  type MembershipRole,
  updateGroupRidePermissionMode,
  updateMembershipRole,
} from '../services/groups';

interface MembersPageProps {
  groupId: string;
  groupName: string;
  canManageMembers: boolean;
  adminRequiredForRideChanges: boolean;
  onAdminRequiredChanged: (value: boolean) => void;
}

export function MembersPage({
  groupId,
  groupName,
  canManageMembers,
  adminRequiredForRideChanges,
  onAdminRequiredChanged,
}: MembersPageProps): JSX.Element {
  const [members, setMembers] = useState<GroupMemberView[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSavingMode, setIsSavingMode] = useState<boolean>(false);

  const loadMembers = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchMembersForGroup(groupId);
      setMembers(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kon leden niet laden.');
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, [groupId]);

  const handleRoleChange = async (member: GroupMemberView, role: MembershipRole): Promise<void> => {
    setError('');

    try {
      await updateMembershipRole(member.membershipId, role);
      setMembers((current) =>
        current.map((candidate) => (candidate.membershipId === member.membershipId ? { ...candidate, role } : candidate)),
      );
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Kon rol niet aanpassen.');
    }
  };

  const handleRidePermissionToggle = async (): Promise<void> => {
    if (!canManageMembers) {
      return;
    }

    setIsSavingMode(true);
    setError('');

    try {
      const nextValue = !adminRequiredForRideChanges;
      await updateGroupRidePermissionMode(groupId, nextValue);
      onAdminRequiredChanged(nextValue);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kon groepsinstelling niet opslaan.');
    } finally {
      setIsSavingMode(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
        <h2 className="text-xl font-extrabold text-textMain">Leden</h2>
        <p className="mt-1 text-sm text-textMuted">Overzicht van leden en rechten voor {groupName}.</p>
      </div>

      <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-textMain">Ritbeheer zonder admin</p>
            <p className="text-xs text-textMuted">
              {adminRequiredForRideChanges
                ? 'Nu kunnen enkel admins ritten toevoegen, verwijderen of uploaden.'
                : 'Nu mag elk actief lid ritten toevoegen, verwijderen of uploaden.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRidePermissionToggle()}
            disabled={!canManageMembers || isSavingMode}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingMode
              ? 'Opslaan...'
              : adminRequiredForRideChanges
                ? 'Zet op: iedereen mag beheren'
                : 'Zet op: enkel admins beheren'}
          </button>
        </div>
      </div>

      {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
      {isLoading ? <p className="text-sm text-textMuted">Leden laden...</p> : null}

      <div className="space-y-3">
        {members.map((member) => (
          <article key={member.membershipId} className="rounded-xl border border-line/80 bg-panel/95 p-3 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-textMain">{member.displayName}</p>
                <p className="text-xs text-textMuted">Status: {member.status}</p>
              </div>

              {canManageMembers ? (
                <select
                  value={member.role}
                  onChange={(event) => void handleRoleChange(member, event.target.value as MembershipRole)}
                  className="rounded-lg border border-line bg-panelSoft px-3 py-1.5 text-xs font-semibold text-textMain outline-none transition focus:border-accent"
                >
                  <option value="member">Lid</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="rounded-md border border-line bg-panelSoft px-2 py-1 text-xs font-semibold text-textMuted">
                  {member.role}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
