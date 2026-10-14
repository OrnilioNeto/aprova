# API Aprova — ValueHost (PHP + MySQL)

Backend que substitui o Supabase: autenticação (cadastro, login, recuperação de
senha) e sincronização do estado do app (`states`).

## Estrutura

```
valuehost-api/
├── index.php            # roteador + endpoints (?action=...)
├── config.php           # credenciais REAIS (NÃO versionado)
├── config.example.php   # modelo de configuração
├── schema.sql           # tabelas (rodar no phpMyAdmin)
├── .htaccess            # proteção de arquivos sensíveis
├── lib/
│   ├── db.php           # conexão PDO
│   ├── jwt.php          # tokens de sessão (HS256)
│   ├── smtp.php         # envio de e-mail (sem dependências)
│   └── util.php         # JSON, CORS, rate limit
└── migrate/
    ├── gerar-import.js  # gera import.sql a partir dos CSVs do Supabase
    └── README.md        # passo a passo da migração de dados
```

## Deploy (FTP / Gerenciador de Arquivos)

1. No ValueHost, crie o **domínio/subdomínio** que vai hospedar a API
   (ex.: `previaseg.com/api` ou `api.previaseg.com`).
2. Envie a pasta `valuehost-api/` para dentro da raiz desse domínio,
   **renomeando a pasta para `api`** (ex.: `public_html/api/`).
3. Envie também o `config.php` (que contém a senha do banco).
   Opcional mais seguro: renomeie para `aprova-config.php` e coloque um nível
   acima da raiz pública (ex.: `/home/SEU_USUARIO/aprova-config.php`).
4. Garanta **SSL (HTTPS)** no domínio da API — o Render é HTTPS e o navegador
   bloqueia chamadas para HTTP.

## Configuração pendente

Em `config.php`:

- `mail.password` — senha da conta `suporte@previaseg.com` (crie/troque no
  painel do ValueHost). Sem isso, a recuperação de senha não envia e-mails.
- `mail.host` — se o painel indicar outro servidor SMTP, ajuste aqui.
- `db.host` — em hospedagem compartilhada o padrão `localhost` costuma estar certo.

## Teste rápido

Acesse no navegador:

```
https://SEU_DOMINIO/api/index.php?action=me
```

Resposta esperada (prova que PHP + banco estão de pé):

```json
{"error":"Sessão expirada. Entre novamente."}
```

Depois, no `api-config.js` do frontend, aponte `window.API_BASE_URL` para a URL
real da API.

## Endpoints

| Ação | Método | Corpo | Auth |
|---|---|---|---|
| `?action=register` | POST | `{email, password}` | — |
| `?action=login` | POST | `{email, password}` | — |
| `?action=forgot` | POST | `{email}` | — |
| `?action=reset` | POST | `{token, password}` | — |
| `?action=confirm` | POST | `{token}` | — |
| `?action=change-password` | POST | `{password}` | Bearer |
| `?action=me` | GET | — | Bearer |
| `?action=state` | GET | — | Bearer |
| `?action=state` | PUT | `{data}` | Bearer |

## Segurança

- Senhas com `password_hash()` (bcrypt), compatível com os hashes do Supabase.
- JWT assinado com `jwt_secret` (troque o valor em produção se vazar).
- CORS restrito às origens em `allowed_origins`.
- Rate limit por IP em login/cadastro/recuperação.
- `config.php` bloqueado por `.htaccess` e ignorado pelo Git.

> **Recomendação:** a senha do banco foi compartilhada em chat durante a
> migração — troque-a no painel do ValueHost depois que tudo estiver
> funcionando e atualize o `config.php`.
