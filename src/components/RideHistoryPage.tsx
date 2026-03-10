import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  fetchCompletedRidesByGroup,
  type SyncedRoute,
  updateRideHistoryDetails,
} from '../services/routes';

interface RideHistoryPageProps {
  selectedGroup: string;
}

const formatDistance = (distanceKm: number | null): string =>
  typeof distanceKm === 'number' ? `${distanceKm.toFixed(2)} km` : '--';

const formatElevation = (elevationGainM: number | null): string =>
  typeof elevationGainM === 'number' ? `${Math.round(elevationGainM)} m` : '--';

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not complete this action.';

const extractRideDateFromSlotKey = (slotKey: string): string | null => {
  const marker = '-day-';
  const markerIndex = slotKey.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return slotKey.slice(markerIndex + marker.length);
};

const formatRideDate = (dateKey: string | null): string => {
  if (!dateKey) {
    return 'Unknown date';
  }

  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

export function RideHistoryPage({ selectedGroup }: RideHistoryPageProps): JSX.Element {
  const [rides, setRides] = useState<SyncedRoute[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadRides = async (): Promise<void> => {
      setIsLoading(true);
      setError('');

      try {
        const data = await fetchCompletedRidesByGroup(selectedGroup);
        if (!cancelled) {
          setRides(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
          setRides([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRides();

    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  const hasRides = useMemo(() => rides.length > 0, [rides]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
        <h2 className="text-xl font-extrabold text-textMain">Ritgeschiedenis</h2>
        <p className="mt-1 text-sm text-textMuted">
          Hier verschijnen ritten die effectief gereden zijn (een rit telt als gereden zodra er een GPX is geupload).
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      ) : null}

      {isLoading ? <p className="text-sm text-textMuted">Ritten laden...</p> : null}

      {!isLoading && !hasRides ? (
        <div className="rounded-xl2 border border-line/80 bg-panel/95 p-4 text-sm text-textMuted shadow-card">
          Nog geen gereden ritten voor deze groep.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rides.map((ride) => (
          <RideHistoryCard
            key={ride.slotKey}
            ride={ride}
            onSaved={(comment, photos) => {
              setRides((currentRides) =>
                currentRides.map((currentRide) =>
                  currentRide.slotKey === ride.slotKey
                    ? { ...currentRide, historyComment: comment, photos, updatedAt: new Date().toISOString() }
                    : currentRide,
                ),
              );
            }}
          />
        ))}
      </div>
    </section>
  );
}

interface RideHistoryCardProps {
  ride: SyncedRoute;
  onSaved: (comment: string, photos: string[]) => void;
}

function RideHistoryCard({ ride, onSaved }: RideHistoryCardProps): JSX.Element {
  const [comment, setComment] = useState<string>(ride.historyComment);
  const [photos, setPhotos] = useState<string[]>(ride.photos);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    setComment(ride.historyComment);
    setPhotos(ride.photos);
  }, [ride.historyComment, ride.photos]);

  const rideDate = formatRideDate(extractRideDateFromSlotKey(ride.slotKey));

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    try {
      const urls = await Promise.all(files.map(readAsDataUrl));
      setPhotos((currentPhotos) => [...currentPhotos, ...urls].slice(0, 10));
      setError('');
    } catch (uploadError) {
      setError(toErrorMessage(uploadError));
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError('');

    try {
      await updateRideHistoryDetails(ride.slotKey, comment, photos);
      onSaved(comment, photos);
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="rounded-xl2 border border-line/80 bg-panel/95 p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-textMain">{ride.title}</h3>
          <p className="text-xs text-textMuted">{rideDate}</p>
        </div>
        <span className="rounded-md border border-accent/50 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
          Gereden
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric label="Distance" value={formatDistance(ride.distanceKm)} />
        <Metric label="Elevation" value={formatElevation(ride.elevationGainM)} />
      </div>

      <label className="mt-3 block text-sm font-semibold text-textMain">
        Opmerkingen
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Hoe verliep de rit?"
          className="mt-2 min-h-[90px] w-full resize-none rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition placeholder:text-textMuted focus:border-accent"
        />
      </label>

      <div className="mt-3">
        <p className="text-sm font-semibold text-textMain">Foto&apos;s</p>
        <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-textMain transition hover:border-accent hover:text-accent">
          Voeg foto&apos;s toe
          <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handlePhotoUpload(event)} />
        </label>

        {photos.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <div key={`${ride.slotKey}-photo-${index}`} className="relative overflow-hidden rounded-lg border border-line">
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  className="block w-full"
                  aria-label={`Bekijk foto ${index + 1} groot`}
                >
                  <img src={photo} alt={`Ride photo ${index + 1}`} className="h-24 w-full object-cover" />
                </button>
                <a
                  href={photo}
                  download={`rit-${ride.title.replace(/\s+/g, '-').toLowerCase()}-foto-${index + 1}.jpg`}
                  className="absolute bottom-1 left-1 rounded bg-black/80 px-2 py-1 text-[10px] font-semibold text-white"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPhotos((currentPhotos) => currentPhotos.filter((_, photoIndex) => photoIndex !== index))}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/80 text-white"
                  aria-label="Delete photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-textMuted">Nog geen foto&apos;s toegevoegd.</p>
        )}
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Opslaan...' : 'Opslaan'}
      </button>

      {selectedPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-4xl rounded-xl border border-line bg-panel p-3">
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black text-white"
              aria-label="Sluit grote foto"
            >
              ×
            </button>
            <img src={selectedPhoto} alt="Grote ritfoto" className="max-h-[75vh] w-full rounded-lg object-contain" />
            <div className="mt-3 flex justify-end">
              <a
                href={selectedPhoto}
                download={`rit-${ride.title.replace(/\s+/g, '-').toLowerCase()}-foto-groot.jpg`}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accentStrong"
              >
                Download foto
              </a>
            </div>
          </div>
        </div>
      ) : null}
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
