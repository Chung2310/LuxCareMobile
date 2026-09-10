import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type {
  LeaveApplicationInput,
  LeaveBalance,
  LeaveTemplate,
  RequestKind,
} from "../../../../src/types/leave";
import { REQUEST_KIND_OPTIONS } from "../../../../src/types/leave";
import { leave } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { pickLeaveAttachment } from "./files";
import { leaveDateRange, localDay } from "./model";

interface LeaveFormProps {
  templates: LeaveTemplate[];
  onClose: () => void;
  onSubmitted: () => void;
  setLocked: (locked: boolean) => void;
}

const REQUEST_KIND_CONFIGS: Record<
  RequestKind,
  {
    title: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
    border: string;
  }
> = {
  leave: {
    title: "Nghỉ phép",
    sub: "Phép năm, ốm đau, việc riêng",
    icon: "calendar-outline",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  wfh: {
    title: "Làm tại nhà (WFH)",
    sub: "Làm việc từ xa linh hoạt",
    icon: "home-outline",
    color: "#4f46e5",
    bg: "#eef2ff",
    border: "#c7d2fe",
  },
  exception: {
    title: "Ngoại lệ / Giải trình",
    sub: "Quên chấm công, đi muộn, về sớm",
    icon: "time-outline",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  event: {
    title: "Sự kiện / Công tác",
    sub: "Công tác, hội thảo, đào tạo ngoài",
    icon: "briefcase-outline",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
};

function formatViDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return dateStr;
  const days = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  return `${days[date.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function calculateDays(start: string, end: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localDay(d);
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeaveForm({
  templates,
  onClose,
  onSubmitted,
  setLocked,
}: LeaveFormProps) {
  const { user } = useSession();
  const [templateId, setTemplateId] = useState("");
  const [kind, setKind] = useState<RequestKind>("leave");
  const [type, setType] = useState("");
  const [start, setStart] = useState(localDay());
  const [end, setEnd] = useState(localDay());
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<LeaveApplicationInput["attachments"]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);

  // Calendar Modal Picker State
  const [calendarTarget, setCalendarTarget] = useState<"start" | "end" | null>(null);
  const [calMonth, setCalMonth] = useState<Date>(new Date());

  const selectedTemplate = templates.find((item) => item._id === templateId);
  const requestKind = selectedTemplate?.requestKind || kind;
  const year = Number(start.slice(0, 4));

  const totalDays = useMemo(() => calculateDays(start, end), [start, end]);

  useEffect(() => {
    let active = true;
    setBalance(null);
    setBalanceError(null);
    if (!user || requestKind !== "leave" || !Number.isInteger(year) || year < 2000 || year > 2200) return;
    void leave
      .balance(user.uid, year)
      .then((data) => {
        if (active) setBalance(data);
      })
      .catch((err) => {
        if (active) setBalanceError(messageOf(err));
      });
    return () => {
      active = false;
    };
  }, [user?.uid, year, requestKind]);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const submit = () =>
    run(async () => {
      const dates = leaveDateRange(start, end);
      if (!reason.trim()) throw new Error("Vui lòng nhập lý do nộp đơn.");
      try {
        await leave.create({
          ...dates,
          ...(selectedTemplate ? { templateId: selectedTemplate._id } : {}),
          type:
            selectedTemplate?.name ||
            type.trim() ||
            REQUEST_KIND_OPTIONS.find((item) => item.value === requestKind)!.label,
          requestKind,
          reason: reason.trim(),
          attachments,
        });
      } catch (err) {
        if (!(err && typeof err === "object" && "status" in err) || Number(err.status) >= 500) {
          setUncertain(true);
          throw new Error(
            "Chưa xác nhận được kết quả gửi đơn. Hãy quay lại và tải lại danh sách trước khi nộp một đơn mới.",
          );
        }
        throw err;
      }
      onSubmitted();
    });

  const applyPreset = (preset: "today" | "tomorrow" | "3days" | "nextweek") => {
    const today = new Date();
    if (preset === "today") {
      const d = localDay(today);
      setStart(d);
      setEnd(d);
    } else if (preset === "tomorrow") {
      const d = addDays(today, 1);
      setStart(d);
      setEnd(d);
    } else if (preset === "3days") {
      setStart(localDay(today));
      setEnd(addDays(today, 2));
    } else if (preset === "nextweek") {
      const dayOfWeek = today.getDay();
      const daysUntilNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const mon = addDays(today, daysUntilNextMon);
      const fri = addDays(today, daysUntilNextMon + 4);
      setStart(mon);
      setEnd(fri);
    }
  };

  const openCalendar = (target: "start" | "end") => {
    const currentVal = target === "start" ? start : end;
    if (/^\d{4}-\d{2}-\d{2}$/.test(currentVal)) {
      const [y, m] = currentVal.split("-").map(Number);
      setCalMonth(new Date(y, m - 1, 1));
    } else {
      setCalMonth(new Date());
    }
    setCalendarTarget(target);
  };

  const selectCalDay = (dayStr: string) => {
    if (calendarTarget === "start") {
      setStart(dayStr);
      if (end < dayStr) setEnd(dayStr);
    } else if (calendarTarget === "end") {
      if (dayStr < start) {
        setStart(dayStr);
      }
      setEnd(dayStr);
    }
    setCalendarTarget(null);
  };

  // Calendar Grid builder
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1; // Mon = 0
    if (startDayOfWeek < 0) startDayOfWeek = 6; // Sun = 6

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      cells.push({ dateStr: localDay(prevDate), dayNum: d, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const curDate = new Date(year, month, d);
      cells.push({ dateStr: localDay(curDate), dayNum: d, isCurrentMonth: true });
    }

    // Next month padding to fill rows of 7
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextDate = new Date(year, month + 1, d);
        cells.push({ dateStr: localDay(nextDate), dayNum: d, isCurrentMonth: false });
      }
    }

    return cells;
  }, [calMonth]);

  const initials = (user?.displayName || "NV")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 1. Modal Top Bar */}
      <View style={s.topBar}>
        <View style={s.dragHandle} />
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Nộp đơn từ mới</Text>
            <Text style={s.headerSubtitle}>Tạo và gửi yêu cầu phê duyệt nhanh</Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.closeCircle, pressed && s.pressedCircle]}
            onPress={onClose}
            disabled={busy}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Submitter Info Card */}
        <View style={s.submitterCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.submitterName}>{user?.displayName || "Nhân viên"}</Text>
            <Text style={s.submitterRole}>Đơn cá nhân · Tự động gửi tới quản lý phụ trách</Text>
          </View>
          <View style={s.liveStatusBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={s.liveStatusText}>Chính chủ</Text>
          </View>
        </View>

        {/* 3. Request Kind Selector */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>1. Loại yêu cầu</Text>
            <Text style={s.sectionHint}>Chọn mục đích đơn</Text>
          </View>

          <View style={s.kindGrid}>
            {(Object.keys(REQUEST_KIND_CONFIGS) as RequestKind[]).map((k) => {
              const cfg = REQUEST_KIND_CONFIGS[k];
              const isSelected = requestKind === k;
              return (
                <Pressable
                  key={k}
                  style={({ pressed }) => [
                    s.kindCard,
                    isSelected && {
                      backgroundColor: cfg.bg,
                      borderColor: cfg.color,
                      borderWidth: 2,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    if (selectedTemplate) setTemplateId("");
                    setKind(k);
                  }}
                  disabled={busy || uncertain}
                >
                  <View style={[s.kindIconBox, { backgroundColor: isSelected ? cfg.color : "#f1f5f9" }]}>
                    <Ionicons
                      name={cfg.icon}
                      size={20}
                      color={isSelected ? "#ffffff" : "#64748b"}
                    />
                  </View>
                  <Text
                    style={[
                      s.kindTitle,
                      isSelected && { color: cfg.color, fontWeight: "700" },
                    ]}
                    numberOfLines={1}
                  >
                    {cfg.title}
                  </Text>
                  <Text style={s.kindSub} numberOfLines={2}>
                    {cfg.sub}
                  </Text>
                  {isSelected && (
                    <View style={[s.kindCheckBadge, { backgroundColor: cfg.color }]}>
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Templates Selector (If templates exist) */}
        {templates.length > 0 && (
          <View style={s.section}>
            <Text style={s.subLabel}>Sử dụng biểu mẫu có sẵn (Tùy chọn)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.templateRow}
            >
              <Pressable
                style={[
                  s.templateChip,
                  templateId === "" && s.templateChipActive,
                ]}
                onPress={() => setTemplateId("")}
                disabled={busy || uncertain}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={templateId === "" ? "#059669" : "#64748b"}
                />
                <Text
                  style={[
                    s.templateChipText,
                    templateId === "" && s.templateChipTextActive,
                  ]}
                >
                  Tự do (Không dùng mẫu)
                </Text>
              </Pressable>
              {templates.map((tpl) => {
                const isChosen = templateId === tpl._id;
                return (
                  <Pressable
                    key={tpl._id}
                    style={[s.templateChip, isChosen && s.templateChipActive]}
                    onPress={() => setTemplateId(tpl._id)}
                    disabled={busy || uncertain}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={14}
                      color={isChosen ? "#059669" : "#64748b"}
                    />
                    <Text
                      style={[s.templateChipText, isChosen && s.templateChipTextActive]}
                      numberOfLines={1}
                    >
                      {tpl.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedTemplate && (
              <View style={s.templateSelectedBanner}>
                <Ionicons name="information-circle" size={18} color="#0284c7" />
                <Text style={s.templateBannerText}>
                  Đang áp dụng mẫu: <Text style={{ fontWeight: "700" }}>{selectedTemplate.name}</Text> ({selectedTemplate.fileName})
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Custom Title (If no template selected) */}
        {!selectedTemplate && (
          <View style={s.section}>
            <Text style={s.subLabel}>Tiêu đề đơn (Tùy chọn)</Text>
            <View style={s.inputWrap}>
              <Ionicons name="bookmark-outline" size={18} color="#94a3b8" />
              <TextInput
                style={s.textInput}
                placeholder={`VD: ${REQUEST_KIND_CONFIGS[kind].title} đợt 1...`}
                placeholderTextColor="#94a3b8"
                value={type}
                onChangeText={setType}
                editable={!busy && !uncertain}
              />
            </View>
          </View>
        )}

        {/* 4. Date Range Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>2. Thời gian áp dụng</Text>
            {totalDays > 0 && (
              <View style={s.durationPill}>
                <Ionicons name="time-outline" size={14} color="#059669" />
                <Text style={s.durationText}>
                  Tổng {totalDays} ngày ({start === end ? "Trong ngày" : `${totalDays} ngày liên tiếp`})
                </Text>
              </View>
            )}
          </View>

          {/* Quick Preset Buttons */}
          <View style={s.presetRow}>
            <Pressable
              style={s.presetBtn}
              onPress={() => applyPreset("today")}
              disabled={busy || uncertain}
            >
              <Text style={s.presetBtnText}>Hôm nay</Text>
            </Pressable>
            <Pressable
              style={s.presetBtn}
              onPress={() => applyPreset("tomorrow")}
              disabled={busy || uncertain}
            >
              <Text style={s.presetBtnText}>Ngày mai</Text>
            </Pressable>
            <Pressable
              style={s.presetBtn}
              onPress={() => applyPreset("3days")}
              disabled={busy || uncertain}
            >
              <Text style={s.presetBtnText}>3 ngày</Text>
            </Pressable>
            <Pressable
              style={s.presetBtn}
              onPress={() => applyPreset("nextweek")}
              disabled={busy || uncertain}
            >
              <Text style={s.presetBtnText}>Tuần sau</Text>
            </Pressable>
          </View>

          {/* Date Picker Trigger Inputs */}
          <View style={s.dateInputsRow}>
            {/* Start Date */}
            <View style={s.dateCol}>
              <Text style={s.dateColLabel}>Từ ngày</Text>
              <Pressable
                style={s.dateCard}
                onPress={() => openCalendar("start")}
                disabled={busy || uncertain}
              >
                <View style={s.dateCardLeft}>
                  <Text style={s.dateViText}>{formatViDate(start)}</Text>
                  <Text style={s.dateIsoText}>{start}</Text>
                </View>
                <View style={s.calIconBox}>
                  <Ionicons name="calendar" size={16} color="#059669" />
                </View>
              </Pressable>
            </View>

            <View style={s.dateArrow}>
              <Ionicons name="arrow-forward" size={18} color="#94a3b8" />
            </View>

            {/* End Date */}
            <View style={s.dateCol}>
              <Text style={s.dateColLabel}>Đến ngày</Text>
              <Pressable
                style={s.dateCard}
                onPress={() => openCalendar("end")}
                disabled={busy || uncertain}
              >
                <View style={s.dateCardLeft}>
                  <Text style={s.dateViText}>{formatViDate(end)}</Text>
                  <Text style={s.dateIsoText}>{end}</Text>
                </View>
                <View style={s.calIconBox}>
                  <Ionicons name="calendar" size={16} color="#059669" />
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        {/* 5. Leave Balance Card (If kind is leave) */}
        {requestKind === "leave" && (
          <View style={s.balanceCard}>
            <View style={s.balanceHeader}>
              <View style={s.balanceIconBox}>
                <Ionicons name="pie-chart" size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.balanceTitle}>Quỹ phép năm {year}</Text>
                <Text style={s.balanceSub}>Hạn mức và số ngày khả dụng của bạn</Text>
              </View>
              {balance && (
                <View style={s.availableBadge}>
                  <Text style={s.availableNum}>
                    {Math.max(0, balance.remaining - balance.pending)}
                  </Text>
                  <Text style={s.availableUnit}>ngày khả dụng</Text>
                </View>
              )}
            </View>

            {balance ? (
              <>
                <View style={s.statGrid}>
                  <View style={s.statBox}>
                    <Text style={s.statVal}>{balance.entitlement}</Text>
                    <Text style={s.statLbl}>Định mức</Text>
                  </View>
                  <View style={s.statBox}>
                    <Text style={[s.statVal, { color: "#475569" }]}>{balance.used}</Text>
                    <Text style={s.statLbl}>Đã dùng</Text>
                  </View>
                  <View style={s.statBox}>
                    <Text style={[s.statVal, { color: "#d97706" }]}>{balance.pending}</Text>
                    <Text style={s.statLbl}>Đang chờ</Text>
                  </View>
                  <View style={s.statBox}>
                    <Text style={[s.statVal, { color: "#059669" }]}>{balance.remaining}</Text>
                    <Text style={s.statLbl}>Còn lại</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.progressBarBg}>
                  <View
                    style={[
                      s.progressBarFill,
                      {
                        width: `${Math.min(
                          100,
                          balance.entitlement > 0
                            ? ((balance.used + balance.pending) / balance.entitlement) * 100
                            : 0,
                        )}%`,
                      },
                    ]}
                  />
                </View>

                <View style={s.balanceNotice}>
                  <Ionicons name="information-circle-outline" size={15} color="#64748b" />
                  <Text style={s.balanceNoticeText}>
                    Số ngày trừ phép thực tế sẽ được tính chuẩn xác theo lịch làm việc và ngày nghỉ lễ của công ty.
                  </Text>
                </View>
              </>
            ) : balanceError ? (
              <Text style={s.balanceErrText}>{balanceError}</Text>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={s.balanceNoticeText}>Đang kiểm tra số dư phép...</Text>
              </View>
            )}
          </View>
        )}

        {/* 6. Reason Field */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>3. Lý do nộp đơn <Text style={{ color: "#e11d48" }}>*</Text></Text>
            <Text style={s.charCount}>{reason.length} ký tự</Text>
          </View>
          <View style={[s.textAreaWrap, !reason.trim() && s.textAreaEmpty]}>
            <TextInput
              style={s.textArea}
              placeholder="Nhập chi tiết lý do (bắt buộc)... Ví dụ: Đi khám sức khỏe định kỳ, có việc gia đình cần giải quyết..."
              placeholderTextColor="#94a3b8"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!busy && !uncertain}
            />
          </View>
        </View>

        {/* 7. Attachments Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>
              4. Tài liệu & Minh chứng ({attachments.length}/10)
            </Text>
            <Text style={s.sectionHint}>Tối đa 20MB/tệp</Text>
          </View>

          {attachments.length > 0 && (
            <View style={s.attachmentsList}>
              {attachments.map((item, index) => (
                <View key={item.uploadToken || `${item.name}-${index}`} style={s.attachCard}>
                  <View style={s.attachIcon}>
                    <Ionicons
                      name={item.mimeType?.includes("image") ? "image" : "document-text"}
                      size={20}
                      color="#0284c7"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.attachName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={s.attachMeta}>
                      {formatFileSize(item.size)} · Đã sẵn sàng gửi
                    </Text>
                  </View>
                  <Pressable
                    style={s.attachRemoveBtn}
                    onPress={() =>
                      setAttachments((items) => items.filter((_, i) => i !== index))
                    }
                    disabled={busy || uncertain}
                    hitSlop={6}
                  >
                    <Ionicons name="trash-outline" size={18} color="#e11d48" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {attachments.length < 10 && (
            <Pressable
              style={({ pressed }) => [s.uploadBtn, pressed && s.uploadBtnPressed]}
              disabled={busy || uncertain}
              onPress={() =>
                void run(async () => {
                  const file = await pickLeaveAttachment();
                  if (file) setAttachments((items) => [...items, file]);
                })
              }
            >
              <View style={s.uploadIconBox}>
                <Ionicons name="cloud-upload-outline" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.uploadTitle}>
                  {busy ? "Đang tải lên..." : "Tải lên tệp đính kèm"}
                </Text>
                <Text style={s.uploadSub}>
                  Chọn ảnh chụp giấy phép, đơn viết tay, chứng chỉ hoặc PDF
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Global Error message */}
        {!!error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#e11d48" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 8. Fixed Bottom Action Bar */}
      <SafeAreaView edges={["bottom"]} style={s.bottomBar}>
        <View style={s.bottomBtnRow}>
          <Pressable
            style={({ pressed }) => [s.cancelBtn, pressed && s.cancelBtnPressed]}
            onPress={onClose}
            disabled={busy}
          >
            <Text style={s.cancelBtnText}>{uncertain ? "Quay lại" : "Hủy"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              s.submitBtn,
              (!reason.trim() || busy || uncertain) && s.submitBtnDisabled,
              pressed && s.submitBtnPressed,
            ]}
            onPress={() => void submit()}
            disabled={busy || uncertain || !reason.trim()}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#ffffff" />
                <Text style={s.submitBtnText}>Gửi đơn ngay</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* 9. Interactive Calendar Month Picker Modal */}
      <Modal
        visible={calendarTarget !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setCalendarTarget(null)}
      >
        <View style={s.calModalOverlay}>
          <View style={s.calModalBox}>
            <View style={s.calHeader}>
              <Pressable
                style={s.calNavBtn}
                onPress={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                }
              >
                <Ionicons name="chevron-back" size={20} color="#334155" />
              </Pressable>
              <Text style={s.calMonthTitle}>
                Tháng {calMonth.getMonth() + 1} / {calMonth.getFullYear()}
              </Text>
              <Pressable
                style={s.calNavBtn}
                onPress={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                }
              >
                <Ionicons name="chevron-forward" size={20} color="#334155" />
              </Pressable>
            </View>

            <Text style={s.calTargetNotice}>
              Đang chọn cho:{" "}
              <Text style={{ fontWeight: "700", color: "#059669" }}>
                {calendarTarget === "start" ? "Từ ngày (Bắt đầu)" : "Đến ngày (Kết thúc)"}
              </Text>
            </Text>

            {/* Weekdays row */}
            <View style={s.calWeekRow}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w, idx) => (
                <Text
                  key={w}
                  style={[s.calWeekHeader, idx >= 5 && { color: "#e11d48" }]}
                >
                  {w}
                </Text>
              ))}
            </View>

            {/* Grid */}
            <View style={s.calGrid}>
              {calendarDays.map((cell) => {
                const isSelectedStart = cell.dateStr === start;
                const isSelectedEnd = cell.dateStr === end;
                const inRange = cell.dateStr >= start && cell.dateStr <= end;
                const isToday = cell.dateStr === localDay();

                return (
                  <Pressable
                    key={cell.dateStr}
                    style={[
                      s.calCell,
                      inRange && s.calCellInRange,
                      (isSelectedStart || isSelectedEnd) && s.calCellSelected,
                    ]}
                    onPress={() => selectCalDay(cell.dateStr)}
                  >
                    <Text
                      style={[
                        s.calDayText,
                        !cell.isCurrentMonth && s.calDayMuted,
                        (isSelectedStart || isSelectedEnd) && s.calDaySelectedText,
                        isToday && !isSelectedStart && !isSelectedEnd && s.calTodayText,
                      ]}
                    >
                      {cell.dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.calFooter}>
              <Pressable
                style={s.calCloseBtn}
                onPress={() => setCalendarTarget(null)}
              >
                <Text style={s.calCloseText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  pressedCircle: {
    backgroundColor: "#e2e8f0",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 18,
  },
  submitterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  submitterName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  submitterRole: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  liveStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    gap: 4,
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  sectionHint: {
    fontSize: 12,
    color: "#94a3b8",
  },
  kindGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kindCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 6,
    position: "relative",
  },
  kindIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  kindTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 2,
  },
  kindSub: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
  },
  kindCheckBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  templateRow: {
    gap: 8,
    paddingVertical: 4,
  },
  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  templateChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475569",
  },
  templateChipTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
  templateSelectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    padding: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  templateBannerText: {
    fontSize: 12,
    color: "#0369a1",
    flex: 1,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    padding: 0,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  durationText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  dateInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateCol: {
    flex: 1,
    gap: 4,
  },
  dateColLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
  },
  dateCardLeft: {
    flex: 1,
  },
  dateViText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  dateIsoText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  calIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  dateArrow: {
    paddingTop: 16,
  },
  balanceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  balanceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  balanceSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  availableBadge: {
    alignItems: "flex-end",
  },
  availableNum: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
    lineHeight: 20,
  },
  availableUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
  statGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  statLbl: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#059669",
    borderRadius: 3,
  },
  balanceNotice: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  balanceNoticeText: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
    flex: 1,
  },
  balanceErrText: {
    fontSize: 12,
    color: "#e11d48",
  },
  charCount: {
    fontSize: 11,
    color: "#94a3b8",
  },
  textAreaWrap: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
  },
  textAreaEmpty: {
    borderColor: "#cbd5e1",
  },
  textArea: {
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 20,
    minHeight: 80,
    padding: 0,
  },
  attachmentsList: {
    gap: 8,
  },
  attachCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  attachIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  attachName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  attachMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  attachRemoveBtn: {
    padding: 6,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  uploadBtnPressed: {
    backgroundColor: "#f1f5f9",
  },
  uploadIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  uploadSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    color: "#be123c",
    flex: 1,
    lineHeight: 18,
  },
  bottomBar: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  bottomBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cancelBtnPressed: {
    backgroundColor: "#e2e8f0",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnPressed: {
    opacity: 0.85,
  },
  submitBtnDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  // Calendar Modal styles
  calModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  calModalBox: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  calTargetNotice: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 12,
  },
  calWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calWeekHeader: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
    borderRadius: 8,
  },
  calCellInRange: {
    backgroundColor: "#ecfdf5",
    borderRadius: 0,
  },
  calCellSelected: {
    backgroundColor: "#059669",
    borderRadius: 10,
  },
  calDayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  calDayMuted: {
    color: "#cbd5e1",
  },
  calDaySelectedText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  calTodayText: {
    color: "#059669",
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  calFooter: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    alignItems: "center",
  },
  calCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  calCloseText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
});
