'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES, MIXED_CATEGORY, PAYERS, PAYERS_SPLIT } from '@/lib/constants';
import type { Ticket } from '@/lib/types';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = searchParams.get('year') ?? String(new Date().getFullYear());

  const [id, setId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Champs du formulaire
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [amount81, setAmount81] = useState('');
  const [amount26, setAmount26] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0] as string);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [payer, setPayer] = useState<string>(PAYERS[0]);
  const [note, setNote] = useState('');

  const isMixed = category === MIXED_CATEGORY;
  const isCash = paymentMethod === 'cash';
  const mixedTotal = isMixed ? (parseFloat(amount81) || 0) + (parseFloat(amount26) || 0) : null;

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tickets?year=${year}`)
      .then(r => r.json())
      .then((tickets: Ticket[]) => {
        const t = tickets.find(t => t.id === id);
        if (!t) { setError('Ticket introuvable'); setLoading(false); return; }
        setDate(t.date);
        setCategory(t.category);
        setPaymentMethod(t.paymentMethod ?? 'card');
        setPayer(t.payer ?? PAYERS[0]);
        setNote(t.note ?? '');
        if (t.category === MIXED_CATEGORY && t.amount81 !== undefined && t.amount26 !== undefined) {
          setAmount81(String(t.amount81));
          setAmount26(String(t.amount26));
        } else {
          setAmount(String(t.amount));
        }
        setLoading(false);
      });
  }, [id, year]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    let body: Record<string, unknown> = { date, category, paymentMethod, note: note.trim() || undefined };

    if (isCash) {
      body.payer = payer;
    } else {
      body.paymentMethod = 'card';
    }

    if (isMixed) {
      const v81 = parseFloat(amount81);
      const v26 = parseFloat(amount26);
      if (!amount81 || isNaN(v81) || v81 <= 0 || !amount26 || isNaN(v26) || v26 <= 0) {
        setError('Veuillez entrer les deux montants.');
        return;
      }
      body.amount81 = v81;
      body.amount26 = v26;
    } else {
      const amt = parseFloat(amount);
      if (!amount || isNaN(amt) || amt <= 0) {
        setError('Veuillez entrer un montant valide.');
        return;
      }
      body.amount = amt;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${id}?year=${year}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? 'Erreur serveur');
      }
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-xl">
        Chargement...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-white text-3xl font-light">‹</button>
          <h1 className="text-2xl font-bold">Modifier le ticket</h1>
        </div>
        <button
          onClick={() => router.push('/')}
          className="text-green-100 text-base font-semibold bg-green-800 px-3 py-2 rounded-xl active:bg-green-900"
        >
          🏠 Accueil
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5 pb-32">
        {/* Date */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full text-lg p-4 rounded-2xl border-2 border-gray-200 bg-white"
            required
          />
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Catégorie</label>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setError(''); }}
            className="w-full text-lg p-4 rounded-2xl border-2 border-gray-200 bg-white"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Montant */}
        {isMixed ? (
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-700">Montants (CHF)</label>
            <div className="flex items-center gap-3">
              <span className="text-base text-gray-500 w-16 shrink-0">TVA 8.1%</span>
              <input
                type="number" step="0.05" min="0" placeholder="0.00"
                value={amount81} onChange={e => setAmount81(e.target.value)}
                className="flex-1 text-xl p-4 rounded-2xl border-2 border-gray-200 bg-white font-semibold"
                inputMode="decimal"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-base text-gray-500 w-16 shrink-0">TVA 2.6%</span>
              <input
                type="number" step="0.05" min="0" placeholder="0.00"
                value={amount26} onChange={e => setAmount26(e.target.value)}
                className="flex-1 text-xl p-4 rounded-2xl border-2 border-gray-200 bg-white font-semibold"
                inputMode="decimal"
              />
            </div>
            {mixedTotal !== null && mixedTotal > 0 && (
              <div className="bg-green-50 rounded-2xl px-4 py-3 flex justify-between items-center">
                <span className="text-base text-green-700 font-medium">Total</span>
                <span className="text-xl font-bold text-green-700">CHF {mixedTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Montant (CHF)</label>
            <input
              type="number" step="0.05" min="0" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full text-xl p-4 rounded-2xl border-2 border-gray-200 bg-white font-semibold"
              required inputMode="decimal"
            />
          </div>
        )}

        {/* Paiement */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Paiement</label>
          <div className="flex gap-3">
            <button
              type="button" onClick={() => setPaymentMethod('card')}
              className={`flex-1 py-4 rounded-2xl text-lg font-semibold border-2 transition-colors ${
                !isCash ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              💳 Carte
            </button>
            <button
              type="button" onClick={() => setPaymentMethod('cash')}
              className={`flex-1 py-4 rounded-2xl text-lg font-semibold border-2 transition-colors ${
                isCash ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              💵 Cash
            </button>
          </div>
        </div>

        {/* Payeur */}
        {isCash && (
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Payé par</label>
            <div className="flex gap-2 flex-wrap">
              {PAYERS.map(p => (
                <button
                  key={p} type="button" onClick={() => setPayer(p)}
                  className={`flex-1 py-4 rounded-2xl text-lg font-semibold border-2 transition-colors ${
                    payer === p ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button" onClick={() => setPayer(PAYERS_SPLIT)}
                className={`w-full py-4 rounded-2xl text-lg font-semibold border-2 transition-colors ${
                  payer === PAYERS_SPLIT ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                50/50 Robin / Malek
              </button>
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            Note <span className="text-base font-normal text-gray-400">(optionnel)</span>
          </label>
          <input
            type="text"
            placeholder="Ex: déjeuner avec client..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full text-lg p-4 rounded-2xl border-2 border-gray-200 bg-white"
          />
        </div>

        {error && (
          <p className="text-red-600 text-base bg-red-50 p-3 rounded-xl">{error}</p>
        )}
      </form>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-5">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full max-w-lg bg-green-700 text-white text-xl font-bold py-5 rounded-2xl shadow-lg active:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : '✓ Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
