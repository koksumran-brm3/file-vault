/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Application (client) ID จาก Azure App registration — ไม่ใส่แอปจะขึ้นหน้าตั้งค่า */
  readonly VITE_AZURE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
