import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import { APP_REGISTER_URL } from "@/config/links";
import ScrollEffects from "@/components/landing/ScrollEffects";
import PhoneMockup from "@/components/landing/PhoneMockup";
import { AnimatedTestimonials } from "@/components/blocks/animated-testimonials";
import { FaXTwitter, FaInstagram } from "react-icons/fa6";
import { PricingSection, type Plan } from "@/components/ui/pricing";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Footer7 } from "@/components/ui/footer-7";
import {
  FolderOpen,
  Users,
  Camera,
  Plus,
  UserPlus,
  Lightbulb,
  CalendarCheck,
  PartyPopper,
  Plane,
  CreditCard,
  Ticket,
  Sparkles,
  Check,
  X,
  Mail,
  ArrowRight,
  Zap,
  QrCode,
  Smartphone,
} from "lucide-react";

const storySteps = [{ title: "Todo" }, { title: "en la misma" }, { title: "aplicación" }];

const problemItems = ["Mensajes caóticos", "Tickets perdidos", "Pagos desordenados"];

const valueProps = [
  {
    icon: FolderOpen,
    color: "#eef7a8",
    iconColor: "#5a7a00",
    title: "Todo en un sitio",
    desc: "Chats, fotos, tickets y gastos del plan en un solo lugar. Nunca más buscar en mil grupos.",
  },
  {
    icon: Users,
    color: "#c7b8ff",
    iconColor: "#6048e8",
    title: "Decisiones en grupo",
    desc: "Votad actividades y destinos juntos. Sin debates infinitos ni decisiones unilaterales.",
  },
  {
    icon: Camera,
    color: "#bcecd4",
    iconColor: "#1a7a5a",
    title: "Experiencia compartida",
    desc: "Revivid el plan con fotos y recuerdos guardados automáticamente para siempre.",
  },
];

const flowSteps = [
  { step: "01", icon: Plus, title: "Crear", desc: "Nuevo plan en segundos" },
  { step: "02", icon: UserPlus, title: "Invitar", desc: "Link directo al grupo" },
  { step: "03", icon: Lightbulb, title: "Proponer", desc: "Ideas para todos" },
  { step: "04", icon: CalendarCheck, title: "Organizar", desc: "Gastos y tickets" },
  { step: "05", icon: PartyPopper, title: "Disfrutar", desc: "Sin estrés" },
];

const featureItems = [
  { icon: Plane, color: "#eef7a8", iconColor: "#5a7a00", title: "Viajes compartidos" },
  { icon: CreditCard, color: "#c7b8ff", iconColor: "#6048e8", title: "Gastos" },
  { icon: Ticket, color: "#bcecd4", iconColor: "#1a7a5a", title: "Tickets" },
  { icon: Sparkles, color: "#fde8c8", iconColor: "#c45d00", title: "Inspiración" },
];

const compareItems = {
  whatsapp: ["Mensajes que se pierden", "Sin organización real", "Sin historial de gastos", "Sin gestión de tickets"],
  excel: ["Demasiado técnico", "Sin colaboración fluida", "Sin fotos ni recuerdos", "Actualización manual"],
  frimee: ["Todo organizado", "Colaboración real", "Fotos y recuerdos", "Gastos automáticos"],
};

const testimonials = [
  {
    id: 1,
    name: "Ana M.",
    role: "Estudiante",
    company: "Madrid",
    content:
      "Planificamos un viaje a Ámsterdam con 8 personas y fue la primera vez que no hubo dramas. Todo en un solo sitio, increíble.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=47",
  },
  {
    id: 2,
    name: "Carlos R.",
    role: "Desarrollador",
    company: "Barcelona",
    content:
      "Organizamos la despedida de soltero con Frimee y fue increíble. Los votos de actividades solos ya valen la app.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: 3,
    name: "Laura G.",
    role: "Diseñadora",
    company: "Valencia",
    content:
      "Por fin una app que entiende que planificar con amigos no tiene que ser un caos de WhatsApp. La recomiendo al 100%.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=29",
  },
];

const pricingPlans: Plan[] = [
  {
    name: "Basic",
    info: "Para empezar sin coste",
    price: { monthly: 0, yearly: 0 },
    features: [
      { text: "Hasta 3 planes activos" },
      { text: "Grupos de hasta 5 personas" },
      { text: "Chat del plan" },
      { text: "División de gastos básica" },
      { text: "Soporte de comunidad", tooltip: "Acceso a nuestra comunidad de usuarios en Discord" },
    ],
    btn: { text: "Empezar gratis", href: APP_REGISTER_URL },
  },
  {
    name: "Pro",
    highlighted: true,
    info: "Para grupos que viajan",
    price: { monthly: 6.99, yearly: 69 },
    features: [
      { text: "Planes ilimitados" },
      { text: "Grupos de hasta 20 personas" },
      { text: "Gestión de tickets y entradas", tooltip: "Guarda y comparte entradas de eventos con el grupo" },
      { text: "Fotos y recuerdos del viaje" },
      { text: "Historial completo de gastos" },
      { text: "Soporte prioritario", tooltip: "Respuesta garantizada en menos de 24 horas" },
    ],
    btn: { text: "Empezar con Pro", href: APP_REGISTER_URL },
  },
  {
    name: "Max",
    info: "Para grandes aventuras",
    price: { monthly: 12.99, yearly: 129 },
    features: [
      { text: "Todo lo de Pro" },
      { text: "Sin límite de participantes" },
      { text: "IA para sugerencias de planes", tooltip: "Recibe ideas personalizadas para tu próxima aventura" },
      { text: "Exportar planes en PDF" },
      { text: "Integraciones con calendarios" },
      { text: "Soporte 24/7", tooltip: "Chat directo con el equipo de Frimee en cualquier momento" },
    ],
    btn: { text: "Empezar con Max", href: APP_REGISTER_URL },
  },
];

const faqItems = [
  {
    q: "¿Es gratis?",
    a: "Sí, Frimee es completamente gratuito durante la beta. Queremos que lo pruebes sin compromisos.",
  },
  {
    q: "¿Cómo se usa?",
    a: "Descarga la app, crea un plan e invita a tus amigos con un enlace. En segundos podéis empezar a organizar.",
  },
  {
    q: "¿Está en móvil?",
    a: "Sí, Frimee está disponible para iOS y Android. También funciona desde el navegador.",
  },
  {
    q: "¿Cómo envío feedback?",
    a: "Desde dentro de la app puedes enviar sugerencias directamente. También puedes escribirnos a hola@frimee.app.",
  },
];

export default function LandingV3Page() {
  return (
    <main className="landing-page v3-page min-h-dvh">
      <ScrollEffects />
      <Navbar />

      {/* ── 1. Hero ──────────────────────────────────── */}
      <section className="v3-hero">
        <div className="v3-hero-shell">
          <div className="v3-hero-copy">
            <h1>
              Planes con amigos.
              <br />
              Sin caos en el chat.
            </h1>
          </div>
          <div className="v3-hero-mockup" aria-hidden="true">
            <PhoneMockup />
          </div>
          <div className="v3-hero-story" aria-label="Como funciona Frimee">
            <div className="v3-story-sequence">
              {storySteps.map((step) => (
                <article key={step.title} className="v3-story-copy">
                  <h2>{step.title}</h2>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Problema ──────────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">El problema</p>
          <h2 className="v3-ac">Todo está en sitios diferentes</h2>
          <div className="v3-chip-row v3-ac">
            {problemItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Insight ───────────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-insight-dark v3-ac">
            <div>
              <p className="v3-kicker v3-kicker-emph">Insight</p>
              <div className="v3-insight-quote-mark">"</div>
              <h2 style={{ color: "#ffffff", marginTop: "0.5rem" }}>
                El problema
                <br />
                no es la gente.
              </h2>
            </div>
            <p className="v3-insight-statement">
              Es la falta de una herramienta pensada para esto.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Propuesta de valor ─────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">Propuesta de valor</p>
          <h2 className="v3-ac">Planes, decisiones y recuerdos en un solo lugar.</h2>
          <div className="v3-value-grid">
            {valueProps.map((vp) => {
              const Icon = vp.icon;
              return (
                <div key={vp.title} className="v3-value-card v3-ac">
                  <div
                    className="v3-value-icon"
                    style={{ background: vp.color }}
                  >
                    <Icon size={20} color={vp.iconColor} strokeWidth={2.5} />
                  </div>
                  <h3>{vp.title}</h3>
                  <p>{vp.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. Cómo funciona ──────────────────────────── */}
      <section className="v3-section v3-section-alt v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">Cómo funciona</p>
          <h2 className="v3-ac">Cinco pasos, cero complicaciones.</h2>
          <div className="v3-steps-grid">
            {flowSteps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="v3-step-card v3-ac">
                  <div className="v3-step-number">{s.step}</div>
                  <Icon size={22} color="#6048e8" strokeWidth={2} />
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. Producto ───────────────────────────────── */}
      <section className="v3-section v3-product v3-animate-section">
        <div className="v3-section-inner v3-product-grid">
          <div>
            <p className="v3-kicker v3-ac">Producto</p>
            <h2 className="v3-ac">Lo importante del plan, visible.</h2>
            <div className="v3-feature-cards">
              {featureItems.map((fi) => {
                const Icon = fi.icon;
                return (
                  <div key={fi.title} className="v3-feature-card v3-ac">
                    <div
                      className="v3-feature-card-icon"
                      style={{ background: fi.color }}
                    >
                      <Icon size={16} color={fi.iconColor} strokeWidth={2.5} />
                    </div>
                    <span>{fi.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* ── 7. Diferenciación ─────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">Diferenciación</p>
          <h2 className="v3-ac">¿Por qué Frimee y no lo que ya usas?</h2>
          <div className="v3-compare-grid">
            {/* WhatsApp */}
            <div className="v3-compare-card muted v3-ac">
              <p className="v3-compare-card-title">WhatsApp</p>
              {compareItems.whatsapp.map((item) => (
                <div key={item} className="v3-compare-item">
                  <X size={16} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            {/* Excel */}
            <div className="v3-compare-card muted v3-ac">
              <p className="v3-compare-card-title">Excel / Notion</p>
              {compareItems.excel.map((item) => (
                <div key={item} className="v3-compare-item">
                  <X size={16} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            {/* Frimee */}
            <div className="v3-compare-card highlight v3-ac">
              <p className="v3-compare-card-title">Frimee ✨</p>
              {compareItems.frimee.map((item) => (
                <div key={item} className="v3-compare-item">
                  <Check size={16} color="rgba(255,255,255,0.9)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Impacto ────────────────────────────────── */}
      <section className="v3-section v3-section-alt v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">Impacto</p>
          <h2 className="v3-ac">Los primeros resultados hablan.</h2>
          <div className="v3-stats-grid">
            <div className="v3-stat-card v3-ac">
              <div className="v3-stat-value">
                <Zap size={40} color="#6048e8" strokeWidth={2} />
              </div>
              <p className="v3-stat-label">Beta activa</p>
              <p className="v3-stat-note">Probando con usuarios reales en fase privada</p>
            </div>
            <div className="v3-stat-card v3-ac">
              <div className="v3-stat-value">100+</div>
              <p className="v3-stat-label">Planes creados</p>
              <p className="v3-stat-note">Primeras aventuras organizadas con Frimee</p>
            </div>
            <div className="v3-stat-card v3-ac">
              <div className="v3-stat-value">★★★★★</div>
              <p className="v3-stat-label">Feedback 5 estrellas</p>
              <p className="v3-stat-note">Los primeros usuarios nos recomiendan</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Testimonios ────────────────────────────── */}
      <AnimatedTestimonials testimonials={testimonials} />

      {/* ── Pricing ───────────────────────────────────── */}
      <section className="v3-section v3-pricing-section v3-animate-section">
        <PricingSection
          plans={pricingPlans}
          heading="Simple y transparente."
          description="Sin sorpresas, sin letra pequeña. Empieza gratis y sube cuando lo necesites."
        />
      </section>

      {/* ── 10. Demo ──────────────────────────────────── */}
      <section className="v3-demo-dark v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-demo-split">
            {/* Left */}
            <div className="v3-demo-left">
              <span className="v3-demo-badge v3-ac">¡Ya disponible!</span>
              <h2 className="v3-demo-heading v3-ac">
                Pruébalo<br />ahora.
              </h2>
              <p className="v3-demo-desc v3-ac">
                Descarga Frimee, crea tu primer plan e invita a tus amigos con un enlace. Sin caos, sin grupos de WhatsApp.
              </p>
              <div className="v3-demo-ctas v3-ac">
                <Link href={APP_REGISTER_URL} className="v3-cta-large">
                  Abrir Frimee <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
                <Link href={APP_REGISTER_URL} className="v3-cta-ghost">
                  Descargar app <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
              <p className="v3-demo-note v3-ac">
                Gratis durante la beta · Sin tarjeta de crédito
              </p>
            </div>

            {/* Right: QR placeholder */}
            <div className="v3-demo-qr-wrap v3-ac">
              <div className="v3-demo-qr">
                <div className="v3-demo-qr-icon">
                  <QrCode size={72} strokeWidth={1.25} />
                </div>
                <p className="v3-demo-qr-label">Escanea para abrir la app</p>
                <p className="v3-demo-qr-sub">
                  <Smartphone size={13} strokeWidth={2} />
                  iOS y Android
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 11. Comunidad ─────────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">Comunidad</p>
          <h2 className="v3-ac">Estamos construyendo esto contigo</h2>
          <div className="v3-social-cards">
            <a
              href="https://twitter.com/frimeeapp"
              target="_blank"
              rel="noreferrer"
              className="v3-social-card v3-ac"
            >
              <div className="v3-social-card-icon">
                <FaXTwitter size={20} className="v3-icon-x" />
              </div>
              <div>
                <p className="v3-social-card-name">Twitter / X</p>
                <p className="v3-social-card-handle">@frimeeapp</p>
              </div>
            </a>
            <a
              href="https://instagram.com/frimeeapp"
              target="_blank"
              rel="noreferrer"
              className="v3-social-card v3-ac"
            >
              <div className="v3-social-card-icon">
                <FaInstagram size={20} color="#E1306C" />
              </div>
              <div>
                <p className="v3-social-card-name">Instagram</p>
                <p className="v3-social-card-handle">@frimeeapp</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── 12. Feedback ──────────────────────────────── */}
      <section className="v3-section v3-section-alt v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-feedback-card v3-ac">
            <div>
              <p className="v3-kicker">Feedback</p>
              <h2 style={{ fontSize: "clamp(1.75rem,4vw,3.5rem)", marginTop: "0.75rem" }}>
                ¿Ideas o problemas?
                <br />
                Queremos escucharte.
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1rem" }}>
              <div
                style={{
                  width: "3.5rem",
                  height: "3.5rem",
                  borderRadius: "1rem",
                  background: "color-mix(in srgb, #6048e8 15%, white)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={22} color="#6048e8" strokeWidth={2} />
              </div>
              <a className="v3-feedback-mail" href="mailto:hola@frimee.app">
                hola@frimee.app
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 13. FAQ ───────────────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <p className="v3-kicker v3-ac">FAQ</p>
          <h2 className="v3-ac">Preguntas frecuentes</h2>
          <div className="v3-ac" style={{ marginTop: "clamp(2rem, 4vh, 3.5rem)" }}>
            <Accordion type="single" collapsible defaultValue="faq-0">
              {faqItems.map((item, i) => (
                <AccordionItem key={item.q} value={`faq-${i}`}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <Footer7 />
    </main>
  );
}
