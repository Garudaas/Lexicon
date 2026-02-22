import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";

// If you still have authentication pages, keep them,
// but do NOT force redirect to /verify anymore.
// We will integrate account verification later as “Version 2”.

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game/:code" element={<Game />} />

        {/* Temporary: if /verify exists in your app, keep it reachable */}
        {/* <Route path="/verify" element={<Verify />} /> */}

        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
