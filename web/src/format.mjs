export function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude && (magnitude >= 1e6 || magnitude < 1e-3)) return value.toExponential(2);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
}

const year = 365.25 * 86400; // Julian year, s
// Astronomical spans (from two years on) read in years, thousands, millions or billions of years.
const yearScales = [
  { factor: 1e9, unit: 'bilhões de anos' },
  { factor: 1e6, unit: 'milhões de anos' },
  { factor: 1e3, unit: 'mil anos' },
  { factor: 1, unit: 'anos' }
];
const yearScale = seconds => yearScales.find(scale => seconds / year >= 2 * scale.factor) ?? yearScales.at(-1);

export function formatTime(seconds) {
  if (seconds < 0) return `−${formatTime(-seconds)}`;
  if (seconds >= 2 * year) {
    const scale = yearScale(seconds);
    return `${formatNumber(seconds / year / scale.factor, 2)} ${scale.unit}`;
  }
  if (seconds >= 86400) return `${formatNumber(seconds / 86400, 2)} dias`;
  if (seconds >= 3600) return `${formatNumber(seconds / 3600, 2)} h`;
  if (seconds >= 60) return `${formatNumber(seconds / 60, 2)} min`;
  return `${formatNumber(seconds, 2)} s`;
}

const pad2 = value => String(value).padStart(2, '0');

// Fixed-width clock for the playback readout. The layout depends only on the total
// duration, so every sample of one simulation has the same number of characters.
export function clockUnit(totalSeconds) {
  totalSeconds = Math.abs(totalSeconds);
  if (!(totalSeconds >= 60)) return 's';
  if (totalSeconds < 3600) return 'min:s';
  if (totalSeconds < 86400) return 'h:min:s';
  if (totalSeconds < 2 * year) return 'd h:min:s';
  return yearScale(totalSeconds).unit;
}

// In reverse time (negative total) every value carries the minus sign, zero included, so the
// width stays constant.
export function formatClock(seconds, totalSeconds = seconds) {
  if (!Number.isFinite(seconds)) return '—';
  if (totalSeconds < 0) return `−${formatClock(-seconds, -totalSeconds)}`;
  const unit = clockUnit(totalSeconds);
  const value = Math.max(0, seconds);
  if (unit === 's') {
    const width = Math.max(0, totalSeconds).toFixed(2).length;
    return `${value.toFixed(2).padStart(width, '0').replace('.', ',')} s`;
  }
  if (totalSeconds >= 2 * year) {
    const { factor } = yearScale(totalSeconds);
    const width = (totalSeconds / year / factor).toFixed(2).length;
    return (value / year / factor).toFixed(2).padStart(width, '0').replace('.', ',');
  }
  // Round to milliseconds first so 5999.9999999 s reads as 01:40:00, not 01:39:59.
  const whole = Math.floor(Math.round(value * 1000) / 1000);
  const days = Math.floor(whole / 86400);
  const hours = Math.floor(whole % 86400 / 3600);
  const minutes = Math.floor(whole % 3600 / 60);
  const rest = whole % 60;
  if (unit === 'min:s') return `${pad2(minutes)}:${pad2(rest)}`;
  if (unit === 'h:min:s') return `${pad2(hours)}:${pad2(minutes)}:${pad2(rest)}`;
  const dayWidth = String(Math.floor(totalSeconds / 86400)).length;
  return `${String(days).padStart(dayWidth, '0')}d ${pad2(hours)}:${pad2(minutes)}:${pad2(rest)}`;
}
