import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm:  "size-8",
  md:  "size-9",
  lg:  "size-11",
};

const TEXT_CLASSES: Record<AvatarSize, string> = {
  sm:  "text-[11px]",
  md:  "text-xs",
  lg:  "text-body-sm",
};

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** Override with an exact pixel size (e.g. 20, 24, 28). Takes precedence over `size`. */
  px?: number;
  className?: string;
  /** Extra top margin applied to the wrapper (default "mt-0.5" for list alignment). Pass "" to skip. */
  topMargin?: string;
  /** Pixel size hint for the Image sizes attribute */
  imgSizes?: string;
}

export function Avatar({
  name,
  src,
  size = "lg",
  px,
  className = "",
  topMargin = "mt-0.5",
  imgSizes,
}: AvatarProps) {
  const initial = (name.trim()[0] || "U").toUpperCase();

  if (px !== undefined) {
    const style = { width: px, height: px, fontSize: px * 0.4 };
    const sizesPxStr = imgSizes ?? `${px}px`;
    if (src) {
      return (
        <div
          style={style}
          className={`relative shrink-0 overflow-hidden rounded-full border border-app ${topMargin} ${className}`}
        >
          <Image
            src={src}
            alt={name}
            fill
            sizes={sizesPxStr}
            className="object-cover"
            unoptimized
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }
    return (
      <div
        style={style}
        className={`flex shrink-0 items-center justify-center rounded-full border border-app bg-primary-token/20 font-[var(--fw-semibold)] text-primary-token ${topMargin} ${className}`}
      >
        {initial}
      </div>
    );
  }

  const sizeCls = SIZE_CLASSES[size];
  const textCls = TEXT_CLASSES[size];
  const sizesPx = imgSizes ?? (size === "lg" ? "44px" : size === "md" ? "36px" : "32px");

  if (src) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border border-app ${sizeCls} ${topMargin} ${className}`}
      >
        <Image
          src={src}
          alt={name}
          fill
          sizes={sizesPx}
          className="object-cover"
          unoptimized
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 font-[var(--fw-semibold)] text-muted ${sizeCls} ${textCls} ${topMargin} ${className}`}
    >
      {initial}
    </div>
  );
}
