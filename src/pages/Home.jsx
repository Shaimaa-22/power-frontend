import { usePageTitle } from '../hooks/usePageTitle';
import Hero from '../components/Hero';
import ServicesSection from '../components/ServicesSection';
import WhyUs from '../components/WhyUs';
import AboutBlock from '../components/AboutBlock';
import CtaSection from '../components/CtaSection';

export default function Home() {
  usePageTitle(null);
  return (
    <>
      <Hero />
      <ServicesSection />
      <WhyUs />
      <AboutBlock />
      <CtaSection />
    </>
  );
}
