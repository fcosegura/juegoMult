const RANGES = {
  facil: [1, 5],
  medio: [1, 10],
  dificil: [5, 15],
};

const TIME_LIMIT = 10;

export class Game {
  constructor({ difficulty, onUpdate, onEnd }) {
    this.difficulty = difficulty;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.lives = 3;
    this.score = 0;
    this.lastQuestion = null;
    this.timerId = null;
    this.remaining = TIME_LIMIT;
    this.locked = false;
    this.a = 0;
    this.b = 0;
  }

  start() {
    this.nextQuestion();
  }

  stop() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  nextQuestion() {
    this.locked = false;
    this.remaining = TIME_LIMIT;
    const [min, max] = RANGES[this.difficulty];
    let a;
    let b;
    do {
      a = randomInt(min, max);
      b = randomInt(min, max);
    } while (this.lastQuestion && this.lastQuestion[0] === a && this.lastQuestion[1] === b);
    this.lastQuestion = [a, b];
    this.a = a;
    this.b = b;
    this.startTimer();
    this.emit();
  }

  startTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.onTimeout();
      } else {
        this.emit();
      }
    }, 1000);
    this.emit();
  }

  onTimeout() {
    if (this.locked) return;
    this.locked = true;
    if (this.timerId) clearInterval(this.timerId);
    this.lives -= 1;
    this.onUpdate({
      type: "timeout",
      lives: this.lives,
      score: this.score,
      a: this.a,
      b: this.b,
    });
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
      this.score += 1;
      this.onUpdate({
        type: "correct",
        lives: this.lives,
        score: this.score,
        a: this.a,
        b: this.b,
      });
    } else {
      this.lives -= 1;
      this.onUpdate({
        type: "wrong",
        lives: this.lives,
        score: this.score,
        a: this.a,
        b: this.b,
        answer: this.a * this.b,
      });
    }
    this.afterRound();
    return { ok: true, correct };
  }

  afterRound() {
    if (this.lives <= 0) {
      setTimeout(() => {
        this.stop();
        this.onEnd({ score: this.score, difficulty: this.difficulty });
      }, 1200);
    } else {
      setTimeout(() => this.nextQuestion(), 1200);
    }
  }

  emit() {
    this.onUpdate({
      type: "tick",
      lives: this.lives,
      score: this.score,
      a: this.a,
      b: this.b,
      remaining: this.remaining,
      timeLimit: TIME_LIMIT,
    });
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const DIFFICULTY_LABELS = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
};
