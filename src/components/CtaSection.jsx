import { FaWhatsapp } from 'react-icons/fa';
import { LuPhone } from 'react-icons/lu';
import { toWhatsApp } from '../config/site';
import { useI18n } from '../i18n/I18nProvider';
import Button from './Button';
import '../styles/cta.css';

export default function CtaSection() {
  const { t } = useI18n();
  return (
    <section className="cta">
      <img className="cta__bg" src="/images/cta-bg.webp" alt="" loading="lazy" />
      <div className="cta__shade" aria-hidden="true" />
      <div className="container cta__inner ltr-frame">
        <div className="cta__actions">
          <Button
            href={toWhatsApp(t('footer.phone_2'), t('common.whatsapp_message'))}
            icon={<FaWhatsapp aria-hidden="true" />}
          >
            {t('cta_section.cta_whatsapp')}
          </Button>
          <Button to="/contact" variant="outline-light" icon={<LuPhone aria-hidden="true" className="cta__phone" />}>
            {t('cta_section.cta_info')}
          </Button>
        </div>
        <div className="cta__text">
          <p className="cta__eyebrow">{t('cta_section.title')}</p>
          <h2 className="cta__title">{t('cta_section.subtitle')}</h2>
          <p className="cta__desc">{t('cta_section.description')}</p>
        </div>
      </div>
    </section>
  );
}
