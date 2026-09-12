import { useAppAlert } from "../../components/AppAlert";
import { Linking, Text } from "react-native";
import { Button, Card, styles } from "../../ui";
import { messageOf } from "../../auth/SessionProvider";
import { validatePublicLink } from "./publicLink";
export function PublicDocumentLink({ title, url }: { title: string; url?: string }) {
  const { showAlert, alertView } = useAppAlert();
  if (!url) return null;
  return (
    <Card>
      <Text style={styles.heading}>{title}</Text>
      <Text selectable style={styles.muted}>
        {url}
      </Text>
      <Button
        title="Mở tài liệu"
        onPress={() => {
          try {
            const target = validatePublicLink(url);
            showAlert("Mở liên kết tài liệu?", new URL(target).hostname, [
              { text: "Hủy", style: "cancel" },
              {
                text: "Mở",
                onPress: () =>
                  void Linking.openURL(target).catch((error) =>
                    showAlert("Không thể mở liên kết", messageOf(error), undefined, "error"),
                  ),
              },
            ]);
          } catch (error) {
            showAlert("Liên kết không hợp lệ", messageOf(error), undefined, "error");
          }
        }}
      />
      {alertView}
    </Card>
  );
}
