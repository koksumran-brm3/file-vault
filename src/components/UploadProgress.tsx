/** แผงสถานะการอัปโหลด — แสดงเฉพาะเมื่อมีรายการในคิว */
import type { UploadTask } from '../api/upload';
import { formatBytes } from '../util/format';

export interface UploadProgressProps {
  tasks: UploadTask[];
  onRemove(id: string): void;
}

const STATUS_LABEL: Record<UploadTask['status'], string> = {
  queued: 'รอคิว',
  uploading: 'กำลังอัปโหลด',
  done: 'เสร็จสิ้น',
  error: 'ล้มเหลว',
  cancelled: 'ยกเลิกแล้ว',
};

export function UploadProgress({ tasks, onRemove }: UploadProgressProps) {
  if (tasks.length === 0) return null;
  const sending = tasks.filter((t) => t.status === 'uploading').length;
  return (
    <div className="upload-panel" role="status">
      <div className="upload-panel-title">
        การอัปโหลด ({sending} กำลังส่ง)
      </div>
      <ul>
        {tasks.map((task) => {
          const fraction = task.status === 'done' ? 1 : task.progress;
          const percent = Math.round(fraction * 100);
          return (
            <li key={task.id}>
              <div className="upload-row">
                <span className="upload-name" title={task.name}>
                  {task.name}
                </span>
                <span className={`upload-status st-${task.status}`}>
                  {task.message ?? STATUS_LABEL[task.status]}
                </span>
                <button
                  type="button"
                  className="upload-close"
                  title={task.status === 'uploading' ? 'ยกเลิก' : 'ปิด'}
                  onClick={() => onRemove(task.id)}
                >
                  ✕
                </button>
              </div>
              <div className="pbar">
                <div
                  className={`pbar-fill st-${task.status}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`อัปโหลด ${task.name}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="upload-meta muted">
                {formatBytes(task.size)} · {percent}%
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
