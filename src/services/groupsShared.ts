import { getSupabaseClient } from '../lib/supabase';

const GROUPS_TABLE = 'groups';

export interface SharedGroup {
  id: string;
  slug: string;
  name: string;
  mainGroup: string;
  subgroup: string | null;
  visibilityType: 'open' | 'closed';
  effectiveGroupKey: string;
  adminRequiredForRideChanges: boolean;
}

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  main_group: string;
  subgroup: string | null;
  visibility_type: 'open' | 'closed';
  effective_group_key: string;
  admin_required_for_ride_changes: boolean;
  created_at: string;
}

interface UpsertGroupInput {
  slug: string;
  name: string;
  main_group: string;
  subgroup: string | null;
  visibility_type: 'open' | 'closed';
  effective_group_key: string;
  admin_required_for_ride_changes: boolean;
}

const selectFields =
  'id, slug, name, main_group, subgroup, visibility_type, effective_group_key, admin_required_for_ride_changes, created_at';

const toSharedGroup = (row: GroupRow): SharedGroup => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  mainGroup: row.main_group,
  subgroup: row.subgroup,
  visibilityType: row.visibility_type,
  effectiveGroupKey: row.effective_group_key,
  adminRequiredForRideChanges: row.admin_required_for_ride_changes,
});

const toUpsertRow = (group: SharedGroup): UpsertGroupInput => ({
  slug: group.slug,
  name: group.name,
  main_group: group.mainGroup,
  subgroup: group.subgroup,
  visibility_type: group.visibilityType,
  effective_group_key: group.effectiveGroupKey,
  admin_required_for_ride_changes: group.adminRequiredForRideChanges,
});

export const fetchSharedGroups = async (): Promise<SharedGroup[]> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(GROUPS_TABLE)
    .select(selectFields)
    .order('created_at', { ascending: true })
    .returns<GroupRow[]>();

  if (error) {
    throw new Error(`Could not load groups: ${error.message}`);
  }

  return (data ?? []).map(toSharedGroup);
};

export const upsertSharedGroups = async (groups: SharedGroup[]): Promise<void> => {
  if (groups.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.from(GROUPS_TABLE).upsert(groups.map(toUpsertRow), { onConflict: 'slug' });

  if (error) {
    throw new Error(`Could not save groups: ${error.message}`);
  }
};

