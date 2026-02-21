import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/services/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const pathname = request.nextUrl.pathname;
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  // Si OAuth vuelve a "/" con query, reenviamos al callback real.
  if (pathname === "/" && (code || error || errorDescription)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Esto fuerza refresh de sesión si hace falta (rotación tokens)
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot");

  // Si está logueado y entra en login/register -> llévalo al feed
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return response;
}

// Ajusta qué rutas pasan por middleware
export const config = {
  matcher: [
    /*
      Evita assets estáticos y archivos
    */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
