export function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude && (magnitude >= 1e6 || magnitude < 1e-3)) return value.toExponential(2);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
}

export function formatTime(seconds) {
  if (seconds >= 86400) return `${formatNumber(seconds / 86400, 2)} dias`;
  if (seconds >= 3600) return `${formatNumber(seconds / 3600, 2)} h`;
  if (seconds >= 60) return `${formatNumber(seconds / 60, 2)} min`;
  return `${formatNumber(seconds, 2)} s`;
}

