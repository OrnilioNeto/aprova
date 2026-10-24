<?php
/* ============================================================
   PPRN — endpoints de bancas (incluído por index.php)
   ============================================================ */

function insert_pprn_batch(PDO $pdo, array $rows, $uploadId) {
    $sql = 'INSERT INTO pprn_candidates
        (upload_id, inscricao, nome, nome_busca, modalidade, nota_objetiva, posicao_geral,
         status_cota, vaga_imediata, previsao_taf, previsao_vagas, convocado_taf,
         cota_etnico_apt, cota_pcd_apt, pos_etnico, pos_pcd, ganho_etnico, ganho_pcd, data_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
         upload_id=VALUES(upload_id), nome=VALUES(nome), nome_busca=VALUES(nome_busca),
         modalidade=VALUES(modalidade), nota_objetiva=VALUES(nota_objetiva), posicao_geral=VALUES(posicao_geral),
         status_cota=VALUES(status_cota), vaga_imediata=VALUES(vaga_imediata), previsao_taf=VALUES(previsao_taf),
         previsao_vagas=VALUES(previsao_vagas), convocado_taf=VALUES(convocado_taf),
         cota_etnico_apt=VALUES(cota_etnico_apt), cota_pcd_apt=VALUES(cota_pcd_apt),
         pos_etnico=VALUES(pos_etnico), pos_pcd=VALUES(pos_pcd), ganho_etnico=VALUES(ganho_etnico),
         ganho_pcd=VALUES(ganho_pcd), data_json=VALUES(data_json)';
    $stmt = $pdo->prepare($sql);
    foreach ($rows as $r) {
        $stmt->execute(array(
            $uploadId,
            $r['inscricao'],
            $r['nome'],
            $r['nome_busca'],
            $r['modalidade'],
            $r['nota'],
            $r['pos'],
            $r['status'],
            $r['vaga'],
            $r['taf'],
            $r['pvagas'],
            $r['conv'],
            $r['ce'],
            $r['cp'],
            $r['pe'],
            $r['pp'],
            $r['ge'],
            $r['gp'],
            $r['json']
        ));
    }
}

function handle_pprn($action, $method, PDO $pdo, $config) {
    if (strpos($action, 'pprn-') !== 0) return false;

    switch ($action) {

        case 'pprn-uploads': {
            if ($method !== 'GET') fail('Método inválido.', 405);
            require_auth($pdo, $config);
            $stmt = $pdo->query('SELECT id, filename, uploaded_at, row_count FROM pprn_uploads ORDER BY uploaded_at DESC LIMIT 20');
            $rows = $stmt->fetchAll();
            $out = array();
            foreach ($rows as $r) {
                $out[] = array(
                    'id' => $r['id'],
                    'filename' => $r['filename'],
                    'uploaded_at' => $r['uploaded_at'],
                    'row_count' => (int)$r['row_count']
                );
            }
            json_out(array('ok' => true, 'uploads' => $out));
            return true;
        }

        case 'pprn-meta': {
            if ($method !== 'GET') fail('Método inválido.', 405);
            require_auth($pdo, $config);
            $stmt = $pdo->query('SELECT id, filename, uploaded_at, row_count FROM pprn_uploads ORDER BY uploaded_at DESC LIMIT 1');
            $row = $stmt->fetch();
            $total = (int)$pdo->query('SELECT COUNT(*) c FROM pprn_candidates')->fetch()['c'];
            if (!$row) json_out(array('ok' => true, 'meta' => null, 'total_candidates' => $total));
            json_out(array('ok' => true, 'meta' => array(
                'id' => $row['id'], 'filename' => $row['filename'],
                'uploaded_at' => $row['uploaded_at'], 'row_count' => (int)$row['row_count']
            ), 'total_candidates' => $total));
            return true;
        }

        case 'pprn-search': {
            if ($method !== 'GET') fail('Método inválido.', 405);
            require_auth($pdo, $config);
            $q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
            if ($q === '') json_out(array('ok' => true, 'results' => array()));
            if (preg_match('/^\d+$/', $q)) {
                $stmt = $pdo->prepare('SELECT inscricao, nome, modalidade, nota_objetiva, posicao_geral, status_cota, vaga_imediata, previsao_taf FROM pprn_candidates WHERE inscricao = ? LIMIT 20');
                $stmt->execute(array($q));
            } else {
                $nb = strtoupper(strtr($q, array(
                    'á'=>'A','à'=>'A','â'=>'A','ã'=>'A','ä'=>'A',
                    'é'=>'E','è'=>'E','ê'=>'E','ë'=>'E',
                    'í'=>'I','ì'=>'I','î'=>'I','ï'=>'I',
                    'ó'=>'O','ò'=>'O','ô'=>'O','õ'=>'O','ö'=>'O',
                    'ú'=>'U','ù'=>'U','û'=>'U','ü'=>'U',
                    'ç'=>'C','ñ'=>'N'
                )));
                $stmt = $pdo->prepare('SELECT inscricao, nome, modalidade, nota_objetiva, posicao_geral, status_cota, vaga_imediata, previsao_taf FROM pprn_candidates WHERE nome_busca LIKE ? OR nome LIKE ? LIMIT 20');
                $stmt->execute(array('%' . $nb . '%', '%' . $q . '%'));
            }
            $rows = $stmt->fetchAll();
            $out = array();
            foreach ($rows as $r) {
                $out[] = array(
                    'inscricao' => $r['inscricao'],
                    'nome' => $r['nome'],
                    'modalidade' => $r['modalidade'],
                    'nota' => $r['nota_objetiva'] !== null ? (int)$r['nota_objetiva'] : null,
                    'posicao' => $r['posicao_geral'] !== null ? (int)$r['posicao_geral'] : null,
                    'status_cota' => $r['status_cota'],
                    'vaga_imediata' => $r['vaga_imediata'],
                    'previsao_taf' => $r['previsao_taf']
                );
            }
            json_out(array('ok' => true, 'results' => $out));
            return true;
        }

        case 'pprn-candidate': {
            if ($method !== 'GET') fail('Método inválido.', 405);
            require_auth($pdo, $config);
            $insc = isset($_GET['inscricao']) ? trim((string)$_GET['inscricao']) : '';
            if ($insc === '') fail('Inscrição ausente.');
            $stmt = $pdo->prepare('SELECT * FROM pprn_candidates WHERE inscricao = ? LIMIT 1');
            $stmt->execute(array($insc));
            $r = $stmt->fetch();
            if (!$r) fail('Candidato não encontrado.', 404);
            $data = null;
            if (!empty($r['data_json'])) $data = json_decode($r['data_json'], true);
            json_out(array('ok' => true, 'candidate' => candidate_out($r, $data)));
            return true;
        }

        case 'pprn-linked': {
            if ($method !== 'GET') fail('Método inválido.', 405);
            $user = require_auth($pdo, $config);
            $stmt = $pdo->prepare('SELECT inscricao FROM user_candidate_links WHERE user_id = ? LIMIT 1');
            $stmt->execute(array($user['id']));
            $row = $stmt->fetch();
            if (!$row) json_out(array('ok' => true, 'linked' => null));
            $stmt2 = $pdo->prepare('SELECT * FROM pprn_candidates WHERE inscricao = ? LIMIT 1');
            $stmt2->execute(array($row['inscricao']));
            $r = $stmt2->fetch();
            if (!$r) json_out(array('ok' => true, 'linked' => array('inscricao' => $row['inscricao'], 'found' => false)));
            $data = null;
            if (!empty($r['data_json'])) $data = json_decode($r['data_json'], true);
            $out = candidate_out($r, $data);
            $out['found'] = true;
            json_out(array('ok' => true, 'linked' => $out));
            return true;
        }

        case 'pprn-link': {
            $user = require_auth($pdo, $config);
            if ($method === 'DELETE') {
                $pdo->prepare('DELETE FROM user_candidate_links WHERE user_id = ?')->execute(array($user['id']));
                json_out(array('ok' => true));
                return true;
            }
            if ($method !== 'POST') fail('Método inválido.', 405);
            $in = json_input();
            $insc = isset($in['inscricao']) ? trim((string)$in['inscricao']) : '';
            if ($insc === '') fail('Inscrição ausente.');
            $stmt = $pdo->prepare('SELECT inscricao FROM pprn_candidates WHERE inscricao = ? LIMIT 1');
            $stmt->execute(array($insc));
            if (!$stmt->fetch()) fail('Candidato não encontrado.', 404);
            $pdo->prepare('INSERT INTO user_candidate_links (user_id, inscricao, linked_at) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE inscricao = VALUES(inscricao), linked_at = VALUES(linked_at)')
                ->execute(array($user['id'], $insc, now_utc()));
            json_out(array('ok' => true));
            return true;
        }

        case 'pprn-upload': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            $admin = require_admin($pdo, $config);
            try {
            if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
                fail('Arquivo não enviado.');
            }
            $tmp = $_FILES['file']['tmp_name'];
            $name = isset($_FILES['file']['name']) ? $_FILES['file']['name'] : 'upload.csv';
            if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'csv') {
                fail('Envie um arquivo CSV. Converta o Excel para CSV antes (ou use o upload do painel que converte automaticamente).');
            }
            // Normaliza encoding para UTF-8 (aceita CSV em Windows-1252/ISO-8859-1)
            $raw = @file_get_contents($tmp);
            if ($raw !== false) {
                $enc = mb_detect_encoding($raw, array('UTF-8','Windows-1252','ISO-8859-1'), true);
                if ($enc && $enc !== 'UTF-8') {
                    $raw = mb_convert_encoding($raw, 'UTF-8', $enc);
                    @file_put_contents($tmp, $raw);
                }
            }
            $fh = fopen($tmp, 'r');
            if (!$fh) fail('Não foi possível abrir o arquivo.');
            $bom = fread($fh, 3);
            if ($bom !== "\xEF\xBB\xBF") rewind($fh);
            $header = fgetcsv($fh, 0, ',');
            if (!$header) { fclose($fh); fail('Cabeçalho CSV inválido.'); }
            $norm = array();
            foreach ($header as $h) {
                $h = trim($h);
                $h = str_replace("\xEF\xBB\xBF", '', $h);
                if (class_exists('Normalizer')) {
                    $tmp = Normalizer::normalize($h, Normalizer::FORM_KD);
                    if ($tmp !== false) {
                        $h = preg_replace('/\p{Mn}+/u', '', $tmp);
                    }
                }
                $h = strtolower($h);
                $h = preg_replace('/[^a-z0-9]+/', '_', $h);
                $h = trim($h, '_');
                $norm[] = $h;
            }
            $idx = array_flip($norm);
            $detectedHeaders = $norm;

            $get = function($row, $keys) use ($idx) {
                foreach ($keys as $k) {
                    if (isset($idx[$k]) && isset($row[$idx[$k]])) {
                        $v = trim($row[$idx[$k]]);
                        if ($v !== '') return $v;
                    }
                }
                return null;
            };
            $toBool = function($v) {
                if ($v === null) return null;
                $l = strtolower(trim($v));
                if ($l === '1' || $l === 'true' || $l === 'sim' || $l === 'yes') return 1;
                if ($l === '0' || $l === 'false' || $l === 'nao' || $l === 'não' || $l === 'no') return 0;
                if (stripos($v, 'sim') !== false) return 1;
                return null;
            };
            $toNum = function($v) { return ($v === null || $v === '') ? null : (is_numeric($v) ? (float)$v : null); };

            $rows = array();
            $count = 0;
            $skipped = 0;
            $detectedHeaders = array();
            $uploadId = new_uuid();
            while (($row = fgetcsv($fh, 0, ',')) !== false) {
                if (count($row) < 3) continue;
                if (implode('', $row) === '') continue;
                $nome = $get($row, array('nome'));
                $insc = $get($row, array('inscricao','inscricao_str'));
                if ($nome === null || $insc === null) { $skipped++; continue; }
                $insc = preg_replace('/[^0-9]/', '', $insc);
                $nota = $get($row, array('nota_objetiva'));
                $pos = $get($row, array('posicao_geral','posicao_original_definitiva'));
                $mod = $get($row, array('modalidade_concorrencia','modalidade'));
                $status = $get($row, array('status_cota_preliminar','status_cota'));
                $vaga = $get($row, array('previsao_vagas_imediatas','vaga_imediata','previsao_vagas_preliminar'));
                $taf = $get($row, array('previsao_taf','previsao_taf_preliminar'));
                $pvagas = $get($row, array('previsao_vagas','previsao_vagas_imediatas'));
                $conv = $get($row, array('convocado_taf_preliminar','convocado_taf'));
                $ce = $get($row, array('cota_etnico_apta_preliminar','cota_etnico_racial'));
                $cp = $get($row, array('cota_pcd_apta_preliminar','cota_pcd'));
                $pe = $get($row, array('nova_pos_lista_etnico','pos_etnico','pos_lista_etnico'));
                $pp = $get($row, array('nova_pos_lista_pcd','pos_pcd','pos_lista_pcd'));
                $ge = $get($row, array('ganho_pos_etnico','ganho_etnico'));
                $gp = $get($row, array('ganho_pos_pcd','ganho_pcd'));

                $nb = strtoupper(strtr($nome, array(
                    'á'=>'A','à'=>'A','â'=>'A','ã'=>'A','ä'=>'A',
                    'é'=>'E','è'=>'E','ê'=>'E','ë'=>'E',
                    'í'=>'I','ì'=>'I','î'=>'I','ï'=>'I',
                    'ó'=>'O','ò'=>'O','ô'=>'O','õ'=>'O','ö'=>'O',
                    'ú'=>'U','ù'=>'U','û'=>'U','ü'=>'U',
                    'ç'=>'C','ñ'=>'N'
                )));

                $jsonArr = array();
                foreach ($norm as $i => $h) {
                    $jsonArr[$h] = isset($row[$i]) ? $row[$i] : null;
                }
                $json = json_encode($jsonArr, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                if ($json === false) $json = null;

                $rows[] = array(
                    'inscricao' => $insc,
                    'nome' => $nome,
                    'nome_busca' => $nb,
                    'modalidade' => $mod,
                    'nota' => $nota !== null ? (int)$nota : null,
                    'pos' => $pos !== null ? (int)$pos : null,
                    'status' => $status,
                    'vaga' => $vaga,
                    'taf' => $taf,
                    'pvagas' => $pvagas,
                    'conv' => $toBool($conv),
                    'ce' => $toBool($ce),
                    'cp' => $toBool($cp),
                    'pe' => $toNum($pe),
                    'pp' => $toNum($pp),
                    'ge' => $toNum($ge),
                    'gp' => $toNum($gp),
                    'json' => $json
                );
                $count++;
                if (count($rows) >= 500) {
                    insert_pprn_batch($pdo, $rows, $uploadId);
                    $rows = array();
                }
            }
            fclose($fh);

            // registra upload
            $pdo->prepare('INSERT INTO pprn_uploads (id, filename, uploaded_at, row_count, uploaded_by) VALUES (?, ?, ?, ?, ?)')
                ->execute(array($uploadId, $name, now_utc(), 0, $admin['id']));

            // remove candidatos de uploads anteriores
            $pdo->prepare('DELETE FROM pprn_candidates WHERE upload_id <> ?')->execute(array($uploadId));

            if (count($rows) > 0) {
                insert_pprn_batch($pdo, $rows, $uploadId);
            }

            $stmt = $pdo->prepare('SELECT COUNT(*) c FROM pprn_candidates WHERE upload_id = ?');
            $stmt->execute(array($uploadId));
            $rc = (int)$stmt->fetch()['c'];
            $pdo->prepare('UPDATE pprn_uploads SET row_count = ? WHERE id = ?')->execute(array($rc, $uploadId));

            json_out(array('ok' => true, 'upload_id' => $uploadId, 'row_count' => $rc, 'skipped' => $skipped, 'detected_headers' => $detectedHeaders));
            return true;
        } catch (Exception $e) {
            fail('Erro no upload: ' . $e->getMessage(), 500);
            return true;
        }
        }

        case 'pprn-simulate': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            require_auth($pdo, $config);
            $in = json_input();
            $taxaHetero = isset($in['taxa_hetero']) ? (float)$in['taxa_hetero'] : 30.0;
            $taxaPcd = isset($in['taxa_pcd']) ? (float)$in['taxa_pcd'] : 20.0;

            $stmt = $pdo->query('SELECT * FROM pprn_candidates');
            $cands = $stmt->fetchAll();
            if (!$cands) fail('Nenhum dado PPRN carregado.', 404);

            $ampla = array(); $etnico = array(); $pcd = array();
            foreach ($cands as $c) {
                $mod = (string)$c['modalidade'];
                $nota = (int)$c['nota_objetiva'];
                $isPcd = (stripos($mod, 'PCD') !== false);
                $isEtnico = (stripos($mod, 'Cota') !== false && !$isPcd);
                $isAmpla = (stripos($mod, 'Ampla') !== false);

                $etnicoApt = ((int)$c['cota_etnico_apt'] === 1);
                $pcdApt = ((int)$c['cota_pcd_apt'] === 1);

                // reversão probabilística determinística por inscrição (seed)
                $seed = crc32($c['inscricao']);
                $rHetero = ($seed % 100) < $taxaHetero;
                $rPcd = (($seed >> 8) % 100) < $taxaPcd;

                $etnicoFinal = $isEtnico ? ($etnicoApt || $rHetero) : false;
                $pcdFinal = $isPcd ? ($pcdApt || $rPcd) : false;

                if ($isAmpla || (!$etnicoFinal && !$pcdFinal)) {
                    $ampla[] = $nota;
                }
                if ($etnicoFinal) $etnico[] = $nota;
                if ($pcdFinal) $pcd[] = $nota;
            }
            rsort($ampla); rsort($etnico); rsort($pcd);

            $corteAmpla = isset($ampla[139]) ? $ampla[139] : 0;
            $corteEtnico = isset($etnico[39]) ? $etnico[39] : 0;
            $cortePcd = isset($pcd[19]) ? $pcd[19] : 0;

            json_out(array('ok' => true, 'result' => array(
                'vagas_ampla' => min(140, count($ampla)),
                'vagas_etnico' => min(40, count($etnico)),
                'vagas_pcd' => min(20, count($pcd)),
                'corte_ampla' => $corteAmpla,
                'corte_etnico' => $corteEtnico,
                'corte_pcd' => $cortePcd,
                'total_ampla' => count($ampla),
                'total_etnico' => count($etnico),
                'total_pcd' => count($pcd)
            )));
            return true;
        }

        default:
            return false;
    }
}

function candidate_out($r, $data) {
    return array(
        'inscricao' => $r['inscricao'],
        'nome' => $r['nome'],
        'modalidade' => $r['modalidade'],
        'nota' => $r['nota_objetiva'] !== null ? (int)$r['nota_objetiva'] : null,
        'posicao_geral' => $r['posicao_geral'] !== null ? (int)$r['posicao_geral'] : null,
        'status_cota' => $r['status_cota'],
        'vaga_imediata' => $r['vaga_imediata'],
        'previsao_taf' => $r['previsao_taf'],
        'previsao_vagas' => $r['previsao_vagas'],
        'convocado_taf' => $r['convocado_taf'] !== null ? (bool)$r['convocado_taf'] : null,
        'cota_etnico_apt' => $r['cota_etnico_apt'] !== null ? (bool)$r['cota_etnico_apt'] : null,
        'cota_pcd_apt' => $r['cota_pcd_apt'] !== null ? (bool)$r['cota_pcd_apt'] : null,
        'pos_etnico' => $r['pos_etnico'] !== null ? (float)$r['pos_etnico'] : null,
        'pos_pcd' => $r['pos_pcd'] !== null ? (float)$r['pos_pcd'] : null,
        'ganho_etnico' => $r['ganho_etnico'] !== null ? (float)$r['ganho_etnico'] : null,
        'ganho_pcd' => $r['ganho_pcd'] !== null ? (float)$r['ganho_pcd'] : null,
        'extra' => $data
    );
}