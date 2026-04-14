'use client';
import type { Ticket } from '@/lib/types';
import Link from 'next/link';

interface Props {
  tickets: Ticket[];
  year: number;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function PaymentBadge({ ticket }: { ticket: Ticket }) {
  if (!ticket.paymentMethod || ticket.paymentMethod === 'card') return null;

  if (ticket.payer === 'Robin/Malek') {
    const r = ticket.reimbursedRobin;
    const m = ticket.reimbursedMalek;
    const mark = r && m ? ' ✓✓' : r ? ' ✓R' : m ? ' ✓M' : '';
    return (
      <span className="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
        💵 50/50{mark}
      </span>
    );
  }

  return (
    <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
      💵 {ticket.payer ?? 'Cash'}
      {ticket.reimbursed && ' ✓'}
    </span>
  );
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
              <div className="mt-1">
                <PaymentBadge ticket={ticket} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-green-700">CHF {ticket.amount.toFixed(2)}</p>
              <span className="text-gray-300 text-2xl">›</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
