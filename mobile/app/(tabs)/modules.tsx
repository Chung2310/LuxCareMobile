import { router } from "expo-router";
import { Text } from "react-native";
import { useSession } from "../../src/auth/SessionProvider";
import { availableModules } from "../../src/features/navigation/modules";
import { Button, Card, Page, styles } from "../../src/ui";
export default function Modules() {
  const { user } = useSession();
  return (
    <Page title="Chức năng">
      {availableModules(user).map((item) => (
        <Card key={item.href}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.muted}>{item.description}</Text>
          <Button title={`Mở ${item.title.toLowerCase()}`} onPress={() => router.push(item.href)} />
        </Card>
      ))}
    </Page>
  );
}
