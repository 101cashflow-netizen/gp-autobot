import { supabaseAdmin } from "@/lib/supabase/server";
import { GRAPH_BASE } from "@/lib/facebook/oauth";
import type { AppSettings, FacebookGroup } from "@/lib/types";
import { bulkUpsertGroups } from "@/lib/db/groups";

async function loadSettings(): Promise<AppSettings> {
  const db = supabaseAdmin();
  const { data } = await db.from("app_settings").select("*").eq("id", 1).single<AppSettings>();
  if (!data) throw new Error("Settings row is missing.");
  return data;
}

async function graph(path: string, params: Record<string, string>, init?: RequestInit) {
  const url = `${GRAPH_BASE}${path}`;
  const res = await fetch(init?.method === "POST" ? url : `${url}?${new URLSearchParams(params)}`, {
    ...init,
    ...(init?.method === "POST"
      ? {
          headers: { "Content-Type": "application/x-www-form-urlencoded", ...init?.headers },
          body: new URLSearchParams(params),
        }
      : {}),
    signal: AbortSignal.timeout(30_000),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message ?? `Facebook API ${path} failed (${res.status})`);
  }
  return body;
}

/**
 * Fetches all groups where the connected account is a member or admin (/me/groups).
 * This includes secret/private hidden groups that the user is already part of.
 */
export async function syncUserGroups(): Promise<{ total: number; groups: FacebookGroup[] }> {
  const settings = await loadSettings();
  if (!settings.facebook_user_token) {
    throw new Error("Facebook não está conectado. Conecte sua conta nas Configurações primeiro.");
  }

  const foundGroups: Array<Partial<FacebookGroup> & { id: string; name: string }> = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      access_token: settings.facebook_user_token,
      fields: "id,name,description,privacy,administrator,member_count,icon,cover",
      limit: "100",
    };
    if (after) params.after = after;

    const data = await graph("/me/groups", params);
    for (const g of data.data ?? []) {
      const isSecret = g.privacy === "SECRET" || g.privacy === "CLOSED_SECRET";
      foundGroups.push({
        id: g.id,
        name: g.name,
        description: g.description ?? null,
        privacy: g.privacy ?? "UNKNOWN",
        status: g.administrator ? "ADMIN" : "MEMBER",
        member_count: g.member_count ?? 0,
        group_url: `https://www.facebook.com/groups/${g.id}`,
        icon_url: g.icon ?? g.cover?.source ?? null,
        can_post: true,
        is_secret: isSecret,
      });
    }

    after = data.paging?.cursors?.after && data.paging?.next ? data.paging.cursors.after : undefined;
  } while (after);

  if (foundGroups.length > 0) {
    await bulkUpsertGroups(foundGroups);
  }

  return {
    total: foundGroups.length,
    groups: foundGroups as FacebookGroup[],
  };
}

export interface PublishGroupInput {
  groupId: string;
  message: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  linkUrl?: string | null;
}

/**
 * Publishes a post directly to a Facebook Group feed.
 */
export async function publishToGroup(input: PublishGroupInput): Promise<{ id: string }> {
  const settings = await loadSettings();
  if (!settings.facebook_user_token) {
    throw new Error("Facebook não está conectado. Conecte sua conta primeiro.");
  }

  const token = settings.facebook_user_token;

  if (input.imageUrl) {
    // Post foto no grupo
    const data = await graph(
      `/${input.groupId}/photos`,
      {
        url: input.imageUrl,
        caption: input.message,
        access_token: token,
      },
      { method: "POST" }
    );
    return { id: data.post_id ?? data.id };
  }

  if (input.videoUrl) {
    // Post vídeo no grupo
    const data = await graph(
      `/${input.groupId}/videos`,
      {
        file_url: input.videoUrl,
        description: input.message,
        access_token: token,
      },
      { method: "POST" }
    );
    return { id: data.id };
  }

  // Post texto / link no grupo
  const params: Record<string, string> = {
    message: input.message,
    access_token: token,
  };
  if (input.linkUrl) {
    params.link = input.linkUrl;
  }

  const data = await graph(`/${input.groupId}/feed`, params, { method: "POST" });
  return { id: data.id };
}
