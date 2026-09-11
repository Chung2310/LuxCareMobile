import React, { createContext, useContext, useEffect, useState } from "react";
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
  const retry = async () => {
    setLoading(true);
    setError(null);
    try {
      if (configurationError) throw new Error(configurationError);
      if (await api.restore()) setUser(await getMe());
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setLoading(false);
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
          setUser(null);
          setSelectedBranch(null);
        },
      });
    }
    api.onSessionExpired = () => {
      socketService.disconnect();
      setUser(null);
      setSelectedBranch(null);
    };
    void retry();
    api.onAccessTokenChanged = (token) => socketService.connect(token);
    return () => {
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
      if (state === "active")
        void getMe()
          .then((profile) => {
            if (active) {
              const isOwnerRole = ["admin", "superadmin", "branch_owner"].includes(profile.role || "");
              if (!isOwnerRole || profile.companyCode !== user.companyCode) {
                api.setBranchId(null);
                setSelectedBranch(null);
              }
              setUser(profile);
            }
          })
          .catch(() => {});
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
          await api.login(email.trim(), password);
          setSelectedBranch(null);
          try {
            setUser(await getMe());
            setError(null);
            // Connect socket with the new access token.
            const token = api.getAccessToken();
            if (token) socketService.connect(token);
          } catch (error) {
            await api.clear();
            throw error;
          }
        },
        logout: async () => {
          try {
            await api.logout();
          } finally {
            socketService.disconnect();
            setUser(null);
            setSelectedBranch(null);
            setError(null);
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
