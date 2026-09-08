import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { Extension } from "../../../../src/types/hrContract";
import { getExtensionFiles, getExtensionSignedImages } from "../../../../src/services/hrContractFiles";
import { contracts } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Loading, styles } from "../../ui";
import { contractDate } from "./model";
import { ContractFiles } from "./ContractFiles";
export function ExtensionHistory({
  companyCode,
  branchId,
  contractId,
}: {
  companyCode: string;
  branchId?: string;
  contractId: string;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Extension[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRows([]);
      setLoading(true);
      setError(null);
      void contracts
        .extensions({ companyCode, branchId, contractId, page, limit: 10 })
        .then((result) => {
          if (active) {
            setRows(result.data);
            setTotalPages(result.pagination.totalPages);
          }
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [companyCode, branchId, contractId, page, revision]),
  );
  return (
    <>
      <Text style={styles.heading}>Lịch sử gia hạn</Text>
      {loading && <Loading />}
      <ErrorText message={error} />
      {!!error && <Button title="Tải lại lịch sử" onPress={() => setRevision((value) => value + 1)} />}
      {!loading && !error && !rows.length && <Text style={styles.muted}>Chưa có gia hạn.</Text>}
      {rows.map((item) => (
        <Card key={item._id}>
          <Text style={styles.heading}>Gia hạn ngày {contractDate(item.extensionDate)}</Text>
          <Text style={styles.text}>
            {contractDate(item.previousEndDate)} → {contractDate(item.newEndDate)}
          </Text>
          <Text style={styles.text}>{item.reason || "Không có lý do bổ sung"}</Text>
          <ContractFiles title="Tệp gia hạn" files={getExtensionFiles(item)} />
          <ContractFiles title="Ảnh phụ lục đã ký" files={getExtensionSignedImages(item)} />
        </Card>
      ))}
      {!loading && !error && totalPages > 1 && (
        <>
          <Text style={styles.muted}>
            Trang {page}/{totalPages}
          </Text>
          <Button title="Gia hạn trước" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
          <Button title="Gia hạn tiếp" disabled={page >= totalPages} onPress={() => setPage((value) => value + 1)} />
        </>
      )}
    </>
  );
}
