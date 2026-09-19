import { LuSearchX } from 'react-icons/lu';
import { useI18n } from '../i18n/I18nProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { StateBox } from '../components/ContentState';
import Button from '../components/Button';

export default function NotFound() {
  const { t } = useI18n();
  usePageTitle(t('common.not_found_title'));
  return (
    <section className="container" style={{ padding: '96px 0' }}>
      <StateBox
        icon={<LuSearchX aria-hidden="true" />}
        title={t('common.not_found_title')}
        text={t('common.not_found_text')}
        action={<Button to="/">{t('common.go_home')}</Button>}
      />
    </section>
  );
}
