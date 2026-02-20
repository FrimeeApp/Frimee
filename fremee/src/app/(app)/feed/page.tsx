"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { uploadPhotoDataUrl } from "@/services/firebase/upload";
import { savePhotoDoc } from "@/services/firebase/photoDocs";

export default function FeedPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // ✅ pruebas
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<string>("");
  const [cameraBusy, setCameraBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [deviceMsg, setDeviceMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const guard = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.debug("[feed] getSession", {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });

      if (!session) {
        router.replace("/login");
        return;
      }

      setReady(true);
    };

    guard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug("[feed] onAuthStateChange", {
        event,
        hasSession: !!session,
      });

      if (!session) router.replace("/login");
    });

    // info rápida para saber dónde estás probando
    setDeviceMsg(
      Capacitor.isNativePlatform()
        ? `Capacitor (${Capacitor.getPlatform()})`
        : "Web (navegador)"
    );

    return () => subscription.unsubscribe();
  }, [router]);

  if (!ready) return null;

  const onSignOut = async () => {
    try {
      setSigningOut(true);
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[feed] signOut error", error);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  const onGetLocation = async () => {
    try {
      setGeoBusy(true);
      setCoords("");

      // pide permisos (en web puede devolver "prompt"/"granted")
      await Geolocation.requestPermissions();

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      setCoords(`${pos.coords.latitude}, ${pos.coords.longitude}`);
    } catch (e) {
      console.error("[feed] geolocation error", e);
      setCoords("Error obteniendo ubicación (mira consola/logcat).");
    } finally {
      setGeoBusy(false);
    }
  };

  const onTakePhoto = async () => {
    try {
      setCameraBusy(true);
      setPhotoUrl(null);

      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // cámara o galería
      });

      setPhotoUrl(image.dataUrl ?? null);
    } catch (e) {
      console.error("[feed] camera error", e);
      setPhotoUrl("data:,"); // evita crash visual
    } finally {
      setCameraBusy(false);
    }
  };
  const onUploadToFirebase = async () => {
    try {
      if (!photoUrl || photoUrl === "data:,") {
        alert("Primero haz una foto.");
        return;
      }

      setUploading(true);
      setUploadedUrl("");

      // sacamos el userId desde Supabase session
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;
      if (!userId) {
        alert("No hay sesión, vuelve a login.");
        router.replace("/login");
        return;
      }

      const { filePath, downloadUrl } = await uploadPhotoDataUrl({
        dataUrl: photoUrl,
        userId,
      });

      // opcional: guardar en Firestore
      await savePhotoDoc({ userId, downloadUrl, filePath });

      setUploadedUrl(downloadUrl);
      console.debug("[feed] uploaded firebase url", downloadUrl);
    } catch (e) {
      console.error("[feed] upload firebase error", e);
      alert("Error subiendo a Firebase. Mira consola/logcat.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f4f4f4] px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="rounded-2xl bg-white p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1A1F1D]">
            Feed
          </h1>
          <p className="mt-2 text-base text-[#535353]">
            Aqui veras los planes y actividad. (placeholder)
          </p>
          <p className="mt-2 text-sm text-[#777]">Modo: {deviceMsg}</p>
        </header>

        <section className="rounded-2xl bg-white p-6">
          <p className="text-[#535353]">
            Login/registro correcto. Ya estas dentro.
          </p>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="mt-4 rounded-lg bg-[#1A1F1D] px-4 py-2 text-white disabled:opacity-60"
          >
            {signingOut ? "Cerrando sesion..." : "Cerrar sesion"}
          </button>
        </section>

        {/* ✅ Sección de pruebas (sin quitar lo que ya hay) */}
        <section className="rounded-2xl bg-white p-6">
          <h2 className="text-xl font-semibold text-[#1A1F1D]">
            Pruebas Capacitor
          </h2>
          <p className="mt-2 text-sm text-[#535353]">
            Usa estos botones para probar geolocalización y cámara en móvil.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={onGetLocation}
              disabled={geoBusy}
              className="rounded-lg bg-[#1FAF8B] px-4 py-2 text-white disabled:opacity-60"
            >
              {geoBusy ? "Obteniendo ubicación..." : "📍 Obtener ubicación"}
            </button>

            {coords && (
              <div className="rounded-lg border border-[#E3E8E6] bg-[#F7F9F8] p-3 text-sm text-[#1A1F1D]">
                <div className="font-medium">Coordenadas</div>
                <div className="mt-1">{coords}</div>
              </div>
            )}

            <button
              type="button"
              onClick={onTakePhoto}
              disabled={cameraBusy}
              className="rounded-lg bg-[#3A86FF] px-4 py-2 text-white disabled:opacity-60"
            >
              {cameraBusy ? "Abriendo cámara..." : "📷 Hacer foto / elegir"}
            </button>

            {photoUrl && photoUrl !== "data:," && (
              <img
                src={photoUrl}
                alt="captured"
                className="mt-2 w-full max-w-sm rounded-xl border border-[#E3E8E6]"
              />
            )}
            <button
                type="button"
                onClick={onUploadToFirebase}
                disabled={uploading || !photoUrl || photoUrl === "data:,"}
                className="rounded-lg bg-[#111827] px-4 py-2 text-white disabled:opacity-60"
                >
                {uploading ? "Subiendo a Firebase..." : "☁️ Subir foto a Firebase"}
                </button>

                {uploadedUrl && (
                <div className="rounded-lg border border-[#E3E8E6] bg-[#F7F9F8] p-3 text-sm text-[#1A1F1D]">
                    <div className="font-medium">Subida OK</div>
                    <a className="mt-1 break-all underline" href={uploadedUrl} target="_blank">
                    {uploadedUrl}
                    </a>
                </div>
                )}
          </div>

          <p className="mt-4 text-xs text-[#777]">
            Nota: en Android recuerda tener permisos en el Manifest y ejecutar{" "}
            <code>npx cap sync</code> tras instalar plugins.
          </p>
        </section>
      </div>
    </div>
  );
}