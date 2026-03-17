import { useEffect, useMemo, useState } from 'react';
import type { ParsedRoute } from '../types';
import {
  deleteRouteBySlot,
  fetchPlannerDraftsByGroup,
  fetchRouteBySlot,
  type SyncedRoute,
  upsertRouteForSlot,
} from '../services/routes';
import { parseGpxContent } from '../utils/gpx';
import { RouteMap } from './RouteMap';
import { UploadDropzone } from './UploadDropzone';

interface PlannerPageProps {
  effectiveGroupKey: string;
  onRouteSaved: (dateKey: string) => void;
  canEditRoutes: boolean;
}

interface SourceFileState {
  name: string;
  gpxText: string;
}

interface PlannerDraft {
  id: string;
  slotKey: string;
  routeData: ParsedRoute | null;
  sourceFile: SourceFileState | null;
  notes: string;
  pinDate: string;
  error: string;
  isSaving: boolean;
  hasConflict: boolean;
  isSaved: boolean;
}

const formatDistance = (distanceKm: number): string => `${distanceKm.toFixed(2)} km`;
const formatElevation = (elevationGainM: number): string => `${Math.round(elevationGainM)} m`;

const createDraftId = (): string => crypto.randomUUID();

const buildPlannerSlotKey = (groupKey: string, draftId: string): string => `plan-group-${groupKey}-draft-${draftId}`;

const createDraft = (groupKey: string): PlannerDraft => {
  const id = createDraftId();

  return {
    id,
    slotKey: buildPlannerSlotKey(groupKey, id),
    routeData: null,
    sourceFile: null,
    notes: '',
    pinDate: '',
    error: '',
    isSaving: false,
    hasConflict: false,
    isSaved: false,
  };
};

const toDashboardTitle = (dateKey: string): string => {
  const date = new Date(`${dateKey}T00:00:00`);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
};

const toPlannerDraft = (groupKey: string, route: SyncedRoute): PlannerDraft => {
  let routeData: ParsedRoute | null = null;

  if (route.gpxText) {
    try {
      routeData = parseGpxContent(route.gpxText);
    } catch {
      routeData = null;
    }
  }

  const draftIdPrefix = `plan-group-${groupKey}-draft-`;
  const derivedId = route.slotKey.startsWith(draftIdPrefix)
    ? route.slotKey.slice(draftIdPrefix.length)
    : createDraftId();

  return {
    id: derivedId,
    slotKey: route.slotKey,
    routeData,
    sourceFile: route.gpxText && route.fileName ? { name: route.fileName, gpxText: route.gpxText } : null,
    notes: route.notes,
    pinDate: '',
    error: '',
    isSaving: false,
    hasConflict: false,
    isSaved: true,
  };
};

export function PlannerPage({ effectiveGroupKey, onRouteSaved, canEditRoutes }: PlannerPageProps): JSX.Element {
  const [drafts, setDrafts] = useState<PlannerDraft[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string>('');

  const canAddMore = useMemo(() => drafts.length < 20, [drafts.length]);

  useEffect(() => {
    let cancelled = false;

    const loadDrafts = async (): Promise<void> => {
      setIsLoading(true);
      setPageError('');

      try {
        const plannerRoutes = await fetchPlannerDraftsByGroup(effectiveGroupKey);

        if (cancelled) {
          return;
        }

        if (plannerRoutes.length === 0) {
          setDrafts([createDraft(effectiveGroupKey)]);
          return;
        }

        setDrafts(plannerRoutes.map((route) => toPlannerDraft(effectiveGroupKey, route)));
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Kon ritplanner niet laden.';
          setPageError(message);
          setDrafts([createDraft(effectiveGroupKey)]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDrafts();

    return () => {
      cancelled = true;
    };
  }, [effectiveGroupKey]);

  const updateDraft = (id: string, updater: (draft: PlannerDraft) => PlannerDraft): void => {
    setDrafts((currentDrafts) => currentDrafts.map((draft) => (draft.id === id ? updater(draft) : draft)));
  };

  const saveDraft = async (id: string, forceOverwrite: boolean): Promise<void> => {
    const draft = drafts.find((candidate) => candidate.id === id);

    if (!draft) {
      return;
    }

    if (!canEditRoutes) {
      updateDraft(id, (current) => ({ ...current, error: 'Alleen admins mogen ritten beheren in deze groep.' }));
      return;
    }

    if (!draft.sourceFile || !draft.routeData) {
      updateDraft(id, (current) => ({ ...current, error: 'Upload eerst een GPX-bestand.' }));
      return;
    }

    updateDraft(id, (current) => ({ ...current, isSaving: true, error: '', hasConflict: false }));

    try {
      if (draft.pinDate) {
        const dashboardSlotKey = `group-${effectiveGroupKey}-day-${draft.pinDate}`;

        if (!forceOverwrite) {
          const existing = await fetchRouteBySlot(dashboardSlotKey);
          if (existing?.gpxText) {
            updateDraft(id, (current) => ({
              ...current,
              isSaving: false,
              hasConflict: true,
              error: 'Op deze datum staat al een rit. Kies overschrijven of annuleer.',
            }));
            return;
          }
        }

        await upsertRouteForSlot({
          slotKey: dashboardSlotKey,
          title: toDashboardTitle(draft.pinDate),
          notes: draft.notes,
          fileName: draft.sourceFile.name,
          gpxText: draft.sourceFile.gpxText,
          distanceKm: draft.routeData.distanceKm,
          elevationGainM: draft.routeData.elevationGainM,
        });

        await deleteRouteBySlot(draft.slotKey);
        onRouteSaved(draft.pinDate);
        setDrafts((currentDrafts) => currentDrafts.filter((candidate) => candidate.id !== id));
        return;
      }

      await upsertRouteForSlot({
        slotKey: draft.slotKey,
        title: 'Planned ride',
        notes: draft.notes,
        fileName: draft.sourceFile.name,
        gpxText: draft.sourceFile.gpxText,
        distanceKm: draft.routeData.distanceKm,
        elevationGainM: draft.routeData.elevationGainM,
      });

      updateDraft(id, (current) => ({
        ...current,
        isSaving: false,
        error: '',
        hasConflict: false,
        isSaved: true,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kon de rit niet opslaan.';
      updateDraft(id, (current) => ({ ...current, isSaving: false, error: message }));
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
        <h2 className="text-xl font-extrabold text-textMain">Ritplanner</h2>
        <p className="mt-1 text-sm text-textMuted">
          Upload ritten zonder datum en pin ze later vast op een specifieke dag in je dashboard.
        </p>
        {!canEditRoutes ? (
          <p className="mt-2 text-xs font-semibold text-textMuted">
            Alleen admins mogen ritten toevoegen of wijzigen in deze groep.
          </p>
        ) : null}
      </div>

      {pageError ? <p className="text-sm font-semibold text-red-400">{pageError}</p> : null}
      {isLoading ? <p className="text-sm text-textMuted">Ritplanner laden...</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {drafts.map((draft) => (
          <article key={draft.id} className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-textMain">Nieuwe rit</h3>
              {draft.sourceFile ? (
                <span className="rounded-md border border-accent/50 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  {draft.isSaved ? 'Opgeslagen' : 'Klaar'}
                </span>
              ) : null}
            </div>

            <UploadDropzone
              disabled={!canEditRoutes}
              onFileSelected={async (file) => {
                updateDraft(draft.id, (current) => ({ ...current, error: '', isSaved: false }));

                try {
                  if (!file.name.toLowerCase().endsWith('.gpx')) {
                    throw new Error('Alleen .gpx bestanden zijn toegestaan.');
                  }

                  const gpxText = await file.text();
                  const parsed = parseGpxContent(gpxText);

                  updateDraft(draft.id, (current) => ({
                    ...current,
                    sourceFile: { name: file.name, gpxText },
                    routeData: parsed,
                    error: '',
                    hasConflict: false,
                  }));
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Kon het GPX-bestand niet lezen.';
                  updateDraft(draft.id, (current) => ({ ...current, error: message }));
                }
              }}
            />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Metric label="Distance" value={draft.routeData ? formatDistance(draft.routeData.distanceKm) : '--'} />
              <Metric label="Elevation" value={draft.routeData ? formatElevation(draft.routeData.elevationGainM) : '--'} />
            </div>

            <div className="mt-3 h-40 overflow-hidden rounded-xl border border-line/80 bg-shell/60">
              {draft.routeData ? (
                <RouteMap points={draft.routeData.points} />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-textMuted">
                  Upload een GPX om de route te bekijken.
                </div>
              )}
            </div>

            <label className="mt-3 block text-sm font-semibold text-textMain">
              Opmerkingen
              <textarea
                value={draft.notes}
                disabled={!canEditRoutes}
                onChange={(event) =>
                  updateDraft(draft.id, (current) => ({
                    ...current,
                    notes: event.target.value,
                    hasConflict: false,
                    isSaved: false,
                  }))
                }
                placeholder="Startpunt, tijdstip, pace,..."
                className="mt-2 min-h-[85px] w-full resize-none rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition placeholder:text-textMuted focus:border-accent"
              />
            </label>

            <label className="mt-3 block text-sm font-semibold text-textMain">
              Pin op datum (optioneel)
              <input
                type="date"
                value={draft.pinDate}
                disabled={!canEditRoutes}
                onChange={(event) =>
                  updateDraft(draft.id, (current) => ({
                    ...current,
                    pinDate: event.target.value,
                    hasConflict: false,
                    isSaved: false,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
              />
            </label>

            {draft.error ? <p className="mt-2 text-xs font-semibold text-red-400">{draft.error}</p> : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void saveDraft(draft.id, false)}
                disabled={!canEditRoutes || draft.isSaving}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {draft.isSaving ? 'Opslaan...' : 'Opslaan'}
              </button>

              {draft.hasConflict ? (
                <button
                  type="button"
                  onClick={() => void saveDraft(draft.id, true)}
                  className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent"
                >
                  Overschrijven
                </button>
              ) : null}
            </div>
          </article>
        ))}

        <button
          type="button"
          onClick={() => setDrafts((current) => [...current, createDraft(effectiveGroupKey)])}
          disabled={!canEditRoutes || !canAddMore}
          className="grid min-h-[420px] place-items-center rounded-xl2 border border-dashed border-line bg-panel/60 p-4 text-textMuted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div className="text-center">
            <p className="text-4xl font-light">+</p>
            <p className="mt-1 text-sm font-semibold">Extra rit toevoegen</p>
          </div>
        </button>
      </div>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panelSoft/60 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-textMuted">{label}</p>
      <p className="mt-1 text-sm font-bold text-textMain">{value}</p>
    </div>
  );
}
