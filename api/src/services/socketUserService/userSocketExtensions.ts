import type { Socket } from "socket.io";

/**
 * Context for one authenticated game user socket. Passed to extensions on attach;
 * `getSessionPage` reflects the current Next.js pathname tracked via `page-navigation`.
 */
export type UserSocketAttachContext = {
  userId: string;
  userEmail: string;
  socket: Socket;
  getSessionPage: () => string | null;
};

export type UserSocketPageNavigationContext = UserSocketAttachContext & {
  oldPage: string | null;
  newPage: string;
};

/**
 * Optional hooks for feature modules that need to listen on every user socket
 * without growing `socketUserService` itself.
 */
export interface UserSocketExtension {
  onAttach(ctx: UserSocketAttachContext): void;
  /** Invoked before the session row is removed (getSessionPage() still reflects last page). */
  onBeforeSessionRemoved?(ctx: UserSocketAttachContext): void;
  /** After `page-navigation` updated the session’s `currentPage`. */
  onAfterPageNavigation?(ctx: UserSocketPageNavigationContext): void;
}
