import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const bundle = await readFile(
  resolve(import.meta.dirname, "dist/crisp-client.js"),
  "utf8",
);

const packageOutput = (
  await Promise.all(
    ["index.js", "manager.js", "on.js", "parser.js", "socket.js"].map((file) =>
      readFile(resolve(import.meta.dirname, "../../build/esm", file), "utf8"),
    ),
  )
).join("\n");

const packageForbidden = [
  ["CommonJS require", /\brequire\s*\(/],
  ["CommonJS exports", /\bmodule\.exports\b/],
];
const browserForbidden = [
  ["debug package", /\bdebug(?:Module)?\b/],
  ["MessagePack", /\bmsgpack\b/i],
  ["Socket.IO binary attachments", /\battachments\b|BINARY_(?:EVENT|ACK)/],
  ["Node Buffer", /\bBuffer\b/],
  ["Node process", /\bprocess\b/],
  ["Node ws package", /from\s+["']ws["']|require\s*\(\s*["']ws["']\s*\)/],
];

for (const [label, pattern] of [...packageForbidden, ...browserForbidden]) {
  if (pattern.test(packageOutput)) {
    throw new Error(`${label} was found in the Socket.IO ESM package`);
  }
}

for (const [label, pattern] of browserForbidden) {
  if (pattern.test(bundle)) {
    throw new Error(`${label} was found in the Crisp browser bundle`);
  }
}

console.log(
  `Verified Socket.IO ESM and Crisp browser bundle (${bundle.length} bytes)`,
);
