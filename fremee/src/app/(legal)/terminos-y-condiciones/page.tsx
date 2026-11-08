import type { Metadata } from "next";
import Link from "next/link";
import LegalDocument, { type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = { title: "Términos y Condiciones" };

const ADDRESS = "Carrer Mestre Candi, 30, 08901 L'Hospitalet de Llobregat, Barcelona";
const privacyLink = (
  <Link href="/politica-de-privacidad" className="text-app underline underline-offset-4">Política de Privacidad</Link>
);

const sections: LegalSection[] = [
  {
    title: "Titularidad",
    body: (
      <p>
        Frimee es titularidad de Cayetano Yeste.
        <br />
        Correo electrónico de contacto: contact@frimee.es
        <br />
        Domicilio a efectos de notificaciones: {ADDRESS}
        <br />
        Sitio web: frimee.es
      </p>
    ),
  },
  {
    title: "Servicio",
    body: (
      <>
        <p>
          Frimee permite crear, organizar y gestionar viajes en grupo: itinerario con mapas y rutas, gastos compartidos,
          chat y llamadas, álbum de fotos, cartera de billetes y un asistente con inteligencia artificial.
        </p>
        <p>
          Frimee es una herramienta de organización. No es una agencia de viajes, operador turístico ni intermediario
          de reservas, y no gestiona pagos: los gastos y deudas que registras son una ayuda para repartir cuentas entre
          participantes.
        </p>
      </>
    ),
  },
  {
    title: "Cuenta, modo invitado y edad mínima",
    body: (
      <>
        <p>
          Para usar Frimee necesitas una cuenta. Te comprometes a dar información veraz y a mantener tus credenciales
          en secreto.
        </p>
        <p>
          También puedes probar Frimee como invitado, sin registrarte. La cuenta de invitado se borra con todo su
          contenido a los 7 días, salvo que la guardes antes con tu correo.
        </p>
        <p>
          Frimee está dirigida a mayores de 14 años, edad mínima que fija en España la LOPDGDD para consentir el
          tratamiento de datos personales. Los menores de 14 años necesitan autorización de sus padres, madres o
          tutores.
        </p>
      </>
    ),
  },
  {
    title: "Uso permitido",
    body: (
      <>
        <p>Te comprometes a usar Frimee de forma legal, responsable y respetuosa.</p>
        <p>
          No está permitido usarla con fines ilícitos, fraudulentos o abusivos; publicar contenido falso, ofensivo o que
          vulnere derechos de terceros; acceder a datos o sistemas sin autorización; interferir en su seguridad o
          funcionamiento; enviar spam; ni copiar, modificar o hacer ingeniería inversa de la aplicación.
        </p>
        <p>Frimee podrá suspender o cancelar las cuentas que incumplan estos términos.</p>
      </>
    ),
  },
  {
    title: "Tu contenido",
    body: (
      <>
        <p>
          El contenido que subes (mensajes, fotos, planes, gastos…) sigue siendo tuyo. Nos autorizas a alojarlo,
          procesarlo y mostrarlo a las personas con las que lo compartes, solo en la medida necesaria para prestar el
          servicio.
        </p>
        <p>
          Declaras que tienes los derechos o autorizaciones necesarios para compartirlo, especialmente cuando incluye
          datos o imágenes de otras personas.
        </p>
      </>
    ),
  },
  {
    title: "Inteligencia artificial",
    body: (
      <p>
        Las respuestas del asistente @frimee, las lecturas automáticas de tickets y otras funciones con IA son
        orientativas y pueden contener errores o información desactualizada. Comprueba la información importante antes
        de decidir, sobre todo precios, horarios, reservas, documentación, visados, salud, seguridad o transporte.
      </p>
    ),
  },
  {
    title: "Servicios de terceros",
    body: (
      <p>
        Frimee enlaza o se integra con servicios de terceros, como Google Maps, Waze o Google Calendar. Lo que reserves,
        compres o contrates con terceros se rige por sus propias condiciones, y Frimee no responde de su disponibilidad,
        precios o incidencias.
      </p>
    ),
  },
  {
    title: "Propiedad intelectual",
    body: (
      <p>
        Los derechos sobre Frimee (marca, logotipo, diseño, software, textos y elementos gráficos) pertenecen a su
        titular o a sus licenciantes. Usar la aplicación no te da ningún derecho sobre ellos.
      </p>
    ),
  },
  {
    title: "Disponibilidad y responsabilidad",
    body: (
      <>
        <p>
          Procuramos que Frimee esté disponible y sea segura, pero no garantizamos un funcionamiento continuo ni libre
          de errores.
        </p>
        <p>
          Eres responsable del uso que haces de Frimee y de las decisiones que tomas con ella. Frimee no responde de
          daños derivados de un uso indebido, de información incorrecta introducida por los usuarios, de respuestas de
          la IA, de servicios de terceros, de conflictos entre participantes ni de fallos técnicos que no le sean
          imputables.
        </p>
        <p>Nada de lo anterior limita los derechos que la ley reconoce a los consumidores.</p>
      </>
    ),
  },
  {
    title: "Protección de datos",
    body: (
      <p>
        Tratamos tus datos conforme al RGPD y a la LOPDGDD. Toda la información (qué datos, para qué, con qué
        proveedores, cuánto tiempo y cómo ejercer tus derechos) está en la {privacyLink}.
      </p>
    ),
  },
  {
    title: "Baja",
    body: (
      <p>
        Puedes pedir la baja cuando quieras desde Ajustes o escribiendo a contact@frimee.es. Se elimina tu acceso y tus
        datos personales se borran en un plazo máximo de 30 días.
      </p>
    ),
  },
  {
    title: "Cambios en estos términos",
    body: (
      <p>
        Podemos modificar estos términos por motivos legales, técnicos o del servicio. Si el cambio es importante, te
        avisaremos por la app o por correo.
      </p>
    ),
  },
  {
    title: "Legislación aplicable y contacto",
    body: (
      <>
        <p>
          Estos términos se rigen por la legislación española y la normativa europea aplicable. Si actúas como
          consumidor, puedes acudir a los tribunales de tu domicilio.
        </p>
        <p>
          Email: contact@frimee.es
          <br />
          Domicilio a efectos de notificaciones: {ADDRESS}
        </p>
      </>
    ),
  },
];

export default function TerminosYCondicionesPage() {
  return (
    <LegalDocument
      title="Términos y Condiciones"
      updated="8 de noviembre de 2026"
      intro={
        <p>
          Estos términos regulan el uso de Frimee, la aplicación web (frimee.es) y móvil para organizar viajes en grupo.
          Al crear una cuenta o usar Frimee como invitado, los aceptas.
        </p>
      }
      sections={sections}
    />
  );
}
