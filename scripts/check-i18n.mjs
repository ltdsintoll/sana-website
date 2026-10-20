#!/usr/bin/env node
// i18n completeness check for en/ru/uk/es.
//
//   1. every locale has exactly the keys of `en` (site and cabinet messages),
//   2. no empty strings,
//   3. ICU placeholders ({name}) match the English string,
//   4. plurals have the categories each language needs (ru/uk: one/few/many/other),
//   5. every literal key used with t("...") in src/ exists.
//
// Exit code 1 on any error. Run: npm run i18n:check
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LOCALES = ["en", "ru", "uk", "es"];
const PLURALS = { en: ["one", "other"], es: ["one", "other"], ru: ["one", "few", "many", "other"], uk: ["one", "few", "many", "other"] };
const SETS = [
  { name: "site", file: (l) => `messages/${l}.json` },
  { name: "cabinet", file: (l) => `messages/cabinet/${l}.json` },
];

const errors = [];
const warnings = [];
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** Top-level ICU arguments: {name}, {name, plural, ...}, {name, select, ...}. */
function icuArgs(s) {
  const args = new Set();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && (s[i + 1] === "{" || s[i + 1] === "}")) {
      i = s.indexOf("'", i + 1);
      if (i < 0) break;
      continue;
    }
    if (c === "{") {
      if (depth === 0 || depth % 2 === 0) {
        const m = /^\{\s*([A-Za-z0-9_]+)\s*(?:[,}])/.exec(s.slice(i));
        if (m) args.add(m[1]);
      }
      depth++;
    } else if (c === "}") depth--;
  }
  return args;
}

function pluralBlocks(s) {
  const out = [];
  const re = /\{\s*([A-Za-z0-9_]+)\s*,\s*plural\s*,/g;
  let m;
  while ((m = re.exec(s))) {
    let i = re.lastIndex;
    let depth = 1;
    const cats = new Set();
    let token = "";
    for (; i < s.length && depth > 0; i++) {
      const c = s[i];
      if (c === "{") {
        if (depth === 1 && token.trim()) cats.add(token.trim().replace(/^=/, "="));
        token = "";
        depth++;
      } else if (c === "}") {
        depth--;
      } else if (depth === 1) token += c;
    }
    out.push({ arg: m[1], cats });
  }
  return out;
}

for (const set of SETS) {
  const base = flatten(read(set.file("en")));
  for (const loc of LOCALES) {
    const rel = set.file(loc);
    let flat;
    try {
      flat = flatten(read(rel));
    } catch (e) {
      errors.push(`${rel}: cannot parse (${e.message})`);
      continue;
    }
    for (const k of Object.keys(base)) if (!(k in flat)) errors.push(`${rel}: missing key ${k}`);
    for (const [k, v] of Object.entries(flat)) {
      if (!(k in base)) errors.push(`${rel}: extra key ${k} (not in en)`);
      if (typeof v !== "string") continue;
      if (!v.trim()) errors.push(`${rel}: empty string at ${k}`);
      const en = base[k];
      if (typeof en === "string") {
        const a = [...icuArgs(en)].sort().join(",");
        const b = [...icuArgs(v)].sort().join(",");
        if (a !== b) errors.push(`${rel}: placeholders of ${k} are {${b}}, en has {${a}}`);
        if (loc !== "en" && v === en && v.length > 24 && /[a-z]{4}/.test(v)) warnings.push(`${rel}: ${k} is identical to English`);
      }
      for (const p of pluralBlocks(v)) {
        // "other" alone is fine for wording that fits every number ("Записей: #").
        const named = [...p.cats].filter((c) => !c.startsWith("="));
        if (named.length === 1 && named[0] === "other") continue;
        for (const need of PLURALS[loc]) if (!p.cats.has(need)) errors.push(`${rel}: plural {${p.arg}} in ${k} lacks "${need}"`);
      }
    }
  }
}

// Literal keys used in the code.
const site = flatten(read("messages/en.json"));
const cab = flatten(read("messages/cabinet/en.json"));
const known = new Set([...Object.keys(site), ...Object.keys(cab).map((k) => `cab.${k}`)]);
const knownList = [...known];
let dynamic = 0;
let checked = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(e.name)) scan(p);
  }
}

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  // Declarations in source order: a call belongs to the nearest declaration
  // of that name above it (each component declares its own `t`).
  const decls = [];
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)"|\{[^}]*namespace:\s*"([^"]*)"[^}]*\})?\s*\)/g)) {
    decls.push({ name: m[1], ns: m[2] ?? m[3] ?? "", at: m.index });
  }
  for (const name of new Set(decls.map((d) => d.name))) {
    const re = new RegExp(`\\b${name}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*(["'\`])((?:(?!\\1).)*)\\1`, "g");
    for (const m of src.matchAll(re)) {
      const d = decls.filter((x) => x.name === name && x.at < m.index).pop();
      if (!d) continue;
      const key = m[2];
      const full = d.ns ? `${d.ns}.${key}` : key;
      if (m[1] === "`" && key.includes("${")) {
        dynamic++;
        const prefix = full.slice(0, full.indexOf("${"));
        if (prefix && !knownList.some((k) => k.startsWith(prefix))) errors.push(`${path.relative(ROOT, file)}: unknown key prefix ${prefix}`);
        continue;
      }
      checked++;
      if (!known.has(full)) errors.push(`${path.relative(ROOT, file)}: unknown key ${full}`);
    }
  }
}
walk(path.join(ROOT, "src"));

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(
  `i18n: ${LOCALES.length} locales, ${Object.keys(cab).length} cabinet + ${Object.keys(site).length} site keys, ` +
    `${checked} literal keys in code checked, ${dynamic} dynamic; ${errors.length} errors, ${warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
