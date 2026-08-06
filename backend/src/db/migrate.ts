import type { RowDataPacket } from './pool.js';
import { getPool } from './pool.js';

interface Migration {
  id: string;
  statements: string[];
}

/** Migraciones versionadas. Nunca edites una ya aplicada: agrega una nueva. */
const migrations: Migration[] = [
  {
    id: '001_init',
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) NOT NULL,
        email VARCHAR(190) NOT NULL,
        name VARCHAR(120) NOT NULL,
        password_hash VARCHAR(120) NOT NULL,
        theme ENUM('system','light','dark') NOT NULL DEFAULT 'system',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

      `CREATE TABLE IF NOT EXISTS projects (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        name VARCHAR(160) NOT NULL,
        description TEXT NULL,
        status ENUM('idea','building','done','archived') NOT NULL DEFAULT 'idea',
        stack JSON NULL,
        icon_url VARCHAR(600) NULL,
        accent VARCHAR(16) NOT NULL DEFAULT 'amber',
        repo_url VARCHAR(600) NULL,
        live_url VARCHAR(600) NULL,
        pinned TINYINT(1) NOT NULL DEFAULT 0,
        order_index INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_projects_user (user_id, status, order_index),
        KEY idx_projects_updated (user_id, updated_at),
        CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ],
  },
  {
    id: '002_user_avatar',
    statements: [
      // Data URL o URL remota. LONGTEXT permite pegar una imagen recortada en base64.
      `ALTER TABLE users ADD COLUMN avatar_url LONGTEXT NULL AFTER name`,
      `ALTER TABLE users ADD COLUMN role_label VARCHAR(80) NULL AFTER avatar_url`,
    ],
  },
  {
    id: '003_project_icon_and_reset',
    statements: [
      // Cada proyecto puede llevar su propia imagen subida, no solo una URL.
      `ALTER TABLE projects MODIFY COLUMN icon_url LONGTEXT NULL`,
      `CREATE TABLE IF NOT EXISTS password_resets (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_reset_token (token_hash),
        KEY idx_reset_user (user_id),
        CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
      // Quien entra con Google no tiene contrasena local.
      `ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(120) NULL`,
      `ALTER TABLE users ADD COLUMN google_sub VARCHAR(64) NULL AFTER password_hash`,
      `CREATE UNIQUE INDEX uq_users_google ON users (google_sub)`,
    ],
  },
  {
    id: '004_api_tokens',
    statements: [
      // Llave para que un agente externo lea y actualice la pila sin cookie de
      // sesion. Se guarda solo el hash: el texto se ve una vez y no se recupera.
      `CREATE TABLE IF NOT EXISTS api_tokens (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        label VARCHAR(80) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        prefix CHAR(8) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_api_token (token_hash),
        KEY idx_api_token_user (user_id),
        CONSTRAINT fk_api_token_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ],
  },
];

export async function runMigrations(log: (msg: string) => void = () => {}): Promise<number> {
  const pool = getPool();

  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id VARCHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  const [applied] = await pool.query<(RowDataPacket & { id: string })[]>('SELECT id FROM _migrations');
  const done = new Set(applied.map((row) => row.id));

  let count = 0;
  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    const cx = await pool.getConnection();
    try {
      for (const statement of migration.statements) await cx.query(statement);
      await cx.query('INSERT INTO _migrations (id) VALUES (?)', [migration.id]);
      log(`migracion aplicada: ${migration.id}`);
      count += 1;
    } finally {
      cx.release();
    }
  }
  return count;
}
