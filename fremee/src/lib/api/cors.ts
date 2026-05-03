import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

export function getAllowedOrigins() {
  const envOrigins = [
    process.env.NEXT_PUBLIC_WEB_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeOrigin);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);
}

export function buildCorsHeaders(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin =
    requestOrigin && allowedOrigins.has(normalizeOrigin(requestOrigin))
      ? requestOrigin
      : null;

  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });

  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
  }

  return headers;
}

export function withCors(request: NextRequest, response: NextResponse) {
  const headers = buildCorsHeaders(request);
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export function handleCorsPreflight(request: NextRequest) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}
