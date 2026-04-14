import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  readTicketsJson,
  writeTicketsJson,
  readPaymentsJson,
  writePaymentsJson,
} from '@/lib/dropbox';
import type { Payment, Ticket } from '@/lib/types';

export async function GET(request: NextRequest) {
  const year = parseInt(
    new URL(request.url).searchParams.get('year') ?? String(new Date().getFullYear())
  );
  const payments = await readPaymentsJson(year);
  payments.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json(payments);
}

export async function POST(request: NextRequest) {
  const year = parseInt(
    new URL(request.url).searchParams.get('year') ?? String(new Date().getFullYear())
  );
  const body = await request.json() as {
    recipient: string;
    amount: number;
    date?: string;
    note?: string;
  };

  const { recipient, amount, note } = body;
  const date = body.date ?? new Date().toISOString().split('T')[0];

  if (!recipient || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Champs invalides' }, { status: 400 });
  }

  // Charger les tickets et identifier ceux en attente pour ce destinataire
  const tickets = await readTicketsJson(year);

  const pending = tickets.filter(t => {
    if (t.paymentMethod !== 'cash') return false;
    if (t.payer === recipient) return !t.reimbursed;
    if (t.payer === 'Robin/Malek' && (recipient === 'Robin' || recipient === 'Malek')) {
      return recipient === 'Robin' ? !t.reimbursedRobin : !t.reimbursedMalek;
    }
    return false;
  });

  // Trier du plus ancien au plus récent
  pending.sort((a, b) => a.date.localeCompare(b.date));

  // Marquer les tickets jusqu'à épuiser le montant
  let remaining = Math.round(amount * 100);
  const ticketsMarked: string[] = [];

  for (const ticket of pending) {
    const ticketCents = Math.round(
      (ticket.payer === 'Robin/Malek' ? ticket.amount / 2 : ticket.amount) * 100
    );

    if (remaining >= ticketCents) {
      const idx = tickets.findIndex(t => t.id === ticket.id);
      if (idx !== -1) {
        if (ticket.payer === 'Robin/Malek') {
          if (recipient === 'Robin') tickets[idx] = { ...tickets[idx], reimbursedRobin: true };
          else                       tickets[idx] = { ...tickets[idx], reimbursedMalek: true };
        } else {
          tickets[idx] = { ...tickets[idx], reimbursed: true };
        }
        remaining -= ticketCents;
        ticketsMarked.push(ticket.id);
      }
    }
  }

  // Construire l'enregistrement de versement
  const payment: Payment = {
    id: randomBytes(4).toString('hex'),
    date,
    recipient,
    amount,
    ticketsMarked,
    createdAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };

  // Sauvegarder tickets + versement en parallèle
  const payments = await readPaymentsJson(year);
  payments.push(payment);

  await Promise.all([
    writeTicketsJson(year, tickets),
    writePaymentsJson(year, payments),
  ]);

  return NextResponse.json({
    payment,
    ticketsMarked: ticketsMarked.length,
    amountUsed: (amount * 100 - remaining) / 100,
    amountExcess: remaining / 100,
  }, { status: 201 });
}
