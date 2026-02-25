import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Player = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
};

type GameState = any; // backend sends full room object

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

function go(path: string) {
  window.location.href = path;
}

function getRoomCode(): string {
  const p = window.location.pathname;
  return p.split("/game/")[1]?.slice(0, 4).toUpperCase() || "";
}

export default function Game() {
  const roomCode = getRoomCode();
  const playerId = localStorage.getItem("lexicon_playerId") || "";
  const playerName = localStorage.getItem("lexicon_playerName") || "";

  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [word, setWord] = useState("");

  const players = useMemo(() => {
    if (!state) return [];
    return Object.values(state.players || {}) as Player[];
  }, [state]);

  const me = state?.players?.[playerId];
  const isHost = me?.isHost;

  useEffect(() => {
    if (!roomCode || !playerId) {
      go("/lobby");
      return;
    }

  const s = io(window.location.origin);

    s.on("connect", () => {
      s.emit(WS.JOIN_ROOM, { code: roomCode, playerId });
    });

    s.on(WS.GAME_STATE, (gs: GameState) => {
      setState({ ...gs });
    });

    s.on(WS.ERROR, (e: any) => alert(e.message));

    setSocket(s);
    return () => s.disconnect();
  }, []);

function startRound() {
  if (!isHost || !state) return;

  const ids = Object.keys(state.players);

  if (ids.length < 2) {
    alert("Need at least 2 players to start round.");
    return;
  }

  socket?.emit("host_start_round", {
    code: roomCode,
    hostId: playerId,
    pickerIds: ids.slice(0, 2),
  });
}

  const ids = Object.keys(state.players);
  console.log("Sending event", ids);

  socket?.emit("host_start_round", {
    code: roomCode,
    hostId: playerId,
    pickerIds: ids.slice(0, 2),
  });
}

  function pickLetter(letter: string) {
    socket?.emit(WS.HOST_PICK_LETTER, {
      code: roomCode,
      playerId,
      letter,
    });
  }

  function openBuzzer() {
    socket?.emit(WS.HOST_OPEN_BUZZER, {
      code: roomCode,
      hostId: playerId,
    });
  }

  function buzz() {
    socket?.emit(WS.BUZZ, { code: roomCode, playerId });
  }

  function submitWord() {
    if (!word.trim()) return;
    socket?.emit(WS.SUBMIT_WORD, {
      code: roomCode,
      playerId,
      word,
    });
    setWord("");
  }

  function nextRound() {
    socket?.emit(WS.HOST_NEXT_ROUND, {
      code: roomCode,
      hostId: playerId,
    });
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Room {roomCode}</h2>
      <div>Status: {state?.status}</div>
      <div>
        Letters: {state?.startLetter || "_"} → {state?.endLetter || "_"}
      </div>

      {isHost && state?.status === "waiting" && (
        <button onClick={startRound}>Start Round</button>
      )}

      {state?.status === "picking_letters" && (
        <div>
          <button onClick={() => pickLetter(prompt("Letter?") || "")}>
            Pick Letter
          </button>
        </div>
      )}

      {isHost && state?.status === "picking_letters" && state?.pickerLocked && (
        <button onClick={openBuzzer}>Open Buzzer</button>
      )}

      {state?.status === "buzz_open" && (
        <button onClick={buzz}>BUZZ</button>
      )}

      {state?.status === "answering" && (
        <div>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Enter word"
          />
          <button onClick={submitWord}>Submit</button>
        </div>
      )}

      {isHost && state?.status === "round_end" && (
        <button onClick={nextRound}>Next Round</button>
      )}

      <h3>Players</h3>
      {players.map((p) => (
        <div key={p.id}>
          {p.name} {p.isHost ? "👑" : ""} - {p.score}
        </div>
      ))}
    </div>
  );
}
