/**
 * ไคลเอนต์ Microsoft Graph — เรียกด้วย fetch ตรง ๆ (ไม่พึ่ง SDK)
 *
 * ทุกคำขอแนบ Bearer token จาก MSAL ผ่าน getToken ที่ฉีดเข้ามา
 * ความผิดพลาดจากฝั่ง Microsoft ถูกแปลงเป็น GraphError พร้อมข้อความไทยที่อ่านออก
 */
import type { VaultItem } from '../state/vault-state';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/** โฟลเดอร์บน OneDrive ที่แอปใช้เก็บไฟล์ทั้งหมด (ไม่ปนกับไฟล์อื่นของผู้ใช้) */
export const VAULT_ROOT = 'Vault';

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

export interface GraphClient {
  /** เรียก Graph โดยแนบ Authorization อัตโนมัติ รับ URL แบบสัมพัทธ์เช่น /me/drive */
  request<T>(path: string, init?: RequestInit): Promise<T>;
  requestBlob(path: string, init?: RequestInit): Promise<Blob>;
}

export function createGraphClient(getToken: () => Promise<string>): GraphClient {
  async function headers(extra?: HeadersInit): Promise<Headers> {
    const token = await getToken();
    const headers = new Headers(extra);
    headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await fetch(`${GRAPH_BASE}${path}`, {
        ...init,
        headers: await headers(init.headers),
      });
      return parseJson<T>(response);
    },

    async requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
      const response = await fetch(`${GRAPH_BASE}${path}`, {
        ...init,
        headers: await headers(init.headers),
      });
      if (!response.ok) throw await toGraphError(response);
      return response.blob();
    },
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toGraphError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toGraphError(response: Response): Promise<GraphError> {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code;
    message = body.error?.message;
  } catch {
    // เนื้อความไม่ใช่ JSON — ใช้ข้อความจากสถานะแทน
  }
  return new GraphError(friendlyGraphMessage(response.status, code, message), response.status, code);
}

/** แปลงข้อผิดพลาดที่พบบ่อยเป็นข้อความไทยที่ผู้ใช้เข้าใจ */
export function friendlyGraphMessage(
  status: number,
  code?: string,
  original?: string,
): string {
  switch (code) {
    case 'itemNotFound':
      return 'ไม่พบไฟล์หรือโฟลเดอร์นี้ (อาจถูกลบไปแล้ว)';
    case 'nameAlreadyExists':
      return 'มีไฟล์หรือโฟลเดอร์ชื่อเดียวกันนี้อยู่แล้ว';
    case 'invalidAuthenticationToken':
    case 'AccessDenied':
      return 'สิทธิ์การเข้าถึงหมดอายุหรือไม่เพียงพอ — ลองออกจากระบบแล้วล็อกอินใหม่';
    case 'activityLimitReached':
      return 'เรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
    default:
      // 404 จากการระบุพาธบางรูปแบบไม่มาพร้อม code itemNotFound
      if (original?.includes('Resource not found')) {
        return 'ไม่พบไฟล์หรือโฟลเดอร์นี้ (อาจถูกลบไปแล้ว)';
      }
      break;
  }
  if (status === 401) return 'การยืนยันตัวตนหมดอายุ กรุณาล็อกอินใหม่';
  if (status === 403) return 'ไม่ได้รับอนุญาตให้ทำรายการนี้';
  if (status === 404) return 'ไม่พบรายการนี้บน OneDrive';
  if (status === 507) return 'พื้นที่ OneDrive ของคุณเต็มแล้ว';
  return original ? `เรียก OneDrive ไม่สำเร็จ: ${original}` : `เรียก OneDrive ไม่สำเร็จ (HTTP ${status})`;
}

/* ------------------------------ พาธบน Graph ------------------------------ */

/**
 * สร้างส่วนพาธของ driveItem จากชื่อโฟลเดอร์ทีละชั้น
 * เช่น ['a','b'] → 'root:/Vault/a/b:' — แต่ละชื่อต้อง percent-encode เอง
 * เพราะอักขระอย่าง '#' และ '?' ในชื่อไฟล์ไทย/อังกฤษต้องหลบให้ครบ
 */
export function drivePath(segments: string[]): string {
  const all = [VAULT_ROOT, ...segments];
  return `root:/${all.map(encodeURIComponent).join('/')}:`;
}

/* --------------------------- ประเภทจาก Graph --------------------------- */

interface RawDriveItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: unknown;
  file?: unknown;
  '@microsoft.graph.downloadUrl'?: string;
}

export function toVaultItem(raw: RawDriveItem): VaultItem {
  return {
    id: raw.id,
    name: raw.name,
    isFolder: raw.folder !== undefined,
    size: raw.size ?? 0,
    modifiedAt: raw.lastModifiedDateTime,
    downloadUrl: raw['@microsoft.graph.downloadUrl'],
  };
}

const ITEM_FIELDS =
  '$select=id,name,size,folder,file,lastModifiedDateTime,@microsoft.graph.downloadUrl';

/* ------------------------------ การทำงานหลัก ------------------------------ */

/** ลิสต์รายการในโฟลเดอร์ (วนตาม @odata.nextLink ให้ครบทุกหน้า) */
interface ChildrenPage {
  value?: RawDriveItem[];
  '@odata.nextLink'?: string;
}

export async function listChildren(client: GraphClient, path: string[]): Promise<VaultItem[]> {
  const items: VaultItem[] = [];
  let next: string | undefined = `/me/drive/${drivePath(path)}/children?$top=200&${ITEM_FIELDS}`;
  // กันวนไม่รู้จบถ้า Microsoft ส่ง nextLink วนซ้ำผิดปกติ
  for (let page = 0; page < 100 && next; page += 1) {
    const json: ChildrenPage = await client.request<ChildrenPage>(next);
    for (const raw of json.value ?? []) items.push(toVaultItem(raw));
    next = json['@odata.nextLink']?.startsWith(GRAPH_BASE)
      ? json['@odata.nextLink'].slice(GRAPH_BASE.length)
      : json['@odata.nextLink'];
  }
  return items;
}

/** อัปโหลดไฟล์เล็กในคำขอเดียว (≤ 250MB ได้ตามเอกสาร แต่แอปใช้เฉพาะไฟล์เล็ก) */
export async function uploadSmall(
  client: GraphClient,
  path: string[],
  name: string,
  file: Blob,
  signal?: AbortSignal,
): Promise<VaultItem> {
  // drivePath ลงท้ายด้วย ':' อยู่แล้ว (เช่น root:/Vault/a.jpg:) จึงต่อ /content ได้เลย
  const raw = await client.request<RawDriveItem>(
    `/me/drive/${drivePath([...path, name])}/content?@microsoft.graph.conflictBehavior=rename`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
      signal,
    },
  );
  return toVaultItem(raw);
}

/** สร้าง upload session สำหรับไฟล์ใหญ่ — ได้ uploadUrl ที่ไม่ต้องแนบ token */
export async function createUploadSession(
  client: GraphClient,
  path: string[],
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  // drivePath ลงท้ายด้วย ':' อยู่แล้ว จึงต่อ /createUploadSession ได้เลย
  const json = await client.request<{ uploadUrl: string }>(
    `/me/drive/${drivePath([...path, name])}/createUploadSession`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename' },
      }),
      signal,
    },
  );
  return json.uploadUrl;
}

/** ส่งทีละชิ้นไปที่ uploadUrl (ชิ้นสุดท้ายคืน driveItem ที่สมบูรณ์) */
export async function putChunk(
  uploadUrl: string,
  chunk: Blob,
  start: number,
  totalBytes: number,
  signal?: AbortSignal,
): Promise<VaultItem | undefined> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes ${start}-${start + chunk.size - 1}/${totalBytes}`,
      'Content-Length': String(chunk.size),
    },
    body: chunk,
    signal,
  });
  // 202 = ยังไม่จบ ส่งชิ้นถัดไปได้, 416 = ช่วงนี้ถูกส่งไปแล้ว (เกิดตอน retry) ให้ทำต่อได้เช่นกัน
  if (response.status === 202 || response.status === 416) return undefined;
  if (!response.ok) throw await toGraphError(response);
  return toVaultItem((await response.json()) as RawDriveItem);
}

/** สร้างโฟลเดอร์ — ชื่อซ้ำ Microsoft เปลี่ยนเป็น "name (1)" ให้เอง */
export async function createFolder(
  client: GraphClient,
  path: string[],
  name: string,
): Promise<VaultItem> {
  const raw = await client.request<RawDriveItem>(
    `/me/drive/${drivePath(path)}/children`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    },
  );
  return toVaultItem(raw);
}

/**
 * สร้างโฟลเดอร์ Vault ที่รากของ OneDrive — ใช้รันครั้งแรกที่ยังไม่มีโฟลเดอร์
 * (ต่างจาก createFolder: สร้างที่ drive root โดยตรง ไม่ใช่ข้างใน Vault)
 */
export async function createVaultFolder(client: GraphClient): Promise<VaultItem> {
  const raw = await client.request<RawDriveItem>('/me/drive/root/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: VAULT_ROOT,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
  });
  return toVaultItem(raw);
}

/** เปลี่ยนชื่อไฟล์/โฟลเดอร์ */
export async function renameItem(
  client: GraphClient,
  id: string,
  newName: string,
): Promise<VaultItem> {
  const raw = await client.request<RawDriveItem>(`/me/drive/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  return toVaultItem(raw);
}

/** ลบไฟล์/โฟลเดอร์ — ของจริงไปอยู่ถังขยะของ OneDrive ยังกู้คืนได้ */
export async function deleteItem(client: GraphClient, id: string): Promise<void> {
  await client.request<void>(`/me/drive/items/${id}`, { method: 'DELETE' });
}

/**
 * ดาวน์โหลดเนื้อไฟล์เป็น Blob ผ่าน item id — ใช้เมื่อไม่มี downloadUrl
 * (ผลตอบรับการอัปโหลด/รายการบางอย่างไม่มี @microsoft.graph.downloadUrl)
 */
export async function fetchItemContent(
  client: GraphClient,
  id: string,
  signal?: AbortSignal,
): Promise<Blob> {
  return client.requestBlob(`/me/drive/items/${id}/content`, { signal });
}

/**
 * ดาวน์โหลดเนื้อไฟล์เป็น Blob เพื่อพรีวิว — ใช้ downloadUrl ที่ Microsoft ให้มา
 * (URL นี้พิสูจน์ตัวตนมาแล้ว จึงไม่ต้องแนบ Authorization อีก)
 */
export async function fetchAsBlob(downloadUrl: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(downloadUrl, { signal });
  if (!response.ok) throw new GraphError(`ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP ${response.status})`, response.status);
  return response.blob();
}
