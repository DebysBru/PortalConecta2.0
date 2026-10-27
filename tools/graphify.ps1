# Usa o ambiente Python local, sem alterar o PATH ou a instalação global.
$graphifyPython = Join-Path $PSScriptRoot '../.graphify-venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $graphifyPython)) {
    throw 'Graphify ausente. Consulte DOCUMENTACAO/GRAPHIFY.md para instalar.'
}
$env:PYTHONUTF8 = '1'
& $graphifyPython -m graphify @args
exit $LASTEXITCODE
