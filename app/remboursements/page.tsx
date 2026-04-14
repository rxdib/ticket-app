'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Ticket } from '@/lib/types';
import { PAYERS } from '@/lib/constants';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

type FilterPeriod = '1' | '3' | '6' | 'all';

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  '1': '1 mois',
  '3': '3 mois',
  '6': '6 mois',
  'all': 'Tout',
};

export default function RemboursementsPage() {
  const router = useRouter();
  const year = new Date().getFullYear();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FilterPeriod>('3');
  const [filterPayer, setFilterPayer] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tickets?year=${year}`)
      .then(r => r.json())
      .then((data: Ticket[]) => {
        setTickets(data);
        setLoading(false);
      });
  }, [year]);

  async function toggleReimbursed(ticket: Ticket) {
    setUpdating(ticket.id);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}?year=${year}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reimbursed: !ticket.reimbursed }),
      });
      if (res.ok) {
        const updated: Ticket = await res.json();
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      }
    } finally {
      setUpdating(null);
    }
  }

  // Filtrer uniquement les tickets cash
  const cashTickets = tickets.filter(t => t.paymentMethod === 'cash');

  // Filtre par période
  const cutoff = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(period));
    return d.toISOString().split('T')[0];
  })();

  const periodFiltered = cutoff
    ? cashTickets.filter(t => t.date >= cutoff)
    : cashTickets;

  // Filtre par payeur
  const filtered = filterPayer === 'all'
    ? periodFiltered
    : periodFiltered.filter(t => t.payer === filterPayer);

  // Trier par date décroissante
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  // Totaux par payeur
  const totals = PAYERS.map(p => {
    const payerTickets = periodFiltered.filter(t => t.payer === p);
    const total = payerTickets.reduce((s, t) => s + t.amount, 0);
    const pending = payerTickets.filter(t => !t.reimbursed).reduce((s, t) => s + t.amount, 0);
    return { payer: p, total, pending, count: payerTickets.length, pendingCount: payerTickets.filter(t => !t.reimbursed).length };
  }).filter(t => t.count > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-xl">
        Chargement...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-white text-3xl font-light">‹</button>
        <h1 className="text-2xl font-bold">Remboursements cash</h1>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Filtre période */}
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Période</p>
          <div className="flex gap-2">
            {(Object.entries(PERIOD_LABELS) as [FilterPeriod, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`flex-1 py-2.5 rounded-xl text-base font-semibold border-2 transition-colors ${
                  period === key
                    ? 'bg-green-700 border-green-700 text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Résumé par personne */}
        {totals.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Résumé</p>
            {totals.map(({ payer, total, pending, pendingCount }) => (
              <div key={payer} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <p className="text-xl font-bold text-gray-800">{payer}</p>
                  <p className="text-xl font-bold text-green-700">CHF {total.toFixed(2)}</p>
                </div>
                {pending > 0 && (
                  <p className="text-base text-amber-600 mt-1">
                    En attente : CHF {pending.toFixed(2)} ({pendingCount} ticket{pendingCount > 1 ? 's' : ''})
                  </p>
                )}
                {pending === 0 && (
                  <p className="text-base text-green-600 mt-1">Tout remboursé ✓</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Filtre payeur */}
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Filtrer par personne</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPayer('all')}
              className={`px-4 py-2.5 rounded-xl text-base font-semibold border-2 transition-colors ${
                filterPayer === 'all'
                  ? 'bg-green-700 border-green-700 text-white'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              Tous
            </button>
            {PAYERS.map(p => (
              <button
                key={p}
                onClick={() => setFilterPayer(p)}
                className={`px-4 py-2.5 rounded-xl text-base font-semibold border-2 transition-colors ${
                  filterPayer === p
                    ? 'bg-green-700 border-green-700 text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des tickets */}
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-xl">Aucun ticket cash</p>
            <p className="text-base mt-1">sur cette période</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {sorted.length} ticket{sorted.length > 1 ? 's' : ''}
            </p>
            {sorted.map(ticket => (
              <div
                key={ticket.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
                  ticket.reimbursed ? 'border-green-400' : 'border-amber-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-gray-800">{formatDate(ticket.date)}</p>
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                        ticket.reimbursed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ticket.reimbursed ? '✓ Remboursé' : 'En attente'}
                      </span>
                    </div>
                    <p className="text-base text-gray-500 mt-0.5">{ticket.category}</p>
                    {ticket.payer && <p className="text-base text-gray-500">Par : {ticket.payer}</p>}
                    {ticket.note && <p className="text-base text-gray-400 italic mt-0.5">{ticket.note}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-3">
                    <p className="text-xl font-bold text-green-700">CHF {ticket.amount.toFixed(2)}</p>
                    <button
                      onClick={() => toggleReimbursed(ticket)}
                      disabled={updating === ticket.id}
                      className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition-colors disabled:opacity-50 ${
                        ticket.reimbursed
                          ? 'border-gray-300 text-gray-500 active:bg-gray-50'
                          : 'border-green-500 text-green-700 active:bg-green-50'
                      }`}
                    >
                      {updating === ticket.id ? '...' : ticket.reimbursed ? 'Annuler' : '✓ Remboursé'}
                    </button>
                  </div>
                </div>
                <Link
                  href={`/ticket/${ticket.id}?year=${year}`}
                  className="block mt-2 text-sm text-green-700 font-medium"
                >
                  Voir le ticket →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
