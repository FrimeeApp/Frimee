import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/services/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Esto fuerza refresh de sesión si hace falta (rotación tokens)
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Ejemplo: proteger todo lo que esté bajo /feed o /app
  const isProtected =
    pathname.startsWith("/feed") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/plans");

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot");

  // Si intenta acceder a protegido sin login -> /login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

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
