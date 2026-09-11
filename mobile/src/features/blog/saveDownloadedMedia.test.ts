import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("./saveDownloadedMedia.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function setup(modules: string[], platform = "android") {
  const imports: string[] = [];
  const permission = vi.fn().mockResolvedValue({ granted: true, status: "granted" });
  const save = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ id: "asset" });
  const module = { exports: {} as any };
  vm.runInNewContext(source, { exports: module.exports, module, require: (name: string) => {
    imports.push(name);
    if (name === "expo") return { requireOptionalNativeModule: (id: string) => modules.includes(id) ? {} : null };
    if (name === "react-native") return { Platform: { OS: platform } };
    if (name === "expo-media-library/legacy") {
      if (!modules.includes("ExpoMediaLibrary")) throw new Error("Missing legacy native module");
      return { requestPermissionsAsync: permission, saveToLibraryAsync: save };
    }
    if (name === "expo-media-library") {
      if (!modules.includes("ExpoMediaLibraryNext")) throw new Error("Missing ExpoMediaLibraryNext");
      return { requestPermissionsAsync: permission, Asset: { create } };
    }
    throw new Error(name);
  } });
  return { saveMedia: module.exports.saveDownloadedMedia, imports, permission, save, create };
}
describe("Blog media library compatibility", () => {
  it("uses only legacy when ExpoMediaLibraryNext is missing", async () => {
    const host = setup(["ExpoMediaLibrary"]);
    expect(await host.saveMedia("file:///image.jpg", "image")).toBe("saved");
    expect(host.imports).not.toContain("expo-media-library");
    expect(host.permission).toHaveBeenCalledWith(true, ["photo"]);
    expect(host.save).toHaveBeenCalledWith("file:///image.jpg");
  });
  it("supports a next-only native build using Asset.create", async () => {
    const host = setup(["ExpoMediaLibraryNext"]);
    expect(await host.saveMedia("file:///video.mp4", "video")).toBe("saved");
    expect(host.imports).not.toContain("expo-media-library/legacy");
    expect(host.permission).toHaveBeenCalledWith(true, ["video"]);
    expect(host.create).toHaveBeenCalledWith("file:///video.mp4");
  });
  it.each([{ modules: [] }, { modules: ["ExpoMediaLibrary", "ExpoMediaLibraryNext"] }])("handles native availability safely: %j", async ({ modules }) => {
    const host = setup(modules);
    expect(await host.saveMedia("file:///image.jpg", "image")).toBe(modules.length ? "saved" : "unavailable");
    expect(host.imports).not.toContain("expo-media-library");
  });
  it("does not save after permission denial", async () => {
    const host = setup(["ExpoMediaLibrary"]);
    host.permission.mockResolvedValue({ granted: false, status: "denied" });
    expect(await host.saveMedia("file:///image.jpg", "image")).toBe("denied");
    expect(host.save).not.toHaveBeenCalled();
  });
  it("never imports native media on web", async () => {
    const host = setup(["ExpoMediaLibrary"], "web");
    expect(await host.saveMedia("image.jpg", "image")).toBe("unavailable");
    expect(host.imports).not.toContain("expo-media-library/legacy");
  });
  it("propagates save failures so the screen can use its file fallback", async () => {
    const host = setup(["ExpoMediaLibrary"]);
    host.save.mockRejectedValue(new Error("Cannot save"));
    await expect(host.saveMedia("file:///image.jpg", "image")).rejects.toThrow("Cannot save");
  });
});
