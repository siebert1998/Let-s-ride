import { getSupabaseClient } from '../lib/supabase';

const ROUTES_TABLE = 'ride_routes';

interface RideRouteRow {
  slot_key: string;
  title: string;
  notes: string;
  file_name: string | null;
  gpx_text: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  history_comment: string | null;
  photos: unknown;
  updated_at: string;
}

export interface SyncedRoute {
  slotKey: string;
  title: string;
  notes: string;
  fileName: string | null;
  gpxText: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  historyComment: string;
  photos: string[];
  updatedAt: string;
}

export interface UpsertRouteInput {
  slotKey: string;
  title: string;
  notes: string;
  fileName: string | null;
  gpxText: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
}

const normalizePhotos = (photosValue: unknown): string[] => {
  if (!Array.isArray(photosValue)) {
    return [];
  }

  return photosValue.filter((photo): photo is string => typeof photo === 'string');
};

const toSyncedRoute = (row: RideRouteRow): SyncedRoute => ({
  slotKey: row.slot_key,
  title: row.title,
  notes: row.notes,
  fileName: row.file_name,
  gpxText: row.gpx_text,
  distanceKm: row.distance_km,
  elevationGainM: row.elevation_gain_m,
  historyComment: row.history_comment ?? '',
  photos: normalizePhotos(row.photos),
  updatedAt: row.updated_at,
});

const selectFields =
  'slot_key, title, notes, file_name, gpx_text, distance_km, elevation_gain_m, history_comment, photos, updated_at';

export const fetchRouteBySlot = async (slotKey: string): Promise<SyncedRoute | null> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(ROUTES_TABLE)
    .select(selectFields)
    .eq('slot_key', slotKey)
    .maybeSingle<RideRouteRow>();

  if (error) {
    throw new Error(`Could not load route: ${error.message}`);
  }

  return data ? toSyncedRoute(data) : null;
};

export const fetchCompletedRidesByGroup = async (group: string): Promise<SyncedRoute[]> => {
  const supabase = getSupabaseClient();
  const prefix = `group-${group}-day-`;

  const { data, error } = await supabase
    .from(ROUTES_TABLE)
    .select(selectFields)
    .like('slot_key', `${prefix}%`)
    .not('gpx_text', 'is', null)
    .order('updated_at', { ascending: false })
    .returns<RideRouteRow[]>();

  if (error) {
    throw new Error(`Could not load ride history: ${error.message}`);
  }

  return (data ?? []).map(toSyncedRoute);
};

export const updateRideHistoryDetails = async (
  slotKey: string,
  historyComment: string,
  photos: string[],
): Promise<void> => {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from(ROUTES_TABLE)
    .update({ history_comment: historyComment, photos, updated_at: new Date().toISOString() })
    .eq('slot_key', slotKey);

  if (error) {
    throw new Error(`Could not update ride history details: ${error.message}`);
  }
};

export const upsertRouteForSlot = async (input: UpsertRouteInput): Promise<void> => {
  const supabase = getSupabaseClient();
  const cleanedNotes = input.notes.trim();

  if (!input.gpxText && cleanedNotes.length === 0) {
    const { error } = await supabase.from(ROUTES_TABLE).delete().eq('slot_key', input.slotKey);

    if (error) {
      throw new Error(`Could not remove empty route: ${error.message}`);
    }

    return;
  }

  const payload = {
    slot_key: input.slotKey,
    title: input.title,
    notes: input.notes,
    file_name: input.fileName,
    gpx_text: input.gpxText,
    distance_km: input.distanceKm,
    elevation_gain_m: input.elevationGainM,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(ROUTES_TABLE).upsert(payload, { onConflict: 'slot_key' });

  if (error) {
    throw new Error(`Could not save route: ${error.message}`);
  }
};
