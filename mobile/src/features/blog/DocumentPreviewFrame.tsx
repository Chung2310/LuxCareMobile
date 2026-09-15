import React, { useMemo } from "react";
import { WebView } from "react-native-webview";
import type { PreviewDocument } from "./documentPreview";
import { createDocumentPreviewHtml, isLocalPreviewNavigation } from "./documentPreviewHtml";
import { useDocumentPreviewStatus } from "./useDocumentPreviewStatus";

export type PreviewFrameProps = { document: PreviewDocument; onError: (message: string) => void; onLoaded: () => void };
export function DocumentPreviewFrame({ document, onError, onLoaded }: PreviewFrameProps) {
  const source = useMemo(() => ({ html: createDocumentPreviewHtml(document) }), [document]);
  const { loaded, failed } = useDocumentPreviewStatus(document, onLoaded, onError);
  return <WebView source={source} style={{ flex: 1 }} originWhitelist={["*"]}
    cacheEnabled={false} incognito allowFileAccess={false} allowFileAccessFromFileURLs={false}
    allowUniversalAccessFromFileURLs={false} mixedContentMode="never"
    javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={request => isLocalPreviewNavigation(request.url)}
    onError={() => failed("Không mở được trình xem tài liệu. Vui lòng thử lại.")}
    onRenderProcessGone={() => failed("Trình xem tài liệu đã dừng. Vui lòng thử lại.")}
    onContentProcessDidTerminate={() => failed("Trình xem tài liệu đã dừng. Vui lòng thử lại.")}
    onMessage={event => {
      if (!isLocalPreviewNavigation(event.nativeEvent.url)) return;
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.type === "loaded") loaded();
        if (message.type === "error") failed(String(message.message || "Không thể xem tài liệu."));
      } catch { /* Ignore unrelated messages. */ }
    }} />;
}
