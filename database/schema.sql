-- =====================================================================
-- Batloung Farm Distribution System  |  DIWA2110 Take-Home Test
-- PART A: MySQL database design and implementation
-- Run:  mysql -u root -p < database/schema.sql   (then seed.sql)
-- =====================================================================
DROP DATABASE IF EXISTS batloung_farm;
CREATE DATABASE batloung_farm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batloung_farm;

-- 1. Suppliers (bought from South African provinces) ------------------
CREATE TABLE suppliers (
  supplier_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_name   VARCHAR(120) NOT NULL,
  contact_person  VARCHAR(100) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  province        ENUM('Gauteng','Free State','KwaZulu-Natal','Western Cape',
                       'Eastern Cape','Limpopo','Mpumalanga','North West',
                       'Northern Cape') NOT NULL,
  address         VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_id),
  UNIQUE KEY uq_supplier_business (business_name),
  UNIQUE KEY uq_supplier_phone (phone),
  CONSTRAINT chk_supplier_name CHECK (CHAR_LENGTH(TRIM(business_name)) > 0)
) ENGINE=InnoDB;

-- 2. Fruits -----------------------------------------------------------
CREATE TABLE fruits (
  fruit_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fruit_name   VARCHAR(60)  NOT NULL,
  description  VARCHAR(255) NULL,
  status       ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (fruit_id),
  UNIQUE KEY uq_fruit_name (fruit_name)
) ENGINE=InnoDB;

-- 3. Vendors ----------------------------------------------------------
CREATE TABLE vendors (
  vendor_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_name        VARCHAR(100) NOT NULL,
  phone_number       VARCHAR(20)  NOT NULL,
  location           VARCHAR(150) NOT NULL,
  registration_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
  PRIMARY KEY (vendor_id),
  UNIQUE KEY uq_vendor_phone (phone_number),
  KEY idx_vendor_name (vendor_name)
) ENGINE=InnoDB;

-- 4. Purchases (header) -----------------------------------------------
CREATE TABLE purchases (
  purchase_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id    INT UNSIGNED NOT NULL,
  purchase_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (purchase_id),
  KEY idx_purchase_supplier (supplier_id),
  CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers (supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

-- 5. Purchase details (lines) -----------------------------------------
CREATE TABLE purchase_details (
  purchase_detail_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id         INT UNSIGNED NOT NULL,
  fruit_id            INT UNSIGNED NOT NULL,
  quantity            INT UNSIGNED NOT NULL,
  unit_cost           DECIMAL(10,2) NOT NULL,
  packaging_size      ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  PRIMARY KEY (purchase_detail_id),
  KEY idx_pd_purchase (purchase_id),
  KEY idx_pd_fruit (fruit_id),
  CONSTRAINT fk_pd_purchase FOREIGN KEY (purchase_id)
    REFERENCES purchases (purchase_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pd_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_pd_qty  CHECK (quantity > 0),
  CONSTRAINT chk_pd_cost CHECK (unit_cost >= 0)
) ENGINE=InnoDB;

-- 6. Sales (header) ---------------------------------------------------
CREATE TABLE sales (
  sale_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id       INT UNSIGNED NOT NULL,
  sale_date       DATE NOT NULL DEFAULT (CURRENT_DATE),
  payment_status  ENUM('PAID','PARTIALLY_PAID','UNPAID') NOT NULL DEFAULT 'UNPAID',
  total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (sale_id),
  KEY idx_sale_vendor (vendor_id),
  KEY idx_sale_date (sale_date),
  CONSTRAINT fk_sale_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (vendor_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sale_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

-- 7. Sales details (lines) --------------------------------------------
CREATE TABLE sales_details (
  sales_detail_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id          INT UNSIGNED NOT NULL,
  fruit_id         INT UNSIGNED NOT NULL,
  packaging_size   ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  quantity         INT UNSIGNED NOT NULL,
  unit_price       DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (sales_detail_id),
  KEY idx_sd_sale (sale_id),
  KEY idx_sd_fruit (fruit_id),
  CONSTRAINT fk_sd_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sd_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sd_qty   CHECK (quantity > 0),
  CONSTRAINT chk_sd_price CHECK (unit_price >= 0)
) ENGINE=InnoDB;

-- 8. Stock: ONE ROW PER FRUIT + PACKAGING SIZE -------------------------
--    Small, medium and large are tracked separately (never one total).
--    selling_price is the price list: each size has its own price.
CREATE TABLE stock (
  stock_id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fruit_id            INT UNSIGNED NOT NULL,
  packaging_size      ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  available_quantity  INT UNSIGNED NOT NULL DEFAULT 0,
  selling_price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (stock_id),
  UNIQUE KEY uq_stock_fruit_size (fruit_id, packaging_size),
  CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_stock_qty   CHECK (available_quantity >= 0),   -- no negative stock
  CONSTRAINT chk_stock_price CHECK (selling_price >= 0)
) ENGINE=InnoDB;

-- 9. Supporting table for PART D (payment management) -------------------
--    A vendor may pay a sale in instalments by cash / mobile money, or take
--    it on credit.  Outstanding balance = sale total - SUM(payments).
CREATE TABLE payments (
  payment_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id         INT UNSIGNED NOT NULL,
  payment_method  ENUM('CASH','MOBILE_MONEY','CREDIT') NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  payment_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference       VARCHAR(60) NULL,
  PRIMARY KEY (payment_id),
  KEY idx_payment_sale (sale_id),
  CONSTRAINT fk_payment_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_payment_amount CHECK (amount >= 0)
) ENGINE=InnoDB;
