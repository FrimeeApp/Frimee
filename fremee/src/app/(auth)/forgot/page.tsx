export default function ForgotPage() {
  return (
    <div className="mx-auto w-full max-w-[340px] space-y-7 text-[#535353]">
      <h1 className="text-6xl font-medium tracking-tight">Recuperar</h1>

      <form className="space-y-6">
        <fieldset className="rounded-[12px] border border-[#9f9f9f] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[#8b8b8b]">E-mail*</legend>
          <input
            type="email"
            className="w-full bg-transparent text-base outline-none"
            aria-label="Correo electronico"
          />
        </fieldset>

        <button
          type="submit"
          className="h-14 w-full rounded-xl bg-gradient-to-r from-[#2ec8b0] to-[#1f8b77] text-xl font-medium text-white"
        >
          Enviar enlace
        </button>
      </form>
    </div>
  );
}
