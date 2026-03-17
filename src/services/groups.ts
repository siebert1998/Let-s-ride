import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

export type GroupVisibility = 'open' | 'closed';
export type MembershipStatus = 'pending' | 'active' | 'rejected';
export type MembershipRole = 'member' | 'admin';

export interface AppGroup {
  id: string;
  slug: string;
  name: string;
  mainGroup: string;
  subgroup: string | null;
  visibilityType: GroupVisibility;
  effectiveGroupKey: string;
}

export interface GroupMembership {
  id: string;
  groupId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
}

export interface CreateGroupInput {
  name: string;
  mainGroup: string;
  subgroup?: string;
  visibilityType: GroupVisibility;
}

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  main_group: string;
  subgroup: string | null;
  visibility_type: GroupVisibility;
  effective_group_key: string;
}

interface MembershipRow {
  id: string;
  group_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
}

const GROUPS_TABLE = 'groups';
const MEMBERSHIPS_TABLE = 'group_memberships';
const PROFILES_TABLE = 'profiles';
const GLOBAL_ADMIN_EMAIL = 'siebert@telenet.be';

const mapGroup = (row: GroupRow): AppGroup => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  mainGroup: row.main_group,
  subgroup: row.subgroup,
  visibilityType: row.visibility_type,
  effectiveGroupKey: row.effective_group_key,
});

const mapMembership = (row: MembershipRow): GroupMembership => ({
  id: row.id,
  groupId: row.group_id,
  userId: row.user_id,
  role: row.role,
  status: row.status,
});

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const ensureProfileForUser = async (user: User): Promise<void> => {
  const supabase = getSupabaseClient();
  const displayName = user.email?.split('@')[0] ?? 'Member';

  const { error } = await supabase.from(PROFILES_TABLE).upsert(
    {
      user_id: user.id,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw new Error(`Could not upsert profile: ${error.message}`);
  }
};

export const ensureGlobalAdminAccessIfEligible = async (user: User): Promise<void> => {
  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail !== GLOBAL_ADMIN_EMAIL) {
    return;
  }

  const supabase = getSupabaseClient();
  const { data: groups, error: groupsError } = await supabase
    .from(GROUPS_TABLE)
    .select('id')
    .returns<Array<{ id: string }>>();

  if (groupsError) {
    throw new Error(`Could not load groups for admin bootstrap: ${groupsError.message}`);
  }

  const payload = (groups ?? []).map((group) => ({
    user_id: user.id,
    group_id: group.id,
    role: 'admin',
    status: 'active',
    updated_at: new Date().toISOString(),
  }));

  if (payload.length === 0) {
    return;
  }

  const { error } = await supabase.from(MEMBERSHIPS_TABLE).upsert(payload, { onConflict: 'user_id,group_id' });

  if (error) {
    throw new Error(`Could not grant global admin access: ${error.message}`);
  }
};

export const fetchGroups = async (searchTerm: string, visibilityFilter: 'all' | GroupVisibility): Promise<AppGroup[]> => {
  const supabase = getSupabaseClient();

  let query = supabase
    .from(GROUPS_TABLE)
    .select('id, slug, name, main_group, subgroup, visibility_type, effective_group_key')
    .order('name', { ascending: true });

  if (visibilityFilter !== 'all') {
    query = query.eq('visibility_type', visibilityFilter);
  }

  if (searchTerm.trim().length > 0) {
    const escaped = searchTerm.trim().replace(/,/g, '');
    query = query.or(`name.ilike.%${escaped}%,main_group.ilike.%${escaped}%,subgroup.ilike.%${escaped}%`);
  }

  const { data, error } = await query.returns<GroupRow[]>();

  if (error) {
    throw new Error(`Could not load groups: ${error.message}`);
  }

  return (data ?? []).map(mapGroup);
};

export const fetchGroupBySlug = async (slug: string): Promise<AppGroup | null> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(GROUPS_TABLE)
    .select('id, slug, name, main_group, subgroup, visibility_type, effective_group_key')
    .eq('slug', slug)
    .maybeSingle<GroupRow>();

  if (error) {
    throw new Error(`Could not load group by slug: ${error.message}`);
  }

  return data ? mapGroup(data) : null;
};

export const fetchMembershipsForUser = async (userId: string): Promise<GroupMembership[]> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(MEMBERSHIPS_TABLE)
    .select('id, group_id, user_id, role, status')
    .eq('user_id', userId)
    .returns<MembershipRow[]>();

  if (error) {
    throw new Error(`Could not load memberships: ${error.message}`);
  }

  return (data ?? []).map(mapMembership);
};

export const fetchMembershipForGroup = async (userId: string, groupId: string): Promise<GroupMembership | null> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(MEMBERSHIPS_TABLE)
    .select('id, group_id, user_id, role, status')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle<MembershipRow>();

  if (error) {
    throw new Error(`Could not load membership: ${error.message}`);
  }

  return data ? mapMembership(data) : null;
};

export const requestJoinGroup = async (userId: string, group: AppGroup): Promise<MembershipStatus> => {
  const supabase = getSupabaseClient();
  const targetStatus: MembershipStatus = group.visibilityType === 'open' ? 'active' : 'pending';

  const { error } = await supabase.from(MEMBERSHIPS_TABLE).upsert(
    {
      user_id: userId,
      group_id: group.id,
      role: 'member',
      status: targetStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,group_id' },
  );

  if (error) {
    throw new Error(`Could not request membership: ${error.message}`);
  }

  return targetStatus;
};

export const fetchPendingMembershipsForGroup = async (
  groupId: string,
): Promise<Array<GroupMembership & { displayName: string }>> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(MEMBERSHIPS_TABLE)
    .select('id, group_id, user_id, role, status, profiles(display_name)')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .returns<Array<MembershipRow & { profiles: { display_name: string | null } | null }>>();

  if (error) {
    throw new Error(`Could not load pending memberships: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...mapMembership(row),
    displayName: row.profiles?.display_name ?? row.user_id,
  }));
};

export const setMembershipStatus = async (membershipId: string, status: MembershipStatus): Promise<void> => {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from(MEMBERSHIPS_TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', membershipId);

  if (error) {
    throw new Error(`Could not update membership status: ${error.message}`);
  }
};

export const createGroupAndJoinAsAdmin = async (userId: string, input: CreateGroupInput): Promise<AppGroup> => {
  const supabase = getSupabaseClient();
  const baseName = input.name.trim();

  if (!baseName) {
    throw new Error('Groepsnaam is verplicht.');
  }

  const cleanSubgroup = input.subgroup?.trim() || null;
  const suffix = Date.now().toString(36);
  const rawSlug = cleanSubgroup ? `${baseName}-${cleanSubgroup}` : baseName;
  const slug = `${slugify(rawSlug)}-${suffix}`;
  const effectiveGroupKey = cleanSubgroup ? `${input.mainGroup}-${cleanSubgroup}` : input.mainGroup;

  const { data: createdGroup, error: createGroupError } = await supabase
    .from(GROUPS_TABLE)
    .insert({
      slug,
      name: baseName,
      main_group: input.mainGroup,
      subgroup: cleanSubgroup,
      visibility_type: input.visibilityType,
      effective_group_key: `${effectiveGroupKey}-${suffix}`,
    })
    .select('id, slug, name, main_group, subgroup, visibility_type, effective_group_key')
    .single<GroupRow>();

  if (createGroupError || !createdGroup) {
    throw new Error(`Could not create group: ${createGroupError?.message ?? 'Unknown error'}`);
  }

  const { error: membershipError } = await supabase.from(MEMBERSHIPS_TABLE).insert({
    user_id: userId,
    group_id: createdGroup.id,
    role: 'admin',
    status: 'active',
    updated_at: new Date().toISOString(),
  });

  if (membershipError) {
    throw new Error(`Could not assign admin membership: ${membershipError.message}`);
  }

  return mapGroup(createdGroup);
};
