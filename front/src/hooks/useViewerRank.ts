"use client";

import axiosInstance from "@/utils/axiosInstance";
import { useEffect, useState } from "react";

export type ViewerRank = "user" | "admin" | null;

/**
 * Current viewer rank from `/user/me` (requires JWT in localStorage).
 */
export function useViewerRank() {
  const [rank, setRank] = useState<ViewerRank>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      setRank(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void axiosInstance
      .get<{ rank?: string }>("/user/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      })
      .then((res) => {
        if (!cancelled) {
          setRank(res.data.rank === "admin" ? "admin" : "user");
        }
      })
      .catch(() => {
        if (!cancelled) setRank("user");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { rank, isAdmin: rank === "admin", loading };
}
