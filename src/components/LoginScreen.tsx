/** หน้าล็อกอิน — แสดงเมื่อตั้งค่าครบแล้วแต่ยังไม่ได้ล็อกอินด้วยบัญชี Microsoft */
export interface LoginScreenProps {
  clientId: string;
  onLogin(): void;
  busy: boolean;
  error?: string;
}

export function LoginScreen({ clientId, onLogin, busy, error }: LoginScreenProps) {
  return (
    <main className="center-screen">
      <div className="card">
        <h1>🔐 คลังไฟล์ของฉัน</h1>
        <p className="lead">ไฟล์ทั้งหมดเก็บบน OneDrive ของคุณเอง เข้าถึงด้วยบัญชี Microsoft ของคุณเท่านั้น</p>
        <p className="muted">
          client ID: <code>{clientId}</code>
        </p>
        <button type="button" className="primary" onClick={onLogin}>
          {busy ? 'กำลังพาไปหน้าล็อกอิน…' : 'ล็อกอินด้วยบัญชี Microsoft'}
        </button>
        {error ? <p className="error">{error}</p> : null}
        <p className="muted small">
          แอปขอสิทธิ์เพียงสองอย่าง: จัดการไฟล์ของคุณ (Files.ReadWrite.All) และดูโปรไฟล์พื้นฐาน (User.Read)
        </p>
      </div>
    </main>
  );
}
