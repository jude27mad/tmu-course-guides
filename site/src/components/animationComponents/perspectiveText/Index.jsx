import Link from 'next/link';
import clsx from 'clsx';
import styles from '@src/components/animationComponents/perspectiveText/perspectiveText.module.scss';

// Two stacked copies of the label that flip on hover. The second copy is
// decorative (hidden from screen readers and out of the tab order).
function PerspectiveText({ label, label2 = undefined, className = undefined, href = undefined, alignItems = 'center' }) {
  const alignmentClass = styles[`align-${alignItems}`] || styles.alignCenter;

  const renderContent = () => {
    if (href) {
      return (
        <>
          <Link scroll={false} href={href}>
            {label}
          </Link>
          <Link scroll={false} href={href} aria-hidden="true" tabIndex={-1}>
            {label2 || label}
          </Link>
        </>
      );
    }
    return (
      <>
        <p>{label}</p>
        <p aria-hidden="true">{label2 || label}</p>
      </>
    );
  };

  return (
    <div className={styles.root}>
      <div className={clsx(alignmentClass, className === null ? styles.perspectiveText : clsx(className || 'p-s', styles.perspectiveText))}>{renderContent()}</div>
    </div>
  );
}

export default PerspectiveText;
