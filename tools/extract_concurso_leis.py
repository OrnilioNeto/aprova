import os
import re
import json
import shutil

LEIS_SRC = r'C:\Users\Ornilio Neto\Documents\projetos\leis-br-main'
DEST_DIR = r'c:\Users\Ornilio Neto\Documents\projetos\Aprova\assets\leis'
os.makedirs(DEST_DIR, exist_ok=True)

# Definição das leis do concurso e mapeamento
LAWS_DEF = [
    {
        'id': 'cf88',
        'nome': 'Constituição Federal de 1988',
        'numero': 'CF/1988',
        'materia': 'Direito Constitucional',
        'materia_cur': 'Constitucional',
        'categoria': 'Federal',
        'icone': '📜',
        'src_path': 'constituicao.md',
        'descricao': 'Normas fundamentais, direitos e garantias fundamentais, segurança pública (Art. 144) e administração pública.',
        'topicos_edital': ['Direitos e Garantias Fundamentais', 'Segurança Pública (Art. 144)', 'Administração Pública', 'Organização dos Poderes']
    },
    {
        'id': 'cp',
        'nome': 'Código Penal Brasileiro',
        'numero': 'Decreto-Lei 2.848/1940',
        'materia': 'Direito Penal',
        'materia_cur': 'Direito Penal',
        'categoria': 'Federal',
        'icone': '⚖️',
        'src_path': 'federal/decretos-lei/1940/del-2848-1940-12-07.md',
        'descricao': 'Parte Geral (aplicação da lei penal, crime, imputabilidade, penas) e Parte Especial (crimes contra a pessoa, patrimônio e administração pública).',
        'topicos_edital': ['Aplicação da Lei Penal', 'Do Crime', 'Das Penas', 'Crimes contra a Pessoa', 'Crimes contra o Patrimônio', 'Crimes contra a Administração Pública']
    },
    {
        'id': 'cpp',
        'nome': 'Código de Processo Penal',
        'numero': 'Decreto-Lei 3.689/1941',
        'materia': 'Direito Processual Penal',
        'materia_cur': 'Processo Penal',
        'categoria': 'Federal',
        'icone': '🛡️',
        'src_path': 'federal/decretos-lei/1941/del-3689-1941-10-03.md',
        'descricao': 'Inquérito policial, ação penal, provas, prisão em flagrante, preventiva e temporária.',
        'topicos_edital': ['Inquérito Policial', 'Ação Penal', 'Da Prova', 'Prisão e Liberdade Provisória', 'Prisão em Flagrante']
    },
    {
        'id': 'lep',
        'nome': 'Lei de Execução Penal (LEP)',
        'numero': 'Lei 7.210/1984',
        'materia': 'Execução Penal',
        'materia_cur': 'Execução Penal',
        'categoria': 'Federal',
        'icone': '⛓️',
        'src_path': 'federal/leis-ordinarias/1984/lei-7210-1984-07-11.md',
        'descricao': 'Do condenado e do internado, direitos e deveres, disciplina, regimes prisionais, saídas temporárias, remição e livramento condicional.',
        'topicos_edital': ['Objetivo e Aplicação da LEP', 'Do Condenado e do Internado', 'Dos Deveres e Direitos do Preso', 'Da Disciplina e Faltas Disciplinares', 'Regimes Penitenciários', 'Dos Estabelecimentos Penais', 'Da Execução das Penas em Espécie', 'Remição de Pena', 'Livramento Condicional']
    },
    {
        'id': 'abuso',
        'nome': 'Lei de Abuso de Autoridade',
        'numero': 'Lei 13.869/2019',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🚨',
        'src_path': 'federal/leis-ordinarias/2019/lei-13869-2019-09-05.md',
        'descricao': 'Crimes de abuso de autoridade cometidos por servidor público, penalidades e efeitos da condenação.',
        'topicos_edital': ['Lei de Abuso de Autoridade (Lei nº 13.869/2019)']
    },
    {
        'id': 'drogas',
        'nome': 'Lei de Drogas',
        'numero': 'Lei 11.343/2006',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '💊',
        'src_path': 'federal/leis-ordinarias/2006/lei-11343-2006-08-23.md',
        'descricao': 'Sistema Nacional de Políticas Públicas sobre Drogas, crimes e penas (tráfico, usuário, financiamento).',
        'topicos_edital': ['Lei de Drogas (Lei nº 11.343/2006)']
    },
    {
        'id': 'hediondos',
        'nome': 'Lei dos Crimes Hediondos',
        'numero': 'Lei 8.072/1990',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '☠️',
        'src_path': 'federal/leis-ordinarias/1990/lei-8072-1990-07-25.md',
        'descricao': 'Rol de crimes hediondos, progressão de regime diferenciada, vedação a anistia e indulto.',
        'topicos_edital': ['Lei de Crimes Hediondos (Lei nº 8.072/1990)']
    },
    {
        'id': 'tortura',
        'nome': 'Lei de Tortura',
        'numero': 'Lei 9.455/1997',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🚫',
        'src_path': 'federal/leis-ordinarias/1997/lei-9455-1997-04-07.md',
        'descricao': 'Definição dos crimes de tortura, aumento de pena, perda do cargo e inafiançabilidade.',
        'topicos_edital': ['Lei de Tortura (Lei nº 9.455/1997)']
    },
    {
        'id': 'desarmamento',
        'nome': 'Estatuto do Desarmamento',
        'numero': 'Lei 10.826/2003',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🔫',
        'src_path': 'federal/leis-ordinarias/2003/lei-10826-2003-12-22.md',
        'descricao': 'Posse e porte de arma de fogo de uso permitido e restrito, disparos e comércio ilegal.',
        'topicos_edital': ['Estatuto do Desarmamento (Lei nº 10.826/2003)']
    },
    {
        'id': 'orcrim',
        'nome': 'Lei de Organizações Criminosas',
        'numero': 'Lei 12.850/2013',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '👥',
        'src_path': 'federal/leis-ordinarias/2013/lei-12850-2013-08-02.md',
        'descricao': 'Conceito de organização criminosa, colaboração premiada, ação controlada e infiltração de policiais.',
        'topicos_edital': ['Lei das Organizações Criminosas (Lei nº 12.850/2013)']
    },
    {
        'id': 'mariapenha',
        'nome': 'Lei Maria da Penha',
        'numero': 'Lei 11.340/2006',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '👩',
        'src_path': 'federal/leis-ordinarias/2006/lei-11340-2006-08-07.md',
        'descricao': 'Violência doméstica e familiar contra a mulher, medidas protetivas de urgência e assistência.',
        'topicos_edital': ['Lei Maria da Penha (Lei nº 11.340/2006)']
    },
    {
        'id': 'interceptacao',
        'nome': 'Lei de Interceptação Telefônica',
        'numero': 'Lei 9.296/1996',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '📞',
        'src_path': 'federal/leis-ordinarias/1996/lei-9296-1996-07-24.md',
        'descricao': 'Requisitos da interceptação de comunicações telefônicas e telemáticas para prova em investigação criminal.',
        'topicos_edital': ['Lei de Interceptação Telefônica (Lei nº 9.296/1996)']
    },
    {
        'id': 'improbidade',
        'nome': 'Lei de Improbidade Administrativa',
        'numero': 'Lei 8.429/1992 (com alterações da 14.230/21)',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '🏛️',
        'src_path': 'federal/leis-ordinarias/1992/lei-8429-1992-06-02.md',
        'descricao': 'Atos que importam enriquecimento ilícito, prejuízo ao erário e atentam contra os princípios da administração pública.',
        'topicos_edital': ['Improbidade Administrativa (Lei nº 8.429/1992)']
    },
    {
        'id': 'procadm',
        'nome': 'Processo Administrativo Federal',
        'numero': 'Lei 9.784/1999',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '📑',
        'src_path': 'federal/leis-ordinarias/1999/lei-9784-1999-01-29.md',
        'descricao': 'Normas básicas sobre o processo administrativo no âmbito da Administração Federal direta e indireta.',
        'topicos_edital': ['Processo Administrativo (Lei nº 9.784/1999)']
    },
    {
        'id': 'lai',
        'nome': 'Lei de Acesso à Informação (LAI)',
        'numero': 'Lei 12.527/2011',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': 'ℹ️',
        'src_path': 'federal/leis-ordinarias/2011/lei-12527-2011-11-18.md',
        'descricao': 'Procedimentos a serem observados pela União, Estados, DF e Municípios para garantia do acesso a informações.',
        'topicos_edital': ['Acesso à Informação (Lei nº 12.527/2011)']
    },
    {
        'id': 'licitacoes',
        'nome': 'Nova Lei de Licitações e Contratos',
        'numero': 'Lei 14.133/2021',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '💼',
        'src_path': 'federal/leis-ordinarias/2021/lei-14133-2021-04-01.md',
        'descricao': 'Normas gerais de licitação e contratação para a Administração Pública direta, autárquica e fundacional.',
        'topicos_edital': ['Licitações e Contratos Administrativos (Lei nº 14.133/2021)']
    },
    {
        'id': 'ctb_penal',
        'nome': 'Crimes de Trânsito (CTB)',
        'numero': 'Lei 9.503/1997 (Capítulo XIX)',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🚗',
        'src_path': 'federal/leis-ordinarias/1997/lei-9503-1997-09-23.md',
        'descricao': 'Crimes em espécie cometidos na direção de veículo automotor (arts. 291 a 312-B).',
        'topicos_edital': ['Crimes de Trânsito no CTB (Lei nº 9.503/1997)']
    },
    {
        'id': 'eca',
        'nome': 'Estatuto da Criança e do Adolescente (ECA)',
        'numero': 'Lei 8.069/1990',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '👶',
        'src_path': 'federal/leis-ordinarias/1990/lei-8069-1990-07-13.md',
        'descricao': 'Proteção integral, medidas socioeducativas, apuração de ato infracional e crimes praticados contra crianças/adolescentes.',
        'topicos_edital': ['Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)']
    },
    {
        'id': 'lavagem',
        'nome': 'Lei de Lavagem de Dinheiro',
        'numero': 'Lei 9.613/1998',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '💰',
        'src_path': 'federal/leis-ordinarias/1998/lei-9613-1998-03-03.md',
        'descricao': 'Crimes de lavagem ou ocultação de bens, direitos e valores, medidas assecuratórias e COAF.',
        'topicos_edital': ['Lei de Lavagem de Capitais (Lei nº 9.613/1998)']
    },
    {
        'id': 'constituicao_rn',
        'nome': 'Constituição do Estado do Rio Grande do Norte',
        'numero': 'Constituição Estadual RN 1989',
        'materia': 'Legislação Estadual (RN)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual RN',
        'icone': '🌴',
        'src_path': 'estaduais/RN/constituicao/1989/constituicao-rn.md',
        'descricao': 'Normas constitucionais do Rio Grande do Norte, servidores públicos estaduais e segurança pública estadual.',
        'topicos_edital': ['Constituição do Estado do Rio Grande do Norte', 'Segurança Pública do RN']
    },
    {
        'id': 'lc727_rn',
        'nome': 'Estatuto da Polícia Penal do Rio Grande do Norte',
        'numero': 'Lei Complementar Estadual 727/2022',
        'materia': 'Legislação Estadual (RN)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual RN',
        'icone': '👮',
        'src_path': 'estaduais/RN/leis-complementares/2022/lc-727-2022-12-14-o3f1q3dsfw.md',
        'descricao': 'Estatuto da carreira dos Policiais Penais do RN, atribuições, direitos, prerrogativas, regime disciplinar e hierarquia.',
        'topicos_edital': ['Regulamento da Polícia Penal do RN (LC nº 727/2022)', 'Regime Disciplinar Penitenciário']
    },
    {
        'id': 'constituicao_pe',
        'nome': 'Constituição do Estado de Pernambuco',
        'numero': 'Constituição Estadual PE 1989',
        'materia': 'Legislação Estadual (PE)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual PE',
        'icone': '☀️',
        'src_path': 'estaduais/PE/constituicao/1989/constituicao-pe-alepe-anotada.md',
        'descricao': 'Constituição do Estado de Pernambuco anotada pela ALEPE, servidores estaduais e segurança pública de PE.',
        'topicos_edital': ['Constituição do Estado de Pernambuco', 'Segurança Pública de Pernambuco']
    }
]

catalog = []
artigo_regex = re.compile(r'^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*', re.MULTILINE | re.IGNORECASE)
titulo_cap_regex = re.compile(r'^(#{1,4})\s+(.*)$', re.MULTILINE)

print(f'Starting extraction of {len(LAWS_DEF)} laws...')

for item in LAWS_DEF:
    src_full = os.path.join(LEIS_SRC, item['src_path'])
    if not os.path.exists(src_full):
        print(f"[WARN] File not found: {src_full}")
        continue
    
    with open(src_full, 'r', encoding='utf-8', errors='ignore') as fp:
        raw_text = fp.read()
    
    # Process YAML frontmatter
    yaml_meta = {}
    content = raw_text
    if raw_text.startswith('---'):
        parts = raw_text.split('---', 2)
        if len(parts) >= 3:
            yaml_raw = parts[1]
            content = parts[2].strip()
            for line in yaml_raw.strip().split('\n'):
                if ':' in line:
                    k, v = line.split(':', 1)
                    yaml_meta[k.strip()] = v.strip().strip('"').strip("'")

    # Clean markdown and add article anchors
    # We will insert `<a id="art-X"></a>` before each article
    articles_found = []
    
    def repl_art(m):
        art_num = m.group(1).strip()
        # normalize: 1º, 1-A -> clean id
        clean_id = art_num.lower().replace('º', '').replace('o', '').replace('.', '')
        articles_found.append({
            'num': art_num,
            'id': f"art-{clean_id}"
        })
        return m.group(0)

    processed_content = artigo_regex.sub(repl_art, content)
    
    # Extract structure: Titulos and Capitulos for fast Table of Contents
    toc = []
    for line in content.split('\n'):
        line_clean = line.strip()
        if line_clean.startswith('#'):
            m = re.match(r'^(#{1,4})\s+(.+)$', line_clean)
            if m:
                level = len(m.group(1))
                heading = m.group(2).strip().replace('*', '')
                if any(w in heading.upper() for w in ['TÍTULO', 'TITULO', 'CAPÍTULO', 'CAPITULO', 'SEÇÃO', 'SECAO', 'LIVRO', 'PARTE']):
                    toc.append({
                        'level': level,
                        'title': heading
                    })

    # Save processed file into assets/leis/
    dest_filename = f"{item['id']}.md"
    dest_path = os.path.join(DEST_DIR, dest_filename)
    with open(dest_path, 'w', encoding='utf-8') as out_fp:
        out_fp.write(processed_content)
    
    size_kb = round(os.path.getsize(dest_path) / 1024, 1)

    catalog_entry = {
        'id': item['id'],
        'nome': item['nome'],
        'numero': item['numero'],
        'materia': item['materia'],
        'materia_cur': item['materia_cur'],
        'categoria': item['categoria'],
        'icone': item['icone'],
        'descricao': item['descricao'],
        'arquivo': f"assets/leis/{dest_filename}",
        'size_kb': size_kb,
        'fonte': yaml_meta.get('fonte', ''),
        'urn': yaml_meta.get('urn', ''),
        'topicos_edital': item['topicos_edital'],
        'total_artigos': len(articles_found),
        'artigos_amostra': [a['num'] for a in articles_found[:15]],
        'artigos_todos': [a['num'] for a in articles_found],
        'toc': toc[:30] # Top 30 sections for table of contents
    }
    catalog.append(catalog_entry)
    print(f"Extracted [OK] {item['id']} ({item['nome']}): {len(articles_found)} articles, {size_kb} KB, TOC: {len(toc)} sections")

# Save catalog JSON
catalog_path = os.path.join(DEST_DIR, 'catalogo.json')
with open(catalog_path, 'w', encoding='utf-8') as cat_fp:
    json.dump(catalog, cat_fp, ensure_ascii=False, indent=2)

print(f"\nSUCCESS! Catalog generated with {len(catalog)} laws at {catalog_path}")
