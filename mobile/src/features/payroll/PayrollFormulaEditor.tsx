import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { payroll } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import {
  AdjustmentAction as Action,
  adjustmentStyles as s,
} from "./adjustmentUi";
import {
  canManageFormulas,
  fundLabels,
  parsePolicies,
  type PayrollPolicyVersion,
} from "./formulaModel";
import {
  createDefaultPayrollPolicyForm,
  payrollPolicyFormToDefinition,
  policyDefinitionToForm,
  validatePayrollPolicyForm,
  validatePayrollPolicyStep,
  type PayrollPolicyForm,
  type FundCode,
} from "./payrollPolicyForm";
export function canCorrectPolicySaveError(error: unknown) {
  const failure = error as { status?: number; code?: string } | null;
  return failure?.status === 400 || failure?.status === 422 || failure?.code === "PAYROLL_POLICY_DUPLICATE";
}
const steps = ["Thông tin", "Bảo hiểm", "Thuế TNCN", "Tăng ca", "Xem lại"];
function Numeric({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [raw, setRaw] = useState(Number.isFinite(value) ? String(value) : "");
  return (
    <Field
      label={label}
      value={raw}
      editable={!disabled}
      keyboardType="decimal-pad"
      onChangeText={(text) => {
        setRaw(text);
        onChange(text.trim() ? Number(text.replace(",", ".")) : NaN);
      }}
    />
  );
}
function initialForm(
  initial: PayrollPolicyVersion | undefined,
  mode: string,
): PayrollPolicyForm {
  const form = initial
    ? policyDefinitionToForm(initial)
    : createDefaultPayrollPolicyForm();
  if (!initial) {
    for (const key of [
      "baseSalary",
      "regionalMinimumWage",
      "personalDeduction",
      "dependentDeduction",
      "shortTermWithholdingRate",
      "shortTermWithholdingThreshold",
      "nonResidentRate",
    ] as const)
      form[key] = NaN;
    for (const fund of Object.values(form.funds)) {
      fund.employeeRate = NaN;
      fund.employerRate = NaN;
    }
    form.taxBrackets = [{ upTo: "", rate: NaN }];
  }
  if (mode !== "edit") {
    form.code = mode === "clone" ? (initial?.code || "") + "-copy" : "";
    form.name = mode === "clone" ? (initial?.name || "") + " - Bản sao" : "";
    form.effectiveFrom = new Date().toISOString().slice(0, 10);
    form.effectiveTo = "";
  }
  return form;
}
export function PayrollFormulaEditor({
  initial,
  mode,
  existing,
  onClose,
  onSaved,
  setLocked,
}: {
  initial?: PayrollPolicyVersion;
  mode: "create" | "edit" | "clone";
  existing: PayrollPolicyVersion[];
  onClose: () => void;
  onSaved: (item: PayrollPolicyVersion) => void;
  setLocked: (busy: boolean) => void;
}) {
  const { user } = useSession();
  const [form, setForm] = useState(() => initialForm(initial, mode));
  const [step, setStep] = useState(0),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const attempted = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const allowed =
    canManageFormulas(user) &&
    (mode !== "edit" ||
      initial?.status === "draft" ||
      initial?.status === "active");
  const disabled = busy || attempted.current || !allowed;
  const set = <K extends keyof PayrollPolicyForm>(
    key: K,
    value: PayrollPolicyForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const number = (
    label: string,
    value: number,
    onChange: (value: number) => void,
  ) => (
    <Numeric
      key={label}
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
  const validate = (all = false) => {
    const found = all
      ? validatePayrollPolicyForm(form)
      : validatePayrollPolicyStep(form, step);
    if (
      (all || step === 0) &&
      existing.some(
        (item) =>
          item.code === form.code.trim() &&
          (mode !== "edit" || item._id !== initial?._id),
      )
    )
      found.code = "Mã phiên bản đã tồn tại.";
    if (
      (all || step === 0) &&
      mode === "edit" &&
      initial?.effectiveTo &&
      !form.effectiveTo
    )
      found.effectiveTo =
        "Giữ ngày kết thúc của phiên bản này hoặc tạo phiên bản mới không giới hạn thời gian.";
    if (Object.keys(found).length) {
      setError(Object.values(found).join("\n"));
      return false;
    }
    setError(null);
    return true;
  };
  const save = async () => {
    if (disabled || step !== 4 || !validate(true)) return;
    attempted.current = true;
    setBusy(true);
    setLocked(true);
    try {
      const definition = payrollPolicyFormToDefinition(form);
      const response =
        mode === "edit" && initial
          ? await payroll.updatePolicy(initial._id, {
              ...definition,
              expectedVersion: initial.version,
            })
          : mode === "clone" && initial
            ? await payroll.clonePolicy(initial._id, {
                code: definition.code,
                name: definition.name,
                definition,
              })
            : await payroll.createPolicy(definition);
      const saved = parsePolicies([response], user!.companyCode!)[0];
      if (
        saved.code !== definition.code ||
        saved.name !== definition.name ||
        (mode === "edit" &&
          (saved._id !== initial?._id || saved.version !== initial.version + 1))
      )
        throw Error(
          "Chưa xác nhận được phiên bản đã lưu. Đóng và tải lại danh sách.",
        );
      if (mounted.current) onSaved(saved);
    } catch (err) {
      if (mounted.current) {
        const canCorrect = canCorrectPolicySaveError(err);
        if (canCorrect) attempted.current = false;
        setError(messageOf(err) + (canCorrect
          ? " Bạn có thể quay lại bước trước để sửa và lưu lại."
          : " Đóng và tải lại trước khi lưu tiếp."));
      }
    } finally {
      setLocked(false);
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Page
      title={
        mode === "edit"
          ? "Sửa phiên bản công thức"
          : mode === "clone"
            ? "Nhân bản công thức"
            : "Tạo phiên bản công thức"
      }
      onBack={() => {
        if (!busy) onClose();
      }}
    >
      <Text style={styles.muted}>
        {mode === "edit"
          ? "Cấu hình thuế, bảo hiểm và tăng ca của phiên bản này."
          : initial
            ? "Thông số được lấy từ phiên bản “" +
              initial.name +
              "”. Kiểm tra và điều chỉnh trước khi lưu."
            : "Nhập cấu hình thuế, bảo hiểm áp dụng cho công ty."}
      </Text>
      <View style={s.tabs}>
        {steps.map((label, index) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{
              selected: step === index,
              disabled: disabled || index > step,
            }}
            disabled={disabled || index > step}
            onPress={() => {
              setStep(index);
              setError(null);
            }}
            style={[s.tab, step === index && s.tabActive]}
          >
            <Text style={[s.tabText, step === index && s.activeText]}>
              {index + 1}. {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {step === 0 && (
        <Card>
          <Text style={styles.heading}>Thông tin & thời gian hiệu lực</Text>
          <Field
            label="Mã phiên bản"
            value={form.code}
            onChangeText={(value) => set("code", value)}
            autoCapitalize="none"
            editable={!disabled}
          />
          <Field
            label="Tên phiên bản"
            value={form.name}
            onChangeText={(value) => set("name", value)}
            editable={!disabled}
          />
          <Field
            label="Hiệu lực từ (YYYY-MM-DD)"
            value={form.effectiveFrom}
            onChangeText={(value) => set("effectiveFrom", value)}
            editable={!disabled}
          />
          <Field
            label="Hiệu lực đến (không bắt buộc)"
            value={form.effectiveTo}
            onChangeText={(value) => set("effectiveTo", value)}
            placeholder="YYYY-MM-DD"
            editable={!disabled}
          />
          <Field
            label="Căn cứ / ghi chú"
            value={form.sourceReference}
            onChangeText={(value) => set("sourceReference", value)}
            multiline
            editable={!disabled}
          />
          {number("Mức lương cơ sở (VND)", form.baseSalary, (value) =>
            set("baseSalary", value),
          )}
          {number(
            "Lương tối thiểu vùng (VND)",
            form.regionalMinimumWage,
            (value) => set("regionalMinimumWage", value),
          )}
          {number("Hệ số trần BHXH / BHYT", form.socialCapMultiplier, (value) =>
            set("socialCapMultiplier", value),
          )}
          {number("Hệ số trần BHTN", form.unemploymentCapMultiplier, (value) =>
            set("unemploymentCapMultiplier", value),
          )}
        </Card>
      )}
      {step === 1 && (
        <>
          <Text style={styles.muted}>
            Nhập tỷ lệ %, ví dụ 1,5 cho 1,5%. Tách riêng phần người lao động và
            doanh nghiệp đóng.
          </Text>
          {(Object.keys(fundLabels) as FundCode[]).map((code) => (
            <Card key={code}>
              <Text style={styles.heading}>{fundLabels[code]}</Text>
              {number(
                "Người lao động đóng (%)",
                form.funds[code].employeeRate,
                (value) =>
                  set("funds", {
                    ...form.funds,
                    [code]: { ...form.funds[code], employeeRate: value },
                  }),
              )}
              {number(
                "Doanh nghiệp đóng (%)",
                form.funds[code].employerRate,
                (value) =>
                  set("funds", {
                    ...form.funds,
                    [code]: { ...form.funds[code], employerRate: value },
                  }),
              )}
              <ChoiceField
                label="Căn cứ tính trần"
                value={form.funds[code].capBasis}
                disabled={disabled}
                choices={[
                  { value: "baseSalary", label: "Mức lương cơ sở" },
                  { value: "regionalMinimum", label: "Lương tối thiểu vùng" },
                  { value: "none", label: "Không áp dụng trần" },
                ]}
                onChange={(value) =>
                  set("funds", {
                    ...form.funds,
                    [code]: {
                      ...form.funds[code],
                      capBasis: value as
                        "baseSalary" | "regionalMinimum" | "none",
                    },
                  })
                }
              />
            </Card>
          ))}
        </>
      )}
      {step === 2 && (
        <>
          <Card>
            <Text style={styles.heading}>Thuế TNCN & giảm trừ</Text>
            {number(
              "Giảm trừ bản thân (VND/tháng)",
              form.personalDeduction,
              (value) => set("personalDeduction", value),
            )}
            {number(
              "Giảm trừ mỗi người phụ thuộc (VND/tháng)",
              form.dependentDeduction,
              (value) => set("dependentDeduction", value),
            )}
            {number(
              "Khấu trừ hợp đồng ngắn hạn (%)",
              form.shortTermWithholdingRate,
              (value) => set("shortTermWithholdingRate", value),
            )}
            {number(
              "Ngưỡng khấu trừ ngắn hạn (VND)",
              form.shortTermWithholdingThreshold,
              (value) => set("shortTermWithholdingThreshold", value),
            )}
            {number(
              "Thuế người không cư trú (%)",
              form.nonResidentRate,
              (value) => set("nonResidentRate", value),
            )}
          </Card>
          <Text style={styles.heading}>Biểu thuế lũy tiến</Text>
          <Text style={styles.muted}>
            Các ngưỡng thu nhập tính thuế tăng dần. Bậc cuối không giới hạn.
          </Text>
          {form.taxBrackets.map((bracket, index) => (
            <Card key={index + ":" + form.taxBrackets.length}>
              <Text style={styles.heading}>Bậc {index + 1}</Text>
              {index === form.taxBrackets.length - 1 ? (
                <Text style={styles.muted}>
                  Phần thu nhập còn lại · Không giới hạn
                </Text>
              ) : (
                <Field
                  label="Thu nhập tính thuế đến (VND/tháng)"
                  value={bracket.upTo}
                  keyboardType="numeric"
                  editable={!disabled}
                  onChangeText={(upTo) =>
                    set(
                      "taxBrackets",
                      form.taxBrackets.map((item, i) =>
                        i === index ? { ...item, upTo } : item,
                      ),
                    )
                  }
                />
              )}
              {number("Thuế suất (%)", bracket.rate, (rate) =>
                set(
                  "taxBrackets",
                  form.taxBrackets.map((item, i) =>
                    i === index ? { ...item, rate } : item,
                  ),
                ),
              )}
              {index < form.taxBrackets.length - 1 && (
                <Action
                  title="Xóa bậc thuế"
                  tone="danger"
                  disabled={disabled}
                  onPress={() =>
                    set(
                      "taxBrackets",
                      form.taxBrackets.filter((_, i) => i !== index),
                    )
                  }
                />
              )}
            </Card>
          ))}
          <Action
            title="+ Thêm bậc thuế"
            tone="secondary"
            disabled={disabled}
            onPress={() =>
              set("taxBrackets", [
                ...form.taxBrackets.slice(0, -1),
                { upTo: "", rate: NaN },
                form.taxBrackets[form.taxBrackets.length - 1],
              ])
            }
          />
        </>
      )}
      {step === 3 && (
        <Card>
          <Text style={styles.heading}>Tăng ca & làm tròn</Text>
          <Text style={styles.muted}>
            Nhập hệ số, ví dụ 1,5 tương ứng 150%; phụ trội 0,3 tương ứng 30%.
          </Text>
          {(
            [
              ["weekday", "Tăng ca ngày thường"],
              ["restDay", "Tăng ca ngày nghỉ"],
              ["holiday", "Tăng ca ngày lễ"],
              ["nightPremium", "Phụ trội ban đêm"],
              ["nightOvertimeBonus", "Phụ trội tăng ca ban đêm"],
            ] as const
          ).map(([key, label]) =>
            number(label, form.overtime[key], (value) =>
              set("overtime", { ...form.overtime, [key]: value }),
            ),
          )}
          {number("Đơn vị làm tròn (VND)", form.roundingUnit, (value) =>
            set("roundingUnit", value),
          )}
        </Card>
      )}
      {step === 4 && (
        <>
          <Card>
            <Text style={styles.heading}>{form.name}</Text>
            <Text style={styles.muted}>
              {form.code} · {form.effectiveFrom} →{" "}
              {form.effectiveTo || "Không giới hạn"}
            </Text>
            {(Object.keys(fundLabels) as FundCode[]).map((code) => (
              <Text key={code} style={styles.text}>
                {fundLabels[code]}: NLĐ {form.funds[code].employeeRate}% · DN{" "}
                {form.funds[code].employerRate}%
              </Text>
            ))}
            <Text style={styles.text}>
              Giảm trừ: {form.personalDeduction.toLocaleString("vi-VN")} đ / bản
              thân · {form.dependentDeduction.toLocaleString("vi-VN")} đ / người
              phụ thuộc
            </Text>
            <Text style={styles.text}>
              {form.taxBrackets.length} bậc thuế:{" "}
              {form.taxBrackets.map((item) => item.rate + "%").join(" · ")}
            </Text>
          </Card>
          <Text style={styles.muted}>
            {mode === "edit" && initial?.status === "active"
              ? "Bạn đang sửa phiên bản đang áp dụng. Lưu cấu hình không tự tính lại bảng lương; hãy tính lại kỳ nháp sau khi kiểm tra."
              : "Phiên bản mới được lưu nháp. Chọn Áp dụng khi muốn sử dụng cấu hình này để tính lương."}
          </Text>
        </>
      )}
      <ErrorText message={error} />
      {step < 4 ? (
        <Action
          title="Tiếp tục"
          disabled={disabled}
          onPress={() => {
            if (validate()) setStep((value) => value + 1);
          }}
        />
      ) : (
        <Action
          title={busy ? "Đang lưu…" : "Lưu phiên bản công thức"}
          disabled={disabled}
          onPress={() => void save()}
        />
      )}
      {step > 0 && !attempted.current && (
        <Action
          title="Bước trước"
          tone="secondary"
          disabled={busy}
          onPress={() => {
            setStep((value) => value - 1);
            setError(null);
          }}
        />
      )}
      <Action
        title={attempted.current ? "Đóng và tải lại" : "Hủy"}
        tone="secondary"
        disabled={busy}
        onPress={onClose}
      />
    </Page>
  );
}
