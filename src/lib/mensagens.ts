/**
 * Catálogo central de mensagens visíveis ao usuário.
 *
 * Por que existe: as mesmas mensagens de erro/aviso eram escritas à mão em
 * dezenas de lugares (páginas, server actions, rotas de API). O resultado era
 * inconsistência de tom ("Acesso negado" em uma tela, "Você não é coordenador
 * deste projeto" em outra) e, principalmente, vazamento de texto técnico
 * (mensagens cruas do Firebase, do Prisma e nomes de variáveis de ambiente)
 * direto para o usuário final.
 *
 * Regras de escrita das mensagens (seguir ao adicionar novas):
 *  1. Falar com a pessoa, não sobre o sistema. "Não conseguimos enviar seu
 *     arquivo" em vez de "Erro 500 no upload".
 *  2. Dizer o que aconteceu E o que fazer agora. Toda mensagem de erro precisa
 *     terminar com um próximo passo concreto.
 *  3. Nunca expor termo técnico: nome de variável de ambiente, nome de tabela
 *     ou coluna, status HTTP, stack trace, mensagem do Firebase/Prisma/API.
 *  4. Nada de culpar o usuário. "Confira" e "verifique" em vez de "você errou".
 *  5. Avisos informativos (não-erro) podem ser calorosos; erros em telas
 *     administrativas continuam calorosos, mas diretos e objetivos.
 *
 * Este arquivo é compartilhado por componentes client e código server: NÃO
 * importar nada de `@prisma/client`, `next/server` ou módulos com `server-only`,
 * senão o bundle do cliente quebra.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Genéricos e inesperados
// ─────────────────────────────────────────────────────────────────────────────

export const MENSAGENS = {
  erroInesperado:
    'Algo não saiu como esperado do nosso lado. Tente novamente em alguns instantes — se o problema continuar, fale com a equipe do portal.',
  erroInesperadoOrientacao:
    'Algo não saiu como esperado por aqui. Tente novamente em instantes.',
  erroRede:
    'Não conseguimos falar com o servidor. Confira sua conexão com a internet e tente novamente.',
  erroConexaoServidor:
    'Estamos com uma instabilidade momentânea de conexão. Aguarde alguns instantes e tente novamente.',
  tempoEsgotado:
    'A operação demorou mais que o esperado e foi interrompida. Tente novamente.',
  recursoIndisponivel:
    'Este recurso está temporariamente indisponível. Tente novamente mais tarde.',

  // ── Autenticação e sessão ──────────────────────────────────────────────────
  sessaoExpirada:
    'Sua sessão expirou por segurança. Entre novamente para continuar.',
  sessaoInvalida:
    'Não conseguimos confirmar sua sessão. Entre novamente para continuar.',
  naoAutenticado: 'Você precisa entrar na sua conta para continuar.',
  semPermissao:
    'Sua conta não tem permissão para esta ação. Se você acredita que isso é um engano, fale com a administração do portal.',
  semPermissaoAdmin:
    'Esta área é restrita à administração do portal. Entre com uma conta de administrador para continuar.',
  semPermissaoAdminGeral:
    'Esta ação é exclusiva do Administrador Geral do portal.',
  semPermissaoProfessor:
    'Esta ação é exclusiva de professores e administradores.',
  semPermissaoCoordenador:
    'Só quem coordena este projeto pode fazer essa alteração. Se precisar de acesso, fale com a coordenação.',
  emailOuSenhaIncorretos:
    'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  emailInvalido:
    'Esse e-mail não parece válido. Confira se digitou corretamente (exemplo: nome@email.com).',
  emailJaCadastrado:
    'Este e-mail já está cadastrado no portal. Tente entrar na sua conta ou recuperar a senha.',
  senhaCurta:
    'Sua senha precisa ter pelo menos 6 caracteres. Tente uma senha um pouco maior.',
  senhaFraca:
    'Essa senha é muito curta. Use pelo menos 6 caracteres.',
  senhasNaoConferem:
    'As duas senhas digitadas não são iguais. Digite novamente com atenção.',
  loginGoogleFalhou:
    'Não conseguimos entrar com o Google. Tente novamente ou use e-mail e senha.',
  loginGoogleCancelado:
    'O login com o Google foi cancelado. Para concluir o vínculo, é preciso autorizar o acesso.',
  contaCriada: 'Conta criada com sucesso! Estamos te levando para o portal...',
  usuarioNaoEncontrado:
    'Não encontramos sua conta no portal. Saia e entre novamente para continuar.',
  verificacaoSegurancaPendente:
    'Falta concluir a verificação de segurança. Marque a caixinha "Não sou um robô" logo abaixo e envie de novo.',
  verificacaoSegurancaFalhou:
    'Não conseguimos confirmar a verificação de segurança. Recarregue a página e tente novamente.',
  muitasTentativas:
    'Você fez muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
  muitasInscricoes:
    'Muitas inscrições em pouco tempo a partir deste dispositivo. Aguarde alguns minutos e tente novamente.',

  // ── Formulários e dados ────────────────────────────────────────────────────
  campoObrigatorio: (campo: string) => `Preencha o campo "${campo}" para continuar.`,
  selecioneOpcao: (campo: string) => `Escolha uma opção em "${campo}" para continuar.`,
  dadosInvalidos:
    'Alguns dados parecem incorretos. Confira os campos destacados e tente novamente.',
  dadosInvalidosGenerico:
    'Não conseguimos usar os dados enviados. Revise o formulário e tente novamente.',
  registroNaoEncontrado:
    'Não encontramos este registro. Ele pode ter sido removido por outra pessoa enquanto você estava nesta tela.',
  registroJaExiste:
    'Já existe um cadastro com essas informações. Confira os dados e tente novamente.',
  nomeDuplicado:
    'Já existe um cadastro com esse nome. Escolha um nome um pouco diferente para continuar.',
  falhaProtocolo:
    'Não conseguimos gerar o número de protocolo do seu cadastro. Tente enviar novamente.',
  registroDuplicado:
    'Já existe um registro com esses dados. Se precisar cadastrar outro, altere as informações que se repetem.',
  semDadosVinculados:
    'Não é possível excluir: existem outros registros ligados a este item. Desvincule-os antes de excluir.',
  operacaoNaoConcluida:
    'Não conseguimos concluir a operação. Tente novamente em alguns instantes.',

  // ── Arquivos ───────────────────────────────────────────────────────────────
  arquivoNaoEnviado:
    'Nenhum arquivo chegou até nós. Selecione o arquivo novamente e tente enviar.',
  arquivoVazio:
    'O arquivo enviado está vazio. Verifique o documento no seu computador e tente de novo.',
  arquivoTipoInvalido:
    'Este formato de arquivo não é aceito. Envie um PDF, PNG, JPG, WEBP ou GIF.',
  arquivoGrande: (limite: string) =>
    `O arquivo é maior que o limite de ${limite}. Reduza o tamanho ou divida o documento e tente novamente.`,
  arquivoGrandeGenerico:
    'O arquivo é maior que o limite permitido. Reduza o tamanho e tente novamente.',
  arquivoEnviado: 'Arquivo enviado com sucesso!',
  falhaEnvioArquivo:
    'Não conseguimos salvar seu arquivo. Tente novamente — se o problema continuar, envie em outro formato.',

  // ── Conteúdo e IA ──────────────────────────────────────────────────────────
  iaIndisponivel:
    'A assistente de IA está indisponível neste momento. Tente novamente em alguns minutos.',
  iaRespostaInvalida:
    'A IA não conseguiu responder no formato esperado. Tente novamente ou preencha o campo manualmente.',
  iaNaoConfigurada:
    'O recurso de IA ainda não foi ativado neste ambiente. Fale com a equipe responsável pelo portal.',
  iaSemConexao:
    'Não conseguimos falar com o serviço de IA. Verifique a conexão e tente novamente.',
  iaErro:
    'A IA encontrou um problema ao processar seu pedido. Tente novamente em alguns instantes.',
  camposIaObrigatorios: (campos: string) =>
    `Para usar a IA, preencha antes: ${campos}.`,

  // ── Integração SUAP / sincronização ────────────────────────────────────────
  suapIndisponivel:
    'O SUAP não respondeu como esperado. Tente novamente em alguns minutos.',
  suapCredenciaisInvalidas:
    'Usuário ou senha do SUAP incorretos. Confira os dados e tente novamente.',
  suapNaoConfigurado:
    'A integração com o SUAP ainda não está configurada neste ambiente. Fale com a equipe técnica do portal.',
  suapTokenInvalido:
    'O token do SUAP informado não é válido. Gere um novo token no SUAP e cole aqui.',
  suapTokenFormatoInvalido:
    'Esse texto não parece ser um token do SUAP. O token costuma começar com "eyJ" — confira e cole novamente.',
  suapTokenSalvo: 'Token do SUAP salvo com sucesso! A sincronização já pode ser usada.',
  suapErroSalvarToken:
    'Não conseguimos salvar o token do SUAP. Confira os dados e tente novamente.',

  // ── E-mail ─────────────────────────────────────────────────────────────────
  emailEnviado:
    'Se existir uma conta com este e-mail, você vai receber um link de recuperação em instantes. Verifique sua caixa de entrada e o spam.',
  falhaEnvioEmail:
    'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.',
  emailNaoConfigurado:
    'O envio de e-mails ainda não foi ativado neste ambiente, então este aviso não saiu. Fale com a equipe do portal se precisar de ajuda.',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Erros técnicos → mensagem amigável
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assinaturas de erro técnico que jamais devem chegar ao usuário. A ordem
 * importa: as verificações mais específicas vêm antes das genéricas.
 */
const PADROES_TECNICOS: ReadonlyArray<readonly [RegExp, string]> = [
  // Prisma / Postgres — constraints
  [/unique constraint|duplicate key|already exists/i, MENSAGENS.registroJaExiste],
  [/foreign key constraint|violates foreign key/i, MENSAGENS.semDadosVinculados],
  [
    /record to (delete|update) does not exist|record not found|an operation failed because it depends on one or more records that were required but not found/i,
    MENSAGENS.registroNaoEncontrado,
  ],
  [/invalid value|invalid `prisma|argument .* is missing|unknown argument/i, MENSAGENS.dadosInvalidos],
  [/null constraint|required but not found|missing required/i, MENSAGENS.dadosInvalidos],
  // Prisma / Postgres — infraestrutura
  [/econnrefused|connection refused|could not connect|can't reach database|p1001|p1002/i, MENSAGENS.erroConexaoServidor],
  [/etimedout|timeout|timed out|p2024|p1008/i, MENSAGENS.tempoEsgotado],
  [/prepared statement|p1000|authentication failed for user|password authentication/i, MENSAGENS.recursoIndisponivel],
  // Configuração de ambiente
  [/api[_ ]?key|_key não configurad|not configured|env var|environment variable/i, MENSAGENS.iaNaoConfigurada],
  // Firebase Auth (códigos crus e mensagens em inglês)
  [/auth\/invalid-email/i, MENSAGENS.emailInvalido],
  [/auth\/email-already-in-use/i, MENSAGENS.emailJaCadastrado],
  [/auth\/weak-password/i, MENSAGENS.senhaFraca],
  [/auth\/(user-not-found|wrong-password|invalid-credential|invalid-login-credentials)/i, MENSAGENS.emailOuSenhaIncorretos],
  [/auth\/(too-many-requests|quota-exceeded)/i, MENSAGENS.muitasTentativas],
  [/auth\/(network-request-failed|internal-error)/i, MENSAGENS.erroRede],
  [/auth\/popup-closed-by-user|cancelled-popup-request/i, MENSAGENS.loginGoogleCancelado],
  [/firebase/i, MENSAGENS.erroInesperadoOrientacao],
  // Erros de rede / fetch no cliente
  [/failed to fetch|networkerror|network request failed|load failed/i, MENSAGENS.erroRede],
  [/fetch failed|socket hang up|econnreset|epipe/i, MENSAGENS.erroConexaoServidor],
  // IA
  [/llm api error|gemini|deepseek|embedding/i, MENSAGENS.iaErro],
  [/json válido|valid json|unexpected token .* in json|no json object/i, MENSAGENS.iaRespostaInvalida],
  // SUAP
  [/suap/i, MENSAGENS.suapIndisponivel],
];

/** Termos que denunciam mensagem técnica (nunca devem passar para a tela). */
const TERMOS_TECNICOS =
  /\b(prisma|postgres|postgresql|pgvector|null constraint|foreign key|nextresponse|json\.parse|stack|trace|econnrefused|etimedout|api[_ ]key|env\.|process\.env|localhost:\d+|http \d{3}|status \d{3}|undefined|\[object object\]|error:|exception|token inválido|invalid token)\b/i;

/** Nomes de variáveis de ambiente que não podem aparecer na interface. */
const VARIAVEIS_AMBIENTE = /\b[A-Z][A-Z0-9_]{2,}_[A-Z0-9_]+\b/;

/**
 * Converte qualquer erro em uma mensagem que faça sentido para quem está usando
 * o portal. Use em toda fronteira onde um erro de terceiro (Firebase, Prisma,
 * API de IA, rede) puder virar texto na tela.
 *
 * Mensagens que já estão em português e não contêm termo técnico passam
 * intactas — assim este helper pode ser aplicado sem medo sobre textos que já
 * foram revisados.
 */
export function mensagemAmigavel(
  erro: unknown,
  fallback: string = MENSAGENS.erroInesperadoOrientacao
): string {
  const bruto = extrairTexto(erro);
  if (!bruto) return fallback;

  // Texto curto, em português e sem nenhum termo técnico: já é uma mensagem
  // escrita para o usuário (ex.: "SUAP fora do ar", vinda de um serviço
  // interno). Reescrever por cima só pioraria — e as regras abaixo casariam
  // por engano com a palavra "SUAP".
  const pareceAmigavel =
    bruto.length <= 300 &&
    !TERMOS_TECNICOS.test(bruto) &&
    !VARIAVEIS_AMBIENTE.test(bruto) &&
    !/^[a-z\s]*error|exception|failed|undefined|null/i.test(bruto);

  if (pareceAmigavel) return bruto;

  for (const [padrao, mensagem] of PADROES_TECNICOS) {
    if (padrao.test(bruto)) return mensagem;
  }

  return fallback;
}

/** Extrai um texto legível de qualquer coisa que tenha sido lançada. */
function extrairTexto(erro: unknown): string {
  if (!erro) return '';
  if (typeof erro === 'string') return erro.trim();
  if (erro instanceof Error) return (erro.message || '').trim();
  if (typeof erro === 'object') {
    const comMensagem = erro as { message?: unknown; error?: unknown };
    if (typeof comMensagem.message === 'string') return comMensagem.message.trim();
    if (typeof comMensagem.error === 'string') return comMensagem.error.trim();
    try {
      return String(erro).trim();
    } catch {
      return '';
    }
  }
  return String(erro).trim();
}

/**
 * Normaliza uma mensagem de erro que veio do servidor antes de exibi-la.
 *
 * Server actions e rotas de API devolvem `{ ok: false, error }`. Quando o texto
 * recebido é técnico (ou está vazio), cai no `fallback`.
 */
export function mensagemDeErroServidor(
  mensagem: unknown,
  fallback: string = MENSAGENS.operacaoNaoConcluida
): string {
  if (typeof mensagem !== 'string' || !mensagem.trim()) return fallback;
  return mensagemAmigavel(mensagem, fallback);
}

/**
 * Versão de `mensagemAmigavel` para erros internos inesperados: usa o texto
 * genérico "algo não saiu como esperado", sem tentar reaproveitar nada do erro
 * original (útil em `catch` que envolvem código que não é do domínio).
 */
export function mensagemErroInterno(): string {
  return MENSAGENS.erroInesperado;
}
