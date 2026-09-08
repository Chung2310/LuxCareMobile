import { useState } from "react";
import type { Employee } from "../../../../src/types/hrContract";
import { Field } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { employeeFilterChoices, type EmployeeChoice } from "./employeeFilterModel";
export function EmployeeFilter({
  employees,
  value,
  onChange,
  disabled,
}: {
  employees: Employee[];
  value: EmployeeChoice;
  onChange: (value: EmployeeChoice) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const choices = employeeFilterChoices(employees, search, value);
  return (
    <>
      <Field label="Tìm người trong bộ lọc nhân viên" value={search} onChangeText={setSearch} editable={!disabled} />
      <ChoiceField
        label="Lọc theo nhân viên"
        value={value.value}
        choices={choices}
        disabled={disabled}
        onChange={(id) => {
          const choice = choices.find((item) => item.value === id);
          if (choice) onChange(choice);
        }}
      />
    </>
  );
}
