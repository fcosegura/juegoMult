export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export type AppEnv = { Bindings: Env };

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  created_at: number;
}

export type Difficulty = "facil" | "medio" | "dificil";

export const DIFFICULTIES: Difficulty[] = ["facil", "medio", "dificil"];

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as string[]).includes(value);
}
