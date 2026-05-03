import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv, supabaseUrl, supabaseAnonKey } from "./config";

export const createMiddlewareClient = (request: NextRequest) => {
  assertSupabaseEnv();

  // Response “base”
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // En middleware, persistimos SIEMPRE en la response
        response = NextResponse.next({
          request: { headers: request.headers },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
};
