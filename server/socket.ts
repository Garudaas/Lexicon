import { Server, Socket } from 'socket.io';
import { supabase } from './db.js';

const userSockets = new Map<string, Set<string>>();

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      out[pair.substring(0, idx).trim()] = pair.substring(idx + 1).trim();
    }
  });
  return out;
}

export function broadcastActiveDeviceChanged(
  io: Server,
  userId: string,
  activeSessionId: string
) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit('active-device-changed', { activeSessionId });
    }
  }
}

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies.session;
      if (!token) return next(new Error('Not logged in'));

      const { data: session } = await supabase
        .from('sessions')
        .select('id, user_id')
        .eq('token', token)
        .is('revoked_at', null)
        .maybeSingle();

      if (!session) return next(new Error('Session expired'));

      const { data: user } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', session.user_id)
        .maybeSingle();

      if (!user) return next(new Error('User not found'));

      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.sessionId = session.id;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId: string = socket.data.userId;

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    });
  });
}
