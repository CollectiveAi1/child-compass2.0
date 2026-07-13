import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import express from 'express';
import { createApp } from './app';
import { userFromToken } from './auth';

const port = Number(process.env.PORT || 4000);
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
const { app } = createApp((event, payload) => io.emit(event, payload));
const webDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(resolve(webDist, 'index.html')));
}
httpServer.on('request', app);
io.use((socket, next) => {
  const token = String(socket.handshake.auth.token || '');
  if (!userFromToken(token)) return next(new Error('unauthorized'));
  next();
});
io.on('connection', socket => socket.emit('sync:ready', { connectedAt: new Date().toISOString() }));
httpServer.listen(port, () => console.log(`Child Care Compass API listening on http://localhost:${port}`));
