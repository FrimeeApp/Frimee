"use client";

import { useState } from "react";
import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[340px] space-y-7 text-[#535353]">
      <h1 className="text-6xl font-medium tracking-tight">Registro</h1>

      <form className="space-y-6">
        <fieldset className="rounded-[12px] border border-[#9f9f9f] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[#8b8b8b]">E-mail*</legend>
          <input
            type="email"
            className="w-full bg-transparent text-base outline-none"
            aria-label="Correo electronico"
            placeholder="nombre@correo.com"
          />
        </fieldset>

        <fieldset className="rounded-[12px] border border-[#9f9f9f] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[#8b8b8b]">Contrasena*</legend>
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full bg-transparent text-base outline-none"
              aria-label="Contrasena"
              placeholder="Tu contrasena"
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

        <button
          type="submit"
          className="h-14 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#2ec8b0] to-[#1f8b77] text-xl font-medium text-white"
        >
          Registrarse
        </button>

        <GoogleAuthButton />
      </form>

      <p className="pt-5 text-center text-base text-[#7f7f7f]">
        Ya tienes cuenta?{" "}
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
