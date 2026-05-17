import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = join(root, "public/assets/cards/placeholders");
const framesDir = join(root, "public/assets/cards/frames");
const worldsDir = join(root, "public/assets/worlds/backgrounds");

mkdirSync(cardsDir, { recursive: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(worldsDir, { recursive: true });
mkdirSync(join(root, "public/assets/cards/art"), { recursive: true });

const PALETTE = [
  "#ff6b9d", "#c44569", "#f8b500", "#6c5ce7", "#00cec9",
  "#55efc4", "#fd79a8", "#e17055", "#74b9ff", "#a29bfe",
];

function cardSvg(i, color) {
  const n = String(i).padStart(3, "0");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 176" width="128" height="176">
  <rect width="128" height="176" fill="#1a1a2e"/>
  <rect x="8" y="8" width="112" height="160" fill="${color}" stroke="#fff" stroke-width="2"/>
  <rect x="16" y="24" width="96" height="72" fill="#0f0f1a" opacity="0.5"/>
  <circle cx="64" cy="60" r="24" fill="#fff" opacity="0.9"/>
  <text x="64" y="68" text-anchor="middle" font-family="monospace" font-size="14" fill="${color}">#${n}</text>
  <text x="64" y="140" text-anchor="middle" font-family="monospace" font-size="10" fill="#fff">CARD</text>
</svg>`;
}

const FRAME_COLORS = {
  common: "#9e9e9e",
  rare: "#42a5f5",
  epic: "#ab47bc",
  legendary: "#ffd700",
};

function frameSvg(rarity, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 176" width="128" height="176">
  <rect x="4" y="4" width="120" height="168" fill="none" stroke="${color}" stroke-width="6"/>
  <rect x="10" y="10" width="108" height="156" fill="none" stroke="${color}" stroke-width="2" opacity="0.6"/>
</svg>`;
}

const WORLD_COLORS = ["#2d1b69", "#1b4d3e", "#4d1b1b", "#1b3d4d", "#4d3d1b"];

function worldSvg(i, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" width="480" height="270">
  <rect width="480" height="270" fill="${color}"/>
  <rect y="200" width="480" height="70" fill="#0a0a12" opacity="0.6"/>
  ${Array.from({ length: 20 }, (_, j) => {
    const x = j * 24;
    const h = 40 + (j % 5) * 20;
    return `<rect x="${x}" y="${200 - h}" width="20" height="${h}" fill="#0f3460" opacity="0.8"/>`;
  }).join("")}
  <text x="240" y="40" text-anchor="middle" font-family="monospace" font-size="24" fill="#fff">MUNDO ${i}</text>
  <circle cx="80" cy="80" r="30" fill="#ffd700" opacity="0.8"/>
  <circle cx="400" cy="100" r="20" fill="#ff6b9d" opacity="0.8"/>
</svg>`;
}

for (let i = 1; i <= 20; i++) {
  const key = `card_${String(i).padStart(3, "0")}`;
  writeFileSync(join(cardsDir, `${key}.svg`), cardSvg(i, PALETTE[(i - 1) % PALETTE.length]));
}

for (const [rarity, color] of Object.entries(FRAME_COLORS)) {
  writeFileSync(join(framesDir, `frame_${rarity}.svg`), frameSvg(rarity, color));
}

writeFileSync(
  join(root, "public/assets/cards/missing.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 176" width="128" height="176">
  <rect width="128" height="176" fill="#2a2a3e"/>
  <text x="64" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#666">?</text>
</svg>`
);

for (let i = 1; i <= 5; i++) {
  writeFileSync(
    join(worldsDir, `world_${String(i).padStart(2, "0")}.svg`),
    worldSvg(i, WORLD_COLORS[i - 1])
  );
}

console.log("Generated placeholder SVGs");
