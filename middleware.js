import { NextResponse } from 'next/server';

// Rutas públicas que no requieren autenticación
const PUBLIC_PATHS = [
  '/login',
  '/api/login',
  '/api/change-password',
  '/favicon.ico',
  '/api/me',
];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // permitir archivos estáticos y rutas públicas
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || PUBLIC_PATHS.some(p => pathname === p) || pathname.startsWith('/public') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Leer cookie session_token
  const cookie = req.cookies.get('session_token');
  if (!cookie) {
    // no autenticado -> redirigir a /login
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirecciones: bloquear acceso a rutas base sin ID
  // Normaliza para tratar '/ruta' y '/ruta/' como equivalentes
  const trimmed = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const redirects = new Map([
    ['/solicitudes', '/gestionarsolicitudes'],
    ['/justificaciones', '/gestionarjustificaciones'],
    // Tolerancia a posible error tipográfico común
    ['/justificiacion', '/gestionarjustificaciones'],
  ]);
  if (redirects.has(trimmed)) {
    const url = new URL(redirects.get(trimmed), req.url);
    return NextResponse.redirect(url);
  }

  // Cookie presente -> permitir
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
