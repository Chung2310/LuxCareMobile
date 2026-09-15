import { build } from "esbuild";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfRoot = path.join(root, "node_modules/pdfjs-dist");
const assets = {};
const licenses = [];
for (const [folder, kind, pattern] of [
  ["cmaps", "cMapUrl", /\.bcmap$/],
  ["standard_fonts", "standardFontDataUrl", /\.(pfb|ttf)$/],
  ["wasm", "wasmUrl", /^(jbig2|openjpeg|qcms_bg)\.wasm$/],
]) {
  for (const name of (await readdir(path.join(pdfRoot, folder))).sort()) {
    if (pattern.test(name)) assets[kind + "/" + name] = (await readFile(path.join(pdfRoot, folder, name))).toString("base64");
    if (name.startsWith("LICENSE")) licenses.push(name + "\n" + await readFile(path.join(pdfRoot, folder, name), "utf8"));
  }
}
for (const [pkg, file] of [["pdfjs-dist", "LICENSE"], ["mammoth", "LICENSE"], ["dompurify", "LICENSE"]]) {
  licenses.push(pkg + "\n" + await readFile(path.join(root, "node_modules", pkg, file), "utf8"));
}
const result = await build({
  absWorkingDir: root, entryPoints: ["document-viewer/viewer.js"], bundle: true, write: false,
  format: "esm", platform: "browser", target: ["safari16.4", "chrome110"], minify: true,
  legalComments: "inline",
  plugins: [{
    name: "local-pdf-assets",
    setup(build) {
      build.onResolve({ filter: /^preview-pdf-assets$/ }, () => ({ path: "assets", namespace: "preview" }));
      build.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: JSON.stringify(assets), loader: "json" }));
    },
  }],
});
const destination = path.join(root, "src/features/blog/generated");
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, "documentViewer.json"), JSON.stringify(result.outputFiles[0].text) + "\n");
await writeFile(path.join(destination, "LICENSES.txt"), licenses.join("\n\n"));
console.log("Built offline document viewer (" + result.outputFiles[0].contents.length + " bytes)");
