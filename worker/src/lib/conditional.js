// Apply RFC precondition ordering equally to B2, R2 and Cache API hits.
export function conditionalStatus(request, metadata) {
  const etag = metadata.get('etag');
  const matches = (value, weak) => value.split(',').some(part => {
    const tag = part.trim();
    if (tag === '*') return true;
    if (!etag) return false;
    return weak ? tag.replace(/^W\//, '') === etag.replace(/^W\//, '') : !tag.startsWith('W/') && !etag.startsWith('W/') && tag === etag;
  });
  const match = request.get('if-match');
  if (match && !matches(match, false)) return 412;
  const modified = Date.parse(metadata.get('last-modified') || '');
  const unmodified = Date.parse(request.get('if-unmodified-since') || '');
  if (!match && Number.isFinite(modified) && Number.isFinite(unmodified) && modified > unmodified) return 412;
  const none = request.get('if-none-match');
  if (none && matches(none, true)) return 304;
  const since = Date.parse(request.get('if-modified-since') || '');
  if (!none && Number.isFinite(modified) && Number.isFinite(since) && modified <= since) return 304;
  return 200;
}
