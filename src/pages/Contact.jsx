import { FaWhatsapp } from 'react-icons/fa';
import { LuMail, LuMapPin, LuPhone } from 'react-icons/lu';
import { toTel, toWhatsApp } from '../config/site';
import { useI18n } from '../i18n/I18nProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import PageHero from '../components/PageHero';
import Button from '../components/Button';
import '../styles/contact.css';

export default function Contact() {
  const { t } = useI18n();
  usePageTitle(t('nav.contact'));

  const phone1 = t('footer.phone_1');
  const phone2 = t('footer.phone_2');
  const email = t('footer.email');

  const cards = [
    { key: 'phone', Icon: LuPhone, label: t('contact_page.phone'), value: phone1, href: toTel(phone1), ltr: true },
    { key: 'whatsapp', Icon: FaWhatsapp, label: t('contact_page.whatsapp'), value: phone2, href: toWhatsApp(phone2, t('common.whatsapp_message')), ltr: true, external: true },
    { key: 'email', Icon: LuMail, label: t('contact_page.email'), value: email, href: `mailto:${email}`, ltr: true },
    { key: 'location', Icon: LuMapPin, label: t('contact_page.location'), value: t('footer.location') },
  ];

  return (
    <>
      <PageHero eyebrow={t('cta_section.title')} title={t('nav.contact')} description={t('cta_section.description')} image="/images/cta-bg.webp" />
      <section className="contact">
        <div className="container">
          <ul className="contact__grid ltr-frame">
            {cards.map(({ key, Icon, label, value, href, ltr, external }) => (
              <li key={key} className="contact-card">
                <span className="contact-card__icon">
                  <Icon aria-hidden="true" />
                </span>
                <h3>{label}</h3>
                {href ? (
                  <a href={href} dir={ltr ? 'ltr' : undefined} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    {value}
                  </a>
                ) : (
                  <p>{value}</p>
                )}
              </li>
            ))}
          </ul>
          <div className="contact__cta">
            <p>{t('cta_section.subtitle')}</p>
            <Button href={toWhatsApp(phone2, t('common.whatsapp_message'))} icon={<FaWhatsapp aria-hidden="true" />}>
              {t('cta_section.cta_whatsapp')}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
