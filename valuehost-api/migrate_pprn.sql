-- ============================================================
-- APROVA / PPRN — Migração: análises de bancas
-- Rodar no phpMyAdmin (banco: prev0142_aprova) após schema.sql
-- ============================================================
SET NAMES utf8mb4;

-- Papel do usuário (admin pode subir listas). Adiciona a coluna apenas se não existir.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN role ENUM(''user'',''admin'') NOT NULL DEFAULT ''user'' AFTER email_confirmed',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Uploads de listas das bancas
CREATE TABLE IF NOT EXISTS pprn_uploads (
  id CHAR(36) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  uploaded_at DATETIME NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  uploaded_by CHAR(36) NULL,
  PRIMARY KEY (id),
  KEY idx_pprn_uploads_date (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Candidatos (1 linha por candidato; data_json guarda as 49 colunas originais)
CREATE TABLE IF NOT EXISTS pprn_candidates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  upload_id CHAR(36) NOT NULL,
  inscricao VARCHAR(32) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  nome_busca VARCHAR(255) NOT NULL,
  modalidade VARCHAR(80) NULL,
  nota_objetiva INT NULL,
  posicao_geral INT NULL,
  status_cota VARCHAR(40) NULL,
  vaga_imediata VARCHAR(120) NULL,
  previsao_taf VARCHAR(120) NULL,
  previsao_vagas VARCHAR(120) NULL,
  convocado_taf TINYINT(1) NULL,
  cota_etnico_apt TINYINT(1) NULL,
  cota_pcd_apt TINYINT(1) NULL,
  pos_etnico DOUBLE NULL,
  pos_pcd DOUBLE NULL,
  ganho_etnico DOUBLE NULL,
  ganho_pcd DOUBLE NULL,
  data_json LONGTEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pprn_cand_insc (inscricao),
  KEY idx_pprn_cand_nome (nome_busca),
  KEY idx_pprn_cand_upload (upload_id),
  CONSTRAINT fk_pprn_cand_upload FOREIGN KEY (upload_id) REFERENCES pprn_uploads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vínculo usuário <-> candidato
CREATE TABLE IF NOT EXISTS user_candidate_links (
  user_id CHAR(36) NOT NULL,
  inscricao VARCHAR(32) NOT NULL,
  linked_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY idx_ucl_insc (inscricao),
  CONSTRAINT fk_ucl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;