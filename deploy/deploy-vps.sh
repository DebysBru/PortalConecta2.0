#!/usr/bin/env bash
# ==============================================================================
# Deploy do Portal Conecta na VPS — build + troca blue-green, sem passo manual.
#
#   bash deploy/deploy-vps.sh deploy     # build + troca + verificacao + limpeza
#   bash deploy/deploy-vps.sh build      # so prepara/compila /var/www/portal-conecta-novo
#   bash deploy/deploy-vps.sh troca      # so troca (usa o build que ja esta no -novo)
#   bash deploy/deploy-vps.sh estado     # mostra o que esta no ar agora
#   bash deploy/deploy-vps.sh rollback   # volta para o -old mais recente
#
# Flags:
#   --novo DIR      pasta de build (padrao /var/www/portal-conecta-novo)
#   --atual DIR     pasta no ar    (padrao /var/www/portal-conecta)
#   --sem-fora      nao testa a URL publica (util quando o DNS/nginx esta fora)
#   --manter N      quantas pastas -old manter (padrao 1; 0 = apagar todas)
#
# Este script e a versao automatizada de deploy/DEPLOY_BLUE_GREEN.md. O fluxo do
# GitHub Actions (.github/workflows/deploy-vps.yml) faz o rsync do repositorio
# para a pasta -novo e chama `deploy` aqui. Rodar na mao tambem funciona.
#
# Regras que o script respeita (e que nao mudam sozinhas):
#   - `.env` NUNCA vem do repositorio: e copiado da pasta que esta no ar, com
#     dono e permissao preservados (600). Sem isso o app sobe sem variavel.
#   - `prisma db push` continua proibido (Decisao 11). Migracao e SQL idempotente
#     aplicado a mao; o workflow da GitHub Actions para e avisa quando um
#     prisma/*-setup.sql muda no commit.
#   - Os chunks do build que esta no ar sao mesclados no build novo antes da
#     troca: quem esta com o portal aberto nao toma ChunkLoadError.
#   - Se o portal nao responder depois da troca, o script volta sozinho para o
#     build anterior e termina com codigo de erro.
# ==============================================================================
set -Eeuo pipefail

ATUAL=/var/www/portal-conecta
NOVO=/var/www/portal-conecta-novo
SERVICO=portal-conecta
PORTA=3000
DONO=portal:portal
TESTAR_FORA=1
URL_PUBLICA=https://portal.ifcoding.com.br/
MANTER_ANTIGOS=1
ESPERA_NO_AR=60

while [ $# -gt 0 ]; do
  case "$1" in
    --novo)    NOVO="$2"; shift 2 ;;
    --atual)   ATUAL="$2"; shift 2 ;;
    --sem-fora) TESTAR_FORA=0; shift ;;
    --manter)  MANTER_ANTIGOS="$2"; shift 2 ;;
    deploy|build|troca|estado|rollback) ACAO="$1"; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done
ACAO="${ACAO:-deploy}"

msg()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
erro() { printf '\n\033[31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }
trap 'erro "falhou na linha $LINENO (comando: $BASH_COMMAND)"' ERR

[ "$(id -u)" -eq 0 ] || erro "rode como root (o systemctl e o chown precisam disso)"
[ -d "$ATUAL" ] || erro "nao existe $ATUAL — este script faz deploy por cima de uma instalacao existente"

build_id() { [ -f "$1/.next/BUILD_ID" ] && cat "$1/.next/BUILD_ID" || echo "(sem build)"; }

no_ar() {
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORTA}/" || true)
  [ "$codigo" = "200" ]
}

esperar_no_ar() {
  local fim=$((SECONDS + ESPERA_NO_AR))
  while [ $SECONDS -lt $fim ]; do
    if systemctl is-active --quiet "$SERVICO" && no_ar; then return 0; fi
    sleep 2
  done
  return 1
}

estado() {
  msg "estado atual"
  info "servico:            $(systemctl is-active "$SERVICO" || true)"
  info "build no ar:        $(build_id "$ATUAL")  ($ATUAL)"
  [ -d "$NOVO" ] && info "build em preparo:   $(build_id "$NOVO")  ($NOVO)" || info "build em preparo:   (nao existe)"
  info "reescrita do app:   $(systemctl show "$SERVICO" -p ExecMainStartTimestamp --value)"
  info "porta ${PORTA}:        $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORTA}/" || true)"
  info "pastas antigas:     $(ls -d /var/www/portal-conecta-old* 2>/dev/null | wc -l)"
}

# ------------------------------------------------------------------------------
# build: deixa a pasta -novo pronta para entrar no ar
# ------------------------------------------------------------------------------
fase_build() {
  msg "1. conferindo a origem do build"
  [ -f "$NOVO/package.json" ] || erro "$NOVO nao tem package.json — o rsync do repositorio rodou?"
  [ -f "$NOVO/deploy/deploy-vps.sh" ] || erro "$NOVO nao tem deploy/deploy-vps.sh — rsync incompleto?"
  info "commit enviado: $(git -C "$NOVO" rev-parse --short HEAD 2>/dev/null || echo '(sem .git — normal no deploy por rsync)')"
  info "build no ar:    $(build_id "$ATUAL")"

  msg "2. copiando os arquivos de runtime que NAO vem do git"
  [ -f "$ATUAL/.env" ] || erro "$ATUAL/.env nao existe — sem .env o app nao sobe"
  cp -a "$ATUAL/.env" "$NOVO/.env"
  chmod 600 "$NOVO/.env"
  info ".env copiado ($(wc -c < "$NOVO/.env") bytes, modo 600)"
  for extra in .suap-token.json; do
    if [ -f "$ATUAL/$extra" ]; then cp -a "$ATUAL/$extra" "$NOVO/$extra"; info "$extra copiado"; fi
  done

  msg "3. dependencias"
  # `npm ci` e a escolha aqui: instala exatamente o que esta no package-lock e
  # NUNCA reescreve o lock. A alternativa (hard link do node_modules no ar +
  # `npm install`) e mais rapida, mas dois riscos nao valem a economia: o
  # `npm install` regrava o package-lock (o servidor passa a divergir do git) e
  # um arquivo reescrito no lugar alteraria tambem a arvore que esta no ar.
  if [ -f "$NOVO/package-lock.json" ]; then
    info "npm ci (fiel ao package-lock; cache local: $(du -sh /root/.npm 2>/dev/null | cut -f1 || echo 'vazio'))"
    ( cd "$NOVO" && npm ci --no-audit --no-fund --loglevel=error )
  else
    info "sem package-lock.json: npm install"
    ( cd "$NOVO" && npm install --no-audit --no-fund --loglevel=error )
  fi

  msg "4. build do Next.js"
  info "NODE_OPTIONS=${NODE_OPTIONS:---max-old-space-size=1536}"
  ( cd "$NOVO" && NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}" NODE_ENV=production npm run build )

  msg "5. conferindo o build"
  [ -f "$NOVO/.next/BUILD_ID" ] || erro "o build nao gerou .next/BUILD_ID"
  [ -d "$NOVO/.next/server" ] || erro "o build nao gerou .next/server"
  info "BUILD_ID novo: $(build_id "$NOVO")"

  chown -R "$DONO" "$NOVO"
  info "dono ajustado para $DONO"
}

# ------------------------------------------------------------------------------
# troca: blue-green com preservacao de chunks e rollback automatico
# ------------------------------------------------------------------------------
fase_troca() {
  msg "6. saneidade antes da troca"
  [ -f "$NOVO/.next/BUILD_ID" ] || erro "sem .next/BUILD_ID em $NOVO — rode o build antes"
  [ -f "$NOVO/.env" ] || erro "$NOVO/.env nao existe — o app subiria sem variavel de ambiente"
  info "build no ar: $(build_id "$ATUAL")"
  info "build novo:  $(build_id "$NOVO")"

  msg "7. preservando os chunks do build que esta no ar"
  mkdir -p "$NOVO/.next/static"
  cp -rn "$ATUAL/.next/static/." "$NOVO/.next/static/"
  chown -R "$DONO" "$NOVO/.next"
  info "arquivos js em .next/static: $(find "$NOVO/.next/static" -name '*.js' | wc -l)"

  msg "8. troca (o portal fica fora do ar por poucos segundos)"
  systemctl stop "$SERVICO"
  if [ -e /var/www/portal-conecta-old ]; then
    local arquivada="/var/www/portal-conecta-old-$(date +%Y%m%d-%H%M%S)"
    info "o -old anterior vai para $arquivada"
    mv /var/www/portal-conecta-old "$arquivada"
  fi
  mv "$ATUAL" /var/www/portal-conecta-old
  mv "$NOVO" "$ATUAL"
  systemctl start "$SERVICO"
  info "servico iniciado"

  msg "9. verificacao (com rollback automatico se falhar)"
  if esperar_no_ar; then
    info "http://127.0.0.1:${PORTA}/ -> 200 em $(systemctl show "$SERVICO" -p ExecMainStartTimestamp --value)"
  else
    msg "o portal nao respondeu — voltando para o build anterior"
    systemctl stop "$SERVICO" || true
    mv "$ATUAL" "/var/www/portal-conecta-falhou-$(date +%Y%m%d-%H%M%S)"
    mv /var/www/portal-conecta-old "$ATUAL"
    systemctl start "$SERVICO"
    if esperar_no_ar; then
      erro "o build novo nao subiu; o anterior voltou ao ar ($(build_id "$ATUAL")). Veja: journalctl -u $SERVICO -n 100"
    else
      erro "o portal esta fora do ar e o rollback automatico tambem nao respondeu — intervencao manual necessaria"
    fi
  fi

  info "rotas que dependem do banco:"
  for rota in / /editais /projetos /agenda /cadastro; do
    info "  GET $rota -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:${PORTA}${rota}" || echo 'sem resposta')"
  done

  if [ "$TESTAR_FORA" -eq 1 ]; then
    local fora
    fora=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL_PUBLICA" || echo 'sem resposta')
    info "de fora ($URL_PUBLICA) -> $fora"
    [ "$fora" = "200" ] || info "ATENCAO: a URL publica nao devolveu 200 (o app local esta de pe; veja nginx/DNS)"
  fi

  msg "10. no ar"
  info "build: $(build_id "$ATUAL")"
  info "arquivo: $ATUAL"
}

# ------------------------------------------------------------------------------
# limpeza dos builds antigos (o -old mais recente e o rollback rapido)
# ------------------------------------------------------------------------------
fase_limpar() {
  msg "11. limpando builds antigos (mantendo $MANTER_ANTIGOS)"
  local pastas
  pastas=$(ls -1d /var/www/portal-conecta-old-* /var/www/portal-conecta-falhou-* 2>/dev/null | sort || true)
  [ -n "$pastas" ] || { info "nada para limpar"; return 0; }
  local total
  total=$(echo "$pastas" | wc -l)
  local apagar=$((total - MANTER_ANTIGOS))
  if [ "$apagar" -le 0 ]; then info "$total pasta(s): todas ficam"; return 0; fi
  echo "$pastas" | head -n "$apagar" | while IFS= read -r pasta; do
    case "$pasta" in
      /var/www/portal-conecta) erro "recusando apagar a pasta no ar" ;;
      /var/www/portal-conecta-*) info "apagando $pasta"; rm -rf --one-file-system "$pasta" ;;
      *) info "ignorando $pasta (fora do padrao)" ;;
    esac
  done
  info "disco: $(df -h /var/www | awk 'NR==2 {print $4" livres ("$5" usado)"}')"
}

fase_rollback() {
  msg "rollback manual"
  local anterior
  anterior=$(ls -1d /var/www/portal-conecta-old-* 2>/dev/null | sort | tail -1 || true)
  [ -n "$anterior" ] || erro "nao ha build anterior para voltar"
  [ -f "$anterior/.next/BUILD_ID" ] || erro "$anterior nao tem build valido"
  info "voltando para $anterior ($(build_id "$anterior"))"
  systemctl stop "$SERVICO"
  mv "$ATUAL" "/var/www/portal-conecta-descartado-$(date +%Y%m%d-%H%M%S)"
  mv "$anterior" "$ATUAL"
  systemctl start "$SERVICO"
  esperar_no_ar && info "no ar de novo: $(build_id "$ATUAL")" || erro "o build anterior tambem nao respondeu"
}

case "$ACAO" in
  estado)   estado ;;
  build)    fase_build ;;
  troca)    fase_troca ;;
  rollback) fase_rollback ;;
  deploy)
    fase_build
    fase_troca
    fase_limpar
    estado
    ;;
esac
