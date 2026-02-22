import { useState } from "react";

type CreateRoomResponse = { code: string; playerId: string; name: string; isHost: boolean };
type JoinRoomResponse = { playerId: string; name: string; isHost: boolean; code: string };

function go(path: string) {
  window.history.pushState({}, "", path);
  window.location.reload();
}

export default function Lobby() {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function createRoom() {
    const name = playerName.trim();
    if (!name) return alert("Enter your player name");
    setBusy(true);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name }),
      });
      const data = (await res.json()) as CreateRoomResponse | { message: string };
      if (!res.ok) throw new Error((data as any).message || "Create room failed");

      const ok = data as CreateRoomResponse;
      localStorage.setItem("lexicon_playerId", ok.playerId);
      localStorage.setItem("lexicon_playerName", ok.name);

      go(`/game/${ok.code}`);
    } catch (e: any) {
      alert(e?.message || "Create room failed");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name) return alert("Enter your player name");
    if (code.length !== 4) return alert("Enter a 4-letter room code");
    setBusy(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, playerName: name }),
      });
      const data = (await res.json()) as JoinRoomResponse | { message: string };
      if (!res.ok) throw new Error((data as any).message || "Join room failed");

      const ok = data as JoinRoomResponse;
      localStorage.setItem("lexicon_playerId", ok.playerId);
      localStorage.setItem("lexicon_playerName", ok.name);

      go(`/game/${code}`);
    } catch (e: any) {
      alert(e?.message || "Join room failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "min(520px, 100%)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
        <h1 style={{ margin: 0, letterSpacing: 1 }}>LEXICON</h1>
        <p style={{ opacity: 0.8, marginTop: 6 }}>A buzzer word game</p>

        <label style={{ display: "block", marginTop: 16, opacity: 0.85 }}>Your player name</label>
        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name..."
          style={{ width: "100%", marginTop: 6, padding: 12, borderRadius: 12 }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={createRoom}
            disabled={busy}
            style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 700 }}
          >
            Create Room
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE (4 letters)"
            style={{ flex: 1, padding: 12, borderRadius: 12 }}
          />
          <button
            onClick={joinRoom}
            disabled={busy}
            style={{ padding: "12px 14px", borderRadius: 12, fontWeight: 700 }}
          >
            Join
          </button>
        </div>

        <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
          Tip: open the same link on multiple phones to test multiplayer.
        </div>
      </div>
    </div>
  );
}
