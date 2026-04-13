'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, MIXED_CATEGORY } from '@/lib/constants';
import imageCompression from 'browser-image-compression';
import { getPendingPhoto, clearPendingPhoto } from '@/lib/photoStore';
import { setSavePromise } from '@/lib/saveStore';

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AddPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayString());
  const [amount, setAmount] = useState('');
  const [amount81, setAmount81] = useState('');
  const [amount26, setAmount26] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMixed = category === MIXED_CATEGORY;

  // Récupérer la photo prise depuis la home page
  useEffect(() => {
    const pending = getPendingPhoto();
    if (pending) {
      setPhoto(pending);
      setPhotoPreview(URL.createObjectURL(pending));
      clearPendingPhoto();
    }
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });
    setPhoto(compressed);
    setPhotoPreview(URL.createObjectURL(compressed));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isMixed) {
      const v81 = parseFloat(amount81);
      const v26 = parseFloat(amount26);
      if (!amount81 || isNaN(v81) || v81 <= 0 || !amount26 || isNaN(v26) || v26 <= 0) {
        setError('Veuillez entrer les deux montants.');
        return;
      }
    } else {
      if (!amount || parseFloat(amount) <= 0) {
        setError('Veuillez entrer un montant valide.');
        return;
      }
    }

    setError('');

    const formData = new FormData();
    formData.append('date', date);
    formData.append('category', category);
    if (photo) formData.append('photo', photo, 'photo.jpg');

    if (isMixed) {
      formData.append('amount81', amount81);
      formData.append('amount26', amount26);
    } else {
      formData.append('amount', amount);
    }

    const saveP = fetch('/api/tickets', {
      method: 'POST',
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Erreur serveur');
      }
    });

    setSavePromise(saveP);
    router.push('/');
  }

  // Calcul du total affiché pour repas mixte
  const mixedTotal = isMixed
    ? (parseFloat(amount81) || 0) + (parseFloat(amount26) || 0)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-white text-3xl font-light">‹</button>
        <h1 className="text-2xl font-bold">Nouveau ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5 pb-32">
        {/* Photo */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Photo du ticket</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
          {photoPreview ? (
            <div className="relative" onClick={() => fileInputRef.current?.click()}>
              <img src={photoPreview} alt="Photo du ticket" className="w-full rounded-2xl object-cover max-h-64" />
              <div className="absolute bottom-3 right-3 bg-black/50 text-white text-sm px-3 py-1 rounded-full">Changer</div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-2 text-gray-400 active:bg-gray-50"
            >
              <span className="text-5xl">📷</span>
              <span className="text-lg">Prendre une photo</span>
            </button>
          )}
        </div>

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

        {/* Catégorie — placée avant le montant pour que les champs changent selon la sélection */}
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

        {/* Montant — simple ou double selon la catégorie */}
        {isMixed ? (
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-700">Montants (CHF)</label>

            <div className="flex items-center gap-3">
              <span className="text-base text-gray-500 w-16 shrink-0">TVA 8.1%</span>
              <input
                type="number"
                step="0.05"
                min="0"
                placeholder="0.00"
                value={amount81}
                onChange={e => setAmount81(e.target.value)}
                className="flex-1 text-xl p-4 rounded-2xl border-2 border-gray-200 bg-white font-semibold"
                inputMode="decimal"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-base text-gray-500 w-16 shrink-0">TVA 2.6%</span>
              <input
                type="number"
                step="0.05"
                min="0"
                placeholder="0.00"
                value={amount26}
                onChange={e => setAmount26(e.target.value)}
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
              type="number"
              step="0.05"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full text-xl p-4 rounded-2xl border-2 border-gray-200 bg-white font-semibold"
              required
              inputMode="decimal"
            />
          </div>
        )}

        {error && (
          <p className="text-red-600 text-base bg-red-50 p-3 rounded-xl">{error}</p>
        )}
      </form>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-5">
        <button
          onClick={handleSubmit}
          className="w-full max-w-lg bg-green-700 text-white text-xl font-bold py-5 rounded-2xl shadow-lg active:bg-green-800"
        >
          ✓ Enregistrer
        </button>
      </div>
    </div>
  );
}
