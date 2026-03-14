'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      router.replace('/');
    } else {
      setError(true);
      setPin('');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-green-700 text-center mb-2">🧾 Mes Tickets</h1>
        <p className="text-gray-500 text-center mb-10">Entrez votre code d'accès</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Code d'accès"
            autoFocus
            className="w-full border-2 border-gray-300 rounded-2xl px-5 py-5 text-2xl text-center tracking-widest focus:outline-none focus:border-green-600"
          />

          {error && (
            <p className="text-red-600 text-center font-medium">Code incorrect. Réessayez.</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full bg-green-700 text-white text-xl font-bold py-5 rounded-2xl disabled:opacity-50 active:bg-green-800"
          >
            {loading ? 'Vérification…' : 'Accéder'}
          </button>
        </form>
      </div>
    </div>
  );
}
