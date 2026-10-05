/**
 * การยืนยันตัวตนกับ Microsoft — MSAL.js (Public client, SPA ล้วน)
 *
 * ไม่มี secret ใด ๆ ฝั่งเว็บ: แอปขอสิทธิ์ delegated จากผู้ใช้ที่ล็อกอินเอง
 * โทเคนเก็บใน sessionStorage ของเบราว์เซอร์ ปิดแท็บเมื่อไหร่ก็หายไป
 */
import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';

/** สิทธิ์ที่แอปขอ — เห็น/แก้ไฟล์ของผู้ล็อกอินเท่านั้น */
export const GRAPH_SCOPES = ['Files.ReadWrite.All', 'User.Read'];

/** อ่าน client ID จาก env — ตัดว่างทิ้งเพื่อให้ .env ที่ยังไม่กรอกถือว่า "ยังไม่ตั้งค่า" */
export function readClientId(env: { VITE_AZURE_CLIENT_ID?: string }): string | undefined {
  const value = env.VITE_AZURE_CLIENT_ID?.trim();
  return value ? value : undefined;
}

/**
 * redirect URI ต้องตรงกับที่ลงทะเบียนใน Azure เป๊ะ
 * - dev: origin ล้วน (ตรงกับ http://localhost:5173 ที่ลงทะเบียนไว้)
 * - site จริง: origin + base path เช่น https://user.github.io/file-vault/
 */
function appRedirectUri(): string {
  const base = import.meta.env.BASE_URL; // ลงท้าย '/' เสมอ
  return base === '/' ? window.location.origin : `${window.location.origin}${base}`;
}

export function createMsalInstance(clientId: string): PublicClientApplication {
  const config: Configuration = {
    auth: {
      clientId,
      // "common" = รับทั้งบัญชีส่วนตัว (outlook/hotmail) และบัญชีองค์กร (work/school)
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: appRedirectUri(),
      postLogoutRedirectUri: appRedirectUri(),
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  };
  return new PublicClientApplication(config);
}

/** ขอโทเคนสำหรับเรียก Graph — พยายามเงียบ ๆ ก่อน ถ้า MSAL บังคับให้ผู้ใช้โต้ตอบค่อยเปิด popup */
export async function acquireGraphToken(
  instance: PublicClientApplication,
  account: AccountInfo,
): Promise<string> {
  try {
    const result = await instance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const result = await instance.acquireTokenPopup({ scopes: GRAPH_SCOPES, account });
      return result.accessToken;
    }
    throw error;
  }
}

/** แปลงข้อผิดพลาดของ MSAL เป็นข้อความไทยที่ผู้ใช้อ่านรู้เรื่อง */
export function friendlyMsalMessage(error: unknown): string {
  const code = (error as { errorCode?: string } | undefined)?.errorCode;
  switch (code) {
    case 'user_cancelled':
      return 'คุณยกเลิกการล็อกอิน';
    case 'popup_window_error':
      return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน — อนุญาต popup สำหรับไซต์นี้แล้วลองใหม่';
    case 'consent_required':
    case 'interaction_required':
      return 'ต้องขอสิทธิ์เพิ่ม — กดล็อกอินอีกครั้งแล้วกดยอมรับ';
    default:
      return error instanceof Error ? error.message : String(error);
  }
}
