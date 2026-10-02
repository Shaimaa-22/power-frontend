export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function matchesProduct(item, query) {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  const titles = ['ar', 'en', 'he'].map(lang => normalizeSearch(item[`title_${lang}`]));
  return titles.some(title => words.every(word => title.includes(word)));
}
