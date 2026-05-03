import Navbar from "@/components/landing/Navbar";
import { APP_REGISTER_URL } from "@/config/links";
import ScrollEffects from "@/components/landing/ScrollEffects";
import PhoneMockup from "@/components/landing/PhoneMockup";
import ValueCarousel from "@/components/landing/ValueCarousel";
import FlowStepper from "@/components/landing/FlowStepper";
import WaitlistSection from "@/components/landing/WaitlistSection";
import { AnimatedTestimonials } from "@/components/blocks/animated-testimonials";
import { PricingSection, type Plan } from "@/components/ui/pricing";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Footer7 } from "@/components/ui/footer-7";
import {
  MapPin,
  Receipt,
  Images,
  MessageSquare,
  Check,
  X,
  MessageCircle,
  ReceiptText,
  QrCode,
  Smartphone,
  WalletCards,
} from "lucide-react";

const storySteps = [{ title: "Todo" }, { title: "en la misma" }, { title: "app" }];

const problemItems = [
  { icon: MessageCircle, label: "Mensajes caóticos" },
  { icon: ReceiptText, label: "Tickets perdidos" },
  { icon: WalletCards, label: "Pagos desordenados" },
];


const featureItems = [
  { icon: MapPin, title: "Itinerario" },
  { icon: Receipt, title: "Gastos" },
  { icon: Images, title: "Álbum" },
  { icon: MessageSquare, title: "Chat" },
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
    ],
    btn: { text: "Empezar con Max", href: APP_REGISTER_URL },
  },
];

const faqItems = [
  {
    q: "¿Es gratis?",
    a: "Sí, Frimee es completamente gratuito. Las suscripciones ofrecen funcionalidades adicionales y son opcionales.",
  },
  {
    q: "¿Cómo se usa?",
    a: "Descarga la app, crea un plan e invita a tus amigos. En segundos podéis empezar a organizar.",
  },
  {
    q: "¿Está en móvil?",
    a: "Sí, Frimee está disponible para iOS y Android. También funciona desde el navegador.",
  },
  {
    q: "¿Cómo envío feedback?",
    a: "Puedes escribirnos directamente a contact@frimee.es.",
  },
];

export default function LandingV3Page() {
  return (
    <main className="landing-page v3-page min-h-dvh">
      <ScrollEffects />
      <Navbar />

      {/* -- 1. Hero ------------------------------------ */}
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
            <div className="v3-hero-mockup-glow" />
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

      {/* -- 2. Insight --------------------------------- */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-insight-open v3-ac">
            <div>
              <h2>
                El&nbsp;problema
                <br />
                no&nbsp;es&nbsp;la&nbsp;gente.
              </h2>
            </div>
            <div className="v3-insight-copy">
              <p className="v3-insight-statement">
                Es tener mensajes, pagos y decisiones repartidos en sitios&nbsp;distintos.
              </p>
            </div>
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
      </section>

      {/* -- 3. Propuesta de valor ----------------------- */}
      <section className="v3-section v3-animate-section">
        <div className="v3-section-inner">
          <div className="v3-value-split">
            <ValueCarousel />
            <h2 className="v3-ac">
              Planes, decisiones
              <br />
              y recuerdos en un
              <br />
              mismo lugar
            </h2>
          </div>
        </div>
      </section>

      {/* -- 4. Cómo funciona ---------------------------- */}
      <section id="como-funciona" className="v3-section v3-section-alt v3-animate-section">
        <div className="v3-section-inner">
          <h2 className="v3-ac v3-section-heading-full">Cuatro pasos, <br/>cero complicaciones.</h2>
          <FlowStepper />
        </div>
      </section>

      {/* -- 5. Producto y diferenciación ---------------- */}
      <section id="producto" className="v3-section v3-product v3-animate-section">
        <div className="v3-product-hero-grid">
          <div className="v3-product-hero-content">
            <h2 className="v3-ac v3-product-heading">
              <span style={{ whiteSpace: "nowrap" }}>Lo importante</span>
              <br />
              <span style={{ whiteSpace: "nowrap" }}>del plan, visible.</span>
            </h2>
            <div className="v3-feature-cards">
              {featureItems.map((fi) => {
                const Icon = fi.icon;
                return (
                  <div key={fi.title} className="v3-feature-card v3-ac">
                    <Icon size={18} strokeWidth={2} />
                    <span>{fi.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="v3-product-hero-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mockup-plan.png"
              alt="Detalle de un plan en Frimee"
              className="v3-product-mockup"
            />
          </div>
        </div>

        <div className="v3-section-inner">
          <div className="v3-compare-block">
            <h2 className="v3-ac v3-pricing-heading">
              ¿Por qué <span className="v3-brand-word">Frimee</span> y no lo que ya usas?
            </h2>
          </div>
          <div className="v3-compare-grid v3-compare-grid-compact">
            <div className="v3-compare-card muted v3-ac">
              <p className="v3-compare-card-title">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/WhatsApp_icon.png" alt="WhatsApp" className="v3-compare-card-logo" />
              </p>
              {compareItems.whatsapp.map((item) => (
                <div key={item} className="v3-compare-item">
                  <X size={16} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <div className="v3-compare-card muted v3-ac">
              <p className="v3-compare-card-title">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/excel_icon.png" alt="Excel / Notion" className="v3-compare-card-logo" />
              </p>
              {compareItems.excel.map((item) => (
                <div key={item} className="v3-compare-item">
                  <X size={16} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <div className="v3-compare-card highlight v3-ac">
              <p className="v3-compare-card-title">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo-frimee-black.png"
                  alt="Frimee"
                  className="v3-compare-card-logo v3-compare-frimee-logo-light"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo-frimee.png"
                  alt="Frimee"
                  className="v3-compare-card-logo v3-compare-frimee-logo-dark"
                />
              </p>
              {compareItems.frimee.map((item) => (
                <div key={item} className="v3-compare-item">
                  <Check size={16} color="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -- 6. Testimonios ------------------------------ */}
      <AnimatedTestimonials testimonials={testimonials} />

      {/* -- Pricing ------------------------------------- */}
      <section id="precios" className="v3-section v3-pricing-section v3-animate-section">
        <PricingSection
          plans={pricingPlans}
          heading="Simple y transparente."
          description="Empieza gratis y escala cuando lo necesites."
        />
      </section>

      {/* -- 7. Demo ------------------------------------ */}
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

      <WaitlistSection />
      {/* -- 8. FAQ ------------------------------------- */}
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

      {/* -- Footer -------------------------------------- */}
      <Footer7 />
    </main>
  );
}
