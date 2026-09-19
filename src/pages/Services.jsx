import { useI18n } from '../i18n/I18nProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import PageHero from '../components/PageHero';
import ServicesSection from '../components/ServicesSection';
import CtaSection from '../components/CtaSection';

export default function Services() {
  const { t } = useI18n();
  usePageTitle(t('nav.services'));
  return (
    <>
      <PageHero eyebrow={t('brand.tagline')} title={t('services.eyebrow')} description={t('services.title')} image="/images/hero.webp" imagePosition="80% 50%" />
      <ServicesSection showHeading={false} />
      <CtaSection />
    </>
  );
}
