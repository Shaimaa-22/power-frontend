import { LANGUAGES, useI18n } from '../i18n/I18nProvider';
import '../styles/language-switcher.css';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('common.language')}>
      {Object.entries(LANGUAGES).map(([code, { short, name }]) => (
        <button
          key={code}
          type="button"
          className={`lang-switch__btn${code === lang ? ' is-active' : ''}`}
          onClick={() => setLang(code)}
          aria-pressed={code === lang}
          aria-label={name}
          title={name}
          lang={code}
        >
          {short}
        </button>
      ))}
    </div>
  );
}
