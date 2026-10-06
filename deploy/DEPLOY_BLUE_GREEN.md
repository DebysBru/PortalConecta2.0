# Deploy blue-green na VPS — runbook

Procedimento usado no deploy de produção (`portal.ifcoding.com.br`, VPS
`198.44.123.154`, serviço `portal-conecta.service`, código em
`/var/www/portal-conecta`, porta 3000 atrás do nginx).

Ele existe para **não tirar o site do ar durante o build**: a aplicação nova é
construída numa pasta paralela (`/var/www/portal-conecta-novo`) e a troca de
pastas leva poucos segundos.

> Origem deste documento: o deploy de 05/10/2026 deixou dois rastros que viraram
> bug para o usuário — chunks antigos sumindo no meio do uso (`Application
> error: a client-side exception has occurred` em `/cadastro`) e arquivos de
> `public/` que nunca chegaram ao servidor (favicon e ícones do PWA em 404).
> Os passos 4 e 6 abaixo são exatamente o que faltava. Ver DECISIONS.md §25.

---

## Antes de começar

```bash
# na máquina local: nada pendente que você não queira publicar
git status --porcelain
```

- O deploy **não é um `git pull`**: a árvore de produção é atualizada por
  cópia de arquivos. Confira que a comparação inclui **`public/`** — ele não
  está versionado no git hoje (aparece como `?? public/`), então não aparece em
  `git status` de arquivos rastreados e foi justamente o que ficou de fora.
- `prisma db push` continua proibido (Dec. 11): migrações são SQL idempotente
  aplicado à mão.

## 1. Backup

```bash
systemctl stop portal-conecta    # só depois do build, no passo 5
tar czf /root/portal-conecta-codigo-$(date +%F).tgz -C /var/www portal-conecta
pg_dump -Fc portal_conecta > /root/portal_conecta-$(date +%F).dump
cp /etc/nginx/sites-available/portal.ifcoding.com.br /root/
```

## 2. Copiar a árvore e aplicar as mudanças

```bash
cp -a /var/www/portal-conecta /var/www/portal-conecta-novo
# aplicar por cima os arquivos alterados/novos (src/, prisma/, deploy/,
# configs **e public/** — este último é o que faltou em 05/10)
```

`node_modules` pode ir por hard link (`cp -al`) para não gastar disco, mas
`.prisma/` e `@prisma/` precisam ser cópias de verdade — senão o
`prisma generate` do diretório novo mexe no client que a produção está usando.

## 3. Migrações idempotentes

```bash
# rodar os SQL de prisma/*-setup.sql que mudaram neste deploy, um a um
```

## 4. ⚠️ Preservar os chunks do build que está no ar (o passo que faltava)

```bash
# .next/static é imutável e tem hash no nome do arquivo: juntar o antigo com o
# novo nunca sobrescreve nada (mesmo nome = mesmo conteúdo). Sem isso, quem
# está com o portal aberto durante a troca passa a pedir arquivos que não
# existem mais → ChunkLoadError → tela de "Application error".
#
# A origem é o build QUE ESTÁ NO AR (/var/www/portal-conecta), não o -old: é o
# bundle dele que os navegadores ainda têm em cache.
cp -rn /var/www/portal-conecta/.next/static/. /var/www/portal-conecta-novo/.next/static/
```

Isso precisa ser **depois** do `npm run build` no diretório novo — o Next limpa
`.next` no começo da build, então copiar antes não adianta:

```bash
cd /var/www/portal-conecta-novo && npm run build
cp -rn /var/www/portal-conecta/.next/static/. /var/www/portal-conecta-novo/.next/static/
```

Alternativa: servir `/_next/static/` pelo nginx com `try_files` caindo também
na pasta do build antigo. A cópia é mais simples e não mexe no vhost.

> Mesmo com os chunks antigos no ar, o cliente antigo pode não conseguir montar
> a rota nova (os ids de módulo mudam entre builds). Para esse caso existe a
> rede de segurança do passo 7.

## 5. Troca (≈6 s fora do ar)

Rode o script testado na VPS (`/root/troca-portal.sh`) ou faça na mão com o
mesmo cuidado:

```bash
systemctl stop portal-conecta

# ⚠️ `mv A B` com B JÁ EXISTENTE move A PARA DENTRO de B (não sobrescreve).
# Se o -old foi apagado na limpeza (ou é de outra rodada), o `mv` seguinte falha
# — e com `set -e` o script morre DEPOIS do stop, deixando o site fora do ar.
# Foi exatamente o que aconteceu em 06/10/2026 (20 s de queda, sem 5xx no nginx).
if [ -e /var/www/portal-conecta-old ]; then
  mv /var/www/portal-conecta-old "/var/www/portal-conecta-old-$(date +%Y%m%d-%H%M)"
fi

mv /var/www/portal-conecta /var/www/portal-conecta-old
mv /var/www/portal-conecta-novo /var/www/portal-conecta
systemctl start portal-conecta
```

O `/root/troca-portal.sh` faz exatamente isso: confere o `BUILD_ID` do build
novo, mescla os chunks do build atual no novo, guarda o `-old` existente com
carimbo de data em vez de falhar, troca as pastas e sobe o serviço — terminando
com `systemctl is-active` e um `curl` em `/` e `/cadastro`.

## 6. nginx

```bash
nginx -t && systemctl reload nginx
```

## 7. Verificação (não é opcional)

```bash
systemctl status portal-conecta --no-pager
journalctl -u portal-conecta -n 50 --no-pager | grep -i error
```

- Todas as páginas públicas 200 por HTTPS **de fora da VPS**;
- `/favicon.ico`, `/icons/icon-192.png`, `/icons/icon.svg`,
  `/apple-touch-icon.png` → 200 (eram 404 enquanto `public/` não subia);
- login real (aluno e professor) com cookie de sessão: 200 em `/meus-dados`,
  `/minha-area`, `/professor/*`;
- `/cadastro` renderiza o formulário **com JS**: abrir com o DevTools aberto e
  conferir que não há `ChunkLoadError` nem "Application error";
- upload de imagem pelo painel → servido pelo nginx → `/api/files/peso`.

## Rollback

### Rápido (≈20 s) — enquanto `portal-conecta-old` existir

```bash
systemctl stop portal-conecta
mv /var/www/portal-conecta /var/www/portal-conecta-novo
mv /var/www/portal-conecta-old /var/www/portal-conecta
systemctl start portal-conecta
```

Esse caminho de 20 s só existe porque o passo 5 **guarda o build anterior em
`portal-conecta-old`**. Se você apagar essa pasta na limpeza, o rollback rápido
deixa de existir.

### Por tarball (≈1-2 min) — quando não há `-old`

Os backups de `/root/portal-conecta-codigo-<data>.tgz` guardam a árvore inteira
(código **e** `.next`), então restaurar não exige `npm run build`. Em 05/10/2026
deixamos um script pronto na VPS:

```bash
bash /root/rollback-portal.sh                    # backup de 19:47 (build 887zxvLK3wAiaOVHIqLIf)
bash /root/rollback-portal.sh /root/portal-conecta-codigo-2026-10-05-1910.tgz
```

Ele para o serviço, move a árvore atual para `/var/www/portal-conecta-atual-<data>`
(em vez de apagar), extrai o tarball, reajusta o dono e sobe de novo.

> Antes de confiar num tarball, confira qual build ele devolve:
> `tar xzOf <tarball> portal-conecta/.next/BUILD_ID`

## Limpeza dos builds antigos

`portal-conecta-old` e `portal-conecta-old-anterior` acumulam ~1,3 G aparentes
cada (boa parte em `node_modules` por hard link, então o disco liberado é bem
menor). Ao limpar:

1. **nunca** inclua `/var/www/portal-conecta` (o build no ar) na lista;
2. confirme antes que o tarball de backup devolve o `BUILD_ID` que você está
   apagando (`tar xzOf ... portal-conecta/.next/BUILD_ID`);
3. `gzip -t` nos tarballs que pretende manter como rollback;
4. `rm -rf --one-file-system <pasta>` e, depois, conferir `systemctl is-active`
   e um `curl` em `/` e `/cadastro`.

Feito em 05/10/2026: as duas pastas antigas foram removidas e o rollback passou
a ser o `rollback-portal.sh` (backup de 19:47 = build `887zxvLK3wAiaOVHIqLIf`).

## Por que a tela ficava branca (reprodução rápida)

Com o servidor de produção rodando local:

1. abrir `http://localhost:3000/admin/login` no Chrome;
2. DevTools → Network → bloquear
   `*/chunks/app/cadastro/*`;
3. clicar em "Criar Conta".

Sem o passo 4 e sem o script de recuperação (`src/lib/recuperacao-build.ts`), a
rota fica sem conteúdo e o console mostra
`ChunkLoadError: Loading chunk N failed`. Com a correção, a página se recarrega
sozinha e o formulário aparece.
