# Migração de dados: Supabase → ValueHost

## Passo 1 — Exportar usuários do Supabase

No **Supabase → SQL Editor**, rode:

```sql
select id, email, encrypted_password, email_confirmed_at, created_at
from auth.users
order by created_at;
```

Clique em **Download CSV** no resultado e salve como `users.csv`.

> As senhas do Supabase são **bcrypt** — continuam funcionando no novo backend,
> ninguém precisa trocar de senha. Contas criadas por login social/magic link
> não têm senha (`encrypted_password` vazio); esses usuários devem usar
> "Esqueci minha senha" uma única vez.

## Passo 2 — Exportar estados do Supabase

No **SQL Editor**:

```sql
select user_id, data, updated_at
from public.states
order by updated_at;
```

Baixe como CSV e salve como `states.csv`.

## Passo 3 — Gerar o SQL de importação

Na pasta `valuehost-api/migrate`, com Node instalado:

```bash
node gerar-import.js --users users.csv --states states.csv --out import.sql
```

O script valida cada registro, converte datas para o formato MySQL, minifica o
JSON do estado e avisa sobre problemas (ex.: usuário sem senha).

## Passo 4 — Importar no ValueHost

1. Abra o **phpMyAdmin** do ValueHost e selecione o banco `prev0142_aprova`.
2. Primeiro execute o schema: aba **SQL** → cole o conteúdo de
   `valuehost-api/schema.sql` → **Executar**.
3. Aba **Importar** → envie o arquivo `import.sql` → **Executar**.

> Se o phpMyAdmin recusar o arquivo por tamanho (limite comum: 50 MB), abra o
> `import.sql`, divida os INSERTs em partes menores e importe uma por vez.

## Passo 5 — Conferir

No phpMyAdmin:

```sql
select count(*) from users;   -- deve bater com o total exportado
select count(*) from states;  -- deve bater com o total exportado
```

## Rollback

Os dados no Supabase **não são apagados** por esta migração. Se algo der errado,
basta manter `supabase.js` e reverter as duas linhas de script no `index.html`.
Só desative o projeto Supabase depois de alguns dias de uso estável no novo backend.
