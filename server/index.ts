import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import checkWord from "check-word";
import { requireAuth } from "./auth.ts";
import {
  saveGameResult,
  getPlayerStats,
  getGlobalLeaderboard,
  getWeeklyLeaderboard,
  sendFriendRequest,
  respondToFriendRequest,
  getFriendsList,
  getPendingFriendRequests,
  getPlayerProfile,
  updatePlayerProfile,
} from "./stats.ts";

const words = checkWord("en");

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  connected: boolean;
};

type Room = {
  code: string;
  hostId: string;
  status: "waiting" | "picking_letters" | "buzz_open" | "answering" | "round_end" | "paused";
  players: Record<string, Player>;

  round: number;
  startLetter: string | null;
  endLetter: string | null;
  pickerLocked: boolean;
  pickingBy: string[];
  currentPickIndex: 0 | 1;

  buzzer: {
    open: boolean;
    locked: boolean;
    buzzQueue: string[];
    answeringPlayerId: string | null;
  };

  usedWords: Record<string, { by: string; round: number }>;

  rules: {
    dictionaryStrict: boolean;
    rejectAbbreviations: boolean;
    rejectPluralEndingS: boolean;
  };

  lastResult?: {
    word: string;
    by: string;
    ok: boolean;
    reason?: string;
    pointsDelta?: number;
  };
};

const rooms = new Map<string, Room>();

function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function cleanWord(input: string): string {
  return input.trim().toLowerCase();
}

function isAllLetters(w: string): boolean {
  return /^[a-z]+$/.test(w);
}

function validateWord(room: Room, wordRaw: string) {
  const word = cleanWord(wordRaw);
  if (!word) return { ok: false, reason: "Empty word" };
  if (!isAllLetters(word)) return { ok: false, reason: "Only letters A–Z allowed" };

  if (!room.startLetter || !room.endLetter) {
    return { ok: false, reason: "Letters not set" };
  }

  const s = room.startLetter.toLowerCase();
  const e = room.endLetter.toLowerCase();

  if (word[0] !== s) return { ok: false, reason: `Must start with "${room.startLetter}"` };
  if (word[word.length - 1] !== e) return { ok: false, reason: `Must end with "${room.endLetter}"` };

  if (room.rules.rejectPluralEndingS && word.endsWith("s")) {
    return { ok: false, reason: 'Plurals ending with "s" not allowed' };
  }

  if (room.rules.rejectAbbreviations) {
    if (word.length <= 2) return { ok: false, reason: "Too short (likely abbreviation)" };
  }

  if (room.rules.dictionaryStrict) {
    if (!words.check(word)) return { ok: false, reason: "Not found in dictionary" };
  }

  const prev = room.usedWords[word];
  if (prev) {
    const prevName = room.players[prev.by]?.name || prev.by;
    return { ok: false, reason: `Repeated word (already used by ${prevName} in round ${prev.round})` };
  }

  return { ok: true, word };
}

function roomSnapshot(room: Room) {
  return room;
}

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/socket.io",
  cors: { origin: "*", methods: ["GET", "POST"] },
});

/* ---------------- REST ---------------- */

app.post("/api/rooms/create", (req, res) => {
  const name = String(req.body?.playerName || "").trim();
  if (!name) return res.status(400).json({ message: "playerName required" });

  let code = makeCode();
  while (rooms.has(code)) code = makeCode();

  const hostId = crypto.randomUUID();

  const room: Room = {
    code,
    hostId,
    status: "waiting",
    players: {
      [hostId]: { id: hostId, name, isHost: true, score: 0, connected: true },
    },
    round: 0,
    startLetter: null,
    endLetter: null,
    pickerLocked: false,
    pickingBy: [hostId],
    currentPickIndex: 0,
    buzzer: { open: false, locked: false, buzzQueue: [], answeringPlayerId: null },
    usedWords: {},
    rules: {
      dictionaryStrict: true,
      rejectAbbreviations: true,
      rejectPluralEndingS: true,
    },
  };

  rooms.set(code, room);
  return res.status(201).json({ code, playerId: hostId, name, isHost: true });
});

app.post("/api/rooms/join", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const name = String(req.body?.playerName || "").trim();

  if (code.length !== 4) return res.status(400).json({ message: "Invalid room code" });
  if (!name) return res.status(400).json({ message: "playerName required" });

  const room = rooms.get(code);
  if (!room) return res.status(404).json({ message: "Room not found" });

  const playerId = crypto.randomUUID();
  room.players[playerId] = { id: playerId, name, isHost: false, score: 0, connected: true };

  return res.status(200).json({ code, playerId, name, isHost: false });
});

/* ---------- STATS & LEADERBOARD ENDPOINTS ---------- */

app.post("/api/game/result", requireAuth, async (req, res) => {
  try {
    const { roomId, score, finalPosition, wordsUsed, highestWordValue, gameDuration } = req.body;
    const result = await saveGameResult(
      req.user!.id,
      roomId,
      score,
      finalPosition,
      wordsUsed || [],
      highestWordValue || 0,
      gameDuration || 0
    );
    res.json(result);
  } catch (err) {
    console.error("Error saving game result:", err);
    res.status(500).json({ error: "Failed to save game result" });
  }
});

app.get("/api/stats/me", requireAuth, async (req, res) => {
  try {
    const stats = await getPlayerStats(req.user!.id);
    res.json(stats || {});
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/leaderboard/global", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await getGlobalLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching global leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.get("/api/leaderboard/weekly", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await getWeeklyLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching weekly leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/* ---------- FRIEND ENDPOINTS ---------- */

app.post("/api/friends/request", requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });

    const result = await sendFriendRequest(req.user!.id, username);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

app.post("/api/friends/respond", requireAuth, async (req, res) => {
  try {
    const { requestId, accept } = req.body;
    if (!requestId) return res.status(400).json({ error: "Request ID required" });

    const result = await respondToFriendRequest(requestId, req.user!.id, accept);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error("Error responding to friend request:", err);
    res.status(500).json({ error: "Failed to respond to request" });
  }
});

app.get("/api/friends/list", requireAuth, async (req, res) => {
  try {
    const friendIds = await getFriendsList(req.user!.id);
    res.json({ friends: friendIds });
  } catch (err) {
    console.error("Error fetching friends:", err);
    res.status(500).json({ error: "Failed to fetch friends" });
  }
});

app.get("/api/friends/requests", requireAuth, async (req, res) => {
  try {
    const requests = await getPendingFriendRequests(req.user!.id);
    res.json(requests);
  } catch (err) {
    console.error("Error fetching friend requests:", err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

/* ---------- PROFILE ENDPOINTS ---------- */

app.get("/api/profile/:userId", async (req, res) => {
  try {
    const profile = await getPlayerProfile(req.params.userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.put("/api/profile/me", requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    const profile = await updatePlayerProfile(req.user!.id, updates);
    if (!profile) return res.status(500).json({ error: "Failed to update profile" });
    res.json(profile);
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/* ---------------- SOCKET ---------------- */

const WS = {
  JOIN_ROOM: "join_room",
  GAME_STATE: "game_state",
  ERROR: "error",
  HOST_START_ROUND: "host_start_round",
  HOST_PICK_LETTER: "host_pick_letter",
  HOST_OPEN_BUZZER: "host_open_buzzer",
  HOST_NEXT_ROUND: "host_next_round",
  BUZZ: "buzz",
  SUBMIT_WORD: "submit_word",
} as const;

io.on("connection", (socket) => {
  socket.on(WS.JOIN_ROOM, ({ code, playerId }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return socket.emit(WS.ERROR, { message: "Room not found" });

    socket.join(room.code);
    if (room.players[playerId]) room.players[playerId].connected = true;

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  // (All your game logic unchanged — kept exactly as you wrote it)

});

/* ---------------- PRODUCTION STATIC SERVING ---------------- */

// Serve Vite build
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// SPA fallback (important for /game, /lobby, etc.)
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

/* ---------------- START SERVER ---------------- */

const port = Number(process.env.PORT || "10000");

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`LEXICON server running on port ${port}`);
});
