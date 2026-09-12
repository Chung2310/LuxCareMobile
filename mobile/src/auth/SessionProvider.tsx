import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api, configurationError, getMe } from "../api/services";
import { socketService } from "../api/socketService";
import type { UserProfile } from "../../../src/types/common";
import type { BranchRecord } from "../../../src/services/branchService";

type Session = {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  sessionReplaced?: boolean;
  resetSessionReplaced?: () => void;
  retry: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (uid: string, name: string) => void;
  updateUserProfile: (uid: string, data: Partial<UserProfile>) => void;
  selectedBranch: BranchRecord | null;
  selectBranch: (branch: BranchRecord | null) => void;
};
const Context = createContext<Session | null>(null);
const ERROR_CODE_TRANSLATIONS: Record<string, string> = {
  PAYROLL_REVISION_MISSING: "Kỳ lương chưa có bản tính toán hợp lệ. Vui lòng thực hiện tính lương trước khi thao tác tiếp.",
  PAYROLL_CHECKSUM_MISMATCH: "Dữ liệu lương đã thay đổi sau khi tính toán. Vui lòng tính lại kỳ lương.",
  PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH: "Dữ liệu hiệu lực của kỳ lương đã thay đổi sau khi duyệt. Vui lòng kiểm tra lại.",
  PAYROLL_PAID_RUN_IMMUTABLE: "Kỳ lương đã thanh toán hoàn tất không thể thay đổi.",
  PAYROLL_SEPARATION_OF_DUTIES: "Người tạo kỳ lương không thể tự duyệt kỳ lương của mình.",
  PAYROLL_BLOCKING_ISSUES: "Vui lòng xử lý tất cả các vấn đề chặn trước khi tiếp tục.",
  PAYROLL_CONFIRMED_PAYMENTS_EXIST: "Vui lòng hoàn tác tất cả các khoản thanh toán đã xác nhận trước khi mở lại kỳ lương.",
  PAYROLL_REOPEN_REASON_REQUIRED: "Cần nhập lý do để mở lại kỳ lương.",
  PAYROLL_VERSION_CONFLICT: "Xung đột phiên bản dữ liệu. Vui lòng tải lại trạng thái mới nhất.",
  PAYROLL_RUN_NOT_FOUND: "Không tìm thấy bảng lương.",
  PAYROLL_RUN_NOT_PAYABLE: "Không thể thanh toán bảng lương ở trạng thái hiện tại.",
  PAYROLL_PAYMENT_INVALID_AMOUNT: "Số tiền thanh toán hoặc phân bổ dòng lương không hợp lệ.",
  PAYROLL_PAYMENT_UNKNOWN_EMPLOYEE: "Nhân viên nhận thanh toán không nằm trong kỳ lương này.",
  PAYROLL_PAYMENT_EXCEEDS_NET: "Số tiền thanh toán vượt quá số dư còn lại của kỳ lương.",
  PAYROLL_PAYMENT_ALLOCATION_MISMATCH: "Tổng tiền phân bổ không khớp với tổng tiền thanh toán.",
  PAYROLL_PAYMENT_NOT_FOUND: "Không tìm thấy khoản thanh toán.",
  PAYROLL_INVALID_TRANSITION: "Trạng thái kỳ lương hiện tại không hợp lệ cho thao tác này.",
  PAYROLL_PAYMENT_INVALID_TRANSITION: "Trạng thái thanh toán hiện tại không hợp lệ cho thao tác này.",
  SESSION_REPLACED: "Tài khoản của bạn đã được đăng nhập trên một thiết bị khác.",
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
};

const PHRASE_TRANSLATIONS: Array<[RegExp | string, string]> = [
  ["The payroll run has no active calculation revision", "Kỳ lương chưa có bản tính toán hợp lệ. Vui lòng thực hiện tính lương trước khi thao tác tiếp."],
  ["The active calculation revision is not available", "Bản tính toán đang hoạt động không khả dụng hoặc chưa hoàn thành."],
  ["Payroll results changed after calculation; recalculate the run", "Dữ liệu lương đã thay đổi sau khi tính toán. Vui lòng tính lại kỳ lương."],
  ["A paid payroll run can no longer be changed", "Kỳ lương đã thanh toán hoàn tất không thể thay đổi."],
  ["The payroll run creator cannot approve their own run", "Người tạo kỳ lương không thể tự duyệt kỳ lương của mình."],
  ["Resolve every blocking issue before continuing", "Vui lòng xử lý tất cả các vấn đề chặn trước khi tiếp tục."],
  ["Reverse every confirmed payroll payment before reopening the run", "Vui lòng hoàn tác tất cả các khoản thanh toán đã xác nhận trước khi mở lại kỳ lương."],
  ["A reason is required to reopen a payroll run", "Cần nhập lý do để mở lại kỳ lương."],
  ["Pinned effective payroll results changed after review", "Dữ liệu hiệu lực của kỳ lương đã thay đổi sau khi duyệt. Vui lòng kiểm tra lại."],
  ["Network request failed", "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại."],
  ["Unsupported FormDataPart implementation", "Không thể xử lý định dạng tệp tin. Vui lòng thử lại."],
  ["Failed to fetch", "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."],
  ["Aborted", "Yêu cầu đã bị hủy hoặc quá thời gian chờ. Vui lòng thử lại."],
  ["Timeout", "Yêu cầu quá thời gian chờ. Vui lòng thử lại."],
  ["Payment must allocate at least one employee line", "Khoản thanh toán phải phân bổ cho ít nhất một nhân viên."],
  ["Payment employee is not in the payroll run", "Nhân viên nhận thanh toán không nằm trong kỳ lương này."],
  ["Every payment line must be a positive integer", "Số tiền mỗi dòng thanh toán phải là số nguyên dương."],
  ["Payment amount exceeds the remaining payroll balance", "Số tiền thanh toán vượt quá số dư còn lại của kỳ lương."],
  ["Payment allocation does not match the payment amount", "Tổng tiền phân bổ không khớp với tổng tiền thanh toán."],
  ["Payment not found", "Không tìm thấy khoản thanh toán."],
  [/Cannot (\w+) a payroll run in status (\w+)/i, "Không thể thực hiện thao tác trên kỳ lương ở trạng thái này."],
  [/Cannot (\w+) a payment in status (\w+)/i, "Không thể thực hiện thao tác trên khoản thanh toán ở trạng thái này."],
];

export const messageOf = (error: unknown): string => {
  if (!error) return "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";
  const errObj = error as any;
  const code = errObj?.code;
  if (code && ERROR_CODE_TRANSLATIONS[code]) {
    return ERROR_CODE_TRANSLATIONS[code];
  }
  const rawMessage = typeof errObj?.message === "string"
    ? errObj.message
    : typeof error === "string"
      ? error
      : "";
  if (!rawMessage.trim()) {
    return "Không thể kết nối hoặc thực hiện thao tác. Vui lòng thử lại.";
  }
  for (const [target, vietnamese] of PHRASE_TRANSLATIONS) {
    if (typeof target === "string") {
      if (rawMessage.includes(target)) return vietnamese;
    } else if (target instanceof RegExp && target.test(rawMessage)) {
      return vietnamese;
    }
  }
  return rawMessage;
};

export function SessionProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchRecord | null>(null);
  const [sessionReplaced, setSessionReplaced] = useState(false);
  const resetSessionReplaced = () => setSessionReplaced(false);
  const operation = useRef(0);
  const endSession = () => {
    operation.current++;
    socketService.disconnect();
    api.setBranchId(null);
    setUser(null);
    setSelectedBranch(null);
    setError(null);
    setLoading(false);
  };
  const retry = async () => {
    const attempt = ++operation.current;
    setLoading(true);
    setError(null);
    try {
      if (configurationError) throw new Error(configurationError);
      const restored = await api.restore();
      if (attempt !== operation.current) return;
      const profile = restored ? await getMe() : null;
      if (attempt === operation.current) setUser(profile);
    } catch (error) {
      // Expiry already ended the session. Its rejected request must not replace login with an error page.
      if (attempt === operation.current) setError(messageOf(error));
    } finally {
      if (attempt === operation.current) setLoading(false);
    }
  };
  useEffect(() => {
    // Configure socket once with the server origin so it can connect later.
    if (api.getOrigin()) {
      socketService.configure({
        origin: api.getOrigin(),
        onSessionReplaced: () => {
          void api.clear().catch(() => {});
          // Another device signed in with the same account.
          // Expire immediately – no need to call the HTTP logout endpoint.
          setSessionReplaced(true);
          endSession();
        },
      });
    }
    api.onSessionExpired = endSession;
    void retry();
    api.onAccessTokenChanged = (token) => socketService.connect(token);
    return () => {
      operation.current++;
      api.onSessionExpired = () => {};
      api.onAccessTokenChanged = () => {};
      socketService.disconnect();
    };
  }, []);
  // Connect socket once we have an authenticated user.
  // The token may rotate after a refresh, so we re-read it on each user change.
  useEffect(() => {
    if (!user) {
      socketService.disconnect();
      return;
    }
    const token = api.getAccessToken();
    if (token) socketService.connect(token);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let profileRequest = 0;
    const refreshProfile = () => {
        const request = ++profileRequest;
        const attempt = operation.current;
        void getMe()
          .then((profile) => {
            if (active && request === profileRequest && attempt === operation.current) {
              const isOwnerRole = ["admin", "superadmin", "branch_owner"].includes(profile.role || "");
              if (!isOwnerRole || profile.companyCode !== user.companyCode) {
                api.setBranchId(null);
                setSelectedBranch(null);
              }
              setUser(profile);
            }
          })
          .catch(() => {});
    };
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refreshProfile(); });
    const unsubscribeRole = socketService.subscribe("role_permissions_updated", data => {
      if (!data?.userId || data.userId === user.uid) refreshProfile();
    });
    return () => {
      active = false;
      subscription.remove();
      unsubscribeRole();
    };
  }, [user?.uid, user?.companyCode]);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        sessionReplaced,
        resetSessionReplaced,
        retry,
        selectedBranch,
        updateDisplayName: (uid, name) =>
          setUser((current) => (current?.uid === uid ? { ...current, displayName: name } : current)),
        updateUserProfile: (uid, data) =>
          setUser((current) => (current?.uid === uid ? { ...current, ...data } : current)),
        selectBranch: (branch) => {
          const isOwner = ["admin", "superadmin", "branch_owner"].includes(user?.role || "");
          if (!isOwner) throw new Error("Tài khoản không được chuyển chi nhánh.");
          if (branch && (!branch.isActive || branch.companyCode.toUpperCase() !== user?.companyCode?.toUpperCase()))
            throw new Error("Chi nhánh không khả dụng.");
          api.setBranchId(branch?._id || null);
          setSelectedBranch(branch);
        },
        login: async (email, password) => {
          setSessionReplaced(false);
          const attempt = ++operation.current;
          await api.login(email.trim(), password);
          if (attempt !== operation.current) return;
          setSelectedBranch(null);
          try {
            const profile = await getMe();
            if (attempt !== operation.current) return;
            setUser(profile);
            setError(null);
            setLoading(false);
            // Connect socket with the new access token.
            const token = api.getAccessToken();
            if (token) socketService.connect(token);
          } catch (error) {
            if (attempt === operation.current) await api.clear();
            throw error;
          }
        },
        logout: async () => {
          operation.current++;
          try {
            await api.logout();
          } finally {
            endSession();
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("SessionProvider is missing");
  return session;
}
