import '../styles/content-state.css';

/** Centered message box used for empty / error states. */
export function StateBox({ icon, title, text, action }) {
  return (
    <div className="state-box" role="status">
      {icon && <div className="state-box__icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** Skeleton cards shown while the API responds (Neon can take a moment on a cold start). */
export function LoadingGrid({ count = 6, label }) {
  return (
    <div className="items-grid" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-card__img" />
          <div className="skeleton-card__line" />
          <div className="skeleton-card__line skeleton-card__line--short" />
        </div>
      ))}
    </div>
  );
}
