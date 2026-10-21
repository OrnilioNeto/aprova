<?php
/* ============================================================
   API APROVA — ValueHost (PHP + MySQL)
   Endpoints: ?action=register|login|forgot|reset|confirm|
              change-password|me|state
   ============================================================ */

// Aumenta limites para estados grandes (~2MB+)
@ini_set('memory_limit', '256M');
// post_max_size nao pode ser alterado em runtime; depende do php.ini do servidor
@ini_set('max_execution_time', '60');
@ini_set('max_input_time', '60');

header('X-Content-Type-Options: nosniff');

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/jwt.php';
require __DIR__ . '/lib/smtp.php';

/* -------- Configuração -------- */
$configCandidates = array(
    dirname(__DIR__, 2) . '/aprova-config.php', // acima do webroot (recomendado)
    dirname(__DIR__) . '/aprova-config.php',    // acima da pasta da API
    __DIR__ . '/config.php',                    // junto da API (protegido por .htaccess)
);
$config = null;
foreach ($configCandidates as $path) {
    if (is_file($path)) { $config = require $path; break; }
}
if (!is_array($config)) {
    fail('Servidor sem configuração (config.php ausente).', 500);
}

apply_cors($config['allowed_origins']);

/* -------- Helpers de domínio -------- */

function find_user_by_email(PDO $pdo, $email) {
    $stmt = $pdo->prepare('SELECT id, email, password_hash, email_confirmed FROM users WHERE email = ? LIMIT 1');
    $stmt->execute(array($email));
    $row = $stmt->fetch();
    return $row ? $row : null;
}

function find_user_by_id(PDO $pdo, $id) {
    $stmt = $pdo->prepare('SELECT id, email, password_hash, email_confirmed FROM users WHERE id = ? LIMIT 1');
    $stmt->execute(array($id));
    $row = $stmt->fetch();
    return $row ? $row : null;
}

function require_auth(PDO $pdo, $config) {
    $token = bearer_token();
    if ($token === '') fail('Sessão expirada. Entre novamente.', 401);
    $payload = jwt_decode($token, $config['jwt_secret']);
    if (!$payload || empty($payload['sub'])) fail('Sessão expirada. Entre novamente.', 401);
    $user = find_user_by_id($pdo, $payload['sub']);
    if (!$user) fail('Sessão expirada. Entre novamente.', 401);
    return $user;
}

function issue_session($user, $config) {
    return array(
        'token' => jwt_encode(array('sub' => $user['id'], 'email' => $user['email']), $config['jwt_secret'], $config['jwt_ttl']),
        'user'  => array('id' => $user['id'], 'email' => $user['email']),
    );
}

function send_mail($config, $to, $subject, $html) {
    try {
        $mailer = new SmtpMailer($config['mail']);
        $mailer->send($to, $subject, $html);
    } catch (Exception $e) {
        error_log('[aprova-mail] ' . $e->getMessage());
    }
}

function email_layout($title, $intro, $buttonText, $url) {
    return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">'
        . '<h2 style="margin:0 0 8px">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h2>'
        . '<p style="line-height:1.6">' . $intro . '</p>'
        . '<p style="margin:28px 0"><a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '" '
        . 'style="background:#6366f1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">'
        . htmlspecialchars($buttonText, ENT_QUOTES, 'UTF-8') . '</a></p>'
        . '<p style="font-size:12px;color:#6b7280;line-height:1.6">Se você não solicitou este e-mail, ignore-o. '
        . 'Se o botão não funcionar, copie e cole este link no navegador:<br>'
        . '<span style="word-break:break-all">' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '</span></p>'
        . '</div>';
}

/* -------- Roteamento -------- */

$action = isset($_GET['action']) ? preg_replace('/[^a-z\-]/', '', strtolower($_GET['action'])) : '';
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

try {
    $pdo = db($config['db']);

    switch ($action) {

        case 'register': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            check_rate($pdo, 'register', 5, 3600);
            $in = json_input();
            $email = normalize_email(isset($in['email']) ? $in['email'] : '');
            $password = isset($in['password']) ? (string)$in['password'] : '';
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Informe um e-mail válido.');
            if (strlen($password) < 6) fail('A senha deve ter ao menos 6 caracteres.');
            if (find_user_by_email($pdo, $email)) fail('Este e-mail já está cadastrado.', 409);

            $confirm = !empty($config['auto_confirm_registration']);
            $stmt = $pdo->prepare('INSERT INTO users (id, email, password_hash, email_confirmed, created_at) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute(array(
                new_uuid(),
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                $confirm ? 1 : 0,
                now_utc(),
            ));
            $user = find_user_by_email($pdo, $email);

            if ($confirm) {
                $session = issue_session($user, $config);
                json_out(array('ok' => true, 'token' => $session['token'], 'user' => $session['user']));
            }

            $token = random_token(32);
            $pdo->prepare('INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)')
                ->execute(array(hash('sha256', $token), $user['id'], 'confirm', future_utc(86400), now_utc()));
            $link = $config['app_url'] . '#confirm=' . $token;
            send_mail(
                $config,
                $email,
                'Confirme seu e-mail — Desempenho Concurso',
                email_layout('Confirme seu e-mail', 'Falta pouco! Clique no botão abaixo para ativar sua conta.', 'Confirmar e-mail', $link)
            );
            json_out(array('ok' => true, 'confirm_email' => true));
        }

        case 'login': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            check_rate($pdo, 'login', 10, 900);
            $in = json_input();
            $email = normalize_email(isset($in['email']) ? $in['email'] : '');
            $password = isset($in['password']) ? (string)$in['password'] : '';
            if ($email === '' || $password === '') fail('Informe e-mail e senha.');
            $user = find_user_by_email($pdo, $email);
            if (!$user || $user['password_hash'] === '' || !password_verify($password, $user['password_hash'])) {
                fail('E-mail ou senha inválidos.', 401);
            }
            if (!$user['email_confirmed']) {
                fail('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.', 403);
            }
            $session = issue_session($user, $config);
            json_out(array('ok' => true, 'token' => $session['token'], 'user' => $session['user']));
        }

        case 'forgot': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            check_rate($pdo, 'forgot', 5, 900);
            $in = json_input();
            $email = normalize_email(isset($in['email']) ? $in['email'] : '');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Informe um e-mail válido.');
            $user = find_user_by_email($pdo, $email);
            if ($user) {
                $pdo->prepare("UPDATE auth_tokens SET used = 1 WHERE user_id = ? AND purpose = 'reset' AND used = 0")
                    ->execute(array($user['id']));
                $token = random_token(32);
                $pdo->prepare('INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)')
                    ->execute(array(hash('sha256', $token), $user['id'], 'reset', future_utc(3600), now_utc()));
                $link = $config['app_url'] . '#reset=' . $token;
                send_mail(
                    $config,
                    $email,
                    'Redefinir sua senha — Desempenho Concurso',
                    email_layout('Redefinir senha', 'Recebemos um pedido para redefinir sua senha. O link abaixo vale por 1 hora.', 'Definir nova senha', $link)
                );
            }
            json_out(array('ok' => true));
        }

        case 'reset': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            check_rate($pdo, 'reset', 10, 900);
            $in = json_input();
            $token = isset($in['token']) ? (string)$in['token'] : '';
            $password = isset($in['password']) ? (string)$in['password'] : '';
            if ($token === '' || strlen($password) < 6) fail('Dados inválidos. A senha deve ter ao menos 6 caracteres.');
            $stmt = $pdo->prepare("SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = 'reset' AND used = 0 AND expires_at > ? LIMIT 1");
            $stmt->execute(array(hash('sha256', $token), now_utc()));
            $row = $stmt->fetch();
            if (!$row) fail('Link inválido ou expirado. Solicite um novo.', 410);
            $pdo->prepare('UPDATE users SET password_hash = ?, email_confirmed = 1 WHERE id = ?')
                ->execute(array(password_hash($password, PASSWORD_DEFAULT), $row['user_id']));
            $pdo->prepare('UPDATE auth_tokens SET used = 1 WHERE token_hash = ?')->execute(array(hash('sha256', $token)));
            $user = find_user_by_id($pdo, $row['user_id']);
            $session = issue_session($user, $config);
            json_out(array('ok' => true, 'token' => $session['token'], 'user' => $session['user']));
        }

        case 'confirm': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            check_rate($pdo, 'confirm', 10, 900);
            $in = json_input();
            $token = isset($in['token']) ? (string)$in['token'] : '';
            if ($token === '') fail('Token ausente.');
            $stmt = $pdo->prepare("SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = 'confirm' AND used = 0 AND expires_at > ? LIMIT 1");
            $stmt->execute(array(hash('sha256', $token), now_utc()));
            $row = $stmt->fetch();
            if (!$row) fail('Link inválido ou expirado.', 410);
            $pdo->prepare('UPDATE users SET email_confirmed = 1 WHERE id = ?')->execute(array($row['user_id']));
            $pdo->prepare('UPDATE auth_tokens SET used = 1 WHERE token_hash = ?')->execute(array(hash('sha256', $token)));
            json_out(array('ok' => true));
        }

        case 'change-password': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            check_rate($pdo, 'change-password', 10, 900);
            $user = require_auth($pdo, $config);
            $in = json_input();
            $password = isset($in['password']) ? (string)$in['password'] : '';
            if (strlen($password) < 6) fail('A senha deve ter ao menos 6 caracteres.');
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute(array(password_hash($password, PASSWORD_DEFAULT), $user['id']));
            json_out(array('ok' => true));
        }

        case 'me': {
            if ($method !== 'GET') fail('Método inválido.', 405);
            $user = require_auth($pdo, $config);
            json_out(array('ok' => true, 'user' => array('id' => $user['id'], 'email' => $user['email'])));
        }

        case 'state': {
            $user = require_auth($pdo, $config);
            if ($method === 'GET') {
                $stmt = $pdo->prepare('SELECT data, updated_at FROM states WHERE user_id = ? LIMIT 1');
                $stmt->execute(array($user['id']));
                $row = $stmt->fetch();
                if (!$row) json_out(array('ok' => true, 'data' => null));
                $decoded = json_decode($row['data'], true);
                json_out(array('ok' => true, 'data' => $decoded, 'updated_at' => $row['updated_at']));
            }
            if ($method === 'PUT') {
                $raw = file_get_contents('php://input');
                error_log('[aprova-state] raw_bytes=' . strlen($raw));
                $in = json_decode($raw, true);
                error_log('[aprova-state] json_decode error=' . json_last_error() . ' (' . json_last_error_msg() . ')');
                if (!is_array($in)) { error_log('[aprova-state] json_decode retornou nao-array'); fail('Dados inválidos (JSON decode).'); }

                // Modo patch: mesclar agenda/tarefas com state existente (evita enviar 2MB)
                if (isset($in['patch']) && is_array($in['patch'])) {
                    $patch = $in['patch'];
                    $cid = isset($patch['concursoId']) ? $patch['concursoId'] : '';
                    // Buscar state existente
                    $stmt = $pdo->prepare('SELECT data FROM states WHERE user_id = ? LIMIT 1');
                    $stmt->execute(array($user['id']));
                    $row = $stmt->fetch();
                    $existing = null;
                    if ($row && isset($row['data'])) {
                        $existing = json_decode($row['data'], true);
                    }
                    if (!is_array($existing) || !isset($existing['concursos'])) {
                        // State inicial minimo
                        $existing = array('concursos' => array(), 'currentConcursoId' => $cid);
                    }
                    // Mesclar
                    $found = false;
                    if (isset($existing['concursos']) && is_array($existing['concursos'])) {
                        foreach ($existing['concursos'] as &$c) {
                            if (isset($c['id']) && $c['id'] === $cid) {
                                if (!isset($c['estudo']) || !is_array($c['estudo'])) $c['estudo'] = array();
                                if (isset($patch['agenda']) && is_array($patch['agenda'])) $c['estudo']['agenda'] = $patch['agenda'];
                                if (isset($patch['tarefas']) && is_array($patch['tarefas'])) $c['estudo']['tarefas'] = $patch['tarefas'];
                                $found = true;
                            }
                        }
                        unset($c);
                    }
                    if (!$found && $cid !== '') {
                        // Criar concurso minimo
                        $existing['concursos'][] = array(
                            'id' => $cid,
                            'name' => '',
                            'subjects' => array(),
                            'targets' => array(),
                            'simulados' => array(),
                            'provas' => array(),
                            'corte' => 0,
                            'dataProva' => '',
                            'estudo' => array(
                                'materias' => array(),
                                'cronometro' => null,
                                'agenda' => isset($patch['agenda']) ? $patch['agenda'] : array(),
                                'tarefas' => isset($patch['tarefas']) ? $patch['tarefas'] : array(),
                                'calendario' => array(),
                                'plano' => null
                            )
                        );
                        $existing['currentConcursoId'] = $cid;
                    }
                    $in['data'] = $existing;
                    error_log('[aprova-state] PATCH aplicado: concurso=' . $cid . ' agenda_horas=' . (isset($patch['agenda']) && is_array($patch['agenda']) ? array_sum(array_map('count', $patch['agenda'])) : 0));
                }

                if (!isset($in['data']) || !is_array($in['data'])) fail('Dados inválidos.');
                // Diagnostico: contar concursos e agenda
                $nConc = isset($in['data']['concursos']) && is_array($in['data']['concursos']) ? count($in['data']['concursos']) : -1;
                error_log('[aprova-state] concursos=' . $nConc . ' currentConcursoId=' . (isset($in['data']['currentConcursoId']) ? $in['data']['currentConcursoId'] : 'null'));
                if (isset($in['data']['concursos']) && is_array($in['data']['concursos'])) {
                    foreach ($in['data']['concursos'] as $ci => $c) {
                        $cid = isset($c['id']) ? $c['id'] : '?';
                        $hasEstudo = isset($c['estudo']) ? 'sim' : 'nao';
                        $hasAgenda = isset($c['estudo']['agenda']) ? 'sim' : 'nao';
                        $agendaKeys = $hasAgenda === 'sim' ? implode(',', array_keys($c['estudo']['agenda'])) : '';
                        error_log('[aprova-state] concurso[' . $ci . '] id=' . $cid . ' estudo=' . $hasEstudo . ' agenda=' . $hasAgenda . ' keys=' . $agendaKeys);
                    }
                }
                $json = json_encode($in['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($json === false) { error_log('[aprova-state] json_encode falhou: ' . json_last_error_msg()); fail('Dados inválidos (JSON).'); }
                $agendaHoras = 0;
                if (isset($in['data']['concursos']) && is_array($in['data']['concursos'])) {
                    foreach ($in['data']['concursos'] as $c) {
                        if (isset($c['estudo']['agenda']) && is_array($c['estudo']['agenda'])) {
                            foreach ($c['estudo']['agenda'] as $d => $hrs) {
                                if (is_array($hrs)) $agendaHoras += count($hrs);
                            }
                        }
                    }
                }
                error_log('[aprova-state] PUT user=' . $user['id'] . ' raw_bytes=' . strlen($raw) . ' json_bytes=' . strlen($json) . ' agenda_horas=' . $agendaHoras);
                $now = now_utc();
                $pdo->prepare(
                    'INSERT INTO states (user_id, data, updated_at) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)'
                )->execute(array($user['id'], $json, $now));
                json_out(array('ok' => true, 'updated_at' => $now, 'agenda_horas_recebidas' => $agendaHoras));
            }
            fail('Método inválido.', 405);
        }

        default:
            fail('Ação desconhecida.', 404);
    }
} catch (PDOException $e) {
    error_log('[aprova-db] ' . $e->getMessage());
    fail('Erro interno do servidor. Tente novamente.', 500);
} catch (Exception $e) {
    error_log('[aprova] ' . $e->getMessage());
    fail('Erro interno do servidor. Tente novamente.', 500);
}
