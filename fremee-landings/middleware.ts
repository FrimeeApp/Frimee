import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (isLocal) return NextResponse.next();

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/waitlist";
    return NextResponse.redirect(url);
  }

  return new Response(null, { status: 404, statusText: "Not Found" });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|txt)|api/waitlist|waitlist).*)",
  ],
};
