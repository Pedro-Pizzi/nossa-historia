param(
 [Parameter(Mandatory=$true,Position=0)][ValidateSet('github','railway','vercel')][string]$Servico,
 [Parameter(ValueFromRemainingArguments=$true)][string[]]$Comandos
)
$ErrorActionPreference='Stop'
$cliHome=Join-Path $env:LOCALAPPDATA 'NossaHistoria'
if($Servico -eq 'vercel'){
 $nodeCli=Get-Command node -ErrorAction SilentlyContinue
 if(!$nodeCli){throw 'Node.js 24 não encontrado.'}
 $entry=Join-Path $cliHome 'vercel-cli/node_modules/vercel/dist/vc.js'
 if(!(Test-Path -LiteralPath $entry)){throw 'CLI Vercel não instalado neste computador.'}
 & $nodeCli.Source $entry @Comandos
}else{
 $binary=if($Servico -eq 'github'){'gh.exe'}else{'railway.exe'}
 $entry=Join-Path $cliHome ('cli/'+$binary)
 if(!(Test-Path -LiteralPath $entry)){throw 'CLI ainda não instalado neste computador.'}
 & $entry @Comandos
}
exit $LASTEXITCODE
