/**
 * ตรรกะการอัปโหลด — แยก "การวางแผน" (บริสุทธิ์ ทดสอบง่าย) ออกจาก "การส่งจริง" (ผูกกับ fetch)
 */
import type { GraphClient } from './graph';
import type { VaultItem } from '../state/vault-state';
import { createUploadSession, putChunk, uploadSmall } from './graph';

/** เกณฑ์เปลี่ยนจากอัปโหลดคำขอเดียวไปใช้ upload session (ตามแนวปฏิบัติของ Graph) */
export const CHUNK_THRESHOLD = 4 * 1024 * 1024; // 4MB
/** ขนาดชิ้นที่ใช้ส่งใน upload session — Microsoft แนะนำเป็นพหุคูณของ 320KB */
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export type UploadPlan =
  | { kind: 'simple'; name: string; size: number }
  | { kind: 'session'; name: string; size: number; chunks: number; chunkSize: number };

/** เลือกวิธีอัปโหลดและนับจำนวนชิ้น — บริสุทธิ์ ทดสอบได้โดยไม่ต้อง mock */
export function planUpload(name: string, size: number): UploadPlan {
  if (size < CHUNK_THRESHOLD) return { kind: 'simple', name, size };
  return { kind: 'session', name, size, chunks: Math.ceil(size / CHUNK_SIZE), chunkSize: CHUNK_SIZE };
}

/**
 * อัปโหลดไฟล์หนึ่งไฟล์จนจบ รายงานความคืบหน้า 0..1
 * (ไฟล์เล็กใช้ PUT คำขอเดียว, ไฟล์ใหญ่แบ่งชิ้นผ่าน upload session)
 */
export async function uploadFile(
  client: GraphClient,
  path: string[],
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<VaultItem> {
  const plan = planUpload(file.name, file.size);
  onProgress?.(0);
  if (plan.kind === 'simple') {
    const item = await uploadSmall(client, path, file.name, file, signal);
    onProgress?.(1);
    return item;
  }

  const uploadUrl = await createUploadSession(client, path, file.name, signal);
  const total = file.size;
  for (let offset = 0; offset < total; offset += plan.chunkSize) {
    if (signal?.aborted) throw new DOMException('ยกเลิกการอัปโหลด', 'AbortError');
    const end = Math.min(offset + plan.chunkSize, total);
    const chunk = file.slice(offset, end);
    const finished = await putChunk(uploadUrl, chunk, offset, total, signal);
    onProgress?.(end / total);
    if (finished) return finished;
  }
  // วนครบแต่ไม่มีชิ้นไหนคืน driveItem — ปกติไม่เกิด แต่ต้องไม่ปล่อยผ่านเงียบ ๆ
  throw new Error('อัปโหลดจบแต่ไม่ได้รับข้อมูลยืนยันจาก OneDrive');
}

export interface UploadHandle {
  id: string;
  name: string;
  abort(): void;
}

/**
 * จัดคิวอัปโหลดหลายไฟล์ตามลำดับ พร้อมสถานะต่อไฟล์ —
 * ทำงานในโปรเจกต์แยก ไม่บล็อก UI และยกเลิกรายไฟล์ได้
 */
export interface UploadTask {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';
  message?: string;
  controller?: AbortController;
}

export function newUploadTaskId(): string {
  return `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
