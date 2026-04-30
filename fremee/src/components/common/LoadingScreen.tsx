"use client";

import Image from "next/image";
import styles from "@/components/common/LoadingScreen.module.css";

type LoadingScreenProps = {
  fullscreen?: boolean;
  compact?: boolean;
  size?: "default" | "sm";
};

export default function LoadingScreen({ fullscreen = true, compact = false, size = "default" }: LoadingScreenProps) {
  return (
    <div
      className={`${styles.root} ${fullscreen ? styles.fullscreen : compact ? styles.compact : styles.inline} ${size === "sm" ? styles.small : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    >
      <div className={styles.content}>
        <div className={styles.loader} aria-hidden="true">
          <div className={styles.ring} />
          <Image
            src="/Frimee_personaje.png"
            alt=""
            width={92}
            height={110}
            className={styles.avatar}
            priority
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
