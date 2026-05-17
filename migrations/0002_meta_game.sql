-- Meta-game: wallet, adventure progress, cards
CREATE TABLE IF NOT EXISTS user_wallet (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_adventure_progress (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  max_world_unlocked INTEGER NOT NULL DEFAULT 1,
  cleared_sublevels TEXT NOT NULL DEFAULT '{}',
  failed_by_world TEXT NOT NULL DEFAULT '{}',
  completed_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  asset_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  set_id TEXT
);

CREATE TABLE IF NOT EXISTS user_cards (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES card_catalog (id),
  quantity INTEGER NOT NULL DEFAULT 1,
  first_obtained_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards (user_id);

-- Seed card catalog (20 cards)
INSERT INTO card_catalog (id, asset_key, name, rarity, set_id) VALUES
  ('c001', 'card_001', 'Estrella ×2', 'common', 'set01'),
  ('c002', 'card_002', 'Cohete ×3', 'common', 'set01'),
  ('c003', 'card_003', 'Gema ×4', 'common', 'set01'),
  ('c004', 'card_004', 'Rayo ×5', 'common', 'set01'),
  ('c005', 'card_005', 'Corona ×6', 'common', 'set01'),
  ('c006', 'card_006', 'Arco ×7', 'common', 'set01'),
  ('c007', 'card_007', 'Escudo ×8', 'common', 'set01'),
  ('c008', 'card_008', 'Llama ×9', 'common', 'set01'),
  ('c009', 'card_009', 'Orbe ×10', 'rare', 'set01'),
  ('c010', 'card_010', 'Dragón ×11', 'rare', 'set01'),
  ('c011', 'card_011', 'Fénix ×12', 'rare', 'set01'),
  ('c012', 'card_012', 'Titan ×3×4', 'rare', 'set01'),
  ('c013', 'card_013', 'Ninja ×5×6', 'rare', 'set01'),
  ('c014', 'card_014', 'Mago ×7×8', 'epic', 'set01'),
  ('c015', 'card_015', 'Reina ×9×9', 'epic', 'set01'),
  ('c016', 'card_016', 'Rey ×10×10', 'epic', 'set01'),
  ('c017', 'card_017', 'Cometa ×11×2', 'epic', 'set01'),
  ('c018', 'card_018', 'Galaxia ×12×3', 'legendary', 'set01'),
  ('c019', 'card_019', 'Unicornio ×8×7', 'legendary', 'set01'),
  ('c020', 'card_020', 'Arcade Master', 'legendary', 'set01');
