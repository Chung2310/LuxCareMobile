import type { UserProfile } from "../../../../src/types/common";
export function recruitmentPeople(rows: UserProfile[], company: string, branch: string) {
  if (!company || !branch) return [];
  return rows
    .filter(
      (row) =>
        row.companyCode === company &&
        row.branchId === branch &&
        (row as UserProfile & { isActive?: boolean }).isActive === true,
    )
    .map((row) => ({ value: row.uid, label: [row.displayName, row.email].filter(Boolean).join(" · ") || row.uid }));
}
export function interviewerPatch(original: string[], selected: string[]) {
  const ids = [...new Set(selected)];
  return ids.length === original.length && ids.every((id) => original.includes(id)) ? {} : { interviewerIds: ids };
}
export function recruiterPatch(original: string | null | undefined, selected: string[]) {
  const recruiterId = selected[0] || null;
  return (original || null) === recruiterId ? {} : { recruiterId };
}
