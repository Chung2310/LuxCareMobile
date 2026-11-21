import { describe, expect, it, vi } from "vitest";
import { createEquipmentService } from "../../../../src/services/equipmentService";
import { createDepartmentService } from "../../../../src/services/departmentService";

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe("equipment department API contract", () => {
  it("does not disguise a malformed successful response as an empty list", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ status: "success", unexpected: [] }));
    await expect(createEquipmentService({ fetch, getAccessToken: () => null }).list()).rejects.toThrow("không hợp lệ");
  });
  it("rejects an HTML login/proxy page instead of reporting that a device was saved", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("<html>Login</html>", { status: 200 }));
    await expect(createEquipmentService({ fetch, getAccessToken: () => null }).create({ name: "Máy" })).rejects.toThrow("không hợp lệ");
  });
  it("preserves the real backend's pagination total instead of replacing it with page length", async () => {
    const items = [{ _id: "one", departmentId: "dept" }];
    const fetch = vi.fn().mockResolvedValue(response({ status: "success", data: items, total: 125, page: 2, limit: 100 }));
    const result = await createEquipmentService({ fetch, getAccessToken: () => "token" }).list({ page: 2 });
    expect(result).toEqual({ items, total: 125 });
  });

  it.each([
    { data: { items: [{ _id: "one" }], total: 5 } },
    { items: [{ _id: "one" }], total: 5 },
  ])("also supports nested and unwrapped list envelopes", async body => {
    const fetch = vi.fn().mockResolvedValue(response(body));
    await expect(createEquipmentService({ fetch, getAccessToken: () => null }).list()).resolves.toEqual({ items: [{ _id: "one" }], total: 5 });
  });

  it("loads global counts from supported list queries rather than a nonexistent summary endpoint", async () => {
    const counts: Record<string, number> = { available: 125, requested: 2, "in-use": 3, maintenance: 4, retired: 5 };
    const fetch = vi.fn().mockImplementation(async input => {
      const url = new URL(input, "https://api.example");
      expect(url.pathname).toBe("/api/v1/equipment");
      expect(url.searchParams.get("limit")).toBe("1");
      return response({ data: [{ _id: "sample" }], total: counts[url.searchParams.get("status")!] });
    });
    await expect(createEquipmentService({ fetch, getAccessToken: () => "token" }).getSummary()).resolves.toMatchObject({
      total: 139, ready: 125, booked: 2, using: 3, maintenance: 4, disposed: 5,
    });
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("uses the supported compliance summary endpoint and maps dueSoon to the mobile label", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: { overdue: 1, dueSoon: 2, valid: 3, none: 4 } }));
    await expect(createEquipmentService({ fetch, getAccessToken: () => "token" }).getCompliance()).resolves.toEqual({ overdue: 1, upcoming: 2, valid: 3 });
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/equipment/compliance-summary");
  });

  it("filters on the server by departmentId alongside search and pagination, and clears it on reset", async () => {
    const fetch = vi.fn().mockImplementation(async () => response({ data: { items: [], total: 0 } }));
    const service = createEquipmentService({ fetch, getAccessToken: () => "token" });
    await service.list({ departmentId: "dept-id", search: "Máy soi", status: "available", category: "A&B", page: 2, limit: 20 });
    const query = new URL(fetch.mock.calls[0][0], "https://api.example").searchParams;
    expect(Object.fromEntries(query)).toEqual({ departmentId: "dept-id", search: "Máy soi", status: "available", category: "A&B", page: "2", limit: "20" });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
    await service.list({ departmentId: "", search: "", status: "all" });
    expect(Object.fromEntries(new URL(fetch.mock.calls[1][0], "https://api.example").searchParams)).toEqual({ limit: "100" });
  });

  it("creates an assignment by ID and uses the canonical name returned by the server", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: { _id: "equipment", departmentId: "dept", departmentName: "Tên chuẩn" } }, 201));
    const service = createEquipmentService({ fetch, getAccessToken: () => "token" });
    await expect(service.create({ name: "Máy soi", code: "MS", departmentId: "dept", departmentName: "Tên cũ", department: "Legacy" }))
      .resolves.toMatchObject({ departmentName: "Tên chuẩn" });
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: "Máy soi", code: "MS", departmentId: "dept" });
  });

  it.each(["next-department", null])("updates or clears the assignment with PATCH: %s", async departmentId => {
    const fetch = vi.fn().mockImplementation(async () => response({ data: { _id: "equipment", departmentId } }));
    const service = createEquipmentService({ fetch, getAccessToken: () => "token" });
    await service.update("equipment", { departmentId });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/equipment/equipment");
    expect(fetch.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ departmentId });
  });

  it("keeps an assignment unchanged when updating unrelated fields", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: { _id: "equipment" } }));
    await createEquipmentService({ fetch, getAccessToken: () => "token" }).update("equipment", { notes: "Ghi chú" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ notes: "Ghi chú" });
  });

  it.each([400, 403, 404, 500])("surfaces a rejected department update without issuing other mutations: HTTP %s", async status => {
    const fetch = vi.fn().mockImplementation(async () => response({ message: "Không thể gán phòng ban." }, status));
    const service = createEquipmentService({ fetch, getAccessToken: () => "token" });
    await expect(service.update("equipment", { departmentId: "wrong-company" })).rejects.toThrow("Không thể gán phòng ban.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("propagates a network failure instead of fabricating a saved device", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(createEquipmentService({ fetch, getAccessToken: () => "token" }).update("equipment", { departmentId: "dept" })).rejects.toThrow("offline");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows the backend's deletion restriction for a department with assigned equipment", async () => {
    const message = "Phòng ban đang gắn với 2 thiết bị. Vui lòng chuyển thiết bị sang phòng ban khác trước khi xóa.";
    const fetch = vi.fn().mockResolvedValue(response({ message }, 400));
    await expect(createDepartmentService({ fetch, getAccessToken: () => "token" }).delete("dept")).rejects.toThrow(message);
  });

  it("does not claim a blocked equipment deletion succeeded", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ message: "Thiết bị đang được sử dụng." }, 400));
    await expect(createEquipmentService({ fetch, getAccessToken: () => "token" }).delete("device")).rejects.toThrow("Thiết bị đang được sử dụng.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("equipment borrow/return API contract", () => {
  it("loads persisted requests with the real list envelope and pagination", async () => {
    const items = [{ _id: "request", employeeId: "user", requestType: "return", status: "pending" }];
    const fetch = vi.fn().mockResolvedValue(response({ status: "success", data: items, total: 125 }));
    await expect(createEquipmentService({ fetch, getAccessToken: () => "token" }).listRequests(2)).resolves.toEqual({ items, total: 125 });
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/equipment/borrow-requests?page=2&limit=100");
  });
  it("creates, approves, returns and cancels using workflow endpoints instead of editing device status", async () => {
    const fetch = vi.fn().mockImplementation(async () => response({ data: { _id: "request" } }));
    const service = createEquipmentService({ fetch, getAccessToken: () => "token" });
    await service.createBorrowRequest("device", { reason: "Điều trị", expectedReturnAt: "2026-12-01" });
    await service.decideRequest("request", "approved", "must not send rejection text");
    await service.createReturnRequest("device", { note: "Bàn giao đầy đủ" });
    await service.decideRequest("request", "rejected", "Cần kiểm tra lại");
    await service.cancelRequest("request");
    expect(fetch.mock.calls.map(([path, init]) => [path, init.method, init.body ? JSON.parse(init.body) : null])).toEqual([
      ["/api/v1/equipment/device/borrow-requests", "POST", { reason: "Điều trị", expectedReturnAt: "2026-12-01" }],
      ["/api/v1/equipment/borrow-requests/request/decision", "PATCH", { decision: "approved" }],
      ["/api/v1/equipment/device/return-requests", "POST", { note: "Bàn giao đầy đủ" }],
      ["/api/v1/equipment/borrow-requests/request/decision", "PATCH", { decision: "rejected", rejectionReason: "Cần kiểm tra lại" }],
      ["/api/v1/equipment/borrow-requests/request", "DELETE", null],
    ]);
  });
  it.each([400, 403, 409, 500])("surfaces workflow failures without a fake local success or fallback mutation: %s", async status => {
    const fetch = vi.fn().mockImplementation(async () => response({ message: "Phiếu đã được xử lý." }, status));
    const service = createEquipmentService({ fetch, getAccessToken: () => "token" });
    for (const run of [() => service.createBorrowRequest("device", { reason: "Lý do" }), () => service.createReturnRequest("device", {}), () => service.decideRequest("request", "approved"), () => service.cancelRequest("request")]) {
      fetch.mockClear();
      await expect(run()).rejects.toThrow("Phiếu đã được xử lý.");
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
});
