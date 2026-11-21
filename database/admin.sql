-- Administrator accounts (login). Run after schema.sql:  mysql -u root -p < database/admin.sql
-- The first admin is created with:  npm run admin:create -- <username> <password> "<Full Name>"
USE batloung_farm;
CREATE TABLE IF NOT EXISTS admins (
  admin_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,      -- bcrypt hash, never the plain password
  full_name      VARCHAR(100) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login     DATETIME NULL,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB;
