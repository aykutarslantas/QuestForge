import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { GameEngine } from '../services/gameEngine.js';
import { AIService } from '../services/ai.js';

const router = Router();

// Get active game status
router.get('/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const game = await GameEngine.getActiveGame(userId);
    if (!game) {
      return res.json({ game: null, roomInfo: null });
    }
    const roomInfo = GameEngine.getRoomInfo(game.location, game.enemyHp, game.enemyMaxHp, game.treasuryLocked);
    return res.json({ game, roomInfo });
  } catch (error: any) {
    console.error('Error fetching game status:', error);
    return res.status(500).json({ error: 'Failed to retrieve game status.' });
  }
});

// Start a new game
router.post('/new', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const game = await GameEngine.createGame(userId);
    const roomInfo = GameEngine.getRoomInfo(game.location, game.enemyHp, game.enemyMaxHp, game.treasuryLocked);
    return res.status(201).json({ game, roomInfo });
  } catch (error: any) {
    console.error('Error starting new game:', error);
    return res.status(500).json({ error: 'Failed to start a new game.' });
  }
});

// Submit player action
router.post('/action', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { action } = req.body;

  if (!action || typeof action !== 'string' || action.trim() === '') {
    return res.status(400).json({ error: 'Action string is required.' });
  }

  try {
    // 1. Get current active game
    const game = await GameEngine.getActiveGame(userId);
    if (!game) {
      return res.status(400).json({ error: 'No active game found. Please start a new game.' });
    }
    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active. Please start a new game.' });
    }

    // 2. run game turn through the AI loop & stream
    // historyTurns is game.turns
    await AIService.runGameTurn(game.id, action.trim(), game.turns, res);
  } catch (error: any) {
    console.error('Error processing game action:', error);
    // If headers have already been sent, we should just close the connection
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message || 'Error executing turn.' })}\n\n`);
        res.end();
      }
    } else {
      return res.status(500).json({ error: 'Internal server error processing game action.' });
    }
  }
});

export default router;
