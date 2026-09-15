const fs = require('fs');
const vm = require('vm');
const path = require('path');

const rules = fs.readFileSync('regras-extracao.js', 'utf-8');
vm.runInThisContext(rules);

const subjects = [
  {id:'port',  name:'Língua Portuguesa',                            short:'PORT',     weight:1, qtd:15},
  {id:'hist',  name:'História do RN e Aspectos Geoeconômicos do RN',short:'HIST RN',  weight:1, qtd:5},
  {id:'eti',   name:'Ética no Serviço Público',                     short:'ÉTICA',    weight:1, qtd:5},
  {id:'const', name:'Direito Constitucional',                       short:'CONST',    weight:1, qtd:10},
  {id:'adm',   name:'Direito Administrativo',                       short:'D.ADM',    weight:1, qtd:10},
  {id:'dh',    name:'Direitos Humanos',                             short:'D.HUM',    weight:1, qtd:10},
  {id:'exec',  name:'Execução Penal',                               short:'EXEC PEN', weight:2, qtd:15},
  {id:'lesp',  name:'Legislação Específica',                        short:'LEG.ESP',  weight:2, qtd:20, grupo:'extravagante'},
  {id:'pen',   name:'Direito Penal e Processo Penal',               short:'D.PEN',    weight:2, qtd:10}
];
function cur(){ return { subjects }; }
function normTxt(t){ return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function suggestSubject(blockName){
  const bn = normTxt(blockName);
  const variacoes = getVariacoes();
  const canon = variacoes[String(blockName||'').trim().toUpperCase()]
    || variacoes[String(blockName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()];
  if(canon){
    const s = cur().subjects.find(x=>normTxt(x.name)===normTxt(canon));
    if(s) return s.id;
  }
  for(const pat of REGRAS.padroes[0].materias){
    const pn = normTxt(pat.nome);
    if(bn.includes(pn) || pn.includes(bn)) return pat.id;
  }
  let best = null, bestScore = 0;
  for(const s of cur().subjects){
    const sn = normTxt(s.name);
    let score = 0;
    if(bn.includes(sn)) score += 3;
    if(bn.includes('lep') && sn.includes('execu')) score += 5;
    if(bn.includes('port') && sn.includes('portug')) score += 4;
    if(bn.includes('dir') && sn.includes('direito')) score += 3;
    if(bn.includes('pen') && sn.includes('execu')) score -= 2;
    if(bn.includes('lei') && sn.includes('espec')) score += 4;
    const kw = ['etica','etic','hist','geo','constituc','const','pen','execu','lep','adm','leg','hum','direit','espec'];
    for(const k of kw){ if(bn.includes(k) && sn.includes(k)) score += 2; }
    if(score>bestScore){ bestScore = score; best = s.id; }
  }
  return best;
}

function parseProvaComBlocos(text){
  const lines = String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const blocks = [];
  let curBlock = null, curAlt = null;
  const BLACK = /simulado|sert[aã]o|banca|avalia|gabarito|concurso|correta|incorreta|alternativa|quest[aã]o|exceto|errad|verdadeir|fals|afirmativ|assinal|complet|texto|cronica|dispositivo|normativ|policial penal|policia penal|governo do estado|secretaria|nivel superior|nível superior|instrucoes|instruções|informacoes|informações|inscrição|nome completo|tipo de prova|assinatura|cartao|criterio|critério|não esqueça|ao fiscal|www\.|@ctcon|ctconcursos|licensed|sertão|detonando|banca avalia|prova objetiva|caderno de questão|cartão de resposta|duracao da|duração da|o sucesso|robert|mansão|rio grande do norte|e\) n\.d\.a|\(ppa\)|cadh\.|ppa/i;
  const capsOK = l => l.length>=5 && l.length<=80
    && /^[A-ZÀ-ÜÇ0-9 /:()\-.–—,&'ºª°%]+$/.test(l)
    && !/^\d/.test(l) && !BLACK.test(l);
  const subjectMatch = l => {
    if(!/^[A-ZÀ-ÜÇ][A-ZÀ-ÜÇa-zà-üç0-9]/.test(l)) return false;
    if(l.length < 3 || l.length > 80) return false;
    const ln = normTxt(l);
    return cur().subjects.some(s=>{
      const sn = normTxt(s.name);
      if(sn.length < 4) return false;
      if(ln===sn) return true;
      if(sn.includes(ln) && ln.length>=4) return true;
      if(ln.includes(sn) && sn.length >= 6 && ln.length <= sn.length + 40) return true;
      const variacoes = getVariacoes();
      const canon = variacoes[l.toUpperCase()] || variacoes[normalizarMateria(l).toUpperCase()];
      if(canon && normTxt(canon)===sn) return true;
      return false;
    });
  };
  const KNOWN_HEADERS = ['legislação específica','história do rn','história e aspectos geo','ética no serviço público','ética','direito penal e processo penal','execução penal','direito constitucional','direito administrativo','direitos humanos','língua portuguesa','portuguesa','leg. específica','lei específica'];
  const knownMatch = l => {
    const ln = normTxt(l);
    return KNOWN_HEADERS.some(k=>{
      const kn = normTxt(k);
      if(ln===kn) return true;
      if(ln.startsWith(kn)){
        const rest = ln.slice(kn.length).trim();
        return rest.length>0 && rest.length<=100 && (/[0-9“”"]/.test(rest) || rest.length<=30);
      }
      return false;
    });
  };
  const isJunkHeader = l => {
    if(/^ESQUENTA/i.test(l)) return true;
    if(/^PROF\./i.test(l)) return true;
    if(/^CADERNO DE QUEST[ÕO]ES/i.test(l)) return true;
    if(/^MISS[ÃA]O/i.test(l)) return true;
    if(/^ARTS\./i.test(l)) return true;
    if(/^[A-ZÀ-ÜÇ0-9 .'ºª°-]+ - [A-ZÀ-ÜÇ0-9 .'ºª°-]+ - \d{4}$/i.test(l)) return true;
    return false;
  };
  let lastQNum = 0;
  for(let i=0; i<lines.length; i++){
    const l = lines[i];
    if(/^[=\-]{3,}$/.test(l)) continue;
    const qm = l.match(/^(\d{1,2}|100)\s*[.)]\s*(?!\d)(.*)$/);
    if(qm && Number(qm[1])>=1 && Number(qm[1])<=300 && Number(qm[1])>lastQNum){
      lastQNum = Number(qm[1]);
      if(!curBlock){ curBlock = {name:'', itens:[]}; blocks.push(curBlock); }
      curBlock.itens.push({n:Number(qm[1]), texto:qm[2], alts:{}});
      curAlt = null;
      continue;
    }
    const qm2 = l.match(/^QUEST[ÃA]O\s*:?\s*(\d{1,3})(?:\s*\/\s*\d{1,3})?\s*(?!.*(?:alternativa|gabarito|corret))[.):\-]?\s*(.*)$/i);
    if(qm2 && Number(qm2[1])>=1 && Number(qm2[1])<=300 && Number(qm2[1])>lastQNum){
      lastQNum = Number(qm2[1]);
      if(!curBlock){ curBlock = {name:'', itens:[]}; blocks.push(curBlock); }
      curBlock.itens.push({n:Number(qm2[1]), texto:qm2[2], alts:{}});
      curAlt = null;
      continue;
    }
    const am = l.match(/^([A-Ea-e])\s*[.)]\s*(.*)$/);
    if(am && curBlock && curBlock.itens.length){
      const q = curBlock.itens[curBlock.itens.length-1];
      q.alts[am[1].toUpperCase()] = am[2];
      curAlt = am[1].toUpperCase();
      continue;
    }
    if(isJunkHeader(l)) continue;
    if(curBlock && curBlock.itens.length){
      const q = curBlock.itens[curBlock.itens.length-1];
      if(curAlt && q.alts[curAlt]!=null) q.alts[curAlt] += ' ' + l;
      else q.texto += ' ' + l;
    }
  }
  return blocks.filter(b=>b.itens.length>0);
}

const ORDEM = ['port','hist','eti','const','adm','dh','exec','lesp','pen'];
const NOMES = {
  port:'LÍNGUA PORTUGUESA',
  hist:'HISTÓRIA E ASPECTOS GEOECONÔMICOS DO RN',
  eti:'ÉTICA',
  const:'DIREITO CONSTITUCIONAL',
  adm:'DIREITO ADMINISTRATIVO',
  dh:'DIREITOS HUMANOS',
  exec:'LEI DE EXECUÇÃO PENAL – LEP',
  lesp:'LEGISLAÇÃO ESPECÍFICA',
  pen:'DIREITO PENAL E PROCESSO PENAL'
};
const FAIXAS = { port:[1,15], hist:[16,20], eti:[21,25], const:[26,35], adm:[36,45], dh:[46,55], exec:[56,70], lesp:[71,90], pen:[91,100] };

const tmpDir = 'tmp_raw';
const files = fs.readdirSync(tmpDir).filter(f=>f.endsWith('.txt')).sort();

function carregarLayout(base){
  try{
    return JSON.parse(fs.readFileSync(path.join(tmpDir, base + '.layout.json'), 'utf-8'));
  }catch(e){
    return { id:'pprn', faixas: FAIXAS };
  }
}
function materiaPorNumero(n, faixas){
  for(const [id, faixa] of Object.entries(faixas)){
    if(n>=faixa[0] && n<=faixa[1]) return id;
  }
  return '';
}
function carregarGab(base){
  try{ return JSON.parse(fs.readFileSync(path.join(tmpDir, base + '.gab.json'), 'utf-8')); }catch(e){ return {}; }
}
function tokensNome(base){
  const t = new Set();
  const u = base.toUpperCase();
  const rm = u.match(/\b(?:I{1,3}V?|V?I{1,3}|X{1,3}|IX|IV|VI|VII|VIII|IX|X|\d{1,2})\b/);
  if(rm) t.add(rm[0]);
  if(/MANS[AÃ]O|ECHOO/.test(u)) t.add('MANSÃO');
  return [...t];
}
function parearGabProva(gab, base){
  let n = Object.keys(gab).length;
  if(n >= 100) return gab;
  const toks = tokensNome(base);
  const candidatos = files.filter(f=>{
    if(f === base + '.txt') return false;
    if(!/^GABARITO/i.test(f) && !/COMENTADO/i.test(f)) return false;
    return toks.some(t=>f.toUpperCase().indexOf(t)>=0);
  });
  for(const c of candidatos){
    const g2 = carregarGab(c.slice(0,-4));
    if(Object.keys(g2).length > n){ Object.assign(gab, g2); n = Object.keys(gab).length; }
  }
  return gab;
}
function nomeSaida(base){
  if(/^II/i.test(base)) return 'simulado-ii.txt';
  if(/MANS[AÃ]O|ECHOO/i.test(base)) return 'simulado-mansao.txt';
  if(/AMOSTRA/i.test(base)) return 'simulado-amostra.txt';
  if(/OFICIAL|PROVA/i.test(base)) return 'simulado-pprn-2026.txt';
  const num = (base.match(/(\d{1,2})/)||[])[1];
  return 'simulado-'+(num?String(parseInt(num,10)).padStart(2,'0'):'amostra')+'.txt';
}

for(const f of files){
  const base = f.slice(0, -4);
  const layout = carregarLayout(base);
  const text = fs.readFileSync(path.join(tmpDir, f), 'utf-8');
  const blocks = parseProvaComBlocos(text);
  const itens = blocks.flatMap(b=>b.itens||b.items||[]);
  const qs = itens.map(it=>{
    const alts = {};
    Object.entries(it.alts||{}).forEach(([k,v])=>{ alts[k]=String(v).trim(); });
    return { n: it.n, materiaId: materiaPorNumero(it.n, layout.faixas), texto: String(it.texto).trim(), alts };
  }).sort((a,b)=>a.n-b.n);
  const temProvaIrma = /COMENTADO/i.test(base) && files.some(x=>{
    const bx = x.slice(0,-4);
    if(x===f || /COMENTADO/i.test(bx) || /^GABARITO/i.test(bx)) return false;
    return tokensNome(bx).some(t=>base.toUpperCase().indexOf(t)>=0);
  });
  if((/^GABARITO/i.test(base) && qs.length < 20) || (temProvaIrma && qs.length >= 20)){
    console.log('=== '+base+' ===');
    console.log('arquivo de gabarito/comentado (pareado com a prova).');
    continue;
  }

  let gab = carregarGab(base);
  gab = Object.fromEntries(Object.entries(gab).map(([k,v])=>[Number(k), String(v).toLowerCase()]));
  gab = parearGabProva(gab, base);

  const nums = qs.map(q=>q.n);
  const dups = nums.filter((n,i)=>nums.indexOf(n)!==i);
  const faltas = range(1,101).filter(n=>!nums.includes(n));

  const out = [];
  const ordemOut = Object.keys(layout.faixas).sort((a,b)=>layout.faixas[a][0]-layout.faixas[b][0]);
  for(const id of ordemOut){
    const g = qs.filter(q=>q.materiaId===id).sort((a,b)=>a.n-b.n);
    if(!g.length) continue;
    out.push(NOMES[id]);
    for(const q of g){
      out.push(String(q.n).padStart(2,'0')+') '+q.texto);
      for(const k of ['A','B','C','D','E']){
        if(q.alts[k]!=null) out.push(k+') '+q.alts[k]);
      }
    }
    out.push('');
  }
  out.push('===== GABARITO =====');
  out.push('');
  const gKeys = Object.keys(gab).map(Number).sort((a,b)=>a-b);
  if(gKeys.length < 5){
    out.push('(gabarito não disponível no PDF)');
  } else {
    for(const id of ordemOut){
      const [lo,hi] = layout.faixas[id] || FAIXAS[id];
      const keys = gKeys.filter(n=>n>=lo && n<=hi);
      if(!keys.length) continue;
      out.push(NOMES[id]);
      for(const n of keys) out.push(n+' - '+gab[n]);
      out.push('');
    }
  }

  const saida = nomeSaida(base);
  fs.writeFileSync(saida, out.join('\n'), 'utf-8');
  console.log('=== '+base+' ===');
  if(process.env.DEBUG){
    blocks.forEach((b,i)=>console.log('   bloco['+i+'] name='+JSON.stringify(b.name)+' nums='+JSON.stringify((b.itens||b.items||[]).map(it=>it.n))));
  }
  console.log('questoes:', qs.length, '| duplicatas:', dups.length?dups.join(','):'nenhuma', '| faltando:', faltas.length?faltas.join(','):'nenhuma');
  const semMateria = qs.filter(q=>!q.materiaId);
  console.log('sem materia:', semMateria.length?semMateria.map(q=>q.n).join(','):'nenhuma');
  const altBaixas = qs.filter(q=>Object.keys(q.alts).length<4).map(q=>q.n);
  console.log('questoes com <4 alternativas:', altBaixas.length?altBaixas.join(','):'nenhuma');
  const gabKeys = gKeys.length;
  const semGab = range(1,101).filter(n=>!gab[n]);
  console.log('gabarito:', gabKeys, 'respostas | faltando:', semGab.length?semGab.join(','):'nenhuma');
  console.log('arquivo gerado:', saida);
}

// helper
function range(a,b){ return Array.from({length:b-a},(_,i)=>i+a); }