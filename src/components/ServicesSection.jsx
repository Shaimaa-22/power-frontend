import { SERVICES } from '../config/site';
import { useI18n } from '../i18n/I18nProvider';
import SectionHeading from './SectionHeading';
import ServiceCard from './ServiceCard';
import '../styles/services.css';

export default function ServicesSection({ showHeading = true }) {
  const { t } = useI18n();
  return (
    <section className="services" id="services">
      <div className="container">
        {showHeading && <SectionHeading eyebrow={t('services.eyebrow')} title={t('services.title')} />}
        <div className="services__grid ltr-frame">
          {SERVICES.map((service) => (
            <ServiceCard key={service.key} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
