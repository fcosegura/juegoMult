import { Hono } from "hono";
import { cors } from "hono/cors";
import { hashPassword, newId, sessionExpiryMs, verifyPassword } from "./crypto";
import {
  clearSessionCookie,
  getSessionId,
  getUserFromSession,
  requireUser,
  setSessionCookie,
} from "./session";
import { CARD_CATALOG, PACK_COST } from "./cards";
import {
  completeAdventure,
  getAdventureProgress,
  getCollection,
  getWallet,
  initUserMeta,
  openPack,
  saveAdventureProgress,
  type AdventureProgress,
} from "./meta";
import type { AppEnv, Difficulty } from "./types";
import { DIFFICULTIES, isDifficulty } from "./types";

const app = new Hono<AppEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
  })
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/auth/register", async (c) => {
  const body = await c.req.json<{
    username?: string;
    password?: string;
    displayName?: string;
  }>();

  const username = body.username?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() ?? "";

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return c.json(
      {
        error:
          "Usuario inválido (3-20 caracteres: letras minúsculas, números o _)",
      },
      400
    );
  }
  if (password.length < 6) {
    return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }
  if (displayName.length < 2 || displayName.length > 30) {
    return c.json({ error: "Nombre para mostrar: entre 2 y 30 caracteres" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE username = ?"
  )
    .bind(username)
    .first();

  if (existing) {
    return c.json({ error: "Ese usuario ya existe" }, 409);
  }

  const userId = newId();
  const passwordHash = await hashPassword(password);
  const createdAt = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(userId, username, displayName, passwordHash, createdAt)
    .run();

  const sessionId = newId();
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(sessionId, userId, sessionExpiryMs(), createdAt)
    .run();

  await initUserMeta(c.env.DB, userId, createdAt);

  setSessionCookie(c, sessionId);

  return c.json({
    user: { id: userId, username, displayName, createdAt },
  });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>();
  const username = body.username?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return c.json({ error: "Usuario y contraseña requeridos" }, 400);
  }

  const row = await c.env.DB.prepare(
    "SELECT id, username, display_name, password_hash, created_at FROM users WHERE username = ?"
  )
    .bind(username)
    .first<{
      id: string;
      username: string;
      display_name: string;
      password_hash: string;
      created_at: number;
    }>();

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
  }

  const sessionId = newId();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(sessionId, row.id, sessionExpiryMs(), now)
    .run();

  await initUserMeta(c.env.DB, row.id, now);

  setSessionCookie(c, sessionId);

  return c.json({
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      createdAt: row.created_at,
    },
  });
});

app.post("/api/auth/logout", async (c) => {
  const sessionId = getSessionId(c);
  if (sessionId) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId)
      .run();
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const user = await getUserFromSession(c);
  if (!user) return c.json({ user: null });
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      createdAt: user.created_at,
    },
  });
});

app.post("/api/scores", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "Debes iniciar sesión para guardar puntajes" }, 401);
  }

  const body = await c.req.json<{ points?: number; difficulty?: string }>();
  const points = body.points;
  const difficulty = body.difficulty;

  if (typeof points !== "number" || !Number.isInteger(points) || points < 0) {
    return c.json({ error: "Puntos inválidos" }, 400);
  }
  if (!difficulty || !isDifficulty(difficulty)) {
    return c.json({ error: "Dificultad inválida" }, 400);
  }
  if (points > 500) {
    return c.json({ error: "Puntos fuera de rango" }, 400);
  }

  const id = newId();
  const createdAt = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO scores (id, user_id, points, difficulty, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, points, difficulty, createdAt)
    .run();

  return c.json({ ok: true, scoreId: id });
});

app.get("/api/scores/leaderboard", async (c) => {
  const difficulty = c.req.query("difficulty") ?? "all";
  const limit = Math.min(Number(c.req.query("limit") ?? 10), 50);

  if (difficulty !== "all" && !isDifficulty(difficulty)) {
    return c.json({ error: "Dificultad inválida" }, 400);
  }

  let query: string;
  let bindings: (string | number)[];

  if (difficulty === "all") {
    query = `
      SELECT u.display_name AS displayName, s.points, s.difficulty, s.created_at AS createdAt
      FROM scores s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.points DESC, s.created_at ASC
      LIMIT ?`;
    bindings = [limit];
  } else {
    query = `
      SELECT u.display_name AS displayName, s.points, s.difficulty, s.created_at AS createdAt
      FROM scores s
      JOIN users u ON u.id = s.user_id
      WHERE s.difficulty = ?
      ORDER BY s.points DESC, s.created_at ASC
      LIMIT ?`;
    bindings = [difficulty, limit];
  }

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({ entries: results ?? [] });
});

app.get("/api/scores/me", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "No autenticado" }, 401);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT points, difficulty, created_at AS createdAt
     FROM scores
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`
  )
    .bind(user.id)
    .all();

  const best = await c.env.DB.prepare(
    `SELECT difficulty, MAX(points) AS best
     FROM scores
     WHERE user_id = ?
     GROUP BY difficulty`
  )
    .bind(user.id)
    .all<{ difficulty: Difficulty; best: number }>();

  return c.json({
    recent: results ?? [],
    bestByDifficulty: best.results ?? [],
  });
});

app.get("/api/meta/difficulties", (c) => c.json({ difficulties: DIFFICULTIES }));

app.get("/api/cards/catalog", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, asset_key AS assetKey, name, rarity, set_id AS setId FROM card_catalog ORDER BY id`
  ).all();
  return c.json({ cards: results?.length ? results : CARD_CATALOG });
});

app.get("/api/profile", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "Debes iniciar sesión" }, 401);
  }

  await initUserMeta(c.env.DB, user.id, Date.now());
  const coins = await getWallet(c.env.DB, user.id);
  const adventure = await getAdventureProgress(c.env.DB, user.id);

  return c.json({
    coins,
    packCost: PACK_COST,
    adventure: {
      maxWorldUnlocked: adventure.maxWorldUnlocked,
      clearedSublevels: adventure.clearedSublevels,
      failedByWorld: adventure.failedByWorld,
      completedAt: adventure.completedAt,
      adventureCompleted: adventure.completedAt !== null,
    },
  });
});

app.get("/api/collection", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "Debes iniciar sesión" }, 401);
  }

  const cards = await getCollection(c.env.DB, user.id);
  return c.json({ cards });
});

app.post("/api/adventure/sync", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "Debes iniciar sesión" }, 401);
  }

  const body = await c.req.json<{
    maxWorldUnlocked?: number;
    clearedSublevels?: Record<string, number>;
    failedByWorld?: Record<string, [number, number][]>;
  }>();

  const progress: AdventureProgress = {
    maxWorldUnlocked: Math.min(5, Math.max(1, body.maxWorldUnlocked ?? 1)),
    clearedSublevels: body.clearedSublevels ?? {},
    failedByWorld: body.failedByWorld ?? {},
    completedAt: (await getAdventureProgress(c.env.DB, user.id)).completedAt,
  };

  await saveAdventureProgress(c.env.DB, user.id, progress);
  return c.json({ ok: true, adventure: progress });
});

app.post("/api/adventure/complete", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "Debes iniciar sesión" }, 401);
  }

  const result = await completeAdventure(c.env.DB, user.id);
  const coins = await getWallet(c.env.DB, user.id);
  return c.json({ ...result, coins });
});

app.post("/api/shop/open-pack", async (c) => {
  let user;
  try {
    user = await requireUser(c);
  } catch {
    return c.json({ error: "Debes iniciar sesión" }, 401);
  }

  const result = await openPack(c.env.DB, user.id);
  if ("error" in result) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result);
});

app.all("*", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api/")) {
    return c.json({ error: "No encontrado" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
