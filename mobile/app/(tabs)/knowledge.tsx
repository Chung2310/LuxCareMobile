import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { knowledge } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { useAppAlert } from "../../src/components/AppAlert";
import { hasPermission } from "../../src/auth/access";
import type { KnowledgeDocument } from "../../../src/services/assistantKnowledgeService";

export const DOC_TYPES: Array<{
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
    { id: "all", label: "Tất cả", color: "#475569", bgColor: "#f1f5f9", icon: "albums-outline" },
    { id: "medical", label: "Phác đồ & Y tế", color: "#e11d48", bgColor: "#fff1f2", icon: "medkit-outline" },
    { id: "guideline", label: "Quy chuẩn", color: "#7c3aed", bgColor: "#f5f3ff", icon: "shield-checkmark-outline" },
    { id: "policy", label: "Chính sách", color: "#4f46e5", bgColor: "#eef2ff", icon: "document-text-outline" },
    { id: "procedure", label: "Quy trình", color: "#0284c7", bgColor: "#f0f9ff", icon: "git-network-outline" },
    { id: "company_profile", label: "Hồ sơ viện", color: "#059669", bgColor: "#ecfdf5", icon: "business-outline" },
    { id: "faq", label: "Hỏi đáp", color: "#d97706", bgColor: "#fffbeb", icon: "help-circle-outline" },
  ];

export default function KnowledgeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { user } = useSession();
  const { showAlert, alertView } = useAppAlert();
  const isManager = ["admin", "superadmin", "branch_owner", "manager"].includes(user?.role || "");
  const canRead = isManager || hasPermission(user, "knowledge:read") || hasPermission(user, "knowledge:manage");
  const canManage = isManager || hasPermission(user, "knowledge:manage");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  // Detail Modal State
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"file" | "text">("file");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("medical");
  const [newCategory, setNewCategory] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // File Upload State
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const deleteLock = useRef(false);
  const loadSequence = useRef(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    const sequence = ++loadSequence.current;
    setError(null);
    try {
      const docs = await knowledge.listDocuments();
      if (sequence === loadSequence.current) setDocuments(docs);
    } catch (e: any) {
      setError(e.message || "Không thể tải danh sách kho tri thức.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canRead]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesType = selectedType === "all" || doc.documentType === selectedType;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.category || "").toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [documents, selectedType, searchQuery]);

  const stats = useMemo(() => {
    const total = documents.length;
    const medical = documents.filter((d) => d.documentType === "medical").length;
    const guidelines = documents.filter((d) => d.documentType === "guideline" || d.documentType === "procedure").length;
    const indexed = documents.filter((d) => d.indexingStatus === "indexed" || !d.indexingStatus).length;
    return { total, medical, guidelines, indexed };
  }, [documents]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "text/plain",
          "text/markdown",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const file = res.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024) {
        showAlert("Tệp quá lớn", "Dung lượng tệp tối đa được hỗ trợ là 10 MB.", undefined, "error");
        return;
      }
      setPickedFile({
        uri: file.uri,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
      });
    } catch (err: any) {
      showAlert("Lỗi chọn tệp", messageOf(err), undefined, "error");
    }
  };

  const handleUploadFile = async () => {
    if (!pickedFile) return;
    setUploading(true);
    try {
      await knowledge.uploadFile(
        {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType,
        },
        {
          documentType: newType,
          category: newCategory.trim() || undefined,
        },
      );
      setCreateModalOpen(false);
      setPickedFile(null);
      setNewCategory("");
      showAlert("Thành công", `Đã tải lên tệp “${pickedFile.name}” vào kho tri thức và nạp AI.`, undefined, "success");
      void loadData();
    } catch (e: any) {
      showAlert("Lỗi tải tệp", messageOf(e), undefined, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateText = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      return;
    }
    setCreating(true);
    try {
      await knowledge.createDocument({
        title: newTitle.trim(),
        text: newContent.trim(),
        documentType: newType,
        category: newCategory.trim() || undefined,
      });
      setCreateModalOpen(false);
      setNewTitle("");
      setNewCategory("");
      setNewContent("");
      showAlert("Thành công", `Đã lưu tài liệu “${newTitle.trim()}” vào kho tri thức.`, undefined, "success");
      void loadData();
    } catch (e: any) {
      showAlert("Lỗi tạo tài liệu", messageOf(e), undefined, "error");
    } finally {
      setCreating(false);
    }
  };

  const executeDelete = async (docId: string, title: string) => {
    if (!canManage || deleteLock.current) return;
    deleteLock.current = true;
    setDeletingId(docId);
    try {
      await knowledge.deleteDocument(docId);
      ++loadSequence.current;
      setDocuments(current => current.filter(doc => doc._id !== docId));
      if (selectedDoc?._id === docId) {
        setSelectedDoc(null);
      }
      showAlert(
        "Đã xóa tài liệu",
        `Đã xóa tài liệu “${title}” khỏi kho tri thức thành công.`,
        undefined,
        "success",
      );
      void loadData();
    } catch (err: any) {
      showAlert("Lỗi xóa tài liệu", messageOf(err), undefined, "error");
    } finally {
      deleteLock.current = false;
      setDeletingId(null);
    }
  };

  const handleConfirmDelete = (doc: KnowledgeDocument) => {
    if (!canManage || deleteLock.current) return;
    showAlert(
      "Xác nhận xóa tài liệu",
      `Bạn có chắc chắn muốn xóa tài liệu “${doc.title}” khỏi kho tri thức? Hệ thống sẽ gỡ tài liệu này và AI sẽ không còn sử dụng để tra cứu.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa tài liệu",
          style: "destructive",
          onPress: () => void executeDelete(doc._id, doc.title),
        },
      ],
      "error",
    );
  };

  const getDocTypeConfig = (type?: string) => {
    return DOC_TYPES.find((t) => t.id === type) || DOC_TYPES[1];
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (params.from === "modules") router.replace("/(tabs)/modules");
            else if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/modules");
          }}
          style={styles.backBtn}
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Kho tri thức</Text>
          <Text style={styles.headerSubtitle}>Tài liệu chuyên môn & quy chuẩn y tế</Text>
        </View>
        {canManage && (
          <Pressable
            onPress={() => setCreateModalOpen(true)}
            style={styles.addBtn}
            accessibilityLabel="Thêm tài liệu"
          >
            <Ionicons name="add" size={20} color="#ffffff" />
          </Pressable>
        )}
      </View>

      {!canRead ? (
        <View style={styles.unauthorizedWrap}>
          <Ionicons name="lock-closed-outline" size={48} color="#94a3b8" />
          <Text style={styles.unauthorizedTitle}>Chưa được phân quyền</Text>
          <Text style={styles.unauthorizedDesc}>
            Bạn cần quyền đọc kho tri thức (knowledge:read) để truy cập danh mục này.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7c3aed"]} />}
        >
          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm phác đồ, quy trình, tài liệu..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          {/* Stats Banner */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="library" size={18} color="#7c3aed" />
              </View>
              <Text style={[styles.statNumber, { color: "#6d28d9" }]}>{stats.total}</Text>
              <Text style={styles.statLabel}>Tổng tài liệu</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: "#fff1f2", borderColor: "#fecdd3" }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="medkit" size={18} color="#e11d48" />
              </View>
              <Text style={[styles.statNumber, { color: "#be123c" }]}>{stats.medical}</Text>
              <Text style={styles.statLabel}>Phác đồ y tế</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="shield-checkmark" size={18} color="#0284c7" />
              </View>
              <Text style={[styles.statNumber, { color: "#0369a1" }]}>{stats.guidelines}</Text>
              <Text style={styles.statLabel}>Quy chuẩn / SOP</Text>
            </View>
          </View>

          {/* Type Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterPills}
          >
            {DOC_TYPES.map((t) => {
              const isSelected = selectedType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSelectedType(t.id)}
                  style={[
                    styles.filterPill,
                    isSelected
                      ? { backgroundColor: t.id === "all" ? "#0f172a" : t.color, borderColor: "transparent" }
                      : { backgroundColor: "#ffffff", borderColor: "#e2e8f0" },
                  ]}
                >
                  <Ionicons
                    name={t.icon}
                    size={14}
                    color={isSelected ? "#ffffff" : t.color}
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected ? { color: "#ffffff", fontWeight: "700" } : { color: "#475569" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Document List */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={styles.loadingText}>Đang tải kho tri thức...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color="#e11d48" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : filteredDocs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Không có tài liệu nào</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "Không tìm thấy tài liệu phù hợp với từ khóa tìm kiếm."
                  : "Chưa có tài liệu nào trong danh mục này."}
              </Text>
            </View>
          ) : (
            <View style={styles.docList}>
              {filteredDocs.map((doc) => {
                const typeCfg = getDocTypeConfig(doc.documentType);
                const isIndexed = doc.indexingStatus === "indexed" || !doc.indexingStatus;
                return (
                  <Pressable
                    key={doc._id}
                    onPress={() => setSelectedDoc(doc)}
                    style={styles.docCard}
                  >
                    <View style={styles.docCardHeader}>
                      <View style={[styles.docTypeBadge, { backgroundColor: typeCfg.bgColor, borderColor: typeCfg.color + "33" }]}>
                        <Ionicons name={typeCfg.icon} size={12} color={typeCfg.color} />
                        <Text style={[styles.docTypeBadgeText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                      </View>

                      <View style={styles.docCardHeaderRight}>
                        <View
                          style={[
                            styles.indexBadge,
                            isIndexed ? styles.indexBadgeSuccess : styles.indexBadgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.indexBadgeText,
                              isIndexed ? styles.indexBadgeTextSuccess : styles.indexBadgeTextPending,
                            ]}
                          >
                            {isIndexed ? "ĐÃ ĐỒNG BỘ AI" : "ĐANG XỬ LÝ"}
                          </Text>
                        </View>

                        {canManage && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleConfirmDelete(doc);
                            }}
                            disabled={deletingId !== null}
                            style={styles.cardDeleteBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Xóa tài liệu ${doc.title}`}
                            hitSlop={8}
                          >
                            {deletingId === doc._id ? (
                              <ActivityIndicator size="small" color="#e11d48" />
                            ) : (
                              <>
                                <Ionicons name="trash-outline" size={15} color="#e11d48" />
                                <Text style={{ color: "#e11d48", fontSize: 12, fontWeight: "600" }}>Xóa</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>

                    <Text style={styles.docTitle} numberOfLines={2}>
                      {doc.title}
                    </Text>

                    <View style={styles.docFooter}>
                      <View style={styles.docMetaLeft}>
                        {doc.category ? (
                          <View style={styles.categoryPill}>
                            <Ionicons name="pricetag-outline" size={11} color="#64748b" />
                            <Text style={styles.categoryPillText} numberOfLines={1}>{doc.category}</Text>
                          </View>
                        ) : null}
                        {doc.chunksCount ? (
                          <Text style={styles.docChunkText}>
                            <Ionicons name="layers-outline" size={11} color="#64748b" /> {doc.chunksCount} đoạn
                          </Text>
                        ) : null}
                      </View>

                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Document Detail Modal */}
      <Modal visible={!!selectedDoc} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết tài liệu tri thức</Text>
              <Pressable onPress={() => setSelectedDoc(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            {selectedDoc && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.detailHeaderBox}>
                  <View style={[styles.docTypeBadge, { backgroundColor: getDocTypeConfig(selectedDoc.documentType).bgColor }]}>
                    <Ionicons name={getDocTypeConfig(selectedDoc.documentType).icon} size={12} color={getDocTypeConfig(selectedDoc.documentType).color} />
                    <Text style={[styles.docTypeBadgeText, { color: getDocTypeConfig(selectedDoc.documentType).color }]}>
                      {getDocTypeConfig(selectedDoc.documentType).label}
                    </Text>
                  </View>
                  <Text style={styles.detailTitle}>{selectedDoc.title}</Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Chuyên mục / Khoa:</Text>
                    <Text style={styles.detailValue}>{selectedDoc.category || "Tổng quát"}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phạm vi áp dụng:</Text>
                    <Text style={styles.detailValue}>
                      {selectedDoc.visibility === "restricted" ? "Giới hạn chi nhánh/phòng" : "Toàn viện"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Trạng thái AI:</Text>
                    <Text style={[styles.detailValue, { color: "#16a34a", fontWeight: "700" }]}>
                      {selectedDoc.indexingStatus === "indexed" || !selectedDoc.indexingStatus ? "Đã số hóa & Tìm kiếm AI" : "Đang xử lý"}
                    </Text>
                  </View>

                  {selectedDoc.chunksCount ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Số đoạn dữ liệu (Chunks):</Text>
                      <Text style={styles.detailValue}>{selectedDoc.chunksCount} đoạn phân tích</Text>
                    </View>
                  ) : null}

                  {selectedDoc.createdAt ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Thời gian cập nhật:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedDoc.createdAt).toLocaleDateString("vi-VN")}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.tipBox}>
                  <Ionicons name="sparkles" size={16} color="#7c3aed" />
                  <Text style={styles.tipText}>
                    Tài liệu này đã được nạp vào mạng nơ-ron tri thức LuxCare Assistant. Nhân viên y tế có thể tra cứu nhanh qua trợ lý ảo hoặc hệ thống tìm kiếm nội bộ.
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              {canManage && selectedDoc && (
                <Pressable
                  onPress={() => handleConfirmDelete(selectedDoc)}
                  disabled={deletingId !== null}
                  style={styles.modalDeleteBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa tài liệu"
                >
                  {deletingId === selectedDoc._id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      <Text style={styles.modalDeleteBtnText}>Xóa tài liệu</Text>
                    </>
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={() => setSelectedDoc(null)}
                style={styles.modalSecondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng chi tiết"
              >
                <Text style={styles.modalSecondaryBtnText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create / Upload Document Modal */}
      <Modal visible={createModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: "92%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm tài liệu vào kho tri thức</Text>
              <Pressable
                onPress={() => {
                  setCreateModalOpen(false);
                  setPickedFile(null);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            {/* Mode Switcher: Tải tệp lên vs Nhập văn bản */}
            <View style={styles.modalSubTabBar}>
              <Pressable
                onPress={() => setCreateTab("file")}
                style={[styles.modalSubTabItem, createTab === "file" && styles.modalSubTabItemActive]}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={16}
                  color={createTab === "file" ? "#7c3aed" : "#64748b"}
                />
                <Text style={[styles.modalSubTabText, createTab === "file" && styles.modalSubTabTextActive]}>
                  Tải tệp tài liệu
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCreateTab("text")}
                style={[styles.modalSubTabItem, createTab === "text" && styles.modalSubTabItemActive]}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={createTab === "text" ? "#7c3aed" : "#64748b"}
                />
                <Text style={[styles.modalSubTabText, createTab === "text" && styles.modalSubTabTextActive]}>
                  Nhập văn bản
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              {createTab === "file" ? (
                /* Tab 1: Upload File */
                <View style={{ gap: 12 }}>
                  <Text style={styles.inputLabel}>Tệp tài liệu đính kèm *</Text>

                  {!pickedFile ? (
                    <Pressable onPress={handlePickFile} style={styles.dropzoneBox}>
                      <View style={styles.dropzoneIconWrap}>
                        <Ionicons name="cloud-upload" size={32} color="#7c3aed" />
                      </View>
                      <Text style={styles.dropzoneTitle}>Chạm để chọn tệp từ thiết bị</Text>
                      <Text style={styles.dropzoneSubtitle}>
                        Hỗ trợ PDF, Word (.docx), Excel (.xlsx), TXT (tối đa 10 MB)
                      </Text>
                      <View style={styles.browseButton}>
                        <Ionicons name="folder-open-outline" size={14} color="#7c3aed" />
                        <Text style={styles.browseButtonText}>Duyệt tệp tin</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={styles.pickedFileCard}>
                      <View style={styles.pickedFileIconWrap}>
                        <Ionicons name="document-text" size={26} color="#7c3aed" />
                      </View>
                      <View style={styles.pickedFileInfo}>
                        <Text style={styles.pickedFileName} numberOfLines={1}>
                          {pickedFile.name}
                        </Text>
                        <Text style={styles.pickedFileSize}>
                          {formatFileSize(pickedFile.size)} • Sẵn sàng tải lên
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setPickedFile(null)}
                        style={styles.removeFileBtn}
                        accessibilityLabel="Xóa tệp đã chọn"
                      >
                        <Ionicons name="trash-outline" size={18} color="#e11d48" />
                      </Pressable>
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Phân loại tài liệu *</Text>
                  <View style={styles.typeSelectorRow}>
                    {DOC_TYPES.filter((t) => t.id !== "all").map((t) => {
                      const isSel = newType === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => setNewType(t.id)}
                          style={[
                            styles.typeSelectChip,
                            isSel
                              ? { backgroundColor: t.color, borderColor: t.color }
                              : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeSelectChipText,
                              isSel ? { color: "#ffffff", fontWeight: "700" } : { color: "#64748b" },
                            ]}
                          >
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.inputLabel}>Chuyên khoa / Danh mục</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Khoa Cấp cứu, Khoa Nhi, Tiêu chuẩn chất lượng..."
                    placeholderTextColor="#94a3b8"
                    value={newCategory}
                    onChangeText={setNewCategory}
                  />

                  <View style={styles.tipBox}>
                    <Ionicons name="sparkles-outline" size={16} color="#7c3aed" />
                    <Text style={styles.tipText}>
                      Hệ thống sẽ tự động bóc tách nội dung, phân tích văn bản và nạp vào cơ sở tri thức LuxCare Assistant.
                    </Text>
                  </View>
                </View>
              ) : (
                /* Tab 2: Manual Text Input */
                <View style={{ gap: 12 }}>
                  <Text style={styles.inputLabel}>Tiêu đề tài liệu / Phác đồ *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Phác đồ xử trí phản vệ cấp cứu 2026"
                    placeholderTextColor="#94a3b8"
                    value={newTitle}
                    onChangeText={setNewTitle}
                  />

                  <Text style={styles.inputLabel}>Phân loại tài liệu *</Text>
                  <View style={styles.typeSelectorRow}>
                    {DOC_TYPES.filter((t) => t.id !== "all").map((t) => {
                      const isSel = newType === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => setNewType(t.id)}
                          style={[
                            styles.typeSelectChip,
                            isSel
                              ? { backgroundColor: t.color, borderColor: t.color }
                              : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeSelectChipText,
                              isSel ? { color: "#ffffff", fontWeight: "700" } : { color: "#64748b" },
                            ]}
                          >
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.inputLabel}>Chuyên khoa / Danh mục</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Khoa Cấp cứu, Khoa Nhi, Tiêu chuẩn chất lượng..."
                    placeholderTextColor="#94a3b8"
                    value={newCategory}
                    onChangeText={setNewCategory}
                  />

                  <Text style={styles.inputLabel}>Nội dung văn bản / Hướng dẫn *</Text>
                  <TextInput
                    style={[styles.textInput, { height: 140, textAlignVertical: "top" }]}
                    placeholder="Nhập nội dung phác đồ, quy chuẩn hoặc hướng dẫn chuyên môn..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    value={newContent}
                    onChangeText={setNewContent}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {createTab === "file" ? (
                <Pressable
                  onPress={handleUploadFile}
                  disabled={uploading || !pickedFile}
                  style={[
                    styles.modalPrimaryBtn,
                    (!pickedFile || uploading) && { backgroundColor: "#94a3b8" },
                  ]}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Tải lên & Nạp vào AI</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleCreateText}
                  disabled={creating || !newTitle.trim() || !newContent.trim()}
                  style={[
                    styles.modalPrimaryBtn,
                    (!newTitle.trim() || !newContent.trim() || creating) && { backgroundColor: "#94a3b8" },
                  ]}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Lưu vào kho tri thức</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
      {alertView}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  addBtn: {
    backgroundColor: "#7c3aed",
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    padding: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statIconWrap: {
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  filterScrollView: {
    marginBottom: 14,
  },
  filterPills: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  docList: {
    gap: 10,
  },
  docCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  docCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  docTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  docTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  indexBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  indexBadgeSuccess: {
    backgroundColor: "#dcfce7",
  },
  indexBadgePending: {
    backgroundColor: "#fef3c7",
  },
  indexBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  indexBadgeTextSuccess: {
    color: "#16a34a",
  },
  indexBadgeTextPending: {
    color: "#d97706",
  },
  docTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 20,
    marginBottom: 8,
  },
  docFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    marginTop: 2,
  },
  docMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: "60%",
  },
  categoryPillText: {
    fontSize: 11,
    color: "#475569",
  },
  docChunkText: {
    fontSize: 11,
    color: "#64748b",
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  errorBox: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#e11d48",
    textAlign: "center",
  },
  emptyWrap: {
    alignItems: "center",
    padding: 36,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
  unauthorizedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  unauthorizedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  unauthorizedDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubTabBar: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalSubTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSubTabItemActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modalSubTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  modalSubTabTextActive: {
    color: "#7c3aed",
    fontWeight: "700",
  },
  modalContent: {
    padding: 16,
  },
  dropzoneBox: {
    borderWidth: 2,
    borderColor: "#ddd6fe",
    borderStyle: "dashed",
    borderRadius: 14,
    backgroundColor: "#faf5ff",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dropzoneIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dropzoneTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  dropzoneSubtitle: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede9fe",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 6,
  },
  browseButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
  },
  pickedFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  pickedFileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  pickedFileInfo: {
    flex: 1,
  },
  pickedFileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  pickedFileSize: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  removeFileBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fff1f2",
  },
  detailHeaderBox: {
    marginBottom: 14,
    gap: 6,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
  },
  detailSection: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#faf5ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 10,
    padding: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: "#6b21a8",
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalPrimaryBtn: {
    flex: 1,
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  modalDeleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  modalDeleteBtnText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
  docCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardDeleteBtn: {
    flexDirection: "row",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#ffe4e6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  typeSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  typeSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeSelectChipText: {
    fontSize: 11,
  },
});
