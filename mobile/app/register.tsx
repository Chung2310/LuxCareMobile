import { Redirect } from "expo-router";

// Old deep links return to login; administrators provision employee accounts.
export default function Register() {
  return <Redirect href="/login" />;
}
