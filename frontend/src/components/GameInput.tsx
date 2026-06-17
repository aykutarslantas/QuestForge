'use client';

import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface InventoryItem {
  id: string;
  item: string;
  quantity: number;
}

interface RoomItem {
  id: string;
  room: string;
  item: string;
  quantity: number;
}

interface GameState {
  id: string;
  status: 'active' | 'won' | 'lost';
  hp: number;
  maxHp: number;
  location: string;
  enemyHp: number;
  treasuryLocked: boolean;
  inventoryItems: InventoryItem[];
  roomItems: RoomItem[];
}

interface GameInputProps {
  game: GameState | null;
  onSubmitAction: (actionText: string) => void;
  isActionLoading: boolean;
}

export default function GameInput({ game, onSubmitAction, isActionLoading }: GameInputProps) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() === '' || isActionLoading) return;
    onSubmitAction(inputText.trim());
    setInputText('');
  };

  const handleQuickAction = (action: string) => {
    if (isActionLoading) return;
    onSubmitAction(action);
  };

  // Generate dynamic suggestions based on state
  const getSuggestions = () => {
    if (!game || game.status !== 'active') return [];

    const list: string[] = [];
    const location = game.location;
    const itemsInRoom = game.roomItems.filter((ri) => ri.room === location && ri.quantity > 0).map((ri) => ri.item);
    const hasKey = game.inventoryItems.some((inv) => inv.item === 'rusty key');
    const hasPotion = game.inventoryItems.some((inv) => inv.item === 'health potion');

    // Room-specific moves
    if (location === 'cavern') {
      if (itemsInRoom.includes('rusty key')) {
        list.push('take rusty key');
      }
      list.push('go north');
    } else if (location === 'armoury') {
      if (itemsInRoom.includes('wooden shield')) {
        list.push('take wooden shield');
      }
      if (itemsInRoom.includes('health potion')) {
        list.push('take health potion');
      }
      if (game.enemyHp > 0) {
        list.push('attack goblin');
      } else {
        if (game.treasuryLocked) {
          if (hasKey) {
            list.push('use rusty key');
          }
        } else {
          list.push('go east');
        }
      }
      list.push('go south');
    } else if (location === 'treasury') {
      if (itemsInRoom.includes('golden crown')) {
        list.push('take golden crown');
      }
      list.push('go west');
    }

    // Generic usability items
    if (hasPotion && game.hp < game.maxHp) {
      list.push('use health potion');
    }

    return list;
  };

  const suggestions = getSuggestions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
      
      {/* Quick suggestions */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} color="var(--color-secondary)" /> Suggestions:
          </span>
          {suggestions.map((sug) => (
            <button
              key={sug}
              disabled={isActionLoading}
              onClick={() => handleQuickAction(sug)}
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-light)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                textTransform: 'capitalize'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-secondary)';
                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          id="game-action-input"
          type="text"
          disabled={isActionLoading || (game ? game.status !== 'active' : true)}
          className="input-field"
          placeholder={game && game.status !== 'active' ? 'Game Over. Click Reset to play again.' : 'What would you like to do? (e.g. "go north", "attack goblin")'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{ height: '48px' }}
        />
        <button
          id="game-action-submit"
          type="submit"
          disabled={isActionLoading || inputText.trim() === '' || (game ? game.status !== 'active' : true)}
          className="btn btn-primary"
          style={{ width: '48px', height: '48px', padding: 0, minWidth: '48px' }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
