/** หน้าตั้งค่า — แสดงเมื่อยังไม่ได้ใส่ VITE_AZURE_CLIENT_ID */
export function SetupScreen() {
  return (
    <main className="center-screen">
      <div className="card setup">
        <h1>🔐 คลังไฟล์ของฉัน</h1>
        <p className="lead">แอปนี้เก็บไฟล์ของคุณบน OneDrive ของคุณเอง — ไฟล์ไม่ผ่านเซิร์ฟเวอร์อื่น</p>
        <h2>ต้องตั้งค่าก่อนใช้งาน (ครั้งเดียว)</h2>
        <ol className="setup-steps">
          <li>
            เปิด <code>portal.azure.com</code> → <b>Microsoft Entra ID</b> → <b>App registrations</b> → <b>New registration</b>
          </li>
          <li>ชื่ออะไรก็ได้ (เช่น File Vault) และเลือกบัญชีที่รองรับทั้งส่วนตัวและองค์กร</li>
          <li>
            Platform: เลือก <b>Single-page application (SPA)</b> แล้วใส่ redirect URI:
            <br />
            <code>http://localhost:5173</code>
          </li>
          <li>
            ที่เมนู <b>API permissions</b>: เพิ่ม Microsoft Graph → Delegated → <code>Files.ReadWrite.All</code> และ <code>User.Read</code>
          </li>
          <li>
            คัดลอก <b>Application (client) ID</b> มาใส่ไฟล์ <code>.env</code> (ดูตัวอย่างที่ <code>.env.example</code>) แล้วรัน <code>npm run dev</code> ใหม่
          </li>
        </ol>
        <p className="muted">ขั้นตอนละเอียดพร้อมภาพประกอบอยู่ใน README.md</p>
      </div>
    </main>
  );
}
