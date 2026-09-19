import { LuSettings, LuHouse, LuSun, LuCpu } from 'react-icons/lu';

/**
 * The 4 fixed services. `key` matches the keys in the translation files
 * (services.items.<key>), `slug` matches the `services.slug` values in the
 * database (sql/schema.sql) and is used in /api/categories/service/:slug.
 */
export const SERVICES = [
  {
    key: 'industrial_electricity',
    slug: 'industrial-electricity',
    image: '/images/service-industrial.webp',
    Icon: LuSettings,
  },
  {
    key: 'residential_electricity',
    slug: 'residential-electricity',
    image: '/images/service-residential.webp',
    Icon: LuHouse,
  },
  {
    key: 'solar_energy',
    slug: 'solar-energy',
    image: '/images/service-solar.webp',
    imagePosition: '50% 0%',
    Icon: LuSun,
  },
  {
    key: 'iot_smart_solutions',
    slug: 'iot-smart-solutions',
    image: '/images/service-iot.webp',
    Icon: LuCpu,
  },
];

export const getService = (slug) => SERVICES.find((s) => s.slug === slug);

/** WhatsApp number used by the "Contact via WhatsApp" buttons (digits only, with country code). */
export const WHATSAPP_NUMBER = '972598535359';

/** Social links shown in the footer. Fill these in when the accounts are ready ('#' = not set yet). */
export const SOCIAL_LINKS = {
  facebook: '#',
  instagram: '#',
  linkedin: '#',
  whatsapp: `https://wa.me/${WHATSAPP_NUMBER}`,
};

export const toTel = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const toWhatsApp = (phoneOrNumber = WHATSAPP_NUMBER, text = '') => {
  const digits = String(phoneOrNumber).replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
