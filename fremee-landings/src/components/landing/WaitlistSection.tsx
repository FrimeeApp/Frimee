"use client";

import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { isValidEmailInput, MAX_EMAIL_LENGTH, sanitizeEmailInput } from "@/lib/sanitize";
import { applyThemePreference, cacheThemePreference, type AppThemePreference } from "@/services/theme/preferences";

type FormStatus = "idle" | "loading" | "error" | "success";

const waitlistSuccessTitle = "Estás en la waitlist";
const waitlistSuccessMessage = "Te escribiremos cuando abramos acceso anticipado a Frimee.";

type WaitlistSectionProps = {
  standalone?: boolean;
  showModel?: boolean;
};

function subscribeToThemeClass(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

function WaitlistThemeToggle() {
  const isDark = useSyncExternalStore(subscribeToThemeClass, getThemeSnapshot, getServerThemeSnapshot);

  function setTheme(nextTheme: AppThemePreference) {
    applyThemePreference(nextTheme);
    cacheThemePreference(nextTheme);
  }

  return (
    <label
      className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-button)] text-[#17151f] transition-colors duration-200 hover:text-[#17151f]/60 dark:text-white/88 dark:hover:text-white sm:right-6 sm:top-6"
      aria-label="Cambiar tema"
    >
      <input
        type="checkbox"
        checked={isDark}
        onChange={(event) => setTheme(event.target.checked ? "DARK" : "LIGHT")}
        className="peer sr-only"
      />
      <svg
        aria-hidden="true"
        className="absolute h-5 w-5 rotate-90 scale-75 fill-current opacity-0 transition-all duration-300 ease-out peer-checked:rotate-0 peer-checked:scale-100 peer-checked:opacity-100"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
      </svg>
      <svg
        aria-hidden="true"
        className="absolute h-5 w-5 rotate-0 scale-100 fill-current opacity-100 transition-all duration-300 ease-out peer-checked:-rotate-90 peer-checked:scale-75 peer-checked:opacity-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
      </svg>
    </label>
  );
}

function WaitlistLogo() {
  return (
    <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <Image
          src="/images/logo-frimee-black.png"
          alt="Frimee"
          width={20}
          height={20}
          priority
          className="h-5 w-5 object-contain opacity-100 transition-opacity duration-200 dark:opacity-0"
        />
        <Image
          src="/images/logo-frimee.png"
          alt="Frimee"
          width={20}
          height={20}
          priority
          className="absolute h-5 w-5 object-contain opacity-0 transition-opacity duration-200 dark:opacity-100"
        />
      </span>
    </div>
  );
}

export default function WaitlistSection({
  standalone = false,
  showModel = true,
}: WaitlistSectionProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [feedback, setFeedback] = useState("");
  const [emailHasError, setEmailHasError] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [privacyModalClosing, setPrivacyModalClosing] = useState(false);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const honeypotInputRef = useRef<HTMLInputElement>(null);
  const privacyCloseTimeoutRef = useRef<number | null>(null);
  const isStandaloneSuccess = standalone && status === "success";
  const canSubmit = email.trim().length > 0 && status !== "loading";

  function openPrivacyModal() {
    if (privacyCloseTimeoutRef.current) {
      window.clearTimeout(privacyCloseTimeoutRef.current);
      privacyCloseTimeoutRef.current = null;
    }

    setPrivacyModalClosing(false);
    setPrivacyModalOpen(true);
  }

  function closePrivacyModal() {
    if (privacyModalClosing) {
      return;
    }

    setPrivacyModalClosing(true);
    privacyCloseTimeoutRef.current = window.setTimeout(() => {
      setPrivacyModalOpen(false);
      setPrivacyModalClosing(false);
      privacyCloseTimeoutRef.current = null;
    }, 180);
  }

  useEffect(() => {
    return () => {
      if (privacyCloseTimeoutRef.current) {
        window.clearTimeout(privacyCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!privacyModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePrivacyModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [privacyModalOpen]);

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
      setEmailHasError(true);
      setEmail(value);
      setFeedback(value ? "Revisa el email. Debe tener un formato válido." : "Introduce tu email para unirte a la waitlist.");
      requestAnimationFrame(() => {
        emailInputRef.current?.focus();
      });
      return;
    }

    setStatus("loading");
    setEmailHasError(false);
    setFeedback("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: value,
          website: honeypotInputRef.current?.value ?? "",
        }),
      });

      const result = (await response.json()) as { duplicate?: boolean; error?: string };

      if (!response.ok) {
        setStatus("error");
        setEmailHasError(response.status === 400);
        setFeedback(
          response.status === 400
            ? "Revisa el email. Debe tener un formato válido."
            : result.error ?? "No hemos podido guardar tu email. Inténtalo de nuevo en unos segundos.",
        );
        if (response.status === 400) {
          requestAnimationFrame(() => {
            emailInputRef.current?.focus();
          });
        }
        return;
      }

      if (result.duplicate) {
        setStatus("error");
        setEmailHasError(true);
        setEmail(value);
        setFeedback("Este email ya está en la waitlist.");
        requestAnimationFrame(() => {
          emailInputRef.current?.focus();
          emailInputRef.current?.select();
        });
        return;
      }

      setStatus("success");
      setEmailHasError(false);
      setFeedback(waitlistSuccessMessage);
      setEmail("");
    } catch {
      setStatus("error");
      setEmailHasError(false);
      setFeedback("No hemos podido conectar con la waitlist. Revisa tu conexión e inténtalo de nuevo.");
    }
  };

  const sectionClassName = standalone
    ? "relative flex h-dvh overflow-hidden bg-[#f7f8f7] text-[#17151f] dark:bg-[#17171d] dark:text-white lg:items-center"
    : "v3-section v3-animate-section v3-waitlist-section";
  const shellClassName = standalone
    ? "w-full"
    : "v3-waitlist-shell";
  const innerClassName = isStandaloneSuccess
    ? "mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-5 py-20 md:px-8"
    : standalone
    ? "mx-auto grid min-h-dvh w-full max-w-3xl grid-cols-1 content-start gap-8 px-5 pb-24 pt-[clamp(4.25rem,14dvh,7rem)] md:content-center md:gap-10 md:px-8 md:pb-24 md:pt-8"
    : "mx-auto w-[min(100%-2rem,72rem)] py-20 md:py-28";
  const gridClassName = isStandaloneSuccess
    ? "w-full"
    : standalone
    ? "grid grid-cols-1 gap-5"
    : showModel
      ? "mt-10 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 md:items-center"
      : "mt-10 grid grid-cols-1 gap-5 md:mt-12";
  const articleClassName = isStandaloneSuccess
    ? "mx-auto w-full max-w-[34rem] p-0"
    : standalone
    ? "w-full p-0 md:max-w-[34rem] md:p-0"
    : showModel
      ? "md:p-8"
      : "mx-auto w-full max-w-[34rem] md:p-8";

  return (
    <section className={sectionClassName}>
      {standalone ? (
        <>
          <WaitlistLogo />
          <WaitlistThemeToggle />
        </>
      ) : null}
      <div className={shellClassName}>
        <div className={innerClassName}>
          {standalone && status !== "success" ? (
            <div className="flex flex-col justify-center self-stretch">
              <div className="mx-auto w-full max-w-[34rem] text-center">
                <h2 className="v3-ac text-balance text-[clamp(2rem,8.7vw,3.05rem)] font-bold leading-[0.94] tracking-[-0.035em] text-[#17151f] dark:text-white md:text-[clamp(3rem,5.4vw,4.55rem)] md:leading-[0.9] md:tracking-[-0.045em]">
                  <span className="block whitespace-nowrap">
                    Únete a la
                  </span>
                  <span className="block whitespace-nowrap">
                    waitlist de{" "}
                    <span className="font-display text-[0.92em] font-semibold italic tracking-[-0.04em] text-[#17151f]/90 dark:text-white/92">
                      Frimee
                    </span>
                  </span>
                </h2>
                <p className="mx-auto mt-4 hidden max-w-[30rem] text-pretty text-base leading-6 text-[#17151f]/66 dark:text-white/66 md:block lg:leading-7">
                  Organiza viajes, gastos, fotos y decisiones del grupo en un solo sitio y sé de los primeros en probarla.
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

          <div className={`${gridClassName} mx-auto w-full max-w-[32rem]`}>
            <article className={articleClassName}>
              {status === "success" ? (
                <div
                  className={`${standalone ? "p-0 text-center" : "text-center"}`}
                  role="status"
                >
                  <div className={`${standalone ? "v3-waitlist-success" : ""}`}>
                    <div className={`${standalone ? "v3-waitlist-success-icon h-16 w-16 md:h-20 md:w-20" : "h-11 w-11"} mx-auto flex items-center justify-center rounded-full bg-[#298e7d]/10 text-[#227a6c] dark:bg-[#43e7d2]/10 dark:text-[#7ef3e4]`}>
                      <svg
                        aria-hidden="true"
                        className={`${standalone ? "h-8 w-8 md:h-10 md:w-10" : "h-5 w-5"}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h3 className={`${standalone ? "mt-6 text-2xl md:text-3xl" : "mt-4 text-xl"} font-semibold tracking-[-0.02em] text-[#17151f] dark:text-white`}>
                      {waitlistSuccessTitle}
                    </h3>
                    <p className="mx-auto mt-2 max-w-[22rem] text-base leading-6 text-[#17151f]/62 dark:text-white/62">
                      {feedback || waitlistSuccessMessage}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setFeedback("");
                        setEmailHasError(false);
                        requestAnimationFrame(() => {
                          emailInputRef.current?.focus();
                        });
                      }}
                      className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#17151f] px-5 text-base font-medium text-white transition-colors hover:bg-[#17151f]/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f7] dark:bg-white dark:text-black dark:hover:bg-white/92 dark:focus-visible:ring-white/20 dark:focus-visible:ring-offset-[#17171d]"
                    >
                      Apuntar otro email
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <form className={`${standalone ? "space-y-2.5 md:space-y-3.5" : "mt-6 space-y-3"}`} onSubmit={onSubmit} noValidate>
                    <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                      <label htmlFor="waitlist-website">Website</label>
                      <input
                        id="waitlist-website"
                        ref={honeypotInputRef}
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>
                    <label htmlFor="waitlist-email" className="sr-only">
                      Email
                    </label>
                    <div
                      className={`${standalone ? "min-h-14 rounded-xl bg-white/45 p-1.5 dark:bg-white/[0.03] md:min-h-16" : "min-h-14 rounded-[var(--radius-button)] bg-transparent p-1.5"} ${emailHasError ? "border-red-500/80 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15 dark:border-red-400/80 dark:focus-within:border-red-400 dark:focus-within:ring-red-400/20" : standalone ? "border-black/10 focus-within:border-black/30 dark:border-white/10 dark:focus-within:border-white/30" : "border-[var(--v3-border)] focus-within:border-[var(--v3-heading)]"} flex w-full items-center gap-2 border transition-colors`}
                    >
                      <input
                        id="waitlist-email"
                        ref={emailInputRef}
                        type="email"
                        value={email}
                        disabled={status === "loading"}
                        onChange={(event) => {
                          setEmail(sanitizeEmailInput(event.target.value));
                          if (emailHasError) {
                            setEmailHasError(false);
                          }
                          if (status !== "idle") {
                            setStatus("idle");
                            setFeedback("");
                          }
                        }}
                        maxLength={MAX_EMAIL_LENGTH}
                        placeholder="tu@email.com"
                        required
                        aria-invalid={emailHasError}
                        aria-describedby={feedback ? "waitlist-feedback" : undefined}
                        className={`${standalone ? "text-[#17151f] placeholder:text-[#17151f]/38 dark:text-white dark:placeholder:text-white/38" : "text-[color:var(--v3-heading)] placeholder:text-[color:var(--v3-sub)]"} min-w-0 flex-1 bg-transparent px-2 text-base outline-none ring-0 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3`}
                      />
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className={`${standalone ? "bg-[#17151f] text-white hover:bg-[#17151f]/92 focus-visible:ring-black/20 dark:bg-white dark:text-black dark:hover:bg-white/92 dark:focus-visible:ring-white/20" : "bg-black text-white hover:opacity-90 focus-visible:ring-black/30 dark:bg-white dark:text-black dark:focus-visible:ring-white/35"} inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-3 text-base font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-35 sm:px-5 md:h-12`}
                      >
                        {status === "loading" ? "Enviando..." : "Unirse"}
                      </button>
                    </div>
                  </form>

                  {feedback ? (
                    <p
                      id="waitlist-feedback"
                      className="mt-4 text-base font-medium text-red-500 dark:text-red-400"
                      role="status"
                    >
                      {feedback}
                    </p>
                  ) : null}

                  <p className={`${standalone ? "absolute bottom-5 left-1/2 z-10 w-[min(100%-2rem,34rem)] -translate-x-1/2 text-center text-base leading-6 text-[#17151f]/58 dark:text-white/58 md:bottom-6" : "mt-5 text-base leading-6 text-black/70 dark:text-white/70"}`}>
                    Al unirte aceptas recibir novedades sobre el acceso a Frimee y nuestra{" "}
                    <a
                      href="/politica-de-privacidad"
                      onClick={(event) => {
                        if (!standalone) {
                          return;
                        }

                        event.preventDefault();
                        openPrivacyModal();
                      }}
                      className={`${standalone ? "font-semibold text-[#17151f] underline decoration-[#17151f]/50 underline-offset-4 dark:text-white dark:decoration-white/50" : "font-semibold text-black underline decoration-black/70 underline-offset-4 dark:text-white dark:decoration-white/70"}`}
                    >
                      Política de Privacidad
                    </a>
                    .
                  </p>
                </>
              )}
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
      {privacyModalOpen ? (
        <div
          className={`${privacyModalClosing ? "v3-privacy-modal-overlay-out" : "v3-privacy-modal-overlay-in"} fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePrivacyModal();
            }
          }}
        >
          <div className={`${privacyModalClosing ? "v3-privacy-modal-panel-out" : "v3-privacy-modal-panel-in"} flex h-[min(82dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#f7f8f7] shadow-2xl dark:border-white/10 dark:bg-[#17171d]`}>
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10">
              <h2 id="privacy-modal-title" className="text-lg font-semibold tracking-[-0.02em] text-[#17151f] dark:text-white">
                Política de Privacidad de Frimee
              </h2>
              <button
                type="button"
                onClick={closePrivacyModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#17151f]/70 transition-colors hover:bg-black/5 hover:text-[#17151f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/25"
                aria-label="Cerrar política de privacidad"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <iframe
              src="/politica-de-privacidad?modal=1"
              title="Política de Privacidad de Frimee"
              className="min-h-0 flex-1 bg-white dark:bg-[#17171d]"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
