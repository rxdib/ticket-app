'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TicketList from './components/TicketList';
import MonthFilter from './components/MonthFilter';
import type { Ticket } from '@/lib/types';
import { setPendingPhoto } from '@/lib/photoStore';
import { takeSavePromise } from '@/lib/saveStore';
import imageCompression from 'browser-image-compression';

export default function HomePage() {
  const now = new Date();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // ✅ Photo plus légère : 0.6 MB max, 1280px max (suffisant pour lire un ticket)
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });
    setPendingPhoto(compressed);
    router.push('/add');
  }

  async function fetchTickets(month: number, year: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets?month=${month}&year=${year}`);
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    }
    setLoading(false);
  }

  // Au montage : vérifier si un ticket est en cours de sauvegarde
  useEffect(() => {
    const pending = takeSavePromise();
    if (pending) {
      setSaving(true);
      setSaveError(false);
      pending
        .then(() => {
          // ✅ Recharger la liste quand la sauvegarde est terminée
          fetchTickets(selectedMonth, selectedYear);
        })
        .catch(() => {
          setSaveError(true);
        })
        .finally(() => {
          setSaving(false);
        });
    }
    fetchTickets(selectedMonth, selectedYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTickets(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  function handleFilterChange(month: number, year: number) {
    setSelectedMonth(month);
    setSelectedYear(year);
  }

  const total = tickets.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 text-white px-5 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">🧾 Mes Tickets</h1>
          <Link
            href="/remboursements"
            className="text-green-100 text-sm font-semibold bg-green-800 px-3 py-2 rounded-xl active:bg-green-900"
          >
            💵 Remboursements
          </Link>
        </div>
        <MonthFilter
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={handleFilterChange}
        />
        {!loading && tickets.length > 0 && (
          <p className="mt-3 text-green-100 text-base">
            {tickets.length} ticket{tickets.length > 1 ? 's' : ''} — Total : CHF {total.toFixed(2)}
          </p>
        )}
      </div>

      {/* Bannière d'enregistrement en cours */}
      {saving && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-3">
          <span className="text-amber-600 text-lg animate-spin">⏳</span>
          <span className="text-amber-800 font-medium">Enregistrement en cours…</span>
        </div>
      )}

      {/* Bannière d'erreur */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-center gap-3">
          <span className="text-red-600 text-lg">⚠️</span>
          <span className="text-red-800 font-medium">Erreur lors de l'enregistrement. Réessayez.</span>
        </div>
      )}

      {/* Liste */}
      <div className="px-5 py-5">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-xl">Chargement...</div>
        ) : (
          <TicketList tickets={tickets} year={selectedYear} />
        )}
      </div>

      {/* Bouton ajouter — ouvre la caméra directement */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-5">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
        />
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="w-full max-w-lg bg-green-700 text-white text-xl font-bold py-5 rounded-2xl text-center shadow-lg active:bg-green-800"
        >
          📷 Nouveau ticket
        </button>
      </div>
    </div>
  );
}
