-- =====================================================================
-- Sample data (realistic) for every table.  Run AFTER schema.sql
-- Stock and totals are DERIVED from the detail rows so the data is
-- always internally consistent.
-- =====================================================================
USE batloung_farm;

INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES
('Highveld Fresh Produce',      'Thabo Mokoena',     '+27 11 555 0101', 'Gauteng',       '14 Market Road, City Deep, Johannesburg'),
('Free State Orchards',         'Annelie van Wyk',   '+27 51 555 0102', 'Free State',    'Farm 22, Ficksburg Road, Ficksburg'),
('Zulu Coast Tropicals',        'Sipho Ndlovu',      '+27 31 555 0103', 'KwaZulu-Natal', '8 Harbour Way, Durban'),
('Cape Vine & Fruit Co-op',     'Liezl Pretorius',   '+27 21 555 0104', 'Western Cape',  'R44 Paarl Valley, Paarl'),
('Amathole Citrus Growers',     'Nomsa Dlamini',     '+27 43 555 0105', 'Eastern Cape',  '3 Citrus Lane, Patensie'),
('Limpopo Sun Farms',           'Johannes Maake',    '+27 15 555 0106', 'Limpopo',       'Plot 5, Tzaneen Road, Tzaneen'),
('Lowveld Mango Estate',        'Pieter Nel',        '+27 13 555 0107', 'Mpumalanga',    'Farm 9, Hazyview Road, Nelspruit'),
('Rustenburg Fruit Traders',    'Kagiso Molefe',     '+27 14 555 0108', 'North West',    '21 Platinum Street, Rustenburg');

INSERT INTO fruits (fruit_name, description, status) VALUES
('Apples',  'Crisp red and green apples, graded and boxed',      'ACTIVE'),
('Bananas', 'Sweet bananas, sold green-ripe for street vendors', 'ACTIVE'),
('Oranges', 'Juicy navel oranges',                               'ACTIVE'),
('Mangoes', 'Seasonal ripe mangoes',                             'ACTIVE'),
('Grapes',  'Seedless table grapes',                             'ACTIVE');

INSERT INTO vendors (vendor_name, phone_number, location, registration_date) VALUES
('Mpho Letsie',        '+266 5800 1101', 'Maseru Bus Stop, Kingsway',   '2026-01-12'),
('\'Matumelo Khoabane','+266 5800 1102', 'Maseru Mall Taxi Rank',       '2026-02-03'),
('Tsepo Mohale',       '+266 5800 1103', 'Maseru West Market',          '2026-02-20'),
('Lineo Rantsane',     '+266 5800 1104', 'Maputsoe Main Street',        '2026-03-15'),
('Retselisitsoe Sello','+266 5800 1105', 'Teyateyaneng Market',         '2026-04-01'),
('Palesa Tau',         '+266 5800 1106', 'Mafeteng Bus Terminal',       '2026-05-18'),
('Thabiso Lerotholi',  '+266 5800 1107', 'Roma Campus Gate',            '2026-06-09'),
('Nthabiseng Moeketsi','+266 5800 1108', 'Maseru Industrial Area',      '2026-07-22');

-- Stock rows: one per fruit x packaging size, with the per-size price list
-- (each size has a different selling price, in Maloti per box)
INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES
(1,'SMALL',0, 85.00),(1,'MEDIUM',0,140.00),(1,'LARGE',0,210.00),
(2,'SMALL',0, 60.00),(2,'MEDIUM',0,100.00),(2,'LARGE',0,150.00),
(3,'SMALL',0, 70.00),(3,'MEDIUM',0,115.00),(3,'LARGE',0,175.00),
(4,'SMALL',0,110.00),(4,'MEDIUM',0,180.00),(4,'LARGE',0,270.00),
(5,'SMALL',0,120.00),(5,'MEDIUM',0,195.00),(5,'LARGE',0,290.00);

-- Purchases ------------------------------------------------------------
INSERT INTO purchases (supplier_id, purchase_date) VALUES
(1,'2026-10-01'),(3,'2026-10-03'),(4,'2026-10-05'),(6,'2026-10-08'),(2,'2026-10-20');

INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES
(1,1,40, 55.00,'SMALL'),(1,1,50, 95.00,'MEDIUM'),(1,1,40,145.00,'LARGE'),
(1,2,40, 38.00,'SMALL'),(1,2,50, 65.00,'MEDIUM'),(1,2,40,100.00,'LARGE'),
(2,4,30, 72.00,'SMALL'),(2,4,40,120.00,'MEDIUM'),(2,4,30,180.00,'LARGE'),
(3,5,30, 80.00,'SMALL'),(3,5,40,130.00,'MEDIUM'),(3,5,30,195.00,'LARGE'),
(4,3,40, 45.00,'SMALL'),(4,3,50, 75.00,'MEDIUM'),(4,3,40,115.00,'LARGE'),
(5,1,30, 95.00,'MEDIUM'),(5,3,20,115.00,'LARGE');

UPDATE purchases p
JOIN (SELECT purchase_id, SUM(quantity*unit_cost) AS t FROM purchase_details GROUP BY purchase_id) d
  ON d.purchase_id = p.purchase_id
SET p.total_amount = d.t;

-- Sales -----------------------------------------------------------------
INSERT INTO sales (vendor_id, sale_date) VALUES
(1,'2026-10-10'),(2,'2026-10-12'),(3,'2026-10-15'),
(4,'2026-11-02'),(1,'2026-11-05'),(5,'2026-11-09');

-- unit_price is copied from the price list (stock.selling_price) at sale time
INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES
(1,1,'LARGE',20,210.00),(1,2,'MEDIUM',15,100.00),
(2,1,'LARGE',14,210.00),(2,3,'MEDIUM',20,115.00),(2,5,'SMALL',10,120.00),
(3,4,'LARGE',24,270.00),(3,4,'MEDIUM',15,180.00),
(4,5,'MEDIUM',20,195.00),(4,5,'LARGE',12,290.00),(4,2,'SMALL',10, 60.00),
(5,3,'SMALL',25, 70.00),(5,1,'MEDIUM',30,140.00),
(6,2,'LARGE',30,150.00),(6,4,'SMALL',12,110.00);

UPDATE sales s
JOIN (SELECT sale_id, SUM(quantity*unit_price) AS t FROM sales_details GROUP BY sale_id) d
  ON d.sale_id = s.sale_id
SET s.total_amount = d.t;

-- Payments (cash, mobile money, credit) --------------------------------
INSERT INTO payments (sale_id, payment_method, amount, payment_date, reference)
SELECT sale_id, 'CASH', total_amount, '2026-10-10 10:00:00', 'Paid in full at pick-up' FROM sales WHERE sale_id = 1;
INSERT INTO payments (sale_id, payment_method, amount, payment_date, reference) VALUES
(2,'CASH',        1500.00,'2026-10-12 11:30:00','Deposit'),
(3,'CREDIT',         0.00,'2026-10-15 09:15:00','Sold on credit'),
(5,'MOBILE_MONEY',1200.00,'2026-11-05 14:00:00','M-Pesa ref MP2611050042');
INSERT INTO payments (sale_id, payment_method, amount, payment_date, reference)
SELECT sale_id, 'MOBILE_MONEY', total_amount, '2026-11-02 16:45:00', 'EcoCash ref EC2611020877' FROM sales WHERE sale_id = 4;
INSERT INTO payments (sale_id, payment_method, amount, payment_date, reference)
SELECT sale_id, 'CASH', total_amount, '2026-11-09 08:30:00', 'Paid in full' FROM sales WHERE sale_id = 6;

UPDATE sales s
LEFT JOIN (SELECT sale_id, SUM(amount) paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id
SET s.payment_status = CASE
      WHEN COALESCE(p.paid,0) >= s.total_amount THEN 'PAID'
      WHEN COALESCE(p.paid,0) >  0              THEN 'PARTIALLY_PAID'
      ELSE 'UNPAID' END;

-- Stock = everything purchased - everything sold (per fruit AND size) ----
UPDATE stock st
LEFT JOIN (SELECT fruit_id, packaging_size, SUM(quantity) q FROM purchase_details GROUP BY fruit_id, packaging_size) p
       ON p.fruit_id = st.fruit_id AND p.packaging_size = st.packaging_size
LEFT JOIN (SELECT fruit_id, packaging_size, SUM(quantity) q FROM sales_details GROUP BY fruit_id, packaging_size) s
       ON s.fruit_id = st.fruit_id AND s.packaging_size = st.packaging_size
SET st.available_quantity = COALESCE(p.q,0) - COALESCE(s.q,0);
