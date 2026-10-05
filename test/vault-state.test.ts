import { describe, expect, it } from 'vitest';
import {
  breadcrumbs,
  createVaultState,
  pathString,
  vaultReducer,
  type VaultItem,
} from '../src/state/vault-state';

function item(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'id-1',
    name: 'ไฟล์.pdf',
    isFolder: false,
    size: 100,
    modifiedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

describe('vaultReducer', () => {
  it('navigate เปลี่ยนพาธ ล้างรายการ และตั้ง loading', () => {
    let state = createVaultState();
    state = vaultReducer(state, { type: 'itemsLoaded', items: [item()] });
    state = vaultReducer(state, { type: 'select', id: 'id-1' });
    state = vaultReducer(state, { type: 'navigate', path: ['รูปภาพ'] });

    expect(state.path).toEqual(['รูปภาพ']);
    expect(state.items).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.selectedId).toBeUndefined();
    expect(state.error).toBeUndefined();
  });

  it('itemsLoaded เรียงโฟลเดอร์ก่อนไฟล์ตาม sortKey เริ่มต้น (name asc)', () => {
    let state = createVaultState();
    state = vaultReducer(state, {
      type: 'itemsLoaded',
      items: [
        item({ id: 'f1', name: 'เอกสาร', isFolder: true }),
        item({ id: 'z1', name: 'aaa.pdf' }),
        item({ id: 'a1', name: 'ก่อน.pdf' }),
      ],
    });
    expect(state.items.map((entry) => entry.id)).toEqual(['f1', 'a1', 'z1']);
  });

  it('toggleSort กดคอลัมน์เดิมกลับทิศ กดคอลัมน์ใหม่เริ่ม asc', () => {
    let state = createVaultState();
    state = vaultReducer(state, { type: 'toggleSort', key: 'name' });
    expect(state.sortDir).toBe('desc');
    state = vaultReducer(state, { type: 'toggleSort', key: 'size' });
    expect(state.sortKey).toBe('size');
    expect(state.sortDir).toBe('asc');
  });

  it('upsertItem เติมของใหม่และแทนของเดิมตาม id', () => {
    let state = createVaultState();
    state = vaultReducer(state, { type: 'itemsLoaded', items: [item()] });
    state = vaultReducer(state, { type: 'upsertItem', item: item({ id: 'id-2', name: 'ใหม่.pdf' }) });
    expect(state.items).toHaveLength(2);
    state = vaultReducer(state, { type: 'upsertItem', item: item({ id: 'id-2', name: 'แก้แล้ว.pdf' }) });
    expect(state.items).toHaveLength(2);
    expect(state.items.find((entry) => entry.id === 'id-2')?.name).toBe('แก้แล้ว.pdf');
  });

  it('upsertItem รายการใหม่ไม่มี downloadUrl ให้เก็บอันเดิมไว้ (อัปโหลดใหม่)', () => {
    let state = createVaultState();
    state = vaultReducer(state, {
      type: 'itemsLoaded',
      items: [item({ downloadUrl: 'https://cdn/old' })],
    });
    state = vaultReducer(state, {
      type: 'upsertItem',
      item: item({ size: 200, modifiedAt: '2026-10-02T10:00:00Z' }),
    });
    expect(state.items[0].size).toBe(200);
    expect(state.items[0].downloadUrl).toBe('https://cdn/old');
  });

  it('removeItem ลบรายการและล้างการเลือก/พรีวิวที่ชี้มัน', () => {
    let state = createVaultState();
    state = vaultReducer(state, { type: 'itemsLoaded', items: [item()] });
    state = vaultReducer(state, { type: 'select', id: 'id-1' });
    state = vaultReducer(state, { type: 'preview', id: 'id-1' });
    state = vaultReducer(state, { type: 'removeItem', id: 'id-1' });
    expect(state.items).toHaveLength(0);
    expect(state.selectedId).toBeUndefined();
    expect(state.previewId).toBeUndefined();
  });

  it('removeItem ที่ไม่มีอยู่ไม่เปลี่ยนสถานะ', () => {
    let state = createVaultState();
    expect(vaultReducer(state, { type: 'removeItem', id: 'nope' })).toBe(state);
  });

  it('ลำดับคิวอัปโหลด: add → update → remove', () => {
    let state = createVaultState();
    state = vaultReducer(state, {
      type: 'addUpload',
      task: { id: 'up-1', name: 'a.pdf', size: 10, progress: 0, status: 'queued' },
    });
    state = vaultReducer(state, { type: 'updateUpload', id: 'up-1', patch: { status: 'uploading', progress: 0.5 } });
    expect(state.uploads[0]).toMatchObject({ status: 'uploading', progress: 0.5 });
    state = vaultReducer(state, { type: 'removeUpload', id: 'up-1' });
    expect(state.uploads).toHaveLength(0);
  });
});

describe('พาธและ breadcrumb', () => {
  it('pathString ต่อ Vault นำหน้า', () => {
    expect(pathString([])).toBe('Vault');
    expect(pathString(['รูปภาพ', 'ทะเล'])).toBe('Vault/รูปภาพ/ทะเล');
  });

  it('breadcrumbs คืนหน้าแรกเสมอ และสะสมพาธถูกต้อง', () => {
    const crumbs = breadcrumbs(['a', 'b']);
    expect(crumbs).toEqual([
      { name: '🔐 คลังไฟล์', path: [] },
      { name: 'a', path: ['a'] },
      { name: 'b', path: ['a', 'b'] },
    ]);
  });
});
