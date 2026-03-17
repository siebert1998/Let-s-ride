import { useEffect, useState } from 'react';
import { fetchPendingMembershipsForGroup, setMembershipStatus } from '../services/groups';

interface GroupRequestsPageProps {
  groupId: string;
  groupName: string;
}

interface PendingRequest {
  id: string;
  displayName: string;
}

export function GroupRequestsPage({ groupId, groupName }: GroupRequestsPageProps): JSX.Element {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const loadRequests = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchPendingMembershipsForGroup(groupId);
      setRequests(data.map((item) => ({ id: item.id, displayName: item.displayName })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kon aanvragen niet laden.');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [groupId]);

  const handleAction = async (membershipId: string, status: 'active' | 'rejected'): Promise<void> => {
    try {
      await setMembershipStatus(membershipId, status);
      setRequests((current) => current.filter((request) => request.id !== membershipId));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Kon aanvraag niet verwerken.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
        <h2 className="text-xl font-extrabold text-textMain">Ledenaanvragen</h2>
        <p className="mt-1 text-sm text-textMuted">Beheer openstaande aanvragen voor {groupName}.</p>
      </div>

      {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
      {isLoading ? <p className="text-sm text-textMuted">Aanvragen laden...</p> : null}

      {!isLoading && requests.length === 0 ? (
        <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 text-sm text-textMuted shadow-card">
          Geen openstaande aanvragen.
        </div>
      ) : null}

      <div className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-line/80 bg-panel/95 p-3 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-textMain">{request.displayName}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAction(request.id, 'active')}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black transition hover:bg-accentStrong"
                >
                  Goedkeuren
                </button>
                <button
                  type="button"
                  onClick={() => void handleAction(request.id, 'rejected')}
                  className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
                >
                  Weigeren
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
