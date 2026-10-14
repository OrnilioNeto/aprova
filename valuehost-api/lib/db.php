<?php
/* ============================================================
   Conexão PDO (MySQL/MariaDB) — singleton por requisição
   ============================================================ */

function db($cfg) {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . $cfg['host'] . ';port=' . (int)$cfg['port'] . ';dbname=' . $cfg['name'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ));
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}
