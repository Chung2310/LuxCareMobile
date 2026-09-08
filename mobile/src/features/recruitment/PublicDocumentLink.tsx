import { useState } from "react";
import { Alert, Linking, Text } from "react-native";
import { Button, Card, ErrorText, styles } from "../../ui";
import { messageOf } from "../../auth/SessionProvider";
import { validatePublicLink } from "./publicLink";
export function PublicDocumentLink({ title, url }: { title: string; url?: string }) {
  const [error, setError] = useState<string | null>(null);
  if (!url) return null;
  return (
    <Card>
      <Text style={styles.heading}>{title}</Text>
      <Text selectable style={styles.muted}>
        {url}
      </Text>
      <ErrorText message={error} />
      <Button
        title="Mở tài liệu"
        onPress={() => {
          try {
            const target = validatePublicLink(url);
            setError(null);
            Alert.alert("Mở liên kết tài liệu?", new URL(target).hostname, [
              { text: "Hủy", style: "cancel" },
              { text: "Mở", onPress: () => void Linking.openURL(target).catch((error) => setError(messageOf(error))) },
            ]);
          } catch (error) {
            setError(messageOf(error));
          }
        }}
      />
    </Card>
  );
}
