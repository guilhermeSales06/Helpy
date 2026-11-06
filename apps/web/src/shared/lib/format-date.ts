const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const MINUTE = 60_000;

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `agora`, `há 5 min`, `há 3 h`, `ontem`, `há 4 dias`. A future date is `agora`. */
export function formatRelative(
  date: string | Date,
  now: Date = new Date(),
): string {
  const then = toDate(date);
  if (!then) return '';
  const minutes = Math.floor((now.getTime() - then.getTime()) / MINUTE);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  if (minutes < 2880) return 'ontem';
  return `há ${Math.floor(minutes / 1440)} dias`;
}

/** `22 out, 10:30`, in the viewer's time zone. */
export function formatDateTime(date: string | Date): string {
  const value = toDate(date);
  if (!value) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getDate()} ${MONTHS[value.getMonth()]}, ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
