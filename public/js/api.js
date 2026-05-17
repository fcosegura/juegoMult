export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Error");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const authApi = {
  me: () => api("/api/auth/me"),
  login: (body) =>
    api("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body) =>
    api("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  logout: () => api("/api/auth/logout", { method: "POST" }),
};

export const scoresApi = {
  save: (points, difficulty) =>
    api("/api/scores", {
      method: "POST",
      body: JSON.stringify({ points, difficulty }),
    }),
  leaderboard: (difficulty = "all", limit = 10) =>
    api(`/api/scores/leaderboard?difficulty=${difficulty}&limit=${limit}`),
  mine: () => api("/api/scores/me"),
};

export const profileApi = {
  get: () => api("/api/profile"),
};

export const adventureApi = {
  sync: (body) =>
    api("/api/adventure/sync", { method: "POST", body: JSON.stringify(body) }),
  complete: () => api("/api/adventure/complete", { method: "POST" }),
};

export const shopApi = {
  openPack: () => api("/api/shop/open-pack", { method: "POST" }),
};

export const collectionApi = {
  get: () => api("/api/collection"),
};

export const cardsApi = {
  catalog: () => api("/api/cards/catalog"),
};
