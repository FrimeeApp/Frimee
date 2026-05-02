import Image from "next/image";
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
  CalendarCheck,
  PartyPopper,
  Plane,
  CreditCard,
  Ticket,
  Sparkles,
  Check,
  X,
  Mail,
  MessageCircle,
  ReceiptText,
  QrCode,
  Smartphone,
  WalletCards,
} from "lucide-react";

const storySteps = [{ title: "Todo" }, { title: "en la misma" }, { title: "aplicación" }];

const problemItems = [
  { icon: MessageCircle, label: "Mensajes caóticos" },
  { icon: ReceiptText, label: "Tickets perdidos" },
  { icon: WalletCards, label: "Pagos desordenados" },
];

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
  { step: "03", icon: CalendarCheck, title: "Organizar", desc: "Gastos, tickets e ideas" },
  { step: "04", icon: PartyPopper, title: "Disfrutar", desc: "Sin estrés" },
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
              Organiza tu próximo
              <br />
              viaje sin caos.
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

      {/* ── 2. Insight ───────────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-insight-open v3-ac">
            <div>
              <h2>
                El problema
                <br />
                no es la gente.
              </h2>
            </div>
            <div>
              <p className="v3-insight-statement">
                Es tener mensajes, tickets, pagos y decisiones repartidos en sitios distintos.
              </p>
              <div className="v3-insight-pain-row" aria-label="Problemas habituales">
                {problemItems.map((item) => (
                  <span key={item.label}>
                    <item.icon size={18} strokeWidth={2.25} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Propuesta de valor ─────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
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

      {/* ── 4. Cómo funciona ──────────────────────────── */}
      <section id="como-funciona" className="v3-section v3-section-alt v3-animate-section">
        <div className="v3-section-inner">
          <h2 className="v3-ac">Cuatro pasos, cero complicaciones.</h2>
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

      {/* ── 5. Producto y diferenciación ──────────────── */}
      <section id="producto" className="v3-section v3-product v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-product-grid">
            <div>
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
            <div className="v3-product-screenshot-wrap v3-ac">
              <Image
                src="/images/Captura-detalle-plan.png"
                alt="Detalle de un plan en Frimee"
                width={1206}
                height={2622}
                className="v3-product-screenshot"
                sizes="(max-width: 767px) 82vw, 34vw"
              />
            </div>
          </div>

          <div className="v3-compare-block">
            <h2 className="v3-ac">¿Por qué Frimee y no lo que ya usas?</h2>
          </div>
          <div className="v3-compare-grid v3-compare-grid-compact">
            <div className="v3-compare-card muted v3-ac">
              <p className="v3-compare-card-title">WhatsApp</p>
              {compareItems.whatsapp.map((item) => (
                <div key={item} className="v3-compare-item">
                  <X size={16} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <div className="v3-compare-card muted v3-ac">
              <p className="v3-compare-card-title">Excel / Notion</p>
              {compareItems.excel.map((item) => (
                <div key={item} className="v3-compare-item">
                  <X size={16} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <div className="v3-compare-card highlight v3-ac">
              <p className="v3-compare-card-title">Frimee</p>
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

      {/* ── 6. Testimonios ────────────────────────────── */}
      <AnimatedTestimonials testimonials={testimonials} />

      {/* ── Pricing ───────────────────────────────────── */}
      <section className="v3-section v3-pricing-section v3-animate-section">
        <PricingSection
          plans={pricingPlans}
          heading="Simple y transparente."
          description="Sin sorpresas, sin letra pequeña. Empieza gratis y sube cuando lo necesites."
        />
      </section>

      {/* ── 7. Demo ──────────────────────────────────── */}
      <section id="demo" className="v3-demo-dark v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-demo-split">
            <div className="v3-demo-left">
              <span className="v3-demo-badge v3-ac">Acceso anticipado</span>
              <h2 className="v3-demo-heading v3-ac">
                Pruébalo<br />ahora.
              </h2>
              <p className="v3-demo-desc v3-ac">
                Descarga Frimee, crea tu primer plan e invita a tus amigos con un enlace. Sin caos, sin grupos de WhatsApp.
              </p>
            </div>

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

      {/* ── 8. Comunidad y feedback ──────────────────── */}
      <section className="v3-section v3-section-alt v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-community-feedback">
            <div className="v3-community-copy">
              <h2 className="v3-ac">Estamos construyendo esto contigo.</h2>
              <div className="v3-social-cards v3-social-cards-compact">
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
            <div className="v3-feedback-card v3-ac">
              <div>
                <h2>
                  ¿Ideas o problemas?
                  <br />
                  Queremos escucharte.
                </h2>
              </div>
              <div className="v3-feedback-action">
                <div className="v3-feedback-icon">
                  <Mail size={22} strokeWidth={2} />
                </div>
                <a className="v3-feedback-mail" href="mailto:hola@frimee.app">
                  hola@frimee.app
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ ───────────────────────────────────── */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
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
