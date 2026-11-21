-- =====================================================================
-- PART D: SQL reporting queries  (the API runs these same statements)
-- =====================================================================
USE batloung_farm;

-- 1. The five most frequently sold fruits (by boxes sold) ---------------
SELECT f.fruit_id, f.fruit_name,
       SUM(sd.quantity)                  AS boxes_sold,
       COUNT(DISTINCT sd.sale_id)        AS number_of_sales
FROM sales_details sd
JOIN fruits f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY boxes_sold DESC, f.fruit_name
LIMIT 5;

-- 2. Total sales revenue within a date range ----------------------------
SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
       COUNT(*)                       AS number_of_sales
FROM sales
WHERE sale_date BETWEEN '2026-10-01' AND '2026-10-31';

-- 3. The vendor who has purchased the highest number of boxes -----------
SELECT v.vendor_id, v.vendor_name, SUM(sd.quantity) AS total_boxes
FROM vendors v
JOIN sales s          ON s.vendor_id = v.vendor_id
JOIN sales_details sd ON sd.sale_id  = s.sale_id
GROUP BY v.vendor_id, v.vendor_name
ORDER BY total_boxes DESC
LIMIT 1;

-- 4. Current stock levels for each fruit and packaging size -------------
SELECT f.fruit_name, st.packaging_size, st.available_quantity, st.selling_price
FROM stock st
JOIN fruits f ON f.fruit_id = st.fruit_id
ORDER BY f.fruit_name, FIELD(st.packaging_size,'SMALL','MEDIUM','LARGE');

-- Extra: outstanding balance per vendor ---------------------------------
SELECT v.vendor_id, v.vendor_name,
       COALESCE(SUM(s.total_amount),0)                          AS total_billed,
       COALESCE(SUM(p.paid),0)                                  AS total_paid,
       COALESCE(SUM(s.total_amount),0) - COALESCE(SUM(p.paid),0) AS outstanding_balance
FROM vendors v
LEFT JOIN sales s ON s.vendor_id = v.vendor_id
LEFT JOIN (SELECT sale_id, SUM(amount) paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id
GROUP BY v.vendor_id, v.vendor_name
ORDER BY outstanding_balance DESC;

-- Extra: the transaction pattern used by the API (see sales.model.js) ----
-- BEGIN;
--   SELECT available_quantity FROM stock WHERE fruit_id=1 AND packaging_size='LARGE' FOR UPDATE;
--   -- if available_quantity < requested  ->  ROLLBACK;  (nothing is changed)
--   INSERT INTO sales ...; INSERT INTO sales_details ...;
--   UPDATE stock SET available_quantity = available_quantity - 10 WHERE ...;
-- COMMIT;
