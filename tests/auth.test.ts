import assert from "node:assert/strict";
import { before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { hashPassword, validPasswordHash, verifyPassword } from "../src/lib/auth/password";
import { readAuthConfiguration, SESSION_TTL_SECONDS, type AuthConfig } from "../src/lib/auth/config";
import { MemoryAuthStore } from "../src/lib/auth/store";
import { authenticate, authorizedAccount } from "../src/lib/auth/service";
import { readLoginBody, trustedOrigin } from "../src/lib/auth/request";

let hash: string;
let config: AuthConfig;
before(async () => {
  hash = await hashPassword("Senha temporária de teste 2026");
  config = readAuthConfiguration({ DATABASE_MODE:"pglite", DATABASE_PATH:"teste-local", AUTH_ORIGIN: "http://127.0.0.1:3000", AUTH_SESSION_SECRET: "segredo-exclusivo-dos-testes-".repeat(3), AUTH_ANA_PASSWORD_HASH: hash, AUTH_PEDRO_PASSWORD_HASH: hash })!;
});

test("hash usa sal aleatório, valida a senha e não aceita alterações de custo", async () => {
  const another = await hashPassword("Senha temporária de teste 2026");
  assert.notEqual(hash, another);
  assert.ok(!hash.includes("Senha temporária"));
  assert.ok(await verifyPassword("Senha temporária de teste 2026", hash));
  assert.equal(await verifyPassword("Senha incorreta de teste", hash), false);
  assert.equal(await verifyPassword("Senha temporária de teste 2026"), false);
  assert.equal(validPasswordHash(hash.replace("131072", "1073741824")), false);
});
test("configuração incompleta ou domínio externo mantém acesso fechado", () => {
  assert.equal(readAuthConfiguration({}), null);
  const env = { DATABASE_MODE:"pglite", DATABASE_PATH:"teste-local", AUTH_ORIGIN: config.origin, AUTH_SESSION_SECRET: config.secret, AUTH_ANA_PASSWORD_HASH: hash, AUTH_PEDRO_PASSWORD_HASH: hash };
  assert.equal(readAuthConfiguration({ ...env, AUTH_PEDRO_PASSWORD_HASH: "" }), null);
  assert.equal(readAuthConfiguration({ ...env, AUTH_SESSION_SECRET: "curto" }), null);
  assert.equal(readAuthConfiguration({ ...env, AUTH_ORIGIN: "https://projeto.example" }), null);
  assert.equal(readAuthConfiguration({ ...env, AUTH_ORIGIN: "http://127.0.0.1:3000/" }), null);
  assert.deepEqual(config.accounts.map((account) => account.id), ["ana", "pedro"]);
});
test("login cria sessão nova e a revogação impede reutilizar o identificador", async () => {
  const store = new MemoryAuthStore();
  const result = await authenticate(config, store, " ANA ", "Senha temporária de teste 2026");
  assert.ok(result.ok);
  assert.equal((await authorizedAccount(config, store, result.record.id))?.name, "Ana");
  store.revokeSession(result.record.id);
  assert.equal(await authorizedAccount(config, store, result.record.id), null);
  assert.equal(await authorizedAccount(config, store, "inventada"), null);
});
test("prazo absoluto e troca do hash invalidam a sessão anterior", async () => {
  const store = new MemoryAuthStore();
  const session = { id: randomUUID(), accountId: "pedro" as const, accountVersion: config.accounts[1].version, issuedAt: 1000, expiresAt: 1000 + SESSION_TTL_SECONDS * 1000 };
  store.createSession(session);
  assert.equal((await authorizedAccount(config, store, session.id, 1001))?.id, "pedro");
  assert.equal(await authorizedAccount(config, store, session.id, session.expiresAt), null);
  store.createSession(session);
  const changed = { ...config, accounts: [config.accounts[0], { ...config.accounts[1], version: "hash alterado" }] } as AuthConfig;
  assert.equal(await authorizedAccount(changed, store, session.id, 1001), null);
});
test("limite de tentativas inclui concorrência e um bucket fixo para usuários desconhecidos", () => {
  const store = new MemoryAuthStore();
  for (let index = 0; index < 5; index++) assert.equal(store.consumeAttempt("ana", 1000).allowed, true);
  assert.deepEqual(store.consumeAttempt("ana", 1000), { allowed: false, retryAfter: 900 });
  assert.equal(store.consumeAttempt("pedro", 1000).allowed, true);
  for (let index = 0; index < 5; index++) assert.equal(store.consumeAttempt(`inventado-${index}`, 1000).allowed, true);
  assert.equal(store.consumeAttempt("mais-um-inventado", 1000).allowed, false);
  assert.equal(store.consumeAttempt("ana", 901000).allowed, true);
});
test("no máximo cinco sessões por pessoa, sem encerrar as da outra conta", () => {
  const store = new MemoryAuthStore();
  const ids: string[] = [];
  for (let index = 0; index < 6; index++) { const id = randomUUID(); ids.push(id); store.createSession({ id, accountId: "ana", accountVersion: "v", issuedAt: index, expiresAt: 1000 }); }
  assert.equal(store.findSession(ids[0], 10), null);
  assert.ok(store.findSession(ids[1], 10));
  const pedro = randomUUID(); store.createSession({ id: pedro, accountId: "pedro", accountVersion: "v", issuedAt: 10, expiresAt: 1000 });
  assert.ok(store.findSession(ids[1], 10)); assert.ok(store.findSession(pedro, 10));
});
test("origem exata é obrigatória nas operações que alteram autenticação", () => {
  const request = (headers: Record<string, string>) => new Request(config.origin + "/api/auth/logout", { method: "POST", headers });
  assert.equal(trustedOrigin(request({ origin: config.origin }), config.origin), true);
  assert.equal(trustedOrigin(request({ origin: "https://outro.example" }), config.origin), false);
  assert.equal(trustedOrigin(request({}), config.origin), false);
  assert.equal(trustedOrigin(request({ origin: config.origin, "sec-fetch-site": "cross-site" }), config.origin), false);
});
test("formato e tamanho do login são limitados antes de verificar a senha", async () => {
  const request = (body: string, type = "application/json") => new Request("http://127.0.0.1/api/auth/login", { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readLoginBody(request('{"username":"ana","password":"teste"}')), { username: "ana", password: "teste" });
  assert.equal(await readLoginBody(request('{"username":{},"password":"teste"}')), null);
  assert.equal(await readLoginBody(request('{"username":"ana","password":"teste"}', "text/plain")), null);
  assert.equal(await readLoginBody(request("x".repeat(2049))), null);
});
