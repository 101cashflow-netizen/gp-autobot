import { supabaseAdmin } from "@/lib/supabase/server";
import type { FacebookGroup } from "@/lib/types";

export async function listGroups(filter?: {
  status?: string;
  category?: string;
  canPostOnly?: boolean;
}): Promise<FacebookGroup[]> {
  const db = supabaseAdmin();
  let query = db.from("facebook_groups").select("*").order("name", { ascending: true });

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.category) {
    query = query.eq("category", filter.category);
  }
  if (filter?.canPostOnly) {
    query = query.eq("can_post", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FacebookGroup[];
}

export async function getGroup(id: string): Promise<FacebookGroup | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("facebook_groups").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as FacebookGroup | null;
}

export async function upsertGroup(group: Partial<FacebookGroup> & { id: string; name: string }): Promise<FacebookGroup> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("facebook_groups")
    .upsert(
      {
        ...group,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as FacebookGroup;
}

export async function bulkUpsertGroups(groups: Array<Partial<FacebookGroup> & { id: string; name: string }>): Promise<number> {
  if (groups.length === 0) return 0;
  const db = supabaseAdmin();
  const rows = groups.map((g) => ({
    ...g,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from("facebook_groups").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return groups.length;
}

export async function deleteGroup(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("facebook_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateGroupStatus(id: string, updates: Partial<FacebookGroup>): Promise<FacebookGroup> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("facebook_groups")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as FacebookGroup;
}

export async function recordGroupPostSuccess(id: string): Promise<void> {
  const db = supabaseAdmin();
  const group = await getGroup(id);
  const postCount = (group?.post_count ?? 0) + 1;

  await db
    .from("facebook_groups")
    .update({
      post_count: postCount,
      last_posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}
