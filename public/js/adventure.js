import {
  isBossSublevel,
  isFinalWorld,
  QUESTIONS_PER_SUBLEVEL,
  REVIEW_QUESTIONS_IF_NO_FAILURES,
  TIME_LIMIT,
  LIVES_PER_RUN,
  getWorld,
} from "./worlds.config.js";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function qKey(a, b) {
  return `${a},${b}`;
}

export class AdventureRun {
  constructor({
    worldId,
    sublevel,
    mode,
    failedByWorld,
    onUpdate,
    onEnd,
  }) {
    this.worldId = worldId;
    this.sublevel = sublevel;
    this.mode = mode;
    this.failedByWorld = failedByWorld;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;

    this.world = getWorld(worldId);
    this.lives = LIVES_PER_RUN;
    this.correct = 0;
    this.questionIndex = 0;
    this.totalQuestions = QUESTIONS_PER_SUBLEVEL;
    this.queue = [];
    this.newFailures = [];
    this.remaining = TIME_LIMIT;
    this.timerId = null;
    this.locked = false;
    this.a = 0;
    this.b = 0;
  }

  start() {
    this.buildQueue();
    this.nextQuestion();
  }

  stop() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  buildQueue() {
    if (this.mode === "boss_world") {
      const failed = this.failedByWorld[String(this.worldId)] ?? [];
      if (failed.length === 0) {
        this.queue = this.generateReviewQuestions(REVIEW_QUESTIONS_IF_NO_FAILURES);
      } else {
        this.queue = shuffle(failed.map(([a, b]) => ({ a, b })));
      }
      this.totalQuestions = this.queue.length;
      return;
    }

    if (this.mode === "boss_final") {
      const all = [];
      for (let w = 1; w <= 4; w++) {
        const failed = this.failedByWorld[String(w)] ?? [];
        failed.forEach(([a, b]) => all.push({ a, b }));
      }
      if (all.length === 0) {
        this.queue = this.generateReviewQuestions(REVIEW_QUESTIONS_IF_NO_FAILURES);
      } else {
        const seen = new Set();
        this.queue = shuffle(all).filter(({ a, b }) => {
          const k = qKey(a, b);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      this.totalQuestions = this.queue.length;
      return;
    }

    this.queue = [];
    const [min, max] = this.world.range;
    const used = new Set();
    while (this.queue.length < QUESTIONS_PER_SUBLEVEL) {
      const a = randomInt(min, max);
      const b = randomInt(min, max);
      const k = qKey(a, b);
      if (used.has(k)) continue;
      used.add(k);
      this.queue.push({ a, b });
    }
    this.totalQuestions = this.queue.length;
  }

  generateReviewQuestions(count) {
    const [min, max] = this.world.range;
    const out = [];
    const used = new Set();
    while (out.length < count) {
      const a = randomInt(min, max);
      const b = randomInt(min, max);
      const k = qKey(a, b);
      if (used.has(k)) continue;
      used.add(k);
      out.push({ a, b });
    }
    return out;
  }

  recordFailure(a, b) {
    const k = qKey(a, b);
    if (!this.newFailures.some(([x, y]) => qKey(x, y) === k)) {
      this.newFailures.push([a, b]);
    }
  }

  nextQuestion() {
    if (this.questionIndex >= this.queue.length) {
      this.finish(true);
      return;
    }

    this.locked = false;
    this.remaining = TIME_LIMIT;
    const { a, b } = this.queue[this.questionIndex];
    this.a = a;
    this.b = b;
    this.startTimer();
    this.emit("tick");
  }

  startTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) this.onTimeout();
      else this.emit("tick");
    }, 1000);
  }

  onTimeout() {
    if (this.locked) return;
    this.locked = true;
    if (this.timerId) clearInterval(this.timerId);
    this.lives -= 1;
    if (this.mode === "normal") this.recordFailure(this.a, this.b);
    this.emit("timeout");
    this.afterRound();
  }

  submitAnswer(value) {
    if (this.locked) return { ok: false, reason: "locked" };
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, reason: "invalid" };
    }

    this.locked = true;
    if (this.timerId) clearInterval(this.timerId);

    const correct = n === this.a * this.b;
    if (correct) {
      this.correct += 1;
      this.emit("correct");
    } else {
      this.lives -= 1;
      if (this.mode === "normal") this.recordFailure(this.a, this.b);
      this.emit("wrong");
    }
    this.afterRound();
    return { ok: true, correct };
  }

  afterRound() {
    if (this.lives <= 0) {
      setTimeout(() => {
        this.stop();
        this.finish(false);
      }, 1200);
      return;
    }
    this.questionIndex += 1;
    setTimeout(() => this.nextQuestion(), 1200);
  }

  finish(won) {
    this.onEnd({
      won,
      worldId: this.worldId,
      sublevel: this.sublevel,
      mode: this.mode,
      correct: this.correct,
      total: this.totalQuestions,
      newFailures: this.newFailures,
    });
  }

  emit(type) {
    this.onUpdate({
      type,
      lives: this.lives,
      correct: this.correct,
      questionIndex: this.questionIndex,
      totalQuestions: this.totalQuestions,
      a: this.a,
      b: this.b,
      remaining: this.remaining,
      timeLimit: TIME_LIMIT,
      worldId: this.worldId,
      sublevel: this.sublevel,
      mode: this.mode,
      isBoss: this.mode !== "normal",
      worldName: this.world?.name ?? "",
    });
  }
}

export function getAdventureMode(worldId, sublevel) {
  if (isFinalWorld(worldId) && isBossSublevel(sublevel)) return "boss_final";
  if (isBossSublevel(sublevel)) return "boss_world";
  return "normal";
}

export function mergeFailures(failedByWorld, worldId, newFailures) {
  const key = String(worldId);
  const existing = failedByWorld[key] ?? [];
  const seen = new Set(existing.map(([a, b]) => qKey(a, b)));
  const merged = [...existing];
  for (const [a, b] of newFailures) {
    const k = qKey(a, b);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push([a, b]);
    }
  }
  return { ...failedByWorld, [key]: merged };
}
