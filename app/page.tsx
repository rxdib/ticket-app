'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TicketList from './components/TicketList';
import MonthFilter from './components/MonthFilter';
import type { Ticket } from '@/lib/types';
import { setPendingPhoto } from '@/lib/photoStore';
import imageCompression from 'browser-image-compression';

export default function HomePage() {
  const now = new Date();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });
    setPendingPhoto(compressed);
    router.push('/add');
  }

  async function fetchTickets(month: number, year: number) {
    setLoading(true);
    const res = await fetch(`/api/tickets?month=${month}&year=${year}`);
    const data = await res.json();
    setTickets(data);
    setLoading(false);
  }

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
        <h1 className="text-3xl font-bold mb-4">🧾 Mes Tickets</h1>
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
