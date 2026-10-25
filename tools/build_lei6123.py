import urllib.request
import re
import html
import json
import os

url = 'https://legis.alepe.pe.gov.br/texto.aspx?id=10727&tipo=TEXTOATUALIZADO'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

print("1. Baixando Lei 6.123/1968 de ALEPE...")
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=30) as resp:
    raw_html = resp.read().decode('utf-8', 'ignore')

p1 = raw_html.find('WordSection1')
if p1 == -1:
    p1 = raw_html.find('LEI Nº 6.123')

p2 = raw_html.find('<div id="nota">', p1)
if p2 == -1:
    p2 = raw_html.find('id="nota"', p1)

body = raw_html[p1:p2] if p2 != -1 else raw_html[p1:]

paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', body, flags=re.DOTALL | re.IGNORECASE)
print(f"Total de blocos <p>: {len(paragraphs)}")

raw_chunks = []
for p in paragraphs:
    p_text = re.sub(r'<br\s*/?>', ' ', p, flags=re.IGNORECASE)
    p_text = re.sub(r'<[^>]+>', '', p_text)
    p_text = html.unescape(p_text)
    p_text = p_text.replace('\xa0', ' ')
    p_text = ' '.join(p_text.split())
    if p_text:
        raw_chunks.append(p_text)

print(f"Total de chunks limpos: {len(raw_chunks)}")

# Now let's structure the markdown
md_lines = [
    "# Lei Ordinária nº 6.123/1968",
    "",
    "**LEI Nº 6.123, DE 20 DE JULHO DE 1968.**",
    "",
    "(Republicada em 13/3/1973)",
    "",
    "Contém o Estatuto dos Funcionários Públicos Civis do Estado de Pernambuco.",
    "",
    "**O GOVERNADOR DO ESTADO DE PERNAMBUCO:**",
    "",
    "Faço saber que a Assembléia Legislativa decretou e eu sanciono a seguinte Lei:",
    ""
]

toc = []
artigos_todos = []
artigos_amostra = []

# Regular expressions for structure
re_livro = re.compile(r'^(LIVRO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?)$', re.IGNORECASE)
re_titulo = re.compile(r'^(TÍTULO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?)$', re.IGNORECASE)
re_capitulo = re.compile(r'^(CAPÍTULO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?)$', re.IGNORECASE)
re_secao = re.compile(r'^(SEÇÃO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?)$', re.IGNORECASE)
re_subsecao = re.compile(r'^(SUBSEÇÃO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?)$', re.IGNORECASE)
re_artigo = re.compile(r'^(Art\.\s*(\d+[-A-Za-z0-9]*)\.?\s*º?\.?)\s*(.*)', re.IGNORECASE)
re_paragrafo = re.compile(r'^(§\s*\d+º?\.?|Parágrafo\s+único\.?)\s*(.*)', re.IGNORECASE)

i = 0
# skip preamble lines up to TÍTULO I
while i < len(raw_chunks):
    if raw_chunks[i].upper().startswith("TÍTULO") or raw_chunks[i].upper().startswith("LIVRO"):
        break
    i += 1

while i < len(raw_chunks):
    chunk = raw_chunks[i]
    upper = chunk.upper()

    # Check for Livro / Título / Capítulo / Seção
    # Sometimes title number and title description are consecutive chunks (e.g. "TÍTULO I" then "DISPOSIÇÕES PRELIMINARES")
    if upper.startswith("LIVRO"):
        title_text = chunk
        if i + 1 < len(raw_chunks) and not any(raw_chunks[i+1].upper().startswith(x) for x in ["TÍTULO", "CAPÍTULO", "SEÇÃO", "ART."]):
            title_text += f" — {raw_chunks[i+1]}"
            i += 1
        md_lines.append(f"## {title_text}")
        md_lines.append("")
        toc.append({"level": 2, "title": title_text})
        i += 1
        continue

    if upper.startswith("TÍTULO"):
        title_text = chunk
        if i + 1 < len(raw_chunks) and not any(raw_chunks[i+1].upper().startswith(x) for x in ["TÍTULO", "CAPÍTULO", "SEÇÃO", "ART."]):
            title_text += f" — {raw_chunks[i+1]}"
            i += 1
        md_lines.append(f"### {title_text}")
        md_lines.append("")
        toc.append({"level": 3, "title": title_text})
        i += 1
        continue

    if upper.startswith("CAPÍTULO"):
        title_text = chunk
        if i + 1 < len(raw_chunks) and not any(raw_chunks[i+1].upper().startswith(x) for x in ["TÍTULO", "CAPÍTULO", "SEÇÃO", "ART."]):
            title_text += f" — {raw_chunks[i+1]}"
            i += 1
        md_lines.append(f"#### {title_text}")
        md_lines.append("")
        toc.append({"level": 4, "title": title_text})
        i += 1
        continue

    if upper.startswith("SEÇÃO"):
        title_text = chunk
        if i + 1 < len(raw_chunks) and not any(raw_chunks[i+1].upper().startswith(x) for x in ["TÍTULO", "CAPÍTULO", "SEÇÃO", "ART."]):
            title_text += f" — {raw_chunks[i+1]}"
            i += 1
        md_lines.append(f"##### {title_text}")
        md_lines.append("")
        toc.append({"level": 5, "title": title_text})
        i += 1
        continue

    # Check for Artigo
    m_art = re_artigo.match(chunk)
    if m_art:
        art_full = m_art.group(1).strip()
        art_num = m_art.group(2).strip()
        art_body = m_art.group(3).strip()
        
        # Standardize format: **Art. Xº** (1-9) or **Art. X.** (>=10)
        art_clean_label = f"Art. {art_num}º" if art_num.isdigit() and int(art_num) <= 9 else f"Art. {art_num}."
        art_body = re.sub(r'^[°º\.]+\s*', '', art_body).strip()
        
        line = f"**{art_clean_label}** {art_body}".strip()
        md_lines.append(line)
        md_lines.append("")
        
        if art_num not in artigos_todos:
            artigos_todos.append(art_num)
        i += 1
        continue

    # Check for Parágrafo
    m_par = re_paragrafo.match(chunk)
    if m_par:
        par_lbl = m_par.group(1).strip()
        par_body = m_par.group(2).strip()
        par_body = re.sub(r'^[°º\.]+\s*', '', par_body).strip()
        # Clean par_lbl: e.g. § 1º or Parágrafo único.
        m_pnum = re.search(r'§\s*(\d+)', par_lbl)
        if m_pnum:
            p_val = m_pnum.group(1)
            par_clean_lbl = f"§ {p_val}º" if int(p_val) <= 9 else f"§ {p_val}."
        else:
            par_clean_lbl = "Parágrafo único."
        line = f"**{par_clean_lbl}** {par_body}".strip()
        md_lines.append(line)
        md_lines.append("")
        i += 1
        continue

    # Incisos, Alíneas or general text
    md_lines.append(chunk)
    md_lines.append("")
    i += 1

out_md = '\n'.join(md_lines)
print(f"Linhas no Markdown final: {len(md_lines)}")
print(f"Total de artigos detectados: {len(artigos_todos)}")
print(f"TOC gerado: {len(toc)} seções")

md_path = 'assets/leis/lei6123_pe.md'
with open(md_path, 'w', encoding='utf-8') as f:
    f.write(out_md)

size_kb = round(os.path.getsize(md_path) / 1024, 1)
print(f"Arquivo salvo: {md_path} ({size_kb} KB)")

# Sample articles (first 15)
artigos_amostra = artigos_todos[:15]

# Build catalogo entry
entry = {
    "id": "lei6123_pe",
    "nome": "Estatuto dos Servidores Civis de PE",
    "numero": "Lei 6.123/1968",
    "materia": "Legislação Estadual (PE)",
    "materia_cur": "Direito Administrativo",
    "categoria": "Estadual PE",
    "icone": "⚖️",
    "descricao": "Estatuto dos Funcionários Públicos Civis do Estado de Pernambuco. Rege direitos, deveres, licenças, vencimentos e regime disciplinar dos servidores estaduais.",
    "arquivo": "assets/leis/lei6123_pe.md",
    "size_kb": size_kb,
    "fonte": "https://legis.alepe.pe.gov.br/texto.aspx?id=10727&tipo=TEXTOATUALIZADO",
    "urn": "",
    "topicos_edital": [
        "Estatuto dos Servidores Públicos Civis de Pernambuco (Lei Estadual nº 6.123/1968)",
        "Regime Jurídico dos Funcionários Públicos Civis do Estado de Pernambuco",
        "Legislação Estadual PE - PPPE"
    ],
    "total_artigos": len(artigos_todos),
    "artigos_amostra": artigos_amostra,
    "artigos_todos": artigos_todos,
    "toc": toc
}

with open("lei6123_entry.json", "w", encoding="utf-8") as f:
    json.dump(entry, f, indent=2, ensure_ascii=False)

print("Entrada para catalogo.json gerada com sucesso em lei6123_entry.json!")
