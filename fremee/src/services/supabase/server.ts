import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseEnv, supabaseUrl, supabaseAnonKey } from "./config";

export const createServerSupabaseClient = async () => {
  assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // En Server Components puede fallar setear cookies.
          // Si tienes middleware refrescando sesión, se puede ignorar.
        }
      },
    },
  });
};
