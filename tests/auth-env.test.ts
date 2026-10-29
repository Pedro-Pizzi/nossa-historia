import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dotenvValue, mergeAuthEnvironment } from "../scripts/auth-env";

test("configurador preserva variáveis existentes e escapa hashes para o leitor real do Next", async () => {
  const hash = "scrypt$131072$8$1$" + "a".repeat(32) + "$" + "b".repeat(128);
  const contents = mergeAuthEnvironment('DATABASE_URL="preservar"\nAUTH_ANA_PASSWORD_HASH="antigo"\n', { AUTH_ANA_PASSWORD_HASH: hash });
  assert.ok(contents.includes('DATABASE_URL="preservar"'));
  assert.equal(contents.split("AUTH_ANA_PASSWORD_HASH=").length, 2);
  assert.ok(dotenvValue(hash).includes("\\$131072"));
  const directory = await mkdtemp(path.join(tmpdir(), "nh-auth-env-"));
  const file = path.join(directory, ".env.local");
  try {
    await writeFile(file, contents);
    const require = createRequire(import.meta.url);
    const nextRequire = createRequire(require.resolve("next/package.json"));
    const loader = nextRequire.resolve("@next/env");
    const env: NodeJS.ProcessEnv = { ...process.env, TEST_EXPECTED_HASH: hash };
    delete env.AUTH_ANA_PASSWORD_HASH;
    const check = spawnSync(process.execPath, ["-e", 'require(process.argv[1]).loadEnvConfig(process.argv[2], true, {info(){},error(){}}); process.exit(process.env.AUTH_ANA_PASSWORD_HASH === process.env.TEST_EXPECTED_HASH ? 0 : 1)', loader, directory], { env, windowsHide: true, encoding: "utf8" });
    assert.equal(check.status, 0, "Hash foi alterado pela expansão de variáveis do .env.");
  } finally { await unlink(file); await rmdir(directory); }
});
