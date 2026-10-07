"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, Article, Copy, Check } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { composeMessage, facebookPostUrl } from "@/lib/types";
import type { Post, PostStatus } from "@/lib/types";

const FILTERS: { label: string; value: PostStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Publicados", value: "posted" },
  { label: "Falharam", value: "failed" },
];

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/posts?status=${filter === "all" ? "posted,failed" : filter}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Falha ao carregar histórico.");
        setPosts(data.posts ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar histórico."))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              filter === f.value
                ? "bg-primary text-primary-foreground font-semibold"
                : "border border-border text-muted-foreground hover:bg-surface-2"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && (
        <Card>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando histórico…</p>
          ) : posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum post encontrado nesta categoria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Post</th>
                    <th className="hidden pb-2 font-medium sm:table-cell">Destino</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b border-border last:border-0">
                      <td className="max-w-[280px] py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {post.media_type === "video" ? (
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black">
                              <video
                                src={post.media_url || post.image_url || undefined}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                              />
                            </div>
                          ) : post.media_type === "text" || (!post.image_url && !post.media_url) ? (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Article size={18} weight="bold" />
                            </div>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={post.image_url || undefined} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{post.title}</p>
                            {post.status === "failed" && post.error_message && (
                              <p className="truncate text-xs text-destructive">{post.error_message}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden py-3 pr-3 text-muted-foreground sm:table-cell">
                        {post.target_type === "group" || post.group_name
                          ? `👥 ${post.group_name ?? "Grupo"}`
                          : `🚩 ${post.page_name ?? "Página"}`}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={post.status} />
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {new Date(post.posted_at ?? post.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className={cn("h-7 px-2 text-xs", copiedId === post.id && "bg-success/20 text-success")}
                            onClick={async () => {
                              const text = composeMessage(post);
                              await navigator.clipboard.writeText(text);
                              setCopiedId(post.id);
                              setTimeout(() => setCopiedId(null), 2500);
                            }}
                            title="Copiar texto formatado do post"
                          >
                            {copiedId === post.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                            <span className="hidden md:inline">{copiedId === post.id ? "Copiado!" : "Copiar"}</span>
                          </Button>

                          {(post.group_id || post.target_type === "group") && (
                            <a
                              href={post.group_id ? `https://facebook.com/groups/${post.group_id}` : "https://www.facebook.com/groups/feed/"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground hover:bg-surface-3 transition"
                              title="Abrir página do grupo no Facebook"
                            >
                              <ArrowSquareOut size={13} />
                              <span className="hidden md:inline">Grupo</span>
                            </a>
                          )}

                          {post.facebook_post_id && (
                            <a
                              href={facebookPostUrl(post.facebook_post_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                            >
                              Ver post <ArrowSquareOut size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
