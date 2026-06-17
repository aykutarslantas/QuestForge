import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';

const app = express();

// Enable CORS for frontend clients
app.use(cors({
  origin: '*', // Allows connecting from dynamic local environments & Vercel
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routing
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Root handler
app.get('/', (req, res) => {
  res.send('QuestForge Backend API is running.');
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${config.port}`);
});
