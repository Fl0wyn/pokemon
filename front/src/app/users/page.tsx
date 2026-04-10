"use client";

import AppChrome from "@/components/AppChrome";
import ProfileImageUpload from "@/components/ProfileImageUpload";
import RightDock from "@/components/RightDock";
import { dataImageUrl } from "@/lib/dataImageUrl";
import { useAppSocket } from "@/providers/AppSocketProvider";
import axiosInstance from "@/utils/axiosInstance";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useMemo, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Copy,
    Loader,
    Maximize2,
    Minimize2,
    Shield,
    User as UserIcon,
    UserPlus
} from "react-feather";

const PAGE_SIZE = 20;

export type UserRank = "user" | "admin";

type UserRow = {
  id: string;
  email: string;
  github: string;
  rank: UserRank;
  createdAt: string;
  updatedAt: string;
  profilePreviewKey: string | null;
};

type UserDetail = {
  id: string;
  email: string;
  github: string;
  rank: UserRank;
  createdAt: string;
  updatedAt: string;
  profilePreviewKey: string | null;
};

function rankLabel(r: UserRank): string {
  return r === "admin" ? "Admin" : "Utilisateur";
}

function emailInitial(email: string): string {
  const c = email.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

function UserListAvatar({
  previewKey,
  email,
  size = "md",
}: {
  previewKey: string | null;
  email: string;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  const box = sm ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs";
  if (previewKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataImageUrl(previewKey)}
        alt=""
        width={sm ? 32 : 36}
        height={sm ? 32 : 36}
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-800`}
      aria-hidden
    >
      {emailInitial(email)}
    </span>
  );
}

function ConnectionPresenceDot({
  online,
  socketUp,
}: {
  online: boolean;
  socketUp: boolean;
}) {
  const label = !socketUp ? "Connexion indisponible" : online ? "En ligne" : "Hors ligne";
  return (
    <div className="flex justify-center">
      <span
        className={[
          "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
          !socketUp
            ? "bg-border opacity-70"
            : online
              ? "bg-emerald-500"
              : "bg-slate-300 dark:bg-slate-600",
        ].join(" ")}
        title={label}
        role="img"
        aria-label={label}
      />
    </div>
  );
}

function RankRoleIcon({ rank }: { rank: UserRank }) {
  if (rank === "admin") {
    return (
      <span className="flex justify-center text-indigo-600" title="Administrateur" aria-label="Administrateur">
        <Shield size={18} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex justify-center text-muted" title="Utilisateur" aria-label="Utilisateur">
      <UserIcon size={18} strokeWidth={2} aria-hidden />
    </span>
  );
}

function UsersPageInner() {
  const { socket, connected: socketConnected } = useAppSocket();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedUserId = searchParams.get("user");
  const dockFullScreen = searchParams.get("view") === "full";
  const page = useMemo(
    () => Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
    [searchParams],
  );

  const setUrl = useCallback(
    (opts: { userId?: string | null; viewFull?: boolean; page?: number }) => {
      const uid =
        opts.userId !== undefined ? opts.userId : searchParams.get("user");
      const vf =
        opts.viewFull !== undefined
          ? opts.viewFull
          : searchParams.get("view") === "full";
      const p =
        opts.page !== undefined
          ? opts.page
          : Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

      const params = new URLSearchParams();
      if (p > 1) params.set("page", String(p));
      if (uid) params.set("user", uid);
      if (vf) params.set("view", "full");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [meRank, setMeRank] = useState<UserRank>("user");
  const [meEmail, setMeEmail] = useState<string | null>(null);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [draftGithub, setDraftGithub] = useState("");
  const [draftRank, setDraftRank] = useState<UserRank>("user");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserPending, setAddUserPending] = useState(false);
  const [addUserModalError, setAddUserModalError] = useState<string | null>(null);
  const addUserModalTitleId = useId();

  const authHeaders = useMemo(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    return {
      "Content-Type": "application/json",
      Authorization: token ?? "",
    };
  }, []);

  const loadList = useCallback(
    async (fetchOpts?: { page?: number }) => {
      const requestPage = fetchOpts?.page ?? page;
      setListLoading(true);
      setListError(null);
      try {
        const response = await axiosInstance.get<{
          users: UserRow[];
          total: number;
          totalPages: number;
        }>("/user/all", {
          params: { page: requestPage, limit: PAGE_SIZE },
          headers: authHeaders,
        });
        const rows = (response.data.users ?? []).map((u) => ({
          ...u,
          rank: (u.rank === "admin" ? "admin" : "user") as UserRank,
          github: u.github ?? "",
        }));
        setUsers(rows);
        setTotal(typeof response.data.total === "number" ? response.data.total : 0);
        setTotalPages(
          typeof response.data.totalPages === "number"
            ? Math.max(1, response.data.totalPages)
            : 1,
        );
      } catch (err: unknown) {
        const msg =
          err &&
          typeof err === "object" &&
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "data" in err.response &&
          err.response.data &&
          typeof err.response.data === "object" &&
          "error" in err.response.data
            ? String((err.response.data as { error?: string }).error)
            : "Impossible de charger les utilisateurs.";
        setListError(msg);
      } finally {
        setListLoading(false);
      }
    },
    [authHeaders, page],
  );

  const loadMe = useCallback(async () => {
    try {
      const response = await axiosInstance.get<{
        email: string;
        rank?: UserRank;
      }>("/user/me", { headers: authHeaders });
      setMeEmail(response.data.email ?? null);
      setMeRank(response.data.rank === "admin" ? "admin" : "user");
    } catch {
      setMeEmail(null);
      setMeRank("user");
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!socket) {
      setOnlineUserIds(new Set());
      return;
    }
    const onPresence = (payload: { onlineUserIds?: string[] }) => {
      const ids = payload?.onlineUserIds;
      setOnlineUserIds(new Set(Array.isArray(ids) ? ids : []));
    };
    const onDisconnect = () => setOnlineUserIds(new Set());
    const requestPresenceSnapshot = () => {
      socket.emit("game:presence:request");
    };

    socket.on("game:presence", onPresence);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", requestPresenceSnapshot);
    requestPresenceSnapshot();

    return () => {
      socket.off("game:presence", onPresence);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", requestPresenceSnapshot);
    };
  }, [socket]);

  useEffect(() => {
    if (!listLoading && totalPages >= 1 && page > totalPages) {
      setUrl({ page: totalPages });
    }
  }, [listLoading, totalPages, page, setUrl]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await axiosInstance.get<{ user: UserDetail }>(
          `/user/${selectedUserId}`,
          { headers: authHeaders },
        );
        const u = response.data.user;
        if (!cancelled && u) {
          const normalized: UserDetail = {
            ...u,
            rank: u.rank === "admin" ? "admin" : "user",
            github: u.github ?? "",
          };
          setDetail(normalized);
          setDraftGithub(normalized.github);
          setDraftRank(normalized.rank);
        }
      } catch (err: unknown) {
        const msg =
          err &&
          typeof err === "object" &&
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "data" in err.response &&
          err.response.data &&
          typeof err.response.data === "object" &&
          "error" in err.response.data
            ? String((err.response.data as { error?: string }).error)
            : "Impossible de charger l’utilisateur.";
        if (!cancelled) setDetailError(msg);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, authHeaders]);

  useEffect(() => {
    if (!linkCopied) return;
    const t = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(t);
  }, [linkCopied]);

  useEffect(() => {
    if (!addUserOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [addUserOpen]);

  useEffect(() => {
    if (!addUserOpen || addUserPending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddUserOpen(false);
        setAddUserModalError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addUserOpen, addUserPending]);

  const copyUsersLink = useCallback(() => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
    });
  }, []);

  const isAdmin = meRank === "admin";
  const isSelf = Boolean(
    detail && meEmail && detail.email.toLowerCase() === meEmail.toLowerCase(),
  );
  const canEditGithub = isAdmin || isSelf;
  const canEditRank = isAdmin;
  const canChangeAvatar = isAdmin || isSelf;

  const handleCreateUser = useCallback(async () => {
    const email = addUserEmail.trim();
    if (!email) {
      setAddUserModalError("Saisissez une adresse e-mail.");
      return;
    }
    setAddUserPending(true);
    setAddUserModalError(null);
    try {
      await axiosInstance.post("/user/create", { email }, { headers: authHeaders });
      setAddUserOpen(false);
      setAddUserEmail("");
      setAddUserModalError(null);
      setUrl({ page: 1 });
      await loadList({ page: 1 });
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "error" in err.response.data
          ? String((err.response.data as { error?: string }).error)
          : "Création impossible.";
      setAddUserModalError(msg);
    } finally {
      setAddUserPending(false);
    }
  }, [addUserEmail, authHeaders, loadList, setUrl]);

  const handleSave = async () => {
    if (!detail) return;
    setSaveError(null);
    setSaving(true);
    try {
      const body: { github?: string; rank?: UserRank } = {};
      if (canEditGithub && draftGithub !== detail.github) {
        body.github = draftGithub;
      }
      if (canEditRank && draftRank !== detail.rank) {
        body.rank = draftRank;
      }
      if (Object.keys(body).length === 0) {
        setSaving(false);
        return;
      }
      await axiosInstance.patch(`/user/${detail.id}`, body, {
        headers: authHeaders,
      });
      await loadList();
      const refreshed = await axiosInstance.get<{ user: UserDetail }>(
        `/user/${detail.id}`,
        { headers: authHeaders },
      );
      const u = refreshed.data.user;
      if (u) {
        const normalized: UserDetail = {
          ...u,
          rank: u.rank === "admin" ? "admin" : "user",
          github: u.github ?? "",
        };
        setDetail(normalized);
        setDraftGithub(normalized.github);
        setDraftRank(normalized.rank);
      }
      await loadMe();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "error" in err.response.data
          ? String((err.response.data as { error?: string }).error)
          : "Enregistrement impossible.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const dockTitle = detail
    ? detail.email
    : selectedUserId
      ? "Utilisateur"
      : "";

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const paginationLeft = !listLoading ? (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setUrl({ page: Math.max(1, page - 1) })}
        disabled={!canPrev || listLoading || totalPages <= 1}
        className={[
          "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium sm:px-3 sm:py-2",
          canPrev && !listLoading && totalPages > 1
            ? "cursor-pointer border-border bg-card text-brand hover:bg-soft"
            : "cursor-not-allowed border-border bg-soft text-muted opacity-50",
        ].join(" ")}
      >
        <ChevronLeft size={18} className="shrink-0" />
        Précédent
      </button>
      <span
        className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium tabular-nums text-brand"
        aria-live="polite"
      >
        <span title="Page courante / nombre de pages">
          {page}/{totalPages}
        </span>
        <span className="font-normal text-muted" aria-hidden>
          —
        </span>
        <span title={`${PAGE_SIZE} par page / nombre total d'utilisateurs`}>
          {listError ? (
            <span className="text-muted">—/—</span>
          ) : (
            `${PAGE_SIZE}/${total}`
          )}
        </span>
      </span>
      <button
        type="button"
        onClick={() => setUrl({ page: Math.min(totalPages, page + 1) })}
        disabled={!canNext || listLoading || totalPages <= 1}
        className={[
          "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium sm:px-3 sm:py-2",
          canNext && !listLoading && totalPages > 1
            ? "cursor-pointer border-border bg-card text-brand hover:bg-soft"
            : "cursor-not-allowed border-border bg-soft text-muted opacity-50",
        ].join(" ")}
      >
        Suivant
        <ChevronRight size={18} className="shrink-0" />
      </button>
    </div>
  ) : null;

  const usersPaginationToolbarBottom = (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">{paginationLeft}</div>
    </div>
  );

  const usersPaginationToolbarTop = (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">{paginationLeft}</div>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => {
            setAddUserModalError(null);
            setAddUserOpen(true);
          }}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-soft"
        >
          <UserPlus size={18} className="shrink-0" aria-hidden />
          Ajouter un utilisateur
        </button>
      ) : null}
    </div>
  );

  return (
    <AppChrome>
      <>
      <main className="min-w-0 flex-1 px-4 pt-6 md:px-6">
        <RightDock
          open={Boolean(selectedUserId)}
          onClose={() => setUrl({ userId: null, viewFull: false })}
          title={dockTitle}
          fullScreen={dockFullScreen}
          panelClassName="max-w-lg md:max-w-xl"
          headerActions={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setUrl({ viewFull: !dockFullScreen })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-soft text-muted transition-colors hover:bg-border hover:text-brand cursor-pointer"
                title={dockFullScreen ? "Panneau étroit" : "Plein écran"}
                aria-label={dockFullScreen ? "Panneau étroit" : "Plein écran"}
              >
                {dockFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={copyUsersLink}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-soft text-muted transition-colors hover:bg-border hover:text-brand cursor-pointer"
                title={linkCopied ? "Copié" : "Copier le lien"}
                aria-label="Copier le lien de cette vue"
              >
                <Copy size={16} />
              </button>
            </div>
          }
        >
          {detailLoading && (
            <div className="flex justify-center py-12">
              <Loader className="rotating text-muted" />
            </div>
          )}
          {!detailLoading && detailError && (
            <p className="text-sm text-red-600">{detailError}</p>
          )}
          {!detailLoading && detail && (
            <div className="flex flex-col gap-5 pb-4">
              {canChangeAvatar ? (
                <ProfileImageUpload
                  previewStorageKey={detail.profilePreviewKey}
                  profileImageTargetUserId={isSelf ? null : detail.id}
                  onUploaded={async () => {
                    const refreshed = await axiosInstance.get<{ user: UserDetail }>(
                      `/user/${detail.id}`,
                      { headers: authHeaders },
                    );
                    const u = refreshed.data.user;
                    if (u) {
                      setDetail({
                        ...u,
                        rank: u.rank === "admin" ? "admin" : "user",
                        github: u.github ?? "",
                      });
                    }
                    await loadList();
                    window.dispatchEvent(new Event("acs2i-profile-image-changed"));
                  }}
                />
              ) : detail.profilePreviewKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataImageUrl(detail.profilePreviewKey)}
                  alt=""
                  width={120}
                  height={120}
                  className="h-[120px] w-[120px] rounded-lg object-cover"
                />
              ) : null}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                  E-mail
                </label>
                <p className="m-0 mt-1 font-mono text-sm text-brand">{detail.email}</p>
              </div>

              <div>
                <label
                  htmlFor="user-dock-github"
                  className="text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  GitHub
                </label>
                <input
                  id="user-dock-github"
                  type="text"
                  value={draftGithub}
                  onChange={(e) => setDraftGithub(e.target.value)}
                  disabled={!canEditGithub}
                  placeholder="login ou URL"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-brand disabled:cursor-not-allowed disabled:bg-soft disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="user-dock-rank"
                  className="text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Rôle
                </label>
                <select
                  id="user-dock-rank"
                  value={draftRank}
                  onChange={(e) => setDraftRank(e.target.value as UserRank)}
                  disabled={!canEditRank}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-brand disabled:cursor-not-allowed disabled:bg-soft disabled:opacity-70"
                >
                  <option value="user">{rankLabel("user")}</option>
                  <option value="admin">{rankLabel("admin")}</option>
                </select>
                {!canEditRank ? (
                  <p className="m-0 mt-1 text-xs text-muted">
                    Seul un administrateur peut modifier le rôle.
                  </p>
                ) : null}
              </div>

              <div className="text-xs text-muted">
                <p className="m-0">Créé : {formatDateTime(detail.createdAt)}</p>
                <p className="m-0 mt-1">Mis à jour : {formatDateTime(detail.updatedAt)}</p>
              </div>

              {saveError ? (
                <p className="m-0 text-sm text-red-600">{saveError}</p>
              ) : null}

              {(canEditGithub || canEditRank) && (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={
                    saving ||
                    (draftGithub === detail.github && draftRank === detail.rank)
                  }
                  className="rounded-lg border border-border bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              )}
            </div>
          )}
        </RightDock>

        <div className="flex min-h-[min(70vh,40rem)] flex-col pb-8">
          <div className="mb-4">{usersPaginationToolbarTop}</div>

          {listLoading && (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader className="rotating text-muted" />
            </div>
          )}

          {!listLoading && listError && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-red-600">
              {listError}
            </div>
          )}

          {!listLoading && !listError && users.length === 0 && (
            <p className="m-0 text-sm text-muted">Aucun utilisateur enregistré.</p>
          )}

          {!listLoading && !listError && users.length > 0 && (
            <div className="min-h-[16rem] flex-1 overflow-hidden overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-left text-sm md:hidden">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Connexion</th>
                    <th scope="col">Photo</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Rôle</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const online = onlineUserIds.has(u.id);
                    return (
                      <tr
                        key={`m-${u.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setUrl({ userId: u.id })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setUrl({ userId: u.id });
                          }
                        }}
                        className="cursor-pointer border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-soft/80"
                      >
                        <td className="w-8 px-2 py-2.5 align-middle">
                          <ConnectionPresenceDot online={online} socketUp={socketConnected} />
                        </td>
                        <td className="w-10 px-1 py-2.5 align-middle">
                          <UserListAvatar previewKey={u.profilePreviewKey} email={u.email} size="sm" />
                        </td>
                        <td className="max-w-[min(12rem,45vw)] px-2 py-2.5 align-middle">
                          <span
                            className="block truncate text-[11px] font-medium text-brand"
                            title={u.email}
                          >
                            {u.email}
                          </span>
                        </td>
                        <td className="w-10 px-1 py-2.5 align-middle">
                          <RankRoleIcon rank={u.rank} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <table className="hidden w-full border-collapse text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-border bg-soft/80">
                    <th className="px-4 py-3 font-semibold text-brand">E-mail</th>
                    <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-brand" scope="col">
                      Connexion
                    </th>
                    <th className="px-4 py-3 font-semibold text-brand">GitHub</th>
                    <th className="px-4 py-3 font-semibold text-brand">Rôle</th>
                    <th className="px-4 py-3 font-semibold text-brand">Première connexion</th>
                    <th className="px-4 py-3 font-semibold text-brand">Dernière mise à jour</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const online = onlineUserIds.has(u.id);
                    return (
                      <tr
                        key={u.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setUrl({ userId: u.id })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setUrl({ userId: u.id });
                          }
                        }}
                        className="cursor-pointer border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-soft/50"
                      >
                        <td className="px-4 py-3 align-middle">
                          <span className="inline-flex min-w-0 items-center gap-2 font-medium text-brand">
                            <UserListAvatar previewKey={u.profilePreviewKey} email={u.email} size="md" />
                            <span className="min-w-0 truncate">{u.email}</span>
                          </span>
                        </td>
                        <td className="w-12 px-2 py-3 align-middle">
                          <ConnectionPresenceDot online={online} socketUp={socketConnected} />
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 align-middle text-muted">
                          {u.github || "—"}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={[
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              u.rank === "admin"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-soft text-muted",
                            ].join(" ")}
                          >
                            {rankLabel(u.rank)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted">
                          {formatDateTime(u.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted">
                          {formatDateTime(u.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4">{usersPaginationToolbarBottom}</div>
        </div>
      </main>

      {isAdmin && addUserOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer border-0 bg-black/45 p-0"
            aria-label="Fermer"
            disabled={addUserPending}
            onClick={() => {
              if (!addUserPending) {
                setAddUserOpen(false);
                setAddUserModalError(null);
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={addUserModalTitleId}
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <h2 id={addUserModalTitleId} className="m-0 text-base font-bold text-brand">
              Ajouter un utilisateur
            </h2>
            <p className="mt-2 m-0 text-sm text-muted">
              Saisissez l&apos;adresse e-mail du compte. Le rôle par défaut est « Utilisateur ».
            </p>
            <label htmlFor="add-user-email" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
              E-mail
            </label>
            <input
              id="add-user-email"
              type="email"
              autoComplete="email"
              value={addUserEmail}
              onChange={(e) => setAddUserEmail(e.target.value)}
              disabled={addUserPending}
              placeholder="prenom.nom@exemple.fr"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-brand disabled:cursor-not-allowed disabled:opacity-70"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !addUserPending) {
                  e.preventDefault();
                  void handleCreateUser();
                }
              }}
            />
            {addUserModalError ? (
              <p className="mt-2 m-0 text-sm text-red-600">{addUserModalError}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={addUserPending}
                onClick={() => {
                  if (!addUserPending) {
                    setAddUserOpen(false);
                    setAddUserModalError(null);
                  }
                }}
                className={[
                  "rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                  addUserPending
                    ? "cursor-not-allowed border-border bg-soft text-muted opacity-60"
                    : "cursor-pointer border-border bg-card text-brand hover:bg-soft",
                ].join(" ")}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={addUserPending}
                onClick={() => void handleCreateUser()}
                className={[
                  "rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors",
                  addUserPending
                    ? "cursor-not-allowed border-border bg-soft text-muted opacity-60"
                    : "cursor-pointer border-[var(--color-brand)] bg-[var(--color-brand)] text-white hover:opacity-95",
                ].join(" ")}
              >
                {addUserPending ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
    </AppChrome>
  );
}

function UsersPageFallback() {
  return (
    <AppChrome>
      <main className="flex min-h-0 min-w-0 flex-1 justify-center px-4 py-16 md:px-6">
        <Loader className="rotating text-muted" />
      </main>
    </AppChrome>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersPageFallback />}>
      <UsersPageInner />
    </Suspense>
  );
}
