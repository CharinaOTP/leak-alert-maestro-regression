const fs = require("fs");

const sourceMapPath = process.argv[2];
if (!sourceMapPath || !fs.existsSync(sourceMapPath)) {
  console.error("Usage: node scripts/extract_deployed_apis.js <source-map.json>");
  process.exit(1);
}

const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, "utf8"));
const endpoints = new Map();

function normalizePath(value) {
  return value
    .replace(/\$\{[^}]+\}/g, "{param}")
    .replace(/\s+/g, " ")
    .trim();
}

function add(method, path, source) {
  const normalized = normalizePath(path);
  if (!normalized || normalized.includes("reactjs.org")) return;
  const key = `${method.toUpperCase()} ${normalized}`;
  if (!endpoints.has(key)) {
    endpoints.set(key, {
      method: method.toUpperCase(),
      path: normalized,
      sources: [],
    });
  }
  const item = endpoints.get(key);
  if (!item.sources.includes(source)) item.sources.push(source);
}

for (let index = 0; index < sourceMap.sources.length; index += 1) {
  const source = sourceMap.sources[index];
  if (source.includes("node_modules")) continue;
  const content = sourceMap.sourcesContent?.[index] || "";

  const axiosCall =
    /devApi\.(get|post|put|delete|patch)\s*(?:<[^;]*?>)?\s*\(\s*([`'"])([\s\S]*?)\2/g;
  for (const match of content.matchAll(axiosCall)) {
    add(match[1], match[3], source);
  }

  const fetchCall = /fetch\s*\(\s*([`'"])(https?:[^`'"]+)\1/g;
  for (const match of content.matchAll(fetchCall)) {
    add("GET", match[2], source);
  }
}

const result = [...endpoints.values()].sort((a, b) =>
  `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)
);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
