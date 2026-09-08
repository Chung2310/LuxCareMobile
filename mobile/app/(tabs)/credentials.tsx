import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Credential } from "../../../src/types/hrCredential";
import { CredentialForm } from "../../src/features/credentials/CredentialForm";
import { DeleteCredentialForm } from "../../src/features/credentials/DeleteCredentialForm";
import { canManageCredentials } from "../../src/features/credentials/model";
import type { CredentialList } from "../../../src/services/hrCredentialService";
import type { HRCredentialStatus, HRCredentialType } from "../../../shared/hr-credential";
import { credentials } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { ContractFiles } from "../../src/features/contracts/ContractFiles";
import { contractDate } from "../../src/features/contracts/model";
import { canReadCredentials, credentialTypes, credentialStatuses } from "../../src/features/credentials/model";
export default function Credentials() {
  const { user, selectedBranch } = useSession();
  const allowed = canReadCredentials(user);
  const manage = canManageCredentials(user);
  const [editing, setEditing] = useState<{
    item?: Credential;
    employees: CredentialList["employees"];
    remove?: boolean;
  } | null>(null);
  const formLock = useRef(false);
  const branchId = selectedBranch?._id || user?.branchId || undefined;
  const [data, setData] = useState<CredentialList | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<HRCredentialStatus | "">("");
  const [type, setType] = useState<HRCredentialType | "">("");
  const [page, setPage] = useState(1);
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
      void credentials
        .list({ companyCode: user.companyCode, branchId, search, status, type, page, limit: 20 })
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
    }, [allowed, user?.companyCode, user?.uid, branchId, search, status, type, page, revision]),
  );
  if (!allowed)
    return (
      <Page title="Văn bằng & chứng chỉ">
        <Text style={styles.text}>Cần phân hệ nhân sự và quyền xem chứng chỉ hoặc nhân sự.</Text>
      </Page>
    );
  return (
    <>
      <Page title="Văn bằng & chứng chỉ">
        {manage && (
          <Button
            title="Thêm chứng chỉ"
            disabled={loading || !data || !!error}
            onPress={() =>
              setEditing({
                employees: data!.employees.filter((employee) => !branchId || employee.branchId === branchId),
              })
            }
          />
        )}
        <Text style={styles.muted}>
          Danh sách trong phạm vi API cho phép. Tài khoản nhân viên chỉ xem hồ sơ của mình.
        </Text>
        <Field label="Tìm nhân viên, chứng chỉ, số hiệu, nơi cấp" value={draft} onChangeText={setDraft} />
        <Button
          title="Tìm kiếm"
          disabled={loading}
          onPress={() => {
            setSearch(draft.trim());
            setPage(1);
            setRevision((value) => value + 1);
          }}
        />
        <ChoiceField
          label="Loại văn bằng"
          value={type}
          choices={[
            { value: "", label: "Tất cả" },
            ...Object.entries(credentialTypes).map(([value, label]) => ({ value: value as HRCredentialType, label })),
          ]}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
        />
        <ChoiceField
          label="Trạng thái"
          value={status}
          choices={[
            { value: "", label: "Tất cả" },
            ...Object.entries(credentialStatuses).map(([value, label]) => ({
              value: value as HRCredentialStatus,
              label,
            })),
          ]}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
        {loading && <Loading />}
        <ErrorText message={error} />
        {data && (
          <>
            <Text style={styles.muted}>
              Toàn phạm vi: {data.summary.total} hồ sơ · {data.summary.active} còn hiệu lực · {data.summary.expiring}{" "}
              sắp hết hạn · {data.summary.expired} hết hạn. Thống kê không giới hạn theo từ khóa/loại/trạng thái đang
              lọc.
            </Text>
            {!data.credentials.length && <Text style={styles.text}>Không có chứng chỉ phù hợp.</Text>}
            {data.credentials.map((item) => (
              <Card key={item._id}>
                <Text style={styles.heading}>{item.name}</Text>
                <Text style={styles.text}>
                  {item.employeeName} · {credentialTypes[item.type]}
                </Text>
                <Text style={styles.muted}>
                  {credentialStatuses[item.status]} · Hết hạn:{" "}
                  {item.expiryDate ? contractDate(item.expiryDate) : "Không thời hạn"}
                </Text>
                <Button
                  title={expanded === item._id ? "Thu gọn" : "Xem chi tiết"}
                  onPress={() => setExpanded((value) => (value === item._id ? null : item._id))}
                />
                {expanded === item._id && (
                  <>
                    {manage && (
                      <Button
                        title="Sửa chứng chỉ"
                        onPress={() =>
                          setEditing({
                            item,
                            employees: data.employees.filter((employee) => !branchId || employee.branchId === branchId),
                          })
                        }
                      />
                    )}
                    {manage && (
                      <Button title="Xóa chứng chỉ" onPress={() => setEditing({ item, employees: [], remove: true })} />
                    )}
                    <Text style={styles.text}>
                      Số hiệu: {item.credentialNumber || "—"}
                      {"\n"}Nơi cấp: {item.issuingOrganization}
                      {"\n"}Ngày cấp: {contractDate(item.issueDate)}
                      {"\n"}Phạm vi chuyên môn: {item.professionalScope || "—"}
                      {"\n"}Nhắc trước hạn: {item.reminderDays} ngày{"\n"}Ghi chú: {item.note || "—"}
                    </Text>
                    <ContractFiles
                      title="Tài liệu chứng chỉ"
                      files={
                        item.fileUrl
                          ? [
                              {
                                url: item.fileUrl,
                                name: item.fileName || "chung-chi",
                                size: item.fileSize,
                                mimeType: item.fileMimeType,
                                resourceId: item.resourceId,
                              },
                            ]
                          : []
                      }
                    />
                  </>
                )}
              </Card>
            ))}
            <Text style={styles.muted}>
              {data.total} kết quả · Trang {page}/{Math.max(1, Math.ceil(data.total / data.limit))}
            </Text>
            <Button title="Trang trước" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
            <Button
              title="Trang sau"
              disabled={page >= Math.ceil(data.total / data.limit)}
              onPress={() => setPage((value) => value + 1)}
            />
          </>
        )}
      </Page>
      <Modal
        visible={!!editing && manage}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) {
            if (editing?.remove) setPage(1);
            setEditing(null);
            setRevision((value) => value + 1);
          }
        }}
      >
        <SafeAreaView style={styles.page}>
          {editing &&
            manage &&
            (editing.remove && editing.item ? (
              <DeleteCredentialForm
                item={editing.item}
                companyCode={user!.companyCode!}
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setPage(1);
                  setRevision((value) => value + 1);
                }}
              />
            ) : (
              <CredentialForm
                item={editing.item}
                employees={editing.employees}
                companyCode={user!.companyCode!}
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
