import { isAdministrativeRole } from "../../../../src/utils/userRolePolicy";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { createRolePermissionService, type RolePermission } from "../../../../src/services/rolePermissionService";
import { api } from "../../api/services";
import { useSession } from "../../auth/SessionProvider";
import { canManageRoles, withDefaultRoles } from "./model";
const service = createRolePermissionService(api.transport);

export function useRoleOptions(visible: boolean, companyCode?: string) {
  const { user } = useSession();
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [error, setError] = useState("");
  const company = (companyCode || user?.companyCode || "").trim().toUpperCase();
  useFocusEffect(useCallback(() => {
    let active = true;
    setRoles([]); setError("");
    if (!visible || !company || !canManageRoles(user)) return;
    service.list(company).then(records => {
      if (active) setRoles(withDefaultRoles(records, company));
    }).catch(failure => {
      if (active) setError(failure instanceof Error ? failure.message : "Không thể tải danh sách vai trò.");
    });
    return () => { active = false; };
  }, [visible, company, user?.role]));
  const assignable = roles.filter(role => !isAdministrativeRole(role.role) &&
    (user?.role === "superadmin" || role.level > (user?.level || 2)));
  return { roles, assignable, error };
}
