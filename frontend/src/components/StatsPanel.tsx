'use client';

import React from 'react';
import { Heart, MapPin, Shield, Key, GlassWater, Crown, Swords, Lock, Unlock } from 'lucide-react';

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
  enemyMaxHp: number;
  treasuryLocked: boolean;
  inventoryItems: InventoryItem[];
  roomItems: RoomItem[];
}

interface EnemyInfo {
  name: string;
  hp: number;
  maxHp: number;
}

interface LockInfo {
  name: string;
  isLocked: boolean;
}

interface RoomInfo {
  name: string;
  exits: string[];
  enemy: EnemyInfo | null;
  lock: LockInfo | null;
}

interface StatsPanelProps {
  game: GameState | null;
  roomInfo: RoomInfo | null;
  onUseItem: (itemName: string) => void;
  isActionLoading: boolean;
}

export default function StatsPanel({ game, roomInfo, onUseItem, isActionLoading }: StatsPanelProps) {
  if (!game) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No character data. Start a new game.
      </div>
    );
  }

  const hpPercentage = (game.hp / game.maxHp) * 100;
  
  // Health bar color based on HP
  const getHpColor = () => {
    if (game.hp > 12) return 'var(--color-secondary)';
    if (game.hp > 6) return 'var(--color-warning)';
    return 'var(--color-accent)';
  };

  const roomName = roomInfo?.name || game.location;

  // Render nice items list with icons
  const getItemIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'rusty key':
        return <Key size={16} color="var(--color-warning)" />;
      case 'wooden shield':
        return <Shield size={16} color="var(--color-secondary)" />;
      case 'health potion':
        return <GlassWater size={16} color="var(--color-accent)" />;
      case 'golden crown':
        return <Crown size={16} color="gold" />;
      default:
        return <Key size={16} />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* Character Name & Status Banner */}
      <div>
        <h3 style={{ fontSize: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Character Stats</span>
          <span 
            style={{ 
              fontSize: '0.8rem', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              background: game.status === 'active' ? 'rgba(6, 182, 212, 0.1)' : game.status === 'won' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: game.status === 'active' ? 'var(--color-secondary)' : game.status === 'won' ? '#4ade80' : '#f87171',
              border: `1px solid ${game.status === 'active' ? 'var(--color-secondary)' : game.status === 'won' ? '#22c55e' : '#ef4444'}`,
              textTransform: 'uppercase',
              fontWeight: 'bold',
              letterSpacing: '0.05em'
            }}
          >
            {game.status}
          </span>
        </h3>
      </div>

      {/* HP Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent)' }}>
            <Heart size={16} fill="var(--color-accent)" /> HP
          </span>
          <span>{game.hp} / {game.maxHp}</span>
        </div>
        <div style={{ height: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
          <div 
            style={{ 
              height: '100%', 
              width: `${hpPercentage}%`, 
              background: getHpColor(), 
              transition: 'width 0.4s ease-out',
              boxShadow: `0 0 10px ${getHpColor()}`
            }} 
          />
        </div>
      </div>

      {/* Location */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} /> Current Location
        </span>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>
          {roomName}
        </div>
        {roomInfo?.lock && (
          <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: roomInfo.lock.isLocked ? 'var(--color-warning)' : '#4ade80' }}>
            {roomInfo.lock.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {roomInfo.lock.name} is {roomInfo.lock.isLocked ? 'Locked' : 'Unlocked'}
          </div>
        )}
      </div>

      {/* Inventory Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', flexGrow: 1 }}>
        <h4 style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>Inventory</h4>
        {game.inventoryItems.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
            Your inventory is empty.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {game.inventoryItems.map((inv) => (
              <div 
                key={inv.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '8px 12px', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '8px' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getItemIcon(inv.item)}
                  <span style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>
                    {inv.item} {inv.quantity > 1 ? `(x${inv.quantity})` : ''}
                  </span>
                </div>
                {inv.item !== 'golden crown' && (
                  <button 
                    disabled={isActionLoading || game.status !== 'active'}
                    onClick={() => onUseItem(inv.item)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', textTransform: 'none' }}
                  >
                    Use
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Room Items remaining */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
        <h4 style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>Room Items Available</h4>
        {game.roomItems.filter(ri => ri.room === game.location).length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Nothing of value left in this room.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {game.roomItems
              .filter((ri) => ri.room === game.location)
              .map((ri) => (
                <span 
                  key={ri.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontSize: '0.8rem', 
                    padding: '4px 10px', 
                    background: 'rgba(168, 85, 247, 0.1)', 
                    border: '1px solid rgba(168, 85, 247, 0.2)', 
                    borderRadius: '20px',
                    textTransform: 'capitalize',
                    color: 'var(--color-primary)'
                  }}
                >
                  {getItemIcon(ri.item)}
                  {ri.item}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Enemy Alert Panel */}
      {roomInfo?.enemy && roomInfo.enemy.hp > 0 && (
        <div 
          className="pulse" 
          style={{ 
            marginTop: 'auto', 
            padding: '16px', 
            background: 'rgba(244, 63, 94, 0.1)', 
            border: '1px solid rgba(244, 63, 94, 0.3)', 
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent)', fontWeight: 600, fontSize: '0.9rem' }}>
            <Swords size={16} /> Enemy Engaged!
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span>{roomInfo.enemy.name}</span>
            <span>{roomInfo.enemy.hp} / {roomInfo.enemy.maxHp} HP</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${(roomInfo.enemy.hp / roomInfo.enemy.maxHp) * 100}%`, 
                background: 'var(--color-accent)',
                transition: 'width 0.3s ease-out' 
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
