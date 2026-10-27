import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

/**
 * Testes dos critérios §14 do SPEC (bloco "Geral / permissões"):
 *  - visitante não autenticado não lê dados de inscritos;
 *  - professor vê inscritos/apenas os SEUS projetos;
 *  - e-mail fora do domínio institucional NUNCA é promovido a professor.
 *
 * `src/lib/permissions.ts` é a fonte única dessas regras (usada por admin.ts,
 * professor.ts e pelos layouts de /admin e /professor), então é aqui que os
 * critérios ficam blindados.
 *
 * Atenção: o módulo lê ALLOWED_PROFESSOR_DOMAIN/ADMIN_EMAILS no momento do
 * import — por isso o env é fixado ANTES do import dinâmico.
 */

const prismaMock = vi.hoisted(() => ({
  projeto: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));

/**
 * Sessão verificada (cookie httpOnly). É o que o servidor de fato conhece: o
 * e-mail que as Server Actions recebem do cliente NÃO prova identidade, então
 * `temAcessoAoProjeto`/`projetosAcessiveis` só aceitam o e-mail que bate com o
 * da sessão. Aqui a sessão é controlada por teste.
 */
const sessaoMock = vi.hoisted(() => ({ getVerifiedServerSession: vi.fn() }));
vi.mock('@/lib/session', () => sessaoMock);

/** Simula "o navegador desta pessoa está logado com este e-mail". */
function logadoComo(email: string | null) {
  sessaoMock.getVerifiedServerSession.mockResolvedValue(email ? { uid: 'uid-teste', email } : null);
}

const MASTER = 'master@ifpr.edu.br';

vi.stubEnv('ADMIN_EMAILS', `${MASTER},segundo@ifpr.edu.br`);
vi.stubEnv('ALLOWED_PROFESSOR_DOMAIN', 'ifpr.edu.br');

let perms: typeof import('@/lib/permissions');

beforeAll(async () => {
  perms = await import('@/lib/permissions');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Por padrão ninguém está logado: cada teste que precisa de acesso diz como.
  logadoComo(null);
});

describe('domínio institucional (critério: não promover quem é de fora)', () => {
  it('aceita e-mail @ifpr.edu.br, sem diferenciar maiúsculas', () => {
    expect(perms.isDominioInstitucional('alguem@ifpr.edu.br')).toBe(true);
    expect(perms.isDominioInstitucional('ALGUEM@IFPR.EDU.BR')).toBe(true);
  });

  it('recusa domínios parecidos (sufixo enganoso não passa)', () => {
    expect(perms.isDominioInstitucional('alguem@gmail.com')).toBe(false);
    expect(perms.isDominioInstitucional('alguem@ifpr.edu.br.evil.com')).toBe(false);
    expect(perms.isDominioInstitucional('alguem@fake-ifpr.edu.br.net')).toBe(false);
  });
});

describe('Administrador Geral', () => {
  it('reconhece apenas o PRIMEIRO e-mail da lista ADMIN_EMAILS', () => {
    expect(perms.isAdministradorGeral(MASTER)).toBe(true);
    expect(perms.isAdministradorGeral('segundo@ifpr.edu.br')).toBe(false);
  });

  it('ignora maiúsculas/minúsculas', () => {
    expect(perms.isAdministradorGeral(MASTER.toUpperCase())).toBe(true);
  });

  it('passa em qualquer checagem de projeto SEM consultar o banco', async () => {
    logadoComo(MASTER);

    const temAcesso = await perms.temAcessoAoProjeto('projeto-de-outro', MASTER);

    expect(temAcesso).toBe(true);
    expect(prismaMock.projeto.findUnique).not.toHaveBeenCalled();
  });

  it('NÃO passa quando o e-mail do admin é afirmado sem sessão (o furo corrigido)', async () => {
    // Cenário do ataque: chamar a Server Action com o e-mail do Administrador
    // Geral — que é público na documentação — sem estar logado como ele.
    logadoComo(null);

    expect(await perms.temAcessoAoProjeto('projeto-de-outro', MASTER)).toBe(false);
    expect(await perms.projetosAcessiveis(MASTER)).toEqual([]);
    expect(prismaMock.projeto.findMany).not.toHaveBeenCalled();
  });

  it('NÃO passa quando a sessão é de OUTRA pessoa', async () => {
    logadoComo('invasor@ifpr.edu.br');

    expect(await perms.temAcessoAoProjeto('projeto-de-outro', MASTER)).toBe(false);
    expect(await perms.projetosAcessiveis(MASTER)).toEqual([]);
  });
});

describe('acesso a projeto — professor só entra no que é dele', () => {
  const projetoDoProfessor = {
    coordenadorEmail: 'prof@ifpr.edu.br',
    viceCoordenadorEmail: null,
    admins: [],
    coordenadores: [],
  };

  it('reconhece coordenador, vice, admin explícito e coordenador cadastrado', () => {
    expect(perms.projetoTemAcesso(projetoDoProfessor, 'prof@ifpr.edu.br')).toBe(true);
    expect(
      perms.projetoTemAcesso({ ...projetoDoProfessor, viceCoordenadorEmail: 'vice@ifpr.edu.br' }, 'vice@ifpr.edu.br'),
    ).toBe(true);
    expect(
      perms.projetoTemAcesso({ ...projetoDoProfessor, admins: [{ email: 'apoio@ifpr.edu.br' }] }, 'apoio@ifpr.edu.br'),
    ).toBe(true);
    expect(
      perms.projetoTemAcesso(
        { ...projetoDoProfessor, coordenadores: [{ user: { email: 'coord@ifpr.edu.br' } }] },
        'coord@ifpr.edu.br',
      ),
    ).toBe(true);
  });

  it('nega quem não tem vínculo nenhum', () => {
    expect(perms.projetoTemAcesso(projetoDoProfessor, 'estranho@ifpr.edu.br')).toBe(false);
  });

  it('nega projeto de outro professor (busca no banco)', async () => {
    logadoComo('prof@ifpr.edu.br');
    prismaMock.projeto.findUnique.mockResolvedValue(null);

    expect(await perms.temAcessoAoProjeto('projeto-alheio', 'prof@ifpr.edu.br')).toBe(false);
  });

  it('nega quando o e-mail não é coordenador do projeto encontrado', async () => {
    logadoComo('prof@ifpr.edu.br');
    prismaMock.projeto.findUnique.mockResolvedValue({
      coordenadorEmail: 'outro@ifpr.edu.br',
      viceCoordenadorEmail: null,
      admins: [],
      coordenadores: [],
    });

    expect(await perms.temAcessoAoProjeto('id', 'prof@ifpr.edu.br')).toBe(false);
  });
});

describe('projetosAcessiveis — escopo da listagem', () => {
  it('Administrador Geral lista todos (sem filtro de vínculo)', async () => {
    logadoComo(MASTER);
    prismaMock.projeto.findMany.mockResolvedValue([]);

    await perms.projetosAcessiveis(MASTER);

    const argumento = prismaMock.projeto.findMany.mock.calls[0][0];
    expect(argumento?.where).toBeUndefined();
  });

  it('professor lista somente os projetos em que tem vínculo', async () => {
    logadoComo('prof@ifpr.edu.br');
    prismaMock.projeto.findMany.mockResolvedValue([]);

    await perms.projetosAcessiveis('prof@ifpr.edu.br');

    const argumento = prismaMock.projeto.findMany.mock.calls[0][0];
    expect(argumento.where).toEqual(perms.whereUsuarioTemAcessoAoProjeto('prof@ifpr.edu.br'));
    expect(JSON.stringify(argumento.where)).toContain('prof@ifpr.edu.br');
  });
});

describe('resolveUserRole — papel recalculado ao vivo', () => {
  it('Administrador Geral é sempre ADMIN (e é persistido)', async () => {
    prismaMock.user.upsert.mockResolvedValue({});

    expect(await perms.resolveUserRole(MASTER)).toBe('ADMIN');
    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { role: 'ADMIN' } }),
    );
  });

  it('usuário que nunca logou devolve null', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect(await perms.resolveUserRole('novo@gmail.com')).toBeNull();
  });

  it('e-mail fora do domínio NÃO é promovido: papel legado é corrigido para ESTUDANTE', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'PROFESSOR' });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.projeto.count.mockResolvedValue(3);

    const role = await perms.resolveUserRole('impostor@gmail.com');

    expect(role).toBe('ESTUDANTE');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { email: 'impostor@gmail.com' },
      data: { role: 'ESTUDANTE' },
    });
    // Nem chega a consultar projetos: fora do domínio, a resposta é sempre ESTUDANTE.
    expect(prismaMock.projeto.count).not.toHaveBeenCalled();
  });

  it('e-mail institucional sem projeto vinculado é ESTUDANTE', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'PROFESSOR' });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.projeto.count.mockResolvedValue(0);

    expect(await perms.resolveUserRole('semprojeto@ifpr.edu.br')).toBe('ESTUDANTE');
  });

  it('e-mail institucional com projeto vinculado é PROFESSOR', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ESTUDANTE' });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.projeto.count.mockResolvedValue(1);

    expect(await perms.resolveUserRole('coord@ifpr.edu.br')).toBe('PROFESSOR');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { email: 'coord@ifpr.edu.br' },
      data: { role: 'PROFESSOR' },
    });
  });

  it('não escreve no banco quando o papel já está correto (evita update desnecessário)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ESTUDANTE' });
    prismaMock.projeto.count.mockResolvedValue(0);

    expect(await perms.resolveUserRole('estudante@ifpr.edu.br')).toBe('ESTUDANTE');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('usuário promovido pelo e-mail mestre é ADMIN mesmo fora do domínio', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      role: 'ESTUDANTE',
      permissions: [{ id: 'permissao-admin' }],
    });
    prismaMock.user.update.mockResolvedValue({});

    expect(await perms.resolveUserRole('pessoa@gmail.com')).toBe('ADMIN');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { email: 'pessoa@gmail.com' },
      data: { role: 'ADMIN' },
    });
  });
});

describe('Administrador Geral promovido', () => {
  it('o e-mail mestre passa sem consultar o banco', async () => {
    expect(await perms.ehAdministradorGeral(MASTER)).toBe(true);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('só a permissão admin_geral promove os demais', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ permissions: [{ id: 'p' }] });
    expect(await perms.ehAdministradorGeral('outro@ifpr.edu.br')).toBe(true);

    prismaMock.user.findUnique.mockResolvedValueOnce({ permissions: [] });
    expect(await perms.ehAdministradorGeral('semadmin@ifpr.edu.br')).toBe(false);
  });
});

describe('gestor da página do projeto', () => {
  it('acesso com incluirGestor, mas não no acesso padrão', async () => {
    logadoComo('aluno@ifpr.edu.br');

    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ESTUDANTE' });
    prismaMock.projeto.findUnique.mockResolvedValue({
      coordenadorEmail: 'prof@ifpr.edu.br',
      viceCoordenadorEmail: null,
      admins: [],
      coordenadores: [],
    });
    expect(await perms.temAcessoAoProjeto('projeto-1', 'aluno@ifpr.edu.br')).toBe(false);

    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ESTUDANTE' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ permissions: [{ id: 'g' }] });
    expect(
      await perms.temAcessoAoProjeto('projeto-1', 'aluno@ifpr.edu.br', { incluirGestor: true }),
    ).toBe(true);
  });

  it('lista os IDs gerenciados a partir das permissões', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      permissions: [
        { permission: 'gestor_projeto:p1' },
        { permission: 'gestor_projeto:p2' },
        { permission: 'outra_coisa' },
      ],
    });

    expect(await perms.projetosComoGestor('aluno@ifpr.edu.br')).toEqual(['p1', 'p2']);
  });
});
