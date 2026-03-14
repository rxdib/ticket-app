import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

export async function POST(request: NextRequest) {
  let pin: string | undefined;
  try {
    const body = await request.json();
    pin = typeof body.pin === 'string' ? body.pin : undefined;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const appPin = process.env.APP_PIN;

  if (!appPin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!pin || !timingSafeEqual(Buffer.from(pin), Buffer.from(appPin))) {
    return NextResponse.json({ error: 'PIN incorrect' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('auth', hashPin(appPin), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return response;
}
