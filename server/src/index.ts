import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { setupSocketHandlers, TypedServer } from './socket.js';
import { ClientToServerEvents, ServerToClientEvents } from '@skribbl/shared';

const PORT = process.env.PORT || 4000;

const app = createApp();
const httpServer = http.createServer(app);

const io: TypedServer = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[Server] Skribbl Backend listening on http://localhost:${PORT}`);
});

export { app, httpServer, io };
