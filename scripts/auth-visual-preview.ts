import { startAuthTestServer } from "./auth-test-server";

// Prévia de QA: contas descartáveis em memória, sem tocar na configuração pessoal.
// Senha SOMENTE do processo descartável de QA na interface loopback. Não configura
// contas reais, não aparece como fallback e nunca é usada no app normal.
startAuthTestServer({ production: true, port: 3100,testPasswords:{ana:"visual-descartavel-2026!",pedro:"visual-descartavel-2026!"} }).then((server) => {
  console.log(`Prévia de verificação em ${server.origin}/login. Nenhuma senha real é usada.`);
  const stop = async () => { await server.stop(); process.exit(0); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}).catch(() => { console.error("Não foi possível abrir a prévia de verificação."); process.exitCode = 1; });
