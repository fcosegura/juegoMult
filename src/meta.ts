import { ADVENTURE_REWARD, CARD_CATALOG, PACK_COST, pickRandomCard } from "./cards";
import { newId } from "./crypto";

export interface AdventureProgressRow {
  max_world_unlocked: number;
  cleared_sublevels: string;
  failed_by_world: string;
  completed_at: number | null;
}

export interface AdventureProgress {
  maxWorldUnlocked: number;
  clearedSublevels: Record<string, number>;
  failedByWorld: Record<string, [number, number][]>;
  completedAt: number | null;
}

export function parseProgress(row: AdventureProgressRow): AdventureProgress {
  return {
    maxWorldUnlocked: row.max_world_unlocked,
    clearedSublevels: JSON.parse(row.cleared_sublevels || "{}"),
    failedByWorld: JSON.parse(row.failed_by_world || "{}"),
    completedAt: row.completed_at,
  };
}

export async function initUserMeta(db: D1Database, userId: string, now: number) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO user_wallet (user_id, coins, updated_at) VALUES (?, 0, ?)`
    )
    .bind(userId, now)
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO user_adventure_progress
       (user_id, max_world_unlocked, cleared_sublevels, failed_by_world, completed_at, updated_at)
       VALUES (?, 1, '{}', '{}', NULL, ?)`
    )
    .bind(userId, now)
    .run();
}

export async function getWallet(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT coins FROM user_wallet WHERE user_id = ?")
    .bind(userId)
    .first<{ coins: number }>();
  return row?.coins ?? 0;
}

export async function getAdventureProgress(
  db: D1Database,
  userId: string
): Promise<AdventureProgress> {
  const row = await db
    .prepare(
      `SELECT max_world_unlocked, cleared_sublevels, failed_by_world, completed_at
       FROM user_adventure_progress WHERE user_id = ?`
    )
    .bind(userId)
    .first<AdventureProgressRow>();
  if (!row) {
    return {
      maxWorldUnlocked: 1,
      clearedSublevels: {},
      failedByWorld: {},
      completedAt: null,
    };
  }
  return parseProgress(row);
}

export async function saveAdventureProgress(
  db: D1Database,
  userId: string,
  progress: AdventureProgress
) {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE user_adventure_progress SET
         max_world_unlocked = ?,
         cleared_sublevels = ?,
         failed_by_world = ?,
         completed_at = ?,
         updated_at = ?
       WHERE user_id = ?`
    )
    .bind(
      progress.maxWorldUnlocked,
      JSON.stringify(progress.clearedSublevels),
      JSON.stringify(progress.failedByWorld),
      progress.completedAt,
      now,
      userId
    )
    .run();
}

export async function completeAdventure(
  db: D1Database,
  userId: string
): Promise<{ coinsAwarded: number; alreadyCompleted: boolean }> {
  const progress = await getAdventureProgress(db, userId);
  if (progress.completedAt) {
    return { coinsAwarded: 0, alreadyCompleted: true };
  }
  const now = Date.now();
  progress.completedAt = now;
  await saveAdventureProgress(db, userId, progress);
  await db
    .prepare(
      `UPDATE user_wallet SET coins = coins + ?, updated_at = ? WHERE user_id = ?`
    )
    .bind(ADVENTURE_REWARD, now, userId)
    .run();
  return { coinsAwarded: ADVENTURE_REWARD, alreadyCompleted: false };
}

export async function openPack(db: D1Database, userId: string) {
  const coins = await getWallet(db, userId);
  if (coins < PACK_COST) {
    return { error: "No tienes suficientes monedas" as const };
  }

  const catalogRows = await db
    .prepare("SELECT id, rarity FROM card_catalog")
    .all<{ id: string; rarity: string }>();
  const catalog = catalogRows.results ?? [];
  const pool =
    catalog.length > 0
      ? catalog.map((c) => ({ id: c.id, rarity: c.rarity as import("./cards").CardRarity }))
      : CARD_CATALOG.map((c) => ({ id: c.id, rarity: c.rarity }));

  const picked = pickRandomCard(pool);
  const fromCatalog = CARD_CATALOG.find((c) => c.id === picked.id);
  const fromDb = fromCatalog
    ? null
    : await db
        .prepare(
          "SELECT id, asset_key AS assetKey, name, rarity FROM card_catalog WHERE id = ?"
        )
        .bind(picked.id)
        .first<{ id: string; assetKey: string; name: string; rarity: string }>();

  const meta = fromCatalog ?? fromDb;
  if (!meta) {
    return { error: "Catálogo de cartas no disponible" as const };
  }

  const now = Date.now();
  await db.batch([
    db
      .prepare(`UPDATE user_wallet SET coins = coins - ?, updated_at = ? WHERE user_id = ?`)
      .bind(PACK_COST, now, userId),
    db
      .prepare(
        `INSERT INTO user_cards (user_id, card_id, quantity, first_obtained_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + 1`
      )
      .bind(userId, picked.id, now),
  ]);

  return {
    card: {
      id: picked.id,
      assetKey: meta.assetKey,
      name: meta.name,
      rarity: meta.rarity,
    },
    coinsSpent: PACK_COST,
    coinsRemaining: coins - PACK_COST,
  };
}

export async function getCollection(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.asset_key AS assetKey, c.name, c.rarity, c.set_id AS setId,
              COALESCE(uc.quantity, 0) AS quantity,
              uc.first_obtained_at AS firstObtainedAt
       FROM card_catalog c
       LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ?
       ORDER BY c.rarity, c.id`
    )
    .bind(userId)
    .all();

  return results ?? [];
}
