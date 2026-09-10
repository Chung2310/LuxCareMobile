import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventorySupply } from "./types";
import { formatDateVN } from "../../features/credentials/DatePickerModal";

interface SupplyDetailModalProps {
  item: InventorySupply | null;
  visible: boolean;
  onClose: () => void;
  onStockIn: (item: InventorySupply) => void;
  onStockOut: (item: InventorySupply) => void;
  onEdit?: (item: InventorySupply) => void;
  onDelete?: (item: InventorySupply) => void;
}

export const SupplyDetailModal: React.FC<SupplyDetailModalProps> = ({
  item,
  visible,
  onClose,
  onStockIn,
  onStockOut,
  onEdit,
  onDelete,
}) => {
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <Text style={styles.codeText}>{item.code}</Text>
              <Text style={styles.titleText}>{item.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Box Tồn kho & Định mức */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Thông tin tồn kho</Text>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Số lượng tồn</Text>
                  <Text style={[styles.statBoxVal, { color: "#059669" }]}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Tồn tối thiểu</Text>
                  <Text style={[styles.statBoxVal, { color: "#d97706" }]}>
                    {item.minQuantity} {item.unit}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Đơn giá nhập</Text>
                  <Text style={styles.statBoxVal}>
                    {item.unitPrice ? item.unitPrice.toLocaleString("vi-VN") + " đ" : "--"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Thông tin Lô & Hạn sử dụng */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Số Lô & Hạn dùng y tế</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số lô sản xuất:</Text>
                <Text style={styles.infoValue}>{item.batchNumber || "Chưa cập nhật"}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hạn sử dụng:</Text>
                <Text style={[styles.infoValue, { color: "#e11d48", fontWeight: "700" }]}>
                  {formatDateVN(item.expiryDate) || "Không yêu cầu"}
                </Text>
              </View>

              {item.manufactureDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ngày sản xuất:</Text>
                  <Text style={styles.infoValue}>{formatDateVN(item.manufactureDate)}</Text>
                </View>
              )}
            </View>

            {/* Vị trí kho & Đối tác */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Vị trí lưu trữ & Cung ứng</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Kho lưu trữ:</Text>
                <Text style={styles.infoValue}>{item.warehouseName || item.warehouseLocation}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vị trí cụ thể:</Text>
                <Text style={styles.infoValue}>{item.warehouseLocation}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nhà cung cấp:</Text>
                <Text style={styles.infoValue}>{item.supplierName}</Text>
              </View>
            </View>

            {/* Giấy phép & Kiểm định */}
            {(item.inspectionCertificateNumber || item.inspectionDate) && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Kiểm định chất lượng</Text>

                {item.inspectionCertificateNumber && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số chứng nhận kiểm định:</Text>
                    <Text style={styles.infoValue}>{item.inspectionCertificateNumber}</Text>
                  </View>
                )}

                {item.inspectionDate && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Ngày kiểm định:</Text>
                    <Text style={styles.infoValue}>{formatDateVN(item.inspectionDate)}</Text>
                  </View>
                )}

                {item.nextInspectionDate && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Hạn kiểm định tiếp theo:</Text>
                    <Text style={styles.infoValue}>{formatDateVN(item.nextInspectionDate)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Ghi chú */}
            {item.notes && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Ghi chú bảo quản</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}

            {/* Tài liệu & Hình ảnh CO/CQ đính kèm */}
            {item.documents && item.documents.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  Tài liệu & Hình ảnh CO/CQ ({item.documents.length})
                </Text>
                <View style={styles.docsList}>
                  {item.documents.map((doc, idx) => {
                    const isImg =
                      doc.fileType?.includes("image") ||
                      /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(doc.name || "") ||
                      /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(doc.fileUrl || "");
                    return (
                      <View key={`${doc.fileUrl}-${idx}`} style={styles.docRow}>
                        {isImg ? (
                          <Image source={{ uri: doc.fileUrl }} style={styles.docThumbImage} />
                        ) : (
                          <View style={styles.docIconBox}>
                            <Ionicons
                              name={doc.fileType?.includes("pdf") ? "document-text" : "document"}
                              size={16}
                              color="#0284c7"
                            />
                          </View>
                        )}
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <Text style={styles.docSize}>
                            {isImg ? "Hình ảnh" : doc.fileType?.includes("pdf") ? "Tài liệu PDF" : "Tệp văn bản"}
                            {doc.fileSize ? ` • ${Math.round(doc.fileSize / 1024)} KB` : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.actionBtnIn}
              onPress={() => {
                onClose();
                onStockIn(item);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down-circle" size={18} color="#ffffff" />
              <Text style={styles.actionBtnText}>Nhập kho</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnOut}
              onPress={() => {
                onClose();
                onStockOut(item);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up-circle" size={18} color="#ffffff" />
              <Text style={styles.actionBtnText}>Xuất kho</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Actions: Sửa & Xóa */}
          <View style={styles.secondaryFooter}>
            <TouchableOpacity
              style={styles.actionBtnEdit}
              onPress={() => {
                onClose();
                onEdit?.(item);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color="#2563eb" />
              <Text style={styles.actionBtnEditText}>Chỉnh sửa thông tin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnDelete}
              onPress={() => {
                onClose();
                onDelete?.(item);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
              <Text style={styles.actionBtnDeleteText}>Ngừng sử dụng (Xóa)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: 18,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 10,
  },
  codeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 2,
  },
  titleText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
  },
  sectionCard: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  statBoxLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
  },
  statBoxVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    maxWidth: "60%",
    textAlign: "right",
  },
  notesText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  docsList: {
    gap: 8,
    marginTop: 8,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  docThumbImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
  },
  docIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  docSize: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionBtnIn: {
    flex: 1,
    height: 48,
    backgroundColor: "#059669",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnOut: {
    flex: 1,
    height: 48,
    backgroundColor: "#0284c7",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  actionBtnEdit: {
    flex: 1,
    height: 42,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnEditText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtnDelete: {
    flex: 1,
    height: 42,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnDeleteText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
});
