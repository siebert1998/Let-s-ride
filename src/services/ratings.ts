import { getSupabaseClient } from '../lib/supabase';

const RATINGS_TABLE = 'ride_ratings';
const RATER_ID_STORAGE_KEY = 'letsride:rater-id:v1';

interface RideRatingRow {
  slot_key: string;
  rater_id: string;
  score: number;
}

export interface RideRatingSummary {
  averageScore: number | null;
  votes: number;
  myScore: number | null;
}

const generateRaterId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `rater-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getOrCreateRaterId = (): string => {
  const existing = localStorage.getItem(RATER_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = generateRaterId();
  localStorage.setItem(RATER_ID_STORAGE_KEY, created);
  return created;
};

export const fetchRideRatingSummaries = async (
  slotKeys: string[],
  raterId: string,
): Promise<Record<string, RideRatingSummary>> => {
  const uniqueSlotKeys = [...new Set(slotKeys)];
  if (uniqueSlotKeys.length === 0) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(RATINGS_TABLE)
    .select('slot_key, rater_id, score')
    .in('slot_key', uniqueSlotKeys)
    .returns<RideRatingRow[]>();

  if (error) {
    throw new Error(`Could not load ride ratings: ${error.message}`);
  }

  const summaries: Record<string, RideRatingSummary> = {};
  uniqueSlotKeys.forEach((slotKey) => {
    summaries[slotKey] = {
      averageScore: null,
      votes: 0,
      myScore: null,
    };
  });

  (data ?? []).forEach((rating) => {
    const current = summaries[rating.slot_key];
    if (!current) {
      return;
    }

    const totalScore = (current.averageScore ?? 0) * current.votes + rating.score;
    const nextVotes = current.votes + 1;
    current.votes = nextVotes;
    current.averageScore = totalScore / nextVotes;

    if (rating.rater_id === raterId) {
      current.myScore = rating.score;
    }
  });

  return summaries;
};

export const upsertRideRating = async (slotKey: string, raterId: string, score: number): Promise<void> => {
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    throw new Error('Score moet tussen 0 en 10 liggen.');
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(RATINGS_TABLE).upsert(
    {
      slot_key: slotKey,
      rater_id: raterId,
      score: Math.round(score * 10) / 10,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key,rater_id' },
  );

  if (error) {
    throw new Error(`Could not save rating: ${error.message}`);
  }
};

