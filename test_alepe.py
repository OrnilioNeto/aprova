import urllib.request
import urllib.parse
import re

url = 'https://legis.alepe.pe.gov.br/pesquisaAvancada.aspx'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

# 1. GET page to obtain VIEWSTATE and EVENTVALIDATION
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', 'ignore')

viewstate = re.search(r'id="__VIEWSTATE"\s+value="([^"]+)"', html).group(1)
gen = re.search(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"', html).group(1)
val = re.search(r'id="__EVENTVALIDATION"\s+value="([^"]+)"', html).group(1)

# 2. POST search
data = {
    '__VIEWSTATE': viewstate,
    '__VIEWSTATEGENERATOR': gen,
    '__EVENTVALIDATION': val,
    'ctl00$conteudo$tbxNumero': '6123',
    'ctl00$conteudo$tbxAno': '1968',
    'ctl00$conteudo$btnPesquisar': 'Pesquisar'
}
encoded = urllib.parse.urlencode(data).encode('utf-8')
post_req = urllib.request.Request(url, data=encoded, headers=headers)

with urllib.request.urlopen(post_req, timeout=15) as resp:
    result_html = resp.read().decode('utf-8', 'ignore')

links = re.findall(r'href=[\'"]([^\'"]*texto\.aspx\?[^\'"]*)[\'"]', result_html, re.I)
print('Result links found:', links)
for m in re.finditer(r'<a[^>]*href=[\'"]([^\'"]+)[\'"][^>]*>(.*?)</a>', result_html, re.DOTALL | re.I):
    text = re.sub(r'<[^>]+>', '', m.group(2)).strip()
    if '6.123' in text or '6123' in text or 'Estatuto' in text:
        print(f"Match: {m.group(1)} -> {text[:100]}")
