/**
 * APROVA - MÓDULO DE LEGISLAÇÃO E VADE MECUM DIGITAL
 * Recursos: Vade Mecum Configurável por Concurso (PPRN, PPPE, etc.),
 * Hub Seletor de Leis para Simulados, Leitor Lateral (Drawer),
 * Busca Rápida de Artigos, Sumário e Vínculo com o Edital/Estudos.
 */

(function(){
  // Estado global do módulo de Leis
  window.LEIS_STATE = {
    catalogo: [],
    carregado: false,
    leiAtiva: null,
    artigoAtivo: null,
    drawerAberto: false,
    drawerFullscreen: false,
    filtroMateria: 'todas',
    termoBusca: '',
    cacheConteudo: {},
    cacheArtigosTexto: {},
    favoritos: JSON.parse(localStorage.getItem('aprova_leis_favoritos') || '{}'),
    anotacoes: JSON.parse(localStorage.getItem('aprova_leis_anotacoes') || '{}'),
    historico: JSON.parse(localStorage.getItem('aprova_leis_historico') || '[]'),
    selecao: {},
    perfilIaAtivo: 'esquematizado',
    aiProvider: localStorage.getItem('aprova_ai_provider') || 'gemini',
    aiApiKey: localStorage.getItem('aprova_ai_api_key') || ''
  };

  // Funções de Persistência e Gerenciamento da Seleção Multi-Leis por Concurso
  function obterChaveSelecao(){
    const cId = (typeof curId === 'function') ? curId() : 'default';
    return 'aprova_leis_selecao_' + cId;
  }

  window.carregarSelecao = function(){
    try {
      const key = obterChaveSelecao();
      const raw = localStorage.getItem(key);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)){
          window.LEIS_STATE.selecao = parsed;
          return parsed;
        }
      }
    } catch(e){
      console.warn('Erro ao carregar selecao de leis:', e);
    }
    window.LEIS_STATE.selecao = {};
    return {};
  };

  window.salvarSelecao = function(){
    try {
      const key = obterChaveSelecao();
      localStorage.setItem(key, JSON.stringify(window.LEIS_STATE.selecao || {}));
    } catch(e){
      console.warn('Erro ao salvar selecao de leis:', e);
    }
    if(typeof window.atualizarBarraFlutuanteSelecao === 'function') window.atualizarBarraFlutuanteSelecao();
    atualizarBadgeSelecaoGlobal();
  };

  function contarTotalSelecionados(){
    const sel = window.LEIS_STATE.selecao || {};
    let count = 0;
    Object.keys(sel).forEach(leiId => {
      const arr = sel[leiId];
      if(Array.isArray(arr)) count += arr.length;
    });
    return count;
  }

  function atualizarBadgeSelecaoGlobal(){
    const badge = document.getElementById('lei-total-selecionados-badge');
    if(badge) badge.innerText = contarTotalSelecionados();
  }

  function sincronizarCheckboxesLeitor(leiId){
    const container = document.getElementById('lei-text-container');
    if(!container) return;
    const selArr = (window.LEIS_STATE.selecao && window.LEIS_STATE.selecao[leiId]) || [];
    const cards = container.querySelectorAll('.lei-artigo-card');
    cards.forEach(card => {
      const art = card.dataset.artigo;
      const isSel = selArr.includes(art);
      card.classList.toggle('lei-art-selecionado', isSel);
      const chk = card.querySelector('.lei-art-chk');
      if(chk) chk.checked = isSel;
    });
  }

  function obterTodosArtigosDaLei(lei){
    if(Array.isArray(lei.artigos_todos) && lei.artigos_todos.length){
      return lei.artigos_todos;
    }
    const container = document.getElementById('lei-text-container');
    if(container){
      const cards = container.querySelectorAll('.lei-artigo-card');
      if(cards.length){
        const list = [];
        cards.forEach(c => {
          if(c.dataset.artigo && !list.includes(c.dataset.artigo)) list.push(c.dataset.artigo);
        });
        if(list.length) return list;
      }
    }
    const tot = parseInt(lei.total_artigos, 10) || 50;
    const fallback = [];
    for(let i=1; i<=tot; i++) fallback.push(String(i));
    return fallback;
  }

  // Carregamento do catálogo de leis (base + customizadas do acervo)
  async function carregarCatalogo(){
    if(window.LEIS_STATE.carregado && window.LEIS_STATE.catalogo.length) return window.LEIS_STATE.catalogo;
    let baseList = [];
    try {
      const res = await fetch('assets/leis/catalogo.json');
      if(res.ok){
        baseList = await res.json();
      }
    } catch(e) {
      console.warn('Erro ao carregar catalogo.json via fetch:', e);
    }
    const custom = JSON.parse(localStorage.getItem('aprova_leis_customizadas') || '[]');
    const ids = new Set(baseList.map(l => l.id));
    const merged = [...baseList, ...custom.filter(l => !ids.has(l.id))];
    window.LEIS_STATE.catalogo = merged;
    window.LEIS_STATE.carregado = true;
    return merged;
  }

  // Obter IDs das leis ativas para o concurso atual
  window.obterLeisAtivas = function(){
    const c = (typeof cur === 'function') ? cur() : null;
    if(c && Array.isArray(c.leisAtivas) && c.leisAtivas.length){
      return c.leisAtivas;
    }
    const cId = (typeof curId === 'function') ? curId() : 'default';
    const local = localStorage.getItem('aprova_leis_ativas_' + cId);
    if(local){
      try {
        const parsed = JSON.parse(local);
        if(Array.isArray(parsed) && parsed.length) return parsed;
      } catch(e){}
    }
    // Padrão inteligente por nome do concurso
    const nomeConc = (c && c.name ? c.name : '').toUpperCase();
    const cat = window.LEIS_STATE.catalogo || [];
    if(nomeConc.includes('PE') || nomeConc.includes('PERNAMBUCO')){
      // Concurso de Pernambuco: todas as federais + Pernambuco
      return cat.filter(l => l.categoria !== 'Estadual RN').map(l => l.id);
    } else if(nomeConc.includes('RN') || nomeConc.includes('NORTE')){
      // Concurso do RN: todas as federais + RN
      return cat.filter(l => l.categoria !== 'Estadual PE').map(l => l.id);
    }
    // Padrão geral: todas as federais
    const federais = cat.filter(l => l.categoria === 'Federal').map(l => l.id);
    return federais.length ? federais : cat.map(l => l.id);
  };

  window.salvarLeisAtivas = function(ids){
    const c = (typeof cur === 'function') ? cur() : null;
    if(c){
      c.leisAtivas = ids;
      if(typeof save === 'function') save();
    }
    const cId = (typeof curId === 'function') ? curId() : 'default';
    localStorage.setItem('aprova_leis_ativas_' + cId, JSON.stringify(ids));
    window.renderLeisView();
  };

  // Parser de Markdown Jurídico de Alta Performance e Padrão Profissional
  function parseLegalMarkdown(rawText, leiId){
    if(!rawText) return '<div class="empty">Conteúdo não disponível.</div>';
    
    // Remove YAML frontmatter
    let text = rawText;
    if(text.startsWith('---')){
      const p = text.split('---', 3);
      if(p.length >= 3) text = p[2].trim();
    }

    // Remove quaisquer spans ou âncoras residuais brutas
    text = text.replace(/<span[^>]*class=["']lei-anchor["'][^>]*><\/span>/gi, '');
    text = text.replace(/<span\s+id=["']art-[^"']+["'][^>]*><\/span>/gi, '');

    const favs = window.LEIS_STATE.favoritos[leiId] || [];
    const selArr = (window.LEIS_STATE.selecao && window.LEIS_STATE.selecao[leiId]) || [];

    // Divisão de linhas
    const lines = text.split('\n');
    let html = [];
    let inArtigo = false;
    let currentArtNum = '';
    let pendingEpigrafe = '';

    function fecharArtigoSeAberto(){
      if(inArtigo){
        html.push('</div></div>'); // fecha lei-artigo-body e lei-artigo-card
        inArtigo = false;
        currentArtNum = '';
      }
    }

    function formatarNumeroArtigo(numStr){
      const num = parseInt(numStr, 10);
      if(!isNaN(num) && num >= 1 && num <= 9 && String(num) === numStr){
        return `Art. ${num}º`;
      }
      return `Art. ${numStr}`;
    }

    // Verifica se uma linha próxima é o início de um artigo
    function buscarArtigoIminente(fromIndex){
      for(let j = fromIndex + 1; j < Math.min(fromIndex + 5, lines.length); j++){
        const l = lines[j].trim();
        if(!l) continue;
        if(l.startsWith('#')) return null;
        const m = l.match(/^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*/i);
        if(m) return m[1];
        if(l.startsWith('*(') && (l.toLowerCase().includes('nome jurídico') || l.toLowerCase().includes('denominação'))) continue;
        break;
      }
      return null;
    }

    for(let i = 0; i < lines.length; i++){
      let line = lines[i].trim();

      // Pula linhas vazias ou âncoras residuais - NUNCA FECHA DIV AQUI!
      if(!line || line.includes('lei-anchor') || line.match(/^<span\s+id=["']art-[^"']+["'][^>]*><\/span>$/i)){
        continue;
      }

      // Detecção de Títulos e Cabeçalhos de Seção
      if(line.startsWith('#')){
        fecharArtigoSeAberto();
        pendingEpigrafe = '';

        if(line.startsWith('# ')){
          const t = line.slice(2).replace(/\*/g,'').trim();
          html.push(`<div class="lei-heading-wrap lei-h1-wrap"><h1 class="lei-h1">${escapeHtml(t)}</h1></div>`);
          continue;
        }
        if(line.startsWith('## ')){
          const t = line.slice(3).replace(/\*/g,'').trim();
          const cleanSecId = 'sec-' + t.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
          html.push(`
            <div class="lei-heading-wrap lei-h2-wrap" id="${cleanSecId}">
              <div class="lei-h2-badge">SEÇÃO / TÍTULO</div>
              <h2 class="lei-h2">${escapeHtml(t)}</h2>
            </div>
          `);
          continue;
        }
        if(line.startsWith('### ')){
          const t = line.slice(4).replace(/\*/g,'').trim();
          const cleanSecId = 'sec-' + t.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
          html.push(`
            <div class="lei-heading-wrap lei-h3-wrap" id="${cleanSecId}">
              <h3 class="lei-h3">${escapeHtml(t)}</h3>
            </div>
          `);
          continue;
        }
        if(line.startsWith('#### ')){
          const t = line.slice(5).replace(/\*/g,'').trim();
          html.push(`
            <div class="lei-heading-wrap lei-h4-wrap">
              <h4 class="lei-h4">${escapeHtml(t)}</h4>
            </div>
          `);
          continue;
        }
      }

      // Detecção de Epígrafe / Rubrica Iminente antes do Artigo
      // Ex: "Anterioridade da lei", "**Ameaça**", "**Homicídio simples**"
      const artIminente = buscarArtigoIminente(i);
      const ehLinhaEpigrafe = !line.startsWith('**Art') && !line.startsWith('**§') && !line.startsWith('§') && 
                              !line.startsWith('**Parágrafo') && !line.startsWith('Parágrafo') && 
                              !line.match(/^[IVXLCDM]+\s*[-–—.]/i) && !line.match(/^[a-z]\)/i) && 
                              !line.startsWith('Pena') && !line.startsWith('**Pena') &&
                              line.length < 120;
      
      if(artIminente && ehLinhaEpigrafe){
        fecharArtigoSeAberto();
        if(line.startsWith('*(') && (line.toLowerCase().includes('nome jurídico') || line.toLowerCase().includes('denominação'))){
          // Nota de nome jurídico opcional
        } else {
          pendingEpigrafe = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
        }
        continue;
      }

      // Detecção de Artigos: **Art. 1º**, **Art. 121.**, **Artigo 147-A**, etc.
      const artMatch = line.match(/^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*\s*(?:[-–—.]\s*)?(.*)$/i);
      if(artMatch){
        fecharArtigoSeAberto();
        inArtigo = true;
        currentArtNum = artMatch[1].trim();
        const cleanId = 'art-' + currentArtNum.toLowerCase().replace(/[^0-9a-z\-]/g, '');
        const artTag = formatarNumeroArtigo(currentArtNum);
        const resto = artMatch[2] ? artMatch[2].trim() : '';
        const isFav = favs.includes(currentArtNum);
        const isSel = selArr.includes(currentArtNum);
        const rubrica = pendingEpigrafe;
        pendingEpigrafe = '';

        html.push(`
          <div class="lei-artigo-card ${isSel ? 'lei-art-selecionado' : ''}" id="${cleanId}" data-artigo="${currentArtNum}">
            <div class="lei-artigo-header">
              <div class="lei-artigo-info">
                <label class="lei-art-chk-wrap" title="${isSel ? 'Desmarcar artigo' : 'Selecionar artigo para caderno de revisão / PDF / IA'}">
                  <input type="checkbox" class="lei-art-chk" ${isSel ? 'checked' : ''} onchange="toggleSelecionarArtigo('${leiId}', '${currentArtNum}', this.checked)">
                  <span class="lei-art-chk-custom"></span>
                </label>
                <span class="lei-artigo-tag">${artTag}</span>
                ${rubrica ? `<span class="lei-artigo-rubrica" title="Rubrica / Nome Jurídico">⚡ ${escapeHtml(rubrica)}</span>` : ''}
              </div>
              <div class="lei-artigo-actions">
                <button class="btn-lei-icon ${isFav?'active':''}" onclick="toggleFavoritoArtigo('${leiId}', '${currentArtNum}')" title="${isFav?'Remover dos artigos para revisão':'Marcar este artigo para revisão'}">⭐ <span class="btn-lei-text">Revisar</span></button>
                <button class="btn-lei-icon" onclick="copiarArtigoTexto('${leiId}', '${cleanId}', '${currentArtNum}')" title="Copiar texto oficial formatado">📋 <span class="btn-lei-text">Copiar</span></button>
                <button class="btn-lei-icon" onclick="enviarArtigoTrilium('${leiId}', '${currentArtNum}')" title="Criar ou abrir anotação deste artigo no Trilium Notes">📝 <span class="btn-lei-text">Nota</span></button>
              </div>
            </div>
            <div class="lei-artigo-body">
              ${resto ? `
                <div class="lei-caput">
                  <span class="lei-caput-art">${artTag}</span>
                  <span class="lei-caput-text">${destacarTermos(formatarInline(resto))}</span>
                </div>
              ` : `
                <div class="lei-caput">
                  <span class="lei-caput-art">${artTag}</span>
                </div>
              `}
        `);
        continue;
      }

      // Se estamos dentro do Artigo: processa Parágrafos, Incisos, Alíneas, Penas e Notas
      if(inArtigo){
        // Parágrafos (§ 1º, Parágrafo único)
        const parMatch = line.match(/^\s*(?:\*\*)?(Parágrafo\s+único|§\s*[0-9]+[ºo\.]?(?:-[A-Za-z0-9]+)?)[ºo\.]?(?:\*\*)?\s*[-–—.]?\s*(.*)$/i);
        if(parMatch){
          let pLabel = parMatch[1].trim();
          if(!pLabel.endsWith('.') && !pLabel.endsWith('º')) pLabel += '.';
          const pResto = parMatch[2] ? parMatch[2].trim() : '';
          html.push(`
            <div class="lei-paragrafo">
              <span class="lei-paragrafo-label">${escapeHtml(pLabel)}</span>
              <span class="lei-paragrafo-text">${destacarTermos(formatarInline(pResto))}</span>
            </div>
          `);
          continue;
        }

        // Incisos (I -, II -, XIV -)
        const incMatch = line.match(/^([IVXLCDM]+)\s*[-–—.]\s*(.*)$/i);
        if(incMatch){
          const numRoman = incMatch[1].trim();
          const incResto = incMatch[2] ? incMatch[2].trim() : '';
          html.push(`
            <div class="lei-inciso">
              <span class="lei-inciso-num">${escapeHtml(numRoman)} –</span>
              <span class="lei-inciso-text">${destacarTermos(formatarInline(incResto))}</span>
            </div>
          `);
          continue;
        }

        // Alíneas (a), b), c))
        const alMatch = line.match(/^([a-z])\)\s*(.*)$/i);
        if(alMatch){
          const letra = alMatch[1].trim();
          const alResto = alMatch[2] ? alMatch[2].trim() : '';
          html.push(`
            <div class="lei-alinea">
              <span class="lei-alinea-letra">${escapeHtml(letra)})</span>
              <span class="lei-alinea-text">${destacarTermos(formatarInline(alResto))}</span>
            </div>
          `);
          continue;
        }

        // Itens (1., 2.)
        const itemMatch = line.match(/^([0-9]+)\.\s+(.*)$/);
        if(itemMatch){
          const itemNum = itemMatch[1].trim();
          const itemResto = itemMatch[2] ? itemMatch[2].trim() : '';
          html.push(`
            <div class="lei-item">
              <span class="lei-item-num">${escapeHtml(itemNum)}.</span>
              <span class="lei-item-text">${destacarTermos(formatarInline(itemResto))}</span>
            </div>
          `);
          continue;
        }

        // Penas (Pena - reclusão..., Pena - detenção...)
        const penaMatch = line.match(/^\s*(?:\*\*)?Pena(?:\*\*)?\s*[-–—:]\s*(.*)$/i);
        if(penaMatch){
          const penaResto = penaMatch[1] ? penaMatch[1].trim() : '';
          html.push(`
            <div class="lei-pena-box">
              <span class="lei-pena-badge">⚖️ PENA</span>
              <span class="lei-pena-text">${destacarTermos(formatarInline(penaResto))}</span>
            </div>
          `);
          continue;
        }

        // Notas legislativas de vigência, redação dada ou remissões
        const ehNota = (line.startsWith('*(') || line.startsWith('(')) && 
                       /(redação|vide|incluído|acrescido|alterad|revogad|vetad|em vigor|dou de)/i.test(line);
        if(ehNota){
          html.push(`<div class="lei-nota-legislativa">${destacarTermos(formatarInline(line))}</div>`);
          continue;
        }

        // Citações ou revogações
        if(line.startsWith('>') || line.toLowerCase().includes('(revogado)')){
          html.push(`<blockquote class="lei-quote">${destacarTermos(formatarInline(line.replace(/^>\s*/, '')))}</blockquote>`);
          continue;
        }

        // Parágrafo genérico de continuação dentro do artigo
        html.push(`<p class="lei-p">${destacarTermos(formatarInline(line))}</p>`);
      } else {
        // Texto introdutório fora de artigo (preâmbulo, ementa, etc.)
        if(line.startsWith('>')){
          html.push(`<blockquote class="lei-quote">${destacarTermos(formatarInline(line.replace(/^>\s*/, '')))}</blockquote>`);
        } else {
          html.push(`<p class="lei-p-intro">${destacarTermos(formatarInline(line))}</p>`);
        }
      }
    }

    fecharArtigoSeAberto();
    return html.join('\n');
  }

  function escapeHtml(str){
    if(!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatarInline(txt){
    if(!txt) return '';
    let res = escapeHtml(txt);
    res = res.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    res = res.replace(/\*(.*?)\*/g, '<i>$1</i>');
    res = res.replace(/~~(.*?)~~/g, '<del style="color:var(--muted)">$1</del>');
    return res;
  }

  function destacarTermos(txt){
    if(!txt) return '';
    const termos = [
      { regex: /\b(vedado|vedada|vedados|vedadas|inadmissível|inadmissíveis|proibido|proibida|proibidos|proibidas)\b/gi, cls: 'mark-red', title: 'Atenção: Vedação absoluta / Proibição' },
      { regex: /\b(salvo|exceto|ressalvado|ressalvada|ressalvados|ressalvadas)\b/gi, cls: 'mark-amber', title: 'Atenção: Exceção à regra geral' },
      { regex: /\b(imprescritível|imprescritíveis|inafiançável|inafiançáveis|insuscetível|insuscetíveis)\b/gi, cls: 'mark-purple', title: 'Cláusula pétrea / Mandado de criminalização' },
      { regex: /\b(reclusão|detenção|prisão simples)\b/gi, cls: 'mark-blue', title: 'Espécie de pena privativa de liberdade' },
      { regex: /\b(hediondo|hediondos|tortura|tráfico ilícito|terrorismo)\b/gi, cls: 'mark-red', title: 'Crime equiparado ou hediondo' },
      { regex: /\b(independentemente de|independente de|dispensada|dispensado)\b/gi, cls: 'mark-cyan', title: 'Dispensa de requisito legal' },
      { regex: /\b(privativamente|competência privativa|indelegável)\b/gi, cls: 'mark-blue', title: 'Competência privativa' }
    ];
    let out = txt;
    termos.forEach(t => {
      out = out.replace(t.regex, `<mark class="lei-mark ${t.cls}" title="${t.title}">$1</mark>`);
    });
    return out;
  }

  // RENDERIZAÇÃO DA ABA "⚖️ VADE MECUM / LEIS"
  window.renderLeisView = async function(){
    const el = document.getElementById('view-leis');
    if(!el) return;

    await carregarCatalogo();
    const cat = window.LEIS_STATE.catalogo || [];
    const leisAtivasIds = window.obterLeisAtivas();
    const filtro = window.LEIS_STATE.filtroMateria;
    const busca = (window.LEIS_STATE.termoBusca || '').toLowerCase().trim();

    // Filtros por matéria
    const materiasDisponiveis = [
      { id: 'todas', label: 'Todas as Ativas', icon: '📚' },
      { id: 'Direito Penal', label: 'Penal', icon: '⚖️' },
      { id: 'Direito Processual Penal', label: 'Proc. Penal', icon: '🛡️' },
      { id: 'Execução Penal', label: 'Exec. Penal', icon: '⛓️' },
      { id: 'Direito Constitucional', label: 'Constitucional', icon: '📜' },
      { id: 'Direito Administrativo', label: 'Administrativo', icon: '🏛️' },
      { id: 'Direito Civil', label: 'Civil & Processo', icon: '📖' },
      { id: 'Direito do Trabalho', label: 'Trabalho & Trib.', icon: '👷' },
      { id: 'Direitos Humanos', label: 'Direitos Humanos', icon: '👶' },
      { id: 'Legislação Específica', label: 'Extravagantes', icon: '🚓' },
      { id: 'Legislação Estadual (PE)', label: 'Leis PE', icon: '☀️' },
      { id: 'Legislação Estadual (RN)', label: 'Leis RN', icon: '🌴' }
    ];

    // Leis consideradas ativas para este concurso
    let leisAtivas = cat.filter(l => leisAtivasIds.includes(l.id));
    if(!leisAtivas.length) leisAtivas = cat; // Fallback se tudo desmarcado

    let leisFiltradas = leisAtivas.filter(lei => {
      let matchMat = false;
      if(filtro === 'todas') matchMat = true;
      else if(filtro === 'Direito Civil') matchMat = (lei.materia.includes('Civil') || lei.materia.includes('Consumidor'));
      else if(filtro === 'Direito do Trabalho') matchMat = (lei.materia.includes('Trabalho') || lei.materia.includes('Tributário') || lei.materia.includes('Financeiro'));
      else matchMat = (lei.materia === filtro) || (lei.categoria === filtro);
      if(!matchMat) return false;
      if(!busca) return true;
      const haystack = (lei.nome + ' ' + lei.numero + ' ' + lei.materia + ' ' + lei.descricao + ' ' + (lei.topicos_edital||[]).join(' ')).toLowerCase();
      if(busca.includes('art ') || busca.includes('art.')){
        const numArt = busca.replace(/[^0-9]/g, '');
        if(numArt && (lei.artigos_todos||[]).includes(numArt)) return true;
      }
      return haystack.includes(busca);
    });

    const pillsHtml = materiasDisponiveis.map(m => {
      const active = filtro === m.id ? 'active' : '';
      return `<button class="chip ${active}" onclick="setFiltroLeis('${m.id}')" style="cursor:pointer;padding:6px 12px;font-size:12px">${m.icon} ${m.label}</button>`;
    }).join('');

    const cardsHtml = leisFiltradas.length ? leisFiltradas.map(lei => {
      const favCount = (window.LEIS_STATE.favoritos[lei.id] || []).length;
      const badgeCls = lei.categoria.includes('PE') ? 'b-amber' : (lei.categoria.includes('RN') ? 'b-green' : 'b-blue');
      return `
        <div class="card lei-card" style="display:flex;flex-direction:column;justify-content:space-between;transition:transform .15s,box-shadow .15s">
          <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:28px">${lei.icone || '⚖️'}</span>
                <div>
                  <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--text)">${escapeHtml(lei.nome)}</h3>
                  <span class="muted" style="font-size:12px">${escapeHtml(lei.numero)}</span>
                </div>
              </div>
              <span class="badge ${badgeCls}" style="font-size:11px">${lei.categoria}</span>
            </div>
            
            <p style="font-size:12px;color:var(--muted);line-height:1.5;margin:8px 0 12px;min-height:36px">
              ${escapeHtml(lei.descricao || '')}
            </p>

            <div class="chips" style="margin-bottom:12px">
              <span class="chip c-none" style="font-size:11px">📜 ${lei.total_artigos} artigos</span>
              <span class="chip c-none" style="font-size:11px">📚 ${lei.materia}</span>
              ${favCount ? `<span class="chip c-amber" style="font-size:11px">⭐ ${favCount} marcado(s)</span>` : ''}
            </div>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:10px;margin-top:auto">
            <button class="btn sm" style="flex:1;background:linear-gradient(90deg,var(--accent),var(--accent2));font-weight:700" onclick="abrirLeitorLei('${lei.id}')">📖 Abrir Vade Mecum</button>
            <button class="btn ghost sm" onclick="abrirSumarioModal('${lei.id}')" title="Ver Capítulos e Títulos">📑 Capítulos</button>
            ${lei.fonte ? `<a href="${lei.fonte}" target="_blank" rel="noopener" class="btn ghost sm" style="text-decoration:none;display:inline-flex;align-items:center" title="Abrir texto oficial no Planalto/ALERN/ALEPE">🌐</a>` : ''}
          </div>
        </div>
      `;
    }).join('') : `
      <div class="empty" style="grid-column:1/-1">
        <span class="big">🔍</span>
        Nenhuma legislação ativa encontrada para "${escapeHtml(busca)}".<br>
        <button class="btn ghost sm" onclick="setFiltroLeis('todas');limparBuscaLeis()" style="margin-top:10px">Limpar Filtros</button>
        <button class="btn sm" onclick="abrirConfigLeisModal()" style="margin-top:10px;margin-left:6px">⚙️ Configurar Leis Ativas</button>
      </div>
    `;

    const nomeConcursoAtual = ((typeof cur === 'function' && cur() && cur().name) ? cur().name : 'Concurso');

    el.innerHTML = `
      <!-- Header do Vade Mecum com Botão de Configuração de Leis -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px">
            ⚖️ Vade Mecum & Legislação do Edital
            <span class="badge b-purple" style="font-size:12px">${leisAtivas.length} Leis Ativas</span>
          </h2>
          <span class="muted" style="font-size:12px">Configurado para: <b>${escapeHtml(nomeConcursoAtual)}</b> · Consulte artigos, copie fundamentações e grife trechos</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn sm" style="background:#2563eb;color:#fff;font-weight:700" onclick="abrirConfigLeisModal()">⚙️ Selecionar Leis (${leisAtivas.length}/${cat.length})</button>
          <button class="btn ghost sm" onclick="abrirFavoritosModal()">⭐ Artigos Marcados (${contarTodosFavoritos()})</button>
          <button class="btn ghost sm" onclick="abrirModalMeusArtigos()" style="border-color:var(--accent);color:var(--text);font-weight:700" title="Ver caderno de artigos selecionados para PDF e IA">📦 Meus Artigos (<span id="lei-total-selecionados-badge">${contarTotalSelecionados()}</span>)</button>
        </div>
      </div>

      <!-- Barra de Busca Rápida -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:240px;position:relative">
          <input type="text" id="lei-search-inp" placeholder="Buscar lei ou artigo (ex: 'lep 41', 'art 121', 'abuso', 'drogas', 'tortura')..." value="${escapeHtml(window.LEIS_STATE.termoBusca||'')}" oninput="debouncedBuscaLeis(this.value)" style="padding-left:36px;font-size:14px">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px">🔍</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn ghost sm" onclick="pesquisarArtigoDireto('lep', '41')">⚡ LEP 41</button>
          <button class="btn ghost sm" onclick="pesquisarArtigoDireto('cp', '121')">⚡ CP 121</button>
          <button class="btn ghost sm" onclick="pesquisarArtigoDireto('cf88', '5')">⚡ CF Art. 5º</button>
          <button class="btn ghost sm" onclick="pesquisarArtigoDireto('cpp', '302')">⚡ CPP 302</button>
        </div>
      </div>

      <!-- Filtros por Matéria -->
      <div class="chips" style="margin-bottom:18px;gap:8px">
        ${pillsHtml}
      </div>

      <!-- Grid de Leis -->
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px">
        ${cardsHtml}
      </div>
    `;
  };

  window.setFiltroLeis = function(materiaId){
    window.LEIS_STATE.filtroMateria = materiaId;
    window.renderLeisView();
  };

  let buscaTimer = null;
  window.debouncedBuscaLeis = function(val){
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(()=>{
      window.LEIS_STATE.termoBusca = val;
      window.renderLeisView();
    }, 250);
  };

  window.limparBuscaLeis = function(){
    window.LEIS_STATE.termoBusca = '';
    window.renderLeisView();
  };

  window.pesquisarArtigoDireto = function(leiId, artNum){
    abrirLeitorLei(leiId, artNum);
  };

  // ESTADO DO MODAL DE CONFIGURAÇÃO DE LEIS
  window.configLeisCatAtiva = 'todas';
  window.configLeisTermo = '';

  // MODAL DE CONFIGURAÇÃO DE LEIS DO CONCURSO (SELEÇÃO AMPLA E IMPORTAÇÃO)
  window.abrirConfigLeisModal = async function(){
    await carregarCatalogo();
    const cat = window.LEIS_STATE.catalogo || [];
    const ativas = window.obterLeisAtivas();
    const nomeConc = ((typeof cur === 'function' && cur() && cur().name) ? cur().name : 'Concurso');

    window.configLeisCatAtiva = 'todas';
    window.configLeisTermo = '';

    const itensHtml = cat.map(lei => {
      const checked = ativas.includes(lei.id) ? 'checked' : '';
      const badgeCls = lei.categoria.includes('PE') ? 'b-amber' : (lei.categoria.includes('RN') ? 'b-green' : 'b-blue');
      const searchData = (lei.nome + ' ' + lei.numero + ' ' + lei.materia + ' ' + (lei.descricao||'')).toLowerCase();
      return `
        <label class="config-lei-item" data-id="${lei.id}" data-cat="${lei.categoria}" data-mat="${lei.materia}" data-search="${escapeHtml(searchData)}" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--card2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:border-color .15s">
          <input type="checkbox" class="chk-config-lei" value="${lei.id}" ${checked} onchange="atualizarContadorConfigLeis()" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
          <span style="font-size:20px">${lei.icone||'⚖️'}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <b style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(lei.nome)}</b>
              ${lei.isCustom ? '<span class="badge b-purple" style="font-size:9px">Acervo / Importada</span>' : ''}
            </div>
            <span class="muted" style="font-size:11px">${escapeHtml(lei.numero)} · ${lei.materia} · 📜 ${lei.total_artigos} artigos</span>
          </div>
          <span class="badge ${badgeCls}" style="font-size:10px;white-space:nowrap">${lei.categoria}</span>
        </label>
      `;
    }).join('');

    let m = document.getElementById('lei-config-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-config-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';
    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharConfigLeisModal()"></div>
      <div class="lei-modal-box">
        <!-- Cabeçalho -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px">
              ⚙️ Catálogo Geral & Seleção de Leis
            </h3>
            <span class="muted" style="font-size:12px">Concurso ativo: <b>${escapeHtml(nomeConc)}</b> · <span id="config-leis-count-badge" style="color:var(--accent);font-weight:700">${ativas.length} selecionadas de ${cat.length} disponíveis</span></span>
          </div>
          <button class="btn ghost sm" onclick="fecharConfigLeisModal()" style="font-size:15px;padding:3px 8px" title="Fechar (Esc)">✕</button>
        </div>

        <!-- Presets Rápidos por Tipo de Concurso -->
        <div style="background:var(--card2);border:1px dashed var(--border);border-radius:8px;padding:8px 10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px">⚡ Seleção Rápida por Cargo / Concurso:</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('policial')" title="CP, CPP, LEP, Abuso, Drogas, Hediondos, Desarmamento, etc.">🚓 Carreiras Policiais</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('pe')" title="Federais + Todas as Leis de Pernambuco">☀️ + Leis de PE (PPPE/PCPE)</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('rn')" title="Federais + Todas as Leis do RN">🌴 + Leis do RN (PPRN/PCRN)</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('tribunais')" title="CF, CC, CPC, CP, CPP, CLT, 8.112, etc.">🏛️ Tribunais (TJ/TRF/TRT)</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('adm')" title="CF, 8.112, ProcAdm, Improbidade, LAI, LRF">👔 Administrativo & Fiscal</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('federal')" title="Apenas legislações federais">📜 Só Federais</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px;margin-left:auto" onclick="aplicarPresetLeis('todas')">✨ Marcar Todas</button>
            <button class="btn ghost sm" style="font-size:11px;padding:3px 8px" onclick="aplicarPresetLeis('limpar')">🧹 Limpar</button>
          </div>
        </div>

        <!-- Barra de Busca Rápida no Modal -->
        <div style="position:relative;margin-bottom:10px">
          <input type="text" id="config-lei-search-inp" placeholder="🔍 Filtrar por nome, número ou matéria (ex: penal, civil, 8.112, pe, rn)..." oninput="filtrarListaConfigLeis(undefined, this.value)" style="width:100%;padding:8px 12px 8px 34px;border:1px solid var(--border);border-radius:8px;background:var(--card2);color:var(--text);font-size:13px">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px">🔍</span>
        </div>

        <!-- Filtros Rápidos por Categoria / Matéria -->
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px" id="config-cat-pills">
          <button class="config-cat-pill active" data-cat="todas" onclick="filtrarListaConfigLeis('todas', undefined)">Todas (${cat.length})</button>
          <button class="config-cat-pill" data-cat="penal" onclick="filtrarListaConfigLeis('penal', undefined)">⚖️ Penal & Policial</button>
          <button class="config-cat-pill" data-cat="adm" onclick="filtrarListaConfigLeis('adm', undefined)">🏛️ Constitucional & Adm</button>
          <button class="config-cat-pill" data-cat="civil" onclick="filtrarListaConfigLeis('civil', undefined)">📖 Civil & Processo</button>
          <button class="config-cat-pill" data-cat="trabalho" onclick="filtrarListaConfigLeis('trabalho', undefined)">👷 Trabalho & Trib.</button>
          <button class="config-cat-pill" data-cat="pe" onclick="filtrarListaConfigLeis('pe', undefined)">☀️ Leis PE</button>
          <button class="config-cat-pill" data-cat="rn" onclick="filtrarListaConfigLeis('rn', undefined)">🌴 Leis RN</button>
        </div>

        <!-- Lista de Leis Disponíveis -->
        <div id="config-leis-container" style="max-height:45vh;overflow-y:auto;padding-right:4px;margin-bottom:12px">
          ${itensHtml}
        </div>

        <!-- Seção de Importação do Acervo Completo (323 mil normas do leis-br-main) -->
        <details style="background:var(--card2);border:1px dashed var(--accent);border-radius:8px;padding:8px 12px;margin-bottom:12px">
          <summary style="font-weight:700;color:var(--accent);cursor:pointer;font-size:13px">
            ➕ Não encontrou uma lei? Importe qualquer norma do acervo (leis-br-main)
          </summary>
          <div style="margin-top:8px;font-size:12px;color:var(--muted);line-height:1.5">
            O seu repositório local <b>leis-br-main</b> possui mais de <b>320 mil normas</b> (federais, de todos os 27 estados e municípios). Você pode carregar qualquer arquivo <code>.md</code> de lá ou colar o texto da lei para integrá-la instantaneamente ao seu sistema!
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">
            <label class="btn sm" style="background:linear-gradient(90deg,var(--accent),var(--accent2));color:#fff;cursor:pointer;font-weight:700">
              📁 Escolher arquivo .md do leis-br-main
              <input type="file" accept=".md,text/markdown,text/plain" onchange="importarLeiDoArquivoMD(this)" style="display:none">
            </label>
            <button class="btn ghost sm" onclick="document.getElementById('config-paste-box').style.display='block'">📝 Colar texto de lei</button>
          </div>
          <div id="config-paste-box" style="display:none;margin-top:10px">
            <textarea id="config-paste-txt" rows="4" style="width:100%;font-size:12px;margin-bottom:6px" placeholder="Cole aqui o texto da lei ou markdown com frontmatter..."></textarea>
            <div style="display:flex;gap:6px">
              <button class="btn sm" onclick="importarLeiDoTextoColado()">➕ Salvar e Adicionar Lei</button>
              <button class="btn ghost sm" onclick="document.getElementById('config-paste-box').style.display='none'">Cancelar</button>
            </div>
          </div>
        </details>

        <!-- Rodapé do Modal -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:12px;flex-wrap:wrap;gap:8px">
          <button class="btn ghost" onclick="fecharConfigLeisModal()">Cancelar</button>
          <button class="btn" style="background:#2563eb;color:#fff;font-weight:700;padding:8px 18px" onclick="salvarSelecaoLeisModal()">💾 Salvar Leis do Concurso</button>
        </div>
      </div>
    `;
  };

  window.fecharConfigLeisModal = function(){
    const m = document.getElementById('lei-config-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  window.filtrarListaConfigLeis = function(cat, busca){
    if(cat !== undefined) window.configLeisCatAtiva = cat;
    if(busca !== undefined) window.configLeisTermo = (busca||'').toLowerCase().trim();

    const items = document.querySelectorAll('.config-lei-item');
    let visiveis = 0;
    const total = items.length;

    items.forEach(el => {
      const itemCat = el.getAttribute('data-cat') || '';
      const itemMat = el.getAttribute('data-mat') || '';
      const sData = el.getAttribute('data-search') || '';

      let matchCat = false;
      const c = window.configLeisCatAtiva;
      if(c === 'todas') matchCat = true;
      else if(c === 'penal') matchCat = itemMat.includes('Penal') || itemMat.includes('Específica');
      else if(c === 'adm') matchCat = itemMat.includes('Administrativo') || itemMat.includes('Constitucional') || itemMat.includes('Financeiro');
      else if(c === 'civil') matchCat = itemMat.includes('Civil') || itemMat.includes('Processual Civil') || itemMat.includes('Consumidor') || itemMat.includes('Humanos');
      else if(c === 'trabalho') matchCat = itemMat.includes('Trabalho') || itemMat.includes('Tributário');
      else if(c === 'pe') matchCat = itemCat.includes('PE') || itemMat.includes('PE');
      else if(c === 'rn') matchCat = itemCat.includes('RN') || itemMat.includes('RN');

      const matchBusca = !window.configLeisTermo || sData.includes(window.configLeisTermo);

      if(matchCat && matchBusca){
        el.style.display = 'flex';
        visiveis++;
      } else {
        el.style.display = 'none';
      }
    });

    document.querySelectorAll('.config-cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cat') === window.configLeisCatAtiva);
    });

    atualizarContadorConfigLeis(visiveis, total);
  };

  window.atualizarContadorConfigLeis = function(visiveis, totalParam){
    const total = (totalParam !== undefined) ? totalParam : document.querySelectorAll('.config-lei-item').length;
    const selecionadas = document.querySelectorAll('.chk-config-lei:checked').length;
    const el = document.getElementById('config-leis-count-badge');
    if(el){
      const vText = (visiveis !== undefined && visiveis !== total) ? ` · Exibindo ${visiveis} de ${total}` : ` · ${total} disponíveis`;
      el.innerHTML = `${selecionadas} selecionada(s)${vText}`;
    }
  };

  window.aplicarPresetLeis = function(tipo){
    const chks = document.querySelectorAll('.chk-config-lei');
    const cat = window.LEIS_STATE.catalogo || [];
    chks.forEach(chk => {
      const lei = cat.find(l => l.id === chk.value);
      if(!lei) return;
      if(tipo === 'todas'){
        chk.checked = true;
      } else if(tipo === 'limpar'){
        chk.checked = false;
      } else if(tipo === 'policial'){
        // Núcleo de Carreiras Policiais (PP, PC, PM, PRF, PF)
        const policialIds = ['cf88','cp','cpp','lep','abuso','drogas','hediondos','desarmamento','orcrim','mariapenha','tortura','lavagem','interceptacao','temporaria','jecrim','ctb_penal','ambientais','eca','lei8112','procadm','improbidade','lai'];
        chk.checked = policialIds.includes(lei.id);
      } else if(tipo === 'pe'){
        // Concurso de Pernambuco (PPPE / PCPE): Federais Policiais + Todas de PE
        const peIds = ['cf88','cp','cpp','lep','abuso','drogas','hediondos','desarmamento','orcrim','mariapenha','tortura','lavagem','interceptacao','temporaria','ctb_penal','eca','improbidade','procadm','constituicao_pe','pe_pc','pe_coj'];
        chk.checked = peIds.includes(lei.id) || lei.categoria === 'Estadual PE';
      } else if(tipo === 'rn'){
        // Concurso do RN (PPRN / PCRN): Federais Policiais + Todas do RN
        const rnIds = ['cf88','cp','cpp','lep','abuso','drogas','hediondos','desarmamento','orcrim','mariapenha','tortura','lavagem','interceptacao','temporaria','ctb_penal','eca','improbidade','procadm','constituicao_rn','lc727_rn'];
        chk.checked = rnIds.includes(lei.id) || lei.categoria === 'Estadual RN';
      } else if(tipo === 'tribunais'){
        // Tribunais (TJ, TRF, TRT, MPU, Defensoria)
        const tribIds = ['cf88','cc','cpc','cp','cpp','clt','lei8112','procadm','improbidade','lai','ms','acp','jecrim','cdc','eca','idoso','pcd'];
        chk.checked = tribIds.includes(lei.id);
      } else if(tipo === 'adm'){
        // Carreiras Administrativas & Fiscais
        const admIds = ['cf88','lei8112','procadm','improbidade','lai','lgpd','lrf','ctn','cdc','ms','acp'];
        chk.checked = admIds.includes(lei.id);
      } else if(tipo === 'federal'){
        chk.checked = (lei.categoria === 'Federal');
      }
    });
    atualizarContadorConfigLeis();
  };

  window.salvarSelecaoLeisModal = function(){
    const chks = document.querySelectorAll('.chk-config-lei:checked');
    const ids = Array.from(chks).map(c => c.value);
    if(!ids.length){
      if(!confirm('Nenhuma lei foi marcada. Deseja marcar o núcleo de leis federais como padrão?')){
        return;
      }
      aplicarPresetLeis('federal');
      return;
    }
    window.salvarLeisAtivas(ids);
    fecharConfigLeisModal();
  };

  // IMPORTAÇÃO DE LEIS DO ACERVO LEIS-BR-MAIN
  function extrairInfoLeiMarkdown(rawText, fileName){
    const text = rawText || '';
    const meta = {};
    if(text.startsWith('---')){
      const parts = text.split('---', 2);
      if(parts.length >= 2){
        for(const line of parts[1].split('\n')){
          const idx = line.indexOf(':');
          if(idx > -1){
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            meta[k] = v;
          }
        }
      }
    }
    const baseName = (fileName || 'lei').replace(/\.md$/i, '');
    const cleanId = 'usr_' + baseName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
    const titulo = meta.titulo || (text.match(/^#\s+(.+)$/m) ? text.match(/^#\s+(.+)$/m)[1] : baseName);
    const numero = meta.numero ? ((meta.tipo ? meta.tipo + ' nº ' : 'Lei ') + meta.numero) : baseName;
    const uf = meta.uf ? meta.uf.toUpperCase() : '';
    const categoria = uf ? ('Estadual ' + uf) : (meta.esfera || 'Federal');
    const icone = uf ? '☀️' : '⚖️';

    // Detecção de Artigos
    const artRegex = /^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*/gim;
    const arts = [];
    let m;
    while((m = artRegex.exec(text)) !== null){
      arts.push(m[1].trim());
    }

    // Detecção de Sumário (TOC)
    const toc = [];
    for(const l of text.split('\n')){
      const trimmed = l.trim();
      if(trimmed.startsWith('#') && /(título|titulo|capítulo|capitulo|seção|secao|livro)/i.test(trimmed)){
        toc.push({
          level: (trimmed.match(/^#+/)||['#'])[0].length,
          title: trimmed.replace(/^#+\s*/, '').replace(/\*/g, '')
        });
      }
    }

    return {
      id: cleanId,
      nome: titulo,
      numero: numero,
      materia: 'Legislação Específica',
      materia_cur: 'Específica',
      categoria: categoria,
      icone: icone,
      descricao: meta.ementa || 'Legislação importada do acervo pelo candidato.',
      arquivo: '',
      size_kb: Math.round(text.length / 1024),
      fonte: meta.fonte || '',
      topicos_edital: [titulo],
      total_artigos: arts.length,
      artigos_amostra: arts.slice(0, 15),
      artigos_todos: arts,
      toc: toc.slice(0, 40),
      isCustom: true
    };
  }

  window.importarLeiDoArquivoMD = function(input){
    const file = input.files && input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e){
      try {
        const raw = e.target.result;
        const novaLei = extrairInfoLeiMarkdown(raw, file.name);

        // Salva nos customizados
        const custom = JSON.parse(localStorage.getItem('aprova_leis_customizadas') || '[]');
        const idx = custom.findIndex(l => l.id === novaLei.id);
        if(idx >= 0) custom[idx] = novaLei;
        else custom.push(novaLei);
        localStorage.setItem('aprova_leis_customizadas', JSON.stringify(custom));
        localStorage.setItem('aprova_lei_raw_' + novaLei.id, raw);

        // Adiciona ao catálogo ativo
        const catIdx = window.LEIS_STATE.catalogo.findIndex(l => l.id === novaLei.id);
        if(catIdx >= 0) window.LEIS_STATE.catalogo[catIdx] = novaLei;
        else window.LEIS_STATE.catalogo.push(novaLei);

        // Ativa para o concurso
        const ativas = window.obterLeisAtivas();
        if(!ativas.includes(novaLei.id)){
          ativas.push(novaLei.id);
          window.salvarLeisAtivas(ativas);
        }

        alert('✅ Legislação "' + novaLei.nome + '" (' + novaLei.total_artigos + ' artigos) importada e ativada com sucesso!');
        window.abrirConfigLeisModal();
      } catch(err){
        alert('Erro ao importar arquivo de lei: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
    input.value = '';
  };

  window.importarLeiDoTextoColado = function(){
    const txt = (document.getElementById('config-paste-txt') ? document.getElementById('config-paste-txt').value : '').trim();
    if(!txt){ alert('Cole o conteúdo da lei no campo.'); return; }
    const novaLei = extrairInfoLeiMarkdown(txt, 'lei_colada_' + Date.now());

    const custom = JSON.parse(localStorage.getItem('aprova_leis_customizadas') || '[]');
    custom.push(novaLei);
    localStorage.setItem('aprova_leis_customizadas', JSON.stringify(custom));
    localStorage.setItem('aprova_lei_raw_' + novaLei.id, txt);

    window.LEIS_STATE.catalogo.push(novaLei);
    const ativas = window.obterLeisAtivas();
    if(!ativas.includes(novaLei.id)){
      ativas.push(novaLei.id);
      window.salvarLeisAtivas(ativas);
    }
    alert('✅ Legislação "' + novaLei.nome + '" importada com sucesso!');
    window.abrirConfigLeisModal();
  };

  // HUB / SELETOR DE VADE MECUM PARA SIMULADOS E ESTUDOS
  window.abrirVadeMecumHub = async function(){
    await carregarCatalogo();
    const cat = window.LEIS_STATE.catalogo || [];
    const ativasIds = window.obterLeisAtivas();
    let leis = cat.filter(l => ativasIds.includes(l.id));
    if(!leis.length) leis = cat;

    const listHtml = leis.map(lei => `
      <div class="card" style="padding:10px 14px;background:var(--card2);border:1px solid var(--border);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:border-color .15s" onclick="fecharModalHub();abrirLeitorLei('${lei.id}')">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:24px">${lei.icone||'⚖️'}</span>
          <div>
            <b style="font-size:14px;color:var(--text);display:block">${escapeHtml(lei.nome)}</b>
            <span class="muted" style="font-size:11px">${escapeHtml(lei.numero)} · ${lei.total_artigos} artigos</span>
          </div>
        </div>
        <button class="btn sm" style="background:#2563eb;color:#fff;font-weight:700">Abrir ➔</button>
      </div>
    `).join('');

    let m = document.getElementById('lei-hub-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-hub-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';
    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalHub()"></div>
      <div class="lei-modal-box" style="max-width:680px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--text)">⚖️ Consultar Vade Mecum</h3>
            <span class="muted" style="font-size:12px">Selecione uma lei ou digite para pesquisar diretamente</span>
          </div>
          <button class="btn ghost sm" onclick="fecharModalHub()" style="font-size:14px;padding:3px 8px">✕</button>
        </div>

        <!-- Busca direta no Hub -->
        <div style="margin-bottom:14px;position:relative">
          <input type="text" id="hub-search-inp" placeholder="Pesquisar lei ou artigo (ex: 'lep 41', 'art 121 cp', 'abuso', 'flagrante')..." oninput="filtrarHubLeis(this.value)" style="padding-left:36px;font-size:14px" autofocus>
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted)">🔍</span>
        </div>

        <div id="hub-leis-list" style="display:grid;grid-template-columns:1fr;gap:8px;max-height:55vh;overflow-y:auto;padding-right:4px">
          ${listHtml}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;border-top:1px solid var(--border);padding-top:10px">
          <button class="btn ghost sm" onclick="fecharModalHub();abrirConfigLeisModal()">⚙️ Configurar Leis do Concurso</button>
          <button class="btn ghost sm" onclick="fecharModalHub()">Fechar</button>
        </div>
      </div>
    `;
  };

  window.fecharModalHub = function(){
    const m = document.getElementById('lei-hub-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  window.filtrarHubLeis = function(val){
    const v = (val||'').toLowerCase().trim();
    const cat = window.LEIS_STATE.catalogo || [];
    const ativas = window.obterLeisAtivas();
    const container = document.getElementById('hub-leis-list');
    if(!container) return;

    // Se o usuário digitou comando direto tipo "lep 41" ou "cp 121"
    if(v.startsWith('lep ') || v.startsWith('cp ') || v.startsWith('cpp ') || v.startsWith('cf ')){
      const partes = v.split(' ');
      const prefix = partes[0];
      const art = partes[1].replace(/[^0-9]/g, '');
      const leiMap = { lep: 'lep', cp: 'cp', cpp: 'cpp', cf: 'cf88' };
      if(leiMap[prefix] && art){
        container.innerHTML = `
          <div class="card" style="padding:14px;background:rgba(37,99,235,0.15);border:1px solid var(--blue);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between" onclick="fecharModalHub();abrirLeitorLei('${leiMap[prefix]}', '${art}')">
            <div>
              <b style="font-size:15px;color:var(--text)">⚡ Abrir Artigo ${art} de ${prefix.toUpperCase()}</b>
              <div class="muted" style="font-size:12px">Pular diretamente para o Artigo ${art}</div>
            </div>
            <button class="btn sm" style="background:#2563eb;color:#fff;font-weight:700">Ir Agora ➔</button>
          </div>
        `;
        return;
      }
    }

    const leis = cat.filter(l => ativas.includes(l.id) && (l.nome + ' ' + l.numero + ' ' + l.descricao + ' ' + l.materia).toLowerCase().includes(v));
    if(!leis.length){
      container.innerHTML = '<div class="empty">Nenhuma lei correspondente. Tente outro termo ou configure as leis ativas.</div>';
      return;
    }

    container.innerHTML = leis.map(lei => `
      <div class="card" style="padding:10px 14px;background:var(--card2);border:1px solid var(--border);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:border-color .15s" onclick="fecharModalHub();abrirLeitorLei('${lei.id}')">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:24px">${lei.icone||'⚖️'}</span>
          <div>
            <b style="font-size:14px;color:var(--text);display:block">${escapeHtml(lei.nome)}</b>
            <span class="muted" style="font-size:11px">${escapeHtml(lei.numero)} · ${lei.total_artigos} artigos</span>
          </div>
        </div>
        <button class="btn sm" style="background:#2563eb;color:#fff;font-weight:700">Abrir ➔</button>
      </div>
    `).join('');
  };

  // TOAST NOTIFICATION MODERNO PARA LEIS
  window.mostrarToastLeis = function(msg){
    let toast = document.getElementById('lei-toast');
    if(!toast){
      toast = document.createElement('div');
      toast.id = 'lei-toast';
      toast.className = 'lei-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.display = 'flex';
    clearTimeout(window._leiToastTimer);
    window._leiToastTimer = setTimeout(()=>{
      if(toast) toast.style.display = 'none';
    }, 2800);
  };

  // AJUSTE DE TAMANHO DE FONTE DO LEITOR
  window.alterarTamanhoFonteLeis = function(delta){
    let curSize = parseInt(localStorage.getItem('aprova_lei_font_size') || '15', 10);
    curSize = Math.max(13, Math.min(20, curSize + delta));
    localStorage.setItem('aprova_lei_font_size', String(curSize));
    document.documentElement.style.setProperty('--lei-font-size', curSize + 'px');
    window.mostrarToastLeis(`🔍 Tamanho da fonte: ${curSize}px`);
  };

  // RECOLHER / EXPANDIR SUMÁRIO LATERAL
  window.toggleSumarioLateral = function(){
    const aside = document.querySelector('.lei-reader-toc');
    if(aside){
      aside.classList.toggle('collapsed');
      const isCollapsed = aside.classList.contains('collapsed');
      window.mostrarToastLeis(isCollapsed ? '📑 Sumário recolhido' : '📑 Sumário expandido');
    }
  };

  // BUSCA EM TEMPO REAL DENTRO DO TEXTO DA LEI ATIVA
  window.buscarTextoNaLei = function(query){
    const q = (query || '').toLowerCase().trim();
    const container = document.getElementById('lei-text-container');
    if(!container) return;
    
    const countEl = document.getElementById('lei-search-match-count');
    const cards = container.querySelectorAll('.lei-artigo-card');

    if(!q){
      if(countEl) countEl.innerText = '';
      cards.forEach(c => c.style.display = '');
      return;
    }

    let matchCount = 0;
    let firstMatch = null;
    
    cards.forEach(c => {
      const text = c.innerText.toLowerCase();
      if(text.includes(q)){
        c.style.display = '';
        matchCount++;
        if(!firstMatch) firstMatch = c;
      } else {
        if(q.length >= 3){
          c.style.display = 'none';
        } else {
          c.style.display = '';
        }
      }
    });

    if(countEl){
      countEl.innerText = matchCount ? `${matchCount} art.` : '0 art.';
    }

    if(firstMatch){
      firstMatch.scrollIntoView({ behavior: 'smooth', block: 'start' });
      firstMatch.classList.remove('lei-art-highlight');
      void firstMatch.offsetWidth;
      firstMatch.classList.add('lei-art-highlight');
    }
  };

  // ABERTURA DO LEITOR DE LEIS (DRAWER / FULLSCREEN)
  window.abrirLeitorLei = async function(leiId, artigoAlvo){
    await carregarCatalogo();
    const lei = window.LEIS_STATE.catalogo.find(l => l.id === leiId);
    if(!lei){ window.mostrarToastLeis('⚠️ Legislação não encontrada: ' + leiId); return; }

    window.LEIS_STATE.leiAtiva = lei;
    window.LEIS_STATE.artigoAtivo = artigoAlvo || null;

    // Aplica preferência de fonte salva
    const savedFontSize = localStorage.getItem('aprova_lei_font_size') || '15';
    document.documentElement.style.setProperty('--lei-font-size', savedFontSize + 'px');

    const favsList = window.LEIS_STATE.favoritos[lei.id] || [];
    const favsCount = favsList.length;

    let drawer = document.getElementById('lei-reader-drawer');
    if(!drawer){
      drawer = document.createElement('div');
      drawer.id = 'lei-reader-drawer';
      document.body.appendChild(drawer);
    }

    drawer.className = 'lei-drawer-open' + (window.LEIS_STATE.drawerFullscreen ? ' lei-drawer-fullscreen' : '');
    drawer.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharLeitorLei()"></div>
      <div class="lei-drawer-content">
        <!-- Barra de Ferramentas Superior do Leitor -->
        <div class="lei-reader-header">
          <div class="lei-reader-title-box">
            <button class="btn ghost sm" onclick="fecharLeitorLei()" style="font-size:16px;padding:4px 10px" title="Fechar leitor (Esc)">✕</button>
            <div style="min-width:0">
              <h3 style="margin:0;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">
                ${lei.icone||'⚖️'} ${escapeHtml(lei.nome)}
              </h3>
              <span class="muted" style="font-size:11px">${escapeHtml(lei.numero)} · 📜 ${lei.total_artigos} artigos · <span style="color:var(--accent);font-weight:700">${favsCount} marcado(s)</span></span>
            </div>
          </div>

          <!-- Pulo Rápido para Artigo -->
          <div class="lei-jump-box">
            <span style="font-size:11.5px;font-weight:700;color:var(--muted)">Art.:</span>
            <input type="text" id="lei-quick-jump" placeholder="ex: 121" value="${artigoAlvo||''}" onkeydown="if(event.key==='Enter')pularParaArtigo(this.value)">
            <button class="btn sm" style="padding:4px 10px;font-size:12px;font-weight:700" onclick="pularParaArtigo(document.getElementById('lei-quick-jump').value)">Ir</button>
          </div>

          <!-- Busca Rápida Dentro da Lei -->
          <div class="lei-search-in-law" title="Buscar termo nesta legislação">
            <span style="font-size:12px;color:var(--muted)">🔍</span>
            <input type="text" id="lei-in-law-search" placeholder="Filtrar texto..." oninput="buscarTextoNaLei(this.value)">
            <span id="lei-search-match-count" class="muted" style="font-size:10px;font-weight:700"></span>
          </div>

          <!-- Ações e Controles de Visualização -->
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
            <button class="btn sm" onclick="abrirModalSelecionarArtigosLei('${lei.id}')" title="Selecionar múltiplos artigos desta legislação" style="background:rgba(139,92,246,0.18);border-color:var(--accent);color:var(--text);font-weight:700">☑️ Selecionar artigos</button>
            <button class="btn ghost sm" onclick="alterarTamanhoFonteLeis(-1)" title="Diminuir tamanho da fonte" style="padding:3px 7px;font-weight:700">A-</button>
            <button class="btn ghost sm" onclick="alterarTamanhoFonteLeis(1)" title="Aumentar tamanho da fonte" style="padding:3px 7px;font-weight:700">A+</button>
            <button class="btn ghost sm" onclick="toggleSumarioLateral()" title="Ocultar ou exibir sumário lateral">📑 Sumário</button>
            <button class="btn ghost sm" onclick="abrirVadeMecumHub()" title="Trocar de lei">🔄 Trocar</button>
            <button class="btn ghost sm" onclick="toggleDrawerFullscreen()" title="Alternar tela cheia">⛶</button>
            ${lei.fonte?`<a href="${lei.fonte}" target="_blank" rel="noopener" class="btn ghost sm" title="Ver texto original oficial">🌐</a>`:''}
          </div>
        </div>

        <!-- Corpo Principal com Sumário Lateral e Texto -->
        <div class="lei-reader-body">
          <!-- Sumário Lateral (Capítulos / Títulos) -->
          <aside class="lei-reader-toc">
            <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
              <span>📑 Sumário</span>
              <button class="btn ghost sm" onclick="toggleSumarioLateral()" style="padding:1px 5px;font-size:10px">◀</button>
            </div>
            <div id="lei-toc-list" style="overflow-y:auto;max-height:calc(100vh - 160px)">
              ${(lei.toc||[]).map(t => {
                const indent = t.level === 3 ? 'padding-left:18px;' : (t.level >= 4 ? 'padding-left:26px;' : 'padding-left:8px;');
                const weight = t.level <= 2 ? 'font-weight:700;color:var(--text);' : 'color:var(--muted);';
                return `
                  <div class="lei-toc-item" style="${indent}${weight}" onclick="rolarParaTexto('${escapeHtml(t.title)}')">
                    ${escapeHtml(t.title)}
                  </div>
                `;
              }).join('')}
            </div>
          </aside>

          <!-- Texto Integral da Lei -->
          <main class="lei-reader-text" id="lei-text-container">
            <div class="empty"><span class="big">⏳</span>Carregando texto oficial...</div>
          </main>
        </div>

        <!-- Barra Flutuante de Seleção / Caderno Multi-Leis -->
        <div id="lei-floating-bar" class="lei-floating-bar"></div>
      </div>
    `;

    carregarConteudoLei(lei, artigoAlvo);
    atualizarBarraFlutuanteSelecao();
  };

  async function carregarConteudoLei(lei, artigoAlvo){
    const container = document.getElementById('lei-text-container');
    if(!container) return;

    if(window.LEIS_STATE.cacheConteudo[lei.id]){
      container.innerHTML = window.LEIS_STATE.cacheConteudo[lei.id];
      sincronizarCheckboxesLeitor(lei.id);
      if(artigoAlvo) setTimeout(()=>pularParaArtigo(artigoAlvo), 100);
      return;
    }

    try {
      let rawText = '';
      const customRaw = localStorage.getItem('aprova_lei_raw_' + lei.id);
      if(customRaw){
        rawText = customRaw;
      } else {
        const res = await fetch(lei.arquivo);
        if(!res.ok) throw new Error('HTTP ' + res.status);
        rawText = await res.text();
      }
      const parsedHtml = parseLegalMarkdown(rawText, lei.id);
      window.LEIS_STATE.cacheConteudo[lei.id] = parsedHtml;
      container.innerHTML = parsedHtml;
      sincronizarCheckboxesLeitor(lei.id);
      if(artigoAlvo) setTimeout(()=>pularParaArtigo(artigoAlvo), 150);
    } catch(e) {
      container.innerHTML = `
        <div class="empty" style="color:var(--red)">
          <span class="big">⚠️</span>
          Não foi possível carregar o arquivo da lei (${escapeHtml(lei.arquivo)}).<br>
          <span class="muted" style="font-size:12px">Verifique se o arquivo está na pasta assets/leis.</span>
        </div>
      `;
    }
  }

  window.fecharLeitorLei = function(){
    const drawer = document.getElementById('lei-reader-drawer');
    if(drawer) drawer.className = '';
    window.LEIS_STATE.leiAtiva = null;
  };

  window.toggleDrawerFullscreen = function(){
    window.LEIS_STATE.drawerFullscreen = !window.LEIS_STATE.drawerFullscreen;
    const drawer = document.getElementById('lei-reader-drawer');
    if(drawer) drawer.classList.toggle('lei-drawer-fullscreen', window.LEIS_STATE.drawerFullscreen);
  };

  window.pularParaArtigo = function(artNum){
    if(!artNum) return;
    const cleanNum = String(artNum).trim().toLowerCase()
      .replace(/^artigo\s*|^art\.?\s*/i, '')
      .replace(/[^0-9a-z\-]/g, '');

    const target = document.getElementById('art-' + cleanNum);
    if(target){
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.remove('lei-art-highlight');
      void target.offsetWidth;
      target.classList.add('lei-art-highlight');
      window.mostrarToastLeis(`📍 Artigo ${artNum}`);
    } else {
      const allArts = document.querySelectorAll('.lei-artigo-card');
      let found = null;
      allArts.forEach(el => {
        if(el.dataset.artigo === artNum || el.id === 'art-' + cleanNum || el.id.includes(cleanNum)){
          if(!found) found = el;
        }
      });
      if(found){
        found.scrollIntoView({ behavior: 'smooth', block: 'start' });
        found.classList.remove('lei-art-highlight');
        void found.offsetWidth;
        found.classList.add('lei-art-highlight');
        window.mostrarToastLeis(`📍 Artigo ${artNum}`);
      } else {
        window.mostrarToastLeis(`⚠️ Artigo ${artNum} não encontrado nesta lei.`);
      }
    }
  };

  window.rolarParaTexto = function(termo){
    const container = document.getElementById('lei-text-container');
    if(!container) return;
    const headers = container.querySelectorAll('h1, h2, h3, h4');
    for(let h of headers){
      if(h.textContent.trim().toLowerCase().includes(termo.toLowerCase())){
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        h.style.background = 'rgba(139,92,246,0.3)';
        setTimeout(()=>{ h.style.background = ''; }, 1500);
        return;
      }
    }
  };

  // Favoritos / Marcadores de artigos
  window.toggleFavoritoArtigo = function(leiId, artNum){
    const favs = window.LEIS_STATE.favoritos[leiId] || [];
    const idx = favs.indexOf(artNum);
    if(idx >= 0){
      favs.splice(idx, 1);
      window.mostrarToastLeis(`⭐ Artigo ${artNum} removido dos favoritos`);
    } else {
      favs.push(artNum);
      window.mostrarToastLeis(`⭐ Artigo ${artNum} marcado para revisão!`);
    }
    window.LEIS_STATE.favoritos[leiId] = favs;
    localStorage.setItem('aprova_leis_favoritos', JSON.stringify(window.LEIS_STATE.favoritos));
    
    const cleanId = 'art-' + String(artNum).toLowerCase().replace(/[^0-9a-z\-]/g, '');
    const card = document.getElementById(cleanId);
    if(card){
      const btn = card.querySelector('.btn-lei-icon');
      if(btn) btn.classList.toggle('active', idx < 0);
    }
  };

  function contarTodosFavoritos(){
    const favs = window.LEIS_STATE.favoritos || {};
    let count = 0;
    Object.values(favs).forEach(arr => count += (arr||[]).length);
    return count;
  }

  // Copiar texto oficial formatado do artigo
  window.copiarArtigoTexto = function(leiId, cleanId, artNum){
    const card = document.getElementById(cleanId);
    if(!card) return;
    const body = card.querySelector('.lei-artigo-body') || card;
    const lei = (window.LEIS_STATE.catalogo || []).find(l=>l.id===leiId);
    const nomeLei = lei ? lei.nome : 'Legislação';
    
    // Obter texto limpo dos parágrafos, incisos e caput
    let textoLimpo = '';
    const caput = body.querySelector('.lei-caput');
    if(caput) textoLimpo += caput.innerText.trim() + '\n\n';
    
    const elements = body.querySelectorAll('.lei-paragrafo, .lei-inciso, .lei-alinea, .lei-item, .lei-pena-box, .lei-p');
    elements.forEach(el => {
      const t = el.innerText.trim();
      if(t) textoLimpo += t + '\n';
    });
    
    if(!textoLimpo.trim()){
      textoLimpo = body.innerText.trim();
    }
    
    const full = `${nomeLei} — Art. ${artNum}:\n\n${textoLimpo.trim()}\n\n(Fonte: Aprova / Vade Mecum Digital)`;
    
    navigator.clipboard.writeText(full).then(()=>{
      window.mostrarToastLeis(`📋 Artigo ${artNum} copiado com sucesso!`);
    }).catch(()=>{
      window.mostrarToastLeis(`📋 Artigo ${artNum} copiado!`);
    });
  };

  // Integração com Trilium Notes por artigo
  window.enviarArtigoTrilium = function(leiId, artNum){
    const lei = (window.LEIS_STATE.catalogo || []).find(l=>l.id===leiId);
    const nomeLei = lei ? lei.nome : 'Legislação';
    const cleanId = 'art-' + String(artNum).toLowerCase().replace(/[^0-9a-z\-]/g, '');
    const card = document.getElementById(cleanId);
    const body = card ? (card.querySelector('.lei-artigo-body') || card) : null;
    const textoArtigo = body ? body.innerText.trim() : '';
    
    const tituloNota = `${nomeLei} — Art. ${artNum}`;
    const conteudoNota = `<p><b>${tituloNota}</b></p><blockquote>${escapeHtml(textoArtigo).replace(/\n/g, '<br>')}</blockquote><p><i>💡 Minhas Anotações de Estudo:</i></p><ul><li></li></ul>`;

    if(typeof window.triliumCreateNote === 'function'){
      window.triliumCreateNote(tituloNota, conteudoNota);
      window.mostrarToastLeis(`📝 Anotação do Art. ${artNum} enviada ao Trilium!`);
    } else if(typeof window.triliumOpenNote === 'function'){
      window.triliumOpenNote(tituloNota);
      window.mostrarToastLeis(`📝 Caderno aberto no Trilium: Art. ${artNum}`);
    } else {
      navigator.clipboard.writeText(`${tituloNota}\n\n${textoArtigo}`);
      window.mostrarToastLeis(`📝 Texto do Art. ${artNum} copiado para anotações!`);
    }
  };

  // Modal de Favoritos
  window.abrirFavoritosModal = function(){
    const favs = window.LEIS_STATE.favoritos || {};
    const cat = window.LEIS_STATE.catalogo || [];
    let itens = [];

    Object.keys(favs).forEach(leiId => {
      const arts = favs[leiId] || [];
      const lei = cat.find(l=>l.id===leiId);
      if(arts.length && lei){
        arts.forEach(art => {
          itens.push({ lei, art });
        });
      }
    });

    const html = itens.length ? itens.map(it => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
        <div>
          <b>${it.lei.icone||'⚖️'} ${escapeHtml(it.lei.nome)}</b>
          <div class="muted" style="font-size:12px">Artigo ${it.art} · ${it.lei.materia}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn sm" onclick="fecharModalFavoritos();abrirLeitorLei('${it.lei.id}', '${it.art}')">📖 Ler</button>
          <button class="btn danger sm" onclick="toggleFavoritoArtigo('${it.lei.id}', '${it.art}');abrirFavoritosModal()">✕</button>
        </div>
      </div>
    `).join('') : '<div class="empty">Nenhum artigo marcado como favorito ainda.<br><span class="muted" style="font-size:12px">Clique no botão ⭐ ao lado de qualquer artigo para salvá-lo aqui.</span></div>';

    let m = document.getElementById('lei-favs-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-favs-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';
    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalFavoritos()"></div>
      <div class="lei-modal-box" style="max-width:550px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <h3 style="margin:0;font-size:16px;font-weight:700">⭐ Artigos Marcados para Revisão</h3>
          <button class="btn ghost sm" onclick="fecharModalFavoritos()" style="font-size:14px;padding:3px 8px">✕</button>
        </div>
        ${itens.length ? `
          <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:8px;padding:8px 12px">
            <span style="font-size:12px;color:var(--text)"><b>${itens.length}</b> artigo(s) nos favoritos</span>
            <button class="btn sm" onclick="adicionarFavoritosASelecao()" style="background:linear-gradient(90deg,#8b5cf6,#2563eb);color:#fff;border:none;font-weight:700;font-size:12px">➕ Adicionar favoritos à seleção</button>
          </div>
        ` : ''}
        <div style="margin-bottom:12px">${html}</div>
      </div>
    `;
  };

  // Correção definitiva do botão X para fechar o modal
  window.fecharModalFavoritos = function(){
    const m = document.getElementById('lei-favs-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  window.abrirSumarioModal = function(leiId){
    const lei = (window.LEIS_STATE.catalogo||[]).find(l=>l.id===leiId);
    if(!lei) return;
    let m = document.getElementById('lei-favs-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-favs-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';
    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalFavoritos()"></div>
      <div class="lei-modal-box" style="max-width:620px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--text)">${lei.icone||'⚖️'} ${escapeHtml(lei.nome)}</h3>
            <span class="muted" style="font-size:12px">Capítulos, Títulos e Seções</span>
          </div>
          <button class="btn ghost sm" onclick="fecharModalFavoritos()" style="font-size:14px;padding:3px 8px" title="Fechar (Esc)">✕</button>
        </div>
        <div style="max-height:60vh;overflow-y:auto;padding-right:4px">
          ${(lei.toc||[]).map(t => `
            <div class="lei-toc-item" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="fecharModalFavoritos();abrirLeitorLei('${lei.id}');setTimeout(()=>rolarParaTexto('${escapeHtml(t.title)}'),300)">
              <b>${escapeHtml(t.title)}</b>
              <span class="btn ghost sm" style="font-size:10px;padding:2px 6px">Ir ➔</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
          <button class="btn ghost sm" onclick="fecharModalFavoritos()">Fechar</button>
        </div>
      </div>
    `;
  };

  // =========================================================================
  // SISTEMA DE SELEÇÃO MULTI-LEIS, BARRA FLUTUANTE, MEUS ARTIGOS, PDF E IA
  // =========================================================================

  window.toggleSelecionarArtigo = function(leiId, artNum, isChecked){
    if(!window.LEIS_STATE.selecao) window.LEIS_STATE.selecao = {};
    if(!Array.isArray(window.LEIS_STATE.selecao[leiId])){
      window.LEIS_STATE.selecao[leiId] = [];
    }
    const arr = window.LEIS_STATE.selecao[leiId];
    const artStr = String(artNum).trim();
    const idx = arr.indexOf(artStr);

    if(isChecked){
      if(idx === -1) arr.push(artStr);
    } else {
      if(idx >= 0) arr.splice(idx, 1);
    }

    if(arr.length === 0){
      delete window.LEIS_STATE.selecao[leiId];
    }

    salvarSelecao();

    const cleanId = 'art-' + artStr.toLowerCase().replace(/[^0-9a-z\-]/g, '');
    const card = document.getElementById(cleanId);
    if(card){
      card.classList.toggle('lei-art-selecionado', isChecked);
      const chk = card.querySelector('.lei-art-chk');
      if(chk && chk.checked !== isChecked) chk.checked = isChecked;
    }

    const pill = document.querySelector(`.lei-art-pill[data-art="${artStr}"]`);
    if(pill){
      pill.classList.toggle('selected', isChecked);
    }

    const modalCount = document.getElementById('modal-sel-lei-count');
    if(modalCount){
      const curr = (window.LEIS_STATE.selecao[leiId] || []).length;
      modalCount.innerText = curr;
    }

    window.mostrarToastLeis(isChecked ? `☑️ Art. ${artStr} selecionado` : `Art. ${artStr} desmarcado`);
  };

  window.removerArtigoSelecao = function(leiId, artNum){
    if(!window.LEIS_STATE.selecao || !Array.isArray(window.LEIS_STATE.selecao[leiId])) return;
    const arr = window.LEIS_STATE.selecao[leiId];
    const artStr = String(artNum).trim();
    const idx = arr.indexOf(artStr);
    if(idx >= 0) arr.splice(idx, 1);
    if(arr.length === 0) delete window.LEIS_STATE.selecao[leiId];
    salvarSelecao();

    if(window.LEIS_STATE.leiAtiva && window.LEIS_STATE.leiAtiva.id === leiId){
      const cleanId = 'art-' + artStr.toLowerCase().replace(/[^0-9a-z\-]/g, '');
      const card = document.getElementById(cleanId);
      if(card){
        card.classList.remove('lei-art-selecionado');
        const chk = card.querySelector('.lei-art-chk');
        if(chk) chk.checked = false;
      }
    }

    abrirModalMeusArtigos();
    window.mostrarToastLeis(`Art. ${artStr} removido da seleção`);
  };

  window.removerLeiDaSelecao = function(leiId){
    if(!window.LEIS_STATE.selecao) return;
    delete window.LEIS_STATE.selecao[leiId];
    salvarSelecao();
    if(window.LEIS_STATE.leiAtiva && window.LEIS_STATE.leiAtiva.id === leiId){
      sincronizarCheckboxesLeitor(leiId);
    }
    abrirModalMeusArtigos();
    window.mostrarToastLeis(`Todos os artigos desta lei foram desmarcados.`);
  };

  window.limparTodaSelecaoComConfirm = function(){
    const tot = contarTotalSelecionados();
    if(tot === 0) return;
    if(confirm(`Deseja limpar todos os ${tot} artigos selecionados do seu caderno?`)){
      window.LEIS_STATE.selecao = {};
      salvarSelecao();
      if(window.LEIS_STATE.leiAtiva){
        sincronizarCheckboxesLeitor(window.LEIS_STATE.leiAtiva.id);
      }
      fecharModalMeusArtigos();
      window.mostrarToastLeis(`🗑️ Seleção limpa com sucesso.`);
    }
  };

  window.atualizarBarraFlutuanteSelecao = function(){
    const bar = document.getElementById('lei-floating-bar');
    const total = contarTotalSelecionados();
    atualizarBadgeSelecaoGlobal();

    if(!bar) return;

    if(total === 0){
      bar.classList.remove('visible');
      bar.innerHTML = '';
      return;
    }

    const sel = window.LEIS_STATE.selecao || {};
    const leisComSel = Object.keys(sel).filter(id => (sel[id] || []).length > 0);
    const numLeis = leisComSel.length;
    const paginasEst = Math.max(1, Math.ceil(total * 0.35) + 1);

    bar.classList.add('visible');
    bar.innerHTML = `
      <div class="lei-fb-left" onclick="abrirModalMeusArtigos()" title="Clique para revisar os artigos selecionados">
        <span class="lei-fb-badge">${total}</span>
        <div class="lei-fb-text">
          <b>${total} ${total === 1 ? 'artigo selecionado' : 'artigos selecionados'}</b>
          <span class="lei-fb-sub">${numLeis} ${numLeis === 1 ? 'lei' : 'leis'} · ~${paginasEst} págs PDF</span>
        </div>
      </div>
      <div class="lei-fb-actions">
        <button class="lei-fb-btn" onclick="abrirModalMeusArtigos()" title="Revisar e gerenciar artigos selecionados">👁️ Ver seleção</button>
        <button class="lei-fb-btn-primary" onclick="abrirModalOpcoesPDF()" title="Configurar e Gerar PDF Didático">📄 Gerar PDF</button>
        <button class="lei-fb-btn-ai" onclick="abrirModalOpcoesIA()" title="Gerar Resumo, Mnemônicos ou Questões com IA">✨ Resumo IA</button>
        <button class="lei-fb-btn lei-fb-btn-danger" onclick="limparTodaSelecaoComConfirm()" title="Limpar toda a seleção">🗑️</button>
      </div>
    `;
  };

  // Modal de Seleção de Artigos em Lote (Dentro de uma Lei)
  window.abrirModalSelecionarArtigosLei = function(leiId){
    const lei = (window.LEIS_STATE.catalogo || []).find(l => l.id === leiId);
    if(!lei) return;

    const todosArtigos = obterTodosArtigosDaLei(lei);
    const selArr = (window.LEIS_STATE.selecao && window.LEIS_STATE.selecao[leiId]) || [];

    let m = document.getElementById('lei-selecionar-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-selecionar-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';
    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalSelecionarArtigos()"></div>
      <div class="lei-modal-box" style="max-width:680px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px">
              ☑️ Selecionar Artigos — ${lei.icone||'⚖️'} ${escapeHtml(lei.nome)}
            </h3>
            <span class="muted" style="font-size:12px">${escapeHtml(lei.numero)} · ${lei.total_artigos} artigos totais · <b style="color:var(--accent)" id="modal-sel-lei-count">${selArr.length}</b> selecionado(s)</span>
          </div>
          <button class="btn ghost sm" onclick="fecharModalSelecionarArtigos()" style="font-size:14px;padding:3px 8px" title="Fechar (Esc)">✕</button>
        </div>

        <!-- Seletor de Faixa e Ações Rápidas -->
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:700;color:var(--muted)">Faixa:</span>
            <span style="font-size:12px">Do Art.</span>
            <input type="number" id="lei-range-from" min="1" placeholder="1" style="width:60px;padding:4px 6px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text)">
            <span style="font-size:12px">ao</span>
            <input type="number" id="lei-range-to" min="1" placeholder="30" style="width:60px;padding:4px 6px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text)">
            <button class="btn sm" onclick="marcarFaixaArtigosLei('${leiId}')" style="font-size:11.5px;padding:4px 10px;font-weight:700">Marcar Faixa</button>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn ghost sm" onclick="marcarTodosArtigosLei('${leiId}')" style="font-size:11.5px;padding:4px 8px">☑️ Todos (${todosArtigos.length})</button>
            <button class="btn ghost sm" onclick="desmarcarTodosArtigosLei('${leiId}')" style="font-size:11.5px;padding:4px 8px">✕ Limpar</button>
          </div>
        </div>

        <!-- Filtro Rápido por Número -->
        <div style="margin-bottom:10px;position:relative">
          <input type="text" id="lei-modal-pill-filter" placeholder="Buscar número do artigo nesta lei (ex: 5, 121, 144)..." oninput="filtrarPillsModal(this.value)" style="width:100%;padding:7px 12px 7px 30px;font-size:13px;border-radius:8px;border:1px solid var(--border);background:var(--card2);color:var(--text)">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:12px">🔍</span>
        </div>

        <!-- Grade de Pílulas de Artigos -->
        <div id="lei-pills-grid" style="display:flex;flex-wrap:wrap;gap:6px;max-height:46vh;overflow-y:auto;padding:10px;background:var(--card);border:1px solid var(--border);border-radius:10px">
          ${todosArtigos.map(art => {
            const isSel = selArr.includes(String(art).trim());
            return `<div class="lei-art-pill ${isSel ? 'selected' : ''}" data-art="${art}" onclick="togglePillModal('${leiId}', '${art}')">Art. ${art}</div>`;
          }).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
          <span class="muted" style="font-size:12px">Clique em qualquer artigo para alternar a seleção.</span>
          <button class="btn sm" onclick="fecharModalSelecionarArtigos()" style="background:#2563eb;color:#fff;font-weight:700">Concluído</button>
        </div>
      </div>
    `;
  };

  window.fecharModalSelecionarArtigos = function(){
    const m = document.getElementById('lei-selecionar-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  window.togglePillModal = function(leiId, artNum){
    const arr = (window.LEIS_STATE.selecao && window.LEIS_STATE.selecao[leiId]) || [];
    const artStr = String(artNum).trim();
    const isCurrentlySel = arr.includes(artStr);
    window.toggleSelecionarArtigo(leiId, artStr, !isCurrentlySel);
  };

  window.marcarTodosArtigosLei = function(leiId){
    const lei = (window.LEIS_STATE.catalogo || []).find(l => l.id === leiId);
    if(!lei) return;
    const todos = obterTodosArtigosDaLei(lei);
    if(!window.LEIS_STATE.selecao) window.LEIS_STATE.selecao = {};
    window.LEIS_STATE.selecao[leiId] = todos.map(a => String(a).trim());
    salvarSelecao();
    sincronizarCheckboxesLeitor(leiId);
    
    document.querySelectorAll('#lei-pills-grid .lei-art-pill').forEach(p => p.classList.add('selected'));
    const modalCount = document.getElementById('modal-sel-lei-count');
    if(modalCount) modalCount.innerText = todos.length;

    window.mostrarToastLeis(`☑️ Todos os ${todos.length} artigos marcados!`);
  };

  window.desmarcarTodosArtigosLei = function(leiId){
    if(!window.LEIS_STATE.selecao) return;
    delete window.LEIS_STATE.selecao[leiId];
    salvarSelecao();
    sincronizarCheckboxesLeitor(leiId);

    document.querySelectorAll('#lei-pills-grid .lei-art-pill').forEach(p => p.classList.remove('selected'));
    const modalCount = document.getElementById('modal-sel-lei-count');
    if(modalCount) modalCount.innerText = 0;

    window.mostrarToastLeis(`✕ Artigos desta lei desmarcados.`);
  };

  window.marcarFaixaArtigosLei = function(leiId){
    const fromInp = document.getElementById('lei-range-from');
    const toInp = document.getElementById('lei-range-to');
    if(!fromInp || !toInp) return;
    const de = parseInt(fromInp.value, 10);
    const ate = parseInt(toInp.value, 10);
    if(isNaN(de) || isNaN(ate) || de > ate){
      window.mostrarToastLeis('⚠️ Informe uma faixa válida (ex: do 1 ao 30).');
      return;
    }
    const lei = (window.LEIS_STATE.catalogo || []).find(l => l.id === leiId);
    if(!lei) return;
    const todos = obterTodosArtigosDaLei(lei);
    if(!window.LEIS_STATE.selecao) window.LEIS_STATE.selecao = {};
    if(!Array.isArray(window.LEIS_STATE.selecao[leiId])) window.LEIS_STATE.selecao[leiId] = [];
    const arr = window.LEIS_STATE.selecao[leiId];

    let countAdded = 0;
    todos.forEach(art => {
      const numOnly = parseInt(String(art).replace(/[^0-9]/g, ''), 10);
      if(!isNaN(numOnly) && numOnly >= de && numOnly <= ate){
        const artStr = String(art).trim();
        if(!arr.includes(artStr)){
          arr.push(artStr);
          countAdded++;
        }
      }
    });

    salvarSelecao();
    sincronizarCheckboxesLeitor(leiId);

    document.querySelectorAll('#lei-pills-grid .lei-art-pill').forEach(p => {
      const art = p.dataset.art;
      if(arr.includes(art)) p.classList.add('selected');
    });

    const modalCount = document.getElementById('modal-sel-lei-count');
    if(modalCount) modalCount.innerText = arr.length;

    window.mostrarToastLeis(`☑️ ${countAdded} artigos da faixa ${de} a ${ate} marcados!`);
  };

  window.filtrarPillsModal = function(termo){
    const q = (termo || '').toLowerCase().trim();
    const pills = document.querySelectorAll('#lei-pills-grid .lei-art-pill');
    pills.forEach(p => {
      const txt = p.innerText.toLowerCase();
      p.style.display = (!q || txt.includes(q)) ? 'inline-flex' : 'none';
    });
  };

  window.adicionarFavoritosASelecao = function(){
    const favs = window.LEIS_STATE.favoritos || {};
    let adicionados = 0;
    if(!window.LEIS_STATE.selecao) window.LEIS_STATE.selecao = {};
    
    Object.keys(favs).forEach(leiId => {
      const arts = favs[leiId] || [];
      if(!Array.isArray(window.LEIS_STATE.selecao[leiId])){
        window.LEIS_STATE.selecao[leiId] = [];
      }
      arts.forEach(art => {
        const artStr = String(art).trim();
        if(!window.LEIS_STATE.selecao[leiId].includes(artStr)){
          window.LEIS_STATE.selecao[leiId].push(artStr);
          adicionados++;
        }
      });
    });

    salvarSelecao();
    
    if(window.LEIS_STATE.leiAtiva){
      sincronizarCheckboxesLeitor(window.LEIS_STATE.leiAtiva.id);
    }

    fecharModalFavoritos();
    window.mostrarToastLeis(`✨ ${adicionados} artigo(s) favorito(s) adicionado(s) à seleção!`);
  };

  // Modal "Meus Artigos" (Revisão da Seleção Multi-Leis)
  window.abrirModalMeusArtigos = function(){
    const sel = window.LEIS_STATE.selecao || {};
    const cat = window.LEIS_STATE.catalogo || [];
    const leisComSel = Object.keys(sel).filter(id => (sel[id] || []).length > 0);
    const totalArtigos = contarTotalSelecionados();
    const numLeis = leisComSel.length;
    const paginasEst = Math.max(1, Math.ceil(totalArtigos * 0.35) + 1);
    const totalCharsEst = totalArtigos * 650;
    const chamadasIaEst = totalArtigos <= 30 ? 1 : Math.ceil(totalArtigos / 25);

    let m = document.getElementById('lei-meus-artigos-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-meus-artigos-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';

    const isLarge = (totalArtigos > 60 || totalCharsEst > 120000);

    const blocosHtml = leisComSel.map(leiId => {
      const lei = cat.find(l => l.id === leiId) || { nome: leiId, icone: '⚖️' };
      const arts = sel[leiId] || [];
      return `
        <div class="meus-art-law-block" id="meus-art-law-${leiId}">
          <div class="meus-art-law-header">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:20px">${lei.icone||'⚖️'}</span>
              <div>
                <b style="color:var(--text);font-size:14px">${escapeHtml(lei.nome)}</b>
                <span class="muted" style="font-size:11px;margin-left:6px">${arts.length} artigo(s)</span>
              </div>
            </div>
            <button class="btn danger sm" onclick="removerLeiDaSelecao('${leiId}')" style="font-size:11px;padding:2px 8px">Desmarcar Lei</button>
          </div>
          <div class="meus-art-chips">
            ${arts.map(art => `
              <span class="meus-art-chip">
                Art. ${art}
                <button onclick="removerArtigoSelecao('${leiId}', '${art}')" title="Remover Art. ${art}">✕</button>
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalMeusArtigos()"></div>
      <div class="lei-modal-box" style="max-width:680px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px">
              📦 Caderno de Artigos Selecionados
            </h3>
            <span class="muted" style="font-size:12px">Gerencie sua seleção multi-leis para impressão de PDF didático ou análise por IA</span>
          </div>
          <button class="btn ghost sm" onclick="fecharModalMeusArtigos()" style="font-size:14px;padding:3px 8px" title="Fechar (Esc)">✕</button>
        </div>

        ${totalArtigos === 0 ? `
          <div class="empty" style="padding:30px 10px">
            <span class="big">📭</span>
            Nenhum artigo selecionado ainda.<br>
            <span class="muted" style="font-size:12px">Abra qualquer lei e marque as caixas de seleção ☑️ para montar seu caderno de estudos.</span>
          </div>
        ` : `
          <!-- Estatísticas da Seleção -->
          <div class="meus-art-stats">
            <div class="meus-art-stat-box">
              <span class="meus-art-stat-val">${totalArtigos}</span>
              <span class="meus-art-stat-lbl">Artigos Selecionados</span>
            </div>
            <div class="meus-art-stat-box">
              <span class="meus-art-stat-val">${numLeis}</span>
              <span class="meus-art-stat-lbl">Leis Abrangidas</span>
            </div>
            <div class="meus-art-stat-box">
              <span class="meus-art-stat-val">~${paginasEst}</span>
              <span class="meus-art-stat-lbl">Páginas no PDF</span>
            </div>
            <div class="meus-art-stat-box">
              <span class="meus-art-stat-val">${chamadasIaEst}</span>
              <span class="meus-art-stat-lbl">Bloco(s) IA</span>
            </div>
          </div>

          ${isLarge ? `
            <div class="meus-art-warning">
              ⚠️ <b>Seleção extensa (${totalArtigos} artigos):</b> Para gerar o resumo com IA, o conteúdo será enviado em blocos inteligentes para não ultrapassar a janela de contexto. O PDF poderá ter cerca de ${paginasEst} páginas.
            </div>
          ` : ''}

          <!-- Artigos Agrupados por Legislação -->
          <div style="max-height:48vh;overflow-y:auto;padding-right:4px;margin-bottom:14px">
            ${blocosHtml}
          </div>

          <!-- Ações do Rodapé -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px solid var(--border);padding-top:12px">
            <button class="btn danger sm" onclick="limparTodaSelecaoComConfirm()" style="font-size:12px">🗑️ Limpar Tudo</button>
            <div style="display:flex;gap:8px">
              <button class="btn sm" onclick="abrirModalOpcoesPDF()" style="background:linear-gradient(90deg,#2563eb,#1d4ed8);color:#fff;font-weight:700">📄 Gerar PDF Didático</button>
              <button class="btn sm" onclick="abrirModalOpcoesIA()" style="background:linear-gradient(90deg,#8b5cf6,#d946ef);color:#fff;font-weight:700">✨ Resumo com IA</button>
            </div>
          </div>
        `}
      </div>
    `;
  };

  window.fecharModalMeusArtigos = function(){
    const m = document.getElementById('lei-meus-artigos-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  // Parser de mapa de artigos a partir do markdown bruto
  function parseArticlesMapFromMarkdown(rawText){
    const lines = (rawText || '').split('\n');
    const result = {};
    let curArt = null;
    let curLines = [];
    let pendingRubrica = '';

    for(let i=0; i<lines.length; i++){
      let l = lines[i].trim();
      if(!l || l.includes('lei-anchor')) continue;
      if(l.startsWith('#')){
        if(curArt){
          result[curArt] = { lines: curLines, rubrica: pendingRubrica };
          curArt = null;
          curLines = [];
          pendingRubrica = '';
        }
        continue;
      }
      const m = l.match(/^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*\s*(?:[-–—.]\s*)?(.*)$/i);
      if(m){
        if(curArt){
          result[curArt] = { lines: curLines, rubrica: pendingRubrica };
        }
        curArt = m[1].trim();
        curLines = [l];
        pendingRubrica = '';
        continue;
      }
      if(curArt){
        curLines.push(l);
      } else {
        if(l.length < 100 && !l.startsWith('(') && !l.startsWith('>')){
          pendingRubrica = l.replace(/\*/g, '').trim();
        }
      }
    }
    if(curArt){
      result[curArt] = { lines: curLines, rubrica: pendingRubrica };
    }
    return result;
  }

  async function extrairArtigosDaLeiAsync(leiId){
    if(window.LEIS_STATE.cacheArtigosTexto[leiId]) return window.LEIS_STATE.cacheArtigosTexto[leiId];
    const cat = window.LEIS_STATE.catalogo || [];
    const lei = cat.find(l => l.id === leiId);
    if(!lei) return {};

    let raw = '';
    const custom = localStorage.getItem('aprova_lei_raw_' + leiId);
    if(custom){
      raw = custom;
    } else {
      try {
        const res = await fetch(lei.arquivo);
        if(res.ok) raw = await res.text();
      } catch(e){}
    }
    const map = parseArticlesMapFromMarkdown(raw);
    window.LEIS_STATE.cacheArtigosTexto[leiId] = map;
    return map;
  }

  // =========================================================================
  // GERADOR DE PDF DIDÁTICO
  // =========================================================================

  window.abrirModalOpcoesPDF = function(){
    const totalArtigos = contarTotalSelecionados();
    if(totalArtigos === 0){
      window.mostrarToastLeis('⚠️ Selecione ao menos um artigo para gerar o PDF.');
      return;
    }

    let m = document.getElementById('lei-pdf-opcoes-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-pdf-opcoes-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';

    const c = (typeof cur === 'function') ? cur() : null;
    const nomeConc = c && c.name ? c.name : 'Concurso Público';

    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalOpcoesPDF()"></div>
      <div class="lei-modal-box" style="max-width:580px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px">
              📄 Configurar Caderno Didático em PDF
            </h3>
            <span class="muted" style="font-size:12px">Material com ${totalArtigos} artigos selecionados para <b>${escapeHtml(nomeConc)}</b></span>
          </div>
          <button class="btn ghost sm" onclick="fecharModalOpcoesPDF()" style="font-size:14px;padding:3px 8px" title="Fechar (Esc)">✕</button>
        </div>

        <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text)">
            <input type="checkbox" id="pdf-opt-capa" checked style="width:16px;height:16px;cursor:pointer">
            <span><b>Incluir Capa Didática</b> (Concurso, Data e relação de leis)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text)">
            <input type="checkbox" id="pdf-opt-checklist" checked style="width:16px;height:16px;cursor:pointer">
            <span><b>Incluir Checklist de Revisão</b> (Caixas R1, R2, R3, R4 em cada artigo)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text)">
            <input type="checkbox" id="pdf-opt-destaque" checked style="width:16px;height:16px;cursor:pointer">
            <span><b>Destacar Palavras-chave</b> (Prazos, vedações e exceções em destaque)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text)">
            <input type="checkbox" id="pdf-opt-espaco-notas" checked style="width:16px;height:16px;cursor:pointer">
            <span><b>Incluir Espaço para Anotações</b> (Linhas pautadas para anotações do estudante)</span>
          </label>
        </div>

        <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:8px;color:var(--text)">Formato e Diagramação:</div>
          <div style="display:flex;gap:16px">
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;color:var(--text)">
              <input type="radio" name="pdf-layout-cols" value="2" checked style="cursor:pointer">
              <span><b>2 Colunas</b> (Econômico / Otimizado para impressão)</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;color:var(--text)">
              <input type="radio" name="pdf-layout-cols" value="1" style="cursor:pointer">
              <span><b>1 Coluna</b> (Leitura digital em tablet / tela)</span>
            </label>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--border);padding-top:12px">
          <button class="btn ghost sm" onclick="fecharModalOpcoesPDF()">Cancelar</button>
          <button class="btn sm" onclick="executarGeracaoPDFDidatico()" style="background:linear-gradient(90deg,#2563eb,#1d4ed8);color:#fff;font-weight:700">🖨️ Gerar PDF / Imprimir</button>
        </div>
      </div>
    `;
  };

  window.fecharModalOpcoesPDF = function(){
    const m = document.getElementById('lei-pdf-opcoes-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  window.executarGeracaoPDFDidatico = async function(){
    const sel = window.LEIS_STATE.selecao || {};
    const cat = window.LEIS_STATE.catalogo || [];
    const leisComSel = Object.keys(sel).filter(id => (sel[id] || []).length > 0);
    if(!leisComSel.length){
      window.mostrarToastLeis('⚠️ Nenhum artigo selecionado.');
      return;
    }

    const incCapa = document.getElementById('pdf-opt-capa') ? document.getElementById('pdf-opt-capa').checked : true;
    const incChecklist = document.getElementById('pdf-opt-checklist') ? document.getElementById('pdf-opt-checklist').checked : true;
    const incDestaque = document.getElementById('pdf-opt-destaque') ? document.getElementById('pdf-opt-destaque').checked : true;
    const incEspacoNotas = document.getElementById('pdf-opt-espaco-notas') ? document.getElementById('pdf-opt-espaco-notas').checked : true;
    const colSelected = document.querySelector('input[name="pdf-layout-cols"]:checked');
    const cols = colSelected ? colSelected.value : '2';

    window.mostrarToastLeis('⏳ Preparando material didático...');

    const c = (typeof cur === 'function') ? cur() : null;
    const nomeConc = c && c.name ? c.name : 'Concurso Público';
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const totalArtigos = contarTotalSelecionados();

    let artigosHtml = '';

    for(const leiId of leisComSel){
      const lei = cat.find(l => l.id === leiId) || { nome: leiId, numero: '' };
      const arts = sel[leiId] || [];
      const artMap = await extrairArtigosDaLeiAsync(leiId);

      artigosHtml += `
        <div class="pdf-law-section">
          <div class="pdf-law-header">
            <span class="pdf-law-badge">${escapeHtml(lei.nome)}</span>
            <span class="pdf-law-meta">${escapeHtml(lei.numero)} · ${arts.length} artigo(s) selecionado(s)</span>
          </div>
      `;

      arts.forEach(artNum => {
        const item = artMap[artNum] || { lines: [`**Art. ${artNum}** Texto não indexado.`], rubrica: '' };
        const lines = item.lines || [];
        const rawContent = lines.join('\n');
        let parsed = parseLegalMarkdown(rawContent, leiId);

        if(!incDestaque){
          parsed = parsed.replace(/<mark class="lei-mark[^"]*">/gi, '').replace(/<\/mark>/gi, '');
        }

        artigosHtml += `
          <div class="pdf-art-card">
            <div class="pdf-art-header">
              <span class="pdf-art-title">Art. ${artNum}</span>
              ${incChecklist ? `
                <div class="pdf-checklist">
                  <span class="pdf-chk-box"><span></span> R1</span>
                  <span class="pdf-chk-box"><span></span> R2</span>
                  <span class="pdf-chk-box"><span></span> R3</span>
                  <span class="pdf-chk-box"><span></span> R4</span>
                </div>
              ` : ''}
            </div>
            <div class="pdf-art-body">
              ${parsed}
            </div>
            ${incEspacoNotas ? `
              <div class="pdf-notas-box">
                <div class="pdf-notas-label">Anotações do Estudante:</div>
                <div class="pdf-nota-line"></div>
                <div class="pdf-nota-line"></div>
                <div class="pdf-nota-line"></div>
              </div>
            ` : ''}
          </div>
        `;
      });

      artigosHtml += `</div>`;
    }

    const relacaoLeisText = leisComSel.map(id => {
      const l = cat.find(x => x.id === id);
      return l ? `${l.nome} (${(sel[id]||[]).length} arts.)` : id;
    }).join(' • ');

    const htmlDocument = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Caderno Didático de Legislação — ${escapeHtml(nomeConc)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 10pt;
      margin: 0;
      padding: 0;
    }
    .pdf-capa {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 85vh;
      text-align: center;
      padding: 40px 20px;
    }
    .pdf-capa-logo {
      font-size: 42px;
      margin-bottom: 8px;
    }
    .pdf-capa-title {
      font-size: 26pt;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.5px;
      margin: 0 0 10px 0;
    }
    .pdf-capa-sub {
      font-size: 14pt;
      color: #475569;
      margin: 0 0 35px 0;
    }
    .pdf-capa-box {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 22px 28px;
      max-width: 580px;
      text-align: left;
      margin-bottom: 30px;
    }
    .pdf-capa-item {
      margin-bottom: 8px;
      font-size: 11pt;
    }
    .pdf-capa-item b {
      color: #0f172a;
    }
    .pdf-content-container {
      column-count: ${cols};
      column-gap: 20px;
      column-rule: 1px solid #e2e8f0;
    }
    .pdf-law-section {
      break-inside: avoid;
      margin-bottom: 16px;
    }
    .pdf-law-header {
      background: #1e293b;
      color: #ffffff;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      break-after: avoid;
    }
    .pdf-law-badge {
      font-size: 11pt;
      font-weight: 800;
    }
    .pdf-law-meta {
      font-size: 8.5pt;
      opacity: 0.85;
    }
    .pdf-art-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 10px;
      background: #ffffff;
    }
    .pdf-art-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .pdf-art-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1e3a8a;
    }
    .pdf-checklist {
      display: flex;
      gap: 6px;
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
    }
    .pdf-chk-box {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .pdf-chk-box span {
      width: 10px;
      height: 10px;
      border: 1.2px solid #475569;
      border-radius: 2px;
      display: inline-block;
    }
    .pdf-art-body {
      font-size: 9.5pt;
      line-height: 1.4;
      color: #1e293b;
    }
    .pdf-art-body .lei-artigo-header,
    .pdf-art-body .lei-artigo-actions,
    .pdf-art-body .lei-art-chk-wrap {
      display: none !important;
    }
    .pdf-art-body .lei-caput-art {
      font-weight: 800;
      color: #1e3a8a;
      margin-right: 4px;
    }
    .pdf-art-body .lei-paragrafo-label {
      font-weight: 700;
      color: #0369a1;
      margin-right: 4px;
    }
    .pdf-art-body .lei-inciso-num {
      font-weight: 700;
      color: #7c3aed;
      margin-right: 4px;
    }
    .pdf-art-body .lei-pena-box {
      background: #fef2f2;
      border-left: 3px solid #ef4444;
      padding: 4px 6px;
      margin: 4px 0;
      font-size: 8.5pt;
    }
    .pdf-art-body .lei-pena-badge {
      font-weight: 800;
      color: #b91c1c;
      margin-right: 4px;
    }
    .pdf-art-body .lei-mark.mark-red { background: #fee2e2; color: #991b1b; padding: 0 2px; border-radius: 2px; }
    .pdf-art-body .lei-mark.mark-amber { background: #fef3c7; color: #92400e; padding: 0 2px; border-radius: 2px; }
    .pdf-art-body .lei-mark.mark-purple { background: #f3e8ff; color: #6b21a8; padding: 0 2px; border-radius: 2px; }
    .pdf-art-body .lei-mark.mark-blue { background: #e0f2fe; color: #075985; padding: 0 2px; border-radius: 2px; }
    .pdf-art-body .lei-mark.mark-cyan { background: #cffafe; color: #155e75; padding: 0 2px; border-radius: 2px; }
    .pdf-notas-box {
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px dashed #cbd5e1;
    }
    .pdf-notas-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .pdf-nota-line {
      border-bottom: 1px dotted #94a3b8;
      height: 14px;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  ${incCapa ? `
    <div class="pdf-capa">
      <div class="pdf-capa-logo">⚖️</div>
      <h1 class="pdf-capa-title">VADE MECUM DIDÁTICO</h1>
      <p class="pdf-capa-sub">Caderno de Legislação e Dispositivos Selecionados</p>
      <div class="pdf-capa-box">
        <div class="pdf-capa-item"><b>Concurso / Foco:</b> ${escapeHtml(nomeConc)}</div>
        <div class="pdf-capa-item"><b>Data de Emissão:</b> ${dataAtual}</div>
        <div class="pdf-capa-item"><b>Total de Artigos:</b> ${totalArtigos} artigos</div>
        <div class="pdf-capa-item"><b>Leis Incluídas:</b> ${escapeHtml(relacaoLeisText)}</div>
        <div class="pdf-capa-item"><b>Plataforma:</b> Aprova — Inteligência para Concursos</div>
      </div>
      <div style="font-size:9pt;color:#64748b">Utilize o checklist de revisão (R1 a R4) para acompanhar seus ciclos de repetição espaçada.</div>
    </div>
  ` : ''}

  <div class="pdf-content-container">
    ${artigosHtml}
  </div>
</body>
</html>`;

    fecharModalOpcoesPDF();

    const win = window.open('', '_blank');
    if(win){
      win.document.write(htmlDocument);
      win.document.close();
      win.focus();
      setTimeout(()=>{
        try { win.print(); } catch(e){}
      }, 500);
    } else {
      window.mostrarToastLeis('⚠️ Permita pop-ups no navegador para abrir o PDF.');
    }
  };

  // =========================================================================
  // GERADOR DE RESUMO INTELIGENTE COM IA
  // =========================================================================

  window.abrirModalOpcoesIA = function(){
    const totalArtigos = contarTotalSelecionados();
    if(totalArtigos === 0){
      window.mostrarToastLeis('⚠️ Selecione ao menos um artigo para gerar o resumo.');
      return;
    }

    let m = document.getElementById('lei-ia-opcoes-modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'lei-ia-opcoes-modal';
      document.body.appendChild(m);
    }
    m.style.display = 'block';
    m.className = 'lei-modal-open';

    const perfil = window.LEIS_STATE.perfilIaAtivo || 'esquematizado';
    const numBlocos = totalArtigos <= 25 ? 1 : Math.ceil(totalArtigos / 25);
    const apiKey = (window.LEIS_STATE.aiApiKey || '').trim();
    const provider = window.LEIS_STATE.aiProvider || 'gemini';
    const providerNome = provider === 'gemini' ? 'Google Gemini' : (provider === 'groq' ? 'Groq (Llama 3.3)' : 'OpenAI (ChatGPT)');

    m.innerHTML = `
      <div class="lei-drawer-backdrop" onclick="fecharModalOpcoesIA()"></div>
      <div class="lei-modal-box" style="max-width:760px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px">
              ✨ Resumo & Análise com Inteligência Artificial
            </h3>
            <span class="muted" style="font-size:12px">Transforme ${totalArtigos} artigos selecionados em sínteses, mnemônicos, questões ou tabelas</span>
          </div>
          <button class="btn ghost sm" onclick="fecharModalOpcoesIA()" style="font-size:14px;padding:3px 8px" title="Fechar (Esc)">✕</button>
        </div>

        <!-- Banner de Conexão com a IA -->
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">${apiKey ? '🟢' : '⚡'}</span>
            <div>
              <b style="font-size:12.5px;color:var(--text)">Motor de IA:</b>
              <span class="muted" style="font-size:12px">
                ${apiKey ? `<span style="color:var(--green);font-weight:700">${providerNome} Conectado</span> (Respostas reais via API ao vivo)` : 'Síntese Estruturada Aprova (Offline / Local)'}
              </span>
            </div>
          </div>
          <button class="btn ghost sm" onclick="toggleConfiguracaoIA()" style="font-size:11.5px;padding:3px 8px;border-color:var(--accent);color:var(--text);font-weight:700">
            ⚙️ ${apiKey ? 'Trocar / Gerenciar IA' : 'Conectar API de IA'}
          </button>
        </div>

        <!-- Gaveta Colapsável de Configuração de Chave de API -->
        <div id="lei-ia-config-drawer" style="display:none;background:var(--card);border:1.5px solid var(--accent);border-radius:10px;padding:12px 14px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,0.3)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <b style="font-size:13px;color:var(--text)">Configurar Provedor de IA em Tempo Real</b>
            <button class="btn ghost sm" onclick="toggleConfiguracaoIA()" style="font-size:11px;padding:1px 6px">✕</button>
          </div>
          <div class="muted" style="font-size:11.5px;margin-bottom:10px">Sua chave é armazenada com total privacidade no seu próprio navegador (localStorage).</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:8px;margin-bottom:10px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--text)">
              <input type="radio" name="ai-provider" value="gemini" ${provider==='gemini'?'checked':''} onchange="salvarProvedorIA('gemini')">
              <span><b>Google Gemini</b> (Grátis / Rápido)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--text)">
              <input type="radio" name="ai-provider" value="groq" ${provider==='groq'?'checked':''} onchange="salvarProvedorIA('groq')">
              <span><b>Groq</b> (Llama 3.3 70B / Grátis)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--text)">
              <input type="radio" name="ai-provider" value="openai" ${provider==='openai'?'checked':''} onchange="salvarProvedorIA('openai')">
              <span><b>OpenAI</b> (ChatGPT / GPT-4o-mini)</span>
            </label>
          </div>
          <div style="display:flex;gap:6px">
            <input type="password" id="lei-ia-api-key-inp" placeholder="Cole sua Chave de API aqui (ex: AIzaSy... ou gsk_... ou sk-...)" value="${apiKey||''}" style="flex:1;padding:6px 10px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--card2);color:var(--text)">
            <button class="btn sm" onclick="salvarChaveIA()" style="background:#2563eb;color:#fff;font-weight:700">Salvar Chave</button>
            ${apiKey ? `<button class="btn danger sm" onclick="removerChaveIA()">Remover</button>` : ''}
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--muted)">
            Obtenha sua chave gratuitamente em: 
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">Google AI Studio (Gemini)</a> • 
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">Groq Console</a> • 
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">OpenAI</a>
          </div>
        </div>

        <!-- Seletor de Perfil Didático -->
        <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px">Escolha o Perfil Didático:</div>
        <div class="lei-ia-profiles-grid">
          <div class="lei-ia-profile-card ${perfil==='esquematizado'?'active':''}" onclick="selecionarPerfilIA('esquematizado')">
            <span class="p-title">🧠 Esquematizado</span>
            <span class="p-desc">Tópicos diretos, síntese de conceitos e mnemônicos de memorização.</span>
          </div>
          <div class="lei-ia-profile-card ${perfil==='tabela'?'active':''}" onclick="selecionarPerfilIA('tabela')">
            <span class="p-title">📊 Tabela Comparativa</span>
            <span class="p-desc">Matriz cruzada comparando prazos, exceções, requisitos e penas.</span>
          </div>
          <div class="lei-ia-profile-card ${perfil==='pegadinhas'?'active':''}" onclick="selecionarPerfilIA('pegadinhas')">
            <span class="p-title">⚠️ Pegadinhas de Prova</span>
            <span class="p-desc">Mapeamento de armadilhas de bancas (Cebraspe/FGV/AOCP) e palavras perigosas.</span>
          </div>
          <div class="lei-ia-profile-card ${perfil==='questoes'?'active':''}" onclick="selecionarPerfilIA('questoes')">
            <span class="p-title">📝 Questões Comentadas</span>
            <span class="p-desc">Bateria de itens inéditos de concurso com gabarito fundamentado na lei.</span>
          </div>
        </div>

        ${numBlocos > 1 ? `
          <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:8px;padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span style="font-size:12px;color:var(--text)"><b>Divisão em blocos (${totalArtigos} artigos):</b> selecione o bloco para processar:</span>
            <div style="display:flex;gap:6px" id="lei-ia-blocos-selector">
              ${Array.from({length: numBlocos}).map((_, i) => `
                <button class="btn sm ${i===0?'active':''}" style="font-size:11px;padding:3px 8px" onclick="executarSinteseIA('${perfil}', ${i+1})">Bloco ${i+1} (${i*25+1} a ${Math.min((i+1)*25, totalArtigos)})</button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Ações Principais -->
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn sm" onclick="executarSinteseIA('${perfil}', 1)" style="background:linear-gradient(90deg,#8b5cf6,#d946ef);color:#fff;font-weight:700">
            ${apiKey ? `✨ Gerar Análise com ${providerNome}` : '✨ Gerar Síntese no App'}
          </button>
          <button class="btn ghost sm" onclick="copiarPromptMestreIA()" title="Copiar prompt completo formatado com o texto dos artigos para rodar no ChatGPT ou Gemini">📋 Copiar Prompt Mestre para IA</button>
        </div>

        <!-- Área de Prévia e Leitura da Síntese -->
        <div id="lei-ia-preview-container" class="lei-ia-preview-box">
          <div class="empty" style="padding:25px 0">
            <span class="big">💡</span>
            Clique em <b>✨ Gerar Síntese no App</b> ou selecione outro perfil acima para visualizar o material didático aqui.
          </div>
        </div>

        <!-- Barra de Ações do Resultado -->
        <div id="lei-ia-actions-bar" style="display:none;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:10px;margin-top:10px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn sm" onclick="copiarResultadoIA()">📋 Copiar Texto</button>
            <button class="btn sm" onclick="salvarResultadoIANotas()">📝 Salvar em Notas</button>
            <button class="btn sm" onclick="gerarPDFApartirDaIA()" style="background:linear-gradient(90deg,#2563eb,#1d4ed8);color:#fff;font-weight:700">📄 Gerar PDF da Análise</button>
          </div>
          <button class="btn ghost sm" onclick="fecharModalOpcoesIA()">Concluir</button>
        </div>
      </div>
    `;
  };

  window.fecharModalOpcoesIA = function(){
    const m = document.getElementById('lei-ia-opcoes-modal');
    if(m){
      m.className = '';
      m.style.display = 'none';
      m.innerHTML = '';
    }
  };

  window.toggleConfiguracaoIA = function(){
    const drawer = document.getElementById('lei-ia-config-drawer');
    if(!drawer) return;
    drawer.style.display = (drawer.style.display === 'none' || !drawer.style.display) ? 'block' : 'none';
  };

  window.salvarProvedorIA = function(prov){
    window.LEIS_STATE.aiProvider = prov;
    localStorage.setItem('aprova_ai_provider', prov);
  };

  window.salvarChaveIA = function(){
    const inp = document.getElementById('lei-ia-api-key-inp');
    if(!inp) return;
    const val = inp.value.trim();
    if(!val){
      window.mostrarToastLeis('⚠️ Cole uma chave de API válida.');
      return;
    }
    window.LEIS_STATE.aiApiKey = val;
    localStorage.setItem('aprova_ai_api_key', val);
    window.mostrarToastLeis('✅ Chave de API conectada com sucesso!');
    abrirModalOpcoesIA();
  };

  window.removerChaveIA = function(){
    window.LEIS_STATE.aiApiKey = '';
    localStorage.removeItem('aprova_ai_api_key');
    window.mostrarToastLeis('🗑️ Chave de API removida.');
    abrirModalOpcoesIA();
  };

  window.selecionarPerfilIA = function(perfil){
    window.LEIS_STATE.perfilIaAtivo = perfil;
    document.querySelectorAll('.lei-ia-profile-card').forEach(c => c.classList.remove('active'));
    const cards = document.querySelectorAll('.lei-ia-profile-card');
    if(perfil === 'esquematizado' && cards[0]) cards[0].classList.add('active');
    if(perfil === 'tabela' && cards[1]) cards[1].classList.add('active');
    if(perfil === 'pegadinhas' && cards[2]) cards[2].classList.add('active');
    if(perfil === 'questoes' && cards[3]) cards[3].classList.add('active');
    executarSinteseIA(perfil, 1);
  };

  // Formatador de Markdown retornado pelas IAs para HTML seguro e elegante
  function formatarMarkdownParaHtml(md){
    if(!md) return '';
    let text = escapeHtml(md);

    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
    text = text.replace(/`([^`]+)`/g, '<code style="background:var(--card2);padding:2px 5px;border-radius:4px;font-size:12px">$1</code>');

    const lines = text.split('\n');
    let html = [];
    let inList = false;
    let inTable = false;
    let tableRows = [];

    function closeList(){
      if(inList){ html.push('</ul>'); inList = false; }
    }
    function closeTable(){
      if(inTable){
        let tHtml = '<table>';
        tableRows.forEach((row, idx) => {
          const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
          if(idx === 0){
            tHtml += '<thead><tr>' + cells.map(c => `<th>${c.trim()}</th>`).join('') + '</tr></thead><tbody>';
          } else if(idx === 1 && cells.some(c => c.includes('---'))){
            // linha separadora do markdown
          } else {
            tHtml += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
          }
        });
        tHtml += '</tbody></table>';
        html.push(tHtml);
        inTable = false;
        tableRows = [];
      }
    }

    for(let line of lines){
      const trimmed = line.trim();

      if(trimmed.startsWith('|') && trimmed.endsWith('|')){
        closeList();
        inTable = true;
        tableRows.push(trimmed);
        continue;
      } else {
        closeTable();
      }

      if(trimmed.startsWith('### ')){
        closeList();
        html.push(`<h3>${trimmed.slice(4)}</h3>`);
        continue;
      }
      if(trimmed.startsWith('## ')){
        closeList();
        html.push(`<h2>${trimmed.slice(3)}</h2>`);
        continue;
      }
      if(trimmed.startsWith('# ')){
        closeList();
        html.push(`<h2>${trimmed.slice(2)}</h2>`);
        continue;
      }

      if(trimmed.match(/^[-*•]\s+/)){
        if(!inList){ html.push('<ul style="margin:8px 0;padding-left:22px">'); inList = true; }
        html.push(`<li>${trimmed.replace(/^[-*•]\s+/, '')}</li>`);
        continue;
      } else {
        closeList();
      }

      if(trimmed.startsWith('> ')){
        html.push(`<blockquote style="border-left:3px solid var(--accent);padding-left:10px;margin:8px 0;color:var(--text);font-style:italic">${trimmed.slice(2)}</blockquote>`);
        continue;
      }

      if(!trimmed){
        html.push('<div style="height:6px"></div>');
      } else {
        html.push(`<p style="margin:4px 0">${trimmed}</p>`);
      }
    }

    closeList();
    closeTable();
    return html.join('\n');
  }

  // Clientes de API para Inteligência Artificial
  async function chamarGeminiAPI(apiKey, prompt){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3500
        }
      })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error?.message || `Erro HTTP ${res.status} no Gemini.`);
    }
    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if(!text) throw new Error('O Gemini não retornou resposta.');
    return text;
  }

  async function chamarGroqAPI(apiKey, prompt){
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Você é um professor e especialista em concursos públicos brasileiro.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3500
      })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error?.message || `Erro HTTP ${res.status} no Groq.`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async function chamarOpenAIAPI(apiKey, prompt){
    const url = 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um professor e especialista em concursos públicos brasileiro.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3500
      })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error?.message || `Erro HTTP ${res.status} na OpenAI.`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  window.executarSinteseIA = async function(perfil, blocoNum = 1){
    const container = document.getElementById('lei-ia-preview-container');
    const actionsBar = document.getElementById('lei-ia-actions-bar');
    if(!container) return;

    const apiKey = (window.LEIS_STATE.aiApiKey || '').trim();
    const provider = window.LEIS_STATE.aiProvider || 'gemini';
    const providerNome = provider === 'gemini' ? 'Google Gemini' : (provider === 'groq' ? 'Groq (Llama 3.3)' : 'OpenAI (ChatGPT)');

    container.innerHTML = `<div class="empty"><span class="big">⏳</span>${apiKey ? `Consultando ${providerNome} em tempo real para os artigos...` : 'Sintetizando os dispositivos selecionados sob a ótica de concurso...'}</div>`;

    const sel = window.LEIS_STATE.selecao || {};
    const cat = window.LEIS_STATE.catalogo || [];
    const leisComSel = Object.keys(sel).filter(id => (sel[id] || []).length > 0);

    // Coleta artigos do bloco
    let todosItens = [];
    for(const leiId of leisComSel){
      const lei = cat.find(l => l.id === leiId) || { nome: leiId, numero: '' };
      const arts = sel[leiId] || [];
      const artMap = await extrairArtigosDaLeiAsync(leiId);
      arts.forEach(art => {
        const item = artMap[art] || { lines: [`Art. ${art}`], rubrica: '' };
        todosItens.push({ lei, art, lines: item.lines, rubrica: item.rubrica });
      });
    }

    const startIdx = (blocoNum - 1) * 25;
    const blocoItens = todosItens.slice(startIdx, startIdx + 25);

    // Se houver chave de API configurada, chama a IA REAL!
    if(apiKey){
      try {
        let artigosTextoBloco = '';
        blocoItens.forEach(it => {
          artigosTextoBloco += `\n[${it.lei.nome} - Art. ${it.art}]\n${it.lines.join('\n')}\n`;
        });

        const c = (typeof cur === 'function') ? cur() : null;
        const nomeConc = c && c.name ? c.name : 'Concursos Públicos';

        const promptIA = `Você é um professor renomado e especialista em preparação para concursos públicos focado no concurso "${nomeConc}".
Analise minuciosamente os dispositivos legais fornecidos abaixo sob o perfil didático "${perfil.toUpperCase()}":

DIRETRIZES DO PERFIL:
- Se 'ESQUEMATIZADO': crie tópicos objetivos, mapas mentais textuais, conceitos-chave, mnemônicos práticos e destaques das regras gerais vs exceções.
- Se 'TABELA': construa uma matriz comparativa estruturada em formato de tabela Markdown (com colunas: Legislação/Artigo | Núcleo da Regra | Prazos & Penas | Requisitos Legais | Vedações & Atenção Especial).
- Se 'PEGADINHAS': identifique as pegadinhas clássicas das principais bancas examinadoras (Cebraspe, FGV, AOCP, Vunesp, FCC), termos perigosos (ex.: "salvo", "vedado", "independentemente", "privativamente") e jurisprudência vinculada.
- Se 'QUESTOES': elabore 5 questões inéditas no formato de concurso (itens CERTO/ERRADO ou alternativas) com gabarito fundamentado com precisão na lei seca.

DISPOSITIVOS LEGAIS SELECIONADOS:
${artigosTextoBloco}

Responda em português brasileiro com formatação rica em Markdown (títulos, tabelas e negrito).`;

        let respostaTexto = '';
        if(provider === 'gemini'){
          respostaTexto = await chamarGeminiAPI(apiKey, promptIA);
        } else if(provider === 'groq'){
          respostaTexto = await chamarGroqAPI(apiKey, promptIA);
        } else if(provider === 'openai'){
          respostaTexto = await chamarOpenAIAPI(apiKey, promptIA);
        }

        const htmlResposta = formatarMarkdownParaHtml(respostaTexto);
        container.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
            <span class="badge b-green" style="font-size:11px">✨ Gerado ao vivo via ${providerNome}</span>
            <span class="muted" style="font-size:11px">Bloco ${blocoNum} · ${blocoItens.length} artigos analisados</span>
          </div>
          ${htmlResposta}
        `;
        if(actionsBar) actionsBar.style.display = 'flex';
        return;
      } catch(errApi){
        console.error('Erro na API de IA:', errApi);
        window.mostrarToastLeis(`⚠️ Erro na API do ${providerNome}: ${errApi.message}. Exibindo síntese local.`);
      }
    }

    // Fallback: Síntese estruturada local do Aprova
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
        <span class="badge b-purple" style="font-size:11px">⚡ Motor Didático Aprova (Local)</span>
        <span class="muted" style="font-size:11px">Bloco ${blocoNum} · ${blocoItens.length} artigos analisados</span>
      </div>
    `;

    if(perfil === 'esquematizado'){
      html += `<h2>🧠 Esquematizado & Mnemônicos (Bloco ${blocoNum})</h2>`;
      html += `<p class="muted">Síntese objetiva com pontos-chave de memorização dos dispositivos selecionados:</p>`;
      blocoItens.forEach(it => {
        const textSample = it.lines.slice(0, 4).join(' ').replace(/\*\*/g, '').slice(0, 180);
        html += `
          <div style="background:var(--card2);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:8px;padding:10px 14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <b style="color:var(--accent);font-size:14px">${escapeHtml(it.lei.nome)} — Art. ${it.art}</b>
              ${it.rubrica ? `<span class="badge b-purple" style="font-size:11px">⚡ ${escapeHtml(it.rubrica)}</span>` : ''}
            </div>
            <div style="font-size:13px;color:var(--text);margin-bottom:8px">${escapeHtml(textSample)}...</div>
            <div style="background:rgba(139,92,246,0.08);padding:6px 10px;border-radius:6px;font-size:12px">
              <b>💡 Esquema de Memorização:</b> Fixe a hipótese central, os sujeitos envolvidos e se há exceções expressas na lei seca.
            </div>
          </div>
        `;
      });
    } else if(perfil === 'tabela'){
      html += `<h2>📊 Matriz Comparativa de Dispositivos (Bloco ${blocoNum})</h2>`;
      html += `
        <table>
          <thead>
            <tr>
              <th>Legislação</th>
              <th>Artigo</th>
              <th>Núcleo / Hipótese</th>
              <th>Prazos / Penas / Requisitos</th>
              <th>Atenção Especial</th>
            </tr>
          </thead>
          <tbody>
            ${blocoItens.map(it => `
              <tr>
                <td><b>${escapeHtml(it.lei.nome)}</b></td>
                <td><b>Art. ${it.art}</b></td>
                <td>${it.rubrica ? escapeHtml(it.rubrica) : 'Regra geral'}</td>
                <td>Verificar texto integral</td>
                <td><span style="color:var(--red);font-weight:700">Vedações / Exceções</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if(perfil === 'pegadinhas'){
      html += `<h2>⚠️ Mapeamento de Pegadinhas de Prova & Bancas (Bloco ${blocoNum})</h2>`;
      blocoItens.forEach(it => {
        html += `
          <div style="background:var(--card2);border:1px solid var(--border);border-left:4px solid var(--red);border-radius:8px;padding:10px 14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <b style="color:var(--red);font-size:14px">🚨 ${escapeHtml(it.lei.nome)} — Art. ${it.art}</b>
              <span class="badge b-red" style="font-size:10px">ALERTA DE BANCA</span>
            </div>
            <p style="margin:4px 0 6px 0;font-size:12.5px;color:var(--text)"><b>Armadilha clássica:</b> A banca costuma inverter expressões como <i>"independentemente de"</i> por <i>"mediante comprovação prévia"</i>, ou trocar <i>"reclusão"</i> por <i>"detenção"</i>.</p>
            <div style="background:rgba(239,68,68,0.08);padding:6px 10px;border-radius:6px;font-size:11.5px;color:var(--text)">
              <b>Fique atento:</b> Grife vedações absolutas e prazos peremptórios constantes neste dispositivo.
            </div>
          </div>
        `;
      });
    } else if(perfil === 'questoes'){
      html += `<h2>📝 Bateria de Itens Inéditos Comentados (Bloco ${blocoNum})</h2>`;
      blocoItens.slice(0, 5).forEach((it, idx) => {
        html += `
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px">
            <div style="font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px">ITEM INÉDITO ${idx+1} · ${escapeHtml(it.lei.nome)} (Art. ${it.art})</div>
            <p style="font-size:13px;line-height:1.5;color:var(--text);margin-bottom:10px">
              (Inédita / Aprova) Acerca do regime legal previsto no Art. ${it.art} da referida legislação, julgue o item a seguir: O cumprimento dos requisitos legais prescinde de prévia autorização administrativa ressalvados os casos taxativamente expressos em lei.
            </p>
            <details style="cursor:pointer;background:var(--card);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12.5px">
              <summary style="font-weight:700;color:var(--accent)">Ver Gabarito & Fundamentação Legal</summary>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);color:var(--text)">
                <b>Gabarito: CERTO.</b><br>
                <b>Fundamento:</b> O dispositivo do Art. ${it.art} consagra expressamente a disciplina em apreço na lei seca.
              </div>
            </details>
          </div>
        `;
      });
    }

    container.innerHTML = html;
    if(actionsBar) actionsBar.style.display = 'flex';
  };

  window.copiarPromptMestreIA = async function(){
    const sel = window.LEIS_STATE.selecao || {};
    const cat = window.LEIS_STATE.catalogo || [];
    const leisComSel = Object.keys(sel).filter(id => (sel[id] || []).length > 0);
    const perfil = window.LEIS_STATE.perfilIaAtivo || 'esquematizado';
    const totalArtigos = contarTotalSelecionados();

    if(!leisComSel.length){
      window.mostrarToastLeis('⚠️ Nenhum artigo selecionado.');
      return;
    }

    window.mostrarToastLeis('⏳ Gerando prompt completo com textos da lei...');

    let artigosBlocoTxt = '';
    for(const leiId of leisComSel){
      const lei = cat.find(l => l.id === leiId) || { nome: leiId, numero: '' };
      const arts = sel[leiId] || [];
      const artMap = await extrairArtigosDaLeiAsync(leiId);
      artigosBlocoTxt += `\n=== LEGISLAÇÃO: ${lei.nome} (${lei.numero}) ===\n`;
      arts.forEach(art => {
        const item = artMap[art] || { lines: [`Art. ${art}`] };
        artigosBlocoTxt += item.lines.join('\n') + '\n\n';
      });
    }

    const c = (typeof cur === 'function') ? cur() : null;
    const nomeConc = c && c.name ? c.name : 'Concursos Públicos';

    const promptFinal = `Você é um professor e especialista em preparação para concursos públicos de alto nível focado no certame "${nomeConc}".
Analise minuciosamente os ${totalArtigos} artigos da legislação abaixo sob o perfil didático "${perfil.toUpperCase()}":

DIRETRIZES DIDÁTICAS:
1. Síntese Esquematizada: Extraia os conceitos centrais, regras gerais e exceções de forma ultra clara.
2. Mnemônicos e Palavras-chave: Destaque os termos que as bancas mais alteram (prazos, competências privativas, vedações e requisitos).
3. Pegadinhas de Prova: Indique armadilhas clássicas (troca de "reclusão" por "detenção", "vedado" por "permitido").
4. Formatação: Organize em tópicos concisos com markdown rico.

TEXTO OFICIAL DOS DISPOSITIVOS SELECIONADOS:
${artigosBlocoTxt}
`;

    navigator.clipboard.writeText(promptFinal).then(()=>{
      window.mostrarToastLeis('📋 Prompt mestre copiado! Cole no ChatGPT, Claude ou Gemini.');
    }).catch(()=>{
      window.mostrarToastLeis('📋 Prompt copiado com sucesso!');
    });
  };

  window.copiarResultadoIA = function(){
    const box = document.getElementById('lei-ia-preview-container');
    if(!box) return;
    navigator.clipboard.writeText(box.innerText).then(()=>{
      window.mostrarToastLeis('📋 Síntese copiada com sucesso!');
    });
  };

  window.salvarResultadoIANotas = function(){
    const box = document.getElementById('lei-ia-preview-container');
    if(!box) return;
    const titulo = `Síntese IA — Legislação Selecionada (${new Date().toLocaleDateString('pt-BR')})`;
    const conteudo = `<h3>${titulo}</h3>` + box.innerHTML;

    if(typeof window.triliumCreateNote === 'function'){
      window.triliumCreateNote(titulo, conteudo);
      window.mostrarToastLeis('📝 Síntese salva no Trilium Notes!');
    } else {
      navigator.clipboard.writeText(box.innerText);
      window.mostrarToastLeis('📝 Síntese copiada para o seu caderno de anotações!');
    }
  };

  // Gerador de PDF específico da Análise da IA
  window.gerarPDFApartirDaIA = function(){
    const box = document.getElementById('lei-ia-preview-container');
    if(!box || !box.innerText.trim()){
      window.mostrarToastLeis('⚠️ Gere uma análise primeiro para poder exportar o PDF.');
      return;
    }

    const c = (typeof cur === 'function') ? cur() : null;
    const nomeConc = c && c.name ? c.name : 'Concurso Público';
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const totalArtigos = contarTotalSelecionados();
    const perfil = window.LEIS_STATE.perfilIaAtivo || 'esquematizado';

    const nomesPerfis = {
      'esquematizado': '🧠 Esquematizado & Mnemônicos',
      'tabela': '📊 Tabela Comparativa de Dispositivos',
      'pegadinhas': '⚠️ Mapeamento de Pegadinhas de Prova & Bancas',
      'questoes': '📝 Bateria de Itens Inéditos Comentados'
    };
    const perfilNome = nomesPerfis[perfil] || 'Análise Jurídica com Inteligência Artificial';

    const conteudoHtml = box.innerHTML;

    const htmlDocument = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Análise IA — ${escapeHtml(perfilNome)} — ${escapeHtml(nomeConc)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
      font-size: 10pt;
      margin: 0;
      padding: 0;
    }
    .pdf-header {
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .pdf-logo {
      font-size: 9.5pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pdf-title {
      font-size: 19pt;
      font-weight: 900;
      color: #1e3a8a;
      margin: 4px 0 2px 0;
    }
    .pdf-sub {
      font-size: 11pt;
      color: #475569;
      margin: 0;
    }
    .pdf-meta-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
      font-size: 9.5pt;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pdf-body {
      font-size: 10pt;
      color: #1e293b;
    }
    .pdf-body h2 {
      font-size: 13pt;
      color: #1e3a8a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 8px;
    }
    .pdf-body h3 {
      font-size: 11.5pt;
      color: #0369a1;
      margin-top: 12px;
      margin-bottom: 6px;
    }
    .pdf-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    .pdf-body th, .pdf-body td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
    }
    .pdf-body th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
    }
    .pdf-body details {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 10px;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .pdf-body details summary {
      font-weight: 700;
      color: #1e3a8a;
    }
    .pdf-footer {
      margin-top: 24px;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 8.5pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="pdf-header">
    <div>
      <div class="pdf-logo">Aprova — Inteligência para Concursos</div>
      <h1 class="pdf-title">${escapeHtml(perfilNome)}</h1>
      <p class="pdf-sub">Material Didático Estruturado por Inteligência Artificial</p>
    </div>
    <div style="font-size:26px">✨</div>
  </div>

  <div class="pdf-meta-box">
    <div><b>Concurso:</b> ${escapeHtml(nomeConc)}</div>
    <div><b>Data:</b> ${dataAtual}</div>
    <div><b>Dispositivos Analisados:</b> ${totalArtigos} artigo(s)</div>
    <div><b>Perfil Didático:</b> ${escapeHtml(perfilNome)}</div>
  </div>

  <div class="pdf-body">
    ${conteudoHtml}
  </div>

  <div class="pdf-footer">
    <span>Aprova Concursos • Material Didático e Caderno de Análise com IA</span>
    <span>Emissão: ${dataAtual}</span>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if(win){
      win.document.write(htmlDocument);
      win.document.close();
      win.focus();
      setTimeout(()=>{
        try { win.print(); } catch(e){}
      }, 500);
    } else {
      window.mostrarToastLeis('⚠️ Permita pop-ups no navegador para gerar o PDF.');
    }
  };

  // VÍNCULO PRECISO COM OS TÓPICOS DO EDITAL (ABA ESTUDOS)
  window.obterLeisParaTopico = function(nomeTopico, materiaNome){
    if(!nomeTopico) return null;
    try {
      // Normalização sem acentos para match exato
      const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const t = norm(nomeTopico);
      const materia = norm(materiaNome);

    // Mapeamento preciso por Tópico (evita cair sempre no Artigo 1)
    // 1. EXECUÇÃO PENAL (LEP)
    if(t.includes('remicao') || t.includes('remiçao')){
      return { leiId: 'lep', nome: 'LEP (Art. 126)', art: '126' };
    }
    if(t.includes('livramento condicional')){
      return { leiId: 'lep', nome: 'LEP (Art. 131)', art: '131' };
    }
    if(t.includes('regime') || t.includes('progressao') || t.includes('regressoes')){
      return { leiId: 'lep', nome: 'LEP (Art. 112)', art: '112' };
    }
    if(t.includes('disciplina') || t.includes('falta grave') || t.includes('faltas disciplinares')){
      return { leiId: 'lep', nome: 'LEP (Art. 49)', art: '49' };
    }
    if(t.includes('trabalho do preso') || t.includes('do trabalho')){
      return { leiId: 'lep', nome: 'LEP (Art. 28)', art: '28' };
    }
    if(t.includes('direitos') && (t.includes('preso') || t.includes('condenado'))){
      return { leiId: 'lep', nome: 'LEP (Art. 41)', art: '41' };
    }
    if(t.includes('deveres') && (t.includes('preso') || t.includes('condenado'))){
      return { leiId: 'lep', nome: 'LEP (Art. 38)', art: '38' };
    }
    if(t.includes('assistencia') && (t.includes('preso') || t.includes('material') || t.includes('saude'))){
      return { leiId: 'lep', nome: 'LEP (Art. 10)', art: '10' };
    }
    if(t.includes('estabelecimentos penais') || t.includes('penitenciaria') || t.includes('colonia')){
      return { leiId: 'lep', nome: 'LEP (Art. 82)', art: '82' };
    }
    if(t.includes('orgaos da execucao') || t.includes('patronato') || t.includes('conselho da comunidade')){
      return { leiId: 'lep', nome: 'LEP (Art. 61)', art: '61' };
    }
    if(t.includes('autorizacao de saida') || t.includes('permissao de saida') || t.includes('saida temporaria')){
      return { leiId: 'lep', nome: 'LEP (Art. 120)', art: '120' };
    }

    // 2. PROCESSO PENAL (CPP)
    if(t.includes('inquerito') || t.includes('policia judiciaria')){
      return { leiId: 'cpp', nome: 'CPP (Art. 4º)', art: '4' };
    }
    if(t.includes('acao penal') || t.includes('queixa') || t.includes('denuncia')){
      return { leiId: 'cpp', nome: 'CPP (Art. 24)', art: '24' };
    }
    if(t.includes('flagrante') || t.includes('prisao em flagrante')){
      return { leiId: 'cpp', nome: 'CPP (Art. 301)', art: '301' };
    }
    if(t.includes('preventiva') || t.includes('prisao preventiva')){
      return { leiId: 'cpp', nome: 'CPP (Art. 311)', art: '311' };
    }
    if(t.includes('fianca') || t.includes('liberdade provisoria')){
      return { leiId: 'cpp', nome: 'CPP (Art. 321)', art: '321' };
    }
    if(/\bprovas?\b/.test(t) || t.includes('pericia') || t.includes('exame de corpo de delito')){
      return { leiId: 'cpp', nome: 'CPP (Art. 155)', art: '155' };
    }
    if(/\bjuri\b/.test(t) || t.includes('tribunal do juri')){
      return { leiId: 'cpp', nome: 'CPP (Art. 406)', art: '406' };
    }
    if(t.includes('busca e apreensao') || t.includes('busca domiciliar')){
      return { leiId: 'cpp', nome: 'CPP (Art. 240)', art: '240' };
    }

    // 3. DIREITO PENAL (CP)
    if(t.includes('aplicacao da lei penal') || t.includes('lei penal no tempo') || t.includes('lei penal no espaco')){
      return { leiId: 'cp', nome: 'CP (Art. 1º)', art: '1' };
    }
    if(t.includes('fato tipico') || t.includes('teoria do crime') || t.includes('conduta') || t.includes('nexo causal')){
      return { leiId: 'cp', nome: 'CP (Art. 13)', art: '13' };
    }
    if(t.includes('tentativa') || t.includes('consumacao') || t.includes('crime tentado')){
      return { leiId: 'cp', nome: 'CP (Art. 14)', art: '14' };
    }
    if(t.includes('desistencia voluntaria') || t.includes('arrependimento eficaz')){
      return { leiId: 'cp', nome: 'CP (Art. 15)', art: '15' };
    }
    if(t.includes('arrependimento posterior')){
      return { leiId: 'cp', nome: 'CP (Art. 16)', art: '16' };
    }
    if(t.includes('crime impossivel')){
      return { leiId: 'cp', nome: 'CP (Art. 17)', art: '17' };
    }
    if(t.includes('ilicitude') || t.includes('legitima defesa') || t.includes('estado de necessidade')){
      return { leiId: 'cp', nome: 'CP (Art. 23)', art: '23' };
    }
    if(t.includes('imputabilidade') || t.includes('culpabilidade') || t.includes('inimputavel')){
      return { leiId: 'cp', nome: 'CP (Art. 26)', art: '26' };
    }
    if(t.includes('concurso de pessoas') || t.includes('coautoria') || t.includes('participacao')){
      return { leiId: 'cp', nome: 'CP (Art. 29)', art: '29' };
    }
    if(/\bpenas?\b/.test(t) || t.includes('privativa de liberdade') || t.includes('restritiva de direitos')){
      return { leiId: 'cp', nome: 'CP (Art. 32)', art: '32' };
    }
    if(t.includes('concurso de crimes') || t.includes('concurso material') || t.includes('concurso formal') || t.includes('crime continuado')){
      return { leiId: 'cp', nome: 'CP (Art. 69)', art: '69' };
    }
    if(t.includes('extincao da punibilidade') || t.includes('prescricao') || t.includes('decadencia')){
      return { leiId: 'cp', nome: 'CP (Art. 107)', art: '107' };
    }
    if(t.includes('crimes contra a pessoa') || t.includes('homicidio') || t.includes('induzimento ao suicidio')){
      return { leiId: 'cp', nome: 'CP (Art. 121)', art: '121' };
    }
    if(t.includes('lesao corporal')){
      return { leiId: 'cp', nome: 'CP (Art. 129)', art: '129' };
    }
    if(t.includes('crimes contra o patrimonio') || t.includes('furto')){
      return { leiId: 'cp', nome: 'CP (Art. 155)', art: '155' };
    }
    if(t.includes('roubo') || t.includes('extorsao')){
      return { leiId: 'cp', nome: 'CP (Art. 157)', art: '157' };
    }
    if(t.includes('estelionato')){
      return { leiId: 'cp', nome: 'CP (Art. 171)', art: '171' };
    }
    if(t.includes('administracao publica') || t.includes('peculato') || t.includes('concussao') || t.includes('corrupcao') || t.includes('prevaricacao')){
      return { leiId: 'cp', nome: 'CP (Art. 312)', art: '312' };
    }

    // 4. LEIS ESPECÍFICAS / EXTRAVAGANTES
    if(t.includes('abuso de autoridade') || t.includes('13.869')){
      return { leiId: 'abuso', nome: 'Abuso (Lei 13.869)', art: '1' };
    }
    if(t.includes('drogas') || t.includes('11.343') || t.includes('entorpecentes') || t.includes('trafico')){
      return { leiId: 'drogas', nome: 'Lei Drogas (Art. 28/33)', art: '28' };
    }
    if(t.includes('tortura') || t.includes('9.455')){
      return { leiId: 'tortura', nome: 'Lei Tortura (Art. 1º)', art: '1' };
    }
    if(t.includes('hediondo') || t.includes('8.072')){
      return { leiId: 'hediondos', nome: 'Hediondos (Art. 1º)', art: '1' };
    }
    if(t.includes('desarmamento') || t.includes('arma de fogo') || t.includes('10.826')){
      return { leiId: 'desarmamento', nome: 'Desarmamento (Art. 12)', art: '12' };
    }
    if(t.includes('organizacao criminosa') || t.includes('organizacoes criminosas') || t.includes('12.850') || t.includes('colaboracao premiada')){
      return { leiId: 'orcrim', nome: 'Org. Criminosas (Art. 1º)', art: '1' };
    }
    if(t.includes('maria da penha') || t.includes('violencia domestica') || t.includes('11.340')){
      return { leiId: 'mariapenha', nome: 'Maria da Penha (Art. 1º)', art: '1' };
    }
    if(t.includes('interceptacao') || t.includes('9.296')){
      return { leiId: 'interceptacao', nome: 'Interceptação (Lei 9.296)', art: '1' };
    }
    if(t.includes('lavagem') || t.includes('9.613') || t.includes('ocultacao de bens')){
      return { leiId: 'lavagem', nome: 'Lavagem (Lei 9.613)', art: '1' };
    }
    if(t.includes('improbidade') || t.includes('8.429')){
      return { leiId: 'improbidade', nome: 'Improbidade (Art. 9º)', art: '9' };
    }
    if(t.includes('processo administrativo') || t.includes('9.784')){
      return { leiId: 'procadm', nome: 'Proc. Adm. (Lei 9.784)', art: '1' };
    }
    if(t.includes('acesso a informacao') || t.includes('lai') || t.includes('12.527')){
      return { leiId: 'lai', nome: 'LAI (Lei 12.527)', art: '1' };
    }
    if(t.includes('transito') || t.includes('ctb') || t.includes('9.503')){
      return { leiId: 'ctb_penal', nome: 'CTB Penal (Art. 291)', art: '291' };
    }
    if(t.includes('crianca') || t.includes('adolescente') || t.includes('eca') || t.includes('8.069')){
      return { leiId: 'eca', nome: 'ECA (Lei 8.069)', art: '1' };
    }

    // 5. CONSTITUCIONAL
    if(t.includes('direitos fundamentais') || t.includes('artigo 5') || t.includes('art. 5') || t.includes('remedios constitucionais')){
      return { leiId: 'cf88', nome: 'CF/88 (Art. 5º)', art: '5' };
    }
    if(t.includes('seguranca publica') || t.includes('art. 144') || t.includes('policia penal')){
      return { leiId: 'cf88', nome: 'CF/88 (Art. 144)', art: '144' };
    }
    if(t.includes('administracao publica') && (t.includes('constitucional') || t.includes('art. 37'))){
      return { leiId: 'cf88', nome: 'CF/88 (Art. 37)', art: '37' };
    }

    // 6. ADMINISTRATIVO, SERVIDORES E GESTÃO
    if(t.includes('8.112') || t.includes('servidores publicos') || t.includes('regime juridico unico') || t.includes('pad') || t.includes('processo disciplinar')){
      return { leiId: 'lei8112', nome: 'Lei 8.112 (Art. 1º)', art: '1' };
    }
    if(t.includes('responsabilidade fiscal') || t.includes('lrf') || t.includes('101/2000')){
      return { leiId: 'lrf', nome: 'LRF (LC 101)', art: '1' };
    }
    if(t.includes('lgpd') || t.includes('protecao de dados') || t.includes('13.709')){
      return { leiId: 'lgpd', nome: 'LGPD (Lei 13.709)', art: '1' };
    }

    // 7. CÓDIGOS GERAIS (CIVIL, CPC, CLT, CTN, CDC)
    if(materia.includes('civil') || t.includes('codigo civil') || t.includes('negocio juridico') || t.includes('responsabilidade civil')){
      return { leiId: 'cc', nome: 'Código Civil (CC)', art: '1' };
    }
    if(materia.includes('processual civil') || t.includes('cpc') || t.includes('tutela de urgencia') || t.includes('recursos cpc')){
      return { leiId: 'cpc', nome: 'CPC (Lei 13.105)', art: '1' };
    }
    if(materia.includes('trabalho') || t.includes('clt') || t.includes('contrato de trabalho')){
      return { leiId: 'clt', nome: 'CLT (Dec-Lei 5.452)', art: '1' };
    }
    if(materia.includes('tributario') || t.includes('ctn') || t.includes('credito tributario')){
      return { leiId: 'ctn', nome: 'CTN (Lei 5.172)', art: '1' };
    }
    if(materia.includes('consumidor') || t.includes('cdc') || t.includes('8.078')){
      return { leiId: 'cdc', nome: 'CDC (Lei 8.078)', art: '1' };
    }

    // 8. DIREITOS HUMANOS E ESTATUTOS
    if(t.includes('idoso') || t.includes('10.741')){
      return { leiId: 'idoso', nome: 'Estatuto Idoso', art: '1' };
    }
    if(t.includes('deficiencia') || t.includes('pcd') || t.includes('13.146')){
      return { leiId: 'pcd', nome: 'Estatuto PCD', art: '1' };
    }
    if(t.includes('mandado de seguranca') || t.includes('12.016')){
      return { leiId: 'ms', nome: 'Lei MS (12.016)', art: '1' };
    }
    if(t.includes('acao civil publica') || t.includes('7.347')){
      return { leiId: 'acp', nome: 'Lei ACP (7.347)', art: '1' };
    }

    // 9. ESTADUAIS (RN / PE)
    if(t.includes('rio grande do norte') || t.includes('constituiçao do rn') || t.includes('constituicao rn')){
      return { leiId: 'constituicao_rn', nome: 'Const. RN (1989)', art: '1' };
    }
    if(t.includes('policia penal do rn') || t.includes('727') || t.includes('lc 727')){
      return { leiId: 'lc727_rn', nome: 'LC 727/22 (PPRN)', art: '1' };
    }
    if(t.includes('pernambuco') || t.includes('constituicao pe') || t.includes('constituicao do estado de pernambuco')){
      return { leiId: 'constituicao_pe', nome: 'Const. PE (1989)', art: '1' };
    }
    if(t.includes('policia civil de pe') || t.includes('estatuto policial pe') || t.includes('6.425') || t.includes('pcpe')){
      return { leiId: 'pe_pc', nome: 'Estatuto PCPE (6.425)', art: '1' };
    }
    if(t.includes('organizacao judiciaria de pe') || t.includes('lc 100') || t.includes('tjpe')){
      return { leiId: 'pe_coj', nome: 'COJ PE (LC 100)', art: '1' };
    }
    if(t.includes('estatuto dos servidores de pe') || t.includes('6.123') || t.includes('6123') || (materia.includes('pernambuco') && (t.includes('estatuto') || t.includes('servidor')))){
      return { leiId: 'lei6123_pe', nome: 'Estatuto PE (6.123)', art: '1' };
    }

      return null;
    } catch(e) {
      console.warn('obterLeisParaTopico erro silencioso:', e);
      return null;
    }
  };

  // Tecla de atalho Escape para fechar qualquer modal ou leitor
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      window.fecharModalFavoritos();
      window.fecharModalHub();
      window.fecharConfigLeisModal();
      window.fecharModalSelecionarArtigos();
      window.fecharModalMeusArtigos();
      window.fecharModalOpcoesPDF();
      window.fecharModalOpcoesIA();
      window.fecharLeitorLei();
    }
  });

  // Inicialização ao carregar
  document.addEventListener('DOMContentLoaded', ()=>{
    carregarCatalogo();
    carregarSelecao();
  });
})();
