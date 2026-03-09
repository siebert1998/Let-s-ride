import { useCallback, useEffect, useState } from 'react';
import type { ParsedRoute } from '../types';
import { parseGpxContent } from '../utils/gpx';
import { fetchRouteBySlot, upsertRouteForSlot } from '../services/routes';
import { RouteMap } from './RouteMap';
import { UploadDropzone } from './UploadDropzone';

interface RouteCardProps {
  title: string;
  storageId: string;
  initialNotes?: string;
}

interface SourceFileState {
  name: string;
  gpxText: string;
}

interface PersistOverrides {
  notes?: string;
  sourceFile?: SourceFileState | null;
  routeData?: ParsedRoute | null;
}

const formatDistance = (distanceKm: number): string => `${distanceKm.toFixed(2)} km`;
const formatElevation = (elevationGainM: number): string => `${Math.round(elevationGainM)} m`;

const formatSyncedAt = (isoDate: string): string =>
  new Intl.DateTimeFormat('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not sync this route.';
};

export function RouteCard({ title, storageId, initialNotes = '' }: RouteCardProps): JSX.Element {
  const [routeData, setRouteData] = useState<ParsedRoute | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [sourceFile, setSourceFile] = useState<SourceFileState | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadRoute = async (): Promise<void> => {
      setError('');
      setIsLoading(true);
      setIsBootstrapped(false);

      try {
        const syncedRoute = await fetchRouteBySlot(storageId);

        if (isCancelled) {
          return;
        }

        if (!syncedRoute) {
          setNotes(initialNotes);
          setRouteData(null);
          setSourceFile(null);
          setLastSyncedAt(null);
          return;
        }

        setNotes(syncedRoute.notes ?? initialNotes);
        setLastSyncedAt(syncedRoute.updatedAt);

        if (syncedRoute.gpxText && syncedRoute.fileName) {
          const parsed = parseGpxContent(syncedRoute.gpxText);
          setRouteData(parsed);
          setSourceFile({ name: syncedRoute.fileName, gpxText: syncedRoute.gpxText });
        } else {
          setRouteData(null);
          setSourceFile(null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(toErrorMessage(loadError));
          setNotes(initialNotes);
          setRouteData(null);
          setSourceFile(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsBootstrapped(true);
        }
      }
    };

    void loadRoute();

    return () => {
      isCancelled = true;
    };
  }, [initialNotes, storageId]);

  useEffect(() => {
    if (!sourceFile) {
      setDownloadUrl(null);
      return;
    }

    const blob = new Blob([sourceFile.gpxText], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [sourceFile]);

  const persistRoute = useCallback(
    async (overrides: PersistOverrides = {}): Promise<void> => {
      const nextNotes = overrides.notes ?? notes;
      const nextSourceFile = overrides.sourceFile !== undefined ? overrides.sourceFile : sourceFile;
      const nextRouteData = overrides.routeData !== undefined ? overrides.routeData : routeData;

      setIsSaving(true);
      setError('');

      try {
        await upsertRouteForSlot({
          slotKey: storageId,
          title,
          notes: nextNotes,
          fileName: nextSourceFile?.name ?? null,
          gpxText: nextSourceFile?.gpxText ?? null,
          distanceKm: nextRouteData?.distanceKm ?? null,
          elevationGainM: nextRouteData?.elevationGainM ?? null,
        });

        setLastSyncedAt(new Date().toISOString());
      } catch (saveError) {
        setError(toErrorMessage(saveError));
      } finally {
        setIsSaving(false);
      }
    },
    [notes, routeData, sourceFile, storageId, title],
  );

  const handleFileSelected = async (file: File): Promise<void> => {
    setError('');
    setIsLoading(true);

    try {
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        throw new Error('Only .gpx files are supported.');
      }

      const gpxText = await file.text();
      const parsed = parseGpxContent(gpxText);
      const nextSourceFile: SourceFileState = { name: file.name, gpxText };

      setRouteData(parsed);
      setSourceFile(nextSourceFile);

      await persistRoute({ sourceFile: nextSourceFile, routeData: parsed });
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : 'Unable to read GPX file.';
      setRouteData(null);
      setSourceFile(null);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGpx = async (): Promise<void> => {
    setRouteData(null);
    setSourceFile(null);
    await persistRoute({ sourceFile: null, routeData: null });
  };

  const statusLabel = isSaving ? 'Syncing...' : routeData ? 'Synced' : null;

  return (
    <article className="flex min-h-[420px] flex-col rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-extrabold tracking-wide text-textMain">{title}</h2>
        <div className="flex items-center gap-2">
          {statusLabel ? (
            <span className="rounded-md border border-accent/50 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
              {statusLabel}
            </span>
          ) : null}
          {sourceFile ? (
            <button
              type="button"
              onClick={() => void handleDeleteGpx()}
              aria-label="Delete GPX"
              className="grid h-7 w-7 place-items-center rounded-full bg-black text-white transition hover:bg-zinc-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <UploadDropzone onFileSelected={handleFileSelected} disabled={isLoading || isSaving} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric label="Distance" value={routeData ? formatDistance(routeData.distanceKm) : '--'} />
        <Metric label="Elevation" value={routeData ? formatElevation(routeData.elevationGainM) : '--'} />
      </div>

      <div className="mt-3 h-40 overflow-hidden rounded-xl border border-line/80 bg-shell/60">
        {routeData ? (
          <RouteMap points={routeData.points} />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-textMuted">
            {isLoading ? 'Loading route...' : 'Upload a GPX file to render the route map.'}
          </div>
        )}
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-red-400">{error}</p> : null}

      <label className="mt-3 flex flex-1 flex-col gap-2 text-sm font-semibold text-textMain">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (isBootstrapped) {
              void persistRoute();
            }
          }}
          placeholder="Road condition, pace plan, meetup notes..."
          className="min-h-[82px] flex-1 resize-none rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none ring-0 transition placeholder:text-textMuted focus:border-accent"
        />
      </label>

      <div className="mt-2 text-[11px] text-textMuted">
        {lastSyncedAt ? `Last sync: ${formatSyncedAt(lastSyncedAt)}` : 'Not synced yet'}
      </div>

      <a
        href={downloadUrl ?? undefined}
        download={sourceFile?.name ?? 'route.gpx'}
        aria-disabled={!downloadUrl}
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accentStrong aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
      >
        Download GPX
      </a>
    </article>
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
