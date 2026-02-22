import { useEffect, useMemo } from "react";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";

function getPath() {
  return window.location.pathname || "/";
}

export default function App() {
  const path = useMemo(() => getPath(), []);

  // Keep URL changes working (refresh/back button)
  useEffect(() => {
    const onPop = () => window.location.reload();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Routes:
  // / or /lobby -> Lobby
  // /game/ABCD -> Game with code param
  // anything else -> Lobby
  if (path === "/" || path === "/lobby") {
    return <Lobby />;
  }

  if (path.startsWith("/game/")) {
    // Game.tsx currently uses react-router params.
    // So we pass code via a global query param fallback.
    // We'll set a global and Game.tsx will read it.
    const code = path.split("/game/")[1]?.slice(0, 4)?.toUpperCase() || "";
    (window as any).__LEXICON_ROOM_CODE__ = code;
    return <Game />;
  }

  // If you still have /verify page from older build, don't block the app:
  if (path === "/verify") {
    // Let your existing Verify page load if it exists in your bundle,
    // otherwise just send user to Lobby.
    window.history.replaceState({}, "", "/lobby");
    return <Lobby />;
  }

  window.history.replaceState({}, "", "/lobby");
  return <Lobby />;
}
