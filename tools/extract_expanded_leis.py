import os
import re
import json

LEIS_SRC = r'C:\Users\Ornilio Neto\Documents\projetos\leis-br-main'
DEST_DIR = r'c:\Users\Ornilio Neto\Documents\projetos\Aprova\assets\leis'
os.makedirs(DEST_DIR, exist_ok=True)

# Definição ampliada com o acervo completo para todos os concursos
LAWS_DEF = [
    # --- CONSTITUCIONAL E DIREITOS FUNDAMENTAIS ---
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
    
    # --- DIREITO PENAL, PROCESSUAL E EXECUÇÃO ---
    {
        'id': 'cp',
        'nome': 'Código Penal Brasileiro',
        'numero': 'Decreto-Lei 2.848/1940',
        'materia': 'Direito Penal',
        'materia_cur': 'Direito Penal',
        'categoria': 'Federal',
        'icone': '⚖️',
        'src_path': 'federal/decretos-lei/1940/del-2848-1940-12-07.md',
        'descricao': 'Parte Geral (aplicação da lei penal, crime, penas) e Parte Especial (crimes contra pessoa, patrimônio e administração pública).',
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
        'descricao': 'Inquérito policial, ação penal, provas, prisão em flagrante, preventiva, medidas cautelares e liberdade provisória.',
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
        'descricao': 'Do condenado e internado, direitos, faltas disciplinares, regimes prisionais, remição, livramento condicional e monitoração eletrônica.',
        'topicos_edital': ['Objetivo e Aplicação da LEP', 'Do Condenado e do Internado', 'Dos Deveres e Direitos do Preso', 'Da Disciplina e Faltas Disciplinares', 'Regimes Penitenciários', 'Remição de Pena', 'Livramento Condicional']
    },
    {
        'id': 'temporaria',
        'nome': 'Lei de Prisão Temporária',
        'numero': 'Lei 7.960/1989',
        'materia': 'Direito Processual Penal',
        'materia_cur': 'Processo Penal',
        'categoria': 'Federal',
        'icone': '⏳',
        'src_path': 'federal/leis-ordinarias/1989/lei-7960-1989-12-21.md',
        'descricao': 'Hipóteses de cabimento, prazos e procedimento da prisão temporária na fase de inquérito policial.',
        'topicos_edital': ['Prisão Temporária (Lei nº 7.960/1989)']
    },
    {
        'id': 'jecrim',
        'nome': 'Juizados Especiais Cíveis e Criminais',
        'numero': 'Lei 9.099/1995',
        'materia': 'Direito Processual',
        'materia_cur': 'Processual',
        'categoria': 'Federal',
        'icone': '⚖️',
        'src_path': 'federal/leis-ordinarias/1995/lei-9099-1995-09-26.md',
        'descricao': 'Infrações de menor potencial ofensivo, termo circunstanciado (TCO), transação penal, composição civil e suspensão condicional do processo.',
        'topicos_edital': ['Juizados Especiais Criminais (Lei nº 9.099/1995)', 'Transação Penal', 'Suspensão Condicional do Processo']
    },

    # --- LEGISLAÇÃO PENAL ESPECIAL / EXTRAVAGANTE ---
    {
        'id': 'abuso',
        'nome': 'Lei de Abuso de Autoridade',
        'numero': 'Lei 13.869/2019',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🚨',
        'src_path': 'federal/leis-ordinarias/2019/lei-13869-2019-09-05.md',
        'descricao': 'Crimes de abuso de autoridade cometidos por servidor público, sanções administrativas, civis e efeitos da condenação.',
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
        'descricao': 'SISNAD, crimes de posse para consumo (art. 28), tráfico ilícito (art. 33), financiamento e procedimento penal especial.',
        'topicos_edital': ['Lei de Drogas (Lei nº 11.343/2006)', 'Tráfico de Drogas']
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
        'descricao': 'Rol taxativo de crimes hediondos e equiparados, regras de progressão de regime e vedações legais.',
        'topicos_edital': ['Lei de Crimes Hediondos (Lei nº 8.072/1990)']
    },
    {
        'id': 'tortura',
        'nome': 'Lei de Tortura',
        'numero': 'Lei 9.455/1997',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🛑',
        'src_path': 'federal/leis-ordinarias/1997/lei-9455-1997-04-07.md',
        'descricao': 'Crimes de tortura em espécie, tortura por omissão, causas de aumento de pena e perda automática do cargo público.',
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
        'descricao': 'Posse e porte de arma de fogo, registro no SINARM/SIGMA, disparo, comércio ilegal e tráfico internacional.',
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
        'descricao': 'Definição de organização criminosa, colaboração premiada, ação controlada, infiltração policial e crimes da lei.',
        'topicos_edital': ['Organizações Criminosas (Lei nº 12.850/2013)', 'Colaboração Premiada']
    },
    {
        'id': 'mariapenha',
        'nome': 'Lei Maria da Penha',
        'numero': 'Lei 11.340/2006',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🟣',
        'src_path': 'federal/leis-ordinarias/2006/lei-11340-2006-08-07.md',
        'descricao': 'Violência doméstica e familiar contra a mulher, formas de violência, medidas protetivas de urgência e crime de descumprimento.',
        'topicos_edital': ['Lei Maria da Penha (Lei nº 11.340/2006)', 'Medidas Protetivas']
    },
    {
        'id': 'lavagem',
        'nome': 'Lei de Lavagem de Dinheiro',
        'numero': 'Lei 9.613/1998',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '💵',
        'src_path': 'federal/leis-ordinarias/1998/lei-9613-1998-03-03.md',
        'descricao': 'Crimes de lavagem ou ocultação de bens, direitos e valores, fases (colocação, dissimulação e integração), medidas assecuratórias e COAF.',
        'topicos_edital': ['Lei de Lavagem de Capitais (Lei nº 9.613/1998)']
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
        'descricao': 'Requisitos constitucionais, autorização judicial, prazos, renovação, captação ambiental e crime de interceptação clandestina.',
        'topicos_edital': ['Interceptação Telefônica (Lei nº 9.296/1996)']
    },
    {
        'id': 'ctb_penal',
        'nome': 'Crimes de Trânsito (CTB)',
        'numero': 'Lei 9.503/1997',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🚗',
        'src_path': 'federal/leis-ordinarias/1997/lei-9503-1997-09-23.md',
        'descricao': 'Código de Trânsito Brasileiro e crimes em espécie (homicídio culposo, embriaguez ao volante, racha, omissão de socorro).',
        'topicos_edital': ['Crimes de Trânsito no CTB (Lei nº 9.503/1997)']
    },
    {
        'id': 'ambientais',
        'nome': 'Lei de Crimes Ambientais',
        'numero': 'Lei 9.605/1998',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '🌳',
        'src_path': 'federal/leis-ordinarias/1998/lei-9605-1998-02-12.md',
        'descricao': 'Responsabilidade penal da pessoa jurídica, crimes contra a fauna, flora, poluição e administração ambiental.',
        'topicos_edital': ['Crimes Ambientais (Lei nº 9.605/1998)']
    },

    # --- DIREITO ADMINISTRATIVO, SERVIDORES E GESTÃO ---
    {
        'id': 'lei8112',
        'nome': 'Estatuto dos Servidores Federais',
        'numero': 'Lei 8.112/1990',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '👔',
        'src_path': 'federal/leis-ordinarias/1990/lei-8112-1990-12-11.md',
        'descricao': 'Provimento, vacância, direitos, vantagens, regime disciplinar (deveres, proibições, penalidades) e processo administrativo disciplinar (PAD).',
        'topicos_edital': ['Regime Jurídico dos Servidores Federais (Lei nº 8.112/1990)', 'Regime Disciplinar e PAD']
    },
    {
        'id': 'procadm',
        'nome': 'Processo Administrativo Federal',
        'numero': 'Lei 9.784/1999',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '📋',
        'src_path': 'federal/leis-ordinarias/1999/lei-9784-1999-01-29.md',
        'descricao': 'Direitos e deveres dos administrados, competência, delegação e avocação, prazos, motivação e recursos administrativos.',
        'topicos_edital': ['Processo Administrativo Federal (Lei nº 9.784/1999)']
    },
    {
        'id': 'improbidade',
        'nome': 'Lei de Improbidade Administrativa',
        'numero': 'Lei 8.429/1992',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '🏛️',
        'src_path': 'federal/leis-ordinarias/1992/lei-8429-1992-06-02.md',
        'descricao': 'Enriquecimento ilícito, prejuízo ao erário, violação a princípios, exigência de dolo (Lei 14.230/21) e sanções aplicáveis.',
        'topicos_edital': ['Improbidade Administrativa (Lei nº 8.429/1992 atualizada)']
    },
    {
        'id': 'lai',
        'nome': 'Lei de Acesso à Informação (LAI)',
        'numero': 'Lei 12.527/2011',
        'materia': 'Direito Administrativo',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '👁️',
        'src_path': 'federal/leis-ordinarias/2011/lei-12527-2011-11-18.md',
        'descricao': 'Transparência ativa e passiva, classificação de sigilo (reservada, secreta, ultrassecreta) e prazos de resposta.',
        'topicos_edital': ['Lei de Acesso à Informação (Lei nº 12.527/2011)']
    },
    {
        'id': 'lgpd',
        'nome': 'Lei Geral de Proteção de Dados (LGPD)',
        'numero': 'Lei 13.709/2018',
        'materia': 'Direito Digital',
        'materia_cur': 'Direito Administrativo',
        'categoria': 'Federal',
        'icone': '🔒',
        'src_path': 'federal/leis-ordinarias/2018/lei-13709-2018-08-14.md',
        'descricao': 'Tratamento de dados pessoais, direitos dos titulares, bases legais, princípios e sanções da ANPD.',
        'topicos_edital': ['Lei Geral de Proteção de Dados (LGPD)']
    },
    {
        'id': 'lrf',
        'nome': 'Lei de Responsabilidade Fiscal (LRF)',
        'numero': 'Lei Complementar 101/2000',
        'materia': 'Direito Financeiro',
        'materia_cur': 'Direito Financeiro',
        'categoria': 'Federal',
        'icone': '📊',
        'src_path': 'federal/leis-complementares/2000/lcp-101-2000-05-04.md',
        'descricao': 'Planejamento, receita, despesa pública, limites com despesa de pessoal, restos a pagar e transparência fiscal.',
        'topicos_edital': ['Lei de Responsabilidade Fiscal (LC nº 101/2000)']
    },

    # --- CÓDIGOS GERAIS E GRANDES ESTATUTOS ---
    {
        'id': 'cc',
        'nome': 'Código Civil Brasileiro',
        'numero': 'Lei 10.406/2002',
        'materia': 'Direito Civil',
        'materia_cur': 'Direito Civil',
        'categoria': 'Federal',
        'icone': '📖',
        'src_path': 'federal/leis-ordinarias/2002/lei-10406-2002-01-10.md',
        'descricao': 'Pessoas naturais e jurídicas, bens, fatos jurídicos, negócios jurídicos, obrigações, contratos, responsabilidade civil e família.',
        'topicos_edital': ['Direito Civil', 'Negócio Jurídico', 'Obrigações e Contratos', 'Responsabilidade Civil']
    },
    {
        'id': 'cpc',
        'nome': 'Código de Processo Civil',
        'numero': 'Lei 13.105/2015',
        'materia': 'Direito Processual Civil',
        'materia_cur': 'Processo Civil',
        'categoria': 'Federal',
        'icone': '⚖️',
        'src_path': 'federal/leis-ordinarias/2015/lei-13105-2015-03-16.md',
        'descricao': 'Normas fundamentais, competência, partes e procuradores, atos processuais, tutela provisória, procedimento comum e recursos.',
        'topicos_edital': ['Processo Civil', 'Prazos Processuais', 'Tutela Provisória', 'Recursos no CPC']
    },
    {
        'id': 'clt',
        'nome': 'Consolidação das Leis do Trabalho (CLT)',
        'numero': 'Decreto-Lei 5.452/1943',
        'materia': 'Direito do Trabalho',
        'materia_cur': 'Trabalho',
        'categoria': 'Federal',
        'icone': '👷',
        'src_path': 'federal/decretos-lei/1943/del-5452-1943-05-01.md',
        'descricao': 'Relação de emprego, jornada de trabalho, férias, salário e remuneração, rescisão contratual e processo do trabalho.',
        'topicos_edital': ['Direito do Trabalho', 'Contrato de Trabalho', 'Jornada e Salário']
    },
    {
        'id': 'ctn',
        'nome': 'Código Tributário Nacional',
        'numero': 'Lei 5.172/1966',
        'materia': 'Direito Tributário',
        'materia_cur': 'Tributário',
        'categoria': 'Federal',
        'icone': '💳',
        'src_path': 'federal/leis-ordinarias/1966/lei-5172-1966-10-25.md',
        'descricao': 'Sistema Tributário Nacional, competência tributária, obrigação tributária, fato gerador, crédito tributário e garantias.',
        'topicos_edital': ['Direito Tributário', 'Obrigação e Crédito Tributário', 'Impostos e Taxas']
    },
    {
        'id': 'cdc',
        'nome': 'Código de Defesa do Consumidor',
        'numero': 'Lei 8.078/1990',
        'materia': 'Direito do Consumidor',
        'materia_cur': 'Consumidor',
        'categoria': 'Federal',
        'icone': '🛍️',
        'src_path': 'federal/leis-ordinarias/1990/lei-8078-1990-09-11.md',
        'descricao': 'Direitos básicos do consumidor, responsabilidade pelo fato e vício do produto/serviço, práticas abusivas e crimes de consumo.',
        'topicos_edital': ['Direito do Consumidor', 'Responsabilidade pelo Vício e Fato', 'Práticas Abusivas']
    },

    # --- DIREITOS HUMANOS E ESTATUTOS PROTETIVOS ---
    {
        'id': 'eca',
        'nome': 'Estatuto da Criança e do Adolescente',
        'numero': 'Lei 8.069/1990',
        'materia': 'Legislação Específica',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Federal',
        'icone': '👶',
        'src_path': 'federal/leis-ordinarias/1990/lei-8069-1990-07-13.md',
        'descricao': 'Proteção integral, direitos fundamentais, ato infracional, medidas socioeducativas e crimes contra menores.',
        'topicos_edital': ['ECA (Lei nº 8.069/1990)', 'Medidas Socioeducativas', 'Ato Infracional']
    },
    {
        'id': 'idoso',
        'nome': 'Estatuto da Pessoa Idosa',
        'numero': 'Lei 10.741/2003',
        'materia': 'Direitos Humanos',
        'materia_cur': 'Direitos Humanos',
        'categoria': 'Federal',
        'icone': '👴',
        'src_path': 'federal/leis-ordinarias/2003/lei-10741-2003-10-01.md',
        'descricao': 'Prioridade especial, direitos à saúde, transporte, medidas protetivas e crimes contra a pessoa idosa.',
        'topicos_edital': ['Estatuto da Pessoa Idosa (Lei nº 10.741/2003)']
    },
    {
        'id': 'pcd',
        'nome': 'Estatuto da Pessoa com Deficiência',
        'numero': 'Lei 13.146/2015',
        'materia': 'Direitos Humanos',
        'materia_cur': 'Direitos Humanos',
        'categoria': 'Federal',
        'icone': '♿',
        'src_path': 'federal/leis-ordinarias/2015/lei-13146-2015-07-06.md',
        'descricao': 'Lei Brasileira de Inclusão, acessibilidade, direitos fundamentais, capacidade civil e crimes contra PCD.',
        'topicos_edital': ['Estatuto da Pessoa com Deficiência (Lei nº 13.146/2015)']
    },

    # --- REMÉDIOS CONSTITUCIONAIS E TUTELA COLETIVA ---
    {
        'id': 'ms',
        'nome': 'Lei do Mandado de Segurança',
        'numero': 'Lei 12.016/2009',
        'materia': 'Direito Constitucional',
        'materia_cur': 'Constitucional',
        'categoria': 'Federal',
        'icone': '📄',
        'src_path': 'federal/leis-ordinarias/2009/lei-12016-2009-08-07.md',
        'descricao': 'Proteção de direito líquido e certo, liminares, decadência do direito, mandado de segurança individual e coletivo.',
        'topicos_edital': ['Mandado de Segurança (Lei nº 12.016/2009)']
    },
    {
        'id': 'acp',
        'nome': 'Lei da Ação Civil Pública',
        'numero': 'Lei 7.347/1985',
        'materia': 'Direito Processual',
        'materia_cur': 'Processual',
        'categoria': 'Federal',
        'icone': '👥',
        'src_path': 'federal/leis-ordinarias/1985/lei-7347-1985-07-24.md',
        'descricao': 'Responsabilidade por danos ao meio ambiente, consumidor, patrimônio público, legitimidade ativa e inquérito civil.',
        'topicos_edital': ['Ação Civil Pública (Lei nº 7.347/1985)']
    },

    # --- LEGISLAÇÃO ESTADUAL - PERNAMBUCO (PE) ---
    {
        'id': 'constituicao_pe',
        'nome': 'Constituição do Estado de Pernambuco',
        'numero': 'Constituição Estadual PE 1989',
        'materia': 'Legislação Estadual (PE)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual PE',
        'icone': '☀️',
        'src_path': 'estaduais/PE/constituicao/1989/constituicao-pe-alepe-anotada.md',
        'descricao': 'Constituição do Estado de Pernambuco, servidores estaduais e segurança pública de PE.',
        'topicos_edital': ['Constituição do Estado de Pernambuco', 'Segurança Pública de Pernambuco']
    },
    {
        'id': 'pe_pc',
        'nome': 'Estatuto dos Policiais Civis de PE',
        'numero': 'Lei Estadual 6.425/1972',
        'materia': 'Legislação Estadual (PE)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual PE',
        'icone': '☀️',
        'src_path': 'estaduais/pe/leis-ordinarias/1972/lei-6425-1972-id11.md',
        'descricao': 'Regime jurídico peculiar aos funcionários policiais civis da Secretaria de Segurança Pública de Pernambuco.',
        'topicos_edital': ['Estatuto Policial Civil de Pernambuco (Lei nº 6.425/1972)']
    },
    {
        'id': 'pe_coj',
        'nome': 'Código de Organização Judiciária de PE',
        'numero': 'Lei Complementar 100/2007',
        'materia': 'Legislação Estadual (PE)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual PE',
        'icone': '☀️',
        'src_path': 'estaduais/pe/leis-complementares/2007/lc-100-2007-id3720.md',
        'descricao': 'Organização e divisão judiciárias do Estado de Pernambuco, competências de varas e tribunais.',
        'topicos_edital': ['Código de Organização Judiciária de PE (LC nº 100/2007)']
    },

    # --- LEGISLAÇÃO ESTADUAL - RIO GRANDE DO NORTE (RN) ---
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
        'id': 'lc566_rn',
        'nome': 'Lei Orgânica Penitenciária do RN',
        'numero': 'Lei Complementar Estadual 566/2016',
        'materia': 'Legislação Estadual (RN)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual RN',
        'icone': '👮',
        'src_path': 'estaduais/RN/leis-complementares/2016/lc-566-2016-03-02-1y4u2v82w1.md',
        'descricao': 'Cria o Sistema Penitenciário do RN, disciplina cargos e a estrutura da SEAP/RN.',
        'topicos_edital': ['Lei Complementar Estadual nº 566/2016 (RN)']
    },
    {
        'id': 'lc727_rn',
        'nome': 'Estatuto da Polícia Penal do RN',
        'numero': 'Lei Complementar Estadual 727/2022',
        'materia': 'Legislação Estadual (RN)',
        'materia_cur': 'Legislação Específica',
        'categoria': 'Estadual RN',
        'icone': '👮',
        'src_path': 'estaduais/RN/leis-complementares/2022/lc-727-2022-12-14-o3f1q3dsfw.md',
        'descricao': 'Estatuto da carreira dos Policiais Penais do RN, atribuições, direitos, prerrogativas e regime disciplinar.',
        'topicos_edital': ['Regulamento da Polícia Penal do RN (LC nº 727/2022)']
    }
]

catalog = []
artigo_regex = re.compile(r'^\s*\*\*(?:Art\.|Artigo)\s*([0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)[ºo\.]?\*\*', re.MULTILINE | re.IGNORECASE)

print(f"Total laws to process: {len(LAWS_DEF)}")

for item in LAWS_DEF:
    src_full = os.path.join(LEIS_SRC, item['src_path'])
    if not os.path.exists(src_full):
        # Tenta busca com case-insensitive para caminhos estaduais
        parts = item['src_path'].replace('\\', '/').split('/')
        cur_p = LEIS_SRC
        found = True
        for p in parts:
            if not os.path.isdir(cur_p):
                # arquivo final
                cand = [f for f in os.listdir(cur_p) if f.lower() == p.lower()]
                if cand:
                    cur_p = os.path.join(cur_p, cand[0])
                else:
                    found = False
                    break
            else:
                cand = [d for d in os.listdir(cur_p) if d.lower() == p.lower()]
                if cand:
                    cur_p = os.path.join(cur_p, cand[0])
                else:
                    found = False
                    break
        if found and os.path.exists(cur_p):
            src_full = cur_p
        else:
            print(f"WARNING: File not found for {item['id']}: {item['src_path']}")
            continue

    with open(src_full, 'r', encoding='utf-8', errors='ignore') as fp:
        raw = fp.read()

    # Parse YAML frontmatter
    yaml_meta = {}
    content = raw
    if raw.startswith('---'):
        parts = raw.split('---', 2)
        if len(parts) >= 3:
            content = parts[2].strip()
            for line in parts[1].splitlines():
                if ':' in line:
                    k, v = line.split(':', 1)
                    yaml_meta[k.strip()] = v.strip().strip('"').strip("'")

    # Clean any residual span anchors
    content = re.sub(r'<span[^>]*class=["\']lei-anchor["\'][^>]*></span>\s*', '', content)

    # Coleta de artigos
    articles_found = []
    for m in artigo_regex.finditer(content):
        art_num = m.group(1).strip()
        clean_id = art_num.lower().replace('º', '').replace('o', '').replace('.', '')
        articles_found.append({
            'num': art_num,
            'id': f"art-{clean_id}"
        })

    # Extração de Títulos e Capítulos para o Sumário Rápido
    toc = []
    for line in content.splitlines():
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

    # Salva arquivo markdown limpo em assets/leis/
    dest_filename = f"{item['id']}.md"
    dest_path = os.path.join(DEST_DIR, dest_filename)
    with open(dest_path, 'w', encoding='utf-8') as out_fp:
        out_fp.write(content)

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
        'topicos_edital': item.get('topicos_edital', []),
        'total_artigos': len(articles_found),
        'artigos_amostra': [a['num'] for a in articles_found[:15]],
        'artigos_todos': [a['num'] for a in articles_found],
        'toc': toc[:40]
    }
    catalog.append(catalog_entry)
    print(f"Extracted [OK] {item['id']} ({item['nome']}): {len(articles_found)} articles, {size_kb} KB, TOC: {len(toc)}")

# Salva catálogo geral em JSON
catalog_path = os.path.join(DEST_DIR, 'catalogo.json')
with open(catalog_path, 'w', encoding='utf-8') as cat_fp:
    json.dump(catalog, cat_fp, ensure_ascii=False, indent=2)

print(f"\nSUCCESS! Catalog generated with {len(catalog)} laws at {catalog_path}")
