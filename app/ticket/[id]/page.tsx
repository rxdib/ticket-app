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

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const res = await fetch(`/api/tickets?year=${year}`);
      const tickets: Ticket[] = await res.json();
      const found = tickets.find(t => t.id === id) ?? null;
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
    await fetch(`/api/tickets/${id}?year=${year}`, { method: 'DELETE' });
    router.push('/');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-white text-3xl font-light">‹</button>
        <h1 className="text-2xl font-bold">Détail du ticket</h1>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Photo */}
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Photo du ticket"
            className="w-full rounded-2xl shadow-sm max-h-80 object-cover"
          />
        )}

        {/* Infos */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Date</p>
            <p className="text-2xl font-semibold text-gray-800">{formatDate(ticket.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Montant</p>
            <p className="text-2xl font-bold text-green-700">CHF {ticket.amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Catégorie</p>
            <p className="text-2xl font-semibold text-gray-800">{ticket.category}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Fichier</p>
            <p className="text-base text-gray-600 font-mono">{ticket.photoFilename || '—'}</p>
          </div>
        </div>

        {/* Bouton supprimer */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full py-4 rounded-2xl border-2 border-red-300 text-red-600 text-lg font-semibold active:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : '🗑 Supprimer ce ticket'}
        </button>
      </div>
    </div>
  );
}
