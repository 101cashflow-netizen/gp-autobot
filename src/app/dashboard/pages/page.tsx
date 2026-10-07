"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, Star, FlagBanner, UserSwitch, LinkBreak } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PageCache } from "@/lib/types";

export default function PagesPage() {
  const [pages, setPages] = useState<PageCache[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const res = await fetch(`/api/facebook/pages${refresh ? "?refresh=1" : ""}`);
      const data = await res.json();
      if (res.status === 409) {
        setNotConnected(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to load Pages.");
      setPages(data.pages ?? []);
      setDefaultId(data.defaultPageId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Pages.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  async function handleSwitchAccount() {
    if (!confirm("Deseja desconectar a conta atual do Facebook e conectar outro perfil?")) return;
    setSwitching(true);
    try {
      await fetch("/api/facebook/disconnect", { method: "POST" });
      window.location.href = "/api/facebook/oauth/start?reauth=1";
    } catch (err) {
      setError("Erro ao desconectar conta.");
      setSwitching(false);
    }
  }

  async function setDefault(page: PageCache) {
    setDefaultId(page.page_id);
    setError(null);
    const res = await fetch("/api/facebook/default-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: page.page_id }),
    });
    if (!res.ok) {
      setDefaultId(null);
      setError((await res.json()).error ?? "Couldn't set that Page as default.");
    }
  }

  if (notConnected) {
    return (
      <Card className="py-10 text-center">
        <p className="font-medium text-foreground">Facebook não está conectado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte sua conta do Facebook para gerenciar suas Páginas.
        </p>
        <a href="/api/facebook/oauth/start?reauth=1" className="mt-4 inline-block">
          <Button size="sm">Conectar Facebook</Button>
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Páginas do Facebook</h1>
          <p className="text-sm text-muted-foreground">
            Selecione a Página padrão para publicações automáticas.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => load(true)} disabled={refreshing || switching}>
            <ArrowClockwise size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando…" : "Atualizar Páginas"}
          </Button>

          <Button size="sm" variant="secondary" onClick={handleSwitchAccount} disabled={switching}>
            <UserSwitch size={15} />
            {switching ? "Redirecionando..." : "Conectar Outro Perfil / Trocar Conta"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No Pages cached yet — click &quot;Refresh from Facebook&quot;.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {pages.map((page) => {
              const isDefault = page.page_id === defaultId;
              return (
                <div key={page.page_id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <FlagBanner size={16} className="text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{page.name}</p>
                      {page.category && (
                        <p className="text-xs text-muted-foreground">{page.category}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isDefault ? "primary" : "secondary"}
                    onClick={() => setDefault(page)}
                  >
                    <Star size={14} weight={isDefault ? "fill" : "regular"} />
                    {isDefault ? "Default" : "Set as default"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
