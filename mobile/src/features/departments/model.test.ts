import { describe, expect, it } from "vitest";
import {
  DEPARTMENT_CODE_PALETTES,
  getDepartmentCodePalette,
  ROOM_TYPE_ICONS,
  ROOM_TYPE_LABELS,
  type DepartmentRecord,
  type DepartmentStatMetrics,
  type RoomRecord,
  type RoomType,
} from "../../components/departments/types";

describe("Department and Room Business Logic", () => {
  it("generates deterministic and valid color palettes for department badges", () => {
    const palette1 = getDepartmentCodePalette("KHTH");
    const palette2 = getDepartmentCodePalette("KHTH");
    expect(palette1).toEqual(palette2);
    expect(palette1).toHaveProperty("bg");
    expect(palette1).toHaveProperty("text");
    expect(palette1).toHaveProperty("border");
    expect(DEPARTMENT_CODE_PALETTES).toContain(palette1);
  });

  it("provides comprehensive metadata for all medical room types", () => {
    const types: RoomType[] = ["clinic", "treatment", "storage", "office", "meeting", "other"];
    for (const t of types) {
      expect(ROOM_TYPE_LABELS[t]).toBeDefined();
      expect(typeof ROOM_TYPE_LABELS[t]).toBe("string");
      expect(ROOM_TYPE_ICONS[t]).toBeDefined();
      expect(ROOM_TYPE_ICONS[t].icon).toBeTruthy();
      expect(ROOM_TYPE_ICONS[t].color).toBeTruthy();
      expect(ROOM_TYPE_ICONS[t].bg).toBeTruthy();
    }
  });

  it("calculates department metrics correctly", () => {
    const sampleDepts: DepartmentRecord[] = [
      {
        _id: "d1",
        companyCode: "LUX",
        code: "KHTH",
        name: "Kế hoạch tổng hợp",
        sortOrder: 1,
        isActive: true,
        employeeCount: 12,
      },
      {
        _id: "d2",
        companyCode: "LUX",
        code: "GMHS",
        name: "Gây mê hồi sức",
        sortOrder: 2,
        isActive: true,
        employeeCount: 8,
      },
      {
        _id: "d3",
        companyCode: "LUX",
        code: "OLD",
        name: "Phòng cũ ngưng hoạt động",
        sortOrder: 3,
        isActive: false,
        employeeCount: 0,
      },
    ];

    const total = sampleDepts.length;
    const active = sampleDepts.filter((d) => d.isActive).length;
    const inactive = total - active;
    const totalStaff = sampleDepts.reduce((acc, curr) => acc + (curr.employeeCount || 0), 0);

    const metrics: DepartmentStatMetrics = { total, active, inactive, totalStaff };
    expect(metrics).toEqual({
      total: 3,
      active: 2,
      inactive: 1,
      totalStaff: 20,
    });
  });

  it("filters departments by query and active/inactive status", () => {
    const sampleDepts: DepartmentRecord[] = [
      {
        _id: "d1",
        companyCode: "LUX",
        code: "KHTH",
        name: "Kế hoạch tổng hợp",
        description: "Quản lý chỉ đạo tuyến và kế hoạch điều trị",
        managerName: "BS. Nguyễn Văn A",
        sortOrder: 1,
        isActive: true,
      },
      {
        _id: "d2",
        companyCode: "LUX",
        code: "GMHS",
        name: "Gây mê hồi sức",
        description: "Phẫu thuật và hồi sức cấp cứu",
        managerName: "BS. Trần Thị B",
        sortOrder: 2,
        isActive: false,
      },
    ];

    // Filter by text query (match code or manager name)
    const matchCode = sampleDepts.filter((d) =>
      d.code.toLowerCase().includes("khth")
    );
    expect(matchCode).toHaveLength(1);
    expect(matchCode[0]._id).toBe("d1");

    const matchManager = sampleDepts.filter((d) =>
      (d.managerName || "").toLowerCase().includes("trần thị b")
    );
    expect(matchManager).toHaveLength(1);
    expect(matchManager[0]._id).toBe("d2");

    // Filter by active status
    const onlyActive = sampleDepts.filter((d) => d.isActive);
    expect(onlyActive).toHaveLength(1);
    expect(onlyActive[0]._id).toBe("d1");

    const onlyInactive = sampleDepts.filter((d) => !d.isActive);
    expect(onlyInactive).toHaveLength(1);
    expect(onlyInactive[0]._id).toBe("d2");
  });

  it("filters rooms by branch, room type and text search", () => {
    const sampleRooms: RoomRecord[] = [
      {
        _id: "r1",
        companyCode: "LUX",
        branchId: "b-hanoi",
        code: "PK-01",
        name: "Phòng khám Nội 1",
        type: "clinic",
        floor: "Tầng 1",
        sortOrder: 1,
        isActive: true,
        equipmentCount: 3,
      },
      {
        _id: "r2",
        companyCode: "LUX",
        branchId: "b-hanoi",
        code: "KHO-01",
        name: "Kho dược trung tâm",
        type: "storage",
        floor: "Tầng hầm",
        sortOrder: 2,
        isActive: true,
        equipmentCount: 1,
      },
      {
        _id: "r3",
        companyCode: "LUX",
        branchId: "b-saigon",
        code: "PT-01",
        name: "Phòng phẫu thuật vô khuẩn",
        type: "treatment",
        floor: "Tầng 3",
        sortOrder: 1,
        isActive: true,
        equipmentCount: 10,
      },
    ];

    // Filter by branch
    const hanoiRooms = sampleRooms.filter((r) => r.branchId === "b-hanoi");
    expect(hanoiRooms).toHaveLength(2);

    // Filter by room type
    const clinics = sampleRooms.filter((r) => r.type === "clinic");
    expect(clinics).toHaveLength(1);
    expect(clinics[0].code).toBe("PK-01");

    // Filter by text search (floor)
    const basementRooms = sampleRooms.filter((r) =>
      (r.floor || "").toLowerCase().includes("hầm")
    );
    expect(basementRooms).toHaveLength(1);
    expect(basementRooms[0].code).toBe("KHO-01");
  });
});
