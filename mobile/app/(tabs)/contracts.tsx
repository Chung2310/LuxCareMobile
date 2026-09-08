import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Contract, Employee } from "../../../src/types/hrContract";
import { ContractForm } from "../../src/features/contracts/ContractForm";
import { ExtensionForm } from "../../src/features/contracts/ExtensionForm";
import type { ContractList } from "../../../src/services/hrContractService";
import { getContractFiles, getSignedImages } from "../../../src/services/hrContractFiles";
import { contracts } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import {
  canManageContracts,
  canReadContracts,
  contractDate,
  contractStatuses,
} from "../../src/features/contracts/model";
import { ContractFiles } from "../../src/features/contracts/ContractFiles";
import { ExtensionHistory } from "../../src/features/contracts/ExtensionHistory";
import { EmployeeFilter } from "../../src/features/contracts/EmployeeFilter";
import { ALL_EMPLOYEES } from "../../src/features/contracts/employeeFilterModel";

export default function Contracts() {
  const { user, selectedBranch } = useSession();
  const allowed = canReadContracts(user);
  const manage = canManageContracts(user);
  const [editing, setEditing] = useState<{ contract?: Contract; employees: Employee[]; extension?: boolean } | null>(
    null,
  );
  const formLock = useRef(false);
  const closeForm = () => {
    if (formLock.current) return;
    setEditing(null);
    setRevision((value) => value + 1);
  };
  const branchId = selectedBranch?._id || user?.branchId || undefined;
  const [data, setData] = useState<ContractList | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState(ALL_EMPLOYEES);
  const [filterRevision, setFilterRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [expiring, setExpiring] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setData(null);
      setExpanded(null);
      setError(null);
      setLoading(false);
      if (!allowed || !user?.companyCode) return;
      setLoading(true);
      void contracts
        .list({ companyCode: user.companyCode, branchId, page, limit: 10, search, employeeId: employee.value })
        .then((result) => {
          if (active) setData(result);
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
    }, [allowed, user?.companyCode, user?.uid, branchId, page, search, employee.value, revision]),
  );
  if (!allowed)
    return (
      <Page title="Hợp đồng nhân sự">
        <Text style={styles.text}>Cần quyền xem nhân sự và phân hệ nhân sự của doanh nghiệp.</Text>
      </Page>
    );
  const rows = data ? (expiring ? data.expiringContracts : data.contracts) : [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <>
      <Page title="Hợp đồng nhân sự">
        {manage && (
          <Button
            title="Tạo hợp đồng"
            disabled={loading || !!error || !data}
            onPress={() => setEditing({ employees: data!.employees })}
          />
        )}
        <Text style={styles.muted}>
          Phạm vi: {selectedBranch?.name || (branchId ? "Chi nhánh của bạn" : "Doanh nghiệp")}. Tài khoản nhân viên chỉ
          xem hợp đồng của mình theo quyền API.
        </Text>
        <Button
          title={
            expiring
              ? "Xem danh sách hợp đồng"
              : `Sắp hết hạn trong 20 ngày${data ? ` (${data.expiringContracts.length})` : ""}`
          }
          onPress={() => {
            setExpiring((value) => !value);
            setExpanded(null);
          }}
        />
        {expiring ? (
          <Text style={styles.muted}>
            Các hợp đồng đang hiệu lực sắp hết hạn theo chi nhánh và nhân viên đang chọn, không phụ thuộc từ khóa hoặc
            trang danh sách.
          </Text>
        ) : (
          <>
            <Field label="Tìm tên nhân viên hoặc loại hợp đồng" value={draft} onChangeText={setDraft} />
            <Button
              title="Tìm kiếm"
              disabled={loading}
              onPress={() => {
                setPage(1);
                setSearch(draft.trim());
                setRevision((value) => value + 1);
              }}
            />
          </>
        )}
        <EmployeeFilter
          key={filterRevision}
          employees={data?.employees || []}
          value={employee}
          disabled={loading || !data || !!error}
          onChange={(value) => {
            setEmployee(value);
            setPage(1);
          }}
        />
        <Button
          title="Đặt lại bộ lọc"
          disabled={loading}
          onPress={() => {
            setEmployee(ALL_EMPLOYEES);
            setDraft("");
            setSearch("");
            setExpiring(false);
            setPage(1);
            setFilterRevision((value) => value + 1);
            setRevision((value) => value + 1);
          }}
        />
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
        {loading && <Loading />}
        <ErrorText message={error} />
        {!loading && !error && !rows.length && <Text style={styles.muted}>Không có hợp đồng phù hợp.</Text>}
        {rows.map((item) => (
          <Card key={item._id}>
            <Text style={styles.heading}>{item.employeeName}</Text>
            <Text style={styles.text}>{item.contractType}</Text>
            <Text style={styles.muted}>
              {contractStatuses[item.status] || item.status} · {contractDate(item.startDate)} →{" "}
              {contractDate(item.endDate)}
            </Text>
            <Button
              title={expanded === item._id ? "Thu gọn" : "Chi tiết và gia hạn"}
              onPress={() => setExpanded((current) => (current === item._id ? null : item._id))}
            />
            {expanded === item._id && (
              <>
                <Text style={styles.text}>{item.note || "Không có ghi chú"}</Text>
                {manage && (
                  <Button
                    title="Tạo gia hạn"
                    onPress={() => setEditing({ contract: item, employees: [], extension: true })}
                  />
                )}
                {manage && (
                  <Button
                    title="Sửa hợp đồng"
                    onPress={() => setEditing({ contract: item, employees: data!.employees })}
                  />
                )}
                <ContractFiles title="Tệp hợp đồng" files={getContractFiles(item)} />
                <ContractFiles title="Ảnh đã ký" files={getSignedImages(item)} />
                <Text style={styles.muted}>
                  Tải tối đa 20 MB mỗi tệp. Chọn ứng dụng đọc tài liệu hoặc lưu tệp trong bảng chia sẻ của thiết bị.
                </Text>
                <ExtensionHistory
                  key={item._id}
                  companyCode={user!.companyCode!}
                  branchId={branchId}
                  contractId={item._id}
                />
              </>
            )}
          </Card>
        ))}
        {!expiring && data && !loading && !error && (
          <>
            <Text style={styles.muted}>
              {data.total} hợp đồng · Trang {page}/{totalPages}
            </Text>
            <Button title="Trang trước" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
            <Button title="Trang sau" disabled={page >= totalPages} onPress={() => setPage((value) => value + 1)} />
          </>
        )}
      </Page>
      <Modal visible={!!editing && manage} animationType="slide" onRequestClose={closeForm}>
        <SafeAreaView style={styles.page}>
          {editing &&
            manage &&
            (editing.extension && editing.contract ? (
              <ExtensionForm
                contract={editing.contract}
                scope={{ companyCode: user!.companyCode!, branchId }}
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setRevision((value) => value + 1);
                }}
              />
            ) : (
              <ContractForm
                contract={editing.contract}
                employees={editing.employees}
                scope={{ companyCode: user!.companyCode!, branchId }}
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setRevision((value) => value + 1);
                }}
              />
            ))}
        </SafeAreaView>
      </Modal>
    </>
  );
}
