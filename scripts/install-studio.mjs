/** Install the separately prepared client presentation. Only the pinned compiled artifact is public. */
import { createReadStream } from "node:fs";
import {
  readFile as read,
  mkdir as makeDirectory,
  readdir as list,
  stat as info,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, posix } from "node:path";
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await read(resolve(root, "scripts/studio-release.json"), "utf8"),
);
if (
  !/^https:\/\/github\.com\/Riley-Coyote\/truemark\/releases\/download\//.test(
    manifest.url,
  ) ||
  !/^\w{64}$/.test(manifest.sha256)
)
  throw Error("Invalid presentation release manifest");
const archive = resolve(root, "studio-release.tar.gz");
const response = await fetch(manifest.url);
if (!response.ok || !response.body)
  throw Error(`Presentation download failed (${response.status})`);
await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
const hash = createHash("sha256");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== manifest.sha256)
  throw Error("Presentation integrity check failed");
const paths = execFileSync("tar", ["-tzf", archive], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
})
  .trim()
  .split("\n");
for (const path of paths) {
  const normalized = posix.normalize(path);
  if (
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../")
  )
    throw Error("Presentation archive contains an unsafe path");
}
const dest = resolve(root, "dist/studio");
await makeDirectory(dest, { recursive: true });
execFileSync("tar", ["-xzf", archive, "-C", dest]);
async function bytes(dir) {
  let size = 0;
  for (const entry of await list(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    size += entry.isDirectory() ? await bytes(file) : (await info(file)).size;
  }
  return size;
}
const total = await bytes(resolve(root, "dist"));
if (total > 1_000_000_000)
  throw Error(`Combined Pages artifact exceeds the 1 GB limit (${total})`);
console.log(
  `Installed the verified TrueMark studio; combined Pages artifact ${total.toLocaleString()} bytes.`,
);
