import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "راهــوا — اجاره خودرو",
  description: "رزرو آنلاین خودرو در تهران",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
