import { stdin, stdout } from "node:process";
import { emitKeypressEvents, type Key } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { hashPassword, validNewPassword } from "../src/lib/auth/password";
import { mergeAuthEnvironment } from "./auth-env";

function secret(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("Execute este configurador em um terminal interativo no seu computador.");
  emitKeypressEvents(stdin); stdin.setRawMode(true); stdin.resume(); stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error?: Error) {
      stdin.off("keypress", keypress); stdin.setRawMode(false); stdin.pause(); stdout.write("\n");
      if (error) reject(error); else resolve(value);
    }
    function keypress(text: string | undefined, key: Key) {
      if (key.ctrl && key.name === "c") { finish(new Error("Configuração cancelada. Nenhuma senha foi alterada.")); return; }
      if (key.name === "return" || key.name === "enter") { finish(); return; }
      if (key.name === "backspace") { if (value) { value = [...value].slice(0, -1).join(""); stdout.write("\b \b"); } return; }
      if (!key.ctrl && !key.meta && text && !/[\r\n\x00-\x1f\x7f]/.test(text) && value.length + text.length <= 128) { value += text; stdout.write("*".repeat([...text].length)); }
    }
    stdin.on("keypress", keypress);
  });
}
async function choosePassword(name: string) {
  for (;;) {
    const password = await secret(`Senha para ${name} (12 a 128 caracteres): `);
    if (!validNewPassword(password)) { stdout.write("Use uma senha de 12 a 128 caracteres.\n"); continue; }
    const confirmation = await secret(`Confirme a senha de ${name}: `);
    if (password !== confirmation) { stdout.write("As senhas não coincidem. Tente novamente.\n"); continue; }
    return hashPassword(password);
  }
}
async function main() {
  const file = path.resolve(".env.local");
  let existing = "";
  let exists = false;
  try { existing = await readFile(file, "utf8"); exists = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (/^\s*AUTH_(?:SESSION_SECRET|ANA_PASSWORD_HASH|PEDRO_PASSWORD_HASH)\s*=/m.test(existing) && !process.argv.includes("--replace")) throw new Error("Já existe uma configuração de acesso. Para redefinir as duas senhas, execute pnpm auth:setup --replace. As sessões anteriores serão encerradas.");
  stdout.write("Nossa História — configurar os dois acessos locais\nUsuários: ana e pedro. As senhas não serão exibidas nem salvas em texto.\n\n");
  const ana = await choosePassword("Ana");
  const pedro = await choosePassword("Pedro");
  const values = { AUTH_ORIGIN: "http://127.0.0.1:3000", AUTH_SESSION_SECRET: randomBytes(48).toString("hex"), AUTH_ANA_PASSWORD_HASH: ana, AUTH_PEDRO_PASSWORD_HASH: pedro };
  await writeFile(file, mergeAuthEnvironment(existing, values), { flag: exists ? "w" : "wx", mode: 0o600 });
  stdout.write("\nAcessos configurados. Apenas hashes e o segredo de sessão foram salvos em .env.local, ignorado pelo Git.\nReinicie o servidor e entre com ana ou pedro e a senha correspondente.\n");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Não foi possível configurar os acessos."); process.exitCode = 1; });
