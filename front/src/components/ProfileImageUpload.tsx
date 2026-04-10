"use client";

import axiosInstance from "@/utils/axiosInstance";
import { dataImageUrl } from "@/lib/dataImageUrl";
import { useCallback, useId, useState } from "react";
import { Image, Loader, UploadCloud } from "react-feather";

type ProfileImageUploadProps = {
  previewStorageKey: string | null;
  /** Called after a successful upload (reload profile from API here). */
  onUploaded: () => void | Promise<void>;
  disabled?: boolean;
  /** If set (admin), links the uploaded file to this user’s profile instead of the current user. */
  profileImageTargetUserId?: string | null;
};

export default function ProfileImageUpload({
  previewStorageKey,
  onUploaded,
  disabled = false,
  profileImageTargetUserId = null,
}: ProfileImageUploadProps) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Veuillez choisir une image.");
        return;
      }
      setUploading(true);
      try {
        const token = localStorage.getItem("userToken");
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "profile_avatar");

        const uploadRes = await axiosInstance.post<{
          file: { id: string; previewStorageKey: string };
        }>("/file/upload", form, {
          timeout: 120000,
          headers: {
            ...(token ? { Authorization: token } : {}),
          },
        });

        const fileId = uploadRes.data.file?.id;
        if (!fileId) {
          throw new Error("Réponse invalide du serveur (upload).");
        }

        const linkBody: { fileId: string; targetUserId?: string } = { fileId };
        if (profileImageTargetUserId) {
          linkBody.targetUserId = profileImageTargetUserId;
        }

        await axiosInstance.post("/user/profile-image", linkBody, {
          timeout: 30000,
          headers: {
            ...(token ? { Authorization: token } : {}),
          },
        });

        await Promise.resolve(onUploaded());
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
            : "Échec de l’envoi de l’image.";
        setError(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void uploadFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  };

  const previewSrc = previewStorageKey ? dataImageUrl(previewStorageKey) : null;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 transition-colors",
          disabled || uploading
            ? "cursor-not-allowed border-border bg-soft/50 opacity-60"
            : dragOver
              ? "border-[var(--color-brand)] bg-soft"
              : "border-border bg-card hover:border-muted hover:bg-soft/80",
        ].join(" ")}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={onInputChange}
        />
        {uploading ? (
          <Loader size={32} className="rotating text-muted" aria-hidden />
        ) : previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            width={120}
            height={120}
            className="h-[120px] w-[120px] rounded-lg object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-lg bg-soft text-muted">
            <Image size={40} strokeWidth={1.25} aria-hidden />
          </div>
        )}
        <span className="flex items-center gap-2 text-center text-sm font-medium text-brand">
          <UploadCloud size={18} className="shrink-0 text-muted" aria-hidden />
          {uploading
            ? "Téléversement…"
            : previewSrc
              ? "Remplacer la photo (cliquer ou glisser-déposer)"
              : "Photo de profil — cliquer ou glisser-déposer une image"}
        </span>
        <span className="text-center text-xs text-muted">
          Aperçu 500×500&nbsp;px (JPEG), jusqu’à 8&nbsp;Mo
        </span>
      </label>
      {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
