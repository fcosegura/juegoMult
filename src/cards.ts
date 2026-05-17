export type CardRarity = "common" | "rare" | "epic" | "legendary";

export const PACK_COST = 50;
export const ADVENTURE_REWARD = 100;

export const RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

export const CARD_CATALOG: {
  id: string;
  assetKey: string;
  name: string;
  rarity: CardRarity;
  setId: string;
}[] = [
  { id: "c001", assetKey: "card_001", name: "Estrella ×2", rarity: "common", setId: "set01" },
  { id: "c002", assetKey: "card_002", name: "Cohete ×3", rarity: "common", setId: "set01" },
  { id: "c003", assetKey: "card_003", name: "Gema ×4", rarity: "common", setId: "set01" },
  { id: "c004", assetKey: "card_004", name: "Rayo ×5", rarity: "common", setId: "set01" },
  { id: "c005", assetKey: "card_005", name: "Corona ×6", rarity: "common", setId: "set01" },
  { id: "c006", assetKey: "card_006", name: "Arco ×7", rarity: "common", setId: "set01" },
  { id: "c007", assetKey: "card_007", name: "Escudo ×8", rarity: "common", setId: "set01" },
  { id: "c008", assetKey: "card_008", name: "Llama ×9", rarity: "common", setId: "set01" },
  { id: "c009", assetKey: "card_009", name: "Orbe ×10", rarity: "rare", setId: "set01" },
  { id: "c010", assetKey: "card_010", name: "Dragón ×11", rarity: "rare", setId: "set01" },
  { id: "c011", assetKey: "card_011", name: "Fénix ×12", rarity: "rare", setId: "set01" },
  { id: "c012", assetKey: "card_012", name: "Titan ×3×4", rarity: "rare", setId: "set01" },
  { id: "c013", assetKey: "card_013", name: "Ninja ×5×6", rarity: "rare", setId: "set01" },
  { id: "c014", assetKey: "card_014", name: "Mago ×7×8", rarity: "epic", setId: "set01" },
  { id: "c015", assetKey: "card_015", name: "Reina ×9×9", rarity: "epic", setId: "set01" },
  { id: "c016", assetKey: "card_016", name: "Rey ×10×10", rarity: "epic", setId: "set01" },
  { id: "c017", assetKey: "card_017", name: "Cometa ×11×2", rarity: "epic", setId: "set01" },
  { id: "c018", assetKey: "card_018", name: "Galaxia ×12×3", rarity: "legendary", setId: "set01" },
  { id: "c019", assetKey: "card_019", name: "Unicornio ×8×7", rarity: "legendary", setId: "set01" },
  { id: "c020", assetKey: "card_020", name: "Arcade Master", rarity: "legendary", setId: "set01" },
];

export function isCardRarity(value: string): value is CardRarity {
  return ["common", "rare", "epic", "legendary"].includes(value);
}

export function pickRandomCard(
  catalog: { id: string; rarity: CardRarity }[],
  rng: () => number = Math.random
): { id: string; rarity: CardRarity } {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * totalWeight;
  let chosenRarity: CardRarity = "common";
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [CardRarity, number][]) {
    roll -= weight;
    if (roll <= 0) {
      chosenRarity = rarity;
      break;
    }
  }
  const pool = catalog.filter((c) => c.rarity === chosenRarity);
  const list = pool.length > 0 ? pool : catalog;
  return list[Math.floor(rng() * list.length)];
}
