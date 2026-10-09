// Search, category filter and pagination of the scenario gallery (pure, so they are unit tested).
export const pageSize = 25;

export function normalized(value) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Every word of the query must appear in the label, description or category (accents ignored).
export function filterPresets(entries, { query = '', category = 'Todos' } = {}) {
  const words = normalized(query).split(/\s+/).filter(Boolean);
  return entries.filter(([, preset]) => {
    if (category !== 'Todos' && preset.category !== category) return false;
    const text = normalized(`${preset.label} ${preset.description} ${preset.category}`);
    return words.every(word => text.includes(word));
  });
}

// Page numbers are 1-based; out-of-range or invalid pages are clamped.
export function paginate(items, page, size = pageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(Number(page)) || 1));
  const start = (current - 1) * size;
  return { page: current, pageCount, start, end: Math.min(items.length, start + size), items: items.slice(start, start + size) };
}

// Page buttons to show: all of them when few, otherwise first, last and the neighbourhood of
// the current page, with null marking a gap.
export function pageWindow(page, pageCount, radius = 1) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount]);
  for (let value = page - radius; value <= page + radius; value++) if (value > 1 && value < pageCount) pages.add(value);
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => index && value - sorted[index - 1] > 1 ? [null, value] : [value]);
}
