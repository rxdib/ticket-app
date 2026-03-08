import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { readTicketsJson, writeTicketsJson, uploadPhoto, uploadExcel } from '@/lib/dropbox';
import { generateExcel } from '@/lib/excel';
import type { Ticket } from '@/lib/types';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year') ?? String(new Date().getFullYear());
    const monthParam = searchParams.get('month');

    const year = parseInt(yearParam);
    const tickets = await readTicketsJson(year);

    let filtered = tickets;
    if (monthParam !== null) {
      const month = parseInt(monthParam);
      filtered = tickets.filter(t => new Date(t.date).getMonth() === month);
    }

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json(filtered);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[GET /api/tickets]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  // Préparer le buffer photo avant les appels parallèles
  const photoBuffer = photoFile ? Buffer.from(await photoFile.arrayBuffer()) : null;

  // ✅ Lancer l'upload photo ET la lecture du JSON en parallèle
  const [, tickets] = await Promise.all([
    photoBuffer && photoFilename
      ? uploadPhoto(year, photoFilename, photoBuffer)
      : Promise.resolve(),
    readTicketsJson(year),
  ]);

  const ticket: Ticket = {
    id: `${date}_${uniqueId}`,
    date,
    amount,
    category,
    photoFilename,
    createdAt: new Date().toISOString(),
  };

  tickets.push(ticket);
  await writeTicketsJson(year, tickets);

  // ✅ Générer et uploader l'Excel EN ARRIÈRE-PLAN (après la réponse)
  after(async () => {
    try {
      const excelBuffer = await generateExcel(tickets, year);
      await uploadExcel(year, excelBuffer);
    } catch (err) {
      console.error('[Excel background]', err);
    }
  });

  return NextResponse.json(ticket, { status: 201 });
}
