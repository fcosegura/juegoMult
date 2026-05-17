import {
  adventureApi,
  authApi,
  collectionApi,
  profileApi,
  scoresApi,
  shopApi,
} from "./api.js";
import { AdventureRun, getAdventureMode, mergeFailures } from "./adventure.js";
import { worldBackgroundUrl } from "./cards.assets.js";
import { renderCollection } from "./collection.js";
import { renderPackReveal } from "./shop.js";
import { DIFFICULTY_LABELS, Game } from "./game.js";
import {
  getWorld,
  isBossSublevel,
  LIVES_PER_RUN,
  sublevelKey,
  TIME_LIMIT,
  WORLDS,
} from "./worlds.config.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let currentUser = null;
let authMode = "login";
let selectedDifficulty = null;
let game = null;
let adventureRun = null;
let gameMode = "arcade";
let deferredInstall = null;

let profile = {
  coins: 0,
  packCost: 50,
  adventure: {
    maxWorldUnlocked: 1,
    clearedSublevels: {},
    failedByWorld: {},
    completedAt: null,
    adventureCompleted: false,
  },
};

let adventureContext = { worldId: 1, sublevel: 1 };
let pendingAdventureEnd = null;

const screens = {
  menu: $("#screen-menu"),
  auth: $("#screen-auth"),
  difficulty: $("#screen-difficulty"),
  adventureMap: $("#screen-adventure-map"),
  adventureLevels: $("#screen-adventure-levels"),
  game: $("#screen-game"),
  gameover: $("#screen-gameover"),
  shop: $("#screen-shop"),
  collection: $("#screen-collection"),
  leaderboard: $("#screen-leaderboard"),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.classList.toggle("active", key === name);
  });
}

function setAuthError(msg) {
  const el = $("#auth-error");
  if (msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function requireAuth(actionName) {
  if (currentUser) return true;
  alert(`Debes iniciar sesión para ${actionName}.`);
  authMode = "login";
  updateAuthForm();
  showScreen("auth");
  return false;
}

async function refreshUser() {
  try {
    const { user } = await authApi.me();
    currentUser = user;
  } catch {
    currentUser = null;
  }
  updateUserBanner();
  if (currentUser) await refreshProfile();
  else resetProfile();
}

function resetProfile() {
  profile = {
    coins: 0,
    packCost: 50,
    adventure: {
      maxWorldUnlocked: 1,
      clearedSublevels: {},
      failedByWorld: {},
      completedAt: null,
      adventureCompleted: false,
    },
  };
  updateCoinsUI();
}

async function refreshProfile() {
  try {
    const data = await profileApi.get();
    profile.coins = data.coins ?? 0;
    profile.packCost = data.packCost ?? 50;
    profile.adventure = data.adventure ?? profile.adventure;
    updateCoinsUI();
  } catch {
    /* ignore */
  }
}

function updateCoinsUI() {
  const coins = profile.coins;
  $("#menu-coins").textContent = coins;
  $("#shop-coins").textContent = coins;
  $("#shop-pack-cost").textContent = profile.packCost;
  const bar = $("#coins-bar");
  if (currentUser) bar.classList.remove("hidden");
  else bar.classList.add("hidden");
}

function updateUserBanner() {
  const banner = $("#user-banner");
  const btnAuth = $("#btn-auth");
  if (currentUser) {
    banner.classList.remove("hidden");
    banner.innerHTML = `Hola, <strong>${escapeHtml(currentUser.displayName)}</strong> (@${escapeHtml(currentUser.username)})`;
    btnAuth.textContent = "Cerrar sesión";
  } else {
    banner.classList.add("hidden");
    btnAuth.textContent = "Entrar";
  }
}

async function syncAdventureProgress() {
  if (!currentUser) return;
  await adventureApi.sync({
    maxWorldUnlocked: profile.adventure.maxWorldUnlocked,
    clearedSublevels: profile.adventure.clearedSublevels,
    failedByWorld: profile.adventure.failedByWorld,
  });
}

// Navigation (delegación: los overlays CRT no bloquean los clics)
$("#app")?.addEventListener("click", async (e) => {
  if (e.target.closest("[data-back]")) {
    showScreen("menu");
    return;
  }

  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "menu") {
    showScreen("menu");
    return;
  }

  if (action === "arcade") {
    gameMode = "arcade";
    showScreen("difficulty");
    const note = $("#guest-note");
    if (note) {
      note.textContent = currentUser
        ? "Tu puntaje se guardará en el ranking arcade."
        : "Puedes jugar sin cuenta. Inicia sesión para guardar en el ranking.";
    }
    return;
  }

  if (action === "adventure") {
    if (!requireAuth("jugar la aventura")) return;
    await refreshProfile();
    renderAdventureMap();
    showScreen("adventureMap");
    return;
  }

  if (action === "adventure-map") {
    renderAdventureMap();
    showScreen("adventureMap");
    return;
  }

  if (action === "shop") {
    if (!requireAuth("usar la tienda")) return;
    await refreshProfile();
    $("#pack-reveal")?.classList.add("hidden");
    $("#shop-error")?.classList.add("hidden");
    showScreen("shop");
    return;
  }

  if (action === "collection") {
    if (!requireAuth("ver la colección")) return;
    await loadCollection();
    showScreen("collection");
    return;
  }

  if (action === "play-again") {
    if (gameMode === "arcade") {
      if (selectedDifficulty) startArcadeGame(selectedDifficulty);
      else showScreen("difficulty");
    } else if (pendingAdventureEnd) {
      const { worldId, sublevel } = pendingAdventureEnd;
      startAdventureGame(worldId, sublevel);
    } else {
      showScreen("adventureMap");
    }
    return;
  }

  if (action === "leaderboard") {
    showScreen("leaderboard");
    await loadLeaderboard();
    return;
  }

  if (action === "auth") {
    if (currentUser) {
      await authApi.logout();
      currentUser = null;
      resetProfile();
      updateUserBanner();
      return;
    }
    authMode = "login";
    updateAuthForm();
    showScreen("auth");
    return;
  }

  if (action === "quit-game") {
    if (game) game.stop();
    if (adventureRun) adventureRun.stop();
    game = null;
    adventureRun = null;
    resetGameScreenFx();
    showScreen(gameMode === "arcade" ? "difficulty" : "adventureMap");
  }
});

$("#btn-adventure-continue")?.addEventListener("click", () => {
  if (pendingAdventureEnd?.won) {
    showScreen("adventureMap");
    renderAdventureMap();
  } else if (pendingAdventureEnd) {
    startAdventureGame(pendingAdventureEnd.worldId, pendingAdventureEnd.sublevel);
  }
});

// Difficulty / arcade
$$("[data-level]").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDifficulty = btn.dataset.level;
    startArcadeGame(selectedDifficulty);
  });
});

// Auth
$("#auth-toggle").addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  updateAuthForm();
});

function updateAuthForm() {
  const isRegister = authMode === "register";
  $("#auth-title").textContent = isRegister ? "Crear cuenta" : "Iniciar sesión";
  $("#display-name-field").classList.toggle("hidden", !isRegister);
  $("#auth-toggle").textContent = isRegister
    ? "¿Ya tienes cuenta? Inicia sesión"
    : "¿No tienes cuenta? Regístrate";
  setAuthError("");
}

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  const fd = new FormData(e.target);
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const displayName = String(fd.get("displayName") || "").trim();

  try {
    if (authMode === "register") {
      const { user } = await authApi.register({ username, password, displayName });
      currentUser = user;
    } else {
      const { user } = await authApi.login({ username, password });
      currentUser = user;
    }
    updateUserBanner();
    await refreshProfile();
    showScreen("menu");
    e.target.reset();
  } catch (err) {
    setAuthError(err.message || "No se pudo completar");
  }
});

// Leaderboard
$("#leaderboard-filter").addEventListener("change", loadLeaderboard);

async function loadLeaderboard() {
  const difficulty = $("#leaderboard-filter").value;
  const list = $("#leaderboard-list");
  const empty = $("#leaderboard-empty");
  list.innerHTML = "";

  try {
    const { entries } = await scoresApi.leaderboard(difficulty, 10);
    if (!entries?.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    entries.forEach((row, i) => {
      const li = document.createElement("li");
      const diff =
        difficulty === "all"
          ? ` · ${DIFFICULTY_LABELS[row.difficulty] || row.difficulty}`
          : "";
      li.innerHTML = `
        <span class="rank">${i + 1}.</span>
        <span class="meta">${escapeHtml(row.displayName)}${diff}</span>
        <span class="pts">${row.points} pts</span>`;
      list.appendChild(li);
    });
  } catch {
    empty.textContent = "No se pudo cargar el ranking.";
    empty.classList.remove("hidden");
  }
}

// Adventure map
function renderAdventureMap() {
  const map = $("#world-map");
  const adv = profile.adventure;
  map.innerHTML = "";

  $("#adventure-map-desc").textContent = adv.adventureCompleted
    ? "¡Completaste la aventura! Puedes repetir niveles para practicar."
    : "Completa los subniveles de cada mundo. El jefe repregunta lo que fallaste.";

  for (const world of WORLDS) {
    const unlocked = world.id <= adv.maxWorldUnlocked;
    const cleared = adv.clearedSublevels[String(world.id)] ?? 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `world-card ${unlocked ? "" : "locked"}`;
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <span class="world-card-bg" style="background-image:url('${worldBackgroundUrl(world.id)}')"></span>
      <span class="world-card-body">
        <strong>Mundo ${world.id}</strong>
        <span>${escapeHtml(world.name)}</span>
        <small>${cleared}/4 subniveles</small>
      </span>`;
    btn.addEventListener("click", () => openWorldLevels(world.id));
    map.appendChild(btn);
  }
}

function openWorldLevels(worldId) {
  adventureContext.worldId = worldId;
  const world = getWorld(worldId);
  $("#adventure-world-title").textContent = `Mundo ${worldId}: ${world.name}`;
  const list = $("#sublevel-list");
  list.innerHTML = "";
  const cleared = profile.adventure.clearedSublevels[String(worldId)] ?? 0;

  for (let s = 1; s <= 4; s++) {
    const unlocked = s === 1 || cleared >= s - 1;
    const done = cleared >= s;
    const isBoss = isBossSublevel(s);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `sublevel-btn ${done ? "done" : ""} ${unlocked ? "" : "locked"}`;
    btn.disabled = !unlocked;
    btn.textContent = isBoss ? `⭐ Jefe (nivel ${s})` : `Nivel ${s}`;
    btn.addEventListener("click", () => startAdventureGame(worldId, s));
    list.appendChild(btn);
  }
  showScreen("adventureLevels");
}

function setWorldBackground(worldId) {
  const screen = screens.game;
  screen.dataset.world = String(worldId);
  screen.style.setProperty(
    "--world-bg",
    `url('${worldBackgroundUrl(worldId)}')`
  );
}

const ARCADE_LIVES = 3;

let prevLives = null;
let lifeLossAnimating = false;

function clearLifeLossVisuals() {
  lifeLossAnimating = false;
  $("#life-loss-overlay")?.classList.add("hidden");
  document.querySelector(".game-stage")?.classList.remove("life-loss-flash");
  $("#knight")?.classList.remove("falling");
  const lossFx = $("#loss-fx");
  lossFx?.classList.add("hidden");
  lossFx?.classList.remove("active");
}

function resetGameScreenFx() {
  prevLives = null;
  clearLifeLossVisuals();
  $("#knight")?.style.removeProperty("left");
}

function initTimeRoute(timeLimit = TIME_LIMIT) {
  const container = $("#time-route-platforms");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < timeLimit; i++) {
    const block = document.createElement("span");
    block.className = "stone-platform";
    container.appendChild(block);
  }
}

function updateTimeRoute(remaining, timeLimit) {
  const knight = $("#knight");
  if (!knight || lifeLossAnimating) return;
  const elapsed = Math.max(0, timeLimit - remaining);
  const progress = Math.min(1, elapsed / timeLimit);
  knight.style.left = `${4 + progress * 68}%`;

  $$(".stone-platform").forEach((el, i) => {
    el.classList.toggle("active", i < elapsed);
  });
}

function renderPixelHearts(lives, maxLives, dyingIndex = -1) {
  const container = $("#hearts");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < maxLives; i++) {
    const heart = document.createElement("span");
    heart.className = "pixel-heart";
    if (i < lives) {
      /* lleno — estilo por defecto */
    } else if (i === dyingIndex) {
      heart.classList.add("dying");
    } else {
      heart.classList.add("empty");
    }
    container.appendChild(heart);
  }
}

function playLifeLossFx(type) {
  if (lifeLossAnimating) return;
  lifeLossAnimating = true;

  const banner = $("#life-loss-banner");
  const overlay = $("#life-loss-overlay");
  const stage = document.querySelector(".game-stage");
  const knight = $("#knight");
  const lossFx = $("#loss-fx");

  if (banner) {
    banner.textContent =
      type === "timeout"
        ? "¡TIEMPO AGOTADO! VIDA PERDIDA!"
        : "¡INCORRECTO! VIDA PERDIDA!";
  }
  overlay?.classList.remove("hidden");
  stage?.classList.add("life-loss-flash");
  knight?.classList.add("falling");
  lossFx?.classList.remove("hidden");
  lossFx?.classList.add("active");

  setTimeout(clearLifeLossVisuals, 1200);
}

function applyLifeHud(state, maxLives) {
  const lostLife = prevLives !== null && state.lives < prevLives;
  const dyingIndex = lostLife ? state.lives : -1;
  renderPixelHearts(state.lives, maxLives, dyingIndex);
  if (lostLife && (state.type === "timeout" || state.type === "wrong")) {
    playLifeLossFx(state.type);
  }
  prevLives = state.lives;
}

function prepareGameScreen({ mode, levelText, scoreText, timeLimit = TIME_LIMIT }) {
  resetGameScreenFx();
  initTimeRoute(timeLimit);
  screens.game.classList.toggle("mode-arcade", mode === "arcade");
  $("#level-label").textContent = levelText;
  $("#score-label").textContent = scoreText;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  $("#answer-input").value = "";
  const maxLives = maxLivesForMode(mode);
  renderPixelHearts(maxLives, maxLives);
  updateTimeRoute(timeLimit, timeLimit);
}

function maxLivesForMode(mode) {
  return mode === "arcade" ? ARCADE_LIVES : LIVES_PER_RUN;
}

// Arcade game
function startArcadeGame(difficulty) {
  gameMode = "arcade";
  if (adventureRun) adventureRun.stop();
  adventureRun = null;
  if (game) game.stop();
  showScreen("game");
  screens.game.dataset.world = "";
  screens.game.style.removeProperty("--world-bg");

  const diffLabel = DIFFICULTY_LABELS[difficulty]?.toUpperCase() ?? difficulty;
  prepareGameScreen({
    mode: "arcade",
    levelText: `ARCADE - ${diffLabel}`,
    scoreText: "Puntos: 0",
  });

  game = new Game({
    difficulty,
    onUpdate: renderArcadeGame,
    onEnd: endArcadeGame,
  });
  game.start();
  $("#answer-input").focus();
}

function renderArcadeGame(state) {
  applyLifeHud(state, ARCADE_LIVES);
  $("#score-label").textContent = `Puntos: ${state.score}`;

  if (state.type === "tick" || state.type === "timeout") {
    $("#question").textContent = `¿Cuánto es ${state.a} × ${state.b}?`;
    updateTimeRoute(state.remaining ?? 0, state.timeLimit ?? TIME_LIMIT);
  }

  setFeedback(state);
}

async function endArcadeGame({ score, difficulty }) {
  game = null;
  pendingAdventureEnd = null;
  $("#gameover-title").textContent = "¡Fin de la partida!";
  $("#final-score").textContent = `Puntos: ${score}`;
  $("#btn-adventure-continue").classList.add("hidden");
  $("[data-action='play-again']").classList.remove("hidden");
  const status = $("#save-status");
  status.textContent = "";
  showScreen("gameover");

  if (!currentUser) {
    status.textContent = "Inicia sesión para guardar tu puntaje en el ranking.";
    return;
  }

  try {
    await scoresApi.save(score, difficulty);
    status.textContent = `¡Guardado! (${DIFFICULTY_LABELS[difficulty]})`;
  } catch (err) {
    status.textContent = err.message || "No se pudo guardar el puntaje.";
  }
}

// Adventure game
function startAdventureGame(worldId, sublevel) {
  gameMode = "adventure";
  adventureContext = { worldId, sublevel };
  if (game) game.stop();
  game = null;
  if (adventureRun) adventureRun.stop();

  const mode = getAdventureMode(worldId, sublevel);
  setWorldBackground(worldId);
  showScreen("game");

  const isBoss = mode !== "normal";
  const levelText = isBoss
    ? `MUNDO ${worldId} - JEFE`
    : `MUNDO ${worldId} - NIVEL ${sublevel}`;

  prepareGameScreen({
    mode: "adventure",
    levelText,
    scoreText: "Aciertos: 0 / ?",
  });

  adventureRun = new AdventureRun({
    worldId,
    sublevel,
    mode,
    failedByWorld: profile.adventure.failedByWorld,
    onUpdate: renderAdventureGame,
    onEnd: endAdventureGame,
  });
  adventureRun.start();
  $("#answer-input").focus();
}

function renderAdventureGame(state) {
  applyLifeHud(state, LIVES_PER_RUN);
  $("#score-label").textContent = `Aciertos: ${state.correct} / ${state.totalQuestions}`;

  if (state.type === "tick" || state.type === "timeout") {
    $("#question").textContent = `¿Cuánto es ${state.a} × ${state.b}?`;
    updateTimeRoute(state.remaining ?? 0, state.timeLimit ?? TIME_LIMIT);
  }

  setFeedback(state, true);
}

async function endAdventureGame(result) {
  adventureRun = null;
  pendingAdventureEnd = result;

  $("#btn-adventure-continue").classList.remove("hidden");
  $("[data-action='play-again']").textContent = result.won ? "Repetir nivel" : "Reintentar";

  if (result.won) {
    $("#gameover-title").textContent = "¡Nivel completado!";
    $("#final-score").textContent = `${result.correct}/${result.total} aciertos`;

    profile.adventure.failedByWorld = mergeFailures(
      profile.adventure.failedByWorld,
      result.worldId,
      result.newFailures
    );

    const key = String(result.worldId);
    const prev = profile.adventure.clearedSublevels[key] ?? 0;
    if (result.sublevel > prev) {
      profile.adventure.clearedSublevels[key] = result.sublevel;
    }

    if (result.sublevel >= 4 && result.worldId < 5) {
      profile.adventure.maxWorldUnlocked = Math.max(
        profile.adventure.maxWorldUnlocked,
        result.worldId + 1
      );
    }

    if (result.mode === "boss_final") {
      $("#save-status").textContent = "¡Venciste al castillo final!";
      try {
        const res = await adventureApi.complete();
        if (res.coinsAwarded > 0) {
          $("#save-status").textContent = `¡+${res.coinsAwarded} monedas!`;
          profile.coins = res.coins;
          profile.adventure.adventureCompleted = true;
          profile.adventure.completedAt = Date.now();
        } else if (res.alreadyCompleted) {
          $("#save-status").textContent = "Aventura ya completada. ¡Sigue coleccionando!";
        }
      } catch (err) {
        $("#save-status").textContent = err.message || "Error al guardar recompensa.";
      }
    } else {
      $("#save-status").textContent = "Progreso guardado.";
    }

    await syncAdventureProgress();
    updateCoinsUI();
  } else {
    $("#gameover-title").textContent = "Nivel fallido";
    $("#final-score").textContent = "¡Inténtalo de nuevo!";
    $("#save-status").textContent = "";
    profile.adventure.failedByWorld = mergeFailures(
      profile.adventure.failedByWorld,
      result.worldId,
      result.newFailures
    );
    await syncAdventureProgress();
  }

  showScreen("gameover");
}

function setFeedback(state, isAdventure = false) {
  const fb = $("#feedback");
  if (state.type === "correct") {
    fb.textContent = "¡Correcto!";
    fb.className = "feedback ok";
  } else if (state.type === "wrong") {
    const ans = state.a * state.b;
    fb.textContent = isAdventure ? `Incorrecto. Era ${ans}` : `Incorrecto. Era ${state.answer ?? ans}`;
    fb.className = "feedback bad";
  } else if (state.type === "timeout") {
    fb.textContent = "";
    fb.className = "feedback bad";
  }
}

$("#answer-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const value = $("#answer-input").value;
  const fb = $("#feedback");

  if (game) {
    const result = game.submitAnswer(value);
    if (result.reason === "invalid") {
      fb.textContent = "¡Entrada inválida!";
      fb.className = "feedback warn";
      return;
    }
    if (result.ok) $("#answer-input").value = "";
    return;
  }

  if (adventureRun) {
    const result = adventureRun.submitAnswer(value);
    if (result.reason === "invalid") {
      fb.textContent = "¡Entrada inválida!";
      fb.className = "feedback warn";
      return;
    }
    if (result.ok) $("#answer-input").value = "";
  }
});

// Shop
$("#btn-open-pack")?.addEventListener("click", async () => {
  const errEl = $("#shop-error");
  errEl.classList.add("hidden");
  try {
    const result = await shopApi.openPack();
    profile.coins = result.coinsRemaining;
    updateCoinsUI();
    renderPackReveal($("#pack-reveal"), result.card);
  } catch (err) {
    errEl.textContent = err.message || "No se pudo abrir el sobre";
    errEl.classList.remove("hidden");
  }
});

// Collection
$("#collection-filter")?.addEventListener("change", loadCollection);

async function loadCollection() {
  const filter = $("#collection-filter").value;
  try {
    const { cards } = await collectionApi.get();
    renderCollection($("#collection-grid"), cards, { filter });
  } catch (err) {
    $("#collection-grid").innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  }
}

// PWA
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  $("#install-hint").classList.remove("hidden");
});

$("#btn-install")?.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("#install-hint").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

refreshUser();
showScreen("menu");
