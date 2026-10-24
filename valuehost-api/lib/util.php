<?php
/* ============================================================
   Utilitários: I/O JSON, CORS, auth header, rate limit, tokens
   ============================================================ */

function json_input() {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return array();
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($msg, $code = 400) {
    json_out(array('error' => $msg), $code);
}

function apply_cors($allowedOrigins) {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    // Permite origens explicitamente configuradas (produção) e também
    // qualquer localhost/127.0.0.1 em porta arbitrária (desenvolvimento local).
    $allowed = false;
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        $allowed = true;
    } elseif ($origin !== '' && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin)) {
        $allowed = true;
    } elseif ($origin === 'null') {
        // Permite abrir o index.html diretamente do disco (file://) em desenvolvimento.
        $allowed = true;
    }
    if ($allowed) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 86400');
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function auth_header() {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) return $v;
        }
    } elseif (function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) return $v;
        }
    }
    return '';
}

function bearer_token() {
    $h = auth_header();
    if (stripos($h, 'Bearer ') === 0) return trim(substr($h, 7));
    return '';
}

function client_ip() {
    return isset($_SERVER['REMOTE_ADDR']) ? substr($_SERVER['REMOTE_ADDR'], 0, 45) : '0.0.0.0';
}

function now_utc() {
    return gmdate('Y-m-d H:i:s');
}

function future_utc($seconds) {
    return gmdate('Y-m-d H:i:s', time() + (int)$seconds);
}

function random_token($bytes = 32) {
    return bin2hex(random_bytes($bytes));
}

function new_uuid() {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function normalize_email($email) {
    return strtolower(trim((string)$email));
}

function check_rate(PDO $pdo, $endpoint, $max, $windowSeconds) {
    $ip = client_ip();
    $cutoff = gmdate('Y-m-d H:i:s', time() - (int)$windowSeconds);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE ip = ? AND endpoint = ? AND attempted_at >= ?');
    $stmt->execute(array($ip, $endpoint, $cutoff));
    if ((int)$stmt->fetchColumn() >= (int)$max) {
        fail('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);
    }
    $ins = $pdo->prepare('INSERT INTO rate_limits (ip, endpoint, attempted_at) VALUES (?, ?, ?)');
    $ins->execute(array($ip, $endpoint, now_utc()));
    if (random_int(1, 20) === 1) {
        $pdo->prepare('DELETE FROM rate_limits WHERE attempted_at < ?')
            ->execute(array(gmdate('Y-m-d H:i:s', time() - 86400)));
    }
}
