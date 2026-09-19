import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ar from './ar.json';
import en from './en.json';
import he from './he.json';

const dictionaries = { ar, en, he };

export const LANGUAGES = {
  ar: { dir: 'rtl', short: 'ع', name: 'العربية' },
  en: { dir: 'ltr', short: 'EN', name: 'English' },
  he: { dir: 'rtl', short: 'עב', name: 'עברית' },
};

const STORAGE_KEY = 'power_lang';
const DEFAULT_LANG = 'ar';

const lookup = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

const I18nContext = createContext(null);

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dictionaries[saved]) return saved;
  } catch {
    /* storage unavailable — ignore */
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  const { dir } = LANGUAGES[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang, dir]);

  /** t('hero.title') -> string | array | object. Falls back to English, then to the key itself. */
  const t = useCallback(
    (path) => lookup(dictionaries[lang], path) ?? lookup(dictionaries.en, path) ?? path,
    [lang]
  );

  /** Pick the localized column from a DB row: pick(item, 'title') -> item.title_<lang> (with fallbacks). */
  const pick = useCallback(
    (row, field) => {
      if (!row) return '';
      return row[`${field}_${lang}`] || row[`${field}_ar`] || row[`${field}_en`] || row[`${field}_he`] || '';
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, dir, setLang, t, pick }), [lang, dir, t, pick]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
