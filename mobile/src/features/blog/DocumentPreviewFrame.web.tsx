import React, { useLayoutEffect, useMemo, useRef } from "react";
import type { PreviewDocument } from "./documentPreview";
import { createDocumentPreviewHtml } from "./documentPreviewHtml";
import { useDocumentPreviewStatus } from "./useDocumentPreviewStatus";

type Props = { document: PreviewDocument; onError: (message: string) => void; onLoaded: () => void };
export function DocumentPreviewFrame({ document, onError, onLoaded }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => createDocumentPreviewHtml(document), [document]);
  const { loaded, failed } = useDocumentPreviewStatus(document, onLoaded, onError);
  useLayoutEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || event.origin !== "null") return;
      if (event.data?.type === "loaded") loaded();
      if (event.data?.type === "error") failed(String(event.data.message || "Không thể xem tài liệu."));
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [loaded, failed]);
  return <iframe ref={ref} srcDoc={html} title={document.name} sandbox="allow-scripts"
    onError={() => failed("Không mở được trình xem tài liệu. Vui lòng thử lại.")}
    style={{ width: "100%", height: "100%", border: 0, flex: 1 }} />;
}
