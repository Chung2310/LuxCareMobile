import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ServiceItem } from "./types";

interface EditPinnedModalProps {
  visible: boolean;
  onClose: () => void;
  allServices: ServiceItem[];
  pinnedIds: string[];
  onTogglePin: (id: string) => void;
}

export const EditPinnedModal: React.FC<EditPinnedModalProps> = ({
  visible,
  onClose,
  allServices,
  pinnedIds,
  onTogglePin,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Tùy chỉnh Dịch vụ ghim</Text>
              <Text style={styles.modalSubtitle}>
                Chọn tối đa 8 dịch vụ bạn thường xuyên sử dụng ({pinnedIds.length}/8)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {allServices.map((item) => {
              const isPinned = pinnedIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={`modal-item-${item.id}`}
                  style={[styles.modalItemRow, isPinned && styles.modalItemRowSelected]}
                  onPress={() => onTogglePin(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modalIconBox, { backgroundColor: item.bgColor }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>

                  <Text style={styles.modalItemName}>
                    {item.title.replace("\n", " ")}
                  </Text>

                  <View
                    style={[
                      styles.checkCircle,
                      isPinned && styles.checkCircleActive,
                    ]}
                  >
                    {isPinned && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.modalConfirmBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.modalConfirmText}>Hoàn tất</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 380,
  },
  modalItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  modalItemRowSelected: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  modalConfirmBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  modalConfirmText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
