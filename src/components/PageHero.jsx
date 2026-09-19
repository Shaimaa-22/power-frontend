import '../styles/page-hero.css';

/** Navy banner at the top of the inner pages (services / service detail / about / contact). */
export default function PageHero({ eyebrow, title, description, image, imagePosition, children }) {
  return (
    <section className="page-hero">
      {image && (
        <img
          className="page-hero__bg"
          src={image}
          alt=""
          style={imagePosition ? { objectPosition: imagePosition } : undefined}
        />
      )}
      <div className="page-hero__shade" aria-hidden="true" />
      <div className="container page-hero__inner">
        {eyebrow && (
          <p className="eyebrow">
            <span>{eyebrow}</span>
            <i className="eyebrow__dash" aria-hidden="true" />
          </p>
        )}
        <h1 className="page-hero__title">{title}</h1>
        {description && <p className="page-hero__desc">{description}</p>}
        {children}
      </div>
    </section>
  );
}
