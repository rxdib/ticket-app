# Ticket App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PWA Next.js permettant de photographier des tickets de caisse, les stocker dans Dropbox avec un fichier Excel annuel pour le comptable.

**Architecture:** API Routes Next.js qui lisent/écrivent dans Dropbox via SDK. Les métadonnées sont dans un fichier `tickets.json` dans Dropbox. L'Excel annuel est régénéré à chaque modification depuis `tickets.json`. Les photos sont compressées côté client avant upload pour rester sous la limite Vercel de 4.5MB.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `dropbox` SDK, `exceljs`, `browser-image-compression`

---

## Structure du projet

```
/c/Ticket/
  app/
    layout.tsx
    page.tsx                    ← liste des tickets
    add/page.tsx                ← ajouter un ticket
    ticket/[id]/page.tsx        ← détail d'un ticket
    api/
      tickets/route.ts          ← GET (liste) + POST (créer)
      tickets/[id]/route.ts     ← DELETE (supprimer)
  lib/
    dropbox.ts                  ← client Dropbox
    excel.ts                    ← génération Excel avec exceljs
    types.ts                    ← types TypeScript
    constants.ts                ← catégories, mois FR
  public/
    manifest.json
    icon-192.png
    icon-512.png
  next.config.ts
  tailwind.config.ts
  package.json
```

## Structure Dropbox

```
Dropbox/Tickets/
  2026/
    tickets.json       ← [{id, date, amount, category, photoFilename, createdAt}]
    2026.xlsx          ← régénéré à chaque ajout/suppression
    photos/
      2026-03-05_a1b2c3.jpg
```

---

### Task 1 : Initialisation du projet Next.js

**Files:**
- Create: `package.json` (via commande)
- Create: `next.config.ts`
- Create: `tailwind.config.ts`

**Step 1: Initialiser le projet**

```bash
cd /c/Ticket
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --yes
```

**Step 2: Installer les dépendances**

```bash
npm install dropbox exceljs browser-image-compression
```

**Step 3: Vérifier que le projet démarre**

```bash
npm run dev
```
Attendu : serveur sur http://localhost:3000

**Step 4: Supprimer le contenu par défaut**

Vider `app/page.tsx` et `app/globals.css` (garder seulement les imports Tailwind dans globals.css).

**Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 2 : Types, constantes et variables d'environnement

**Files:**
- Create: `lib/types.ts`
- Create: `lib/constants.ts`
- Create: `.env.local` (ne jamais committer)
- Create: `.env.example`

**Step 1: Créer les types**

`lib/types.ts`:
```typescript
export interface Ticket {
  id: string;
  date: string;           // format YYYY-MM-DD
  amount: number;         // en CHF
  category: string;       // une des 6 catégories
  photoFilename: string;  // ex: "2026-03-05_a1b2c3.jpg"
  createdAt: string;      // ISO timestamp
}
```

**Step 2: Créer les constantes**

`lib/constants.ts`:
```typescript
export const CATEGORIES = [
  'Repas 8.1%',
  'Repas 2.6%',
  'Repas mixte (8.1%+2.6%)',
  'Frais de représentation',
  'Frais de déplacements',
  'Frais de bureau',
] as const;

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const DROPBOX_BASE_PATH = '/Tickets';
```

**Step 3: Créer le fichier .env.example**

`.env.example`:
```
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_REFRESH_TOKEN=your_refresh_token
```

**Step 4: Créer .env.local avec les vraies valeurs**

`.env.local` (à remplir manuellement — voir guide Dropbox en Task 11):
```
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REFRESH_TOKEN=
```

**Step 5: Ajouter .env.local au .gitignore**

Vérifier que `.env.local` est dans `.gitignore` (Next.js l'ajoute par défaut).

**Step 6: Commit**

```bash
git add lib/types.ts lib/constants.ts .env.example .gitignore
git commit -m "feat: add types, constants and env config"
```

---

### Task 3 : Client Dropbox

**Files:**
- Create: `lib/dropbox.ts`

**Step 1: Créer le client Dropbox**

`lib/dropbox.ts`:
```typescript
import { Dropbox } from 'dropbox';

function getDropboxClient(): Dropbox {
  const dbx = new Dropbox({
    clientId: process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
  });
  return dbx;
}

function getYearPath(year: number): string {
  return `/Tickets/${year}`;
}

export async function readTicketsJson(year: number): Promise<import('./types').Ticket[]> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/tickets.json`;
  try {
    const response = await dbx.filesDownload({ path }) as any;
    const buffer = Buffer.from(await response.result.fileBlob.arrayBuffer());
    return JSON.parse(buffer.toString('utf-8'));
  } catch (err: any) {
    // Fichier n'existe pas encore
    if (err?.status === 409) return [];
    throw err;
  }
}

export async function writeTicketsJson(year: number, tickets: import('./types').Ticket[]): Promise<void> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/tickets.json`;
  const content = JSON.stringify(tickets, null, 2);
  await dbx.filesUpload({
    path,
    contents: content,
    mode: { '.tag': 'overwrite' },
  });
}

export async function uploadPhoto(year: number, filename: string, buffer: Buffer): Promise<void> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/photos/${filename}`;
  await dbx.filesUpload({
    path,
    contents: buffer,
    mode: { '.tag': 'overwrite' },
  });
}

export async function deletePhoto(year: number, filename: string): Promise<void> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/photos/${filename}`;
  try {
    await dbx.filesDeleteV2({ path });
  } catch {
    // Ignorer si le fichier n'existe pas
  }
}

export async function getPhotoUrl(year: number, filename: string): Promise<string> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/photos/${filename}`;
  const response = await dbx.filesGetTemporaryLink({ path });
  return response.result.link;
}

export async function uploadExcel(year: number, buffer: Buffer): Promise<void> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/${year}.xlsx`;
  await dbx.filesUpload({
    path,
    contents: buffer,
    mode: { '.tag': 'overwrite' },
  });
}
```

**Step 2: Commit**

```bash
git add lib/dropbox.ts
git commit -m "feat: add Dropbox client utility"
```

---

### Task 4 : Utilitaire Excel

**Files:**
- Create: `lib/excel.ts`

**Step 1: Créer le générateur Excel**

`lib/excel.ts`:
```typescript
import ExcelJS from 'exceljs';
import { Ticket } from './types';
import { MONTHS_FR } from './constants';

export async function generateExcel(tickets: Ticket[], year: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ticket App';
  workbook.created = new Date();

  // Grouper les tickets par mois
  const byMonth: Record<number, Ticket[]> = {};
  for (const ticket of tickets) {
    const month = new Date(ticket.date).getMonth(); // 0-11
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(ticket);
  }

  // Créer une feuille par mois (dans l'ordre)
  for (let m = 0; m < 12; m++) {
    const monthTickets = byMonth[m] || [];
    if (monthTickets.length === 0) continue;

    const sheet = workbook.addWorksheet(MONTHS_FR[m]);

    // En-têtes
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Montant (CHF)', key: 'amount', width: 16 },
      { header: 'Catégorie', key: 'category', width: 35 },
      { header: 'Fichier photo', key: 'photoFilename', width: 30 },
    ];

    // Style en-têtes
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3E4CD' },
    };

    // Trier par date croissante
    const sorted = [...monthTickets].sort((a, b) => a.date.localeCompare(b.date));

    for (const ticket of sorted) {
      const [y, mo, d] = ticket.date.split('-');
      sheet.addRow({
        date: `${d}.${mo}.${y}`,
        amount: ticket.amount,
        category: ticket.category,
        photoFilename: ticket.photoFilename,
      });
    }

    // Format montant
    sheet.getColumn('amount').numFmt = '#,##0.00';
  }

  if (workbook.worksheets.length === 0) {
    workbook.addWorksheet('Vide');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

**Step 2: Commit**

```bash
git add lib/excel.ts
git commit -m "feat: add Excel generation utility"
```

---

### Task 5 : API Route — GET et POST /api/tickets

**Files:**
- Create: `app/api/tickets/route.ts`

**Step 1: Créer la route**

`app/api/tickets/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readTicketsJson, writeTicketsJson, uploadPhoto, uploadExcel } from '@/lib/dropbox';
import { generateExcel } from '@/lib/excel';
import { Ticket } from '@/lib/types';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year') ?? String(new Date().getFullYear());
  const monthParam = searchParams.get('month'); // "0"-"11" ou null

  const year = parseInt(yearParam);
  const tickets = await readTicketsJson(year);

  let filtered = tickets;
  if (monthParam !== null) {
    const month = parseInt(monthParam);
    filtered = tickets.filter(t => new Date(t.date).getMonth() === month);
  }

  // Trier par date décroissante pour l'affichage
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const date = formData.get('date') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const category = formData.get('category') as string;
  const photoFile = formData.get('photo') as File | null;

  if (!date || isNaN(amount) || !category) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const year = new Date(date).getFullYear();
  const uniqueId = randomBytes(4).toString('hex');
  const photoFilename = photoFile ? `${date}_${uniqueId}.jpg` : '';

  // Upload photo si présente
  if (photoFile && photoFilename) {
    const arrayBuffer = await photoFile.arrayBuffer();
    await uploadPhoto(year, photoFilename, Buffer.from(arrayBuffer));
  }

  const ticket: Ticket = {
    id: `${date}_${uniqueId}`,
    date,
    amount,
    category,
    photoFilename,
    createdAt: new Date().toISOString(),
  };

  // Mettre à jour tickets.json
  const tickets = await readTicketsJson(year);
  tickets.push(ticket);
  await writeTicketsJson(year, tickets);

  // Régénérer Excel
  const excelBuffer = await generateExcel(tickets, year);
  await uploadExcel(year, excelBuffer);

  return NextResponse.json(ticket, { status: 201 });
}
```

**Step 2: Commit**

```bash
git add app/api/tickets/route.ts
git commit -m "feat: add GET and POST /api/tickets route"
```

---

### Task 6 : API Route — DELETE /api/tickets/[id]

**Files:**
- Create: `app/api/tickets/[id]/route.ts`

**Step 1: Créer la route DELETE**

`app/api/tickets/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readTicketsJson, writeTicketsJson, deletePhoto, uploadExcel } from '@/lib/dropbox';
import { generateExcel } from '@/lib/excel';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const tickets = await readTicketsJson(year);
  const ticket = tickets.find(t => t.id === id);

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket non trouvé' }, { status: 404 });
  }

  // Supprimer la photo
  if (ticket.photoFilename) {
    await deletePhoto(year, ticket.photoFilename);
  }

  // Mettre à jour tickets.json
  const updated = tickets.filter(t => t.id !== id);
  await writeTicketsJson(year, updated);

  // Régénérer Excel
  const excelBuffer = await generateExcel(updated, year);
  await uploadExcel(year, excelBuffer);

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/tickets/[id]/route.ts
git commit -m "feat: add DELETE /api/tickets/[id] route"
```

---

### Task 7 : API Route — GET photo temporaire

**Files:**
- Create: `app/api/tickets/[id]/photo/route.ts`

**Step 1: Créer la route pour récupérer une URL de photo temporaire**

`app/api/tickets/[id]/photo/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readTicketsJson, getPhotoUrl } from '@/lib/dropbox';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const year = parseInt(new URL(request.url).searchParams.get('year') ?? String(new Date().getFullYear()));
  const tickets = await readTicketsJson(year);
  const ticket = tickets.find(t => t.id === params.id);

  if (!ticket || !ticket.photoFilename) {
    return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 });
  }

  const url = await getPhotoUrl(year, ticket.photoFilename);
  return NextResponse.json({ url });
}
```

**Step 2: Commit**

```bash
git add app/api/tickets/[id]/photo/route.ts
git commit -m "feat: add photo URL API route"
```

---

### Task 8 : Layout principal et configuration PWA

**Files:**
- Create: `public/manifest.json`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Step 1: Créer le manifest PWA**

`public/manifest.json`:
```json
{
  "name": "Mes Tickets",
  "short_name": "Tickets",
  "description": "Gestion de tickets pour la comptabilité",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 2: Générer des icônes simples**

Créer deux images PNG simples (192x192 et 512x512) avec un fond vert et le texte "T".
Utiliser ce script Node.js une seule fois (ne pas committer le script) :

```bash
# Utiliser sharp ou canvas pour générer les icônes
# Alternative simple : copier des icônes placeholder depuis le web
# ou utiliser https://realfavicongenerator.net/
```

Pour l'instant, créer des fichiers PNG vides placeholder :
```bash
# Télécharger des icônes placeholder
curl -o public/icon-192.png "https://via.placeholder.com/192/16a34a/ffffff?text=T"
curl -o public/icon-512.png "https://via.placeholder.com/512/16a34a/ffffff?text=T"
```

**Step 3: Mettre à jour app/layout.tsx**

`app/layout.tsx`:
```typescript
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mes Tickets',
  description: 'Gestion de tickets pour la comptabilité',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mes Tickets',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <div className="max-w-lg mx-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png app/layout.tsx app/globals.css
git commit -m "feat: add PWA manifest and layout"
```

---

### Task 9 : Page d'accueil — Liste des tickets

**Files:**
- Create: `app/page.tsx`
- Create: `app/components/TicketList.tsx`
- Create: `app/components/MonthFilter.tsx`

**Step 1: Créer le composant MonthFilter**

`app/components/MonthFilter.tsx`:
```typescript
'use client';
import { MONTHS_FR } from '@/lib/constants';

interface Props {
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
}

export default function MonthFilter({ selectedMonth, selectedYear, onChange }: Props) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  return (
    <div className="flex gap-3 items-center">
      <select
        className="flex-1 text-lg p-3 rounded-xl border-2 border-gray-200 bg-white font-medium"
        value={selectedMonth}
        onChange={e => onChange(parseInt(e.target.value), selectedYear)}
      >
        {MONTHS_FR.map((m, i) => (
          <option key={i} value={i}>{m}</option>
        ))}
      </select>
      <select
        className="text-lg p-3 rounded-xl border-2 border-gray-200 bg-white font-medium"
        value={selectedYear}
        onChange={e => onChange(selectedMonth, parseInt(e.target.value))}
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Créer le composant TicketList**

`app/components/TicketList.tsx`:
```typescript
'use client';
import { Ticket } from '@/lib/types';
import Link from 'next/link';

interface Props {
  tickets: Ticket[];
  year: number;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2).replace('.', '.');
}

export default function TicketList({ tickets, year }: Props) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-xl">Aucun ticket ce mois-ci</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tickets.map(ticket => (
        <li key={ticket.id}>
          <Link
            href={`/ticket/${ticket.id}?year=${year}`}
            className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50"
          >
            <div>
              <p className="text-xl font-semibold text-gray-800">{formatDate(ticket.date)}</p>
              <p className="text-base text-gray-500 mt-0.5">{ticket.category}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-green-700">CHF {formatAmount(ticket.amount)}</p>
              <span className="text-gray-300 text-2xl">›</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**Step 3: Créer la page d'accueil**

`app/page.tsx`:
```typescript
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import TicketList from './components/TicketList';
import MonthFilter from './components/MonthFilter';
import { Ticket } from '@/lib/types';

export default function HomePage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

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

      {/* Bouton ajouter */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-5">
        <Link
          href="/add"
          className="w-full max-w-lg bg-green-700 text-white text-xl font-bold py-5 rounded-2xl text-center shadow-lg active:bg-green-800"
        >
          + Ajouter un ticket
        </Link>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add app/page.tsx app/components/
git commit -m "feat: add home page with ticket list and month filter"
```

---

### Task 10 : Page d'ajout de ticket

**Files:**
- Create: `app/add/page.tsx`

**Step 1: Créer la page d'ajout**

`app/add/page.tsx`:
```typescript
'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/constants';
import imageCompression from 'browser-image-compression';

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AddPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayString());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compresser l'image avant upload (max 1920px, qualité 80%)
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });

    setPhoto(compressed);
    setPhotoPreview(URL.createObjectURL(compressed));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Veuillez entrer un montant valide.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('date', date);
    formData.append('amount', amount);
    formData.append('category', category);
    if (photo) formData.append('photo', photo, 'photo.jpg');

    const res = await fetch('/api/tickets', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      setError('Erreur lors de l\'enregistrement. Réessayez.');
      setLoading(false);
      return;
    }

    router.push('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 text-white px-5 pt-12 pb-5 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-white text-3xl font-light"
        >
          ‹
        </button>
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
              <img
                src={photoPreview}
                alt="Photo du ticket"
                className="w-full rounded-2xl object-cover max-h-64"
              />
              <div className="absolute bottom-3 right-3 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                Changer
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 rounded-2xl border-3 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-2 text-gray-400 active:bg-gray-50"
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

        {/* Montant */}
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

        {/* Catégorie */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Catégorie</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full text-lg p-4 rounded-2xl border-2 border-gray-200 bg-white"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-red-600 text-base bg-red-50 p-3 rounded-xl">{error}</p>
        )}
      </form>

      {/* Bouton enregistrer fixe en bas */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-5">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full max-w-lg bg-green-700 text-white text-xl font-bold py-5 rounded-2xl shadow-lg active:bg-green-800 disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/add/page.tsx
git commit -m "feat: add ticket creation page with photo capture and compression"
```

---

### Task 11 : Page de détail d'un ticket

**Files:**
- Create: `app/ticket/[id]/page.tsx`

**Step 1: Créer la page de détail**

`app/ticket/[id]/page.tsx`:
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ticket } from '@/lib/types';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = searchParams.get('year') ?? String(new Date().getFullYear());

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      // Charger le ticket depuis la liste
      const res = await fetch(`/api/tickets?year=${year}`);
      const tickets: Ticket[] = await res.json();
      const found = tickets.find(t => t.id === params.id);
      setTicket(found ?? null);

      // Charger l'URL de la photo
      if (found?.photoFilename) {
        const photoRes = await fetch(`/api/tickets/${params.id}/photo?year=${year}`);
        if (photoRes.ok) {
          const { url } = await photoRes.json();
          setPhotoUrl(url);
        }
      }

      setLoading(false);
    }
    load();
  }, [params.id, year]);

  async function handleDelete() {
    if (!confirm('Supprimer ce ticket ?')) return;
    setDeleting(true);
    await fetch(`/api/tickets/${params.id}?year=${year}`, { method: 'DELETE' });
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
```

**Step 2: Commit**

```bash
git add app/ticket/
git commit -m "feat: add ticket detail page with photo display and delete"
```

---

### Task 12 : Configuration Dropbox et déploiement Vercel

**Files:**
- Aucun fichier à créer — configuration via interfaces web

**Step 1: Créer une app Dropbox**

1. Aller sur https://www.dropbox.com/developers/apps
2. Cliquer "Create app"
3. Choisir : "Scoped access" → "Full Dropbox" → Nommer l'app "TicketApp"
4. Dans l'onglet "Settings" → noter `App key` et `App secret`
5. Dans l'onglet "Permissions" → cocher : `files.content.read`, `files.content.write`
6. Cliquer "Submit" pour sauvegarder les permissions

**Step 2: Obtenir le refresh token**

Exécuter ce script Node.js en local (une seule fois) pour obtenir le refresh token :

```bash
node -e "
const key = 'VOTRE_APP_KEY';
const secret = 'VOTRE_APP_SECRET';
console.log('Allez sur cette URL :');
console.log(\`https://www.dropbox.com/oauth2/authorize?client_id=\${key}&response_type=code&token_access_type=offline\`);
"
```

Après autorisation, Dropbox donne un `code`. Ensuite :

```bash
curl -X POST https://api.dropboxapi.com/oauth2/token \
  -u "VOTRE_APP_KEY:VOTRE_APP_SECRET" \
  -d "code=VOTRE_CODE&grant_type=authorization_code"
```

Récupérer `refresh_token` dans la réponse JSON.

**Step 3: Remplir .env.local**

```
DROPBOX_APP_KEY=votre_app_key
DROPBOX_APP_SECRET=votre_app_secret
DROPBOX_REFRESH_TOKEN=votre_refresh_token
```

**Step 4: Tester en local**

```bash
npm run dev
```

Tester : ajouter un ticket, vérifier que la photo et le fichier tickets.json apparaissent dans Dropbox.

**Step 5: Déployer sur Vercel**

1. Pousser le code sur GitHub :
```bash
git remote add origin https://github.com/VOTRE_COMPTE/ticket-app.git
git push -u origin main
```

2. Aller sur https://vercel.com → "New Project" → Importer le repo GitHub
3. Dans "Environment Variables", ajouter les 3 variables Dropbox
4. Cliquer "Deploy"

**Step 6: Installer sur iPhone**

1. Ouvrir l'URL Vercel dans Safari sur l'iPhone
2. Taper l'icône "Partager" (carré avec flèche)
3. "Ajouter à l'écran d'accueil"
4. Répéter sur le deuxième iPhone

**Step 7: Commit final**

```bash
git add .
git commit -m "chore: add deployment documentation"
```

---

## Résumé

| Task | Description |
|------|-------------|
| 1 | Init Next.js + dépendances |
| 2 | Types, constantes, env |
| 3 | Client Dropbox |
| 4 | Utilitaire Excel |
| 5 | API GET + POST tickets |
| 6 | API DELETE ticket |
| 7 | API URL photo temporaire |
| 8 | Layout + PWA manifest |
| 9 | Page liste (accueil) |
| 10 | Page ajout ticket |
| 11 | Page détail ticket |
| 12 | Config Dropbox + déploiement Vercel |
