'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/game');
    }
  }, [router]);

  return (
    <main className="flex-center animate-fade-in" style={{ minHeight: '100vh', flexDirection: 'column', gap: '30px', padding: '20px' }}>
      <div className="glass-panel" style={{ padding: '50px', maxWidth: '600px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '4rem', filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.5))' }}>🎲</div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(to right, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          QuestForge
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: '1.6', fontFamily: 'var(--font-sans)' }}>
          A secure, server-validated RPG experience. Embark on a journey overseen by an AI Game Master, where the server governs the rules and your choices determine your fate.
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '15px' }}>
          <Link href="/login" className="btn btn-primary" style={{ width: '140px' }}>
            Login
          </Link>
          <Link href="/register" className="btn btn-secondary" style={{ width: '140px' }}>
            Register
          </Link>
        </div>
      </div>
      <footer style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '20px' }}>
        Property of Efsora Labs. All rights reserved.
      </footer>
    </main>
  );
}
