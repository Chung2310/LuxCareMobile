import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { router } from "expo-router";
import type { Ionicons } from "@expo/vector-icons";
import {
  NavigationLoadingOverlay,
  type LoadingScreenProps,
} from "../components/common/LoadingScreen";

interface LoadingState extends LoadingScreenProps {
  visible: boolean;
}

interface LoadingContextType {
  showLoading: (options?: LoadingScreenProps) => void;
  hideLoading: () => void;
  navigateWithLoading: (
    route: string,
    options?: {
      title?: string;
      subtitle?: string;
      icon?: keyof typeof Ionicons.glyphMap;
      color?: string;
      bgColor?: string;
      durationMs?: number;
    },
  ) => void;
}

const LoadingContext = createContext<LoadingContextType>({
  showLoading: () => {},
  hideLoading: () => {},
  navigateWithLoading: () => {},
});

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    visible: false,
    title: "LuxCare",
    subtitle: "Đang mở phân hệ...",
    icon: "medical",
    color: "#059669",
    bgColor: "#ecfdf5",
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLoading = useCallback((options?: LoadingScreenProps) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoadingState({
      visible: true,
      title: options?.title || "LuxCare",
      subtitle: options?.subtitle || "Đang tải dữ liệu...",
      icon: options?.icon || "medical",
      color: options?.color || "#059669",
      bgColor: options?.bgColor || "#ecfdf5",
    });
  }, []);

  const hideLoading = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoadingState((prev) => ({ ...prev, visible: false }));
  }, []);

  const navigateWithLoading = useCallback(
    (
      route: string,
      options?: {
        title?: string;
        subtitle?: string;
        icon?: keyof typeof Ionicons.glyphMap;
        color?: string;
        bgColor?: string;
        durationMs?: number;
      },
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      // 1. Hiển thị màn hình loading ngay lập tức
      setLoadingState({
        visible: true,
        title: options?.title || "LuxCare",
        subtitle: options?.subtitle || "Đang mở phân hệ và nạp dữ liệu...",
        icon: options?.icon || "medical",
        color: options?.color || "#059669",
        bgColor: options?.bgColor || "#ecfdf5",
      });

      // 2. Chuyển hướng route ngay
      try {
        router.push(route as any);
      } catch {
        router.replace(route as any);
      }

      // 3. Giữ màn hình loading trong khoảng thời gian để màn hình mới mount và tải dữ liệu ban đầu
      const duration = options?.durationMs ?? 750;
      timerRef.current = setTimeout(() => {
        setLoadingState((prev) => ({ ...prev, visible: false }));
      }, duration);
    },
    [],
  );

  return (
    <LoadingContext.Provider
      value={{ showLoading, hideLoading, navigateWithLoading }}
    >
      {children}
      <NavigationLoadingOverlay
        visible={loadingState.visible}
        title={loadingState.title}
        subtitle={loadingState.subtitle}
        icon={loadingState.icon}
        color={loadingState.color}
        bgColor={loadingState.bgColor}
      />
    </LoadingContext.Provider>
  );
};

export function useAppLoading() {
  return useContext(LoadingContext);
}
