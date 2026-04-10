"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userEmail");
    router.push("/login");
  }, []);

  return null;
}
