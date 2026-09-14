import type { BranchOwnerInput, BranchRecord, createBranchService } from "../../../../src/services/branchService";
import { branchPayload, ownerPayload, type BranchDraft } from "./model";

export async function completeBranchCreation(
  service: Pick<ReturnType<typeof createBranchService>, "create" | "createOwner">,
  draft: BranchDraft,
  owner: BranchOwnerInput,
  company: string,
  pending: BranchRecord | null,
  rememberPending: (branch: BranchRecord) => void,
) {
  const ownerInput = ownerPayload(owner);
  const branch = pending ?? await service.create(branchPayload(draft, company));
  if (!pending) rememberPending(branch);
  const result = await service.createOwner(branch._id, ownerInput);
  return result.branch;
}
