import { useI18n } from '../i18n/I18nProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import PageHero from '../components/PageHero';
import AboutBlock from '../components/AboutBlock';
import WhyUs from '../components/WhyUs';
import CtaSection from '../components/CtaSection';

export default function About() {
  const { t } = useI18n();
  usePageTitle(t('nav.about'));
  return (
    <>
      <PageHero eyebrow={t('brand.tagline')} title={t('nav.about')} description={t('about.title')} image="/images/why-us.webp" imagePosition="50% 40%" />
      <AboutBlock showCta={false} />
      <WhyUs />
      <CtaSection />
    </>
  );
}
