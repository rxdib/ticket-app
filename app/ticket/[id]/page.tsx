'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Ticket } from '@/lib/types';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = searchParams.get('year') ?? String(new Date().getFullYear());

  const [id, setId] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [reimbursing, setReimbursing] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const res = await fetch(`/api/tickets?year=${year}`);
      const tickets: Ticket[] = await res.json();
      const found = tickets.find((t) => t.id === id) ?? null;
      setTicket(found);

      if (found?.photoFilename) {
        const photoRes = await fetch(`/api/tickets/${id}/photo?year=${year}`);
        if (photoRes.ok) {
          const { url } = await photoRes.json();
          setPhotoUrl(url);
        }
      }

      setLoading(false);
    }

    load();
  }, [id, year]);

  async function handleDelete() {
    if (!confirm('Supprimer ce ticket ?')) return;

    setDeleting(true);
    setDeleteError('');

    try {
      const res = await fetch(`/api/tickets/${id}?year=${year}`, { method: 'DELETE' });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Suppression impossible');
      }

      router.push('/');
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Suppression impossible');
      setDeleting(false);
    }
  }

  async function handleReimburse() {
    if (!ticket) return;
    setReimbursing(true);
    try {
      const newValue = !ticket.reimbursed;
      const res = await fetch(`/api/tickets/${id}?year=${year}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reimbursed: newValue }),
      });
      if (res.ok) {
        const updated: Ticket = await res.json();
        setTicket(updated);
      }
    } finally {
      setReimbursing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-xl">
        Chargement...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-xl text-gray-500">Ticket introuvable</p>
        <button onClick={() => router.push('/')} className="text-green-700 text-lg font-semibold">
          Retour
        </button>
      </div>
    );
  }

  const isCash = ticket.paymentMethod === 'cash';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-white text-3xl font-light">‹</button>
        <h1 className="text-2xl font-bold">Détail du ticket</h1>
      </div>

      <div className="px-5 py-5 space-y-5">
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Photo du ticket"
            className="w-full rounded-2xl shadow-sm max-h-80 object-cover"
          />
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Date</p>
            <p className="text-2xl font-semibold text-gray-800">{formatDate(ticket.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Montant</p>
            <p className="text-2xl font-bold text-green-700">CHF {ticket.amount.toFixed(2)}</p>
            {ticket.amount81 !== undefined && ticket.amount26 !== undefined && (
              <div className="mt-1 space-y-0.5">
                <p className="text-base text-gray-500">TVA 8.1% : CHF {ticket.amount81.toFixed(2)}</p>
                <p className="text-base text-gray-500">TVA 2.6% : CHF {ticket.amount26.toFixed(2)}</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Catégorie</p>
            <p className="text-2xl font-semibold text-gray-800">{ticket.category}</p>
          </div>

          {/* Paiement */}
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Paiement</p>
            <p className="text-xl font-semibold text-gray-800">
              {isCash ? `💵 Cash${ticket.payer ? ` — ${ticket.payer}` : ''}` : '💳 Carte'}
            </p>
          </div>

          {/* Remboursement — uniquement si cash */}
          {isCash && (
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Remboursement</p>
              <p className={`text-xl font-semibold ${ticket.reimbursed ? 'text-green-600' : 'text-amber-600'}`}>
                {ticket.reimbursed ? '✓ Remboursé' : 'En attente'}
              </p>
            </div>
          )}

          {/* Note */}
          {ticket.note && (
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Note</p>
              <p className="text-xl text-gray-800">{ticket.note}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Fichier</p>
            <p className="text-base text-gray-600 font-mono">{ticket.photoFilename || '—'}</p>
          </div>
        </div>

        {/* Bouton remboursement */}
        {isCash && (
          <button
            onClick={handleReimburse}
            disabled={reimbursing}
            className={`w-full py-4 rounded-2xl border-2 text-lg font-semibold transition-colors disabled:opacity-50 ${
              ticket.reimbursed
                ? 'border-gray-300 text-gray-500 active:bg-gray-50'
                : 'border-green-500 text-green-700 active:bg-green-50'
            }`}
          >
            {reimbursing
              ? 'Mise à jour...'
              : ticket.reimbursed
              ? 'Marquer non remboursé'
              : '✓ Marquer comme remboursé'}
          </button>
        )}

        {deleteError && (
          <p className="text-red-600 text-base bg-red-50 p-3 rounded-xl">{deleteError}</p>
        )}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full py-4 rounded-2xl border-2 border-red-300 text-red-600 text-lg font-semibold active:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : 'Supprimer ce ticket'}
        </button>
      </div>
    </div>
  );
}
