// Vercel serverless entry: the whole Express REST API runs as a single function.
// Socket.IO is not available on serverless — the web client polls instead, and
// the self-hosted `npm start` server keeps full WebSocket sync.
import { createApp } from './app';

const { app } = createApp();

export default app;
