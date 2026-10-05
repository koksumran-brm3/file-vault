import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, CHUNK_THRESHOLD, planUpload } from '../src/api/upload';
import { uniqueName } from '../src/util/format';

describe('planUpload', () => {
  it('ไฟล์เล็กกว่าเกณฑ์ใช้แบบคำขอเดียว', () => {
    const plan = planUpload('a.pdf', 1024);
    expect(plan).toEqual({ kind: 'simple', name: 'a.pdf', size: 1024 });
  });

  it('ไฟล์พอดีเกณฑ์-1 ไบต์ยังใช้แบบคำขอเดียว', () => {
    expect(planUpload('a.pdf', CHUNK_THRESHOLD - 1).kind).toBe('simple');
  });

  it('ไฟล์เท่าเกณฑ์ขึ้นไปใช้ upload session', () => {
    const plan = planUpload('big.mp4', CHUNK_THRESHOLD);
    if (plan.kind !== 'session') throw new Error('ไฟล์ขนาดเท่าเกณฑ์ต้องใช้ upload session');
    expect(plan.chunkSize).toBe(CHUNK_SIZE);
  });

  it('นับจำนวนชิ้นปัดขึ้น และชิ้นสุดท้ายเล็กกว่าปกติได้', () => {
    // 12MB = 2 ชิ้นเต็ม + 2MB
    expect(planUpload('x.bin', 12 * 1024 * 1024)).toMatchObject({ chunks: 3, chunkSize: CHUNK_SIZE });
    // พอดี 2 ชิ้น
    expect(planUpload('x.bin', 10 * 1024 * 1024)).toMatchObject({ chunks: 2 });
    // 1 ไบต์เกินเกณฑ์ = 1 ชิ้น
    expect(planUpload('x.bin', CHUNK_THRESHOLD + 1)).toMatchObject({ chunks: 1 });
  });

  it('ไฟล์ว่าง (0 ไบต์) ใช้แบบคำขอเดียว', () => {
    expect(planUpload('empty.txt', 0)).toEqual({ kind: 'simple', name: 'empty.txt', size: 0 });
  });
});

describe('uniqueName', () => {
  it('ไม่ซ้ำอยู่แล้วคืนชื่อเดิม', () => {
    expect(uniqueName('a.pdf', ['b.pdf'])).toBe('a.pdf');
  });

  it('ซ้ำเติมตัวเลขก่อนนามสกุล', () => {
    expect(uniqueName('a.pdf', ['a.pdf'])).toBe('a (1).pdf');
    expect(uniqueName('a.pdf', ['a.pdf', 'a (1).pdf'])).toBe('a (2).pdf');
  });

  it('ไฟล์ไม่มีนามสกุลก็ทำงานได้', () => {
    expect(uniqueName('README', ['README'])).toBe('README (1)');
  });

  it('ชื่อมีจุดหลายอันใช้จุดสุดท้ายเป็นนามสกุล', () => {
    expect(uniqueName('my.photo.jpg', ['my.photo.jpg'])).toBe('my.photo (1).jpg');
  });

  it('เทียบแบบตรงตัว (case-sensitive)', () => {
    expect(uniqueName('A.pdf', ['a.pdf'])).toBe('A.pdf');
  });
});
