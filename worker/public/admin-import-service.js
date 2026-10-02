const key = value => String(value ?? '').normalize('NFKC').trim().toLowerCase()
  .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/[_\s-]+/g, ' ');

const names = {
  'industrial-electricity': ['الكهرباء الصناعية', 'Industrial Electrical', 'Industrial Electricity', 'חשמל תעשייתי'],
  'residential-electricity': ['الكهرباء المنزلية', 'Residential Electrical', 'Residential Electricity', 'חשמל ביתי'],
  'solar-energy': ['الطاقة الشمسية', 'Solar Energy', 'אנרגיה סולארית'],
  'iot-smart-solutions': ['إنترنت الأشياء والحلول الذكية', 'الحلول الذكية', 'IoT & Smart Solutions', 'IoT and Smart Solutions', 'אינטרנט הדברים ופתרונות חכמים'],
};
const serviceNames = new Map(Object.entries(names).flatMap(([slug, aliases]) =>
  [slug, ...aliases].map(alias => [key(alias), slug])));
const headers = new Set([
  'service_slug', 'service', 'service_ar', 'service_en', 'service_he',
  'الخدمة في الموقع', 'الخدمة', 'الخدمة - عربي', 'الخدمة - English',
  'Service - English', 'שירות - עברית', 'الخدمة - עברית',
].map(key));

export function resolveImportService(row) {
  const values = Object.entries(row).filter(([header, value]) => headers.has(key(header)) && key(value));
  if (!values.length) return { slug: '', error: 'الخدمة ناقصة: أضيفي عمود الخدمة في الموقع أو service_slug' };
  const slugs = new Set();
  for (const [, value] of values) {
    const slug = serviceNames.get(key(value));
    if (!slug) return { slug: '', error: `خدمة غير معروفة: ${value}` };
    slugs.add(slug);
  }
  if (slugs.size !== 1) return { slug: '', error: 'أسماء الخدمة في هذا الصف متعارضة' };
  return { slug: [...slugs][0], error: null };
}
