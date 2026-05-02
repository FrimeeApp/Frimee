"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Users, Camera } from "lucide-react";

const valueProps = [
  {
    icon: FolderOpen,
    title: "Todo en un sitio",
    desc: "Chats, fotos, tickets y gastos del plan en un solo lugar. Nunca más buscar en mil grupos.",
  },
  {
    icon: Users,
    title: "Decisiones en grupo",
    desc: "Votad actividades y destinos juntos. Sin debates infinitos ni decisiones unilaterales.",
  },
  {
    icon: Camera,
    title: "Experiencia compartida",
    desc: "Revivid el plan con fotos y recuerdos guardados automáticamente para siempre.",
  },
];

export default function ValueCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % valueProps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const current = valueProps[active];
  const Icon = current.icon;

  return (
    <div className="v3-value-carousel">
      <div key={active} className="v3-value-card">
        <Icon size={24} strokeWidth={2} className="v3-value-card-icon" />
        <h3>{current.title}</h3>
        <p>{current.desc}</p>
        <div className="v3-value-carousel-dots">
          {valueProps.map((_, i) => (
            <button
              key={i}
              className={`v3-value-carousel-dot${i === active ? " active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Ver ${valueProps[i].title}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
