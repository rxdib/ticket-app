import { NextRequest, NextResponse } from 'next/server';
import { readTicketsJson, getPhotoUrl } from '@/lib/dropbox';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const year = parseInt(
    new URL(request.url).searchParams.get('year') ?? String(new Date().getFullYear())
  );

  const tickets = await readTicketsJson(year);
  const ticket = tickets.find(t => t.id === id);

  if (!ticket || !ticket.photoFilename) {
    return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 });
  }

  const url = await getPhotoUrl(year, ticket.photoFilename);
  return NextResponse.json({ url });
}
