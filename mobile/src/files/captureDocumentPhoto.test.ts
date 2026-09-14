import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), camera: vi.fn(), remove: vi.fn() }));
vi.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: mocks.permission, launchCameraAsync: mocks.camera, CameraType: { back: "back" } }));
vi.mock("expo-file-system", () => ({ Paths: { cache: { uri: "file:///cache/" } }, File: class { exists = true; delete = mocks.remove; } }));
import { captureDocumentPhoto } from "./captureDocumentPhoto";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.permission.mockResolvedValue({ granted: true });
  mocks.camera.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/photo.jpg", base64: "dGVzdA==" }] });
});
it("captures a full-page JPEG and measures the actual encoded upload size", async () => {
  expect(await captureDocumentPhoto()).toMatchObject({ file: "data:image/jpeg;base64,dGVzdA==", mimeType: "image/jpeg", size: 4 });
  expect(mocks.camera).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ["images"], allowsEditing: false, base64: true, cameraType: "back" }));
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not open the camera when permission is denied", async () => {
  mocks.permission.mockResolvedValue({ granted: false, canAskAgain: false });
  await expect(captureDocumentPhoto()).rejects.toThrow("Cài đặt");
  expect(mocks.camera).not.toHaveBeenCalled();
});
it("returns no attachment when the camera is canceled", async () => {
  mocks.camera.mockResolvedValue({ canceled: true });
  expect(await captureDocumentPhoto()).toBeNull();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("cleans up but discards a photo if the form was closed", async () => {
  const controller = new AbortController();
  mocks.camera.mockImplementation(async () => { controller.abort(); return { canceled: false, assets: [{ uri: "file:///cache/photo.jpg", base64: "dGVzdA==" }] }; });
  expect(await captureDocumentPhoto(controller.signal)).toBeNull();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("rejects oversized photos and deletes the temporary capture", async () => {
  mocks.camera.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/photo.jpg", base64: "A".repeat(14 * 1024 * 1024) }] });
  await expect(captureDocumentPhoto()).rejects.toThrow("10 MB");
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not delete an image outside the camera cache", async () => {
  mocks.camera.mockResolvedValue({ canceled: false, assets: [{ uri: "content://photo", base64: "dGVzdA==" }] });
  await captureDocumentPhoto();
  expect(mocks.remove).not.toHaveBeenCalled();
});