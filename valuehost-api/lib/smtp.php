<?php
/* ============================================================
   Cliente SMTP mínimo — SSL (465) ou STARTTLS (587)
   Sem dependências externas (substitui PHPMailer)
   ============================================================ */

class SmtpMailer {

    private $cfg;

    public function __construct($cfg) {
        $this->cfg = $cfg;
    }

    public function send($to, $subject, $htmlBody) {
        if (empty($this->cfg['host']) || empty($this->cfg['username']) || empty($this->cfg['password'])) {
            throw new Exception('SMTP nao configurado (host/username/password).');
        }

        $host = $this->cfg['host'];
        $port = (int)$this->cfg['port'];
        $enc  = isset($this->cfg['encryption']) ? strtolower($this->cfg['encryption']) : 'ssl';
        $timeout = 20;

        $remote = (($enc === 'ssl') ? 'ssl://' : '') . $host . ':' . $port;
        $ctx = stream_context_create(array('ssl' => array(
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        )));
        $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) throw new Exception('Falha ao conectar no SMTP: ' . $errstr . ' (' . $errno . ')');
        stream_set_timeout($fp, $timeout);

        try {
            $this->expect($fp, 220);
            $ehloHost = 'aprova.onrender.com';
            $this->cmd($fp, 'EHLO ' . $ehloHost, 250);

            if ($enc === 'tls') {
                $this->cmd($fp, 'STARTTLS', 220);
                if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new Exception('Falha ao iniciar TLS.');
                }
                $this->cmd($fp, 'EHLO ' . $ehloHost, 250);
            }

            $this->cmd($fp, 'AUTH LOGIN', 334);
            $this->cmd($fp, base64_encode($this->cfg['username']), 334);
            $this->cmd($fp, base64_encode($this->cfg['password']), 235);

            $from = $this->cfg['from'];
            $this->cmd($fp, 'MAIL FROM:<' . $from . '>', 250);
            $this->cmd($fp, 'RCPT TO:<' . $to . '>', 250);
            $this->cmd($fp, 'DATA', 354);

            $message = $this->buildMessage($to, $subject, $htmlBody);
            fwrite($fp, $message . "\r\n.\r\n");
            $this->expect($fp, 250);

            $this->cmd($fp, 'QUIT', 221);
        } finally {
            @fclose($fp);
        }
    }

    private function buildMessage($to, $subject, $htmlBody) {
        $fromName = isset($this->cfg['from_name']) ? $this->cfg['from_name'] : '';
        $from = $this->cfg['from'];
        $host = substr(strrchr($from, '@'), 1);

        $headers = array();
        $headers[] = 'Date: ' . date('r');
        $headers[] = 'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $from . '>';
        $headers[] = 'To: <' . $to . '>';
        $headers[] = 'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=';
        $headers[] = 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $host . '>';
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: text/html; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: base64';

        $body = chunk_split(base64_encode($htmlBody), 76, "\r\n");
        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }

    private function cmd($fp, $command, $expectCode) {
        fwrite($fp, $command . "\r\n");
        $this->expect($fp, $expectCode);
    }

    private function expect($fp, $code) {
        $response = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') break;
        }
        if ($response === '') throw new Exception('SMTP sem resposta.');
        $got = (int)substr($response, 0, 3);
        if ($got !== (int)$code) {
            throw new Exception('SMTP inesperado (esperava ' . $code . '): ' . trim($response));
        }
    }
}
