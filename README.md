# 🔐 File Vault — คลังไฟล์ส่วนตัวบน OneDrive

เว็บแอปง่าย ๆ สำหรับเก็บไฟล์ส่วนตัว โดยไฟล์ทั้งหมดอยู่บน **OneDrive ของคุณเอง**
แอปเป็น SPA ล้วน **ไม่มี backend ของตัวเอง** — เบราว์เซอร์คุยกับ Microsoft Graph ตรง ๆ
ไฟล์ของคุณจึงไม่ผ่านเซิร์ฟเวอร์อื่นเลย

## ความสามารถ

- ลิสต์ไฟล์/โฟลเดอร์ เรียงตามชื่อ ขนาด หรือวันแก้ไข
- อัปโหลด: กดปุ่ม หรือ **ลากไฟล์มาวาง** — ไฟล์ใหญ่แบ่งส่งทีละ 5MB พร้อมแถบความคืบหน้า
- ดาวน์โหลดไฟล์เดิมชื่อเดิม
- โฟลเดอร์: สร้างใหม่ เข้า-ออก พร้อม breadcrumb กดย้อนได้ทุกชั้น
- เปลี่ยนชื่อ / ลบ (ของไปอยู่ถังขยะ OneDrive ยังกู้คืนได้จาก onedrive.com)
- พรีวิวรูปภาพ (PNG/JPEG/GIF/WebP/SVG) และ PDF ในแอป
- UI ภาษาไทยทั้งหมด

ไฟล์ทั้งหมดถูกจัดไว้ในโฟลเดอร์ `Vault` บน OneDrive ของคุณ (ไม่ปนกับไฟล์อื่น)

## เริ่มใช้งาน

### 1) ติดตั้ง

```bash
cd file-vault
npm install
```

### 2) ลงทะเบียนแอปกับ Microsoft (ทำครั้งเดียว ~3 นาที)

1. เปิด <https://portal.azure.com> → ค้นหา **App registrations** (หรือเมนู **Microsoft Entra ID** → App registrations) → **New registration**
2. ตั้งชื่อ เช่น `File Vault`
   - หัวข้อ "Who can use this application or access this API?" เลือก
     **Accounts in any organizational directory and personal Microsoft accounts**
     (เพื่อรองรับบัญชี outlook.com/hotmail.com ด้วย)
3. หน้า Redirect URI: Platform เลือก **Single-page application (SPA)** แล้วกรอก
   ```
   http://localhost:5173
   ```
   (ถ้าพลาดหน้านี้ ไปเพิ่มภายหลังได้ที่เมนู **Authentication**)
4. กด Register แล้วคัดลอกค่า **Application (client) ID** จากหน้า Overview
5. เมนู **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   เลือก `Files.ReadWrite.All` และ `User.Read` → กด Add
   (ไม่ต้องกด "Grant admin consent" — ผู้ใช้ยินยอมเองตอนล็อกอินครั้งแรก)

### 3) ใส่ client ID แล้วรัน

```bash
cp .env.example .env
# เปิด .env แล้วใส่: VITE_AZURE_CLIENT_ID=ค่าที่คัดลอกมา

npm run dev
# เปิด http://localhost:5173 แล้วล็อกอินด้วยบัญชี Microsoft ของคุณ
```

> ถ้ายังไม่ใส่ client ID แอปจะขึ้นหน้า "ตั้งค่า" พร้อมขั้นตอนย่อให้ตั้งแต่ในแอป

## คำสั่งที่ใช้บ่อย

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | รัน dev server ที่พอร์ต 5173 (พอร์ตล็กไว้เพราะ redirect URI ต้องตรง) |
| `npm run build` | สร้าง build จริงลง `dist/` |
| `npm run preview` | ลอง build จริง (พอร์ต 4173 — ต้องเพิ่ม redirect URI นี้ใน Azure ด้วยจึงจะล็อกอินได้) |
| `npm test` | รันยูนิตเทส (vitest) |
| `npm run typecheck` | ตรวจ TypeScript ทั้งโปรเจกต์ |

## ขึ้น site จริง (GitHub Pages)

โฮสต์ฟรีบน GitHub Pages — ไฟล์ static ล้วน ไม่ต้องมีเซิร์ฟเวอร์ ทุก push ไป `main` build + ขึ้น site อัตโนมัติ

**เตรียม (ทำครั้งเดียว)**

1. Push repo ขึ้น GitHub โดยตั้งชื่อ repo ให้ตรงกับ base path (ค่าเริ่มต้น `file-vault`)
2. Repo → Settings → **Secrets and variables** → **Actions** → **Secrets** → New repository secret:
   `VITE_AZURE_CLIENT_ID` = ค่า Application (client) ID
3. Repo → Settings → **Secrets and variables** → **Actions** → **Variables** → New repository variable:
   `BASE_PATH` = `/file-vault/` (แก้ถ้าชื่อ repo ต่างจากนี้)
4. Repo → Settings → **Pages** → Source = **GitHub Actions**
5. Azure Portal → App registration → **Authentication** → Add a redirect URI
   (Platform: **Single-page application**):
   ```
   https://<ชื่อ user>.github.io/file-vault/
   ```
   (ต้องตรงเป๊ะ รวม trailing slash)

จากนั้นดูผล build ได้ที่แท็บ **Actions** site จะอยู่ที่
`https://<ชื่อ user>.github.io/file-vault/`

> มีโดเมนส่วนตัว: เพิ่มใน Settings → Pages → Custom domain
> (และเพิ่ม redirect URI ใหม่ของโดเมนนั้นใน Azure ด้วย)

## บน Android (PWA)

แอปเป็น PWA — ใช้เป็นแอปบน Android ได้เลย ไม่ต้อง build APK:

1. เปิด site ใน **Chrome** บนมือถือ
2. เมนู (⋮) → **เพิ่มหน้าจอหลัก / ติดตั้งแอป**
3. เปิดจากไอคอน — เต็มจอเหมือนแอปทั่วไป อัปเดตอัตโนมัติ

(iOS: ใช้ "เพิ่มไปยังหน้าจอบ้าน" ผ่าน Safari ได้เช่นกัน)

## แก้ปัญหาที่เจอบ่อย

### "The ability to create applications outside of a directory has been deprecated"

เจอตอนกด **New registration** ด้วยบัญชีส่วนตัว (outlook/hotmail) — เพราะบัญชีส่วนตัวไม่มี
"directory" (tenant) ของตัวเองใน Azure วิธีแก้คือสร้าง directory ฟรีก่อน แล้วจึงลงทะเบียนแอป:

**ทางเลือก A — Microsoft 365 Developer Program (ฟรี ไม่ต้องใช้บัตร, แนะนำ)**
1. เปิด <https://developer.microsoft.com/en-us/microsoft-365/dev-program> แล้ว **Join now** ด้วยบัญชีส่วนตัวของคุณ
2. ตอบคำถามสั้น ๆ แล้วตั้งค่า sandbox tenant (ตั้งชื่อโดเมน เช่น `yourname.onmicrosoft.com`)
3. กลับไปที่ <https://portal.azure.com> — มุมขวาบนจะเลือก directory ได้ ให้สลับไป tenant ใหม่ (ชื่อโดเมนที่เพิ่งตั้ง)
4. ทำขั้นตอน "ลงทะเบียนแอป" ด้านบนต่อได้เลยใน tenant นี้

> ⚠️ สำคัญ: แอปที่ลงทะเบียนใน tenant นี้ใช้กับบัญชีส่วนตัวของคุณได้ปกติ
> (เพราะเราเลือกให้รับทั้งบัญชีส่วนตัวและองค์กรตอนลงทะเบียน)
> ตอนใช้งานแอป **ให้ล็อกอินด้วยบัญชีส่วนตัวของคุณ ไม่ใช่บัญชี admin ของ sandbox**
> ไฟล์จึงอยู่บน OneDrive ส่วนตัวของคุณจริง ๆ ไม่ใช่พื้นที่ของ sandbox

**ทางเลือก B — สมัคร Azure ฟรี (ต้องใช้บัตรเครดิตเพื่อยืนยันตัวตน)**
- สมัครที่ <https://azure.microsoft.com/free> จะได้ tenant ถาวรของตัวเอง + เครดิต $200
- จากนั้นลงทะเบียนแอปได้เหมือนกัน — tenant แบบนี้ไม่มีปัญหาอายุ ต่างจาก sandbox ที่ต้องใช้งานต่อเนื่องเพื่อต่ออายุ

## ทำไมต้องลงทะเบียนแอป?

Microsoft ต้องการรู้ว่า "ใคร" ขอสิทธิ์เข้าถึงไฟล์ของผู้ใช้ — App registration คือ
ตัวตนของแอปนี้ โดย client ID ไม่ใช่ความลับ (ฝั่ง SPA ไม่มี secret ใด ๆ)
สิทธิ์ทั้งหมดมาจากการยินยอมของบัญชีที่ล็อกอิน และถอนคืนได้ทุกเมื่อจาก
<https://account.microsoft.com/privacy> (หัวข้อ Apps & services)

## ความเป็นส่วนตัว

- โทเคนการยืนยันตัวตนเก็บใน **sessionStorage** ของเบราว์เซอร์เท่านั้น ปิดแท็บคือหาย
- ไฟล์วิ่งตรงจากเบราว์เซอร์คุณ → Microsoft เท่านั้น ไม่มีเซิร์ฟเวอร์กลางเก็บสำเนา
- แอปขอสิทธิ์แค่ 2 อย่าง: `Files.ReadWrite.All` (จัดการไฟล์) และ `User.Read` (โปรไฟล์พื้นฐาน)

## ข้อจำกัดที่รู้ไว้

- ไฟล์เดียวสูงสุดตามที่ OneDrive อนุญาต (แผนส่วนตัว ~250GB) — แอปแบ่งส่งทีละ 5MB รองรับไฟล์ใหญ่ได้
- ชื่อไฟล์ที่ Microsoft ห้าม: `\ / : * ? " < > | # %` (แอปตรวจให้ก่อนตั้งชื่อ)
- พรีวิวรองรับรูปภาพและ PDF — ชนิดอื่นกดดาวน์โหลดไปเปิดแยก
- ลบจากแอป = ย้ายไปถังขยะ OneDrive (กู้คืนจาก onedrive.com ได้ภายใน 30 วัน)

## โครงสร้างโค้ด

```
src/
  auth/msal.ts          คอนฟิก MSAL + ขอโทเคน (silent → popup เมื่อจำเป็น)
  api/graph.ts          ไคลเอนต์ Microsoft Graph (list/upload/rename/delete/mkdir)
  api/upload.ts         วางแผนแบ่งชิ้นอัปโหลด + รัน upload session
  state/vault-state.ts  reducer สถานะ (บริสุทธิ์ ทดสอบตรง ๆ)
  util/format.ts        จัดรูปแบบขนาด/วันที่/ชื่อซ้ำ (บริสุทธิ์)
  components/           SetupScreen, LoginScreen, Toolbar, Breadcrumb,
                        FileList, UploadProgress, PreviewModal
test/                   ยูนิตเทส (vitest)
```

## แนวทางต่อยอด

- เข้ารหัสไฟล์ในเบราว์เซอร์ก่อนอัปโหลด (Web Crypto AES-GCM) — เปิดได้เฉพาะในแอป
- Deploy บน GitHub Pages (ดูหัวข้อข้างต้น) หรือ Cloudflare Pages / Vercel — ไม่ว่าที่ไหน ต้องเพิ่ม redirect URI ของโดเมนจริงใน Azure ด้วย
- ค้นหาทั้งคลัง (`/me/drive/root:/Vault:/search(q='...')`) และแชร์ลิงก์
- แสดงพื้นที่คงเหลือ (`GET /me/drive` → quota)
