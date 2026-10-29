$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($pnpmCommand) {
    $projectPnpm = $pnpmCommand.Source
} else {
    $projectRuntime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies'
    $projectPnpm = Join-Path $projectRuntime 'bin/fallback/pnpm.cmd'
    if (-not (Test-Path -LiteralPath $projectPnpm)) { throw 'Instale Node.js 24 e pnpm 11.25.0 para configurar o projeto.' }
    $env:PATH = (Join-Path $projectRuntime 'node/bin') + [IO.Path]::PathSeparator + $env:PATH
}
& $projectPnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar as dependências.' }
& $projectPnpm db:setup @args
exit $LASTEXITCODE
