"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  Star,
  Users,
  Plus,
  Trash,
  CheckCircle,
  EyeSlash,
  Lock,
  Globe,
  MagnifyingGlass,
  ArrowSquareOut,
  ShieldCheck,
  UserSwitch,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FacebookGroup } from "@/lib/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<FacebookGroup[]>([]);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Modal / Formulário de adição manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualInput, setManualInput] = useState({
    urlOrId: "",
    name: "",
    category: "",
    privacy: "PUBLIC",
    status: "MEMBER",
    notes: "",
  });

  // Importação em massa
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLinks, setBulkLinks] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const res = await fetch("/api/facebook/groups");
      const data = await res.json();
      if (res.status === 409) {
        setNotConnected(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar grupos.");
      setGroups(data.groups ?? []);
      setDefaultGroupId(data.defaultGroupId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar grupos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/facebook/groups/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar.");
      setSuccessMsg(`Sincronização concluída! ${data.total} grupos encontrados e atualizados.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na sincronização de grupos.");
    } finally {
      setSyncing(false);
    }
  }

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

  async function setDefault(group: FacebookGroup) {
    setDefaultGroupId(group.id);
    setError(null);
    try {
      const res = await fetch("/api/facebook/default-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, groupName: group.name }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Não foi possível definir o grupo padrão.");
      }
      setSuccessMsg(`Grupo "${group.name}" definido como padrão.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar grupo padrão.");
    }
  }

  async function toggleCanPost(group: FacebookGroup) {
    try {
      const nextCanPost = !group.can_post;
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, can_post: nextCanPost } : g))
      );

      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ can_post: nextCanPost }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar grupo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar permissão de postagem.");
      load();
    }
  }

  async function handleDelete(groupId: string) {
    if (!confirm("Tem certeza que deseja remover este grupo da sua lista?")) return;
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir grupo.");
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir grupo.");
    }
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let id = manualInput.urlOrId.trim();
    // Extrai ID ou slug de URLs do facebook (ex: facebook.com/groups/12345678)
    const match = id.match(/facebook\.com\/groups\/([^/?]+)/i);
    if (match && match[1]) {
      id = match[1];
    }

    if (!id || !manualInput.name.trim()) {
      setError("ID/Link e Nome do grupo são obrigatórios.");
      return;
    }

    try {
      const res = await fetch("/api/facebook/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: manualInput.name.trim(),
          category: manualInput.category.trim() || undefined,
          privacy: manualInput.privacy,
          status: manualInput.status,
          group_url: manualInput.urlOrId.startsWith("http")
            ? manualInput.urlOrId
            : `https://www.facebook.com/groups/${id}`,
          notes: manualInput.notes.trim() || undefined,
          can_post: true,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erro ao adicionar grupo.");
      }

      setShowAddModal(false);
      setManualInput({
        urlOrId: "",
        name: "",
        category: "",
        privacy: "PUBLIC",
        status: "MEMBER",
        notes: "",
      });
      setSuccessMsg("Grupo adicionado com sucesso!");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar novo grupo.");
    }
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkLinks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Insira pelo menos um link ou ID de grupo.");
      return;
    }

    const newGroups = lines.map((line) => {
      let id = line;
      const match = line.match(/facebook\.com\/groups\/([^/?]+)/i);
      if (match && match[1]) {
        id = match[1];
      }
      return {
        id,
        name: `Grupo ${id}`,
        category: bulkCategory.trim() || undefined,
        status: "MEMBER" as const,
        privacy: "PUBLIC",
        group_url: line.startsWith("http") ? line : `https://www.facebook.com/groups/${id}`,
        can_post: true,
      };
    });

    try {
      const res = await fetch("/api/facebook/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: newGroups }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erro ao importar grupos em massa.");
      }

      setShowBulkModal(false);
      setBulkLinks("");
      setBulkCategory("");
      setSuccessMsg(`${newGroups.length} grupos importados com sucesso!`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na importação em massa.");
    }
  }

  // Categorias únicas existentes
  const categories = Array.from(new Set(groups.map((g) => g.category).filter(Boolean))) as string[];

  // Filtro dos grupos exibidos
  const filteredGroups = groups.filter((g) => {
    const matchSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.category && g.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchCategory = selectedCategory === "all" || g.category === selectedCategory;
    const matchStatus = selectedStatus === "all" || g.status === selectedStatus;

    return matchSearch && matchCategory && matchStatus;
  });

  if (notConnected) {
    return (
      <Card className="py-12 text-center">
        <Users size={48} className="mx-auto text-muted-foreground opacity-50" />
        <p className="mt-4 text-base font-medium text-foreground">Facebook não conectado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte sua conta do Facebook nas Configurações para sincronizar seus grupos automaticamente.
        </p>
        <Link href="/dashboard/settings" className="mt-5 inline-block">
          <Button size="sm">Ir para Configurações</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Grupos do Facebook</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie grupos públicos, privados e secretos para disparos automáticos e agendamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleSync} disabled={syncing || switching}>
            <ArrowClockwise size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar da Conta"}
          </Button>

          <Button size="sm" variant="secondary" onClick={handleSwitchAccount} disabled={switching}>
            <UserSwitch size={15} />
            {switching ? "Redirecionando..." : "Trocar Conta"}
          </Button>

          <Button size="sm" variant="secondary" onClick={() => setShowBulkModal(true)}>
            Importar em Lote
          </Button>

          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            Adicionar Grupo
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-400">
          {successMsg}
        </div>
      )}

      {/* Filtros e Busca */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, ID ou nicho..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">Todas as Categorias / Nichos</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="MEMBER">Membro</option>
            <option value="ADMIN">Administrador</option>
            <option value="PENDING">Pendente</option>
            <option value="DISCOVERED">Descoberto</option>
          </select>
        </div>
      </Card>

      {/* Lista de Grupos */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <ArrowClockwise size={24} className="mx-auto mb-2 animate-spin text-primary" />
            Carregando grupos...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Users size={36} className="mx-auto mb-2 opacity-40" />
            Nenhum grupo encontrado com os filtros selecionados.
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={handleSync}>
                Sincronizar Grupos da sua Conta
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredGroups.map((group) => {
              const isDefault = group.id === defaultGroupId;
              const isSecret = group.is_secret || group.privacy === "SECRET" || group.privacy === "CLOSED_SECRET";
              const isPrivate = group.privacy === "CLOSED" || group.privacy === "PRIVATE";

              return (
                <div
                  key={group.id}
                  className="flex flex-col gap-4 p-4 transition hover:bg-surface-2/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {group.status === "ADMIN" ? (
                        <ShieldCheck size={22} weight="fill" />
                      ) : isSecret ? (
                        <EyeSlash size={22} />
                      ) : (
                        <Users size={22} />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{group.name}</span>
                        {isDefault && (
                          <Badge variant="default" className="text-xs">
                            Padrão
                          </Badge>
                        )}
                        {group.status === "ADMIN" && (
                          <Badge variant="success" className="text-xs">
                            Admin
                          </Badge>
                        )}
                        {isSecret ? (
                          <Badge variant="warning" className="text-xs">
                            <EyeSlash size={12} className="mr-1 inline" /> Secreto / Oculto
                          </Badge>
                        ) : isPrivate ? (
                          <Badge variant="outline" className="text-xs">
                            <Lock size={12} className="mr-1 inline" /> Privado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Globe size={12} className="mr-1 inline" /> Público
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>ID: {group.id}</span>
                        {group.category && <span>Nicho: <strong className="text-foreground">{group.category}</strong></span>}
                        {group.member_count !== undefined && group.member_count > 0 && (
                          <span>{group.member_count.toLocaleString()} membros</span>
                        )}
                        <span>Posts feitos: {group.post_count ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações do Grupo */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground transition hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={group.can_post}
                        onChange={() => toggleCanPost(group)}
                        className="rounded border-border text-primary focus:ring-0"
                      />
                      <span>{group.can_post ? "Ativo para Envio" : "Pausado"}</span>
                    </label>

                    {group.group_url && (
                      <a
                        href={group.group_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                        title="Abrir no Facebook"
                      >
                        <ArrowSquareOut size={16} />
                      </a>
                    )}

                    <Button
                      size="sm"
                      variant={isDefault ? "primary" : "secondary"}
                      onClick={() => setDefault(group)}
                    >
                      <Star size={14} weight={isDefault ? "fill" : "regular"} />
                      {isDefault ? "Padrão" : "Tornar Padrão"}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(group.id)}
                      title="Excluir da Lista"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal Adicionar Grupo Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-foreground">Adicionar Grupo do Facebook</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole o link direto do grupo ou ID numérico (mesmo grupos secretos ou restritos).
            </p>

            <form onSubmit={handleAddManual} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Link ou ID do Grupo *</label>
                <input
                  type="text"
                  required
                  placeholder="https://facebook.com/groups/12345678 ou ID"
                  value={manualInput.urlOrId}
                  onChange={(e) => setManualInput({ ...manualInput, urlOrId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome do Grupo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Empreendedores e Afiliados Brasil"
                  value={manualInput.name}
                  onChange={(e) => setManualInput({ ...manualInput, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria / Nicho</label>
                  <input
                    type="text"
                    placeholder="Ex: Renda Extra"
                    value={manualInput.category}
                    onChange={(e) => setManualInput({ ...manualInput, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Privacidade</label>
                  <select
                    value={manualInput.privacy}
                    onChange={(e) => setManualInput({ ...manualInput, privacy: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="PUBLIC">Público</option>
                    <option value="CLOSED">Privado</option>
                    <option value="SECRET">Secreto / Oculto</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Grupo</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Importação em Lote */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-foreground">Importar Grupos em Lote</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole uma lista de links de grupos do Facebook (um por linha).
            </p>

            <form onSubmit={handleBulkAdd} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Links dos Grupos (1 por linha)</label>
                <textarea
                  rows={6}
                  required
                  placeholder={`https://facebook.com/groups/grupo1\nhttps://facebook.com/groups/grupo2\nhttps://facebook.com/groups/123456789`}
                  value={bulkLinks}
                  onChange={(e) => setBulkLinks(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Nicho / Categoria Padrão</label>
                <input
                  type="text"
                  placeholder="Ex: Marketing Digital"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowBulkModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Importar Todos</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
