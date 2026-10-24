<?php
/* ============================================================
   PPRN — endpoints de bancas (incluído por index.php)
   ============================================================ */

define('PPRN_VERSION', '2026-10-24-v8');

function pprn_ascii_map() {
    static $map = null;
    if ($map !== null) return $map;
    $map = array(
        'á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','å'=>'a',
        'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
        'í'=>'i','ì'=>'i','î'=>'i','ï'=>'i',
        'ó'=>'o','ò'=>'o','ô'=>'o','õ'=>'o','ö'=>'o',
        'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u',
        'ç'=>'c','ñ'=>'n','ý'=>'y','ÿ'=>'y',
        'Á'=>'a','À'=>'a','Â'=>'a','Ã'=>'a','Ä'=>'a','Å'=>'a',
        'É'=>'e','È'=>'e','Ê'=>'e','Ë'=>'e',
        'Í'=>'i','Ì'=>'i','Î'=>'i','Ï'=>'i',
        'Ó'=>'o','Ò'=>'o','Ô'=>'o','Õ'=>'o','Ö'=>'o',
        'Ú'=>'u','Ù'=>'u','Û'=>'u','Ü'=>'u',
        'Ç'=>'c','Ñ'=>'n','Ý'=>'y'
    );
    return $map;
}

function pprn_ascii($s) {
    $s = (string)$s;
    // Remove diacríticos combinatórios Unicode
    $s = @preg_replace('/[\x{0300}-\x{036f}]/u', '', $s);
    $map = pprn_ascii_map();
    $s = strtr($s, $map);
    if (class_exists('Normalizer')) {
        $t = @Normalizer::normalize($s, Normalizer::FORM_KD);
        if ($t !== false && $t !== null) {
            $s = @preg_replace('/\p{Mn}+/u', '', $t);
        }
    }
    return $s;
}

function pprn_norm($s) {
    return strtoupper(trim(preg_replace('/[^a-z0-9]+/i', '_', pprn_ascii($s)), '_'));
}

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

        case 'pprn-version': {
            json_out(array('ok' => true, 'version' => defined('PPRN_VERSION') ? PPRN_VERSION : 'unknown'));
            return true;
        }

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
            if ($method !== 'GET' && $method !== 'POST') fail('Método inválido.', 405);
            require_auth($pdo, $config);
            $q = '';
            if (isset($_GET['q'])) $q = trim((string)$_GET['q']);
            elseif (isset($_POST['q'])) $q = trim((string)$_POST['q']);
            if ($q === '') json_out(array('ok' => true, 'results' => array()));
            $nb = pprn_norm($q);
            if (preg_match('/^\d+$/', $q)) {
                $stmt = $pdo->prepare('SELECT inscricao, nome, modalidade, nota_objetiva, posicao_geral, status_cota, vaga_imediata, previsao_taf FROM pprn_candidates WHERE inscricao = ? LIMIT 20');
                $stmt->execute(array($q));
            } else {
                $nb = pprn_norm($q);
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
            $total = (int)$pdo->query('SELECT COUNT(*) c FROM pprn_candidates')->fetch()['c'];
            json_out(array('ok' => true, 'results' => $out, 'total' => $total, 'q_norm' => $nb));
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

        case 'pprn-unlink': {
            if ($method !== 'POST' && $method !== 'DELETE') fail('Método inválido.', 405);
            $user = require_auth($pdo, $config);
            $pdo->prepare('DELETE FROM user_candidate_links WHERE user_id = ?')->execute(array($user['id']));
            json_out(array('ok' => true));
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
            if (isset($in['action']) && $in['action'] === 'unlink') {
                $pdo->prepare('DELETE FROM user_candidate_links WHERE user_id = ?')->execute(array($user['id']));
                json_out(array('ok' => true));
                return true;
            }
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
            @ini_set('max_execution_time', '300');
            @ini_set('memory_limit', '256M');
            try {
                // Aceita upload via arquivo CSV OU via JSON (headers + rows)
                $header = null;
                $rawRows = null;
                $name = 'upload.json';

                if (isset($_FILES['file']) && is_uploaded_file($_FILES['file']['tmp_name'])) {
                    $tmp = $_FILES['file']['tmp_name'];
                    $name = isset($_FILES['file']['name']) ? $_FILES['file']['name'] : 'upload.csv';
                    if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'csv') {
                        fail('Envie um arquivo CSV. (O painel converte Excel automaticamente.)');
                    }
                    // Normaliza encoding para UTF-8
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
                    $rawRows = array();
                    while (($row = fgetcsv($fh, 0, ',')) !== false) {
                        if (count($row) < 1) continue;
                        if (implode('', $row) === '') continue;
                        $rawRows[] = $row;
                    }
                    fclose($fh);
                } else {
                    $in = json_input();
                    if (!is_array($in) || !isset($in['headers']) || !isset($in['rows'])) {
                        fail('Envie um arquivo ou um JSON com headers e rows.');
                    }
                    $header = $in['headers'];
                    $rawRows = $in['rows'];
                    $name = isset($in['filename']) ? $in['filename'] : 'upload.json';
                }

                // Normaliza cabeçalhos (idempotente)
                $norm = array();
                foreach ($header as $h) {
                    $h = trim((string)$h);
                    $h = str_replace("\xEF\xBB\xBF", '', $h);
                    $h = pprn_ascii($h);
                    $h = strtolower($h);
                    $h = preg_replace('/[^a-z0-9]+/', '_', $h);
                    $h = trim($h, '_');
                    // Correções de termos com mangling prévio
                    $h = str_replace(
                        array('inscric_a_o', 'posic_a_o', 'li_nga_portgesa', 'li_ngua_portuguesa', 'histo_ria', 'e_tica', 'servic_o', 'p_blico', 'execuc_a_o', 'legisla_c_a_o'),
                        array('inscricao',   'posicao',   'lingua_portuguesa', 'lingua_portuguesa', 'historia',   'etica',  'servico',  'publico',  'execucao',   'legislacao'),
                        $h
                    );
                    $norm[] = $h;
                }
                $idx = array_flip($norm);
                $detectedHeaders = $norm;

                $get = function($row, $keys) use ($idx, $norm) {
                    foreach ($keys as $k) {
                        if (isset($idx[$k]) && isset($row[$idx[$k]])) {
                            $v = trim((string)$row[$idx[$k]]);
                            if ($v !== '') return $v;
                        }
                    }
                    // Fallback parcial de substring
                    foreach ($keys as $k) {
                        foreach ($norm as $colIndex => $colName) {
                            if (strpos($colName, $k) !== false && isset($row[$colIndex])) {
                                $v = trim((string)$row[$colIndex]);
                                if ($v !== '') return $v;
                            }
                        }
                    }
                    return null;
                };

                $toBool = function($v) {
                    if ($v === null) return null;
                    $l = strtolower(trim((string)$v));
                    if ($l === '1' || $l === 'true' || $l === 'sim' || $l === 'yes') return 1;
                    if ($l === '0' || $l === 'false' || $l === 'nao' || $l === 'não' || $l === 'no') return 0;
                    if (stripos($v, 'sim') !== false) return 1;
                    return null;
                };

                $toInt = function($v) {
                    if ($v === null || $v === '') return null;
                    $s = trim((string)$v);
                    $s = preg_replace('/[^\d\.\,\-]/', '', $s);
                    $s = str_replace(',', '.', $s);
                    return is_numeric($s) ? (int)round((float)$s) : null;
                };

                $toNum = function($v) {
                    if ($v === null || $v === '') return null;
                    $s = trim((string)$v);
                    $s = preg_replace('/[^\d\.\,\-]/', '', $s);
                    $s = str_replace(',', '.', $s);
                    return is_numeric($s) ? (float)$s : null;
                };

                $rows = array();
                $count = 0;
                $skipped = 0;
                $sampleSkipped = array();
                $sampleSaved = null;
                $uploadId = new_uuid();

                // registra upload antes de inserir candidatos (FK)
                $pdo->prepare('INSERT INTO pprn_uploads (id, filename, uploaded_at, row_count, uploaded_by) VALUES (?, ?, ?, ?, ?)')
                    ->execute(array($uploadId, $name, now_utc(), 0, $admin['id']));

                foreach ($rawRows as $row) {
                    if (!is_array($row)) continue;
                    if (count($row) < 1) continue;
                    if (implode('', $row) === '') continue;
                    while (count($row) < count($norm)) $row[] = '';

                    $nome = $get($row, array('nome', 'candidato', 'nome_candidato', 'nome_do_candidato', 'nome_completo'));
                    $insc = $get($row, array('inscricao', 'inscricao_str', 'inscricao_candidato', 'nr_inscricao', 'num_inscricao', 'inscric_a_o', 'insc'));
                    if ($nome === null || $insc === null) {
                        if (count($sampleSkipped) < 5) {
                            $sampleSkipped[] = array(
                                'reason' => ($nome === null ? 'nome ausente; ' : '') . ($insc === null ? 'inscricao ausente;' : ''),
                                'preview' => array_slice($row, 0, 4)
                            );
                        }
                        $skipped++;
                        continue;
                    }
                    $insc = preg_replace('/[^0-9]/', '', preg_replace('/\.0+$/', '', $insc));
                    if ($insc === '') { $skipped++; continue; }

                    $nota = $get($row, array('nota_objetiva', 'nota', 'pontos', 'pontuacao', 'pontuacao_objetiva', 'total_pontos', 'resultado_objetiva'));
                    $pos = $get($row, array('posicao_geral', 'posicao_original_definitiva', 'posicao', 'classificacao', 'classificacao_geral', 'posic_a_o_geral', 'posic_a_o', 'pos_geral', 'ordem'));
                    $mod = $get($row, array('modalidade_concorrencia', 'modalidade', 'concorrencia', 'tipo_vaga', 'cota'));
                    $status = $get($row, array('status_cota_preliminar', 'status_cota', 'resultado_hetero', 'resultado_ppp', 'resultado_pcd', 'resultado'));
                    $vaga = $get($row, array('previsao_vagas_imediatas', 'vaga_imediata', 'previsao_vagas_preliminar', 'vaga_imediata_sim_padrao', 'previsao_vagas'));
                    $taf = $get($row, array('previsao_taf', 'previsao_taf_preliminar', 'previsao_taf_sim_padrao'));
                    $pvagas = $get($row, array('previsao_vagas', 'previsao_vagas_imediatas'));
                    $conv = $get($row, array('convocado_taf_preliminar', 'convocado_taf', 'convocado_taf_sim_padrao'));
                    $ce = $get($row, array('cota_etnico_apta_preliminar', 'cota_etnico_racial', 'cota_etnico_apt'));
                    $cp = $get($row, array('cota_pcd_apta_preliminar', 'cota_pcd', 'cota_pcd_apt'));
                    $pe = $get($row, array('nova_pos_lista_etnico', 'pos_etnico', 'pos_lista_etnico', 'pos_etnico_sim_padrao'));
                    $pp = $get($row, array('nova_pos_lista_pcd', 'pos_pcd', 'pos_lista_pcd', 'pos_pcd_sim_padrao'));
                    $ge = $get($row, array('ganho_pos_etnico', 'ganho_etnico'));
                    $gp = $get($row, array('ganho_pos_pcd', 'ganho_pcd'));

                    $nb = pprn_norm($nome);

                    $jsonArr = array();
                    foreach ($norm as $i => $h) {
                        $jsonArr[$h] = isset($row[$i]) ? $row[$i] : null;
                    }
                    $json = json_encode($jsonArr, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                    if ($json === false) $json = null;

                    $cRow = array(
                        'inscricao' => $insc,
                        'nome' => $nome,
                        'nome_busca' => $nb,
                        'modalidade' => $mod,
                        'nota' => $toInt($nota),
                        'pos' => $toInt($pos),
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

                    if ($sampleSaved === null) {
                        $sampleSaved = array(
                            'inscricao' => $insc,
                            'nome' => $nome,
                            'nota' => $cRow['nota'],
                            'posicao' => $cRow['pos']
                        );
                    }

                    $rows[] = $cRow;
                    $count++;
                    if (count($rows) >= 500) {
                        insert_pprn_batch($pdo, $rows, $uploadId);
                        $rows = array();
                    }
                }

                // remove candidatos de uploads anteriores
                $pdo->prepare('DELETE FROM pprn_candidates WHERE upload_id <> ?')->execute(array($uploadId));

                if (count($rows) > 0) {
                    insert_pprn_batch($pdo, $rows, $uploadId);
                }

                $stmt = $pdo->prepare('SELECT COUNT(*) c FROM pprn_candidates WHERE upload_id = ?');
                $stmt->execute(array($uploadId));
                $rc = (int)$stmt->fetch()['c'];
                $pdo->prepare('UPDATE pprn_uploads SET row_count = ? WHERE id = ?')->execute(array($rc, $uploadId));

                json_out(array(
                    'ok' => true,
                    'upload_id' => $uploadId,
                    'row_count' => $rc,
                    'skipped' => $skipped,
                    'detected_headers' => $detectedHeaders,
                    'sample_saved' => $sampleSaved,
                    'sample_skipped' => $sampleSkipped
                ));
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