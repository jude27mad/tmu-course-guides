import styles from './preview.module.scss';
export default function PreviewFrame({ enabled, children }) {
  return enabled ? <div className={styles.readable} data-window-preview="mth140">{children}</div> : children;
}
