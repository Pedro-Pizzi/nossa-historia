param(
 [Parameter(Mandatory=$true,Position=0)][ValidateSet('github','railway','vercel')][string]$Servico,
 [Parameter(ValueFromRemainingArguments=$true)][string[]]$Comandos
)
$ErrorActionPreference='Stop'
$cliHome=Join-Path $env:LOCALAPPDATA 'NossaHistoria'
if($Servico -eq 'vercel'){
 $nodeBinary=(Get-Command node -ErrorAction SilentlyContinue).Source
 if(!$nodeBinary){$nodeBinary=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
 if(!(Test-Path -LiteralPath $nodeBinary)){throw 'Node.js 24 não encontrado.'}
 $entry=Join-Path $cliHome 'vercel-cli/node_modules/vercel/dist/vc.js'
 if(!(Test-Path -LiteralPath $entry)){throw 'CLI Vercel não instalado neste computador.'}
 & $nodeBinary $entry @Comandos
}else{
 $binary=if($Servico -eq 'github'){'gh.exe'}else{'railway.exe'}
 $entry=Join-Path $cliHome ('cli/'+$binary)
 if(!(Test-Path -LiteralPath $entry)){throw 'CLI ainda não instalado neste computador.'}
 & $entry @Comandos
}
exit $LASTEXITCODE
