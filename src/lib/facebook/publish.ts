import { publishPhoto, publishVideo, publishText, NoPageSelectedError } from "@/lib/facebook/client";
import { publishToGroup } from "@/lib/facebook/groups";
import { getPost, updatePostRecord } from "@/lib/db/posts";
import { getSettings } from "@/lib/db/settings";
import { recordGroupPostSuccess } from "@/lib/db/groups";
import { composeMessage } from "@/lib/types";
import type { Post } from "@/lib/types";

/**
 * Publishes one queued post to its designated Facebook Group or Page.
 */
export async function publishPostNow(postId: string): Promise<Post> {
  const post = await getPost(postId);
  if (!post) throw new Error("Post not found.");

  const settings = await getSettings();
  const isGroupPost = post.target_type === "group" || (!post.page_id && (post.group_id || settings.default_group_id));

  if (isGroupPost) {
    const groupId = post.group_id ?? settings.default_group_id;
    if (!groupId) {
      return updatePostRecord(postId, {
        status: "failed",
        error_message: "Nenhum Grupo selecionado para publicação.",
      });
    }

    try {
      const message = composeMessage(post, settings.utm_suffix);
      const isVideo = post.media_type === "video";
      const result = await publishToGroup({
        groupId,
        message,
        imageUrl: !isVideo ? post.image_url : null,
        videoUrl: isVideo ? (post.media_url || post.image_url) : null,
        linkUrl: post.link_url,
      });

      await recordGroupPostSuccess(groupId).catch(() => {});

      return await updatePostRecord(postId, {
        status: "posted",
        facebook_post_id: result.id,
        posted_at: new Date().toISOString(),
        error_message: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido ao publicar no grupo.";
      return await updatePostRecord(postId, { status: "failed", error_message: message });
    }
  }

  // Post para Facebook Page
  const pageId = post.page_id ?? settings.default_page_id;
  const pageToken =
    post.page_id && post.page_id !== settings.default_page_id ? null : settings.default_page_token;

  if (!pageId || !pageToken) {
    return updatePostRecord(postId, {
      status: "failed",
      error_message: new NoPageSelectedError().message,
    });
  }

  try {
    const isVideo = post.media_type === "video";
    const isText = post.media_type === "text" || (!post.image_url && !post.media_url);

    let result: { id: string };
    if (isVideo && (post.media_url || post.image_url)) {
      result = await publishVideo({
        pageId,
        pageToken,
        description: composeMessage(post, settings.utm_suffix),
        videoUrl: post.media_url || post.image_url,
        title: post.title,
      });
    } else if (isText) {
      result = await publishText({
        pageId,
        pageToken,
        message: composeMessage(post, settings.utm_suffix),
        link: post.link_url || undefined,
      });
    } else {
      result = await publishPhoto({
        pageId,
        pageToken,
        message: composeMessage(post, settings.utm_suffix),
        imageUrl: post.image_url ?? "",
      });
    }

    return await updatePostRecord(postId, {
      status: "posted",
      facebook_post_id: result.id,
      posted_at: new Date().toISOString(),
      error_message: null,
    });
  } catch (err) {
    let message = err instanceof Error ? err.message : "Unknown error while posting.";

    if (/\(#200\)|permissions? error/i.test(message)) {
      message =
        "Facebook rejected this for missing permissions. The connected token needs " +
        "pages_manage_posts. Add it to your Meta app — and to the Login for Business " +
        "configuration if you use one — then disconnect and connect again so a new " +
        "token is issued.";
    }

    return await updatePostRecord(postId, { status: "failed", error_message: message });
  }
}
