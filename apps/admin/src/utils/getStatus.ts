export function getStatus(expiresAt: Date | string | null) {
  if (!expiresAt) return { label: "เปิดใช้งาน", color: "bg-green-100 text-green-700" };

  const now = new Date();
  const expiresAtDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;

  if (expiresAtDate > now) {
    return { label: "เปิดใช้งาน", color: "bg-green-100 text-green-700" };
  }
  return { label: "หมดอายุ", color: "bg-red-100 text-red-700" };
}