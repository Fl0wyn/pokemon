"use client";

import axiosInstance from "@/utils/axiosInstance";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [step, setStep] = useState(0);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [microsoftErr, setMicrosoftErr] = useState<string | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        if (localStorage.getItem("userEmail")) router.push("/");
      } catch {
        /* ignore */
      }
    })();
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await axiosInstance.get<{ enabled?: boolean }>(
          "/auth/microsoft/status",
        );
        setSsoEnabled(Boolean(data?.enabled));
      } catch {
        setSsoEnabled(false);
      }
    })();
  }, []);

  const handleSubmitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await axiosInstance.post("/auth/loginRequest", { email });
      setStep(1);
    } catch (error) {
      console.error("LoginRequest failed:", error);
    }
  };

  const submitCode = async (code: string) => {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const response = await axiosInstance.post("/auth/login", { code });
      localStorage.setItem("userToken", response.data.token);
      localStorage.setItem("userEmail", response.data.email);
      setStep(2);
      router.push("/");
    } catch (error) {
      console.error("LoginRequest failed:", error);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
    if (char && index === 5) {
      const code = [...next].join("");
      if (code.length === 6) submitCode(code);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputsRef.current[5]?.focus();
      e.preventDefault();
      submitCode(pasted);
    }
  };

  const startMicrosoft = async () => {
    setMicrosoftErr(null);
    try {
      const { data } = await axiosInstance.get<{ url?: string }>(
        "/auth/microsoft/authorize",
      );
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setMicrosoftErr("Réponse serveur inattendue.");
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setMicrosoftErr(
        ax.response?.data?.error ||
          "Connexion Microsoft indisponible. Vérifiez la configuration du serveur.",
      );
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-lg text-brand outline-none focus:border-brand transition-colors placeholder:text-subtle";

  const subtitles = [
    "Connectez-vous à votre espace",
    "Entrez le code reçu par e-mail",
    "Connexion réussie",
  ];

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand mb-1">Acs2i - Toolbox</h1>
          <p className="text-sm text-subtle">{subtitles[step]}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {(oauthError || microsoftErr) && (
            <div
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              role="alert"
            >
              {microsoftErr || oauthError}
            </div>
          )}

          {step === 0 && (
            <div className="flex flex-col gap-5">
              {ssoEnabled && (
                <>
                  <button
                    type="button"
                    onClick={() => void startMicrosoft()}
                    className="flex w-full items-center justify-center gap-2.5 py-2.5 px-3 text-sm font-semibold rounded-lg border border-border bg-surface text-brand hover:bg-soft/80 transition-colors cursor-pointer"
                  >
                    <MicrosoftIcon className="h-5 w-5 shrink-0" />
                    Continuer avec Microsoft
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] uppercase tracking-wide text-subtle">
                      ou par e-mail
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
              <form onSubmit={handleSubmitEmail} className="flex flex-col gap-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-muted mb-1.5"
                  >
                    Adresse e-mail
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="vous@acs2i.fr"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer border-0"
                >
                  Recevoir un code
                </button>
              </form>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-3">
                  Code de vérification
                </label>
                <div className="flex gap-2 justify-between">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputsRef.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onPaste={handleDigitPaste}
                      className="w-10 h-12 text-center text-lg font-semibold bg-surface border border-border rounded-lg text-brand outline-none focus:border-brand transition-colors"
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setDigits(["", "", "", "", "", ""]);
                }}
                className="w-full py-2 text-xs text-subtle bg-transparent border-0 cursor-pointer hover:text-muted transition-colors"
              >
                ← Retour
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-10 h-10 rounded-full bg-soft flex items-center justify-center text-brand font-bold">
                ✓
              </div>
              <p className="text-sm text-subtle m-0">Redirection en cours…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <p className="text-sm text-subtle">Chargement…</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
