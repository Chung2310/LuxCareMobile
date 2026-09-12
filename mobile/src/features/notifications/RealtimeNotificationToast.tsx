import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NoticePayload } from "./payload";

export interface RealtimeBannerData {
  data?: NoticePayload | Partial<NoticePayload>;
  title: string;
  body: string;
}

import { detectNotificationCategory } from "./category";

interface RealtimeNotificationToastProps {
  banner: RealtimeBannerData;
  topInset: number;
  onPress: () => void;
  onDismiss: () => void;
  timeoutMs?: number;
}

export function RealtimeNotificationToast({
  banner,
  topInset,
  onPress,
  onDismiss,
  timeoutMs = 6000,
}: RealtimeNotificationToastProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const progress = useRef(new Animated.Value(1)).current;

  const [isDismissing, setIsDismissing] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const categoryInfo = useMemo(() => {
    return detectNotificationCategory(banner.title, banner.body, banner.data?.action);
  }, [banner.title, banner.body, banner.data?.action]);

  // Execute smooth exit animation
  const animateExit = (onComplete?: () => void) => {
    if (isDismissing) return;
    setIsDismissing(true);

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.stop();
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete ? onComplete() : onDismiss();
    });
  };

  // Start progress bar and auto-dismiss timer
  const startDismissTimer = (duration: number) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    progress.setValue(1);
    progressAnimationRef.current = Animated.timing(progress, {
      toValue: 0,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnimationRef.current.start();

    dismissTimerRef.current = setTimeout(() => {
      animateExit();
    }, duration);
  };

  // Entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startDismissTimer(timeoutMs);
    });

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (progressAnimationRef.current) progressAnimationRef.current.stop();
    };
  }, [banner]);

  // PanResponder to handle swipe-up to dismiss gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Only capture vertical swipes that exceed 6 pixels
        return Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderGrant: () => {
        // Pause timer while dragging
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        if (progressAnimationRef.current) progressAnimationRef.current.stop();
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          // Dragging upward: direct movement
          translateY.setValue(gesture.dy);
          opacity.setValue(Math.max(0.2, 1 + gesture.dy / 100));
        } else {
          // Dragging downward: slight resistance
          translateY.setValue(gesture.dy * 0.25);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -25 || gesture.vy < -0.4) {
          // Swiped up: dismiss
          animateExit();
        } else {
          // Rebound back
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              friction: 7,
              tension: 50,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
          // Resume remaining timer
          startDismissTimer(3500);
        }
      },
    })
  ).current;

  const handleCardPress = () => {
    animateExit(() => {
      onPress();
    });
  };

  const handleClosePress = () => {
    animateExit();
  };

  // Animated width for progress bar
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        s.wrapper,
        {
          top: topInset + 8,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[s.card, categoryInfo.category === "attendance" && s.attendanceCard]}>
        {/* Top Header Row */}
        <View style={s.headerRow}>
          <View style={s.brandGroup}>
            <Image
              source={require("../../../public/brand-icon.png")}
              style={s.brandIcon}
              resizeMode="contain"
            />
            <Text style={s.brandName}>LUXCARE</Text>
            <Text style={s.separatorDot}>•</Text>

            {/* Category Tag */}
            <View
              style={[
                s.categoryBadge,
                { backgroundColor: categoryInfo.bg, borderColor: categoryInfo.borderColor },
              ]}
            >
              <Ionicons
                name={categoryInfo.iconName}
                size={11}
                color={categoryInfo.color}
                style={{ marginRight: 3 }}
              />
              <Text style={[s.categoryText, { color: categoryInfo.color }]}>
                {categoryInfo.label}
              </Text>
            </View>
          </View>

          <View style={s.rightHeaderGroup}>
            {/* Realtime Pulse Indicator & Time */}
            <View style={s.liveBadge}>
              <View style={s.pulseDot} />
              <Text style={s.liveText}>Vừa xong</Text>
            </View>

            {/* Close Button */}
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Đóng thông báo"
              style={s.closeBtn}
              onPress={handleClosePress}
            >
              <Ionicons name="close" size={14} color="#64748b" />
            </Pressable>
          </View>
        </View>

        {/* Content Body */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={banner.title}
          style={s.bodyContainer}
          onPress={handleCardPress}
        >
          <Text style={s.titleText} numberOfLines={1}>
            {banner.title}
          </Text>

          {!!banner.body && (
            <Text style={s.bodyText} numberOfLines={2}>
              {banner.body}
            </Text>
          )}

          {/* Action Footer */}
          <View style={s.footerRow}>
            {categoryInfo.category === "attendance" ? (
              <View style={s.attendanceActionBadge}>
                <Ionicons name="time" size={13} color="#0891b2" />
                <Text style={s.attendanceActionText}>Mở bảng Chấm công</Text>
                <Ionicons name="chevron-forward" size={12} color="#0891b2" />
              </View>
            ) : (
              <>
                <Text style={s.actionText}>Chạm để xem chi tiết</Text>
                <Ionicons name="chevron-forward" size={13} color="#059669" />
              </>
            )}
          </View>
        </Pressable>

        {/* Animated Auto-dismiss Progress Bar */}
        <View style={s.progressTrack}>
          <Animated.View
            style={[
              s.progressFill,
              {
                width: progressWidth,
                backgroundColor: categoryInfo.color,
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 25,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(226, 232, 240, 0.9)",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 16,
  },
  attendanceCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#a5f3fc",
    shadowColor: "#0891b2",
    shadowOpacity: 0.18,
    backgroundColor: "#ffffff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
  },
  brandName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.8,
  },
  separatorDot: {
    color: "#cbd5e1",
    marginHorizontal: 6,
    fontSize: 12,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  rightHeaderGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  bodyContainer: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  bodyText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#059669",
  },
  attendanceActionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  attendanceActionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0891b2",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "#f1f5f9",
    width: "100%",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
});
