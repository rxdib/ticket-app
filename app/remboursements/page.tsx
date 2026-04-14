'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Ticket, Payment } from '@/lib/types';
import { PAYERS, PAYERS_SPLIT } from '@/lib/constants';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

type FilterPeriod = '1' | '3' | '6' | 'all';
type FilterPayer = 'all' | 'Robin' | 'Malek' | 'Kurt';

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  '1': '1 mois',
  '3': '3 mois',
  '6': '6 mois',
  'all': 'Tout',
};

function amountFor(ticket: Ticket, person: string): number {
  return ticket.payer === PAYERS_SPLIT ? ticket.amount / 2 : ticket.amount;
}

function isReimbursedFor(ticket: Ticket, person: string): boolean {
  if (ticket.payer === PAYERS_SPLIT) {
    return person === 'Robin' ? !!ticket.reimbursedRobin : !!ticket.reimbursedMalek;
  }
  return !!ticket.reimbursed;
}

function involvesPerson(ticket: Ticket, person: string): boolean {
  if (ticket.payer === PAYERS_SPLIT) return person === 'Robin' || person === 'Malek';
  return ticket.payer === person;
}

// Formulaire de versement inline par personne
interface VersementFormProps {
  payer: string;
  pendingTotal: number;
  year: number;
  onSuccess: (result: { ticketsMarked: number; amountUsed: number; amountExcess: number }) => void;
  onCancel: () => void;
}

function VersementForm({ payer, pendingTotal, year, onSuccess, onCancel }: VersementFormProps) {
  const [amount, setAmount] = useState(pendingTotal.toFixed(2));
  const [date, setDate] = useState(todayString());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Montant invalide'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/payments?year=${year}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: payer, amount: amt, date, note: note || undefined }),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'Erreur'); }
      const data = await res.json();
      onSuccess(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3 mt-3">
      <p className="text-base font-semibold text-green-800">Versement à {payer}</p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-sm text-gray-500 mb-1 block">Montant (CHF)</label>
          <input
            type="number"
            step="0.05"
            min="0.05"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full text-lg p-3 rounded-xl border-2 border-gray-200 bg-white font-semibold"
            inputMode="decimal"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-500 mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full text-base p-3 rounded-xl border-2 border-gray-200 bg-white"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">Note <span className="text-gray-400">(optionnel)</span></label>
        <input
          type="text"
          placeholder="Ex: remboursement Q1 2026"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full text-base p-3 rounded-xl border-2 border-gray-200 bg-white"
        />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-green-700 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : '✓ Confirmer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function RemboursementsPage() {
  const router = useRouter();
  const year = new Date().getFullYear();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FilterPeriod>('3');
  const [filterPayer, setFilterPayer] = useState<FilterPayer>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [versementFor, setVersementFor] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tickets?year=${year}`).then(r => r.json()),
      fetch(`/api/payments?year=${year}`).then(r => r.json()),
    ]).then(([t, p]: [Ticket[], Payment[]]) => {
      setTickets(t);
      setPayments(p);
      setLoading(false);
    });
  }, [year]);

  async function patchTicket(ticket: Ticket, body: object) {
    const key = ticket.id;
    setUpdating(key);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}?year=${year}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: Ticket = await res.json();
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      }
    } finally {
      setUpdating(null);
    }
  }

  function toggleFor(ticket: Ticket, person: string) {
    const current = isReimbursedFor(ticket, person);
    if (ticket.payer === PAYERS_SPLIT) {
      if (person === 'Robin') patchTicket(ticket, { reimbursedRobin: !current });
      else                    patchTicket(ticket, { reimbursedMalek: !current });
    } else {
      patchTicket(ticket, { reimbursed: !current });
    }
  }

  function handleVersementSuccess(
    payer: string,
    result: { ticketsMarked: number; amountUsed: number; amountExcess: number }
  ) {
    setVersementFor(null);
    // Recharger les données
    Promise.all([
      fetch(`/api/tickets?year=${year}`).then(r => r.json()),
      fetch(`/api/payments?year=${year}`).then(r => r.json()),
    ]).then(([t, p]: [Ticket[], Payment[]]) => {
      setTickets(t);
      setPayments(p);
    });
    let msg = `✓ ${result.ticketsMarked} ticket${result.ticketsMarked > 1 ? 's' : ''} marqué${result.ticketsMarked > 1 ? 's' : ''} remboursé${result.ticketsMarked > 1 ? 's' : ''} (CHF ${result.amountUsed.toFixed(2)})`;
    if (result.amountExcess > 0) msg += ` — excédent CHF ${result.amountExcess.toFixed(2)}`;
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  // Seulement les tickets cash
  const cashTickets = tickets.filter(t => t.paymentMethod === 'cash');

  // Filtre période
  const cutoff = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(period));
    return d.toISOString().split('T')[0];
  })();

  const periodFiltered = cutoff
    ? cashTickets.filter(t => t.date >= cutoff)
    : cashTickets;

  // Résumé par personne
  const summary = PAYERS.map(p => {
    const mine = periodFiltered.filter(t => involvesPerson(t, p));
    const total = mine.reduce((s, t) => s + amountFor(t, p), 0);
    const pending = mine.filter(t => !isReimbursedFor(t, p)).reduce((s, t) => s + amountFor(t, p), 0);
    const pendingCount = mine.filter(t => !isReimbursedFor(t, p)).length;
    const payerHistory = payments.filter(pay => pay.recipient === p).sort((a, b) => b.date.localeCompare(a.date));
    return { payer: p, total, pending, pendingCount, payerHistory };
  }).filter(s => s.total > 0);

  // Filtre liste
  const filtered = filterPayer === 'all'
    ? periodFiltered
    : periodFiltered.filter(t => involvesPerson(t, filterPayer));

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-xl">
        Chargement...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-white text-3xl font-light">‹</button>
        <h1 className="text-2xl font-bold">Remboursements cash</h1>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Message succès versement */}
        {successMsg && (
          <div className="bg-green-50 border border-green-300 rounded-2xl px-4 py-3 text-green-800 font-medium text-base">
            {successMsg}
          </div>
        )}

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

        {/* Résumé par personne + bouton versement */}
        {summary.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Résumé</p>
            {summary.map(({ payer, total, pending, pendingCount, payerHistory }) => (
              <div key={payer} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xl font-bold text-gray-800">{payer}</p>
                    <p className="text-xl font-bold text-green-700">CHF {total.toFixed(2)}</p>
                  </div>
                  {pending > 0 ? (
                    <p className="text-base text-amber-600 mt-1">
                      En attente : CHF {pending.toFixed(2)} ({pendingCount} ticket{pendingCount > 1 ? 's' : ''})
                    </p>
                  ) : (
                    <p className="text-base text-green-600 mt-1">Tout remboursé ✓</p>
                  )}

                  {/* Bouton versement */}
                  {pending > 0 && versementFor !== payer && (
                    <button
                      onClick={() => { setVersementFor(payer); setHistoryOpen(null); }}
                      className="mt-3 w-full py-3 border-2 border-green-600 text-green-700 font-semibold rounded-xl text-base active:bg-green-50"
                    >
                      💸 Enregistrer un versement
                    </button>
                  )}

                  {/* Formulaire versement */}
                  {versementFor === payer && (
                    <VersementForm
                      payer={payer}
                      pendingTotal={pending}
                      year={year}
                      onSuccess={result => handleVersementSuccess(payer, result)}
                      onCancel={() => setVersementFor(null)}
                    />
                  )}

                  {/* Historique des versements */}
                  {payerHistory.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setHistoryOpen(historyOpen === payer ? null : payer)}
                        className="text-sm text-gray-500 font-medium flex items-center gap-1"
                      >
                        <span>{historyOpen === payer ? '▾' : '▸'}</span>
                        {payerHistory.length} versement{payerHistory.length > 1 ? 's' : ''} enregistré{payerHistory.length > 1 ? 's' : ''}
                      </button>
                      {historyOpen === payer && (
                        <div className="mt-2 space-y-2">
                          {payerHistory.map(pay => (
                            <div key={pay.id} className="flex justify-between items-center py-1.5 border-t border-gray-100 first:border-t-0">
                              <div>
                                <p className="text-sm font-medium text-gray-700">{formatDate(pay.date)}</p>
                                {pay.note && <p className="text-sm text-gray-400 italic">{pay.note}</p>}
                                <p className="text-xs text-gray-400">{pay.ticketsMarked.length} ticket{pay.ticketsMarked.length > 1 ? 's' : ''} couverts</p>
                              </div>
                              <p className="text-base font-bold text-green-700">CHF {pay.amount.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                onClick={() => setFilterPayer(p as FilterPayer)}
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
            {sorted.map(ticket => {
              const isSplit = ticket.payer === PAYERS_SPLIT;
              const half = ticket.amount / 2;

              const personsToShow: string[] = isSplit
                ? filterPayer === 'all'
                  ? ['Robin', 'Malek']
                  : (filterPayer === 'Robin' || filterPayer === 'Malek') ? [filterPayer] : ['Robin', 'Malek']
                : ticket.payer ? [ticket.payer] : [];

              const allDone = isSplit
                ? !!ticket.reimbursedRobin && !!ticket.reimbursedMalek
                : !!ticket.reimbursed;

              return (
                <div
                  key={ticket.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
                    allDone ? 'border-green-400' : 'border-amber-400'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-semibold text-gray-800">{formatDate(ticket.date)}</p>
                        {isSplit && (
                          <span className="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            50/50
                          </span>
                        )}
                      </div>
                      <p className="text-base text-gray-500 mt-0.5">{ticket.category}</p>
                      {ticket.note && <p className="text-base text-gray-400 italic mt-0.5">{ticket.note}</p>}

                      <div className="mt-3 space-y-2">
                        {personsToShow.map(person => {
                          const done = isReimbursedFor(ticket, person);
                          const amt = isSplit ? half : ticket.amount;
                          return (
                            <div key={person} className="flex items-center justify-between gap-2">
                              <span className={`text-base font-medium ${done ? 'text-green-600' : 'text-amber-700'}`}>
                                {isSplit ? `${person} — CHF ${amt.toFixed(2)}` : `CHF ${amt.toFixed(2)}`}
                                {done && ' ✓'}
                              </span>
                              <button
                                onClick={() => toggleFor(ticket, person)}
                                disabled={updating === ticket.id}
                                className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition-colors disabled:opacity-50 shrink-0 ${
                                  done
                                    ? 'border-gray-300 text-gray-500 active:bg-gray-50'
                                    : 'border-green-500 text-green-700 active:bg-green-50'
                                }`}
                              >
                                {done ? 'Annuler' : '✓'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-green-700">CHF {ticket.amount.toFixed(2)}</p>
                      {isSplit && <p className="text-sm text-gray-400">{half.toFixed(2)} × 2</p>}
                    </div>
                  </div>
                  <Link
                    href={`/ticket/${ticket.id}?year=${year}`}
                    className="block mt-2 text-sm text-green-700 font-medium"
                  >
                    Voir le ticket →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
