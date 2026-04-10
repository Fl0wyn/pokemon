"use client";

import AppChrome from "@/components/AppChrome";
import ProfileImageUpload from "@/components/ProfileImageUpload";
import { dataImageUrl } from "@/lib/dataImageUrl";
import axiosInstance from "@/utils/axiosInstance";
import { useCallback, useEffect, useState } from "react";
import { Loader, User } from "react-feather";

type ProfileMe = {
  email: string;
  profileImage: {
    fileId: string;
    previewStorageKey: string;
    previewWidth: number;
    previewHeight: number;
    kind?: string;
  } | null;
};

export default function ProfilePage() {
  const [me, setMe] = useState<ProfileMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("userToken");
      const response = await axiosInstance.get<ProfileMe>("/user/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ?? "",
        },
      });
      setMe(response.data);
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
          : "Impossible de charger le profil.";
      setError(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const previewKey = me?.profileImage?.previewStorageKey ?? null;

  return (
    <AppChrome>
      <main className="min-w-0 flex-1 px-4 pt-6 md:px-6">
        <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
          {previewKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataImageUrl(previewKey)}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft text-brand">
              <User size={22} aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="m-0 text-lg font-bold text-brand">Mon profil</h1>
            <p className="m-0 mt-0.5 text-sm text-muted">
              Informations du compte connecté
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader className="rotating text-muted" />
          </div>
        )}

        {!loading && error && (
          <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && me && (
          <div className="flex max-w-lg flex-col gap-6">
            <ProfileImageUpload
              previewStorageKey={previewKey}
              onUploaded={async () => {
                await loadMe({ silent: true });
                window.dispatchEvent(new Event("acs2i-profile-image-changed"));
              }}
            />

            <div className="rounded-xl border border-border bg-card p-5">
              <dl className="m-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  E-mail
                </dt>
                <dd className="m-0 mt-1 break-all font-mono text-sm text-brand">
                  {me.email}
                </dd>
              </dl>
            </div>
          </div>
        )}
      </main>
    </AppChrome>
  );
}
