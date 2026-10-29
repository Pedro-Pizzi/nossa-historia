import { redirect } from "next/navigation";
import { currentAccount, getAuthConfig } from "@/lib/auth/server";
import { LoginForm } from "@/features/auth/components/login-form";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentAccount()) redirect("/");
  const configured = !!getAuthConfig();
  return <main className="auth-page"><section className="auth-card" aria-labelledby="login-title"><div className="auth-monogram" aria-hidden="true">A <span>♡</span> P</div><p className="auth-eyebrow">um espaço só nosso</p><h1 id="login-title">Nossa História</h1><p className="auth-intro">As nossas memórias, os nossos sonhos<br />e tudo o que ainda vamos viver.</p>{configured ? <LoginForm /> : <p className="auth-pending" role="status">Estamos preparando o nosso espaço.<br />O acesso ainda não foi liberado.</p>}<p className="auth-footnote">Feito para nós dois, com carinho.</p></section></main>;
}
