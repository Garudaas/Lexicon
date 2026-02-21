import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter, setActiveDeviceChangedHandler } from './auth.js';
import { setupSocket, broadcastActiveDeviceChanged } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);

setActiveDeviceChangedHandler((userId, activeSessionId) => {
  broadcastActiveDeviceChanged(io, userId, activeSessionId);
});

setupSocket(io);

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // Render-safe catch-all: serve the SPA for any non-API route
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).end();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`LEXICON server running on port ${PORT}`);
  if (!process.env.SMTP_HOST) {
    console.log('DEV MODE: Emails will be printed to this console instead of sent.');
  }
});
