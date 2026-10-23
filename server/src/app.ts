import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './models/RoomManager.js';
import { getAllowedOrigins, isOriginAllowed } from './cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');
const allowedOrigins = getAllowedOrigins();

export function createApp(): Express {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => callback(null, isOriginAllowed(origin, allowedOrigins))
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    const roomManager = RoomManager.getInstance();
    res.json({
      status: 'ok',
      service: 'skribbl-server',
      uptime: process.uptime(),
      activeRooms: roomManager.getActiveRoomCount(),
      timestamp: Date.now()
    });
  });

  // Serve production client build if exists
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
