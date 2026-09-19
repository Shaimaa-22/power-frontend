import { LuHeadset, LuSettings, LuTarget } from 'react-icons/lu';
import { useI18n } from '../i18n/I18nProvider';
import SectionHeading from './SectionHeading';
import '../styles/why-us.css';

const ITEMS = [
  { key: 'support', Icon: LuHeadset },
  { key: 'organized_execution', Icon: LuSettings },
  { key: 'project_based_solutions', Icon: LuTarget },
];

export default function WhyUs() {
  const { t } = useI18n();
  return (
    <section className="why">
      <div className="why__media" aria-hidden="true">
        <span className="why__stripe" />
        <div className="why__photo">
          <img src="/images/why-us.webp" alt="" loading="lazy" />
        </div>
      </div>

      <div className="why__content">
        <div className="why__panel">
          <SectionHeading tone="light" eyebrow={t('why_us.eyebrow')} title={t('why_us.title')} />
          <ul className="why__items ltr-frame">
            {ITEMS.map(({ key, Icon }) => (
              <li key={key} className="why__item">
                <Icon className="why__icon" aria-hidden="true" />
                <h3>{t(`why_us.items.${key}.title`)}</h3>
                <p>{t(`why_us.items.${key}.description`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
