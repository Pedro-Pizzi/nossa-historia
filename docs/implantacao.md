# GitHub, Vercel e Railway

O repositório público contém o sistema. O PostgreSQL contém os registros, sessões, fotos e também os capítulos e imagens de apresentação do livro. O login é obrigatório para ler esse material. Não existe cadastro público.

## Importar o projeto

Na Vercel, importe `Pedro-Pizzi/nossa-historia`, selecione Next.js, Node.js 24, instalação `pnpm install --frozen-lockfile` e build `pnpm build`. Não use exportação estática ou GitHub Pages: a aplicação depende do servidor para proteger os dados.

No Railway, o banco é um serviço PostgreSQL separado. Se optar também por hospedar a aplicação no Railway, importe o mesmo repositório como outro serviço Node.js; o comando `pnpm start` escuta em `0.0.0.0` e usa a variável `PORT` do provedor. Configure `pnpm db:migrate` como comando anterior à implantação. A importação não deve substituir o serviço Postgres pela aplicação.

## Variáveis secretas

Use `DATABASE_MODE=postgres`, a URI em `DATABASE_URL`, `AUTH_ORIGIN` com a origem HTTPS exata, `AUTH_SESSION_SECRET`, `AUTH_ANA_PASSWORD_HASH` e `AUTH_PEDRO_PASSWORD_HASH`. O configurador `pnpm auth:setup` gera os hashes e o segredo localmente. Não há senhas padrão; não publique `.env.local` nem use prefixo `NEXT_PUBLIC_` para segredos.

Conexões remotas usam TLS verificado. Quando o PostgreSQL tem certificado próprio, configure `DATABASE_SSL_CERT` com o PEM do servidor para fixá-lo por fingerprint, ou `DATABASE_SSL_CA` para uma autoridade própria. Não desative a verificação TLS. Vercel precisa de uma conexão externa ao banco; a rede privada Railway só atende serviços daquela rede.

## Migrar o conteúdo privado uma vez

Na pasta local original, o pacote `content/private/book.json` e as mídias em `content/legacy/assets` continuam fora do Git. Configure a conexão local com o PostgreSQL de destino e execute:

```sh
pnpm db:migrate
pnpm db:import-book
```

O importador valida os capítulos, caminhos de imagens e checksums; a operação é transacional e não substitui um livro diferente já existente. Ele é um comando administrativo local, sem endpoint público de carga do livro. O configurador `pnpm db:setup` também importa o pacote quando ele está disponível.

Sem conteúdo importado, uma conta autenticada vê uma mensagem de preparação. O projeto público não contém cópias, exemplos derivados ou fallback com cartas e fotos reais. Novas versões do código continuam lendo o mesmo conteúdo do banco, sem reimportar ou apagar memórias.

## Conferência e backup

Verifique login nas duas contas, recusa de mídia sem sessão e gravação em aparelhos diferentes. Ambos leem os cadernos; cada um altera ou apaga os próprios registros. O banco precisa estar disponível para validar a sessão.

`pnpm db:backup` inclui também o livro e as imagens originais, além dos registros criados no aplicativo. `pnpm db:restore caminho.json.gz` restaura por mesclagem sem sobrescrever. O limite do exportador é 128 MB descomprimidos. Guarde cópia privada fora do computador e configure backups do provedor conforme o plano.

O código estar no GitHub não significa que a Vercel está publicada ou que o banco está ativo. Esses estados devem ser conferidos separadamente nos provedores.
