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
  retry: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (uid: string, name: string) => void;
  updateUserProfile: (uid: string, data: Partial<UserProfile>) => void;
  selectedBranch: BranchRecord | null;
  selectBranch: (branch: BranchRecord | null) => void;
};
const Context = createContext<Session | null>(null);
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Không thể kết nối. Vui lòng thử lại.";

export function SessionProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchRecord | null>(null);
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
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const attempt = operation.current;
        void getMe()
          .then((profile) => {
            if (active && attempt === operation.current) {
              const isOwnerRole = ["admin", "superadmin", "branch_owner"].includes(profile.role || "");
              if (!isOwnerRole || profile.companyCode !== user.companyCode) {
                api.setBranchId(null);
                setSelectedBranch(null);
              }
              setUser(profile);
            }
          })
          .catch(() => {});
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [user?.uid, user?.companyCode]);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
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
