# Nossa História

Aplicativo para duas pessoas, com Next.js 16, React 19, TypeScript e PostgreSQL. O código é público; o livro, as cartas, as fotos e os registros ficam no banco protegido por login. Não existe cadastro público.

## Desenvolvimento

Use Node.js 24 e pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm db:setup
pnpm auth:setup
pnpm dev
```

Abra `http://127.0.0.1:3000`. O configurador oferece PostgreSQL embarcado persistente (PGlite) para uso local ou conexão a PostgreSQL externo. Os arquivos locais do banco ficam fora da pasta do OneDrive. Senhas e conexão são salvas em `.env.local`, ignorado pelo Git; não há credenciais padrão.

No Windows, os atalhos `configurar-banco.ps1`, `configurar-acessos.ps1` e `iniciar.ps1` executam os mesmos passos. As contas são `ana` e `pedro`. Ambos leem; cada um escreve e remove os próprios registros. As operações são autorizadas e validadas no servidor.

## Conteúdo e publicação

O material pessoal não acompanha um clone público. Capítulos e imagens de apresentação são importados uma vez para o banco por `pnpm db:import-book`, usando o pacote privado preservado na pasta local original. Uma instalação sem esse conteúdo mostra uma mensagem de preparação após o login.

O sistema pode ser importado do GitHub na Vercel, com o PostgreSQL no Railway. Também suporta executar o servidor Node.js no Railway. Configure HTTPS, conexão TLS, hashes e segredo pelas variáveis privadas dos provedores. As instruções estão em [docs/implantacao.md](docs/implantacao.md).

```sh
pnpm build
pnpm start
```

O comando de hospedagem usa `0.0.0.0` e respeita `PORT`. Para produção restrita a este computador, use `pnpm start:local`. O modo embarcado só aceita origem local; produção externa exige PostgreSQL TCP e HTTPS.

## Organização

- `src/app`: páginas e APIs autenticadas.
- `src/features`: formulários e interação do livro.
- `src/lib/auth`: duas contas, sessões revogáveis e limite de tentativas.
- `src/lib/database`: SQL, validação, permissões, capítulos, imagens, importação e backups.
- `database/migrations`: migrações transacionais versionadas.
- `content/legacy/styles`: estilos preservados do livro.
- `scripts` e `tests`: configuração, migração e verificações.

Os capítulos são dados validados, renderizados com uma lista restrita de elementos e controles React. Não se executa HTML ou JavaScript vindo do banco. Imagens pessoais são entregues por rotas com sessão e sem cache público.

## Verificações

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm verify:auth
pnpm verify:database
pnpm verify:public
```

As verificações HTTP usam bancos e contas descartáveis, sem alterar os acessos reais. Execute-as em sequência após o build, com a porta 3101 livre. Um clone público usa dados genéricos de teste; a pasta original também confere a preservação do livro privado. `verify:public` examina os arquivos rastreados pelo Git e recusa material pessoal ou trechos do pacote privado local.

## Dados antigos e backup

O painel **Trazer memórias antigas** importa os registros da prévia no mesmo navegador e origem. Cada conta importa os próprios registros. A importação evita duplicatas e preserva a origem. Navegadores, domínios diferentes e `file://` têm armazenamentos separados; áudios e fotos de seções antigas sem interface ativa não são migrados automaticamente.

```sh
pnpm db:backup
pnpm db:restore backups/nome-do-backup.json.gz
```

O backup inclui livro, imagens e registros; a restauração mescla sem sobrescrever. Os arquivos são privados e ficam fora do Git. Atualizar o código não apaga o banco.
