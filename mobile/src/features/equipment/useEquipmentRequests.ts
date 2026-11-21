import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { equipment } from "../../api/services";
import type { EquipmentRequestRecord } from "../../../../src/types/equipment";

export function useEquipmentRequests(scope: string, revision: number) {
  const [requests, setRequests] = useState<EquipmentRequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const page = useRef(0);
  const busy = useRef(false);

  const loadPage = useCallback(async (next: number, current: number) => {
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await equipment.listRequests(next);
      if (current !== generation.current) return;
      setRequests(previous => next === 1 ? result.items : [...new Map([...previous, ...result.items].map(item => [item._id, item])).values()]);
      setTotal(result.total);
      page.current = next;
    } catch (err) {
      if (current === generation.current) setError(err instanceof Error ? err.message : "Không thể tải phiếu thiết bị.");
    } finally {
      if (current === generation.current) { busy.current = false; setLoading(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setRequests([]);
    setTotal(0);
    page.current = 0;
    void loadPage(1, ++generation.current);
    return () => { generation.current++; busy.current = false; };
  }, [scope, revision, loadPage]));

  const loadMore = () => {
    if (!busy.current) void loadPage(page.current + 1, generation.current);
  };
  return { requests, total, loading, error, loadMore, hasMore: page.current * 100 < total };
}
