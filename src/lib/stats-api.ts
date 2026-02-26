const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export async function saveGameResult(data: {
  roomId: string;
  score: number;
  finalPosition?: number;
  wordsUsed?: string[];
  highestWordValue?: number;
  gameDuration?: number;
}) {
  const res = await fetch(`${API_BASE}/api/game/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getMyStats() {
  const res = await fetch(`${API_BASE}/api/stats/me`, {
    credentials: 'include',
  });
  return res.json();
}

export async function getGlobalLeaderboard(limit = 50) {
  const res = await fetch(`${API_BASE}/api/leaderboard/global?limit=${limit}`, {
    credentials: 'include',
  });
  return res.json();
}

export async function getWeeklyLeaderboard(limit = 50) {
  const res = await fetch(`${API_BASE}/api/leaderboard/weekly?limit=${limit}`, {
    credentials: 'include',
  });
  return res.json();
}

export async function sendFriendRequest(username: string) {
  const res = await fetch(`${API_BASE}/api/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  return res.json();
}

export async function respondToFriendRequest(requestId: string, accept: boolean) {
  const res = await fetch(`${API_BASE}/api/friends/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ requestId, accept }),
  });
  return res.json();
}

export async function getFriendsList() {
  const res = await fetch(`${API_BASE}/api/friends/list`, {
    credentials: 'include',
  });
  return res.json();
}

export async function getPendingFriendRequests() {
  const res = await fetch(`${API_BASE}/api/friends/requests`, {
    credentials: 'include',
  });
  return res.json();
}

export async function getPlayerProfile(userId: string) {
  const res = await fetch(`${API_BASE}/api/profile/${userId}`, {
    credentials: 'include',
  });
  return res.json();
}

export async function updateMyProfile(data: Record<string, any>) {
  const res = await fetch(`${API_BASE}/api/profile/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}
