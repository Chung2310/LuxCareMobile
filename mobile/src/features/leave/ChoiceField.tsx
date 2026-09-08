import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, styles } from "../../ui";
export function ChoiceField<T extends string>({
  label,
  value,
  choices,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  choices: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.text}>{label}</Text>
      <Button
        title={choices.find((choice) => choice.value === value)?.label || "Chọn"}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.page}>
          <FlatList
            contentContainerStyle={styles.content}
            data={choices}
            keyExtractor={(item) => item.value}
            ListHeaderComponent={<Text style={styles.title}>{label}</Text>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: item.value === value }}
                style={styles.card}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                <Text style={styles.text}>
                  {item.value === value ? "● " : ""}
                  {item.label}
                </Text>
              </Pressable>
            )}
            ListFooterComponent={<Button title="Đóng" onPress={() => setOpen(false)} />}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
