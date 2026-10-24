import styles from '@src/pages/components/clients/styles/badgeFallback.module.scss';

// The course badge as plain HTML, for a browser without WebGL: the card face the 3D lanyard prints (index,
// term, code, name, next date; textures in Badge's badgeTextures.js) hanging at rest from its band. The
// window is aria-hidden and the course text beside it says the same thing.
export default function BadgeFallback({ look }) {
  return (
    <div className={styles.root} data-badge-fallback>
      <div className={styles.strap} />
      <div className={styles.clip} />
      <div className={styles.card}>
        <span className={styles.slot} />
        <span className={styles.index}>{look.index}</span>
        <span className={styles.term}>{look.term}</span>
        <span className={styles.code}>{look.code}</span>
        <span className={styles.name}>{look.name}</span>
        <span className={styles.divider} />
        <span className={styles.nextLabel}>{look.nextLabel}</span>
        <span className={styles.nextValue}>{look.nextValue}</span>
      </div>
    </div>
  );
}
