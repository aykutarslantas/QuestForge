import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { config } from '../config.js';

const router = Router();

// Register Endpoint
router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: '7d',
    });

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error: any) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Login Endpoint
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: '7d',
    });

    return res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
