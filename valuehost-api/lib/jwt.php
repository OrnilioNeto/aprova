<?php
/* ============================================================
   JWT HS256 mínimo (sem dependências externas)
   ============================================================ */

function jwt_b64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_b64url_decode($data) {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_encode($payload, $secret, $ttlSeconds) {
    $header = array('alg' => 'HS256', 'typ' => 'JWT');
    $payload['iat'] = time();
    $payload['exp'] = time() + (int)$ttlSeconds;
    $h = jwt_b64url_encode(json_encode($header));
    $p = jwt_b64url_encode(json_encode($payload));
    $sig = hash_hmac('sha256', $h . '.' . $p, $secret, true);
    return $h . '.' . $p . '.' . jwt_b64url_encode($sig);
}

function jwt_decode($token, $secret) {
    $parts = explode('.', (string)$token);
    if (count($parts) !== 3) return null;
    list($h, $p, $s) = $parts;
    $expected = hash_hmac('sha256', $h . '.' . $p, $secret, true);
    $given = jwt_b64url_decode($s);
    if (!is_string($given) || !hash_equals($expected, $given)) return null;
    $payload = json_decode(jwt_b64url_decode($p), true);
    if (!is_array($payload)) return null;
    if (!isset($payload['exp']) || (int)$payload['exp'] < time()) return null;
    return $payload;
}
