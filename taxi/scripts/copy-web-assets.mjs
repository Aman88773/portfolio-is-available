import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const webDir = resolve(root, "www");
const webAssets = ["index.html", "privacy.html", "manifest.json", "sw.js", "icon.svg"];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
await Promise.all(webAssets.map((asset) => cp(resolve(root, asset), resolve(webDir, asset))));
