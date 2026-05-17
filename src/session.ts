import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv, UserRow } from "./types";

const SESSION_COOKIE = "tablasmult_session";

export function setSessionCookie(c: Context<AppEnv>, sessionId: string) {
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function getSessionId(c: Context<AppEnv>): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export async function getUserFromSession(
  c: Context<AppEnv>
): Promise<UserRow | null> {
  const sessionId = getSessionId(c);
  if (!sessionId) return null;

  const now = Date.now();
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  )
    .bind(sessionId, now)
    .first<UserRow>();

  return row ?? null;
}

export async function requireUser(c: Context<AppEnv>): Promise<UserRow> {
  const user = await getUserFromSession(c);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
