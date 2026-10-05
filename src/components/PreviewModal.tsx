/** โมดัลพรีวิว — รูปภาพแสดงตรง ๆ, PDF ฝังผ่าน iframe, ชนิดอื่นเสนอดาวน์โหลด */
import { useEffect, useMemo } from 'react';
import type { VaultItem } from '../state/vault-state';
import { formatBytes, formatModified } from '../util/format';
import { FileChip } from './FileList';

export interface PreviewModalProps {
  item: VaultItem;
  /** Blob ของไฟล์ (โหลดแล้ว) หรือ undefined ขณะกำลังโหลด */
  blob?: Blob;
  loading: boolean;
  error?: string;
  onClose(): void;
  onDownload(): void;
}

export function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

export function isPdf(name: string): boolean {
  return /\.pdf$/i.test(name);
}

export function PreviewModal({ item, blob, loading, error, onClose, onDownload }: PreviewModalProps) {
  // ปิดด้วย Escape
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  // คืนทรัพยากรเมื่อปิด — URL วัตถุไม่ควรค้างในหน่วยความจำ
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`พรีวิว ${item.name}`} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-title">
            <FileChip name={item.name} isFolder={item.isFolder} />
            <span className="item-text">
              <b className="item-name">{item.name}</b>
              {!item.isFolder ? (
                <span className="item-meta">
                  {formatBytes(item.size)} · {formatModified(item.modifiedAt)}
                </span>
              ) : null}
            </span>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onDownload}>⬇ <span className="btn-label">ดาวน์โหลด</span></button>
            <button type="button" onClick={onClose} title="ปิด (Esc)">✕</button>
          </div>
        </header>
        <div className="modal-body">
          {loading ? <div className="empty-state">กำลังโหลดพรีวิว…</div> : null}
          {error ? <div className="empty-state error">{error}</div> : null}
          {!loading && !error && objectUrl && isImage(item.name) ? (
            <img src={objectUrl} alt={item.name} />
          ) : null}
          {!loading && !error && objectUrl && isPdf(item.name) ? (
            <iframe src={objectUrl} title={`พรีวิว ${item.name}`} />
          ) : null}
          {!loading && !error && objectUrl && !isImage(item.name) && !isPdf(item.name) ? (
            <div className="empty-state">
              <p>ไฟล์ชนิดนี้ยังพรีวิวในแอปไม่ได้</p>
              <button type="button" className="primary" onClick={onDownload}>
                ⬇ <span className="btn-label">ดาวน์โหลดเพื่อเปิดด้วยแอปอื่น</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
