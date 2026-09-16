/**
 * Date and Time utilities for formatting, converting and normalizing
 * between ISO format (YYYY-MM-DD, HH:mm) and localized display format (DD/MM/YYYY, hh:mm A).
 */

export function toIsoDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Check for ISO timestamp like 2026-09-16T...
  if (trimmed.includes('T')) {
    const d = trimmed.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }

  // Handle DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const parts = trimmed.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const y = parts[0];
      const m = String(parseInt(parts[1], 10)).padStart(2, '0');
      const d = String(parseInt(parts[2], 10)).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (parts[2].length === 4) {
      // DD/MM/YYYY or MM/DD/YYYY
      const y = parts[2];
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      let day = p0;
      let month = p1;
      // If first number > 12, it is definitely day
      if (p0 <= 12 && p1 > 12) {
        month = p0;
        day = p1;
      }
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

export function toDisplayDate(
  dateStr?: string | null,
  format: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' = 'DD/MM/YYYY'
): string {
  if (!dateStr) return '';
  const iso = toIsoDate(dateStr);
  if (!iso) return String(dateStr);

  const [y, m, d] = iso.split('-');
  if (format === 'YYYY-MM-DD') {
    return `${y}-${m}-${d}`;
  }
  if (format === 'MM/DD/YYYY') {
    return `${m}/${d}/${y}`;
  }
  return `${d}/${m}/${y}`;
}

export function to24hTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();

  // Already 24h format: HH:mm or HH:mm:ss
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
  }

  // 12h format: e.g. 09:39 PM or 9:39pm or 9:39 AM
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  const parsed = new Date(`1970-01-01T${trimmed}`);
  if (!isNaN(parsed.getTime())) {
    const h = String(parsed.getHours()).padStart(2, '0');
    const m = String(parsed.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  return '';
}

export function to12hTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();

  // If already contains AM/PM
  if (/AM|PM/i.test(trimmed)) {
    return trimmed;
  }

  // Convert 24h HH:mm to 12h
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1].substring(0, 2);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    }
  }

  return trimmed;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDisplayDate(): string {
  return toDisplayDate(getTodayIsoDate(), 'DD/MM/YYYY');
}

export function getYesterdayIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getCurrent24hTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function getCurrent12hTime(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}
