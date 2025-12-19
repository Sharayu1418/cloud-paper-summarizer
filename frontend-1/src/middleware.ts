import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware disabled for now - authentication is optional
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
