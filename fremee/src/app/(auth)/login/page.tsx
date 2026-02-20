"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.debug("[login] getSession", {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });

      if (session) router.replace("/feed");
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug("[login] onAuthStateChange", {
        event,
        hasSession: !!session,
      });
      if (session) router.replace("/feed");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.replace("/feed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error iniciando sesión.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
      // opcional: limpiar password en memoria
      setPassword("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[340px] space-y-7 text-[#535353]">
      <h1 className="text-6xl font-medium tracking-tight">Iniciar sesión</h1>

      <form className="space-y-6" onSubmit={onSubmit}>
        <fieldset className="rounded-[12px] border border-[#9f9f9f] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[#8b8b8b]">E-mail*</legend>
          <input
            type="email"
            className="w-full bg-transparent text-base outline-none"
            aria-label="Correo electronico"
            placeholder="nombre@correo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </fieldset>

        <fieldset className="rounded-[12px] border border-[#9f9f9f] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[#8b8b8b]">Contraseña*</legend>
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full bg-transparent text-base outline-none"
              aria-label="Contrasena"
              placeholder="Tu contraseña"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="cursor-pointer text-[#8b8b8b]"
              aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </fieldset>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-14 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#2ec8b0] to-[#1f8b77] text-xl font-medium text-white disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>

        <GoogleAuthButton />
      </form>

      <div className="pt-2 text-center">
        <Link href="/forgot" className="text-base font-medium text-[#1dbf9a]">
          ¿Has olvidado tu contraseña?
        </Link>
      </div>

      <p className="pt-3 text-center text-base text-[#7f7f7f]">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-[#1dbf9a]">
          Registrarse
        </Link>
      </p>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="size-7"
      aria-hidden="true"
    >
      <path
        d="M2 12C3.8 8.6 7.4 6.5 12 6.5C16.6 6.5 20.2 8.6 22 12C20.2 15.4 16.6 17.5 12 17.5C7.4 17.5 3.8 15.4 2 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      {!open && <path d="M4 4L20 20" stroke="currentColor" strokeWidth="1.7" />}
    </svg>
  );
}
