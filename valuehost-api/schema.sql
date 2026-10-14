-- ============================================================
-- APROVA / Desempenho Concurso — Schema MySQL (ValueHost)
-- Rodar no phpMyAdmin do ValueHost (banco: prev0142_aprova)
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Usuários (senhas bcrypt — compatíveis com hashes exportados do Supabase)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  email_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Estado do app por usuário (JSON completo, 1 linha por usuário)
CREATE TABLE IF NOT EXISTS states (
  user_id CHAR(36) NOT NULL,
  data LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_states_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens de recuperação de senha e confirmação de e-mail
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash CHAR(64) NOT NULL,
  user_id CHAR(36) NOT NULL,
  purpose ENUM('reset','confirm') NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_auth_tokens_user (user_id),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limit simples por IP + endpoint
CREATE TABLE IF NOT EXISTS rate_limits (
  ip VARCHAR(45) NOT NULL,
  endpoint VARCHAR(32) NOT NULL,
  attempted_at DATETIME NOT NULL,
  KEY idx_rate (ip, endpoint, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
