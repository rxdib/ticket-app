import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

export async function POST(request: NextRequest) {
  const { pin } = await request.json();
  const appPin = process.env.APP_PIN;

  if (!appPin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (pin !== appPin) {
    return NextResponse.json({ error: 'PIN incorrect' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('auth', hashPin(appPin), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });
  return response;
}
