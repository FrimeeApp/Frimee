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
            src="/logo-frimee-black.png"
            alt=""
            width={96}
            height={96}
            className={`${styles.avatar} ${styles.logoLight}`}
            priority
            unoptimized
          />
          <Image
            src="/logo-frimee.png"
            alt=""
            width={96}
            height={96}
            className={`${styles.avatar} ${styles.logoDark}`}
            priority
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
