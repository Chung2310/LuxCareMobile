export function profileName(name: string) {
  const value = name.trim();
  if (!value) throw new Error("Vui lòng nhập họ tên.");
  return value;
}
export function confirmedPassword(password: string, confirmation: string) {
  if (password.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
  if (password !== confirmation) throw new Error("Mật khẩu xác nhận không khớp.");
  return password;
}
