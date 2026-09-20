# Nongkapi TTM Helper (Chrome Extension)

ส่วนขยายเว็บบนเบราว์เซอร์ Chrome (Manifest V3) ออกแบบมาเพื่อช่วยเหลือการทำรายการจองบัตรบนเว็บไซต์ **ThaiTicketMajor (TTM)** ได้อย่างสะดวกรวดเร็ว โดยทำงานแบบ Pure Standalone Extension (ออฟไลน์ 100% ไม่ต้องล็อกอินผ่านเซิร์ฟเวอร์หลังบ้าน)

---

## ฟีเจอร์หลัก (Features)

- **Side Panel Interface**: แถบควบคุมด้านข้างของเบราว์เซอร์ ใช้งานง่าย เปิดหน้าเว็บไปพร้อมกับการตั้งค่าได้สะดวก
- **Offline & Local Storage**: เก็บข้อมูลการตั้งค่าแบบร่าง (Draft Settings) ลงใน `chrome.storage.local` ของเบราว์เซอร์โดยตรง ปลอดภัย ไม่ส่งข้อมูลส่วนตัวออกนอกเครื่อง
- **อัตโนมัติในการเลือกรอบและโซน**: รองรับการเลือกโซนเป้าหมายตามที่ระบุ
- **กลยุทธ์การเลือกที่นั่งอัจฉริยะ**: เลือกที่นั่งติดกัน, เลือกจากแถวหน้า (ซ้าย/ขวา), สุ่ม หรือเลือกตรงกลาง
- **ระบบกรอกข้อมูลอัตโนมัติ**: กรอกชื่อผู้ถือบัตร, เลขบัตรประชาชน/พาสปอร์ต, เบอร์โทรศัพท์ และเลือกวิธีรับบัตร/วิธีชำระเงินอัตโนมัติ
- **ระบบจำลองการกดเสมือนมนุษย์ (WAF Evasion)**: ยิงเหตุการณ์ `mousedown` -> `mouseup` -> `click` ตามพิกัดจริงเพื่อความปลอดภัย

---

## โครงสร้างโปรเจกต์ (Project Structure)

```
├── dist/                # ไฟล์บิลด์พร้อมโหลดเข้า Chrome (หลังรัน build)
├── public/              # โลโก้และ assets สถิต
├── src/
│   ├── background/      # Service Worker (จัดการ lifecycle และ badge สถานะ)
│   ├── content/         # Content scripts และ Automation Engine บนหน้าเว็บ TTM
│   ├── shared/          # คอนฟิกทั่วไปและ Local Storage wrapper
│   ├── sidepanel/       # React UI สำหรับ Side Panel
│   ├── types/           # TypeScript type definitions
│   └── manifest.ts      # กำหนดคอนฟิก Chrome Extension Manifest V3
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## การพัฒนาและติดตั้ง (Development & Build)

### 1. ติดตั้ง Dependencies
```bash
pnpm install
```

### 2. รันโหมด Development (Watch mode)
```bash
pnpm dev:build
```

### 3. บิลด์สำหรับใช้งานจริง (Production Build)
```bash
pnpm build
```

### 4. วิธีนำ Extension ไปใช้งานบน Chrome
1. เปิด Google Chrome แล้วไปที่ URL `chrome://extensions/`
2. เปิดสวิตช์ **Developer mode** (โหมดนักพัฒนา) ที่มุมขวาบน
3. คลิกปุ่ม **Load unpacked** (โหลดส่วนขยายที่ยังไม่ได้แพ็กเกจ)
4. เลือกโฟลเดอร์ `dist` ในโฟลเดอร์โปรเจกต์นี้
