import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * کد ملی هم باید قابل جستجو باشد هم رمزنگاری‌شده. این دو با هم جمع نمی‌شوند،
 * چون رمزنگاری امن غیرقطعی است و ایندکس روی آن بی‌فایده است.
 *
 * راه‌حل دو ستونه:
 *   driverNationalIdHash — HMAC-SHA256، قطعی و ایندکس‌دار → جستجوی سابقه
 *   driverNationalIdEnc  — AES-256-GCM، غیرقطعی → نمایش به اپراتور
 *
 * هش یکتا نیست: یک نفر می‌تواند چند رزرو داشته باشد.
 */

function key(name: "RAHVA_HMAC_KEY" | "RAHVA_ENC_KEY"): Buffer {
  const raw = process.env[name];
  if (!raw) throw new Error(`متغیر محیطی ${name} تنظیم نشده است`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error(`${name} باید ۳۲ بایت باشد (base64)`);
  return buf;
}

/** قطعی: یک ورودی همیشه یک خروجی می‌دهد، پس ایندکس رویش کار می‌کند. */
export function blindIndex(value: string): string {
  return createHmac("sha256", key("RAHVA_HMAC_KEY")).update(value).digest("hex");
}

/** خروجی: iv:tag:ciphertext با کدگذاری base64 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("RAHVA_ENC_KEY"), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(":");
}

export function decryptField(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("قالب داده رمزنگاری‌شده نامعتبر است");
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key("RAHVA_ENC_KEY"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** نمایش نقاب‌دار برای جاهایی که مقدار کامل لازم نیست */
export function maskNationalId(plain: string): string {
  return plain.length === 10 ? `${plain.slice(0, 3)}****${plain.slice(-3)}` : "••••";
}

export function maskIban(iban: string): string {
  return iban.length > 10 ? `${iban.slice(0, 4)} … ${iban.slice(-4)}` : iban;
}