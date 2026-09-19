import { useI18n } from '../i18n/I18nProvider';
import Button from './Button';
import Arrow from './Arrow';
import '../styles/hero.css';

export default function Hero() {
  const { t } = useI18n();
  const title = t('hero.title');
  const accent = t('hero.title_accent');
  const at = title.indexOf(accent);
  const head = at > 0 ? title.slice(0, at).trim() : title;
  const highlighted = at > 0 ? accent : null;

  return (
    <section className="hero">
      <img className="hero__bg" src="/images/hero.webp" alt="" fetchPriority="high" />
      <div className="hero__shade" aria-hidden="true" />
      <div className="wide hero__inner">
        <div className="hero__content">
          <p className="hero__eyebrow">{t('hero.eyebrow')}</p>
          <h1 className="hero__title">
            {head}
            {highlighted && <span className="hero__accent">{highlighted}</span>}
          </h1>
          <p className="hero__text">{t('hero.description')}</p>
          <div className="hero__actions ltr-frame">
            <Button to="/services" iconEnd={<Arrow />}>
              {t('hero.cta_primary')}
            </Button>
            <Button to="/contact" variant="outline-light">
              {t('hero.cta_secondary')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
