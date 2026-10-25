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
    favoritos: JSON.parse(localStorage.getItem('aprova_leis_favoritos') || '{}'),
    anotacoes: JSON.parse(localStorage.getItem('aprova_leis_anotacoes') || '{}'),
    historico: JSON.parse(localStorage.getItem('aprova_leis_historico') || '[]')
  };

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

  // Parser de Markdown Jurídico de Alta Performance
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

    // Divisão de linhas
    const lines = text.split('\n');
    let html = [];
    let inArtigo = false;
    let currentArtNum = '';

    for(let i = 0; i < lines.length; i++){
      let line = lines[i].trim();
      if(!line || line.includes('lei-anchor') || line.match(/^<span\s+id=["']art-[^"']+["'][^>]*><\/span>$/i)){
        if(!line && inArtigo) html.push('</div>'); // fecha parágrafo anterior
        continue;
      }

      // Detecção de Títulos e Cabeçalhos
      if(line.startsWith('# ')){
        if(inArtigo){ html.push('</div></div>'); inArtigo = false; }
        html.push(`<h1 class="lei-h1">${escapeHtml(line.slice(2).replace(/\*/g,''))}</h1>`);
        continue;
      }
      if(line.startsWith('## ')){
        if(inArtigo){ html.push('</div></div>'); inArtigo = false; }
        html.push(`<h2 class="lei-h2">${escapeHtml(line.slice(3).replace(/\*/g,''))}</h2>`);
        continue;
      }
      if(line.startsWith('### ')){
        if(inArtigo){ html.push('</div></div>'); inArtigo = false; }
        html.push(`<h3 class="lei-h3">${escapeHtml(line.slice(4).replace(/\*/g,''))}</h3>`);
        continue;
      }
      if(line.startsWith('#### ')){
        if(inArtigo){ html.push('</div></div>'); inArtigo = false; }
        html.push(`<h4 class="lei-h4">${escapeHtml(line.slice(5).replace(/\*/g,''))}</h4>`);
        continue;
      }

      // Detecção de Artigos: **Art. 1º**, **Artigo 121**, etc.
      const artMatch = line.match(/^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*(.*)$/i);
      if(artMatch){
        if(inArtigo) html.push('</div></div>'); // fecha artigo anterior
        inArtigo = true;
        currentArtNum = artMatch[1].trim();
        const cleanId = 'art-' + currentArtNum.toLowerCase().replace(/[ºo\.]/g, '');
        const resto = artMatch[2] ? artMatch[2].trim() : '';
        const isFav = favs.includes(currentArtNum);

        html.push(`
          <div class="lei-artigo-card" id="${cleanId}" data-artigo="${currentArtNum}">
            <div class="lei-artigo-header">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="lei-artigo-tag">Art. ${currentArtNum}</span>
                <span class="muted" style="font-size:11px">#${cleanId}</span>
              </div>
              <div class="lei-artigo-actions">
                <button class="btn-lei-icon ${isFav?'active':''}" onclick="toggleFavoritoArtigo('${leiId}', '${currentArtNum}')" title="${isFav?'Remover dos favoritos':'Marcar artigo para revisão'}">⭐</button>
                <button class="btn-lei-icon" onclick="copiarArtigoTexto('${leiId}', '${cleanId}', '${currentArtNum}')" title="Copiar texto do artigo">📋</button>
                <button class="btn-lei-icon" onclick="enviarArtigoTrilium('${leiId}', '${currentArtNum}')" title="Criar anotação deste artigo no Trilium Notes">📝</button>
              </div>
            </div>
            <div class="lei-artigo-body">
              <p class="lei-caput"><b>Art. ${currentArtNum}º</b> ${destacarTermos(formatarInline(resto))}</p>
        `);
        continue;
      }

      // Parágrafos, Incisos e Alíneas
      if(inArtigo){
        if(line.startsWith('**Parágrafo único') || line.startsWith('Parágrafo único') || line.startsWith('**§') || line.startsWith('§')){
          html.push(`<p class="lei-paragrafo">${destacarTermos(formatarInline(line))}</p>`);
        }
        else if(line.match(/^[IVXLCDM]+\s*[-–—]/i)){
          html.push(`<div class="lei-inciso">${destacarTermos(formatarInline(line))}</div>`);
        }
        else if(line.match(/^[a-z]\)/i)){
          html.push(`<div class="lei-alinea">${destacarTermos(formatarInline(line))}</div>`);
        }
        else if(line.startsWith('>') || line.toLowerCase().includes('(revogado)')){
          html.push(`<blockquote class="lei-quote">${destacarTermos(formatarInline(line))}</blockquote>`);
        }
        else {
          html.push(`<p class="lei-p">${destacarTermos(formatarInline(line))}</p>`);
        }
      } else {
        html.push(`<p class="lei-p-intro">${destacarTermos(formatarInline(line))}</p>`);
      }
    }

    if(inArtigo) html.push('</div></div>');
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
      { regex: /\b(vedado|vedada|vedados|vedadas)\b/gi, cls: 'mark-red', title: 'Atenção: Vedação absoluta' },
      { regex: /\b(salvo|exceto|ressalvado|ressalvada)\b/gi, cls: 'mark-amber', title: 'Exceção à regra geral' },
      { regex: /\b(imprescritível|inafiançável|insuscetível de graça ou anistia)\b/gi, cls: 'mark-purple', title: 'Cláusula pétrea / Mandado de criminalização' },
      { regex: /\b(reclusão|detenção|prisão simples)\b/gi, cls: 'mark-blue', title: 'Espécie de pena privativa de liberdade' },
      { regex: /\b(hediondo|hediondos|tortura|tráfico ilícito)\b/gi, cls: 'mark-red', title: 'Crime equiparado ou hediondo' }
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

  // ABERTURA DO LEITOR DE LEIS (DRAWER / FULLSCREEN)
  window.abrirLeitorLei = async function(leiId, artigoAlvo){
    await carregarCatalogo();
    const lei = window.LEIS_STATE.catalogo.find(l => l.id === leiId);
    if(!lei){ alert('Legislação não encontrada: ' + leiId); return; }

    window.LEIS_STATE.leiAtiva = lei;
    window.LEIS_STATE.artigoAtivo = artigoAlvo || null;

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
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
            <button class="btn ghost sm" onclick="fecharLeitorLei()" style="font-size:16px;padding:4px 10px" title="Fechar leitor (Esc)">✕</button>
            <div style="min-width:0">
              <h3 style="margin:0;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">
                ${lei.icone||'⚖️'} ${escapeHtml(lei.nome)}
              </h3>
              <span class="muted" style="font-size:11px">${escapeHtml(lei.numero)} · ${lei.total_artigos} artigos</span>
            </div>
          </div>

          <!-- Pulo Rápido para Artigo -->
          <div class="lei-jump-box">
            <span style="font-size:12px;font-weight:600;color:var(--muted)">Ir ao Art.:</span>
            <input type="text" id="lei-quick-jump" placeholder="ex: 121" value="${artigoAlvo||''}" onkeydown="if(event.key==='Enter')pularParaArtigo(this.value)">
            <button class="btn sm" style="padding:4px 10px;font-size:12px" onclick="pularParaArtigo(document.getElementById('lei-quick-jump').value)">Ir</button>
          </div>

          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn ghost sm" onclick="abrirVadeMecumHub()" title="Trocar de lei">🔄 Outra Lei</button>
            <button class="btn ghost sm" onclick="toggleDrawerFullscreen()" title="Alternar tela cheia">⛶</button>
            ${lei.fonte?`<a href="${lei.fonte}" target="_blank" rel="noopener" class="btn ghost sm" title="Ver texto original oficial">🌐 Fonte</a>`:''}
          </div>
        </div>

        <!-- Corpo Principal com Sumário Lateral e Texto -->
        <div class="lei-reader-body">
          <!-- Sumário Lateral (Capítulos / Títulos) -->
          <aside class="lei-reader-toc">
            <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">
              📑 Sumário da Lei
            </div>
            <div id="lei-toc-list" style="overflow-y:auto;max-height:calc(100vh - 160px)">
              ${(lei.toc||[]).map(t => `
                <div class="lei-toc-item" onclick="rolarParaTexto('${escapeHtml(t.title)}')">
                  ${escapeHtml(t.title)}
                </div>
              `).join('')}
            </div>
          </aside>

          <!-- Texto Integral da Lei -->
          <main class="lei-reader-text" id="lei-text-container">
            <div class="empty"><span class="big">⏳</span>Carregando texto oficial...</div>
          </main>
        </div>
      </div>
    `;

    carregarConteudoLei(lei, artigoAlvo);
  };

  async function carregarConteudoLei(lei, artigoAlvo){
    const container = document.getElementById('lei-text-container');
    if(!container) return;

    if(window.LEIS_STATE.cacheConteudo[lei.id]){
      container.innerHTML = window.LEIS_STATE.cacheConteudo[lei.id];
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
    const cleanNum = String(artNum).trim().toLowerCase().replace(/[^0-9a-z\-]/g, '');
    const target = document.getElementById('art-' + cleanNum);
    if(target){
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.remove('lei-art-highlight');
      void target.offsetWidth;
      target.classList.add('lei-art-highlight');
    } else {
      const allArts = document.querySelectorAll('.lei-artigo-card');
      let found = null;
      allArts.forEach(el => {
        if(el.dataset.artigo === artNum || el.id.includes(cleanNum)) found = el;
      });
      if(found){
        found.scrollIntoView({ behavior: 'smooth', block: 'start' });
        found.classList.add('lei-art-highlight');
      } else {
        alert('Artigo ' + artNum + ' não encontrado nesta lei.');
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
    } else {
      favs.push(artNum);
    }
    window.LEIS_STATE.favoritos[leiId] = favs;
    localStorage.setItem('aprova_leis_favoritos', JSON.stringify(window.LEIS_STATE.favoritos));
    
    const card = document.getElementById('art-' + artNum.toLowerCase().replace(/[^0-9a-z\-]/g, ''));
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

  // Copiar texto do artigo
  window.copiarArtigoTexto = function(leiId, cleanId, artNum){
    const card = document.getElementById(cleanId);
    if(!card) return;
    const lei = window.LEIS_STATE.catalogo.find(l=>l.id===leiId);
    const txt = card.innerText;
    const full = `${lei?lei.nome+' — ':''}Artigo ${artNum}:\n${txt}\n(Fonte: Aprova / Legislação)`;
    navigator.clipboard.writeText(full).then(()=>{
      alert(`Artigo ${artNum} copiado para a área de transferência!`);
    }).catch(()=>{
      alert('Não foi possível copiar automaticamente.');
    });
  };

  // Integração com Trilium Notes por artigo
  window.enviarArtigoTrilium = function(leiId, artNum){
    const lei = window.LEIS_STATE.catalogo.find(l=>l.id===leiId);
    const nomeLei = lei ? lei.nome : 'Legislação';
    const cleanId = 'art-' + artNum.toLowerCase().replace(/[^0-9a-z\-]/g, '');
    const card = document.getElementById(cleanId);
    const textoArtigo = card ? card.innerText : '';
    
    const tituloNota = `${nomeLei} — Art. ${artNum}`;
    const conteudoNota = `<p><b>${tituloNota}</b></p><pre>${escapeHtml(textoArtigo)}</pre><p><i>Anotações de estudo:</i></p><ul><li></li></ul>`;

    if(typeof window.triliumCreateNote === 'function'){
      window.triliumCreateNote(tituloNota, conteudoNota);
    } else if(typeof window.triliumOpenNote === 'function'){
      window.triliumOpenNote(tituloNota);
    } else {
      alert(`Nota pronta para o Trilium:\n\nTítulo: ${tituloNota}\n\nCopie o texto para seu caderno digital!`);
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

  // VÍNCULO PRECISO COM OS TÓPICOS DO EDITAL (ABA ESTUDOS)
  window.obterLeisParaTopico = function(nomeTopico, materiaNome){
    if(!nomeTopico) return null;
    const topico = String(nomeTopico).toLowerCase();
    
    // Normalização sem acentos para match exato
    const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const t = norm(topico);

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
    if(t.includes('prova') || t.includes('pericia') || t.includes('exame de corpo de delito')){
      return { leiId: 'cpp', nome: 'CPP (Art. 155)', art: '155' };
    }
    if(t.includes('juri') || t.includes('tribunal do juri')){
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
    if(t.includes('penas') || t.includes('privativa de liberdade') || t.includes('restritiva de direitos')){
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

    return null;
  };

  // Tecla de atalho Escape para fechar qualquer modal ou leitor
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      window.fecharModalFavoritos();
      window.fecharModalHub();
      window.fecharConfigLeisModal();
      window.fecharLeitorLei();
    }
  });

  // Inicialização ao carregar
  document.addEventListener('DOMContentLoaded', ()=>{
    carregarCatalogo();
  });
})();
