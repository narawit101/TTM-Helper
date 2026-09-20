import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#df1838",
          redDark: "#bf112d",
          rose: "#fff3f5",
          line: "#d7dbe2",
          text: "#333844",
          muted: "#9aa3b2",
          surface: "#ffffff"
        }
      },
      boxShadow: {
        panel: "0 18px 40px rgba(223, 24, 56, 0.16)"
      }
    }
  },
  plugins: []
} satisfies Config;
