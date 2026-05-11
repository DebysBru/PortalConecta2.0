import { PrismaClient, CategoriaEdital, StatusEdital, StatusProjeto, TipoEvento, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

async function main() {
  console.log('🌱 Iniciando seed do Portal Conecta IFPR...');

  // Usuário admin seed
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ifpr.edu.br' },
    update: {},
    create: {
      email: 'admin@ifpr.edu.br',
      name: 'Administrador Portal Conecta',
      role: UserRole.ADMINISTRADOR,
    },
  });

  const editorIfizinha = await prisma.user.upsert({
    where: { email: 'marketing@ifpr.edu.br' },
    update: {},
    create: {
      email: 'marketing@ifpr.edu.br',
      name: 'Marketing Digital Solidário',
      role: UserRole.EDITOR_IFIZINHA,
    },
  });

  console.log('✅ Usuários criados');

  // === PROJETOS ===
  const projetos = [
    {
      nome: 'Marketing Digital Solidário',
      coordenador: 'Onivaldo Flores Junior',
      area: 'Marketing Digital',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#2F52D3',
      descricao: 'Projeto de extensão que capacita estudantes em marketing digital e comunicação, promovendo o desenvolvimento de habilidades práticas e apoio a organizações sociais da região.',
      instagram: '@mktdigitalsolidario',
      destaque: true,
    },
    {
      nome: 'Mais Empatia',
      coordenador: 'Aline Spaciari Matioli',
      area: 'Psicologia e Saúde Mental',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#E83D89',
      descricao: 'Projeto voltado ao desenvolvimento da empatia e habilidades socioemocionais na comunidade escolar, promovendo saúde mental e bem-estar entre estudantes.',
      destaque: true,
    },
    {
      nome: 'Ao Infinito e Além: Astronomia para Todos',
      coordenador: 'Adriano Jose Ortiz',
      area: 'Ciências e Astronomia',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#7B24C7',
      descricao: 'Democratizando o acesso à astronomia por meio de atividades práticas, observações noturnas e oficinas educativas para a comunidade do Vale do Ivaí.',
      destaque: true,
    },
    {
      nome: 'NEA Vale do Ivaí',
      coordenador: 'Gisele Fernanda Mouro',
      area: 'Agroecologia',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#2E7D32',
      descricao: 'Núcleo de Estudos em Agroecologia que promove práticas sustentáveis de produção agrícola, conectando saberes tradicionais e científicos na região do Vale do Ivaí.',
    },
    {
      nome: 'Biologia Ilustrada',
      coordenador: 'Andrea Martini Ribeiro Gonçalves',
      area: 'Biologia e Arte',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#00897B',
      descricao: 'Aproximando a biologia da comunidade através da ilustração científica, tornando conceitos complexos acessíveis e visualmente atraentes para estudantes e público geral.',
    },
    {
      nome: 'Química na Cozinha',
      coordenador: 'Carlos Eduardo Martins',
      area: 'Química',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#F57C00',
      descricao: 'Projeto que utiliza experimentos culinários para ensinar conceitos de química de forma prática, divertida e acessível a estudantes do ensino médio.',
    },
    {
      nome: 'Robótica Educacional IFPR',
      coordenador: 'João Paulo Ferreira',
      area: 'Tecnologia e Robótica',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#1565C0',
      descricao: 'Introdução à robótica educacional e programação para jovens da comunidade, desenvolvendo pensamento computacional e habilidades do século XXI.',
    },
    {
      nome: 'Horta Comunitária',
      coordenador: 'Mariana Costa Silva',
      area: 'Agricultura Urbana',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#388E3C',
      descricao: 'Implantação e manutenção de hortas comunitárias em escolas e espaços públicos, promovendo educação ambiental e segurança alimentar.',
    },
    {
      nome: 'Letramento Digital para Terceira Idade',
      coordenador: 'Fernanda Lima Rodrigues',
      area: 'Inclusão Digital',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#6A1B9A',
      descricao: 'Capacitação em tecnologias digitais voltada ao público idoso, reduzindo o isolamento e promovendo a inclusão digital de pessoas com 60 anos ou mais.',
    },
    {
      nome: 'Teatro na Escola',
      coordenador: 'Patricia Alves Mendonça',
      area: 'Artes e Cultura',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#C62828',
      descricao: 'Projeto de teatro educativo que desenvolve expressão artística, autoconfiança e trabalho em equipe entre estudantes, com apresentações para a comunidade.',
    },
    {
      nome: 'Cidadania e Direitos',
      coordenador: 'Roberto Santos Oliveira',
      area: 'Direito e Cidadania',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#0277BD',
      descricao: 'Orientação jurídica gratuita e educação em direitos fundamentais para a comunidade, promovendo o acesso à justiça e consciência cidadã.',
    },
    {
      nome: 'Matemática Descomplicada',
      coordenador: 'Ana Beatriz Torres',
      area: 'Matemática',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#283593',
      descricao: 'Reforço escolar em matemática com metodologias lúdicas e interativas, apoiando estudantes com dificuldades de aprendizagem da rede pública municipal.',
    },
    {
      nome: 'Biblioteca Viva',
      coordenador: 'Luciana Freitas Campos',
      area: 'Letramento e Literatura',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#4E342E',
      descricao: 'Promoção da leitura e formação de leitores críticos através de rodas de leitura, saraus literários e mediação de leitura em espaços comunitários.',
    },
    {
      nome: 'Empreendedorismo Jovem',
      coordenador: 'Marcos Antonio Ramos',
      area: 'Empreendedorismo',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#FF6F00',
      descricao: 'Capacitação em empreendedorismo e economia criativa para jovens, desenvolvendo habilidades para criação de negócios sustentáveis e inovadores.',
    },
    {
      nome: 'Saúde Bucal na Comunidade',
      coordenador: 'Dra. Silvia Moreira',
      area: 'Saúde',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#00838F',
      descricao: 'Ações de promoção de saúde bucal em escolas públicas e comunidades carentes, com orientações preventivas e atendimento básico.',
    },
    {
      nome: 'Física em Experimentos',
      coordenador: 'Prof. Eduardo Almeida',
      area: 'Física',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#37474F',
      descricao: 'Laboratório itinerante de física experimental levando ciência prática às escolas da região, tornando conceitos abstratos concretos e motivadores.',
    },
    {
      nome: 'Línguas sem Fronteiras',
      coordenador: 'Professora Carla Werneck',
      area: 'Idiomas',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#1A237E',
      descricao: 'Curso de inglês e espanhol gratuito para comunidade externa, com ênfase em conversação e preparação para o mercado de trabalho globalizado.',
    },
    {
      nome: 'Arte e Sustentabilidade',
      coordenador: 'Beatriz Cunha Lima',
      area: 'Arte e Meio Ambiente',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#558B2F',
      descricao: 'Criação artística com materiais recicláveis, conscientizando sobre sustentabilidade ambiental e valorizando a expressão criativa como ferramenta de transformação social.',
    },
    {
      nome: 'Podcast IFPR',
      coordenador: 'Diego Carvalho Neto',
      area: 'Comunicação',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#4527A0',
      descricao: 'Produção de conteúdo em áudio sobre ciência, tecnologia, cultura e sociedade, desenvolvendo habilidades comunicativas e divulgação científica entre estudantes.',
    },
    {
      nome: 'Xadrez Escola',
      coordenador: 'Prof. Alexandre Dias',
      area: 'Esporte e Lógica',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#BF360C',
      descricao: 'Ensino do xadrez como ferramenta pedagógica para o desenvolvimento do raciocínio lógico, concentração e planejamento estratégico em estudantes.',
    },
    {
      nome: 'Nutrição e Bem-Estar',
      coordenador: 'Nutricionista Helena Prado',
      area: 'Nutrição',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#2E7D32',
      descricao: 'Educação nutricional e alimentação saudável para famílias de baixa renda, com oficinas de culinária sustentável e orientação sobre aproveitamento integral dos alimentos.',
    },
    {
      nome: 'Programação para Iniciantes',
      coordenador: 'Gustavo Henrique Souza',
      area: 'Tecnologia',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#0D47A1',
      descricao: 'Introdução à programação com Python e desenvolvimento web para estudantes do ensino médio, preparando jovens para as profissões do futuro.',
    },
    {
      nome: 'História e Memória Local',
      coordenador: 'Prof. Renato Vieira Cruz',
      area: 'História e Cultura',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#6D4C41',
      descricao: 'Pesquisa e preservação da memória histórica e cultural do Vale do Ivaí, produzindo material didático sobre a história regional e identidade local.',
    },
    {
      nome: 'Jogos Matemáticos',
      coordenador: 'Profa. Vanessa Cardoso',
      area: 'Matemática e Pedagogia',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#AD1457',
      descricao: 'Desenvolvimento e aplicação de jogos educativos para o ensino de matemática, tornando a aprendizagem mais lúdica e efetiva para crianças e adolescentes.',
    },
    {
      nome: 'Veterinária Comunitária',
      coordenador: 'Dr. Paulo Mendes',
      area: 'Medicina Veterinária',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#1B5E20',
      descricao: 'Atenção veterinária gratuita para animais de companhia de famílias de baixa renda, promovendo saúde animal, bem-estar e educação em guarda responsável.',
    },
    {
      nome: 'Inclusão e Acessibilidade',
      coordenador: 'Profa. Juliana Nunes',
      area: 'Educação Especial',
      status: StatusProjeto.EM_EXECUCAO,
      corPrimaria: '#7B24C7',
      descricao: 'Promoção da acessibilidade e inclusão de pessoas com deficiência, oferecendo suporte, capacitação e advocacia por ambientes mais inclusivos na região.',
    },
    {
      nome: 'Fotografia Social',
      coordenador: 'Camila Ramos Ferreira',
      area: 'Arte e Comunicação',
      status: StatusProjeto.ENVIADO_2026,
      corPrimaria: '#4A148C',
      descricao: 'Oficinas de fotografia documental e narrativa visual para jovens em vulnerabilidade social, desenvolvendo olhar crítico e meios de expressão artística.',
    },
    {
      nome: 'Cooperativismo Solidário',
      coordenador: 'Prof. Marcio Barbosa',
      area: 'Economia Solidária',
      status: StatusProjeto.ENVIADO_2026,
      corPrimaria: '#E65100',
      descricao: 'Formação em cooperativismo e economia solidária para trabalhadores informais e empreendedores sociais da região, fortalecendo redes de colaboração.',
    },
  ];

  for (const projetoData of projetos) {
    const slug = slugify(projetoData.nome);
    await prisma.projeto.upsert({
      where: { slug },
      update: {},
      create: {
        nome: projetoData.nome,
        slug,
        coordenador: projetoData.coordenador,
        area: projetoData.area,
        status: projetoData.status,
        corPrimaria: projetoData.corPrimaria,
        descricao: projetoData.descricao,
        instagram: (projetoData as { instagram?: string }).instagram,
        destaque: (projetoData as { destaque?: boolean }).destaque ?? false,
      },
    });
  }

  console.log(`✅ ${projetos.length} projetos criados`);

  // === EDITAIS ===
  const editais = [
    {
      titulo: 'Edital PROEX 01/2025 – Bolsas de Extensão',
      categoria: CategoriaEdital.BOLSAS,
      resumo: 'Seleção de estudantes para recebimento de bolsas de extensão no valor de R$400/mês para participação em projetos de extensão do IFPR Campus Ivaiporã.',
      dataEncerramento: new Date('2025-08-31'),
      status: StatusEdital.ATIVO,
      destaque: true,
      linkOficial: 'https://reitoria.ifpr.edu.br/editais',
      traducaoIFizinha: {
        oQueE: 'É uma oportunidade de receber R$400 por mês para participar de projetos de extensão do campus! A extensão é quando o IFPR leva conhecimento para a comunidade e você faz parte disso.',
        quemPode: 'Estudantes regularmente matriculados em qualquer curso do IFPR Campus Ivaiporã, com pelo menos 1 semestre concluído e sem reprovações no semestre anterior.',
        comoParticipar: 'Você precisa escolher um projeto de extensão, entrar em contato com o coordenador e depois se inscrever pelo SUAP. Simples assim!',
        quando: 'Inscrições até 31 de agosto de 2025. Resultado em setembro.',
        documentos: ['RG e CPF', 'Histórico escolar atualizado', 'Comprovante de matrícula', 'Carta de interesse (você escreve explicando por que quer participar)'],
        mensagemIfizinha: 'Ei, essa é uma chance incrível de ganhar uma bolsa E aprender coisas que nenhuma sala de aula ensina! Mas lembre-se: confira sempre o edital oficial para não perder nenhum detalhe, tá?',
      },
    },
    {
      titulo: 'Edital PIBIC 02/2025 – Programa Institucional de Bolsas de Iniciação Científica',
      categoria: CategoriaEdital.PESQUISA,
      resumo: 'Seleção de estudantes para o Programa de Iniciação Científica, com bolsas de R$700/mês para desenvolvimento de projetos de pesquisa orientados por docentes.',
      dataEncerramento: new Date('2025-09-15'),
      status: StatusEdital.ATIVO,
      destaque: true,
      linkOficial: 'https://reitoria.ifpr.edu.br/editais',
      traducaoIFizinha: {
        oQueE: 'É um programa pra você participar de pesquisas científicas de verdade, com um professor orientando você. Você recebe R$700 por mês pra aprender a fazer ciência!',
        quemPode: 'Estudantes de ensino médio integrado ou graduação com bom desempenho acadêmico (média acima de 7,0) e disponibilidade de 20h semanais.',
        comoParticipar: 'Procure um professor que tenha projeto de pesquisa aprovado, combine com ele e se inscreva com o plano de trabalho no SUAP.',
        quando: 'Inscrições até 15 de setembro de 2025. Início das atividades em outubro.',
        documentos: ['Histórico escolar', 'Documento de identidade', 'Plano de trabalho (o professor ajuda a fazer)', 'Declaração de disponibilidade'],
        mensagemIfizinha: 'Participar de pesquisa científica é um diferencial enorme no seu currículo! Não perca essa oportunidade. Mas atenção: sempre leia o edital completo no site oficial!',
      },
    },
    {
      titulo: 'Auxílio Estudantil – Programa de Assistência Estudantil 2025',
      categoria: CategoriaEdital.AUXILIOS,
      resumo: 'Concessão de auxílios financeiros para estudantes em vulnerabilidade socioeconômica: Auxílio Permanência (R$350), Auxílio Transporte (R$200) e Auxílio Alimentação (R$150).',
      dataEncerramento: new Date('2025-08-15'),
      status: StatusEdital.ENCERRA_BREVE,
      destaque: true,
      linkOficial: 'https://reitoria.ifpr.edu.br/editais',
      traducaoIFizinha: {
        oQueE: 'São auxílios em dinheiro pra te ajudar a continuar estudando! Tem três tipos: Permanência (R$350/mês), Transporte (R$200/mês) e Alimentação (R$150/mês). Você pode solicitar mais de um!',
        quemPode: 'Estudantes com renda familiar per capita de até 1,5 salário mínimo, matriculados em cursos presenciais. Prioridade para quem está em maior vulnerabilidade.',
        comoParticipar: 'Preencha o formulário de cadastro socioeconômico no SUAP, junte os documentos e entregue na Coordenadoria de Assuntos Estudantis (CAE) do campus.',
        quando: 'ATENÇÃO: Inscrições encerram em 15 de agosto de 2025 — está acabando o prazo!',
        documentos: ['Comprovante de renda de todos os membros da família', 'Comprovante de residência', 'RG e CPF', 'Comprovante de matrícula', 'Para quem tem: laudo médico, declaração de gravidez, etc.'],
        mensagemIfizinha: 'Calma, ainda dá tempo! Mas corre, porque o prazo está chegando. Se tiver dúvidas sobre os documentos, procura a CAE do campus que eles te ajudam. E confira sempre o edital oficial!',
      },
    },
    {
      titulo: 'Seleção de Projetos de Extensão 2025/2026',
      categoria: CategoriaEdital.EXTENSAO,
      resumo: 'Chamada para submissão de propostas de projetos de extensão para o período 2025-2026, com possibilidade de financiamento de até R$5.000 por projeto aprovado.',
      dataEncerramento: new Date('2025-10-30'),
      status: StatusEdital.ATIVO,
      destaque: false,
      linkOficial: 'https://reitoria.ifpr.edu.br/editais',
      traducaoIFizinha: {
        oQueE: 'É uma chamada para professores e estudantes proporem projetos que beneficiem a comunidade. Se o projeto for aprovado, pode receber até R$5.000 para execução!',
        quemPode: 'Docentes do IFPR podem submeter propostas. Estudantes participam como bolsistas ou voluntários nos projetos aprovados.',
        comoParticipar: 'Se você é estudante, converse com um professor sobre uma ideia de projeto. Se você é professor, submeta a proposta via SUAP seguindo o modelo do edital.',
        quando: 'Submissão de propostas até 30 de outubro de 2025.',
        documentos: ['Formulário de proposta (no edital)', 'Currículo Lattes do coordenador', 'Plano de trabalho detalhado', 'Declaração de contrapartida institucional'],
        mensagemIfizinha: 'Quer ajudar a comunidade e ainda aprender habilidades incríveis? Essa é a chance! Fala com um professor e vira parte de algo maior. Confira o edital completo para todos os critérios!',
      },
    },
  ];

  for (const editalData of editais) {
    const slug = slugify(editalData.titulo);
    const { traducaoIFizinha, destaque, ...rest } = editalData;
    await prisma.edital.upsert({
      where: { slug },
      update: {},
      create: {
        ...rest,
        slug,
        destaque,
        traducaoIFizinha: traducaoIFizinha as object,
        authorId: editorIfizinha.id,
      },
    });
  }

  console.log(`✅ ${editais.length} editais criados`);

  // === EVENTOS ===
  const eventos = [
    {
      titulo: 'Prazo Final – Auxílio Estudantil',
      descricao: 'Último dia para entrega de documentos do Programa de Assistência Estudantil 2025.',
      data: new Date('2025-08-15T17:00:00'),
      tipo: TipoEvento.PRAZO_EDITAL,
      local: 'CAE – Campus Ivaiporã',
      editalSlug: 'auxilio-estudantil-programa-de-assistencia-estudantil-2025',
    },
    {
      titulo: 'Prazo Final – Bolsas de Extensão',
      descricao: 'Encerramento das inscrições para bolsas de extensão PROEX 01/2025.',
      data: new Date('2025-08-31T23:59:00'),
      tipo: TipoEvento.PRAZO_EDITAL,
      editalSlug: 'edital-proex-012025-bolsas-de-extensao',
    },
    {
      titulo: 'Semana de Ciência e Tecnologia IFPR',
      descricao: 'Evento anual com palestras, workshops e feira de projetos do campus. Aberto para a comunidade!',
      data: new Date('2025-09-08T08:00:00'),
      dataFim: new Date('2025-09-12T18:00:00'),
      tipo: TipoEvento.EVENTO_CAMPUS,
      local: 'Campus IFPR Ivaiporã',
    },
    {
      titulo: 'Prazo Final – PIBIC 02/2025',
      descricao: 'Encerramento das inscrições para o Programa de Iniciação Científica.',
      data: new Date('2025-09-15T23:59:00'),
      tipo: TipoEvento.PRAZO_EDITAL,
      editalSlug: 'edital-pibic-022025-programa-institucional-de-bolsas-de-iniciacao-cientifica',
    },
    {
      titulo: 'Apresentação: Ao Infinito e Além',
      descricao: 'Noite de observação astronômica aberta à comunidade. Traga sua curiosidade!',
      data: new Date('2025-09-20T19:00:00'),
      tipo: TipoEvento.EVENTO_PROJETO,
      local: 'Pátio do Campus IFPR',
    },
    {
      titulo: 'Prazo Final – Seleção de Projetos de Extensão',
      descricao: 'Encerramento para submissão de propostas de extensão 2025/2026.',
      data: new Date('2025-10-30T23:59:00'),
      tipo: TipoEvento.PRAZO_EDITAL,
    },
    {
      titulo: 'Mostra de Projetos de Extensão',
      descricao: 'Apresentação dos projetos em execução. Venha conhecer o trabalho incrível dos nossos estudantes e professores!',
      data: new Date('2025-11-15T08:00:00'),
      dataFim: new Date('2025-11-15T17:00:00'),
      tipo: TipoEvento.EVENTO_CAMPUS,
      local: 'Ginásio do Campus IFPR Ivaiporã',
    },
  ];

  for (const eventoData of eventos) {
    await prisma.evento.create({
      data: {
        ...eventoData,
        authorId: admin.id,
      },
    });
  }

  console.log(`✅ ${eventos.length} eventos criados`);
  console.log('🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
