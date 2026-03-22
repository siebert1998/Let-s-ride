import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  fetchCompletedRidesByGroup,
  type SyncedRoute,
  updateRideHistoryDetails,
} from '../services/routes';
import {
  fetchRideRatingSummaries,
  getOrCreateRaterId,
  upsertRideRating,
  type RideRatingSummary,
} from '../services/ratings';
import { deleteRidePhotoByUrl, uploadRidePhoto } from '../services/photoStorage';
import { optimizeImageForUpload } from '../utils/image';

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

const parseDateKey = (dateKey: string | null): Date | null => {
  if (!dateKey) {
    return null;
  }

  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatRideDate = (dateKey: string | null): string => {
  if (!dateKey) {
    return 'Unknown date';
  }

  const date = parseDateKey(dateKey);
  if (!date) {
    return dateKey;
  }

  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const isPastDateKey = (dateKey: string | null): boolean => {
  const rideDate = parseDateKey(dateKey);
  if (!rideDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rideDate.getTime() < today.getTime();
};

const getMonthKey = (date: Date | null): string => {
  if (!date) {
    return 'unknown';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonthLabel = (monthKey: string): string => {
  if (monthKey === 'unknown') {
    return 'Onbekende maand';
  }

  const [year, month] = monthKey.split('-');
  const monthDate = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat('nl-BE', {
    month: 'long',
    year: 'numeric',
  }).format(monthDate);
};

export function RideHistoryPage({ selectedGroup }: RideHistoryPageProps): JSX.Element {
  const [rides, setRides] = useState<SyncedRoute[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [ratingSummaries, setRatingSummaries] = useState<Record<string, RideRatingSummary>>({});
  const raterId = useMemo(() => getOrCreateRaterId(), []);

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

  useEffect(() => {
    let cancelled = false;

    const loadRatings = async (): Promise<void> => {
      try {
        const summaries = await fetchRideRatingSummaries(
          rides.map((ride) => ride.slotKey),
          raterId,
        );

        if (!cancelled) {
          setRatingSummaries(summaries);
        }
      } catch {
        if (!cancelled) {
          setRatingSummaries({});
        }
      }
    };

    void loadRatings();

    return () => {
      cancelled = true;
    };
  }, [rides, raterId]);

  const rideSections = useMemo(() => {
    const sortedRides = [...rides].sort((a, b) => {
      const dateA = parseDateKey(extractRideDateFromSlotKey(a.slotKey));
      const dateB = parseDateKey(extractRideDateFromSlotKey(b.slotKey));

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA.getTime() - dateB.getTime();
    });

    const sections: Array<{ monthKey: string; monthLabel: string; rides: SyncedRoute[] }> = [];

    sortedRides.forEach((ride) => {
      const rideDate = parseDateKey(extractRideDateFromSlotKey(ride.slotKey));
      const monthKey = getMonthKey(rideDate);
      const existingSection = sections.find((section) => section.monthKey === monthKey);

      if (existingSection) {
        existingSection.rides.push(ride);
        return;
      }

      sections.push({
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        rides: [ride],
      });
    });

    return sections;
  }, [rides]);

  const hasRides = useMemo(() => rideSections.length > 0, [rideSections]);

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

      {rideSections.map((section) => (
        <div key={section.monthKey} className="space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-textMuted">{section.monthLabel}</h3>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {section.rides.map((ride) => (
              <RideHistoryCard
                key={ride.slotKey}
                ride={ride}
                ratingSummary={ratingSummaries[ride.slotKey] ?? { averageScore: null, votes: 0, myScore: null }}
                raterId={raterId}
                onRatingSaved={(score) => {
                  setRatingSummaries((currentSummaries) => {
                    const previous =
                      currentSummaries[ride.slotKey] ?? { averageScore: null, votes: 0, myScore: null };
                    const previousVotes = previous.votes;
                    const previousTotal = (previous.averageScore ?? 0) * previousVotes;
                    const nextVotes = previous.myScore == null ? previousVotes + 1 : previousVotes;
                    const nextTotal =
                      previous.myScore == null ? previousTotal + score : previousTotal - previous.myScore + score;

                    return {
                      ...currentSummaries,
                      [ride.slotKey]: {
                        averageScore: nextVotes > 0 ? nextTotal / nextVotes : null,
                        votes: nextVotes,
                        myScore: score,
                      },
                    };
                  });
                }}
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
        </div>
      ))}
    </section>
  );
}

interface RideHistoryCardProps {
  ride: SyncedRoute;
  ratingSummary: RideRatingSummary;
  raterId: string;
  onRatingSaved: (score: number) => void;
  onSaved: (comment: string, photos: string[]) => void;
}

function RideHistoryCard({ ride, ratingSummary, raterId, onRatingSaved, onSaved }: RideHistoryCardProps): JSX.Element {
  const [comment, setComment] = useState<string>(ride.historyComment);
  const [photos, setPhotos] = useState<string[]>(ride.photos);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState<boolean>(false);
  const [ratingInput, setRatingInput] = useState<string>(ratingSummary.myScore?.toString() ?? '');
  const [isSavingRating, setIsSavingRating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    setComment(ride.historyComment);
    setPhotos(ride.photos);
  }, [ride.historyComment, ride.photos]);

  useEffect(() => {
    setRatingInput(ratingSummary.myScore?.toString() ?? '');
  }, [ratingSummary.myScore, ride.slotKey]);

  const rideDate = formatRideDate(extractRideDateFromSlotKey(ride.slotKey));
  const rideDateKey = extractRideDateFromSlotKey(ride.slotKey);
  const isRidePassed = isPastDateKey(rideDateKey);

  const handleRatingSave = async (): Promise<void> => {
    const parsed = Number(ratingInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
      setError('Geef een score tussen 0 en 10.');
      return;
    }

    setIsSavingRating(true);
    setError('');
    try {
      await upsertRideRating(ride.slotKey, raterId, parsed);
      onRatingSaved(parsed);
    } catch (ratingError) {
      setError(toErrorMessage(ratingError));
    } finally {
      setIsSavingRating(false);
    }
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setIsUploadingPhotos(true);
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const optimized = await optimizeImageForUpload(file);
          return uploadRidePhoto(ride.slotKey, optimized);
        }),
      );
      setPhotos((currentPhotos) => [...currentPhotos, ...urls].slice(0, 10));
      setError('');
    } catch (uploadError) {
      setError(toErrorMessage(uploadError));
    } finally {
      setIsUploadingPhotos(false);
      event.target.value = '';
    }
  };

  const handlePhotoRemove = async (index: number): Promise<void> => {
    const photoToRemove = photos[index];
    setPhotos((currentPhotos) => currentPhotos.filter((_, photoIndex) => photoIndex !== index));

    try {
      await deleteRidePhotoByUrl(photoToRemove);
    } catch {
      // Keep UI responsive even if cleanup fails.
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
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            isRidePassed
              ? 'border border-accent/50 bg-accent/10 text-accent'
              : 'border border-line bg-panelSoft text-textMuted'
          }`}
        >
          {isRidePassed ? 'Gereden' : 'Gepland'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric label="Distance" value={formatDistance(ride.distanceKm)} />
        <Metric label="Elevation" value={formatElevation(ride.elevationGainM)} />
      </div>

      <div className="mt-3 rounded-lg border border-line bg-panelSoft p-3">
        <p className="text-xs font-semibold text-textMuted">
          Rating gemiddeld:{' '}
          <span className="text-textMain">
            {ratingSummary.averageScore == null ? '--' : `${ratingSummary.averageScore.toFixed(1)}/10`} ({ratingSummary.votes})
          </span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={ratingInput}
            onChange={(event) => setRatingInput(event.target.value)}
            className="w-24 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void handleRatingSave()}
            disabled={isSavingRating}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingRating ? 'Opslaan...' : 'Score opslaan'}
          </button>
        </div>
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
          {isUploadingPhotos ? 'Foto\'s uploaden...' : 'Voeg foto\'s toe'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handlePhotoUpload(event)}
            disabled={isUploadingPhotos}
          />
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
                  onClick={() => void handlePhotoRemove(index)}
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
        disabled={isSaving || isUploadingPhotos}
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
