/* ===================================================================
   REGRAS DE EXTRAÇÃO DE SIMULADOS
   arquivo: regras-extracao.js
   consumido por: desempenho-concurso.html
   
   Este arquivo é a FONTE ÚNICA de verdade para todas as regras
   de extração. O MD de extração é apenas documentação deste arquivo.
   
   Quando uma prova nova é importada e o padrão é válido mas não
   existe nas regras, ele é salvo automaticamente (auto-incremento).
   =================================================================== */

const REGRAS = {
  versao: 7,

  /* ===================================================================
     PADRÕES CONHECIDOS DE PROVAS
     Cada padrão define: matérias, faixas de questões, pesos,
     total de questões e variações de nomes aceitas.
     Novos padrões são adicionados automaticamente (auto-incremento).
     =================================================================== */
  padroes: [
    {
      id: 'pprn',
      nome: 'PPRN — Polícia Penal',
      totalQuestoes: 100,
      materias: [
        { id:'port', nome:'Língua Portuguesa',                       faixa:[1,15],   qtd:15, peso:1 },
        { id:'hist', nome:'História do RN e Aspectos Geoeconômicos do RN', faixa:[16,20],  qtd:5,  peso:1 },
        { id:'eti',  nome:'Ética no Serviço Público',                faixa:[21,25],  qtd:5,  peso:1 },
        { id:'const',nome:'Direito Constitucional',                  faixa:[26,35],  qtd:10, peso:1 },
        { id:'adm',  nome:'Direito Administrativo',                  faixa:[36,45],  qtd:10, peso:1 },
        { id:'dh',   nome:'Direitos Humanos',                        faixa:[46,55],  qtd:10, peso:1 },
        { id:'exec', nome:'Execução Penal',                          faixa:[56,70],  qtd:15, peso:2 },
        { id:'lesp', nome:'Legislação Específica',                   faixa:[71,90],  qtd:20, peso:2, grupo:'extravagante' },
        { id:'pen',  nome:'Direito Penal e Processo Penal',          faixa:[91,100], qtd:10, peso:2 }
      ],
      variacoes: {
        'Língua Portuguesa':                ['LÍNGUA PORTUGUESA','PORTUGUESA','PORTUGUÊS','LINGUA PORTUGUESA'],
        'História do RN e Aspectos Geoeconômicos do RN': ['HISTÓRIA E ASPECTOS GEOECONÔMICOS DO RN','HISTÓRIA DO RN','HISTORIA E ASPECTOS GEOECONOMICOS','HIST. E ASPECTOS GEO'],
        'Ética no Serviço Público':         ['ÉTICA NO SERVIÇO PÚBLICO','ÉTICA','ETICA'],
        'Direito Constitucional':           ['DIREITO CONSTITUCIONAL','CONSTITUCIONAL','DIR. CONSTITUCIONAL'],
        'Direito Administrativo':           ['DIREITO ADMINISTRATIVO','D. ADMINISTRATIVO','DIR. ADMINISTRATIVO','DIREITO ADM'],
        'Direitos Humanos':                 ['DIREITOS HUMANOS','D. HUMANOS','DIR. HUMANOS','DH'],
        'Execução Penal':                   ['EXECUÇÃO PENAL','EXEC. PENAL','LEP','EXECUCAO PENAL','LEI DE EXECUÇÃO PENAL – LEP','LEI DE EXECUÇÃO PENAL - LEP','EXECUÇÃO PENAL – LEP','EXECUÇÃO PENAL - LEP','LEI DE EXECUCAO PENAL - LEP','EXECUCAO PENAL - LEP'],
        'Legislação Específica':            ['LEGISLAÇÃO ESPECÍFICA','LEG. ESPECÍFICA','LEIS ESPECIAIS','LEGISLACAO ESPECIFICA','LEGISLAÇÃO ESPECÍFICA "LEI COMPLEMENTAR Nº 122/1990" E "LEI COMPLEMENTAR Nº 556/2016"','LEGISLAÇÃO ESPECÍFICA “LEI COMPLEMENTAR Nº 122/1990” E “LEI COMPLEMENTAR Nº 556/2016”'],
        'Direito Penal e Processo Penal':   ['DIREITO PENAL E PROCESSO PENAL','D. PENAL E PROCESSO PENAL','PENAL E PROCESSO','DIREITO PENAL','PROCESSUAL PENAL','DIREITO PROCESSUAL PENAL','DIR. PROCESSUAL PENAL','D. PROCESSUAL PENAL','PENAL','DIR. PENAL','D. PENAL']
      }
    },
    {
      id: 'v-simulado',
      nome: 'V Simulado Pós-Edital — PPRN | Sertão Concursos',
      totalQuestoes: 100,
      materias: [
        { id:'port',  nome:'Língua Portuguesa',                       faixa:[1,15],   qtd:15, peso:1 },
        { id:'eti',   nome:'Ética no Serviço Público',                faixa:[16,20],  qtd:5,  peso:1 },
        { id:'hist',  nome:'História do RN e Aspectos Geoeconômicos do RN', faixa:[21,25],  qtd:5,  peso:1 },
        { id:'const', nome:'Direito Constitucional',                  faixa:[26,35],  qtd:10, peso:1 },
        { id:'pen',   nome:'Direito Penal e Processo Penal',          faixa:[36,45],  qtd:10, peso:2 },
        { id:'adm',   nome:'Direito Administrativo',                  faixa:[46,55],  qtd:10, peso:1 },
        { id:'lesp',  nome:'Legislação Específica',                   faixa:[56,75],  qtd:20, peso:2, grupo:'extravagante' },
        { id:'dh',    nome:'Direitos Humanos',                        faixa:[76,85],  qtd:10, peso:1 },
        { id:'exec',  nome:'Execução Penal',                          faixa:[86,100], qtd:15, peso:2 }
      ],
      variacoes: {
        'Língua Portuguesa':               ['LÍNGUA PORTUGUESA','PORTUGUESA','PORTUGUÊS','LINGUA PORTUGUESA'],
        'Ética no Serviço Público':        ['ÉTICA NO SERVIÇO PÚBLICO','ÉTICA','ETICA'],
        'História do RN e Aspectos Geoeconômicos do RN': ['HISTÓRIA E ASPECTOS GEOECONÔMICOS DO RN','HISTÓRIA DO RN','HISTORIA E ASPECTOS GEOECONOMICOS','HIST. E ASPECTOS GEO'],
        'Direito Constitucional':          ['DIREITO CONSTITUCIONAL','CONSTITUCIONAL','DIR. CONSTITUCIONAL'],
        'Direito Penal e Processo Penal':  ['DIREITO PENAL E PROCESSO PENAL','D. PENAL E PROCESSO PENAL','PENAL E PROCESSO','DIREITO PENAL','PROCESSUAL PENAL','DIREITO PROCESSUAL PENAL','DIR. PROCESSUAL PENAL','D. PROCESSUAL PENAL','PENAL','DIR. PENAL','D. PENAL'],
        'Direito Administrativo':          ['DIREITO ADMINISTRATIVO','D. ADMINISTRATIVO','DIR. ADMINISTRATIVO','DIREITO ADM'],
        'Legislação Específica':           ['LEGISLAÇÃO ESPECÍFICA "LEI COMPLEMENTAR Nº 122/1990" E "LEI COMPLEMENTAR Nº 556/2016"','LEGISLAÇÃO ESPECÍFICA “LEI COMPLEMENTAR Nº 122/1990” E “LEI COMPLEMENTAR Nº 556/2016”','LEGISLAÇÃO ESPECÍFICA','LEG. ESPECÍFICA','LEIS ESPECIAIS','LEGISLACAO ESPECIFICA'],
        'Direitos Humanos':                ['DIREITOS HUMANOS','D. HUMANOS','DIR. HUMANOS','DH'],
        'Execução Penal':                  ['LEI DE EXECUÇÃO PENAL – LEP','LEI DE EXECUÇÃO PENAL - LEP','EXECUÇÃO PENAL – LEP','EXECUÇÃO PENAL - LEP','LEI DE EXECUCAO PENAL - LEP','EXECUCAO PENAL - LEP','EXECUÇÃO PENAL','EXEC. PENAL','LEP','EXECUCAO PENAL']
      }
    },
    {
      id: 'esquenta-lep',
      nome: 'Esquenta LEP — Operação 90 Pontos',
      totalQuestoes: 100,
      materias: [
        { id:'exec', nome:'Execução Penal', faixa:[1,100], qtd:100, peso:2 }
      ],
      variacoes: {
        'Execução Penal': ['LEP','LEI DE EXECUÇÃO PENAL','LEI DE EXECUCAO PENAL','EXECUÇÃO PENAL','LEP - LEI DE EXECUÇÃO PENAL']
      }
    },
    {
      id: 'PPPE-PREEDITAL',
      nome: 'PPPE — Polícia Penal de PE (Pré-Edital 2026)',
      totalQuestoes: 60,
      materias: [
        { id:'port',  nome:'Língua Portuguesa',                    faixa:[1,8],   qtd:8,  peso:1 },
        { id:'lest',  nome:'Legislação Estadual',                  faixa:[9,12],  qtd:4,  peso:1 },
        { id:'eti',   nome:'Ética no Serviço Público',             faixa:[13,14], qtd:2,  peso:1 },
        { id:'info',  nome:'Noções de Informática',                faixa:[15,17], qtd:3,  peso:1 },
        { id:'log',   nome:'Raciocínio Lógico',                    faixa:[18,20], qtd:3,  peso:1 },
        { id:'adm',   nome:'Direito Administrativo',               faixa:[21,25], qtd:5,  peso:1 },
        { id:'const', nome:'Direito Constitucional',               faixa:[26,29], qtd:4,  peso:1 },
        { id:'pen',   nome:'Direito Penal',                        faixa:[30,34], qtd:5,  peso:1 },
        { id:'proc',  nome:'Direito Processual Penal',             faixa:[35,39], qtd:5,  peso:1 },
        { id:'lesp',  nome:'Legislação Especial',                  faixa:[40,44], qtd:5,  peso:1 },
        { id:'exec',  nome:'Execução Penal',                       faixa:[45,54], qtd:10, peso:1 },
        { id:'dh',    nome:'Noções de Direitos Humanos e Participação Social', faixa:[55,60], qtd:6, peso:1 }
      ],
      variacoes: {
        'Legislação Estadual':             ['LEGISLAÇÃO ESTADUAL','LEG. ESTADUAL','LEGISLACAO ESTADUAL'],
        'Noções de Informática':           ['NOÇÕES DE INFORMÁTICA','NOÇÕES DE INFORMATICA','NOCOES DE INFORMATICA','INFORMÁTICA','INFORMATICA'],
        'Raciocínio Lógico':               ['RACIOCÍNIO LÓGICO','RACIOCINIO LOGICO','RACIOCÍNIO LÓGICO E QUANTITATIVO','RACIOCINIO LOGICO E QUANTITATIVO','LÓGICA'],
        'Direito Penal':                   ['DIREITO PENAL'],
        'Direito Processual Penal':        ['DIREITO PROCESSUAL PENAL','PROCESSUAL PENAL','DIR. PROCESSUAL PENAL','D. PROCESSUAL PENAL'],
        'Legislação Especial':             ['LEGISLAÇÃO ESPECIAL','LEG. ESPECIAL','LEGISLACAO ESPECIAL'],
        'Noções de Direitos Humanos e Participação Social': ['NOÇÕES DE DIREITOS HUMANOS E PARTICIPAÇÃO SOCIAL','NOÇÕES DE DIREITOS HUMANOS E PARTICIPAÇÃO','NOCOES DE DIREITOS HUMANOS E PARTICIPACAO','NOÇÕES DE DIREITOS HUMANOS']
      }
    }
  ],

  /* ===================================================================
     LINHAS/CABEÇALHOS PARA IGNORAR
     Textos que aparecem nos PDFs mas NÃO são matérias nem questões.
     =================================================================== */
  ignorar: [
    'SIMULADO','PROVA OBJETIVA','CADERNO DE QUESTÕES','CARTÃO DE RESPOSTAS',
    'INSTRUÇÕES','INFORMAÇÕES GERAIS','POLICIAL PENAL','POLICIA PENAL',
    'GOVERNO DO ESTADO','SECRETARIA DE SEGURANÇA','CONCURSO PÚBLICO',
    'NÍVEL SUPERIOR','NIVEL SUPERIOR','A duração da prova',
    'ao Fiscal','NÃO SERÃO ACEITAS','INSCRIÇÃO','NOME COMPLETO',
    'TIPO DE PROVA','NÃO ESQUEÇA','ASSINATURA','CARTÃO RESPOSTAS',
    'RIO GRANDE DO NORTE','www.','@CTCON','@ctcon','CTCONCURSOS',
    'Licensed to','SERTÃO CONCURSOS','DETONANDO A BANCA',
    'O sucesso','Robert Collier','MANSÃO','ctconcursosonline',
    'questão',' Questão','QUESTÃO','alternativa','ALTERNATIVA',
    'Múltipla Escolha','N.D.A','NDA',
    'ESQUENTA','OPERAÇÃO 90 PONTOS','PROF.','CADERNO DE QUESTÕES','MISSÃO','ARTS.'
  ],

  /* ===================================================================
     PROMPT PARA IA (Google Gemini)
     Usado quando o usuário clica em "🤖 Extrair com IA"
     =================================================================== */
  promptIA: `Você é um extrator de provas de concurso. Receberá o texto copiado de uma prova.
Extraia todas as questões e retorne APENAS um JSON válido (sem markdown, sem comentários):

{
  "titulo": "NOME DO SIMULADO",
  "blocos": [
    {
      "materia": "NOME EXATO DA MATÉRIA",
      "questoes": [
        {
          "n": 1,
          "texto": "Enunciado completo da questão em uma linha",
          "alternativas": {
            "A": "Texto da alternativa A",
            "B": "Texto da alternativa B",
            "C": "Texto da alternativa C",
            "D": "Texto da alternativa D",
            "E": "Texto da alternativa E"
          }
        }
      ]
    }
  ]
}

REGRAS OBRIGATÓRIAS:
1. Extraia TODO o texto preservando a ordem das questões.
2. Agrupe por MATÉRIA usando os cabeçalhos do texto.
3. O "texto" de cada questão deve ser o enunciado COMPLETO em UMA SÓ linha.
4. Se o enunciado tiver assertivas (I, II, III, IV), inclua TODAS no texto.
5. Inclua TODAS as alternativas (A-E) em cada questão.
6. REMOVA: marcas d'água, rodapés, números de página, "www....", textos repetidos.
7. Se uma alternativa for cortada por quebra de linha, JUNTE o texto completo.
8. NUNCA trunque enunciados ou alternativas.
9. O nome da matéria deve ser EXATAMENTE um dos nomes conhecidos.
10. Retorne APENAS o JSON puro, sem nenhum texto antes ou depois.
11. Se o texto estiver incompleto, extraia o que houver.
12. Questões podem vir no formato "QUESTÃO 01/100" (zeros à esquerda e barra com o total) — extraia normalmente.
13. Questões estilo Cespe/Cebraspe ("julgue o item") têm apenas as alternativas "C) Certo" e "E) Errado" — mantenha exatamente assim.
14. IGNORE linhas repetidas de rodapé/cabeçalho: "ESQUENTA - OPERAÇÃO 90 PONTOS EM 7 DIAS", "PROF. BRUNO ARAÚJO", "CADERNO DE QUESTÕES - ...", "ARTS. X A Y", "MISSÃO: 90 PONTOS" e linhas de banca (ex.: "CEBRASPE - SENAPPEN - 2021").
15. Tópicos de matéria (ex.: "CONDENADO E INTERNADO", "EXECUÇÃO DAS PENAS EM ESPÉCIE") NÃO são matérias: pertencem à matéria da seção ("LEP"/"EXECUÇÃO PENAL") e devem ser ignorados como cabeçalho.
16. "LEP" e "LEI DE EXECUÇÃO PENAL" são a mesma matéria: "Execução Penal".`,
};

/* ===================================================================
   FUNÇÕES DE PADRÃO
   =================================================================== */

function getPadroes(){ return REGRAS.padroes; }

function getPadraoById(id){ return REGRAS.padroes.find(p=>p.id===id); }

function getPadraoPorNome(nome){
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const nn = norm(nome);
  return REGRAS.padroes.find(p=>{
    if(norm(p.nome)===nn) return true;
    return p.materias.some(m=> norm(m.nome)===nn || norm(m.nome).includes(nn) || nn.includes(norm(m.nome)));
  });
}

function getVariacoes(){
  const map = {};
  REGRAS.padroes.forEach(p=>{
    if(p.variacoes){
      Object.entries(p.variacoes).forEach(([canon, vars])=>{
        vars.forEach(v=>{ map[v.toUpperCase()] = canon; });
      });
    }
  });
  return map;
}

function normalizarMateria(nome){
  const variacoes = getVariacoes();
  const upper = String(nome||'').trim().toUpperCase();
  if(variacoes[upper]) return variacoes[upper];
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const nn = norm(nome);
  for(const [canon, vars] of Object.entries(variacoes)){
    if(norm(canon)===nn) return canon;
    for(const v of vars){
      if(norm(v)===nn) return canon;
    }
  }
  return nome;
}

/* ===================================================================
   AUTO-MAPEAMENTO POR FAIXA DE QUESTÕES
   =================================================================== */

function autoMapPorFaixa(blocks, padrao){
  if(!padrao || !blocks || !blocks.length) return {};
  if(padrao.materias.length===1){
    const mapU = {};
    blocks.forEach(b=>{ mapU[b.name] = padrao.materias[0].id; });
    return mapU;
  }
  const map = {};
  const getItens = b => b.itens || b.items || [];
  /* 1º) mapear pelo NOME do bloco (variações conhecidas) — mais confiável
     que a faixa quando o simulado embaralha a ordem das matérias. */
  blocks.forEach(b=>{
    const canon = normalizarMateria(b.name);
    if(!canon) return;
    const mat = padrao.materias.find(m=> String(m.nome).trim().toLowerCase()===String(canon).trim().toLowerCase());
    if(mat) map[b.name] = mat.id;
  });
  /* 2º) faixa: apenas para blocos ainda não mapeados */
  for(const mat of padrao.materias){
    const [ini,fim] = mat.faixa;
    const match = blocks.filter(b=>{
      if(map[b.name]!==undefined) return false;
      const nums = getItens(b).map(it=>it.n);
      return nums.some(n=>n>=ini && n<=fim);
    });
    if(match.length===1){
      map[match[0].name] = mat.id;
    } else if(match.length>1){
      const best = match.sort((a,b)=>{
        const aHit = getItens(a).filter(it=>it.n>=ini&&it.n<=fim).length;
        const bHit = getItens(b).filter(it=>it.n>=ini&&it.n<=fim).length;
        return bHit-aHit;
      })[0];
      map[best.name] = mat.id;
    }
  }
  return map;
}

/* ===================================================================
   VALIDAÇÃO DE PADRÃO
   =================================================================== */

function validarPadrao(blocks, padrao){
  if(!padrao || !blocks || !blocks.length) return {ok:false, msgs:['Padrão não definido.']};
  const msgs = [];
  const getItens = b => b.itens || b.items || [];
  const total = blocks.reduce((a,b)=>a+getItens(b).length,0);
  const allNums = blocks.flatMap(b=>getItens(b).map(it=>it.n));
  if(total !== padrao.totalQuestoes) msgs.push('Total: '+total+' (esperado '+padrao.totalQuestoes+')');
  const dups = allNums.filter((n,i)=>allNums.indexOf(n)!==i);
  if(dups.length) msgs.push('Duplicadas: '+[...new Set(dups)].join(', '));
  for(const mat of padrao.materias){
    const [ini,fim] = mat.faixa;
    const count = allNums.filter(n=>n>=ini&&n<=fim).length;
    if(count===0) msgs.push(mat.nome+': 0q na faixa '+ini+'–'+fim);
    else if(count!==mat.qtd) msgs.push(mat.nome+': '+count+'q (esperado '+mat.qtd+')');
  }
  return {ok:msgs.length===0, msgs};
}

/* ===================================================================
   DETECÇÃO AUTOMÁTICA DE PADRÃO
   =================================================================== */

function detectarPadrao(blocks){
  const getItens = b => b.itens || b.items || [];
  const allNums = blocks.flatMap(b=>getItens(b).map(it=>it.n));
  const total = allNums.length;
  let best = null, bestScore = -1;
  for(const padrao of REGRAS.padroes){
    if(total !== padrao.totalQuestoes) continue;
    if(!validarPadrao(blocks, padrao).ok) continue;
    const distinct = new Set(blocks.map(b=>String(normalizarMateria(b.name)).toLowerCase().trim())).size;
    const score = (distinct===blocks.length?2:0) + (distinct===padrao.materias.length?1:0);
    if(score>bestScore){ bestScore=score; best=padrao; }
  }
  return best;
}

/* ===================================================================
   VALIDAÇÃO CONTRA CONCURSO (matérias cadastradas nas Metas)
   =================================================================== */

function validarContraConcurso(blocks, materiasConcurso){
  if(!materiasConcurso || !materiasConcurso.length) return {ok:true, msgs:[], extra:[], faltantes:[]};
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const extra = [];
  const faltantes = [];
  blocks.forEach(b=>{
    const bn = normalizarMateria(b.name);
    const found = materiasConcurso.find(s=> norm(s.name)===norm(bn) || norm(s.name).includes(norm(bn)) || norm(bn).includes(norm(s.name)));
    if(!found) extra.push(b.name);
  });
  materiasConcurso.forEach(s=>{
    const sn = norm(s.name);
    const found = blocks.find(b=>{
      const bn = normalizarMateria(b.name);
      return norm(bn)===sn || sn.includes(norm(bn)) || norm(bn).includes(sn);
    });
    if(!found) faltantes.push(s.name);
  });
  const msgs = [];
  if(extra.length) msgs.push('Matérias na prova mas NÃO cadastradas: '+extra.join(', '));
  if(faltantes.length) msgs.push('Matérias cadastradas mas NÃO na prova: '+faltantes.join(', '));
  return {ok:!extra.length && !faltantes.length, msgs, extra, faltantes};
}

/* ===================================================================
   AUTO-INCREMENTO: salvar padrão novo quando detectado
   =================================================================== */

function salvarPadraoSeNovo(blocks, autoMap, materiasConcurso){
  const getItens = b => b.itens || b.items || [];
  const allNums = blocks.flatMap(b=>getItens(b).map(it=>it.n));
  const total = allNums.length;
  const existente = detectarPadrao(blocks);
  if(existente) return {salvo:false, padrao:existente, msg:'Padrão já conhecido: '+existente.nome};
  if(total < 20) return {salvo:false, padrao:null, msg:'Poucas questões para detectar padrão'};
  const materias = [];
  const seen = new Set();
  blocks.forEach(b=>{
    const sid = autoMap[b.name];
    if(!sid || seen.has(sid)) return;
    seen.add(sid);
    const nums = getItens(b).map(it=>it.n).sort((a,c)=>a-c);
    const matchedMat = materiasConcurso.find(s=>s.id===sid);
    materias.push({
      id: sid,
      nome: matchedMat ? matchedMat.name : b.name,
      faixa: [Math.min(...nums), Math.max(...nums)],
      qtd: nums.length,
      peso: matchedMat ? matchedMat.weight : 1
    });
  });
  if(materias.length < 3) return {salvo:false, padrao:null, msg:'Poucas matérias para criar padrão'};
  materias.sort((a,b)=>a.faixa[0]-b.faixa[0]);
  const id = 'auto_'+Date.now().toString(36);
  const novoPadrao = {
    id,
    nome: 'Padrão auto-detectado ('+total+' questões, '+materias.length+' matérias)',
    materias,
    totalQuestoes: total,
    variacoes: {},
    autoDetectado: true,
    dataCriacao: new Date().toISOString()
  };
  REGRAS.padroes.push(novoPadrao);
  return {salvo:true, padrao:novoPadrao, msg:'Novo padrão salvo! '+materias.length+' matérias, '+total+' questões.'};
}

/* ===================================================================
   LISTA DE MATÉRIAS (merge de todos os padrões)
   =================================================================== */

function listarTodasMaterias(){
  const all = new Map();
  REGRAS.padroes.forEach(p=>{
    p.materias.forEach(m=>{
      if(!all.has(m.id)) all.set(m.id, {id:m.id, nome:m.nome, peso:m.peso});
    });
  });
  return [...all.values()];
}

function ehIgnorar(linha){
  const l = String(linha||'').trim().toUpperCase();
  return REGRAS.ignorar.some(i=> l.includes(i) || l===i);
}
