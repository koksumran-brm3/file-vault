/** แถบเครื่องมือด้านบน — อัปโหลด, สร้างโฟลเดอร์, บัญชีผู้ใช้, ล็อกเอาต์ */
import { useRef } from 'react';

export interface ToolbarProps {
  uploading: boolean;
  onUploadFiles(files: FileList | File[]): void;
  onCreateFolder(): void;
  onRefresh(): void;
  accountName?: string;
  onLogout(): void;
}

/** ตัวอักษรต้นของบัญชี ไว้บน avatar */
function accountInitial(name?: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}

export function Toolbar({ uploading, onUploadFiles, onCreateFolder, onRefresh, accountName, onLogout }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="toolbar">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) onUploadFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <div className="toolbar-title">🔐 <span className="btn-label">คลังไฟล์ของฉัน</span></div>
      <div className="toolbar-group">
        <button type="button" className="primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
          ＋ <span className="btn-label">อัปโหลดไฟล์</span>
        </button>
        <button type="button" onClick={onCreateFolder}>📁 <span className="btn-label">โฟลเดอร์ใหม่</span></button>
        <button type="button" onClick={onRefresh} title="โหลดรายการใหม่">↻</button>
      </div>
      <div className="spacer" />
      {accountName ? (
        <div className="account-chip" title={accountName}>
          <span className="account-avatar" aria-hidden="true">
            {accountInitial(accountName)}
          </span>
          <span className="account-name">{accountName}</span>
        </div>
      ) : null}
      <button type="button" onClick={onLogout} title="ออกจากระบบ">
        ⏻ <span className="btn-label">ออกจากระบบ</span>
      </button>
    </header>
  );
}
