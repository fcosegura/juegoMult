const CARD_ART_BASE = "/assets/cards/art";
const CARD_PLACEHOLDER_BASE = "/assets/cards/placeholders";
const EXTENSIONS = [".webp", ".png", ".svg"];

export function cardArtUrl(assetKey, { preferFinal = true } = {}) {
  const base = preferFinal ? CARD_ART_BASE : CARD_PLACEHOLDER_BASE;
  return `${base}/${assetKey}.svg`;
}

export function cardArtCandidates(assetKey) {
  const bases = [CARD_ART_BASE, CARD_PLACEHOLDER_BASE];
  const urls = [];
  for (const base of bases) {
    for (const ext of EXTENSIONS) {
      urls.push(`${base}/${assetKey}${ext}`);
    }
  }
  urls.push(missingCardUrl());
  return urls;
}

export function cardFrameUrl(rarity) {
  return `/assets/cards/frames/frame_${rarity}.svg`;
}

export function missingCardUrl() {
  return "/assets/cards/missing.svg";
}

export function worldBackgroundUrl(worldId) {
  const n = String(worldId).padStart(2, "0");
  return `/assets/worlds/backgrounds/world_${n}.svg`;
}

/** Apply cascade onerror: art → placeholders → missing */
export function bindCardImage(img, assetKey, { owned = true } = {}) {
  if (!owned) {
    img.src = missingCardUrl();
    img.classList.add("card-img--locked");
    return;
  }
  const candidates = cardArtCandidates(assetKey);
  let idx = 0;
  img.classList.remove("card-img--locked");
  const tryNext = () => {
    if (idx >= candidates.length) return;
    img.src = candidates[idx++];
  };
  img.onerror = tryNext;
  tryNext();
}

export const RARITY_LABELS = {
  common: "Común",
  rare: "Rara",
  epic: "Épica",
  legendary: "Legendaria",
};
