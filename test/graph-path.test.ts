/**
 * ถ่วง URL ที่ส่งไป Microsoft Graph — กัน regression colon ซ้ำ
 * (bug เดิม: uploadSmall/createUploadSession ต่อ ':' ทับ drivePath ที่ลงท้าย ':' อยู่แล้ว
 *  ทำให้ URL เป็น root:/Vault/a.jpg::/content → Graph ตอบ 404 itemNotFound ทุกครั้ง)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGraphClient,
  createUploadSession,
  drivePath,
  fetchItemContent,
  listChildren,
  uploadSmall,
} from '../src/api/graph';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function mockFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ id: '1', name: 'item' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  (mockFetch as { original?: typeof fetch }).original = original;
  return fetchMock;
}

afterEach(() => {
  const original = (mockFetch as { original?: typeof fetch }).original;
  if (original) globalThis.fetch = original;
});

const TOKEN = async () => 'fake-token';

describe('drivePath', () => {
  it('root ต้องเป็น root:/Vault:', () => {
    expect(drivePath([])).toBe('root:/Vault:');
  });

  it('โฟลเดอร์ไทยต้อง percent-encode', () => {
    expect(drivePath(['รูปภาพ'])).toBe(`root:/Vault/${encodeURIComponent('รูปภาพ')}:`);
  });
});

describe('URL ที่ส่งไป Graph', () => {
  it('uploadSmall: PUT .../root:/Vault/a.jpg:/content (ไม่มี colon ซ้ำ)', async () => {
    const fetchMock = mockFetch();
    const client = createGraphClient(TOKEN);
    await uploadSmall(client, [], 'a.jpg', new Blob(['x']));
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe(
      `${GRAPH_BASE}/me/drive/root:/Vault/a.jpg:/content?@microsoft.graph.conflictBehavior=rename`,
    );
  });

  it('uploadSmall ในโฟลเดอร์ย่อย: PUT .../root:/Vault/รูปภาพ/a.jpg:/content', async () => {
    const fetchMock = mockFetch();
    const client = createGraphClient(TOKEN);
    await uploadSmall(client, ['รูปภาพ'], 'a.jpg', new Blob(['x']));
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe(
      `${GRAPH_BASE}/me/drive/root:/Vault/${encodeURIComponent('รูปภาพ')}/a.jpg:/content?@microsoft.graph.conflictBehavior=rename`,
    );
  });

  it('createUploadSession: POST .../root:/Vault/a.zip:/createUploadSession (ไม่มี colon ซ้ำ)', async () => {
    const fetchMock = mockFetch();
    const client = createGraphClient(TOKEN);
    await createUploadSession(client, [], 'a.zip');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe(`${GRAPH_BASE}/me/drive/root:/Vault/a.zip:/createUploadSession`);
  });

  it('listChildren: GET .../root:/Vault:/children (ถูกต้องอยู่แล้ว — regression)', async () => {
    const fetchMock = mockFetch();
    const client = createGraphClient(TOKEN);
    await listChildren(client, []);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain(`${GRAPH_BASE}/me/drive/root:/Vault:/children?`);
    expect(url).not.toContain('::');
  });

  it('fetchItemContent: GET .../me/drive/items/{id}/content (ดึงผ่าน id)', async () => {
    const fetchMock = mockFetch();
    const client = createGraphClient(TOKEN);
    await fetchItemContent(client, 'item-1');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe(`${GRAPH_BASE}/me/drive/items/item-1/content`);
  });
});
