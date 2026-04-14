import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { readTicketsJson, writeTicketsJson, deletePhoto, uploadExcel } from '@/lib/dropbox';
import { generateExcel } from '@/lib/excel';
import type { Ticket } from '@/lib/types';
import { MIXED_CATEGORY } from '@/lib/constants';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const body = await request.json() as {
    // Champs remboursement
    reimbursed?: boolean;
    reimbursedRobin?: boolean;
    reimbursedMalek?: boolean;
    // Champs édition complète
    date?: string;
    amount?: number;
    amount81?: number;
    amount26?: number;
    category?: string;
    paymentMethod?: 'card' | 'cash';
    payer?: Ticket['payer'];
    note?: string;
  };

  const tickets = await readTicketsJson(year);
  const idx = tickets.findIndex(t => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: 'Ticket non trouvé' }, { status: 404 });
  }

  const patch: Partial<Ticket> = {};

  // Champs remboursement
  if (body.reimbursed !== undefined)      patch.reimbursed = body.reimbursed;
  if (body.reimbursedRobin !== undefined) patch.reimbursedRobin = body.reimbursedRobin;
  if (body.reimbursedMalek !== undefined) patch.reimbursedMalek = body.reimbursedMalek;

  // Champs édition
  const isFullEdit = body.date !== undefined || body.amount !== undefined || body.category !== undefined;

  if (isFullEdit) {
    if (body.date)     patch.date = body.date;
    if (body.category) patch.category = body.category;
    if (body.paymentMethod) patch.paymentMethod = body.paymentMethod;

    // Payer : effacer si carte
    if (body.paymentMethod === 'card') {
      patch.payer = undefined;
    } else if (body.payer !== undefined) {
      patch.payer = body.payer;
    }

    // Note : effacer si vide
    patch.note = body.note || undefined;

    // Montants
    if (body.category === MIXED_CATEGORY && body.amount81 !== undefined && body.amount26 !== undefined) {
      patch.amount81 = body.amount81;
      patch.amount26 = body.amount26;
      patch.amount = Math.round((body.amount81 + body.amount26) * 100) / 100;
    } else if (body.amount !== undefined) {
      patch.amount = body.amount;
      patch.amount81 = undefined;
      patch.amount26 = undefined;
    }
  }

  tickets[idx] = { ...tickets[idx], ...patch };
  await writeTicketsJson(year, tickets);

  // Regénérer Excel en arrière-plan si édition complète
  if (isFullEdit) {
    after(async () => {
      try {
        const excelBuffer = await generateExcel(tickets, year);
        await uploadExcel(year, excelBuffer);
      } catch (err) {
        console.error('[Excel background]', err);
      }
    });
  }

  return NextResponse.json(tickets[idx]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const tickets = await readTicketsJson(year);
  const ticket = tickets.find(t => t.id === id);

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket non trouvé' }, { status: 404 });
  }

  if (ticket.photoFilename) {
    await deletePhoto(year, ticket.photoFilename);
  }

  const updated = tickets.filter(t => t.id !== id);
  await writeTicketsJson(year, updated);

  const excelBuffer = await generateExcel(updated, year);
  await uploadExcel(year, excelBuffer);

  return NextResponse.json({ success: true });
}
