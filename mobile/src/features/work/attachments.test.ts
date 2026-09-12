import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  (globalThis as any).__DEV__ = false;
  return { pick: vi.fn(), upload: vi.fn(), remove: vi.fn(), size: 4 };
});
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    exists = true;
    get size() {
      return mocks.size;
    }
    base64 = async () => "dGVzdA==";
    delete = mocks.remove;
  },
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android", Version: 33 },
  Alert: { alert: vi.fn() },
  Linking: { openSettings: vi.fn() },
  PermissionsAndroid: { request: vi.fn(), PERMISSIONS: {}, RESULTS: {} },
}));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "id" }));
vi.mock("../../api/services", () => ({ kanbanMedia: { upload: mocks.upload } }));
import { pickWorkAttachment } from "./attachments";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.size = 4;
  mocks.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///cache/test", name: "test.mp3", mimeType: "audio/mpeg" }],
  });
  mocks.upload.mockResolvedValue({ url: "https://example.com/file", uploadToken: "owned" });
});
it("keeps ownership and media metadata and cleans only the picker copy", async () => {
  expect(await pickWorkAttachment()).toMatchObject({ type: "audio", uploadToken: "owned", size: 4, name: "test.mp3" });
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("rejects large files before upload", async () => {
  mocks.size = 21 * 1024 * 1024;
  await expect(pickWorkAttachment()).rejects.toThrow();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("leaves original documents untouched", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "content://original", name: "file" }] });
  await pickWorkAttachment();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("does not upload after cancellation", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  await expect(pickWorkAttachment()).resolves.toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
