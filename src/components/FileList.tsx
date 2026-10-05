/** ตารางรายการไฟล์/โฟลเดอร์ — กดโฟลเดอร์เพื่อเข้า, กดไฟล์เพื่อพรีวิว */
import type { VaultItem } from '../state/vault-state';
import { formatBytes, formatModified } from '../util/format';

export interface FileListProps {
  items: VaultItem[];
  loading: boolean;
  error?: string;
  selectedId?: string;
  sortKey: 'name' | 'size' | 'modified';
  sortDir: 'asc' | 'desc';
  onSelect(id: string | undefined): void;
  onOpen(item: VaultItem): void;
  onToggleSort(key: 'name' | 'size' | 'modified'): void;
  onRename(item: VaultItem): void;
  onDelete(item: VaultItem): void;
  onDownload(item: VaultItem): void;
}

const SORT_LABELS = [
  { key: 'name', label: 'ชื่อ' },
  { key: 'size', label: 'ขนาด' },
  { key: 'modified', label: 'แก้ไขเมื่อ' },
] as const;

/** จำนวนแถว skeleton ขณะโหลดครั้งแรก */
const SKELETON_ROWS = 6;

export function FileList(props: FileListProps) {
  if (props.loading && props.items.length === 0) {
    return (
      <div className="file-table" aria-busy="true" aria-label="กำลังโหลดรายการ">
        <div role="presentation">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div
              key={index}
              className="skeleton-row"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="skeleton skeleton-chip" />
              <span className="skeleton skeleton-line" style={{ width: '55%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (props.error) {
    return <div className="empty-state error">{props.error}</div>;
  }
  if (props.items.length === 0) {
    return (
      <div className="empty-state">
        <svg
          className="empty-illustration"
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          aria-hidden="true"
        >
          <rect x="4" y="12" width="48" height="34" rx="7" fill="#eef4ff" />
          <path d="M4 20h48" stroke="#c7dbfb" strokeWidth="2" />
          <path
            d="M12 12l5-4h14l5 4"
            stroke="#c7dbfb"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="28" cy="33" r="6" stroke="#2563eb" strokeWidth="2.5" />
          <path d="M32 37l4 4" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <p>โฟลเดอร์นี้ยังว่าง</p>
        <p className="muted">ลากไฟล์มาวางที่หน้านี้ หรือกด "＋ อัปโหลดไฟล์" ด้านบน</p>
      </div>
    );
  }

  return (
    <table className="file-table">
      <thead>
        <tr>
          {SORT_LABELS.map(({ key, label }) => (
            <th key={key} className={key === 'name' ? 'col-name' : undefined}>
              <button type="button" className="sort-btn" onClick={() => props.onToggleSort(key)}>
                {label}
                {props.sortKey === key ? (props.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </button>
            </th>
          ))}
          <th className="col-actions" aria-label="การจัดการ" />
        </tr>
      </thead>
      <tbody>
        {props.items.map((item, index) => (
          <tr
            key={item.id}
            className={props.selectedId === item.id ? 'selected' : undefined}
            style={{ '--i': index } as React.CSSProperties}
            onClick={() => props.onSelect(item.id)}
          >
            <td className="col-name">
              <button type="button" className="item-btn" onClick={() => props.onOpen(item)} title={item.name}>
                <FileChip name={item.name} isFolder={item.isFolder} />
                <span className="item-text">
                  <span className="item-name">{item.name}</span>
                  {/* มือถือ: แสดงข้อมูลใต้ชื่อ (PC มีคอลัมน์แยกอยู่แล้ว) */}
                  <span className="item-meta">
                    {item.isFolder ? 'โฟลเดอร์' : formatBytes(item.size)} ·{' '}
                    {formatModified(item.modifiedAt)}
                  </span>
                </span>
              </button>
            </td>
            <td className="col-size">{item.isFolder ? '—' : formatBytes(item.size)}</td>
            <td className="col-modified">{formatModified(item.modifiedAt)}</td>
            <td className="col-actions">
              <div className="row-actions">
                {!item.isFolder ? (
                  <button type="button" title="ดาวน์โหลด" onClick={(e) => stopThen(e, () => props.onDownload(item))}>
                    ⬇
                  </button>
                ) : null}
                <button type="button" title="เปลี่ยนชื่อ" onClick={(e) => stopThen(e, () => props.onRename(item))}>
                  ✏️
                </button>
                <button type="button" title="ลบ (ไปถังขยะ OneDrive)" onClick={(e) => stopThen(e, () => props.onDelete(item))}>
                  🗑
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** chip สีตามชนิดไฟล์ — โฟลเดอร์ใช้ emoji, ไฟล์ใช้นามสกุลย่อ */
export function FileChip({ name, isFolder }: { name: string; isFolder: boolean }) {
  if (isFolder) {
    return <span className="file-chip folder" aria-hidden="true">📁</span>;
  }
  const ext = fileExtension(name);
  return (
    <span
      className="file-chip"
      style={{ background: chipColor(ext) }}
      aria-hidden="true"
    >
      {ext || '·'}
    </span>
  );
}

function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].slice(0, 4) : '';
}

/** สี chip ตามกลุ่มนามสกุล */
function chipColor(ext: string): string {
  const groups: Record<string, string> = {
    image: '#7c3aed', // ม่วง — รูปภาพ
    pdf: '#dc2626', // แดง — PDF
    doc: '#2563eb', // น้ำเงิน — เอกสาร
    sheet: '#059669', // เขียว — ตาราง
    slide: '#ea580c', // ส้ม — สไลด์
    archive: '#64748b', // เทา — บีบอัด
    video: '#db2777', // ชมพู — วิดีโอ
    audio: '#0d9488', // เทอร์คอยส์ — เสียง
    text: '#475569', // สไลต์ — ข้อความ
  };
  const lower = ext.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(lower)) return groups.image;
  if (lower === 'pdf') return groups.pdf;
  if (['doc', 'docx', 'odt', 'rtf'].includes(lower)) return groups.doc;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(lower)) return groups.sheet;
  if (['ppt', 'pptx'].includes(lower)) return groups.slide;
  if (['zip', '7z', 'rar', 'tar', 'gz'].includes(lower)) return groups.archive;
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(lower)) return groups.video;
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(lower)) return groups.audio;
  if (['txt', 'md'].includes(lower)) return groups.text;
  return '#94a3b8'; // ไฟล์อื่น ๆ
}

function stopThen(event: React.MouseEvent, action: () => void): void {
  event.stopPropagation();
  action();
}
