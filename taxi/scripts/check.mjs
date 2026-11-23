import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";
import { parse } from "parse5";
import YAML from "yaml";

const root = resolve(import.meta.dirname, "../..");
const taxiDir = resolve(root, "taxi");
const errors = [];

async function read(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    errors.push(`Missing or unreadable file: ${path} (${error.message})`);
    return "";
  }
}

function checkHtml(name, source) {
  const parseErrors = [];
  const document = parse(source, { onParseError: (error) => parseErrors.push(error) });
  for (const error of parseErrors) errors.push(`${name}: HTML ${error.code} at ${error.startLine}:${error.startCol}`);

  const ids = new Set();
  function visit(node) {
    const id = node.attrs?.find((attribute) => attribute.name === "id")?.value;
    if (id !== undefined) {
      if (!id || /\s/.test(id)) errors.push(`${name}: invalid HTML id "${id}"`);
      if (ids.has(id)) errors.push(`${name}: duplicate HTML id "${id}"`);
      ids.add(id);
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  }
  visit(document);

  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  scripts.forEach(([, script], index) => {
    if (!script.trim()) return;
    try {
      new vm.Script(script, { filename: `${name}:inline-script-${index + 1}` });
    } catch (error) {
      errors.push(`${name}: JavaScript syntax error in inline script: ${error.message}`);
    }
  });
}

const manifestSource = await read(resolve(taxiDir, "manifest.json"));
try {
  const manifest = JSON.parse(manifestSource);
  if (manifest.name !== "Zhairem Taxi" || manifest.start_url !== "./index.html") {
    errors.push("manifest.json: unexpected app name or start_url");
  }
} catch (error) {
  errors.push(`manifest.json: invalid JSON: ${error.message}`);
}

const index = await read(resolve(taxiDir, "index.html"));
const privacy = await read(resolve(taxiDir, "privacy.html"));
const sw = await read(resolve(taxiDir, "sw.js"));
checkHtml("index.html", index);
checkHtml("privacy.html", privacy);
try {
  new vm.Script(sw, { filename: "sw.js" });
} catch (error) {
  errors.push(`sw.js: JavaScript syntax error: ${error.message}`);
}

const requiredMarkers = [
  ["400 ₸", /400\s*₸/],
  ["350 ₸", /350\s*₸/],
  ["50 ₸", /50\s*₸/],
  ["10% city commission", /10%/],
  ["Kaspi", /Kaspi/i],
  ["WhatsApp", /WhatsApp|wa\.me/i],
  ["intercity calculator", /Қалааралық калькулятор/],
  ["bonus system", /бонус/i],
  ["AI navigator", /AI-навигатор/],
  ["offline GPS navigator", /Офлайн GPS|спутник/i],
  ["offline and online weather", /Офлайн.*Онлайн|Онлайн ауа райы/i]
];
for (const [label, pattern] of requiredMarkers) {
  if (!pattern.test(index)) errors.push(`index.html: required feature marker missing: ${label}`);
}
if (!/\.\/privacy\.html/.test(sw)) errors.push("sw.js: privacy.html is not in the service-worker asset list");
if (!/privacy\.html/.test(index)) errors.push("index.html: public privacy policy link is missing");
if (!/Аккаунт пен деректерді өшіру|Деректер мен аккаунтты өшіру/.test(privacy)) {
  errors.push("privacy.html: account and data deletion instructions are missing");
}

for (const file of ["android-aab.yml", "taxi-check.yml"]) {
  const path = resolve(root, ".github/workflows", file);
  const source = await read(path);
  try {
    const workflow = YAML.parse(source);
    if (!workflow || typeof workflow !== "object") errors.push(`${file}: workflow must be a YAML mapping`);
    if (file === "android-aab.yml" && !Object.hasOwn(workflow?.on ?? {}, "workflow_dispatch")) {
      errors.push(`${file}: workflow_dispatch trigger is missing`);
    }
  } catch (error) {
    errors.push(`${file}: invalid YAML: ${error.message}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Taxi HTML, JavaScript, JSON, YAML, IDs, and required feature markers are valid.");
}
