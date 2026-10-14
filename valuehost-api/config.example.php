<?php
/* ============================================================
   EXEMPLO de configuração da API (copie para config.php)
   O config.php real NÃO deve ir para o Git (está no .gitignore).
   Mais seguro ainda: renomeie para aprova-config.php e coloque
   UM NÍVEL ACIMA da pasta da API (ex.: /home/usuario/aprova-config.php).
   ============================================================ */

return array(

    // ---- Banco de dados (ValueHost) ----
    'db' => array(
        'host' => 'localhost',          // em hospedagem compartilhada é quase sempre localhost
        'port' => 3306,
        'name' => 'prev0142_aprova',
        'user' => 'prev0142_aprov',
        'pass' => 'COLE_A_SENHA_AQUI',
    ),

    // ---- Sessões (JWT) ----
    'jwt_secret' => 'GERAR_UMA_STRING_ALEATORIA_LONGA',
    'jwt_ttl'    => 604800,             // validade do login em segundos (7 dias)

    // ---- Frontend ----
    'app_url' => 'https://aprova.onrender.com/',

    // Origens autorizadas a chamar a API (CORS)
    'allowed_origins' => array(
        'https://aprova.onrender.com',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
    ),

    // true  = cadastro já entra logado (recomendado para começar)
    // false = envia e-mail de confirmação antes do primeiro login
    'auto_confirm_registration' => true,

    // ---- E-mail (SMTP do ValueHost) ----
    // Crie a conta de e-mail no painel e preencha a senha abaixo.
    'mail' => array(
        'host' => 'mail.previaseg.com', // ajuste para o host SMTP que o painel informar
        'port' => 465,                  // 465 com 'ssl' (recomendado) ou 587 com 'tls'
        'encryption' => 'ssl',
        'username' => 'suporte@previaseg.com',
        'password' => 'COLE_A_SENHA_DO_EMAIL_AQUI',
        'from' => 'suporte@previaseg.com',
        'from_name' => 'Desempenho Concurso',
    ),
);
