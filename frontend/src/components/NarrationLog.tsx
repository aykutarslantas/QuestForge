'use client';

import React, { useEffect, useRef } from 'react';

interface ToolCall {
  name: string;
  args: any;
  result: {
    success: boolean;
    message: string;
    [key: string]: any;
  };
}

interface Turn {
  id: string;
  role: 'player' | 'gm';
  content: string;
  toolCalls?: ToolCall[];
}

interface NarrationLogProps {
  turns: Turn[];
  streamingText: string;
  isStreaming: boolean;
}

export default function NarrationLog({ turns, streamingText, isStreaming }: NarrationLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [turns, streamingText]);

  return (
    <div 
      ref={containerRef}
      className="glass-panel" 
      style={{ 
        flexGrow: 1, 
        padding: '24px', 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        maxHeight: '100%'
      }}
    >
      {turns.map((turn, index) => (
        <div 
          key={turn.id || index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: turn.role === 'player' ? 'flex-end' : 'flex-start',
            gap: '6px',
            maxWidth: '85%',
            alignSelf: turn.role === 'player' ? 'flex-end' : 'flex-start',
          }}
        >
          {/* Sender label */}
          <span 
            style={{ 
              fontSize: '0.75rem', 
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em' 
            }}
          >
            {turn.role === 'player' ? 'You' : 'Game Master'}
          </span>

          {/* Message bubble */}
          <div 
            style={{
              padding: '14px 18px',
              borderRadius: turn.role === 'player' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: turn.role === 'player' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${turn.role === 'player' ? 'rgba(168, 85, 247, 0.3)' : 'var(--border-light)'}`,
              color: 'white',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.95rem',
              lineHeight: '1.5',
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            {turn.content}
          </div>
 
          {/* Tool debug log (optional, but highly informative and clean!) */}
          {turn.toolCalls && turn.toolCalls.map((tc, tcIdx) => (
            <div 
              key={tcIdx}
              style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                padding: '6px 10px',
                borderRadius: '6px',
                background: tc.result.success ? 'rgba(6, 182, 212, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                borderLeft: `3px solid ${tc.result.success ? 'var(--color-secondary)' : 'var(--color-accent)'}`,
                color: tc.result.success ? '#22d3ee' : '#f43f5e',
                marginTop: '4px',
                wordBreak: 'break-all',
                overflowWrap: 'anywhere'
              }}
            >
              System Ref: {tc.name}({JSON.stringify(tc.args)}) → {tc.result.success ? 'Success' : 'Rejected'} ({tc.result.message})
            </div>
          ))}
        </div>
      ))}

      {/* Streaming response */}
      {isStreaming && streamingText && (
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '6px',
            maxWidth: '85%',
            alignSelf: 'flex-start',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Game Master
          </span>
          <div 
            style={{
              padding: '14px 18px',
              borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              color: 'white',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.95rem',
              lineHeight: '1.5',
              position: 'relative',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            {streamingText}
            <span 
              className="pulse" 
              style={{ 
                display: 'inline-block', 
                width: '8px', 
                height: '14px', 
                background: 'var(--color-secondary)', 
                marginLeft: '4px',
                verticalAlign: 'middle'
              }} 
            />
          </div>
        </div>
      )}

      {/* GM Thinking Indicator */}
      {isStreaming && !streamingText && (
        <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Game Master
          </span>
          <div style={{ display: 'flex', gap: '4px', padding: '12px 18px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--color-primary)', borderRadius: '50%', animation: 'pulse 1.2s infinite 0.1s' }} />
            <span style={{ width: '6px', height: '6px', background: 'var(--color-primary)', borderRadius: '50%', animation: 'pulse 1.2s infinite 0.3s' }} />
            <span style={{ width: '6px', height: '6px', background: 'var(--color-primary)', borderRadius: '50%', animation: 'pulse 1.2s infinite 0.5s' }} />
          </div>
        </div>
      )}
    </div>
  );
}
