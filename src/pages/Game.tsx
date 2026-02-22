import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Player = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
};

type GameState = {
  roomCode: string;
  status: "waiting" | "starting" | "playing" | "round_break" | "paused" | "finished";
  players: Record<string, Player>;
  settings: { maxRounds: number; roundTime: number };
  currentRound: number;
  currentLetter: string;
  buzzer: {
    active: boolean;
    locked: boolean;
    buzzedPlayerId: string | null;
    timestamp: number | null;
  };
  lastWord?: { word: string; playerId: string; valid: boolean; points: number };
  message?: string;
};

const WS_EVENTS = {
  JOIN_ROOM: "join_room",
  START_GAME: "start_game",
  BUZZ: "buzz",
  SUBMIT_WORD: "submit_word",
  NEXT_ROUND: "next_round",
  PAUSE_GAME: "pause_game",
  RESUME_GAME: "resume_game",
  RESET_GAME: "reset_game",
  GAME_STATE: "game_state",
  ERROR: "error",
  WORD_VALIDATION: "word_validation",
} as const;

function go(path: string) {
  window.history.pushState({}, "", path);
  window.location.reload();
}

function getRoomCodeFromPath(): string {
  const p = window.location.pathname || "";
  if (p.startsWith("/game/")) {
    return (p.split("/game/")[1] || "").slice(0, 4).toUpperCase();
  }
  // fallback (set by App.tsx)
  return ((window as any).__LEXICON_ROOM_CODE__ || "").toString().toUpperCase();
}

export default function Game() {
  const roomCode = getRoomCodeFromPath();
  const playerId = localStorage.getItem("lexicon_playerId") || "";
  const playerName = localStorage.getItem("lexicon_playerName") || "";

  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [word, setWord] = useState("");
  const [toast, setToast] = useState<string>("");

  const players = useMemo(() => {
    if (!state) return [];
    return Object.values(state.players).sort((a, b) => b.score - a.score);
  }, [state]);

  const me = state?.players?.[playerId];
  const isHost = !!me?.isHost;

  useEffect(() => {
    if (!roomCode || roomCode.length !== 4) {
      alert("Invalid room code");
      go("/lobby");
      return;
    }
    if (!playerId || !playerName) {
      alert("Missing player session. Go to Lobby and join again.");
      go("/lobby");
      return;
    }

    const s = io(window.location.origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => {
      s.emit(WS_EVENTS.JOIN_ROOM, { code: roomCode, playerId });
    });

    s.on(WS_EVENTS.GAME_STATE, (gs: GameState) => setState({ ...gs }));
    s.on(WS_EVENTS.ERROR, (e: { message: string }) => alert(e.message));
    s.on(WS_EVENTS.WORD_VALIDATION, (x: { valid: boolean; word: string; points: number }) => {
      setToast(x.valid ? `Accepted: ${x.word} (+${x.points})` : `Rejected: ${x.word} (${x.points})`);
      setTimeout(() => setToast(""), 2500);
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [roomCode, playerId, playerName]);

  function startGame() {
    socket?.emit(WS_EVENTS.START_GAME, { code: roomCode });
  }
  function nextRound() {
    socket?.emit(WS_EVENTS.NEXT_ROUND, { code: roomCode });
  }
  function pauseGame() {
    socket?.emit(WS_EVENTS.PAUSE_GAME, { code: roomCode });
  }
  function resumeGame() {
    socket?.emit(WS_EVENTS.RESUME_GAME, { code: roomCode });
  }
  function resetGame() {
    socket?.emit(WS_EVENTS.RESET_GAME, { code: roomCode });
  }
  function buzz() {
    socket?.emit(WS_EVENTS.BUZZ, { code: roomCode, playerId });
  }
  function submitWord() {
    const w = word.trim();
    if (!w) return;
    socket?.emit(WS_EVENTS.SUBMIT_WORD, { code: roomCode, playerId, word: w });
    setWord("");
  }

  const canBuzz = !!state?.buzzer?.active && !state?.buzzer?.locked;
  const iBuzzed = state?.buzzer?.buzzedPlayerId === playerId;
  const mustAnswer = !!state?.buzzer?.locked && iBuzzed;

  return (
    <div style={{ minHeight: "100vh", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h2 style={{ margin: 0 }}>Room: {roomCode}</h2>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            You: <b>{playerName}</b> {isHost ? "(Host)" : ""}
          </div>
        </div>
        <button onClick={() => go("/lobby")} style={{ padding: 10, borderRadius: 12 }}>
          Exit
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginTop: 16 }}>
        <div style={{ padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontSize: 14, opacity: 0.85 }}>Status: {state?.status || "connecting..."}</div>

          <div style={{ marginTop: 18, display: "grid", placeItems: "center" }}>
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: 18,
                border: "3px solid rgba(255,0,200,0.65)",
                display: "grid",
                placeItems: "center",
                fontSize: 96,
                fontWeight: 900,
                opacity: state?.buzzer?.active ? 1 : 0.35,
              }}
            >
              {state?.currentLetter ? state.currentLetter : "?"}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={buzz}
                disabled={!canBuzz || state?.status !== "playing"}
                style={{ padding: "14px 18px", borderRadius: 999, fontWeight: 900, fontSize: 16 }}
              >
                BUZZ
              </button>

              {isHost && (
                <>
                  {state?.status === "waiting" && (
                    <button onClick={startGame} style={{ padding: "14px 18px", borderRadius: 999, fontWeight: 900 }}>
                      Start Game
                    </button>
                  )}
                  <button onClick={nextRound} style={{ padding: "14px 18px", borderRadius: 999, fontWeight: 900 }}>
                    Next Round
                  </button>
                  {state?.status === "paused" ? (
                    <button onClick={resumeGame} style={{ padding: "14px 18px", borderRadius: 999, fontWeight: 900 }}>
                      Resume
                    </button>
                  ) : (
                    <button onClick={pauseGame} style={{ padding: "14px 18px", borderRadius: 999, fontWeight: 900 }}>
                      Pause
                    </button>
                  )}
                  <button onClick={resetGame} style={{ padding: "14px 18px", borderRadius: 999, fontWeight: 900 }}>
                    Reset
                  </button>
                </>
              )}
            </div>

            {mustAnswer && (
              <div style={{ marginTop: 18, width: "min(520px, 100%)" }}>
                <div style={{ opacity: 0.85, marginBottom: 6 }}>You buzzed first. Enter a word:</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder={`Must start with "${state?.currentLetter || ""}"`}
                    style={{ flex: 1, padding: 12, borderRadius: 12 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitWord();
                    }}
                  />
                  <button onClick={submitWord} style={{ padding: "12px 14px", borderRadius: 12, fontWeight: 900 }}>
                    Submit
                  </button>
                </div>
              </div>
            )}

            {state?.message && <div style={{ marginTop: 12, opacity: 0.85 }}>{state.message}</div>}
            {toast && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid rgba(0,255,180,0.35)" }}>
                {toast}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Players ({players.length})</div>
          <div style={{ display: "grid", gap: 10 }}>
            {players.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: p.connected ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {p.name} {p.id === playerId ? "(You)" : ""} {p.isHost ? "👑" : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{p.connected ? "Connected" : "Disconnected"}</div>
                </div>
                <div style={{ fontWeight: 900 }}>{p.score}</div>
              </div>
            ))}
          </div>

          {state?.lastWord && (
            <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
              Last: <b>{state.lastWord.word}</b> ({state.lastWord.valid ? "valid" : "invalid"})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
