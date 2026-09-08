import { Redirect } from "expo-router";
import { useSession } from "../src/auth/SessionProvider";
export default function Index() {
  return <Redirect href={useSession().user ? "/(tabs)" : "/login"} />;
}
