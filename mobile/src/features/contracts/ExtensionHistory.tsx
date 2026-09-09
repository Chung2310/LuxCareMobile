import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { Extension } from "../../../../src/types/hrContract";
import { getExtensionFiles, getExtensionSignedImages } from "../../../../src/services/hrContractFiles";
import { contracts } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { contractDate } from "./model";
import { ContractFiles } from "./ContractFiles";

export function ExtensionHistory({
  companyCode,
  branchId,
  contractId,
}: {
  companyCode: string;
  branchId?: string;
  contractId: string;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Extension[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRows([]);
      setLoading(true);
      setError(null);
      void contracts
        .extensions({ companyCode, branchId, contractId, page, limit: 10 })
        .then((result) => {
          if (active) {
            setRows(result.data);
            setTotalPages(result.pagination.totalPages);
          }
        })
        .catch((err) => {
          if (active) setError(messageOf(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [companyCode, branchId, contractId, page, revision]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionIcon}>📜</Text>
        <Text style={styles.sectionTitle}>Lịch sử gia hạn hợp đồng</Text>
        {rows.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{rows.length}</Text>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.loadingText}>Đang tải lịch sử gia hạn...</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRevision((v) => v + 1)}>
            <Text style={styles.retryBtnText}>Tải lại</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && !rows.length && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Hợp đồng này chưa có lần gia hạn nào.</Text>
        </View>
      )}

      <View style={styles.timeline}>
        {rows.map((item, idx) => (
          <View key={item._id} style={styles.timelineItem}>
            {/* Left timeline line & indicator */}
            <View style={styles.timelineLeftCol}>
              <View style={styles.timelineDot}>
                <Text style={styles.timelineDotNumber}>{idx + 1}</Text>
              </View>
              {idx < rows.length - 1 && <View style={styles.timelineLine} />}
            </View>

            {/* Right card content */}
            <View style={styles.timelineCard}>
              <View style={styles.timelineCardHeader}>
                <Text style={styles.extensionDateTitle}>
                  Gia hạn ngày {contractDate(item.extensionDate)}
                </Text>
              </View>

              <View style={styles.rangeBox}>
                <Text style={styles.rangeOld}>{contractDate(item.previousEndDate)}</Text>
                <Text style={styles.rangeArrow}>→</Text>
                <Text style={styles.rangeNew}>{contractDate(item.newEndDate)}</Text>
              </View>

              {!!item.reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Lý do:</Text>
                  <Text style={styles.reasonText}>{item.reason}</Text>
                </View>
              )}

              <ContractFiles title="Tệp gia hạn" files={getExtensionFiles(item)} />
              <ContractFiles title="Ảnh phụ lục đã ký" files={getExtensionSignedImages(item)} />
            </View>
          </View>
        ))}
      </View>

      {!loading && !error && totalPages > 1 && (
        <View style={styles.paginationRow}>
          <Pressable
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            disabled={page <= 1}
            onPress={() => setPage((v) => v - 1)}
          >
            <Text style={styles.pageBtnText}>‹ Trước</Text>
          </Pressable>

          <Text style={styles.pageText}>
            Trang {page} / {totalPages}
          </Text>

          <Pressable
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
            disabled={page >= totalPages}
            onPress={() => setPage((v) => v + 1)}
          >
            <Text style={styles.pageBtnText}>Tiếp ›</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  countBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    color: "#64748b",
  },
  emptyBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorText: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "500",
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#e11d48",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  timeline: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
  },
  timelineLeftCol: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotNumber: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#cbd5e1",
    marginVertical: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  timelineCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  extensionDateTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  rangeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rangeOld: {
    fontSize: 12,
    color: "#64748b",
    textDecorationLine: "line-through",
  },
  rangeArrow: {
    fontSize: 12,
    color: "#94a3b8",
  },
  rangeNew: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  reasonBox: {
    gap: 2,
  },
  reasonLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  reasonText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  pageText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
});
