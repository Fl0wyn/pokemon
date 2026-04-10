import { useCallback, useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";

export type EmailRow = {
  _id: string;
  subject: string;
  sender: string;
  recipients: string[];
  content: string;
  attachmentPaths: string[];
  sentSuccessfully: boolean;
  errorMessage: string | null;
  sentBy: { email: string; github: string; rank: string } | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EmailsResponse = {
  emails: EmailRow[];
  page: number;
  limit: number;
  totalEmails: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function useEmails(page: number) {
  const [data, setData] = useState<EmailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
      const res = await axiosInstance.get<EmailsResponse>("/email/list", {
        params: { page, limit: 20 },
        headers: { Authorization: token ?? "" },
      });
      setData(res.data);
    } catch (e: unknown) {
      const msg =
        e &&
        typeof e === "object" &&
        "response" in e &&
        (e as any).response?.data?.error
          ? String((e as any).response.data.error)
          : "Impossible de charger les emails.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, error };
}
