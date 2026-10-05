/**
 * สถานะของคลังไฟล์ — ตรรกะบริสุทธิ์ ไม่ผูกกับ React จึงทดสอบได้ตรง ๆ
 *
 * หลักการเดียวกับ pdf-thai-editor: ทุกการเปลี่ยนแปลงต้องผ่าน reducer นี้
 * เพื่อให้พฤติกรรม (เรียงลำดับ, เลือก, พรีวิว, อัปโหลด) คาดเดาได้และตรวจสอบได้
 */
import type { UploadTask } from '../api/upload';
import { sortItems, type SortKey } from '../util/format';

export interface VaultItem {
  id: string;
  name: string;
  isFolder: boolean;
  size: number;
  modifiedAt?: string;
  /** URL ดาวน์โหลดชั่วคราวจาก Graph (ใช้พรีวิว/ดาวน์โหลด) */
  downloadUrl?: string;
}

export interface VaultState {
  /** โฟลเดอร์ปัจจุบันภายใต้ /Vault เช่น ['รูปภาพ','ทะเล'] */
  path: string[];
  items: VaultItem[];
  loading: boolean;
  error?: string;
  /** ข้อความแจ้งสำเร็จชั่วคราว (เช่น "เปลี่ยนชื่อแล้ว") */
  notice?: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  selectedId?: string;
  previewId?: string;
  uploads: UploadTask[];
}

export type VaultAction =
  | { type: 'navigate'; path: string[] }
  | { type: 'loading' }
  | { type: 'itemsLoaded'; items: VaultItem[] }
  | { type: 'loadFailed'; message: string }
  | { type: 'toggleSort'; key: SortKey }
  | { type: 'select'; id?: string }
  | { type: 'preview'; id?: string }
  | { type: 'addUpload'; task: UploadTask }
  | { type: 'updateUpload'; id: string; patch: Partial<UploadTask> }
  | { type: 'removeUpload'; id: string }
  | { type: 'upsertItem'; item: VaultItem }
  | { type: 'removeItem'; id: string }
  | { type: 'setNotice'; message?: string }
  | { type: 'setError'; message?: string };

export function createVaultState(): VaultState {
  return { path: [], items: [], loading: false, sortKey: 'name', sortDir: 'asc', uploads: [] };
}

export function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case 'navigate':
      return {
        ...state,
        path: action.path,
        items: [],
        loading: true,
        error: undefined,
        notice: undefined,
        selectedId: undefined,
        previewId: undefined,
      };

    case 'loading':
      return { ...state, loading: true, error: undefined };

    case 'itemsLoaded':
      return {
        ...state,
        loading: false,
        error: undefined,
        items: sortItems(action.items, state.sortKey, state.sortDir),
      };

    case 'loadFailed':
      return { ...state, loading: false, error: action.message };

    case 'toggleSort': {
      // กดคอลัมน์เดิม = กลับทิศ, กดคอลัมน์ใหม่ = เริ่มจากน้อยไปมาก
      const sameKey = state.sortKey === action.key;
      const sortDir = sameKey && state.sortDir === 'asc' ? 'desc' : 'asc';
      const sortKey = action.key;
      return { ...state, sortKey, sortDir, items: sortItems(state.items, sortKey, sortDir) };
    }

    case 'select':
      return { ...state, selectedId: action.id };

    case 'preview':
      return { ...state, previewId: action.id };

    case 'addUpload':
      return { ...state, uploads: [...state.uploads, action.task] };

    case 'updateUpload':
      return {
        ...state,
        uploads: state.uploads.map((task) =>
          task.id === action.id ? { ...task, ...action.patch } : task,
        ),
      };

    case 'removeUpload':
      return { ...state, uploads: state.uploads.filter((task) => task.id !== action.id) };

    case 'upsertItem': {
      // อัปเดตถ้า id เดิมมีอยู่แล้ว (เช่น เปลี่ยนชื่อ) ไม่งั้นเติมเข้ารายการ
      // ถ้ารายการใหม่ไม่มี downloadUrl (เช่น ผลตอบรับการอัปโหลด) ให้เก็บอันเดิมไว้
      const exists = state.items.some((item) => item.id === action.item.id);
      const items = exists
        ? state.items.map((item) =>
            item.id === action.item.id
              ? {
                  ...item,
                  ...action.item,
                  downloadUrl: action.item.downloadUrl ?? item.downloadUrl,
                }
              : item,
          )
        : [...state.items, action.item];
      return { ...state, items: sortItems(items, state.sortKey, state.sortDir) };
    }

    case 'removeItem': {
      const items = state.items.filter((item) => item.id !== action.id);
      if (items.length === state.items.length) return state;
      return {
        ...state,
        items,
        selectedId: state.selectedId === action.id ? undefined : state.selectedId,
        previewId: state.previewId === action.id ? undefined : state.previewId,
      };
    }

    case 'setNotice':
      return { ...state, notice: action.message };

    case 'setError':
      return { ...state, error: action.message };

    default:
      return state;
  }
}

/* ------------------------------ ตัวช่วยพาธ ------------------------------ */

/** 'Vault/รูปภาพ/ทะเล' — สำหรับแสดงผล (ไม่ encode) */
export function pathString(path: string[]): string {
  return ['Vault', ...path].join('/');
}

export interface Crumb {
  name: string;
  path: string[];
}

/** breadcrumb ของพาธปัจจุบัน: หน้าแรกคือ "คลังไฟล์" (root /Vault) */
export function breadcrumbs(path: string[]): Crumb[] {
  const crumbs: Crumb[] = [{ name: '🔐 คลังไฟล์', path: [] }];
  let acc: string[] = [];
  for (const segment of path) {
    acc = [...acc, segment];
    crumbs.push({ name: segment, path: acc });
  }
  return crumbs;
}

/** ชื่อไฟล์จากพาธเต็ม (ใช้ตอนดาวน์โหลด) */
export function downloadFileName(name: string): string {
  return name;
}
