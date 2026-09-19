import '../styles/section-heading.css';

/** Orange eyebrow (with the dash) + title. `tone="light"` is for dark backgrounds. */
export default function SectionHeading({ eyebrow, title, tone = 'dark', as: Tag = 'h2', className = '' }) {
  return (
    <div className={`section-heading section-heading--${tone} ${className}`.trim()}>
      {eyebrow && (
        <p className="eyebrow">
          <span>{eyebrow}</span>
          <i className="eyebrow__dash" aria-hidden="true" />
        </p>
      )}
      {title && <Tag className="section-heading__title">{title}</Tag>}
    </div>
  );
}
