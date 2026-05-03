"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { isValidEmailInput, MAX_EMAIL_LENGTH, sanitizeEmailInput } from "@/lib/sanitize";

type FormStatus = "idle" | "loading" | "error" | "success";

type WaitlistSectionProps = {
  standalone?: boolean;
  showModel?: boolean;
};

export default function WaitlistSection({
  standalone = false,
  showModel = true,
}: WaitlistSectionProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [feedback, setFeedback] = useState("");
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModel) {
      return;
    }

    const host = canvasHostRef.current;

    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 1.15, 4.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 1);
    fill.position.set(-4, 3, -4);
    scene.add(fill);

    const ambient = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xe9eef7, 0.22);
    scene.add(hemi);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.minPolarAngle = Math.PI * 0.32;

    const loader = new GLTFLoader();
    let luggage: THREE.Object3D | null = null;
    let frameId = 0;

    loader.load(
      "/models/Airplane.glb",
      (gltf) => {
        luggage = gltf.scene;

        const box = new THREE.Box3().setFromObject(luggage);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.7 / maxAxis;

        luggage.scale.setScalar(scale);
        luggage.position.sub(center.multiplyScalar(scale));
        luggage.position.y += 0.2;
        scene.add(luggage);
      },
      undefined,
      () => {
        setStatus((current) => (current === "success" ? current : "error"));
        setFeedback((current) => current || "No se pudo cargar el modelo 3D.");
      },
    );

    const onResize = () => {
      const { clientWidth, clientHeight } = host;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      if (luggage) {
        luggage.rotation.y += 0.0004;
      }
      controls.update();
      renderer.render(scene, camera);
    };

    window.addEventListener("resize", onResize);
    onResize();
    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(frameId);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) {
          return;
        }

        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material?.dispose();
        }
      });
      host.removeChild(renderer.domElement);
    };
  }, [showModel]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = sanitizeEmailInput(email);

    if (!isValidEmailInput(value)) {
      setStatus("error");
      setFeedback("Introduce un email valido.");
      return;
    }

    setStatus("loading");
    setFeedback("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: value }),
      });

      const result = (await response.json()) as { duplicate?: boolean; error?: string };

      if (!response.ok) {
        setStatus("error");
        setFeedback(result.error ?? "No se pudo guardar el email.");
        return;
      }

      setStatus("success");
      setFeedback(result.duplicate ? "Este email ya esta en la lista." : "Listo, te avisaremos pronto.");
      setEmail("");
    } catch {
      setStatus("error");
      setFeedback("No se pudo conectar con la waitlist.");
    }
  };

  const sectionClassName = standalone
    ? "v3-section v3-waitlist-section flex min-h-dvh overflow-y-auto bg-[#17171d] py-0 lg:h-dvh lg:items-center lg:overflow-hidden"
    : "v3-section v3-animate-section v3-waitlist-section";
  const shellClassName = standalone
    ? "w-full"
    : "v3-waitlist-shell";
  const innerClassName = standalone
    ? "mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 gap-10 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] md:px-8 lg:h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center lg:gap-14 lg:px-12"
    : "mx-auto w-[min(100%-2rem,72rem)] py-20 md:py-28";
  const gridClassName = standalone
    ? "grid grid-cols-1 gap-5"
    : "mt-10 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 md:items-center";
  const articleClassName = standalone
    ? "w-full rounded-[28px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-sm md:p-7"
    : "md:p-8";

  return (
    <section className={sectionClassName}>
      <div className={shellClassName}>
        <div className={innerClassName}>
          {standalone ? (
            <div className="flex flex-col justify-center self-stretch">
              <div className="mx-auto w-full max-w-[28rem] text-center lg:mx-0 lg:max-w-[32rem] lg:text-left">
                <p className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#43e7d2]">
                  Registro anticipado
                </p>
                <h2 className="v3-ac text-balance text-[clamp(3.3rem,14vw,6.8rem)] font-extrabold leading-[0.84] tracking-[-0.06em] text-white">
                  Prueba
                  <span className="my-1 block font-display text-[0.92em] font-semibold italic tracking-[-0.04em] text-white/92">
                    Frimee
                  </span>
                  antes
                  <span className="block">que nadie</span>
                </h2>
                <p className="mx-auto mt-5 max-w-[28rem] text-pretty text-[15px] leading-6 text-white/66 lg:mx-0 lg:text-[17px] lg:leading-7">
                  Organiza viajes, gastos, fotos y decisiones del grupo en un solo sitio. Apuntate y te avisaremos cuando abramos acceso.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="v3-ac mx-auto w-fit max-w-[16ch] text-center text-balance text-[clamp(2.5rem,5vw,5.5rem)] font-extrabold leading-[0.94]">
                Prueba <span className="v3-brand-word">Frimee</span> antes que nadie
              </h2>
            </div>
          )}

          <div className={gridClassName}>
            <article className={articleClassName}>
              <p className={`${standalone ? "text-[13px] tracking-[0.22em] text-[#43e7d2]" : "text-base tracking-[0.14em] text-[color:var(--v3-purple)]"} font-semibold uppercase`}>
                Unete a la waitlist
              </p>
              {standalone && (
                <div className="mt-3 max-w-[28rem] text-sm leading-6 text-white/62">
                  Deja tu email y entra de los primeros en probar la experiencia completa de Frimee.
                </div>
              )}
              <form className={`${standalone ? "mt-6 space-y-3.5" : "mt-6 space-y-3"}`} onSubmit={onSubmit} noValidate>
                <label htmlFor="waitlist-email" className="sr-only">
                  Email
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  value={email}
                  disabled={status === "loading"}
                  onChange={(event) => {
                    setEmail(sanitizeEmailInput(event.target.value));
                    if (status !== "idle") {
                      setStatus("idle");
                      setFeedback("");
                    }
                  }}
                  maxLength={MAX_EMAIL_LENGTH}
                  placeholder="tu@email.com"
                  required
                  className={`${standalone ? "h-14 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-white placeholder:text-white/38 focus:border-white/30" : "h-12 rounded-xl border-[var(--v3-border)] bg-transparent px-4 text-[color:var(--v3-heading)] placeholder:text-[color:var(--v3-sub)] focus:border-[var(--v3-heading)]"} w-full border text-base outline-none ring-0 disabled:cursor-not-allowed disabled:opacity-60`}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={`${standalone ? "h-14 rounded-2xl bg-white text-black hover:bg-white/92 focus-visible:ring-white/20 focus-visible:ring-offset-[#17171d]" : "h-12 rounded-[var(--radius-button)] bg-black text-white hover:opacity-90 focus-visible:ring-black/30 dark:bg-white dark:text-black dark:focus-visible:ring-white/35"} group inline-flex w-full items-center justify-center gap-2 overflow-hidden px-5 text-base font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <span>{status === "loading" ? "Enviando..." : "Quiero probar Frimee"}</span>
                  <span className="w-0 opacity-0 transition-all duration-200 group-hover:w-4 group-hover:opacity-100">
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              </form>

              {feedback ? (
                <p
                  className={`mt-4 text-sm font-medium md:text-[15px] ${
                    status === "success"
                      ? standalone
                        ? "text-[#7ef3e4]"
                        : "text-[color:var(--v3-heading)]"
                      : "text-red-500 dark:text-red-400"
                  }`}
                  role="status"
                >
                  {feedback}
                </p>
              ) : null}

              <p className={`${standalone ? "mt-5 text-sm leading-6 text-white/58" : "mt-5 text-base leading-6 text-black/70 dark:text-white/70"}`}>
                Al unirte aceptas recibir novedades de Frimee y nuestra{" "}
                <a
                  href="/politica-de-privacidad"
                  className={`${standalone ? "font-semibold text-white underline decoration-white/50 underline-offset-4" : "font-semibold text-black underline decoration-black/70 underline-offset-4 dark:text-white dark:decoration-white/70"}`}
                >
                  Politica de Privacidad
                </a>
                . Puedes darte de baja cuando quieras.
              </p>
            </article>

            <article className={showModel ? "hidden md:flex md:min-h-[520px] md:items-center md:p-6" : "hidden"}>
              <div
                ref={canvasHostRef}
                className="-translate-y-4 h-[360px] w-full rounded-2xl md:h-[500px] md:-translate-y-8"
                aria-label="Modelo 3D de maleta"
              />
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
