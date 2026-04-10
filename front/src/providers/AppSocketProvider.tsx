"use client";

import { getSocketBaseUrl, getSocketPath } from "@/config/socket";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

type AppSocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const AppSocketContext = createContext<AppSocketContextValue>({
  socket: null,
  connected: false,
});

/**
 * Single Socket.IO connection for the app after login (JWT in auth).
 * Disconnects on /login and /logout. Monitoring and other pages reuse `socket`.
 */
export function AppSocketProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/logout";

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAuthPage) {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = localStorage.getItem("userToken") ?? "";
    if (!token) {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();

    const base = getSocketBaseUrl();
    const s = io(base, {
      transports: ["websocket", "polling"],
      path: getSocketPath(base),
      auth: { token },
    });

    socketRef.current = s;
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", (err) =>
      console.error("[appSocket] connect_error:", err.message),
    );

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.disconnect();
      if (socketRef.current === s) {
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
    };
  }, [isAuthPage]);

  /** Keep server `currentPage` in sync for targeted Socket.IO emits (see socketUserService). */
  useEffect(() => {
    if (isAuthPage || !socket?.connected) return;
    const page = pathname || "/";
    const isMobile =
      typeof navigator !== "undefined" &&
      /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    socket.emit("page-navigation", {
      page,
      deviceType: isMobile ? "mobile" : "web",
    });
  }, [pathname, socket, connected, isAuthPage]);

  return (
    <AppSocketContext.Provider value={{ socket, connected }}>
      {children}
    </AppSocketContext.Provider>
  );
}

export function useAppSocket(): AppSocketContextValue {
  return useContext(AppSocketContext);
}
