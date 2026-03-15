"use client";

import styles from "@/components/common/LoadingScreen.module.css";

type LoadingScreenProps = {
  fullscreen?: boolean;
};

export default function LoadingScreen({ fullscreen = true }: LoadingScreenProps) {
  return (
    <div
      className={`${styles.root} ${fullscreen ? styles.fullscreen : styles.inline}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    >
      <div className={styles.content}>
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.forest}>
            <div className={`${styles.tree} ${styles.tree1}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
            </div>

            <div className={`${styles.tree} ${styles.tree2}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
              <div className={`${styles.branch} ${styles.branchBottom}`} />
            </div>

            <div className={`${styles.tree} ${styles.tree3}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
              <div className={`${styles.branch} ${styles.branchBottom}`} />
            </div>

            <div className={`${styles.tree} ${styles.tree4}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
              <div className={`${styles.branch} ${styles.branchBottom}`} />
            </div>

            <div className={`${styles.tree} ${styles.tree5}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
              <div className={`${styles.branch} ${styles.branchBottom}`} />
            </div>

            <div className={`${styles.tree} ${styles.tree6}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
              <div className={`${styles.branch} ${styles.branchBottom}`} />
            </div>

            <div className={`${styles.tree} ${styles.tree7}`}>
              <div className={`${styles.branch} ${styles.branchTop}`} />
              <div className={`${styles.branch} ${styles.branchMiddle}`} />
              <div className={`${styles.branch} ${styles.branchBottom}`} />
            </div>
          </div>

          <div className={styles.tent}>
            <div className={styles.roof} />
            <div className={styles.roofBorderLeft}>
              <div className={`${styles.roofBorder} ${styles.roofBorder1}`} />
              <div className={`${styles.roofBorder} ${styles.roofBorder2}`} />
              <div className={`${styles.roofBorder} ${styles.roofBorder3}`} />
            </div>
            <div className={styles.entrance}>
              <div className={`${styles.door} ${styles.leftDoor}`}>
                <div className={styles.leftDoorInner} />
              </div>
              <div className={`${styles.door} ${styles.rightDoor}`}>
                <div className={styles.rightDoorInner} />
              </div>
            </div>
          </div>

          <div className={styles.floor}>
            <div className={`${styles.ground} ${styles.ground1}`} />
            <div className={`${styles.ground} ${styles.ground2}`} />
          </div>

          <div className={styles.fireplace}>
            <div className={styles.support} />
            <div className={styles.support} />
            <div className={styles.bar} />
            <div className={styles.hanger} />
            <div className={styles.smoke} />
            <div className={styles.pan} />
            <div className={styles.fire}>
              <div className={`${styles.line} ${styles.line1}`}>
                <div className={`${styles.particle} ${styles.particle1}`} />
                <div className={`${styles.particle} ${styles.particle2}`} />
                <div className={`${styles.particle} ${styles.particle3}`} />
                <div className={`${styles.particle} ${styles.particle4}`} />
              </div>
              <div className={`${styles.line} ${styles.line2}`}>
                <div className={`${styles.particle} ${styles.particle1}`} />
                <div className={`${styles.particle} ${styles.particle2}`} />
                <div className={`${styles.particle} ${styles.particle3}`} />
                <div className={`${styles.particle} ${styles.particle4}`} />
              </div>
              <div className={`${styles.line} ${styles.line3}`}>
                <div className={`${styles.particle} ${styles.particle1}`} />
                <div className={`${styles.particle} ${styles.particle2}`} />
                <div className={`${styles.particle} ${styles.particle3}`} />
                <div className={`${styles.particle} ${styles.particle4}`} />
              </div>
            </div>
          </div>

          <div className={styles.timeWrapper}>
            <div className={styles.time}>
              <div className={styles.day} />
              <div className={styles.night}>
                <div className={styles.moon} />
                <div className={`${styles.star} ${styles.star1} ${styles.starBig}`} />
                <div className={`${styles.star} ${styles.star2} ${styles.starBig}`} />
                <div className={`${styles.star} ${styles.star3} ${styles.starBig}`} />
                <div className={`${styles.star} ${styles.star4}`} />
                <div className={`${styles.star} ${styles.star5}`} />
                <div className={`${styles.star} ${styles.star6}`} />
                <div className={`${styles.star} ${styles.star7}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
