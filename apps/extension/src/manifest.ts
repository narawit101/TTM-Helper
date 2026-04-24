import { defineManifest } from "@crxjs/vite-plugin";
import { APP_CONFIG } from "./shared/config";

export const manifest = defineManifest({
  manifest_version: 3,
  name: APP_CONFIG.extendtionName,
  version: APP_CONFIG.version,
  description: "ช่วยให้การจองตั๋วผ่านเว็บไซต์ ThaiTicketMajor สะดวกและรวดเร็วยิ่งขึ้น ด้วยฟีเจอร์ที่ออกแบบมาเพื่อเพิ่มประสิทธิภาพในการจองตั๋วของคุณ",
  permissions: ["storage", "tabs", "scripting", "activeTab", "sidePanel", "alarms"],
  host_permissions: ["https://booking.thaiticketmajor.com/*"],
  action: {
    default_title: "Ticket Helper",
    default_icon: {
      "16": "logo.png",
      "48": "logo.png",
      "128": "logo.png"
    }
  },
  icons: {
    "16": "logo.png",
    "48": "logo.png",
    "128": "logo.png"
  },
  side_panel: {
    default_path: "src/sidepanel/index.html"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://booking.thaiticketmajor.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ]
});
