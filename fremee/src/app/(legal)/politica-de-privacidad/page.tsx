import type { Metadata } from "next";
import Link from "next/link";
import LegalDocument, { LegalList, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = { title: "Política de Privacidad" };

const ADDRESS = "Carrer Mestre Candi, 30, 08901 L'Hospitalet de Llobregat, Barcelona";

const sections: LegalSection[] = [
  {
    title: "Responsable del tratamiento",
    body: (
      <>
        <p>El responsable del tratamiento de los datos personales tratados a través de Frimee es Cayetano Yeste.</p>
        <p>
          Correo electrónico de contacto: contact@frimee.es
          <br />
          Domicilio a efectos de notificaciones: {ADDRESS}
          <br />
          Sitio web: frimee.es
        </p>
      </>
    ),
  },
  {
    title: "Datos personales que tratamos",
    body: (
      <>
        <p>Según cómo uses Frimee, podemos tratar:</p>
        <LegalList
          items={[
            "Datos de cuenta: nombre, correo electrónico, nombre de usuario, foto de perfil, fecha de nacimiento si la indicas, contraseña cifrada, ajustes y preferencias. Si entras con Google, recibimos tu nombre, tu correo y tu foto de esa cuenta.",
            "Datos de tus viajes: planes, destinos, fechas, actividades con su ubicación, presupuestos, tareas y encuestas.",
            "Gastos y pagos entre participantes: importes, quién pagó, cómo se reparte, deudas y los comprobantes de pago que subas.",
            "Contenido que compartes: mensajes de chat, notas de voz, fotos, vídeos y documentos, fotos del álbum del plan, publicaciones, comentarios y \"me gusta\".",
            "Billetes y entradas que guardes en la cartera (wallet).",
            "Llamadas: Frimee conecta las llamadas de audio y vídeo en tiempo real pero no las graba; solo guarda que hubo una llamada y su duración.",
            "Si conectas Google Calendar, el permiso de acceso necesario para sincronizar tus planes con tu calendario.",
            "Datos del dispositivo y técnicos: identificador para las notificaciones push, dirección IP, tipo de navegador o dispositivo e informes de errores.",
            "Las consultas que nos envíes por correo.",
          ]}
        />
        <p>
          <b className="text-app">Modo invitado.</b> Puedes probar Frimee sin registrarte. La cuenta de invitado no
          tiene correo ni contraseña y se borra, con todo lo que contenga, a los 7 días, salvo que la guardes antes
          con tu correo.
        </p>
      </>
    ),
  },
  {
    title: "Para qué los usamos",
    body: (
      <LegalList
        items={[
          "Crear y gestionar tu cuenta y permitirte usar Frimee.",
          "Organizar viajes en grupo: itinerario, mapas y rutas, gastos y deudas, chat, llamadas, álbum y notificaciones.",
          "Mostrar, guardar y sincronizar la información que introduces, también con Google Calendar si lo activas.",
          "Responder a lo que pidas al asistente @frimee y leer tickets y entradas cuando lo solicites.",
          "Moderar comentarios públicos para evitar contenido ofensivo.",
          "Mantener la seguridad del servicio, evitar abusos (por ejemplo, limitando intentos) y corregir errores.",
          "Enviarte los correos necesarios del servicio: confirmación de cuenta, recuperación de contraseña o cambio de correo.",
          "Atender tus consultas y cumplir obligaciones legales.",
        ]}
      />
    ),
  },
  {
    title: "Base legal",
    body: (
      <LegalList
        items={[
          "Ejecución del contrato: para darte de alta y prestarte el servicio que pides.",
          "Interés legítimo: para la seguridad del servicio, prevenir abusos, corregir errores y atender consultas.",
          "Consentimiento: para funciones opcionales que tú activas, como conectar Google Calendar o recibir notificaciones push. Puedes retirarlo cuando quieras desde los ajustes.",
          "Obligación legal: cuando una norma nos obligue a conservar o comunicar datos.",
        ]}
      />
    ),
  },
  {
    title: "Datos de otras personas",
    body: (
      <>
        <p>
          En un plan puedes incluir información de otras personas, por ejemplo participantes de un viaje o los gastos
          que compartís. En ese caso declaras que puedes hacerlo y que, cuando sea necesario, les has informado.
        </p>
        <p>Frimee podrá eliminar o limitar información de terceros si detecta un uso ilícito o abusivo.</p>
      </>
    ),
  },
  {
    title: "Inteligencia artificial",
    body: (
      <>
        <LegalList
          items={[
            "Asistente @frimee: cuando alguien escribe @frimee en el chat de un plan, se envían a Anthropic (Claude) ese mensaje, la conversación reciente del chat y los datos del plan necesarios para responder (destino, fechas, actividades y saldos).",
            "Lectura de tickets y entradas: cuando subes una foto para leerla, la imagen se envía a OpenAI para extraer el concepto, el importe o los datos del billete.",
            "Moderación de comentarios: el texto de los comentarios se revisa con OpenAI antes de publicarse.",
          ]}
        />
        <p>
          Estos proveedores tratan los datos por cuenta de Frimee y, según sus condiciones de uso de la API, no los
          utilizan para entrenar sus modelos. Las respuestas de la IA son orientativas y pueden contener errores. No
          introduzcas información confidencial o sensible que no sea necesaria.
        </p>
      </>
    ),
  },
  {
    title: "Cuánto tiempo los conservamos",
    body: (
      <LegalList
        items={[
          "Mientras tu cuenta esté activa.",
          "Si pides eliminar tu cuenta (desde Ajustes o escribiendo a contact@frimee.es), se elimina tu acceso y tus datos personales se borran definitivamente en un plazo máximo de 30 días.",
          "Las cuentas de invitado se borran a los 7 días, con todo su contenido.",
          "Las rutas calculadas entre lugares se guardan en una caché común un máximo de 30 días.",
          "Algunos datos pueden conservarse más tiempo solo cuando la ley lo exija o para atender reclamaciones.",
        ]}
      />
    ),
  },
  {
    title: "Proveedores que nos ayudan a prestar el servicio",
    body: (
      <>
        <p>Frimee no vende tus datos. Los comparte solo con los proveedores necesarios, que actúan como encargados del tratamiento:</p>
        <LegalList
          items={[
            "Supabase: base de datos, cuentas y archivos, con servidores en Irlanda (Unión Europea).",
            "Vercel: alojamiento de la web.",
            "Google: Google Maps (mapas, búsqueda de lugares y cálculo de rutas), inicio de sesión con Google, Google Calendar si lo conectas, y Firebase (fotos del álbum, publicaciones y notificaciones push).",
            "Resend: envío de los correos de la cuenta.",
            "LiveKit: conexión de las llamadas de audio y vídeo.",
            "Anthropic y OpenAI: las funciones de inteligencia artificial descritas arriba.",
            "Sentry: informes de errores. En una pequeña parte de las sesiones puede guardar una reproducción de la pantalla con todo el texto y las imágenes ocultos.",
            "OpenFreeMap y OpenStreetMap: mapas del álbum del viaje; tu dispositivo descarga el mapa de sus servidores.",
            "Servicios de datos públicos (tiempo, cambio de divisas, vuelos y barcos): solo reciben el destino, las fechas o el número de vuelo, nunca tu nombre ni tu correo.",
          ]}
        />
        <p>
          También podremos comunicar datos cuando exista una obligación legal o un requerimiento de una autoridad
          competente.
        </p>
      </>
    ),
  },
  {
    title: "Transferencias internacionales",
    body: (
      <p>
        Algunos de estos proveedores son empresas de Estados Unidos o tratan datos fuera del Espacio Económico Europeo
        (por ejemplo Vercel, Google, Resend, LiveKit, Anthropic, OpenAI y Sentry). En esos casos las transferencias se
        amparan, según el proveedor, en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales
        tipo aprobadas por la Comisión Europea.
      </p>
    ),
  },
  {
    title: "Tus derechos",
    body: (
      <>
        <p>
          Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus
          datos, y retirar tu consentimiento cuando el tratamiento se base en él.
        </p>
        <p>
          Puedes cambiar tus datos desde Ajustes. Para eliminar tu cuenta o para cualquier otra solicitud, usa Ajustes
          o escribe a contact@frimee.es indicando qué derecho quieres ejercer y desde qué cuenta.
        </p>
      </>
    ),
  },
  {
    title: "Reclamaciones",
    body: (
      <p>
        Si consideras que no tratamos bien tus datos, puedes presentar una reclamación ante la Agencia Española de
        Protección de Datos (aepd.es).
      </p>
    ),
  },
  {
    title: "Seguridad",
    body: (
      <p>
        Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: conexiones cifradas, contraseñas
        cifradas y permisos que limitan lo que cada usuario puede ver a los planes de los que forma parte. Ningún
        sistema es completamente seguro, así que protege también tus credenciales y no compartas tu cuenta.
      </p>
    ),
  },
  {
    title: "Menores de edad",
    body: (
      <p>
        Frimee está dirigida a mayores de 14 años. Los menores de 14 años solo pueden usarla con autorización de sus
        padres, madres o tutores.
      </p>
    ),
  },
  {
    title: "Cookies y almacenamiento en tu dispositivo",
    body: (
      <>
        <p>
          Frimee no usa cookies publicitarias ni de analítica de terceros. Guarda en tu navegador o en el móvil solo lo
          necesario para funcionar: tu sesión, el tema, tus preferencias y una copia temporal de datos para que la app
          cargue más rápido.
        </p>
        <p>
          Al usar los mapas de Google y los informes de errores de Sentry, estos servicios pueden recibir datos técnicos
          de tu dispositivo (como la dirección IP) para funcionar.
        </p>
      </>
    ),
  },
  {
    title: "Cambios en esta política",
    body: (
      <p>
        Podemos actualizar esta política para adaptarla a cambios legales, técnicos o del servicio. Si el cambio es
        importante, te avisaremos por la app o por correo.
      </p>
    ),
  },
  {
    title: "Contacto",
    body: (
      <p>
        Email: contact@frimee.es
        <br />
        Domicilio a efectos de notificaciones: {ADDRESS}
      </p>
    ),
  },
];

export default function PoliticaDePrivacidadPage() {
  return (
    <LegalDocument
      title="Política de Privacidad"
      updated="8 de noviembre de 2026"
      intro={
        <>
          <p>
            Esta política explica qué datos personales trata Frimee, la aplicación web (frimee.es) y móvil para
            organizar viajes en grupo, para qué los usa y qué derechos tienes.
          </p>
          <p>
            Completa los <Link href="/terminos-y-condiciones" className="text-app underline underline-offset-4">Términos y Condiciones</Link>.
          </p>
        </>
      }
      sections={sections}
    />
  );
}
