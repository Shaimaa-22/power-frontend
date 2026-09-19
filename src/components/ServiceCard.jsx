import { Link } from '../router';
import { useI18n } from '../i18n/I18nProvider';
import Arrow from './Arrow';
import '../styles/service-card.css';

export default function ServiceCard({ service }) {
  const { t } = useI18n();
  const { key, slug, image, imagePosition, Icon } = service;
  const base = `services.items.${key}`;
  const title = t(`${base}.title`);
  const tags = t(`${base}.tags`);

  return (
    <article className="service-card">
      <div className="service-card__top">
        <div className="service-card__media">
          <img src={image} alt="" loading="lazy" style={imagePosition ? { objectPosition: imagePosition } : undefined} />
        </div>
        <span className="service-card__icon">
          <Icon aria-hidden="true" />
        </span>
      </div>

      <div className="service-card__body">
        <h3 className="service-card__title">{title}</h3>
        <p className="service-card__desc">{t(`${base}.description`)}</p>
        <Link to={`/services/${slug}`} className="service-card__more" aria-label={`${title} — ${t('services.learn_more')}`}>
          <span>{t('services.learn_more')}</span>
          <Arrow />
        </Link>
      </div>

      {Array.isArray(tags) && (
        <ul className="service-card__tags">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
