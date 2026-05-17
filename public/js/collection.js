import { bindCardImage, cardFrameUrl, RARITY_LABELS } from "./cards.assets.js";

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

export function renderCollection(container, cards, { filter = "all" } = {}) {
  container.innerHTML = "";

  const groups = RARITY_ORDER.filter((r) => filter === "all" || filter === r);

  for (const rarity of groups) {
    const sectionCards = cards.filter((c) => c.rarity === rarity);
    if (!sectionCards.length) continue;

    const section = document.createElement("section");
    section.className = "collection-section";
    section.innerHTML = `<h3 class="collection-rarity rarity-${rarity}">${RARITY_LABELS[rarity]}</h3>`;

    const grid = document.createElement("div");
    grid.className = "card-grid";

    for (const card of sectionCards) {
      const owned = (card.quantity ?? 0) > 0;
      const el = document.createElement("article");
      el.className = `collection-card ${owned ? "owned" : "locked"}`;
      el.innerHTML = `
        <div class="card-frame-wrap">
          <img class="card-frame" src="${cardFrameUrl(rarity)}" alt="" />
          <img class="card-img" alt="" />
        </div>
        <p class="card-name">${escapeHtml(card.name)}</p>
        ${owned ? `<span class="card-qty">×${card.quantity}</span>` : ""}
      `;
      const img = el.querySelector(".card-img");
      bindCardImage(img, card.assetKey, { owned });
      grid.appendChild(el);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  if (!container.children.length) {
    container.innerHTML = `<p class="empty-state">No hay cartas en esta categoría.</p>`;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
