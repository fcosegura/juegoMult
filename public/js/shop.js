import { bindCardImage, cardFrameUrl, RARITY_LABELS } from "./cards.assets.js";

export function renderPackReveal(container, card) {
  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="pack-reveal">
      <p class="pack-reveal-title">¡Nueva carta!</p>
      <article class="collection-card owned pack-card">
        <div class="card-frame-wrap">
          <img class="card-frame" src="${cardFrameUrl(card.rarity)}" alt="" />
          <img class="card-img" alt="" />
        </div>
        <p class="card-name">${escapeHtml(card.name)}</p>
        <span class="card-rarity-badge rarity-${card.rarity}">${RARITY_LABELS[card.rarity]}</span>
      </article>
    </div>
  `;
  const img = container.querySelector(".card-img");
  bindCardImage(img, card.assetKey, { owned: true });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
