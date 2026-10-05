/** breadcrumb แสดงตำแหน่งโฟลเดอร์ปัจจุบัน กดย้อนได้ทุกชั้น
 *  มือถือย่อเหลือ "ต้น … ปัจจุบัน" (ชั้นกลางซ่อน) */
import type { Crumb } from '../state/vault-state';

export interface BreadcrumbProps {
  crumbs: Crumb[];
  onNavigate(path: string[]): void;
}

export function Breadcrumb({ crumbs, onNavigate }: BreadcrumbProps) {
  const hasMiddle = crumbs.length > 2;
  return (
    <nav className="breadcrumb" aria-label="ตำแหน่งโฟลเดอร์">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        const middle = index > 0 && !last;
        return (
          <span key={crumb.path.join('/') || 'root'} className="crumb-wrap">
            {middle ? (
              /* ชั้นกลาง — มือถือซ่อน (crumb-mid) เหลือจุดไข่ปลาแทน */
              <span className="crumb-mid">
                <span className="crumb-sep">/</span>
                <a
                  href="#"
                  className="crumb"
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(crumb.path);
                  }}
                >
                  {crumb.name}
                </a>
              </span>
            ) : (
              <>
                {index > 0 ? <span className="crumb-sep">/</span> : null}
                {last ? (
                  <span className="crumb current" aria-current="location">
                    {crumb.name}
                  </span>
                ) : (
                  <a
                    href="#"
                    className="crumb"
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(crumb.path);
                    }}
                  >
                    {crumb.name}
                  </a>
                )}
              </>
            )}
            {index === 0 && hasMiddle ? <span className="crumb-ellipsis"> …</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
