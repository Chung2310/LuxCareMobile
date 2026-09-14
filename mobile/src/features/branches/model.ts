import type { UserProfile } from "../../../../src/types/common";
import type { BranchInput, BranchOwnerInput, BranchRecord, BranchAttendanceLocation } from "../../../../src/services/branchService";
import { hasPermission } from "../../auth/access";

export function canReadBranches(user: UserProfile | null) {
  return !!user?.companyCode && (["admin", "superadmin"].includes(user.role || "") || hasPermission(user, "user:read") || hasPermission(user, "hr:read"));
}
export function canCreateBranch(user: UserProfile | null) {
  return canReadBranches(user) && user?.role === "admin";
}
export function canEditBranch(user: UserProfile | null, branch: BranchRecord) {
  if (!canReadBranches(user) || branch.companyCode !== user?.companyCode) return false;
  return ["admin", "superadmin"].includes(user?.role || "") ||
    (user?.role === "branch_owner" && user.branchId === branch._id && hasPermission(user, "user:manage"));
}
export function generateBranchCode(companyCode: string, name: string) {
  const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "D").toUpperCase();
  const branch = clean(name.trim()).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!branch) return "";
  const company = clean(companyCode).replace(/[^A-Z0-9]/g, "");
  return (company ? `${company}_${branch}` : branch).slice(0, 32).replace(/_+$/, "");
}
export type LocationDraft = Omit<BranchAttendanceLocation, "latitude" | "longitude" | "allowedRadius" | "allowedPublicIps"> & {
  latitude: string; longitude: string; allowedRadius: string; allowedPublicIps: string;
};
export type BranchDraft = { code: string; name: string; address: string; phone: string; locations: LocationDraft[] };
export function branchDraft(branch?: BranchRecord): BranchDraft {
  const locations = branch?.attendanceLocations ?? (branch?.locationConfig ? [{ ...branch.locationConfig, id: "legacy", name: "Văn phòng chính", type: "office" as const, isActive: true }] : []);
  return { code: branch?.code || "", name: branch?.name || "", address: branch?.address || "", phone: branch?.phone || "",
    locations: locations.map(location => ({ ...location, latitude: String(location.latitude), longitude: String(location.longitude), allowedRadius: String(location.allowedRadius), allowedPublicIps: location.allowedPublicIps.join("\n") })) };
}
export function newLocation(id: string): LocationDraft {
  return { id, name: "", type: "office", isActive: true, latitude: "", longitude: "", allowedRadius: "100", allowedPublicIps: "" };
}
export function attendanceNetwork(value: string) {
  // Match LuxCare: IPv6 attendance uses the network /64, not a device's rotating address.
  const address = value.trim().toLowerCase();
  if (!address.includes(":")) return address;
  const bare = address.replace(/\/64$/, "");
  const sides = bare.split("::");
  if (sides.length > 2) return address;
  const left = sides[0] ? sides[0].split(":") : [], right = sides[1] ? sides[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sides.length === 1 && missing !== 0) || (sides.length === 2 && missing === 0)) return address;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return address;
  return groups.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(":") + "::/64";
}
function validNetwork(value: string) {
  if (value.includes(":")) {
    if (value.includes("/") && !value.endsWith("/64")) return false;
    try { return !!new URL(`http://[${value.replace(/\/64$/, "")}]`).hostname; } catch { return false; }
  }
  const parts = value.split(".");
  return parts.length === 4 && parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}
export function branchPayload(draft: BranchDraft, company: string): Required<Pick<BranchInput, "code" | "name">> & BranchInput {
  const name = draft.name.trim(), code = (draft.code.trim() || generateBranchCode(company, name)).toUpperCase();
  if (!name || name.length > 120) throw Error("Tên chi nhánh phải có từ 1 đến 120 ký tự.");
  if (!/^[A-Z0-9_-]{1,32}$/.test(code)) throw Error("Mã chi nhánh tối đa 32 ký tự, chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.");
  if (draft.address.trim().length > 255 || draft.phone.trim().length > 32) throw Error("Địa chỉ hoặc số điện thoại quá dài.");
  const attendanceLocations = draft.locations.map((location, index) => {
    const label = `Vị trí ${index + 1}`;
    const latitude = Number(location.latitude), longitude = Number(location.longitude), allowedRadius = Number(location.allowedRadius);
    if (!location.name.trim() || location.name.trim().length > 120) throw Error(`${label}: vui lòng nhập tên tối đa 120 ký tự.`);
    if (!location.latitude.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw Error(`${label}: vĩ độ không hợp lệ.`);
    if (!location.longitude.trim() || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw Error(`${label}: kinh độ không hợp lệ.`);
    if (!Number.isFinite(allowedRadius) || allowedRadius < 1) throw Error(`${label}: bán kính tối thiểu 1 mét.`);
    const allowedPublicIps = location.type === "office" ? [...new Set(location.allowedPublicIps.split(/[\n,]/).map(ip => ip.trim()).filter(Boolean))] : [];
    if (location.type === "office" && (!allowedPublicIps.length || allowedPublicIps.some(ip => !validNetwork(ip)))) throw Error(`${label}: nhập IP hợp lệ (IPv4, IPv6 hoặc mạng IPv6 /64).`);
    return { id: location.id, name: location.name.trim(), type: location.type, isActive: location.isActive, latitude, longitude, allowedRadius, allowedPublicIps };
  });
  return { code, name, address: draft.address.trim(), phone: draft.phone.trim(), attendanceLocations };
}
export function ownerPayload(draft: BranchOwnerInput): BranchOwnerInput {
  const displayName = draft.displayName.trim(), email = draft.email.trim();
  if (!displayName) throw Error("Vui lòng nhập họ tên Chủ chi nhánh.");
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) throw Error("Email Chủ chi nhánh không hợp lệ.");
  if (draft.password.length < 6) throw Error("Mật khẩu Chủ chi nhánh cần ít nhất 6 ký tự.");
  const phone = draft.phone?.trim();
  if (phone && !/^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/.test(phone)) throw Error("Số điện thoại Chủ chi nhánh không hợp lệ.");
  return { displayName, email, password: draft.password, phone: phone || undefined, birthDate: draft.birthDate || undefined, qualification: draft.qualification?.trim() || undefined };
}
