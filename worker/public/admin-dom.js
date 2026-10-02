export function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = String(text ?? '');
  return node;
}

export function imageUrl(base, filename) {
  if (typeof filename !== 'string' || !filename || filename.length > 255 || /[\/\\\x00-\x1f]/.test(filename) || ['.', '..'].includes(filename)) return null;
  return new URL('/images/' + encodeURIComponent(filename), base).href;
}

export function setBackground(node, url) {
  // CSS property assignment, not an HTML/style attribute assembled from database values.
  node.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : '';
}
