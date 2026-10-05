import { needsOnboarding } from "../../shared/onboarding";
import { Redirect } from "expo-router";
import { useSession } from "../src/auth/SessionProvider";
export default function Index() {
  const { user } = useSession();
  return <Redirect href={user ? needsOnboarding(user) ? "/onboarding" : "/(tabs)" : "/login"} />;
}
