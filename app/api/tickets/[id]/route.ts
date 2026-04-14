import { NextRequest, NextResponse } from 'next/server';
import { readTicketsJson, writeTicketsJson, deletePhoto, uploadExcel } from '@/lib/dropbox';
import { generateExcel } from '@/lib/excel';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const body = await request.json() as {
    reimbursed?: boolean;
    reimbursedRobin?: boolean;
    reimbursedMalek?: boolean;
  };

  const tickets = await readTicketsJson(year);
  const idx = tickets.findIndex(t => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: 'Ticket non trouvé' }, { status: 404 });
  }

  const patch: Partial<typeof tickets[0]> = {};
  if (body.reimbursed !== undefined)       patch.reimbursed = body.reimbursed;
  if (body.reimbursedRobin !== undefined)  patch.reimbursedRobin = body.reimbursedRobin;
  if (body.reimbursedMalek !== undefined)  patch.reimbursedMalek = body.reimbursedMalek;

  tickets[idx] = { ...tickets[idx], ...patch };
  await writeTicketsJson(year, tickets);

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
