'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, RotateCcw, Swords, Compass } from 'lucide-react';
import StatsPanel from '../../components/StatsPanel';
import NarrationLog from '../../components/NarrationLog';
import GameInput from '../../components/GameInput';

interface Turn {
  id: string;
  role: 'player' | 'gm';
  content: string;
  toolCalls?: any[];
}

export default function GamePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  
  // Local turn log to show actions immediately before backend sync
  const [localTurns, setLocalTurns] = useState<Turn[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [shakeClass, setShakeClass] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (!savedToken) {
      router.push('/login');
    } else {
      setToken(savedToken);
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  }, [router]);

  // Fetch Game Status
  const { data: gameData, isLoading, error } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/game/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        throw new Error('Failed to fetch game status');
      }
      const data = await res.json();
      return data;
    },
    enabled: !!token,
  });

  // Sync database turns with local turns once status updates
  useEffect(() => {
    if (gameData && gameData.game && gameData.game.turns) {
      setLocalTurns(gameData.game.turns);
    }
  }, [gameData]);

  // Start a New Game Mutation
  const newGameMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/game/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to create new game');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      setLocalTurns([]);
      setStreamingText('');
      setIsStreaming(false);
    },
  });

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  // Submit Action with SSE Streaming
  const handleAction = async (actionText: string) => {
    if (isStreaming || !token) return;

    // Trigger visual shake when attacking
    if (actionText.toLowerCase().includes('attack')) {
      setShakeClass('shake');
      setTimeout(() => setShakeClass(''), 500);
    }

    // 1. Optimistically add the player's action
    const optPlayerTurn: Turn = {
      id: `opt-player-${Date.now()}`,
      role: 'player',
      content: actionText,
    };
    setLocalTurns((prev) => [...prev, optPlayerTurn]);

    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch(`${apiUrl}/api/game/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: actionText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error');
      }

      // 2. Read the body stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let narration = '';
      let buffer = ''; // Buffer for incomplete lines

      if (!reader) {
        throw new Error('Failed to start stream reader');
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const dataStr = line.trim().slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                narration += data.token;
                setStreamingText(narration);
              }
              if (data.error) {
                narration += `\n[Error: ${data.error}]`;
                setStreamingText(narration);
              }
            } catch (e) {
              // Partial JSON in chunk boundary
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Action error:', err);
      // Append error message to UI
      const optGmErrorTurn: Turn = {
        id: `opt-error-${Date.now()}`,
        role: 'gm',
        content: `The connection to the Game Master was severed. Reason: ${err.message || 'Unknown error'}.`,
      };
      setLocalTurns((prev) => [...prev, optGmErrorTurn]);
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      // 3. Invalidate state to fetch updated character stats & permanent turn history
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
    }
  };

  // Quick Action for Potion/Key use from StatsPanel
  const handleUseItem = (itemName: string) => {
    handleAction(`use ${itemName}`);
  };

  if (isLoading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '20px' }}>
        <div className="pulse" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-secondary)' }}>
          Contacting the Game Master...
        </div>
      </div>
    );
  }

  return (
    <main className={`container ${shakeClass}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column', maxHeight: '100vh', overflow: 'hidden' }}>
      
      {/* Header bar */}
      <header 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px', 
          borderRadius: '12px',
          marginBottom: '20px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🎲</span>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(to right, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              QuestForge
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Logged in as {user?.email}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {gameData?.game && (
            <button 
              id="btn-reset-game"
              disabled={newGameMutation.isPending}
              onClick={() => newGameMutation.mutate()}
              className="btn btn-secondary animate-pulse"
              style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}
            >
              <RotateCcw size={16} /> Reset Game
            </button>
          )}
          <button 
            id="btn-logout"
            onClick={handleLogout}
            className="btn btn-danger"
            style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main dashboard grid */}
      {gameData?.game ? (
        <div className="game-grid" style={{ flexGrow: 1, paddingBottom: '20px', minHeight: 0 }}>
          {/* Narrative stream and Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: 0 }}>
            <NarrationLog 
              turns={localTurns} 
              streamingText={streamingText} 
              isStreaming={isStreaming} 
            />
            <GameInput 
              game={gameData?.game} 
              roomInfo={gameData?.roomInfo} 
              onSubmitAction={handleAction} 
              isActionLoading={isStreaming} 
            />
          </div>

          {/* Character Stats Sheet */}
          <div style={{ height: '100%', minHeight: 0 }}>
            <StatsPanel 
              game={gameData?.game} 
              roomInfo={gameData?.roomInfo} 
              onUseItem={handleUseItem} 
              isActionLoading={isStreaming} 
            />
          </div>
        </div>
      ) : (
        /* Starting a new game dashboard */
        <div className="flex-center animate-fade-in" style={{ flexGrow: 1, flexDirection: 'column' }}>
          <div className="glass-panel" style={{ padding: '60px', maxWidth: '500px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ fontSize: '3rem', animation: 'pulse 3s infinite' }}>⚔️</div>
            <h2 style={{ fontSize: '2rem' }}>Ready to Begin?</h2>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
              Create your character and enter the Whispering Cavern. The AI Game Master is ready to narrate your adventure.
            </p>
            <button
              disabled={newGameMutation.isPending}
              onClick={() => newGameMutation.mutate()}
              className="btn btn-primary"
              style={{ padding: '14px 28px', fontSize: '1.1rem', marginTop: '10px' }}
            >
              {newGameMutation.isPending ? 'Forging Game...' : 'Start New Adventure'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
