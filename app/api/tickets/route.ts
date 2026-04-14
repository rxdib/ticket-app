import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { readTicketsJson, writeTicketsJson, uploadPhoto, uploadExcel } from '@/lib/dropbox';
import { generateExcel } from '@/lib/excel';
import type { Ticket } from '@/lib/types';
import { buildPhotoFilename } from '@/lib/storagePaths';
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
      filtered = tickets.filter((t) => new Date(t.date).getMonth() === month);
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
  const category = formData.get('category') as string;
  const photoFile = formData.get('photo') as File | null;
  const paymentMethod = (formData.get('paymentMethod') as string | null) ?? 'card';
  const payer = formData.get('payer') as string | null;
  const note = formData.get('note') as string | null;

  if (!date || !category) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  // Montants : soit un montant simple, soit deux montants pour repas mixte
  const raw81 = formData.get('amount81');
  const raw26 = formData.get('amount26');
  const rawAmount = formData.get('amount');

  let amount: number;
  let amount81: number | undefined;
  let amount26: number | undefined;

  if (raw81 !== null && raw26 !== null) {
    amount81 = parseFloat(raw81 as string);
    amount26 = parseFloat(raw26 as string);
    if (isNaN(amount81) || isNaN(amount26) || amount81 <= 0 || amount26 <= 0) {
      return NextResponse.json({ error: 'Montants invalides' }, { status: 400 });
    }
    amount = Math.round((amount81 + amount26) * 100) / 100;
  } else {
    amount = parseFloat(rawAmount as string);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }
  }

  const year = new Date(date).getFullYear();
  const uniqueId = randomBytes(4).toString('hex');

  const [tickets, photoArrayBuffer] = await Promise.all([
    readTicketsJson(year),
    photoFile ? photoFile.arrayBuffer() : Promise.resolve(null),
  ]);

  const existingPhotoFilenames = tickets
    .map((ticket) => ticket.photoFilename)
    .filter((filename): filename is string => Boolean(filename));

  const photoFilename = photoArrayBuffer
    ? buildPhotoFilename(date, amount, existingPhotoFilenames)
    : '';

  if (photoArrayBuffer && photoFilename) {
    await uploadPhoto(year, photoFilename, Buffer.from(photoArrayBuffer));
  }

  const ticket: Ticket = {
    id: `${date}_${uniqueId}`,
    date,
    amount,
    ...(amount81 !== undefined && amount26 !== undefined ? { amount81, amount26 } : {}),
    category,
    photoFilename,
    createdAt: new Date().toISOString(),
    paymentMethod: (paymentMethod === 'cash' ? 'cash' : 'card'),
    ...(paymentMethod === 'cash' && payer ? { payer: payer as Ticket['payer'] } : {}),
    ...(note ? { note } : {}),
  };

  tickets.push(ticket);
  await writeTicketsJson(year, tickets);

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
