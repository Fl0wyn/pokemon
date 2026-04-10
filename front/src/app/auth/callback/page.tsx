"use client";

import axiosInstance from "@/utils/axiosInstance";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const err = searchParams.get("error");
    const errDesc = searchParams.get("error_description");

    if (err) {
      router.replace(
        `/login?error=${encodeURIComponent(errDesc || err)}`,
      );
      return;
    }

    if (!code || !state) {
      router.replace("/login?error=missing_oauth_params");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await axiosInstance.post<{ token: string; email: string }>(
          "/auth/microsoft/callback",
          { code, state },
        );
        if (cancelled) return;
        localStorage.setItem("userToken", res.data.token);
        localStorage.setItem("userEmail", res.data.email);
        router.replace("/");
      } catch (e: unknown) {
        if (cancelled) return;
        const ax = e as { response?: { data?: { error?: string } } };
        const msg =
          ax.response?.data?.error ||
          "La connexion Microsoft a échoué. Réessayez ou utilisez le code e-mail.";
        router.replace(`/login?error=${encodeURIComponent(String(msg))}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <p className="text-sm text-subtle">Connexion Microsoft en cours…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <p className="text-sm text-subtle">Chargement…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
