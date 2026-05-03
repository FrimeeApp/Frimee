import React from "react";
import Image from "next/image";

interface Footer7Props {
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
  };
  sections?: Array<{
    title: string;
    links: Array<{ name: string; href: string }>;
  }>;
  description?: string;
  copyright?: string;
  legalLinks?: Array<{
    name: string;
    href: string;
  }>;
}

const defaultSections: Footer7Props["sections"] = [
  {
    title: "Producto",
    links: [
      { name: "Caracteristicas", href: "#" },
      { name: "Demo", href: "#" },
      { name: "Descarga", href: "#" },
      { name: "Novedades", href: "#" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { name: "Sobre nosotros", href: "#" },
      { name: "Blog", href: "#" },
      { name: "Trabaja con nosotros", href: "#" },
      { name: "Prensa", href: "#" },
    ],
  },
  {
    title: "Soporte",
    links: [
      { name: "Ayuda", href: "#" },
      { name: "Contacto", href: "mailto:contact@frimee.es" },
      { name: "Feedback", href: "mailto:contact@frimee.es" },
      { name: "Estado", href: "#" },
    ],
  },
];

const defaultLegalLinks: Footer7Props["legalLinks"] = [
  { name: "Terminos y condiciones", href: "/terminos-y-condiciones" },
  { name: "Politica de privacidad", href: "/politica-de-privacidad" },
];

export const Footer7 = ({
  logo = {
    url: "/",
    src: "/images/logo-frimee-black.png",
    alt: "Frimee",
    title: "Frimee",
  },
  sections = defaultSections,
  description = "Organiza tus planes con amigos sin el caos. Todo en un solo lugar.",
  copyright = `© ${new Date().getFullYear()} Frimee. Todos los derechos reservados.`,
  legalLinks = defaultLegalLinks,
}: Footer7Props) => {
  void description;

  return (
    <footer className="v3-footer">
      <div className="v3-footer-inner">
        <div className="v3-footer-top">
          <div className="v3-footer-brand">
            <a href={logo.url} className="v3-footer-logo">
              <Image
                src={logo.src}
                alt={logo.alt}
                title={logo.title}
                width={28}
                height={28}
                className="v3-footer-logo-img"
              />
            </a>

            <div className="v3-footer-contact">
              <p className="v3-footer-contact-title">Estamos construyendo esto contigo.</p>
              <p className="v3-footer-contact-copy">Ideas o problemas? Queremos escucharte.</p>
              <a href="mailto:contact@frimee.es" className="v3-footer-contact-mail">
                contact@frimee.es
              </a>
              <div className="v3-footer-contact-socials">
                <a
                  href="https://instagram.com/frimeeapp"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram de Frimee"
                  className="v3-footer-contact-social-link"
                >
                  <Image
                    src="/images/Instagram_icon.png"
                    alt="Instagram"
                    width={22}
                    height={22}
                    className="v3-footer-contact-social-icon"
                  />
                </a>
                <a
                  href="https://twitter.com/frimeeapp"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="X de Frimee"
                  className="v3-footer-contact-social-link"
                >
                  <Image
                    src="/images/X_icon.png"
                    alt="X"
                    width={22}
                    height={22}
                    className="v3-footer-contact-social-icon"
                  />
                </a>
              </div>
            </div>
          </div>

          <div className="v3-footer-links">
            {sections!.map((section, sIdx) => (
              <div key={sIdx} className="v3-footer-col">
                <h3 className="v3-footer-col-title">{section.title}</h3>
                <ul className="v3-footer-col-list">
                  {section.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <a href={link.href} className="v3-footer-col-link">
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="v3-footer-bottom">
          <p className="v3-footer-copyright">{copyright}</p>
          <ul className="v3-footer-legal">
            {legalLinks!.map((link, idx) => (
              <li key={idx}>
                <a href={link.href} className="v3-footer-legal-link">
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};
