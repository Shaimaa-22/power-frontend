import { useI18n } from '../i18n/I18nProvider';
import SectionHeading from './SectionHeading';
import Button from './Button';
import Arrow from './Arrow';
import '../styles/about.css';

export default function AboutBlock({ showCta = true }) {
  const { t } = useI18n();
  return (
    <section className="about">
      <div className="container about__grid ltr-frame">
        <div className="about__text">
          <SectionHeading eyebrow={t('about.eyebrow')} title={t('about.title')} />
          <p className="about__desc">{t('about.description')}</p>
          {showCta && (
            <Button to="/about" variant="outline-dark" size="sm" icon={<Arrow />}>
              {t('about.cta')}
            </Button>
          )}
        </div>
        <div className="about__media">
          <img src="/images/about.webp" alt="" loading="lazy" />
        </div>
      </div>
    </section>
  );
}
