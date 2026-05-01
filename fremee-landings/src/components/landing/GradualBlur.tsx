import type { CSSProperties } from "react";

type GradualBlurProps = {
  position?: "top" | "bottom";
  height?: string;
  strength?: number;
  divCount?: number;
  opacity?: number;
  className?: string;
};

export default function GradualBlur({
  position = "bottom",
  height = "7rem",
  strength = 1.5,
  divCount = 4,
  opacity = 1,
  className = "",
}: GradualBlurProps) {
  const layers = Array.from({ length: divCount }, (_, index) => {
    const start = (index / divCount) * 100;
    const end = ((index + 1) / divCount) * 100;
    const blur = (index + 1) * strength * 2;

    const mask =
      position === "bottom"
        ? `linear-gradient(to bottom, transparent ${start}%, black ${end}%)`
        : `linear-gradient(to top, transparent ${start}%, black ${end}%)`;

    return {
      blur,
      mask,
    };
  });

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-10 overflow-hidden ${position === "bottom" ? "bottom-0" : "top-0"} ${className}`}
      style={{ height, opacity }}
      aria-hidden="true"
    >
      {layers.map((layer) => (
        <div
          key={`${layer.blur}-${layer.mask}`}
          className="absolute inset-0"
          style={
            {
              backdropFilter: `blur(${layer.blur}px)`,
              WebkitBackdropFilter: `blur(${layer.blur}px)`,
              maskImage: layer.mask,
              WebkitMaskImage: layer.mask,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
