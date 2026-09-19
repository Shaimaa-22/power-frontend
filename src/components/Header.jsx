import { useEffect, useState } from 'react';
import { LuMenu, LuSend, LuX } from 'react-icons/lu';
import { NavLink, Link, useRouter } from '../router';
import { useI18n } from '../i18n/I18nProvider';
import Logo from './Logo';
import Button from './Button';
import LanguageSwitcher from './LanguageSwitcher';
import '../styles/header.css';

const NAV = [
  { key: 'home', to: '/', end: true },
  { key: 'services', to: '/services' },
  { key: 'about', to: '/about' },
];

export default function Header() {
  const { t } = useI18n();
  const { location } = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <div className="wide header__inner">
        <Link to="/" className="header__logo" aria-label={t('brand.name')}>
          <Logo variant="dark" height={72} />
        </Link>

        <nav id="main-nav" className="header__nav" aria-label="Main">
          {NAV.map(({ key, to, end }) => (
            <NavLink key={key} to={to} end={end} className="nav-link">
              {t(`nav.${key}`)}
            </NavLink>
          ))}
          <NavLink to="/contact" className="nav-link nav-link--contact-mobile">
            {t('nav.contact')}
          </NavLink>
        </nav>

        <div className="header__actions">
          <LanguageSwitcher />
          <Button to="/contact" size="sm" icon={<LuSend aria-hidden="true" />} className="header__cta">
            {t('nav.contact')}
          </Button>
          <button
            type="button"
            className="header__burger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={t('common.menu')}
          >
            {open ? <LuX aria-hidden="true" /> : <LuMenu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
