import { describe, expect, it } from 'vitest';
import { drivePath, friendlyGraphMessage } from '../src/api/graph';
import { formatAgo, formatBytes, formatModified, nameProblem, sortItems } from '../src/util/format';

describe('drivePath', () => {
  it('รากของแอปคือ /Vault', () => {
    expect(drivePath([])).toBe('root:/Vault:');
  });

  it('ต่อชั้นโฟลเดอร์และ encode แต่ละ segment', () => {
    expect(drivePath(['รูปภาพ', 'ทะเล'])).toBe(
      `root:/Vault/${encodeURIComponent('รูปภาพ')}/${encodeURIComponent('ทะเล')}:`,
    );
  });

  it('หลบอักขระพิเศษในชื่อไฟล์ เช่น # และ ?', () => {
    const encoded = drivePath(['โน้ต #1?']);
    expect(encoded).toContain('%23');
    expect(encoded).toContain('%3F');
  });
});

describe('friendlyGraphMessage', () => {
  it('แปลงโค้ดที่พบบ่อยเป็นข้อความไทย', () => {
    expect(friendlyGraphMessage(404, 'itemNotFound')).toContain('ไม่พบ');
    expect(friendlyGraphMessage(409, 'nameAlreadyExists')).toContain('ชื่อเดียวกัน');
    expect(friendlyGraphMessage(429, 'activityLimitReached')).toContain('ถี่เกินไป');
    expect(friendlyGraphMessage(507)).toContain('พื้นที่ OneDrive');
  });

  it('กรณีไม่รู้จักใช้ข้อความเดิมจาก Microsoft ถ้ามี', () => {
    expect(friendlyGraphMessage(418, undefined, 'teapot')).toContain('teapot');
  });
});

describe('formatBytes', () => {
  it('ไบต์/กิโล/เมกะ/กิกะ', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(10 * 1024)).toBe('10 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });

  it('ค่าผิดปกติแสดง —', () => {
    expect(formatBytes(-5)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('formatModified / formatAgo', () => {
  it('ค่าว่างหรือวันที่เสียแสดง —', () => {
    expect(formatModified(undefined)).toBe('—');
    expect(formatModified('not-a-date')).toBe('—');
    expect(formatAgo(undefined)).toBe('—');
  });

  it('formatAgo คืนหน่วยไทยตามระยะเวลา', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(formatAgo('2026-10-05T11:59:40Z', now)).toBe('เมื่อสักครู่');
    expect(formatAgo('2026-10-05T11:50:00Z', now)).toBe('10 นาทีที่แล้ว');
    expect(formatAgo('2026-10-05T09:00:00Z', now)).toBe('3 ชม.ที่แล้ว');
    expect(formatAgo('2026-10-02T12:00:00Z', now)).toBe('3 วันที่แล้ว');
  });
});

describe('nameProblem', () => {
  it('ชื่อที่ถูกต้องไม่มีปัญหา', () => {
    expect(nameProblem('รายงาน 2568.pdf')).toBeUndefined();
  });

  it('จับชื่อว่างและอักขระต้องห้าม', () => {
    expect(nameProblem('   ')).toBeDefined();
    expect(nameProblem('a/b')).toBeDefined();
    expect(nameProblem('รายงาน#1')).toBeDefined();
    expect(nameProblem('.')).toBeDefined();
  });
});

describe('sortItems', () => {
  const items = [
    { name: 'ไฟล์ b.pdf', isFolder: false, size: 30, modifiedAt: '2026-01-03T00:00:00Z' },
    { name: 'โฟลเดอร์', isFolder: true, size: 0, modifiedAt: '2026-01-01T00:00:00Z' },
    { name: 'ไฟล์ a.pdf', isFolder: false, size: 10, modifiedAt: '2026-01-02T00:00:00Z' },
  ];

  it('โฟลเดอร์มาก่อนไฟล์เสมอ แล้วเรียงตามชื่อ', () => {
    const sorted = sortItems(items, 'name');
    expect(sorted[0].isFolder).toBe(true);
    expect(sorted[1].name).toBe('ไฟล์ a.pdf');
  });

  it('เรียงตามขนาดและกลับทิศได้', () => {
    const asc = sortItems(items.filter((i) => !i.isFolder), 'size', 'asc');
    expect(asc.map((i) => i.size)).toEqual([10, 30]);
    const desc = sortItems(items.filter((i) => !i.isFolder), 'size', 'desc');
    expect(desc.map((i) => i.size)).toEqual([30, 10]);
  });

  it('เรียงตามวันที่แก้ไข (ไฟล์ไม่มีวันที่ถือว่าเก่าสุด)', () => {
    const withMissing = [...items, { name: 'x.bin', isFolder: false, size: 1, modifiedAt: undefined }];
    const sorted = sortItems(withMissing.filter((i) => !i.isFolder), 'modified');
    expect(sorted[sorted.length - 1].name).toBe('ไฟล์ b.pdf');
  });
});
