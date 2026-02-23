import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import checkWord from "check-word";

const words = checkWord("en");

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

  // round state
  round: number;
  startLetter: string | null; // first submitted letter
  endLetter: string | null;   // second submitted letter
  pickerLocked: boolean;       // prevent re-picking mid-round
  pickingBy: string[];         // ids allowed to pick letters (2 players or 1 team-of-2)
  currentPickIndex: 0 | 1;     // 0 => pick start, 1 => pick end

  // buzzer
  buzzer: {
    open: boolean;
    locked: boolean;
    buzzQueue: string[]; // order of buzz presses
    answeringPlayerId: string | null;
  };

  // Lexicon Master memory
  usedWords: Record<string, { by: string; round: number }>;

  // host rules (extend later)
  rules: {
    dictionaryStrict: boolean;      // YOU chose true
    rejectAbbreviations: boolean;   // true for MVP
    rejectPluralEndingS: boolean;   // true for MVP (exceptions later)
  };

  // last result for UI
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

  // crude abbreviation filter: very short or looks like acronym
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
  // send full room, safe enough for MVP
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

// REST: Create room
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
    pickingBy: [hostId], // host is picker by default; host can change later
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

// REST: Join room
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

const WS = {
  JOIN_ROOM: "join_room",
  GAME_STATE: "game_state",
  ERROR: "error",

  // Host round controls
  HOST_START_ROUND: "host_start_round",     // chooses pickingBy (2 ids) and opens letter picking
  HOST_PICK_LETTER: "host_pick_letter",     // a picker submits their letter (start then end)
  HOST_OPEN_BUZZER: "host_open_buzzer",     // host opens buzzer after 2 letters are set
  HOST_NEXT_ROUND: "host_next_round",       // if round repeats or after success

  // Players
  BUZZ: "buzz",
  SUBMIT_WORD: "submit_word",
} as const;

io.on("connection", (socket) => {
  socket.on(WS.JOIN_ROOM, ({ code, playerId }: { code: string; playerId: string }) => {
    const roomCode = String(code || "").toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return socket.emit(WS.ERROR, { message: "Room not found" });

    socket.join(roomCode);
    if (room.players[playerId]) room.players[playerId].connected = true;

    io.to(roomCode).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on(WS.HOST_START_ROUND, ({ code, hostId, pickerIds }: { code: string; hostId: string; pickerIds: string[] }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return socket.emit(WS.ERROR, { message: "Room not found" });
    if (room.hostId !== hostId) return socket.emit(WS.ERROR, { message: "Only host can start" });

    // Validate pickerIds: allow 1 or 2 players
    const validPickers = (pickerIds || []).filter((id) => room.players[id]);
    if (validPickers.length < 1) return socket.emit(WS.ERROR, { message: "Pick at least 1 picker" });
    if (validPickers.length > 2) return socket.emit(WS.ERROR, { message: "Max 2 pickers" });

    room.round += 1;
    room.status = "picking_letters";
    room.startLetter = null;
    room.endLetter = null;
    room.pickerLocked = false;
    room.pickingBy = validPickers;
    room.currentPickIndex = 0;

    room.buzzer = { open: false, locked: false, buzzQueue: [], answeringPlayerId: null };
    room.lastResult = undefined;

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on(WS.HOST_PICK_LETTER, ({ code, playerId, letter }: { code: string; playerId: string; letter: string }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return socket.emit(WS.ERROR, { message: "Room not found" });
    if (room.status !== "picking_letters") return;
    if (!room.pickingBy.includes(playerId)) return socket.emit(WS.ERROR, { message: "You are not a picker" });
    if (room.pickerLocked) return socket.emit(WS.ERROR, { message: "Picking locked" });

    const L = String(letter || "").trim().toUpperCase();
    if (!/^[A-Z]$/.test(L)) return socket.emit(WS.ERROR, { message: "Invalid letter" });

    // order of submission matters: first = start, second = end
    if (room.currentPickIndex === 0) {
      room.startLetter = L;
      room.currentPickIndex = 1;
    } else {
      room.endLetter = L;
      room.pickerLocked = true;
      // ready for host to open buzzer
    }

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on(WS.HOST_OPEN_BUZZER, ({ code, hostId }: { code: string; hostId: string }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return socket.emit(WS.ERROR, { message: "Room not found" });
    if (room.hostId !== hostId) return socket.emit(WS.ERROR, { message: "Only host can open buzzer" });
    if (!room.startLetter || !room.endLetter) return socket.emit(WS.ERROR, { message: "Both letters required" });

    room.status = "buzz_open";
    room.buzzer.open = true;
    room.buzzer.locked = false;
    room.buzzer.buzzQueue = [];
    room.buzzer.answeringPlayerId = null;

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on(WS.BUZZ, ({ code, playerId }: { code: string; playerId: string }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return;
    if (room.status !== "buzz_open") return;
    if (!room.buzzer.open || room.buzzer.locked) return;

    // pickers cannot buzz (your rule: pickers wait until others give up)
    if (room.pickingBy.includes(playerId)) return;

    if (!room.buzzer.buzzQueue.includes(playerId)) {
      room.buzzer.buzzQueue.push(playerId);
    }

    // lock to first buzz
    room.buzzer.locked = true;
    room.status = "answering";
    room.buzzer.answeringPlayerId = room.buzzer.buzzQueue[0] || null;

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on(WS.SUBMIT_WORD, ({ code, playerId, word }: { code: string; playerId: string; word: string }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return;

    if (room.status !== "answering") return;
    if (room.buzzer.answeringPlayerId !== playerId) return;

    const result = validateWord(room, word);

    if (result.ok) {
      const clean = (result as any).word as string;

      // scoring: simple +1 per valid word (host options later)
      room.players[playerId].score += 1;

      room.usedWords[clean] = { by: playerId, round: room.round };

      room.lastResult = { word: clean, by: playerId, ok: true, pointsDelta: +1 };
      room.status = "round_end";
      room.buzzer.open = false;
      room.buzzer.locked = false;
      room.buzzer.answeringPlayerId = null;

      io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
      return;
    }

    // invalid: chance passes to next buzz presser (if any)
    room.lastResult = { word: String(word || ""), by: playerId, ok: false, reason: result.reason, pointsDelta: 0 };

    // remove current and advance
    room.buzzer.buzzQueue = room.buzzer.buzzQueue.filter((id) => id !== playerId);

    if (room.buzzer.buzzQueue.length > 0) {
      // next answerer
      room.buzzer.answeringPlayerId = room.buzzer.buzzQueue[0];
      room.status = "answering";
      room.buzzer.locked = true;
    } else {
      // no one else buzzed -> round repeats with same picker pair again (your rule)
      room.status = "picking_letters";
      room.startLetter = null;
      room.endLetter = null;
      room.pickerLocked = false;
      room.currentPickIndex = 0;
      room.buzzer = { open: false, locked: false, buzzQueue: [], answeringPlayerId: null };
    }

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on(WS.HOST_NEXT_ROUND, ({ code, hostId }: { code: string; hostId: string }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return;
    if (room.hostId !== hostId) return;

    // start next round with same pickers by default
    room.round += 1;
    room.status = "picking_letters";
    room.startLetter = null;
    room.endLetter = null;
    room.pickerLocked = false;
    room.currentPickIndex = 0;
    room.buzzer = { open: false, locked: false, buzzQueue: [], answeringPlayerId: null };
    room.lastResult = undefined;

    io.to(room.code).emit(WS.GAME_STATE, roomSnapshot(room));
  });

  socket.on("disconnect", () => {
    // MVP: no cleanup; we can add connected=false if you send playerId on leave later
  });
});

const port = Number(process.env.PORT || "10000");
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`LEXICON server running on port ${port}`);
});
