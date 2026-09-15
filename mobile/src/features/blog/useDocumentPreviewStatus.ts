import { useCallback, useEffect, useRef } from "react";
import type { PreviewDocument } from "./documentPreview";

export function useDocumentPreviewStatus(document: PreviewDocument, onLoaded: () => void, onError: (message: string) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; }, []);
  useEffect(() => {
    timer.current = setTimeout(() => onError("Không mở được tài liệu trong thời gian chờ. Vui lòng thử lại."), 45000);
    return clear;
  }, [document, onError, clear]);
  const loaded = useCallback(() => { clear(); onLoaded(); }, [clear, onLoaded]);
  const failed = useCallback((message: string) => { clear(); onError(message); }, [clear, onError]);
  return { loaded, failed };
}
