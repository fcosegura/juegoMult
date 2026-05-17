export const QUESTIONS_PER_SUBLEVEL = 5;
export const TIME_LIMIT = 10;
export const LIVES_PER_RUN = 3;
export const REVIEW_QUESTIONS_IF_NO_FAILURES = 3;

export const WORLDS = [
  {
    id: 1,
    name: "Bosque Numérico",
    range: [2, 5],
    theme: "world_01",
  },
  {
    id: 2,
    name: "Cueva de Cristales",
    range: [3, 7],
    theme: "world_02",
  },
  {
    id: 3,
    name: "Volcán Multiplica",
    range: [4, 9],
    theme: "world_03",
  },
  {
    id: 4,
    name: "Cielo Estelar",
    range: [6, 12],
    theme: "world_04",
  },
  {
    id: 5,
    name: "Castillo Final",
    range: [2, 12],
    theme: "world_05",
    isFinal: true,
  },
];

export function getWorld(worldId) {
  return WORLDS.find((w) => w.id === worldId);
}

export function sublevelKey(worldId, sublevel) {
  return `${worldId}:${sublevel}`;
}

export function isBossSublevel(sublevel) {
  return sublevel === 4;
}

export function isFinalWorld(worldId) {
  return worldId === 5;
}
