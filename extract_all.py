import fitz, glob, re, os, json, unicodedata

SRC = 'pdf para extracao'
TMP = 'tmp_raw'
os.makedirs(TMP, exist_ok=True)

def norm(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()

JUNK = [
    'ornilio', '101.***', 'baixado em', 'id ', 'www.simulaprovas', 'www.simuladosbr',
    'simulaprovas.com.br', 'adquira o pacote', 'equipe simula provas',
    'simulando seu sucesso', 'folha de resposta', 'prova objetiva', 'nivel superior',
    '100 questoes', 'tempo:', 'simulado padrao instituto', 'policia penal do rio grande do norte',
    'simulado amostra – pprn', 'simuladosbr', 'simulado gratuito', 'policia penal de pe', 'ebn cursos',
]

def is_junk(line):
    s = line.strip()
    if not s:
        return True
    if re.fullmatch(r'Página\s+\d+(\s+de\s+\d+)?', s, re.I):
        return True
    if re.match(r'^SIMULADO\s+\d+', s, re.I) and not re.match(r'^SIMULADO\s+\d+\.\s', s):
        return True
    n = norm(s)
    for j in JUNK:
        if j in n:
            return True
    if re.fullmatch(r'ornilio', n) or re.fullmatch(r'\d{1,3}', s) and s.startswith('0'):
        return True
    return False

def is_gabarito_cut(line):
    s = line.strip()
    if re.match(r'^(GABARITO\s*\d+|GABARITO\s*$|Gabarito\s*$|GABARITO\s+–)', s):
        return True
    if re.match(r'^FOLHA\s+DE\s+RESPOSTA', s, re.I):
        return True
    return False

HEADER_LINES = [
    'LÍNGUA PORTUGUESA','LINGUA PORTUGUESA','PORTUGUESA','PORTUGUÊS',
    'HISTÓRIA DO RN E ASPECTOS GEOECONÔMICOS DO RN','HISTÓRIA DO RN E ASPECTOS','GEOECONÔMICOS DO RN',
    'HISTÓRIA E ASPECTOS GEOECONÔMICOS DO RN','HISTÓRIA E ASPECTOS','HISTÓRIA DO RN','HISTORIA E ASPECTOS GEOECONOMICOS',
    'HISTORIA E ASPECTOS GEOECONOMICOS DO RN','HIST. E ASPECTOS GEO',
    'ÉTICA NO SERVIÇO PÚBLICO','ÉTICA','ETICA',
    'DIREITO CONSTITUCIONAL','CONSTITUCIONAL','DIR. CONSTITUCIONAL',
    'DIREITO ADMINISTRATIVO','D. ADMINISTRATIVO','DIR. ADMINISTRATIVO','DIREITO ADM',
    'DIREITOS HUMANOS','D. HUMANOS','DIR. HUMANOS','DH',
    'EXECUÇÃO PENAL','EXEC. PENAL','LEP','EXECUCAO PENAL','LEI DE EXECUÇÃO PENAL – LEP','LEI DE EXECUÇÃO PENAL - LEP',
    'LEI DE EXECUCAO PENAL - LEP','EXECUÇÃO PENAL – LEP','EXECUÇÃO PENAL - LEP','EXECUCAO PENAL - LEP',
    'LEGISLAÇÃO ESPECÍFICA','LEG. ESPECÍFICA','LEIS ESPECIAIS','LEGISLACAO ESPECIFICA','LEIS COMPLEMENTARES Nº 122/566',
    'LEGISLAÇÃO ESTADUAL','LEGISLAÇÃO ESPECIAL','LEGISLACAO ESTADUAL','LEGISLACAO ESPECIAL',
    'NOÇÕES DE INFORMÁTICA','NOCOES DE INFORMATICA','RACIOCÍNIO LÓGICO','RACIOCINIO LOGICO',
    'NOÇÕES DE DIREITOS HUMANOS E PARTICIPAÇÃO SOCIAL','NOÇÕES DE DIREITOS HUMANOS E PARTICIPAÇÃO',
    'NOCOES DE DIREITOS HUMANOS E PARTICIPACAO','SOCIAL','DISCURSIVA',
    'DIREITO PENAL E PROCESSO PENAL','D. PENAL E PROCESSO PENAL','PENAL E PROCESSO','DIREITO PENAL',
    'PROCESSUAL PENAL','DIREITO PROCESSUAL PENAL','DIR. PROCESSUAL PENAL','D. PROCESSUAL PENAL',
    'PENAL','DIR. PENAL','D. PENAL'
]
HEADER_NORMS = {norm(h) for h in HEADER_LINES}

HEADER_IDS = {}
for _h in HEADER_LINES:
    n = norm(_h)
    if 'lingua portuguesa' in n or n == 'portuguesa' or n == 'portugues': HEADER_IDS[n] = 'port'
    elif 'historia' in n or 'aspectos geo' in n or 'geoeconomicos' in n: HEADER_IDS[n] = 'hist'
    elif 'legislacao estadual' in n or n == 'leg. estadual': HEADER_IDS[n] = 'lest'
    elif 'noções de informática' in n or 'nocoes de informatica' in n or n == 'informatica': HEADER_IDS[n] = 'info'
    elif 'raciocínio lógico' in n or 'raciocinio logico' in n or n == 'logica': HEADER_IDS[n] = 'log'
    elif 'processual' in n or n == 'proc': HEADER_IDS[n] = 'proc'
    elif 'etica' in n: HEADER_IDS[n] = 'eti'
    elif 'constitucional' in n or n == 'const': HEADER_IDS[n] = 'const'
    elif 'administrativo' in n or n == 'adm': HEADER_IDS[n] = 'adm'
    elif 'direitos humanos' in n or n == 'dh' or n == 'd. humanos' or n == 'dir. humanos': HEADER_IDS[n] = 'dh'
    elif 'execucao penal' in n or 'lep' in n or n == 'exec. penal': HEADER_IDS[n] = 'exec'
    elif 'legislacao' in n or 'leis' in n or n == 'leg. especifica' or n == 'especial': HEADER_IDS[n] = 'lesp'
    elif 'penal' in n or n == 'pen': HEADER_IDS[n] = 'pen'

LAYOUTS = {
    'pprn': {'port':[1,15],'hist':[16,20],'eti':[21,25],'const':[26,35],'adm':[36,45],'dh':[46,55],'exec':[56,70],'lesp':[71,90],'pen':[91,100]},
    'v-simulado': {'port':[1,15],'eti':[16,20],'hist':[21,25],'const':[26,35],'pen':[36,45],'adm':[46,55],'lesp':[56,75],'dh':[76,85],'exec':[86,100]},
    'ii-simulado': {'port':[1,15],'eti':[16,20],'hist':[21,25],'adm':[26,35],'const':[36,45],'pen':[46,55],'lesp':[56,75],'dh':[76,85],'exec':[86,100]},
    'PPPE-PREEDITAL': {'port':[1,8],'lest':[9,12],'eti':[13,14],'info':[15,17],'log':[18,20],'adm':[21,25],'const':[26,29],'pen':[30,34],'proc':[35,39],'lesp':[40,44],'exec':[45,54],'dh':[55,60]},
}

def is_subject_header(line):
    return norm(line.strip()) in HEADER_NORMS

def detect_layout(lines):
    """Detecta o layout pelas linhas de matéria encontradas + próxima questão."""
    pairs = []
    qpat = re.compile(r'^(?:(\d{1,3})\s*[.)]|(\d{1,2}|100)\s*$)')
    for i, l in enumerate(lines):
        s = l.strip()
        n = norm(s)
        if n not in HEADER_IDS: continue
        if len(s) < 3: continue
        nxt = None
        for x in lines[i+1:i+60]:
            m = qpat.match(x.strip())
            if m:
                nxt = int(m.group(1) or m.group(2))
                break
        if nxt:
            pairs.append((HEADER_IDS[n], nxt))
    best, bestScore = 'pprn', -1
    for lid, faixas in LAYOUTS.items():
        score = 0
        for sid, q in pairs:
            for mat, (lo, hi) in faixas.items():
                if lo <= q <= hi:
                    if mat == sid: score += 1
                    else: score -= 1
                    break
        if score > bestScore:
            best, bestScore = lid, score
    return best, pairs

def extract_pdf_text(doc):
    """Extrai o texto por página, pulando páginas que são tabelas de gabarito
    (muitos números, poucas letras A-E e marcador GABARITO)."""
    out = []
    for p in doc:
        t = p.get_text('text')
        nums = len(re.findall(r'^\d{1,3}\s*$', t, re.M))
        lets = len(re.findall(r'^\s*[A-Ea-e]\s*$', t, re.M))
        if nums >= 40 and lets < 5 and re.search(r'GABARITO', t, re.I):
            continue
        out.append(t)
    return '\n'.join(out)

def strip_comentarios(lines, gab):
    """Simulado_09: remove seções 'Comentário' até 'Gabarito: X' (ou próxima questão).
    Resposta: 'Gabarito: X' ou fallback pela única alternativa marcada 'Correta'."""
    out = []
    skip = False
    last_q = None
    correta = None
    for raw in lines:
        s = raw.strip()
        m = re.match(r'^(\d{1,2}|100)\.(?:\s|$)', s)
        if m:
            if skip and last_q and last_q not in gab and correta:
                gab[last_q] = correta
            last_q = int(m.group(1))
            skip = False
            correta = None
        if re.match(r'^Coment[áa]rio\b', s, re.I):
            skip = True
            continue
        if skip:
            m = re.match(r'^([A-Ea-e])\s*\)\s*Correta\b', s, re.I)
            if m:
                correta = m.group(1).lower()
            m = re.match(r'^Gabarito\s*:?\s*([A-Ea-e])\b', s, re.I)
            if m:
                if last_q and last_q not in gab:
                    gab[last_q] = m.group(1).lower()
                skip = False
                correta = None
            continue
        out.append(raw)
    if skip and last_q and last_q not in gab and correta:
        gab[last_q] = correta
    return out

def strip_gabarito_comentario(lines, gab):
    """Mansão comentado: 'Gabarito: X' inicia o comentário (ignorado até a próxima questão)."""
    out = []
    skip = False
    last_q = None
    for raw in lines:
        s = raw.strip()
        m = re.match(r'^(\d{1,2}|100)\.(?:\s|$)', s)
        if m:
            last_q = int(m.group(1))
            skip = False
            out.append(raw)
            continue
        if skip:
            continue
        m = re.match(r'^Gabarito\s*:?\s*\(?\s*([A-Ea-e])', s, re.I)
        if m and last_q and last_q not in gab:
            gab[last_q] = m.group(1).lower()
            skip = True
            continue
        out.append(raw)
    return out

def inline_gabarito(lines):
    gab = {}
    last_q = None
    for raw in lines:
        s = raw.strip()
        m = re.match(r'^(\d{1,2}|100)\.(?:\s|$)', s)
        if m:
            last_q = int(m.group(1))
            continue
        m = re.match(r'^QUEST[AÃ]O\s*:?\s*(\d{1,3})(?:\s*/\s*\d{1,3})?', s, re.I)
        if m:
            last_q = int(m.group(1))
            continue
        m = re.match(r'^(?:Gabarito|GABARITO|ALTERNATIVA\s+CORRETA)\s*:?\s*\(?\s*([A-Ea-e])\s*\)?', s)
        if m and last_q and last_q not in gab:
            gab[last_q] = m.group(1).lower()
    return gab

def table_gabarito(doc):
    """Tabela final: tokens numeros/letras em paginas com GABARITO/FOLHA DE RESPOSTA."""
    pages = []
    for i, p in enumerate(doc):
        orig = p.get_text('text')
        has_marker = re.search(r'GABARITO', orig, re.I) or re.search(r'FOLHA\s+DE\s+RESPOSTA', orig, re.I)
        t = '\n'.join(l for l in orig.split('\n') if not re.match(r'^\s*GABARITO\s*\d+', l, re.I))
        toks = [w for w in t.split() if re.fullmatch(r'\d{1,3}', w) or re.fullmatch(r'[A-Ea-e]', w)]
        if len(toks) >= 20 and has_marker:
            pages.append(toks)
    if not pages:
        for p in doc[-2:]:
            t = p.get_text('text')
            pages.append([w for w in t.split() if re.fullmatch(r'\d{1,3}', w) or re.fullmatch(r'[A-Ea-e]', w)])
    tokens = [w for pg in pages for w in pg]
    if not tokens:
        return {}
    gab = {}
    if re.fullmatch(r'\d{1,3}', tokens[0]) and re.fullmatch(r'[A-Ea-e]', tokens[1]):
        for i in range(0, len(tokens) - 1, 2):
            n, l = tokens[i], tokens[i + 1]
            if re.fullmatch(r'\d{1,3}', n) and re.fullmatch(r'[A-Ea-e]', l):
                q = int(n)
                if 1 <= q <= 100:
                    gab[q] = l.lower()
        return gab
    nums, lets = [], []
    for w in tokens:
        if re.fullmatch(r'\d{1,3}', w):
            nums.append(int(w))
        elif re.fullmatch(r'[A-Ea-e]', w):
            lets.append(w.lower())
    if nums and len(nums) == len(lets):
        return {n: l for n, l in zip(nums, lets)}
    return {}

def process(pdf):
    base = os.path.splitext(os.path.basename(pdf))[0]
    doc = fitz.open(pdf)
    text = extract_pdf_text(doc)
    lines = text.split('\n')

    layout_id, pairs = detect_layout(lines)

    gab = inline_gabarito(lines)
    is_comentado = len(gab) >= 50
    if is_comentado:
        n_coment = len(re.findall(r'^Coment[áa]rio\b', text, re.M | re.I))
        if n_coment >= 50:
            gab2 = {}
            lines = strip_comentarios(lines, gab2)
            gab = gab2 if len(gab2) >= 50 else gab
        else:
            gab2 = {}
            lines = strip_gabarito_comentario(lines, gab2)
            gab = gab2 if len(gab2) >= 50 else gab

    out = []
    for raw in lines:
        s = raw.rstrip()
        st = s.strip()
        if is_junk(st):
            continue
        if is_gabarito_cut(st):
            break
        if norm(st) == 'discursiva':
            break
        if is_subject_header(st):
            continue
        out.append(st)

    marcadores = set()
    for l in out:
        m = re.match(r'^(\d{1,2}|100)\s*[.)]', l)
        if m:
            marcadores.add(int(m.group(1)))
    tem_questao = len(marcadores) >= 20
    out2 = []
    for l in out:
        m = re.match(r'^\(([A-Ea-e])\)\s*(.*)$', l)
        if m:
            out2.append(m.group(1).upper() + ') ' + m.group(2))
            continue
        m = re.match(r'^([A-E])\s{2,}(.*)$', l)
        if m:
            out2.append(m.group(1) + ') ' + m.group(2))
            continue
        m = re.match(r'^([A-E])\s*$', l)
        if m:
            out2.append(m.group(1) + ')')
            continue
        m = re.match(r'^(\d{1,2}|100)$', l)
        if m and tem_questao and int(m.group(1)) not in marcadores:
            out2.append(m.group(1) + '.')
            continue
        out2.append(l)
    out = out2

    raw_txt = '\n'.join(out) + '\n'
    with open(os.path.join(TMP, base + '.txt'), 'w', encoding='utf-8') as f:
        f.write(raw_txt)

    if len(gab) < 100:
        t = table_gabarito(doc)
        if len(t) > len(gab):
            gab = t
    with open(os.path.join(TMP, base + '.gab.json'), 'w', encoding='utf-8') as f:
        json.dump({str(k): v for k, v in gab.items()}, f, ensure_ascii=False)
    with open(os.path.join(TMP, base + '.layout.json'), 'w', encoding='utf-8') as f:
        json.dump({'id': layout_id, 'faixas': LAYOUTS[layout_id], 'pairs': pairs}, f, ensure_ascii=False)

    falt = [q for q in range(1, 101) if q not in gab]
    nq = len(re.findall(r'^\d{1,3}\. ', raw_txt, re.M))
    print(f'{base}')
    print(f'  layout: {layout_id} | questoes no txt: {nq} | gabarito: {len(gab)} respostas | faltando: {falt if falt else "nenhuma"}')
    doc.close()

if __name__ == '__main__':
    import sys
    folder = sys.argv[1] if len(sys.argv) > 1 else SRC
    for pdf in sorted(glob.glob(os.path.join(folder, '*.pdf'))):
        process(pdf)