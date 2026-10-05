/**
 * ตรรกะบริสุทธิ์สำหรับจัดรูปแบบข้อความที่ผู้ใช้เห็น (ไทย)
 */
const MB = 1024 * 1024;
const KB = 1024;

/** ขนาดไฟล์แบบอ่านง่าย: 0 B, 512 KB, 1.2 MB, 1.5 GB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(bytes < 10 * KB ? 1 : 0)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}

/** วันที่แก้ไขแบบสั้นเป็นภาษาไทย เช่น "5 ต.ค. 2568, 14:30" */
export function formatModified(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** เวลาที่ผ่านมาแบบสั้น: "เมื่อสักครู่", "5 นาทีที่แล้ว", "2 ชม.ที่แล้ว", "3 วันที่แล้ว" */
export function formatAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return formatModified(iso);
}

/** ชื่อไฟล์ที่ต้องไม่ซ้ำกับรายการที่มีอยู่: "a.pdf" → "a (1).pdf" */
export function uniqueName(name: string, existing: string[]): string {
  const taken = new Set(existing);
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 1; n < 10_000; n += 1) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

/** ตรวจชื่อที่ Microsoft OneDrive ไม่ยอมรับ */
export function nameProblem(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'ชื่อห้ามว่าง';
  if (trimmed === '.' || trimmed === '..') return 'ชื่อนี้ใช้ไม่ได้';
  if (/[\\/:*?"<>|#%]/.test(trimmed)) return 'ห้ามใช้อักขระ \\ / : * ? " < > | # %';
  if (trimmed.length > 255) return 'ชื่อยาวเกิน 255 ตัวอักษร';
  return undefined;
}

/** เรียงรายการ: โฟลเดอร์ก่อนไฟล์ แล้วเรียงตาม key */
export type SortKey = 'name' | 'size' | 'modified';

export function sortItems<T extends { name: string; isFolder: boolean; size: number; modifiedAt?: string }>(
  items: T[],
  key: SortKey,
  direction: 'asc' | 'desc' = 'asc',
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name, 'th');
    else if (key === 'size') cmp = a.size - b.size;
    else cmp = (a.modifiedAt ? Date.parse(a.modifiedAt) : 0) - (b.modifiedAt ? Date.parse(b.modifiedAt) : 0);
    return sign * cmp;
  });
}
