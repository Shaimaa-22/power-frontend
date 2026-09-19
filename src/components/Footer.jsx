import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from 'react-icons/fa';
import { LuMail, LuMapPin, LuPhone } from 'react-icons/lu';
import { SOCIAL_LINKS, toTel, toWhatsApp } from '../config/site';
import { useI18n } from '../i18n/I18nProvider';
import { Link } from '../router';
import Logo from './Logo';
import '../styles/footer.css';

const LINKS = [
  { key: 'home', to: '/' },
  { key: 'services', to: '/services' },
  { key: 'about', to: '/about' },
  { key: 'contact', to: '/contact' },
];

const SOCIALS = [
  { key: 'facebook', Icon: FaFacebookF, label: 'Facebook' },
  { key: 'instagram', Icon: FaInstagram, label: 'Instagram' },
  { key: 'linkedin', Icon: FaLinkedinIn, label: 'LinkedIn' },
  { key: 'whatsapp', Icon: FaWhatsapp, label: 'WhatsApp' },
];

export default function Footer() {
  const { t } = useI18n();
  const phone1 = t('footer.phone_1');
  const phone2 = t('footer.phone_2');
  const email = t('footer.email');

  return (
    <footer className="footer">
      <div className="wide footer__grid ltr-frame">
        <div className="footer__brand">
          <Link to="/" aria-label={t('brand.name')}>
            <Logo variant="light" height={100} />
          </Link>
        </div>

        <div className="footer__about">
          <p className="footer__tagline">{t('footer.tagline')}</p>
          <ul className="footer__social">
            {SOCIALS.map(({ key, Icon, label }) => (
              <li key={key}>
                <a
                  href={SOCIAL_LINKS[key]}
                  aria-label={label}
                  {...(SOCIAL_LINKS[key] !== '#' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <Icon aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav className="footer__col footer__links" aria-label={t('footer.quick_links_title')}>
          <h3>{t('footer.quick_links_title')}</h3>
          <ul>
            {LINKS.map(({ key, to }) => (
              <li key={key}>
                <Link to={to}>{t(`footer.links.${key}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col footer__contact">
          <h3>{t('footer.contact_title')}</h3>
          <ul>
            <li>
              <LuPhone aria-hidden="true" />
              <a href={toTel(phone1)} dir="ltr">{phone1}</a>
            </li>
            <li>
              <FaWhatsapp aria-hidden="true" />
              <a href={toWhatsApp(phone2)} target="_blank" rel="noopener noreferrer" dir="ltr">{phone2}</a>
            </li>
            <li>
              <LuMail aria-hidden="true" />
              <a href={`mailto:${email}`}>{email}</a>
            </li>
            <li>
              <LuMapPin aria-hidden="true" className="footer__pin" />
              <span>{t('footer.location')}</span>
            </li>
          </ul>
        </div>

        <div className="footer__col footer__copy">
          <p dir="ltr">{t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
