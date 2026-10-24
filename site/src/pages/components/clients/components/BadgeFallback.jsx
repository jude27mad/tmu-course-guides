import styles from '@src/pages/components/clients/styles/badgeFallback.module.scss';

// The 3D card shrinks a long line to fit (fitFont in badgeTextures.js); here the font scales with the length of
// the text. `chars` is how many characters of that line fit the card at full size.
const fit = (text, chars) => Math.min(1, chars / Math.max(1, String(text).length));

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
        <span className={styles.code} style={{ '--fit': fit(look.code, 6) }}>
          {look.code}
        </span>
        <span className={styles.name} style={{ '--fit': fit(look.name, 19) }}>
          {look.name}
        </span>
        <span className={styles.divider} />
        <span className={styles.nextLabel}>{look.nextLabel}</span>
        <span className={styles.nextValue} style={{ '--fit': fit(look.nextValue, 18) }}>
          {look.nextValue}
        </span>
      </div>
    </div>
  );
}
