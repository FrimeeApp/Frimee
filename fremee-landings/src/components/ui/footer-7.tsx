import React from "react";
import { FaInstagram, FaXTwitter } from "react-icons/fa6";
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
  socialLinks?: Array<{
    icon: React.ReactElement;
    href: string;
    label: string;
  }>;
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
      { name: "Características", href: "#" },
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
      { name: "Contacto", href: "mailto:hola@frimee.app" },
      { name: "Feedback", href: "mailto:hola@frimee.app" },
      { name: "Estado", href: "#" },
    ],
  },
];

const defaultSocialLinks: Footer7Props["socialLinks"] = [
  { icon: <FaInstagram className="size-[1.1rem]" />, href: "https://instagram.com/frimeeapp", label: "Instagram" },
  { icon: <FaXTwitter className="size-[1.1rem]" />, href: "https://twitter.com/frimeeapp", label: "X / Twitter" },
];

const defaultLegalLinks: Footer7Props["legalLinks"] = [
  { name: "Términos y condiciones", href: "#" },
  { name: "Política de privacidad", href: "#" },
];

export const Footer7 = ({
  logo = {
    url: "/",
    src: "/logo-frimee-black.png",
    alt: "Frimee",
    title: "Frimee",
  },
  sections = defaultSections,
  description = "Organiza tus planes con amigos sin el caos. Todo en un solo lugar.",
  socialLinks = defaultSocialLinks,
  copyright = `© ${new Date().getFullYear()} Frimee. Todos los derechos reservados.`,
  legalLinks = defaultLegalLinks,
}: Footer7Props) => {
  return (
    <footer className="v3-footer">
      <div className="v3-footer-inner">
        {/* Top row */}
        <div className="v3-footer-top">
          {/* Brand column */}
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
              <span className="v3-footer-logo-name">{logo.title}</span>
            </a>
            <p className="v3-footer-desc">{description}</p>
            <ul className="v3-footer-socials">
              {socialLinks!.map((social, idx) => (
                <li key={idx}>
                  <a
                    href={social.href}
                    aria-label={social.label}
                    target="_blank"
                    rel="noreferrer"
                    className="v3-footer-social-link"
                  >
                    {social.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns */}
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

        {/* Bottom row */}
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
