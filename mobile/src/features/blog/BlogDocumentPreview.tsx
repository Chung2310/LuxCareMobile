import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BlogAttachment } from "../../../../src/services/blogService";
import { api } from "../../api/services";
import { loadBlogDocument, type PreviewDocument } from "./documentPreview";
import { DocumentPreviewFrame } from "./DocumentPreviewFrame";
import { ExcelDocumentPreview } from "./ExcelDocumentPreview";
export function BlogDocumentPreview({ attachment, onClose }: { attachment: BlogAttachment; onClose: () => void }) {
  const [document, setDocument] = useState<PreviewDocument | null>(null), [error, setError] = useState(""), [rendering, setRendering] = useState(true), [attempt, setAttempt] = useState(0);
  const loaded = useCallback(() => setRendering(false), []);
  const failed = useCallback((message: string) => { setError(message); setRendering(false); }, []);
  useEffect(() => {
    const controller = new AbortController(); setDocument(null); setError(""); setRendering(true);
    void loadBlogDocument(attachment, api.getOrigin(), api.transport.fetch, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDocument(result); })
      .catch(error => { if (!controller.signal.aborted) failed(error.message || "Không thể xem trước tài liệu."); });
    return () => controller.abort();
  }, [attachment, attempt, failed]);
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f1f5f9" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "white" }}>
        <Text numberOfLines={2} style={{ flex: 1, fontWeight: "600", color: "#0f172a" }}>{attachment.name}</Text>
        <Pressable accessibilityLabel="Đóng xem trước tài liệu" onPress={onClose} hitSlop={10}><Text style={{ color: "#4f46e5" }}>Đóng</Text></Pressable>
      </View>
      {error ? <View style={{ padding: 24, gap: 16 }}>
        <Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text>
        <Pressable onPress={() => setAttempt(value => value + 1)}><Text style={{ color: "#4f46e5" }}>Thử lại</Text></Pressable>
      </View> : <>
        {rendering && <View style={{ padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}><ActivityIndicator /><Text>Đang mở tài liệu…</Text></View>}
        {document && (["xls", "xlsx"].includes(document.extension)
          ? <ExcelDocumentPreview key={attempt} document={document} onError={failed} onLoaded={loaded} />
          : <DocumentPreviewFrame key={attempt} document={document} onError={failed} onLoaded={loaded} />)}
      </>}
    </SafeAreaView>
  </Modal>;
}
