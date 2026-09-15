import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";
import { api } from "../../api/services";
import { loadBlogImageSource } from "./blogImageSource";

export function BlogImage({ url, style, onLoad, onError, ...props }: Omit<ImageProps, "source"> & { url: string }) {
  const [result, setResult] = useState<{ url: string; uri?: string; error?: string } | null>(null);
  const [rendered, setRendered] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setRendered(false);
    void loadBlogImageSource(url, api.getOrigin(), api.transport.fetch, controller.signal)
      .then(uri => { if (!controller.signal.aborted) setResult({ url, uri }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ url, error: error instanceof Error ? error.message : "Không tải được ảnh." }); });
    return () => controller.abort();
  }, [url, attempt]);
  const current = result?.url === url ? result : null;
  return <View style={[style as StyleProp<ViewStyle>, { overflow: "hidden" }]}>
    {current?.uri && !current.error && <Image {...props} key={attempt} source={{ uri: current.uri }}
      style={StyleSheet.absoluteFill}
      onLoad={event => { setRendered(true); onLoad?.(event); }}
      onError={event => { setResult({ url, error: "Không hiển thị được ảnh. Vui lòng thử lại." }); onError?.(event); }} />}
    {current?.error ? <View style={styles.status}>
      <Text accessibilityRole="alert" numberOfLines={3} style={styles.message}>{current.error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Thử tải lại ảnh" style={styles.retry}
        onPress={event => { event.stopPropagation(); setAttempt(value => value + 1); }}>
        <Text style={{ color: "#4338ca" }}>Thử lại</Text>
      </Pressable>
    </View> : !rendered && <View pointerEvents="none" style={styles.status}><ActivityIndicator color="#4f46e5" /></View>}
  </View>;
}
const styles = StyleSheet.create({
  status: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 16, gap: 12 },
  message: { color: "#475569", backgroundColor: "#f1f5f9", padding: 8, textAlign: "center" },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#fff" },
});
