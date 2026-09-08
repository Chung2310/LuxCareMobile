import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { emptyPagination, type PaginationMeta } from "../../../src/types/pagination";
import {
  LEAVE_STATUS_LABELS,
  REQUEST_KIND_OPTIONS,
  type LeaveApplication,
  type LeaveTemplate,
  type RequestKind,
} from "../../../src/types/leave";
import { leave } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { LeaveForm } from "../../src/features/leave/LeaveForm";
import { LeaveTemplates } from "../../src/features/leave/LeaveTemplates";
import { shareLeaveFile } from "../../src/features/leave/files";
import { canDeleteLeave, filterLeavePage } from "../../src/features/leave/model";

export default function LeaveScreen() {
  const { user } = useSession();
  const allowed = canUseModule(user, "hr");
  const [items, setItems] = useState<LeaveApplication[]>([]);
  const [templates, setTemplates] = useState<LeaveTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<RequestKind | "">("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const modalLock = useRef(false);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<"create" | "templates" | null>(null);
  const [decision, setDecision] = useState<{ item: LeaveApplication; type: "approved" | "rejected" } | null>(null);
  const [approvalType, setApprovalType] = useState<"justified" | "unjustified">("justified");
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);
      setTemplateError(null);
      setItems([]);
      void leave
        .listApplications(page)
        .then((result) => {
          if (active) {
            setItems(result.data);
            setPagination(result.pagination);
          }
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      void leave
        .listTemplates()
        .then((data) => {
          if (active) setTemplates(data || []);
        })
        .catch((error) => {
          if (active) {
            setTemplates([]);
            setTemplateError(messageOf(error));
          }
        });
      return () => {
        active = false;
      };
    }, [allowed, page, revision, user?.uid]),
  );
  const reloadTemplates = async () => {
    setTemplates((await leave.listTemplates()) || []);
  };
  const refresh = () => {
    setPage(1);
    setRevision((value) => value + 1);
  };
  const run = async (action: () => Promise<void>, deciding = false) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setDecisionError(null);
    try {
      await action();
    } catch (error) {
      (deciding ? setDecisionError : setError)(messageOf(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  if (!allowed)
    return (
      <Page title="Đơn từ">
        <Text style={styles.text}>Phân hệ nhân sự chưa được kích hoạt cho tài khoản này.</Text>
      </Page>
    );
  return (
    <>
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.content}
        data={filterLeavePage(items, search, kind, status)}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => setRevision((v) => v + 1)}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={styles.title}>Đơn từ & phép</Text>
            <Button title="Nộp đơn" disabled={busy} onPress={() => setModal("create")} />
            <Button title="Biểu mẫu" disabled={busy} onPress={() => setModal("templates")} />
            <Field label="Tìm trong trang hiện tại" value={search} onChangeText={setSearch} />
            <ChoiceField
              label="Loại yêu cầu"
              value={kind}
              choices={[{ value: "", label: "Tất cả" }, ...REQUEST_KIND_OPTIONS]}
              onChange={setKind}
            />
            <ChoiceField
              label="Trạng thái trong trang"
              value={status}
              choices={[
                { value: "", label: "Tất cả" },
                ...Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
              onChange={setStatus}
            />
            <ErrorText message={error} />
            <ErrorText message={templateError} />
            {(error || templateError) && (
              <Button title="Thử lại" disabled={loading} onPress={() => setRevision((v) => v + 1)} />
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : !error ? (
            <Text style={styles.muted}>Không có đơn phù hợp trong trang này.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.heading}>{item.employeeName}</Text>
            <Text style={styles.text}>
              {item.type} · {LEAVE_STATUS_LABELS[item.status]}
            </Text>
            <Text style={styles.muted}>
              {new Date(item.startDate).toLocaleDateString("vi-VN")} –{" "}
              {new Date(item.endDate).toLocaleDateString("vi-VN")}
            </Text>
            <Text style={styles.text}>{item.reason}</Text>
            {item.chargeableDays !== undefined && (
              <Text style={styles.muted}>Số ngày tính phép: {item.chargeableDays}</Text>
            )}
            {!!item.rejectReason && <Text style={styles.error}>Lý do từ chối: {item.rejectReason}</Text>}
            {!!(item.approvalNote || item.note) && (
              <Text style={styles.text}>Phản hồi: {item.approvalNote || item.note}</Text>
            )}
            {(item.attachments?.length
              ? item.attachments
              : item.uploadedFileUrl
                ? [{ url: item.uploadedFileUrl, name: item.uploadedFileName || "Minh chứng" }]
                : []
            ).map((file, i) => (
              <Button
                key={`${file.url}-${i}`}
                title={`Tải / chia sẻ ${file.name}`}
                disabled={busy}
                onPress={() => void run(() => shareLeaveFile(file.url, file.name))}
              />
            ))}
            {item.status === "pending" && item.canDecide === true && (
              <>
                <Button
                  title="Duyệt"
                  disabled={busy}
                  onPress={() => {
                    setDecision({ item, type: "approved" });
                    setApprovalType("justified");
                    setNote("");
                    setDecisionError(null);
                  }}
                />
                <Button
                  title="Từ chối"
                  disabled={busy}
                  onPress={() => {
                    setDecision({ item, type: "rejected" });
                    setRejectReason("");
                    setNote("");
                    setDecisionError(null);
                  }}
                />
              </>
            )}
            {canDeleteLeave(item, user) && (
              <Button
                title="Xóa đơn"
                disabled={busy}
                onPress={() =>
                  Alert.alert("Xóa đơn đang chờ duyệt?", item.type, [
                    { text: "Hủy", style: "cancel" },
                    {
                      text: "Xóa",
                      style: "destructive",
                      onPress: () =>
                        void run(async () => {
                          await leave.remove(item._id);
                          refresh();
                        }),
                    },
                  ])
                }
              />
            )}
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.row}>
            <Button title="Trang trước" disabled={page <= 1 || busy || loading} onPress={() => setPage((v) => v - 1)} />
            <Text style={styles.muted}>
              {page}/{Math.max(1, pagination.totalPages)}
            </Text>
            <Button
              title="Trang sau"
              disabled={page >= pagination.totalPages || busy || loading}
              onPress={() => setPage((v) => v + 1)}
            />
          </View>
        }
      />
      <Modal
        visible={modal !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!modalLock.current) {
            setModal(null);
            refresh();
          }
        }}
      >
        <SafeAreaView style={styles.page}>
          {modal === "create" && (
            <LeaveForm
              templates={templates}
              setLocked={(value) => {
                modalLock.current = value;
              }}
              onClose={() => {
                setModal(null);
                refresh();
              }}
              onSubmitted={() => {
                setModal(null);
                refresh();
              }}
            />
          )}
          {modal === "templates" && (
            <LeaveTemplates
              templates={templates}
              canManage={hasPermission(user, "timekeeping:manage")}
              reload={reloadTemplates}
              setLocked={(value) => {
                modalLock.current = value;
              }}
              onClose={() => setModal(null)}
            />
          )}
        </SafeAreaView>
      </Modal>
      <Modal
        visible={decision !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) setDecision(null);
        }}
      >
        <SafeAreaView style={styles.page}>
          <Page title={decision?.type === "approved" ? "Duyệt đơn" : "Từ chối đơn"}>
            <Text style={styles.text}>
              {decision?.item.employeeName} · {decision?.item.type}
            </Text>
            {decision?.type === "approved" ? (
              <ChoiceField
                label="Hình thức duyệt"
                value={approvalType}
                choices={[
                  { value: "justified", label: "Có phép" },
                  { value: "unjustified", label: "Không phép" },
                ]}
                onChange={setApprovalType}
                disabled={busy}
              />
            ) : (
              <Field
                label="Lý do từ chối"
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                editable={!busy}
              />
            )}
            <Field label="Ghi chú" value={note} onChangeText={setNote} multiline editable={!busy} />
            <ErrorText message={decisionError} />
            <Button
              title={busy ? "Đang xử lý…" : "Xác nhận"}
              disabled={busy || (decision?.type === "rejected" && !rejectReason.trim())}
              onPress={() =>
                void run(async () => {
                  if (!decision) return;
                  await leave.decide(
                    decision.item._id,
                    decision.type === "approved"
                      ? { decision: "approved", approvalType, note: note.trim() }
                      : { decision: "rejected", rejectReason: rejectReason.trim(), note: note.trim() },
                  );
                  setDecision(null);
                  refresh();
                }, true)
              }
            />
            <Button title="Hủy" disabled={busy} onPress={() => setDecision(null)} />
          </Page>
        </SafeAreaView>
      </Modal>
    </>
  );
}
