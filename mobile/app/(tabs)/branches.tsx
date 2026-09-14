import { BranchManagement } from "../../src/features/branches/BranchManagement";
import { useSession } from "../../src/auth/SessionProvider";

export default function BranchesScreen() {
  const { user } = useSession();
  return <BranchManagement key={`${user?.uid}:${user?.companyCode}`} />;
}
