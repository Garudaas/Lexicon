import { useEffect, useMemo } from "react";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Stats from "./pages/Stats";

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
  // /stats -> Stats page
  // anything else -> Lobby
  if (path === "/" || path === "/lobby") {
    return <Lobby />;
  }

  if (path === "/stats") {
    return <Stats />;
  }

  if (path.startsWith("/game/")) {
    const code = path.split("/game/")[1]?.slice(0, 4)?.toUpperCase() || "";
    (window as any).__LEXICON_ROOM_CODE__ = code;
    return <Game />;
  }

  if (path === "/verify") {
    window.history.replaceState({}, "", "/lobby");
    return <Lobby />;
  }

  window.history.replaceState({}, "", "/lobby");
  return <Lobby />;
}
