/**
 * ตัวประกอบหลักของแอป: ตั้งค่า → ล็อกอิน → เรียกดู/จัดการไฟล์บน OneDrive
 *
 * การจัดการไฟล์ทุกอย่างเรียก Microsoft Graph ผ่านไคลเอนต์ใน src/api
 * สถานะทั้งหมดวิ่งผ่าน vaultReducer เพื่อให้พฤติกรรมตรวจสอบได้
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AccountInfo, PublicClientApplication } from '@azure/msal-browser';
import {
  acquireGraphToken,
  createMsalInstance,
  friendlyMsalMessage,
  GRAPH_SCOPES,
  readClientId,
} from './auth/msal';
import {
  createGraphClient,
  createFolder,
  createVaultFolder,
  deleteItem,
  fetchAsBlob,
  fetchItemContent,
  GraphError,
  listChildren,
  renameItem,
  type GraphClient,
} from './api/graph';
import { newUploadTaskId, uploadFile } from './api/upload';
import { breadcrumbs, createVaultState, vaultReducer, type VaultItem } from './state/vault-state';
import { nameProblem } from './util/format';
import { SetupScreen } from './components/SetupScreen';
import { LoginScreen } from './components/LoginScreen';
import { Toolbar } from './components/Toolbar';
import { Breadcrumb } from './components/Breadcrumb';
import { FileList } from './components/FileList';
import { UploadProgress } from './components/UploadProgress';
import { PreviewModal } from './components/PreviewModal';

export function App() {
  const clientId = readClientId(import.meta.env);

  if (!clientId) return <SetupScreen />;
  return <VaultApp clientId={clientId} />;
}

function VaultApp({ clientId }: { clientId: string }) {
  const [state, dispatch] = useReducer(vaultReducer, undefined, createVaultState);
  const [account, setAccount] = useState<AccountInfo | undefined>();
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [previewBlob, setPreviewBlob] = useState<Blob | undefined>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);

  const instanceRef = useRef<PublicClientApplication | undefined>(undefined);
  const initStarted = useRef(false);
  const busyUploading = state.uploads.some((task) => task.status === 'uploading' || task.status === 'queued');

  /* --------------------------- MSAL: เริ่มต้น + redirect --------------------------- */

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    const instance = createMsalInstance(clientId);
    instanceRef.current = instance;

    instance
      .initialize()
      .then(async () => {
        // กลับจาก redirect ล็อกอิน (เรียกตอนโหลดหน้าเสมอ ตามแนวปฏิบัติของ MSAL)
        let returned: Awaited<ReturnType<typeof instance.handleRedirectPromise>> | undefined;
        try {
          returned = await instance.handleRedirectPromise();
          if (returned?.account) setAccount(returned.account);
        } catch (error) {
          setLoginError(`ล็อกอินไม่สำเร็จ: ${friendlyMsalMessage(error)}`);
        }
        if (!returned?.account) {
          const accounts = instance.getAllAccounts();
          if (accounts[0]) setAccount(accounts[0]);
        }
      })
      .catch((error: unknown) => {
        setLoginError(`เริ่มต้นระบบยืนยันตัวตนไม่สำเร็จ: ${messageOf(error)}`);
      });
  }, [clientId]);

  /** ล็อกอินแบบ redirect — ทนทานกว่า popup (ไม่โดน popup blocker) */
  const login = useCallback(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    setLoginBusy(true);
    setLoginError(undefined);
    instance
      .loginRedirect({ scopes: GRAPH_SCOPES })
      .catch((error: unknown) => {
        setLoginBusy(false);
        setLoginError(`ล็อกอินไม่สำเร็จ: ${friendlyMsalMessage(error)}`);
      });
    // ถ้าสำเร็จ หน้าจะถูก redirect ไป Microsoft แล้วกลับมาที่นี่พร้อม account
  }, []);

  const logout = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance) return;
    try {
      await instance.logoutPopup();
    } finally {
      setAccount(undefined);
    }
  }, []);

  /* ------------------------------ Graph client ------------------------------ */

  const client = useMemo<GraphClient | undefined>(() => {
    if (!account || !instanceRef.current) return undefined;
    const currentAccount = account;
    const instance = instanceRef.current;
    return createGraphClient(() => acquireGraphToken(instance, currentAccount));
  }, [account]);

  /* ------------------------------ โหลดรายการ ------------------------------ */

  const refresh = useCallback(
    async (path: string[]) => {
      if (!client) return;
      dispatch({ type: 'loading' });
      try {
        const items = await listChildren(client, path);
        dispatch({ type: 'itemsLoaded', items });
      } catch (error) {
        // รันครั้งแรกที่ยังไม่มีโฟลเดอร์ Vault บน OneDrive — สร้างให้เอง แล้วลองลิสต์ใหม่
        if (path.length === 0 && error instanceof GraphError && error.status === 404) {
          try {
            await createVaultFolder(client);
            const items = await listChildren(client, path);
            dispatch({ type: 'itemsLoaded', items });
            return;
          } catch (retryError) {
            // สร้าง Vault หรือลิสต์ซ้ำไม่สำเร็จ — แสดงสาเหตุจริง
            dispatch({
              type: 'loadFailed',
              message: `สร้างโฟลเดอร์ Vault ไม่สำเร็จ: ${messageOf(retryError)}`,
            });
            return;
          }
        }
        dispatch({ type: 'loadFailed', message: messageOf(error) });
      }
    },
    [client],
  );

  useEffect(() => {
    if (client) void refresh(state.path);
    // state.path เปลี่ยน = เปลี่ยนโฟลเดอร์ → โหลดใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, state.path]);

  /* ------------------------------ การอัปโหลด ------------------------------ */

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!client) return;
      const list = [...files];
      for (const file of list) {
        const id = newUploadTaskId();
        const controller = new AbortController();
        const task = { id, name: file.name, size: file.size, progress: 0, status: 'queued' as const, controller };
        dispatch({ type: 'addUpload', task });
        const onProgress = (fraction: number) =>
          dispatch({ type: 'updateUpload', id, patch: { progress: fraction } });
        try {
          dispatch({ type: 'updateUpload', id, patch: { status: 'uploading' } });
          let item: VaultItem;
          try {
            item = await uploadFile(client, state.path, file, onProgress, controller.signal);
          } catch (error) {
            // โฟลเดอร์ Vault ยังไม่มี (เพิ่งล็อกอิน) — สร้างแล้วอัปโหลดซ้ำครั้งเดียว
            if (state.path.length === 0 && error instanceof GraphError && error.status === 404) {
              await createVaultFolder(client);
              item = await uploadFile(client, state.path, file, onProgress, controller.signal);
            } else {
              throw error;
            }
          }
          dispatch({ type: 'updateUpload', id, patch: { status: 'done', progress: 1 } });
          dispatch({ type: 'upsertItem', item });
        } catch (error) {
          const aborted = error instanceof DOMException && error.name === 'AbortError';
          dispatch({
            type: 'updateUpload',
            id,
            patch: { status: aborted ? 'cancelled' : 'error', message: aborted ? undefined : messageOf(error) },
          });
        }
      }
    },
    [client, state.path],
  );

  /* ------------------------------ จัดการไฟล์ ------------------------------ */

  const createNewFolder = useCallback(async () => {
    if (!client) return;
    const name = window.prompt('ตั้งชื่อโฟลเดอร์ใหม่');
    if (name === null) return;
    const problem = nameProblem(name);
    if (problem) {
      dispatch({ type: 'setError', message: problem });
      return;
    }
    try {
      const item = await createFolder(client, state.path, name.trim());
      dispatch({ type: 'upsertItem', item });
      dispatch({ type: 'setNotice', message: `สร้างโฟลเดอร์ "${item.name}" แล้ว` });
    } catch (error) {
      dispatch({ type: 'setError', message: messageOf(error) });
    }
  }, [client, state.path]);

  const rename = useCallback(
    async (item: VaultItem) => {
      if (!client) return;
      const name = window.prompt(`เปลี่ยนชื่อ "${item.name}" เป็น`, item.name);
      if (name === null || name.trim() === item.name) return;
      const problem = nameProblem(name);
      if (problem) {
        dispatch({ type: 'setError', message: problem });
        return;
      }
      try {
        const updated = await renameItem(client, item.id, name.trim());
        dispatch({ type: 'upsertItem', item: updated });
        dispatch({ type: 'setNotice', message: 'เปลี่ยนชื่อแล้ว' });
      } catch (error) {
        dispatch({ type: 'setError', message: messageOf(error) });
      }
    },
    [client],
  );

  const remove = useCallback(
    async (item: VaultItem) => {
      if (!client) return;
      const kind = item.isFolder ? 'โฟลเดอร์' : 'ไฟล์';
      if (!window.confirm(`ลบ${kind} "${item.name}" ?\n(ของจะไปอยู่ถังขยะของ OneDrive ยังกู้คืนได้)`)) return;
      try {
        await deleteItem(client, item.id);
        dispatch({ type: 'removeItem', id: item.id });
        dispatch({ type: 'setNotice', message: `ลบ "${item.name}" แล้ว (ดูได้ในถังขยะ OneDrive)` });
      } catch (error) {
        dispatch({ type: 'setError', message: messageOf(error) });
      }
    },
    [client],
  );

  const download = useCallback(
    async (item: VaultItem) => {
      if (!item.downloadUrl) {
        // รายการที่เพิ่งอัปโหลดอาจไม่มี downloadUrl — ดึงเนื้อหาผ่าน id ตรง ๆ
        if (!client) return;
        try {
          const blob = await fetchItemContent(client, item.id);
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = item.name;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (error) {
          dispatch({ type: 'setError', message: messageOf(error) });
        }
        return;
      }
      // downloadUrl ของ Graph ตอบ Content-Disposition: attachment ให้เอง
      const anchor = document.createElement('a');
      anchor.href = item.downloadUrl;
      anchor.download = item.name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [client],
  );

  const openPreview = useCallback(
    (item: VaultItem) => {
      dispatch({ type: 'preview', id: item.id });
      setPreviewBlob(undefined);
      setPreviewError(undefined);
      setPreviewLoading(true);
    },
    [],
  );

  // โหลดเนื้อไฟล์เมื่อเปิดพรีวิว
  useEffect(() => {
    if (!state.previewId || !client) return;
    const item = state.items.find((entry) => entry.id === state.previewId);
    if (!item) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(undefined);
    setPreviewBlob(undefined);
    (async () => {
      try {
      if (!item.downloadUrl) {
        // รายการจากการอัปโหลดใหม่อาจไม่มี downloadUrl — ดึงผ่าน id ตรง ๆ
        try {
          const blob = await fetchItemContent(client, item.id);
          if (!cancelled) setPreviewBlob(blob);
        } catch (error) {
          if (!cancelled) setPreviewError(messageOf(error));
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
        return;
      }
        const blob = await fetchAsBlob(item.downloadUrl);
        if (!cancelled) setPreviewBlob(blob);
      } catch (error) {
        if (!cancelled) setPreviewError(messageOf(error));
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.previewId, state.items, state.path, client, refresh]);

  /* ------------------------------ ลากวาง + คีย์บอร์ด ------------------------------ */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing || !state.selectedId) return;
      if (event.key === 'Delete') {
        const item = state.items.find((entry) => entry.id === state.selectedId);
        if (item) void remove(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selectedId, state.items, remove]);

  /* ------------------------------ ส่วนแสดงผล ------------------------------ */

  if (!account) {
    return <LoginScreen clientId={clientId} onLogin={login} busy={loginBusy} error={loginError} />;
  }

  const previewItem = state.items.find((entry) => entry.id === state.previewId);
  const crumbs = breadcrumbs(state.path);

  return (
    <div className={`app ${dragOver ? 'dragging' : ''}`}>
      <Toolbar
        uploading={busyUploading}
        onUploadFiles={(files) => void uploadFiles(files)}
        onCreateFolder={() => void createNewFolder()}
        onRefresh={() => void refresh(state.path)}
        accountName={account.name ?? account.username}
        onLogout={() => void logout()}
      />

      <main
        className="content"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer?.files?.length) void uploadFiles(event.dataTransfer.files);
        }}
      >
        <div className="list-head">
          <Breadcrumb
            crumbs={crumbs}
            onNavigate={(path) => dispatch({ type: 'navigate', path })}
          />
        </div>

        {/* ทับจอขณะลากไฟล์ — pointer-events:none เพื่อให้ drop ผ่าน */}
        {dragOver ? (
          <div className="drop-overlay" aria-hidden="true">
            <div className="drop-hint">ปล่อยไฟล์เพื่ออัปโหลด</div>
          </div>
        ) : null}

        <FileList
          items={state.items}
          loading={state.loading}
          error={state.error}
          selectedId={state.selectedId}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSelect={(id) => dispatch({ type: 'select', id })}
          onOpen={(item) => (item.isFolder ? dispatch({ type: 'navigate', path: [...state.path, item.name] }) : openPreview(item))}
          onToggleSort={(key) => dispatch({ type: 'toggleSort', key })}
          onRename={(item) => void rename(item)}
          onDelete={(item) => void remove(item)}
          onDownload={download}
        />
      </main>

      <UploadProgress
        tasks={state.uploads}
        onRemove={(id) => {
          const task = state.uploads.find((entry) => entry.id === id);
          task?.controller?.abort();
          dispatch({ type: 'removeUpload', id });
        }}
      />

      {previewItem ? (
        <PreviewModal
          item={previewItem}
          blob={previewBlob}
          loading={previewLoading}
          error={previewError}
          onClose={() => dispatch({ type: 'preview', id: undefined })}
          onDownload={() => download(previewItem)}
        />
      ) : null}

      {/* ข้อความแจ้งเตือนลอยเป็น toast */}
      {state.notice ? <div className="toast" role="status">{state.notice}</div> : null}
    </div>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
