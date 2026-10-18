# DeskManager — Database Schema Reference

> **Database:** `postgres` · **Host:** `localhost:5432` · **Engine:** PostgreSQL 18
> Generated from live DB via `information_schema` — **57 tables** total.

---

## Table of Contents

| # | Domain | Tables |
|---|--------|--------|
| 1 | [Core / Auth](#1-core--auth) | `companies`, `users`, `buyers`, `customers`, `status`, `units`, `gst_rates` |
| 2 | [Trades](#2-trades) | `trades`, `trades_old` |
| 3 | [Items & Inventory](#3-items--inventory) | `items`, `inventory`, `trace`, `trace_item` |
| 4 | [RFQ & Quotations](#4-rfq--quotations) | `rfqs`, `rfq_items`, `quotations`, `quotation_items`, `received_quotations`, `received_quotation_items`, `quotation_received_quotations` |
| 5 | [Purchase Orders](#5-purchase-orders) | `purchase_orders`, `purchase_order_items` |
| 6 | [Release Orders](#6-release-orders) | `release_orders`, `release_order_items` |
| 7 | [Contracts](#7-contracts) | `contracts`, `contract_items` |
| 8 | [Delivery](#8-delivery) | `delivery_notes`, `delivery_note_items`, `delivery_invoices`, `delivery_invoice_items` |
| 9 | [GRN & Rejections](#9-grn--rejections) | `grns`, `rejections`, `rejection_items` |
| 10 | [Invoices & Payments](#10-invoices--payments) | `invoices`, `invoice_items`, `payments`, `payment_items` |
| 11 | [Process / Manufacturing](#11-process--manufacturing) | `job`, `manufacture`, `source_item`, `target_item`, `multiple_item`, `p_item` |
| 12 | [Process PO (Internal)](#12-process-po-internal) | `process_po`, `process_po_item`, `process_po_items`, `process_pos`, `process_po_source_item`, `process_po_target_item`, `po_process`, `po_process_item`, `po_process_items` |
| 13 | [Process RFQ (Internal)](#13-process-rfq-internal) | `rq_process`, `process_received_rfqs`, `process_rfq_items` |
| 14 | [Vendor Orders](#14-vendor-orders) | `vendor_purchase_orders`, `vendor_purchase_order_items` |

---

## 1. Core / Auth

### `companies`
```sql
CREATE TABLE companies (
  id             SERIAL        PRIMARY KEY,
  name           VARCHAR(255)  NOT NULL,
  owner_name     VARCHAR(255),
  owner_username VARCHAR(100),
  phone          VARCHAR(50),
  email          VARCHAR(255),
  address        TEXT,
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `users`
```sql
CREATE TABLE users (
  username      VARCHAR(100)  NOT NULL,          -- PK (no serial id)
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(50)   DEFAULT 'operator',
  name          VARCHAR(255),
  surname       VARCHAR(255),
  owner_name    VARCHAR(255),
  company_name  VARCHAR(255),
  phone         VARCHAR(50),
  email         VARCHAR(255),
  permissions   JSONB         DEFAULT '[]',       -- ["view_pricing","admin",...]
  theme         JSONB         DEFAULT NULL,       -- {"primary":"#0f172a","secondary":"#D9352D",...}
  company_id    INTEGER       REFERENCES companies(id),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `buyers`
```sql
CREATE TABLE buyers (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(255)  NOT NULL,
  email       VARCHAR(255)  NOT NULL,
  phone       VARCHAR(50)   NOT NULL,
  company_id  INTEGER       REFERENCES companies(id),
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `customers`
```sql
CREATE TABLE customers (
  id            SERIAL        PRIMARY KEY,
  customer_code VARCHAR(100)  NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  address       TEXT          NOT NULL,
  company_id    INTEGER       REFERENCES companies(id),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `status`
```sql
CREATE TABLE status (
  name       VARCHAR(100)  NOT NULL,
  company_id INTEGER       NOT NULL
  -- composite PK: (name, company_id)
);
```

### `units`
```sql
CREATE TABLE units (
  name       VARCHAR(50)  NOT NULL,
  company_id INTEGER      NOT NULL
  -- composite PK: (name, company_id)
);
```

### `gst_rates`
```sql
CREATE TABLE gst_rates (
  id         SERIAL      PRIMARY KEY,
  type       VARCHAR(50) NOT NULL,
  rate       NUMERIC(5)  NOT NULL,
  company_id INTEGER     REFERENCES companies(id),
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Trades

### `trades`
```sql
CREATE TABLE trades (
  id                  SERIAL        PRIMARY KEY,
  trade_id            VARCHAR(100)  NOT NULL UNIQUE,
  documents           JSONB         NOT NULL DEFAULT '[]',
  status              VARCHAR(50)   DEFAULT 'rfq',
  trade_type          VARCHAR(50)   DEFAULT 'sell',  -- 'sell' | 'buy'
  company_id          INTEGER       REFERENCES companies(id),
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  delivery_percentage NUMERIC(5)    DEFAULT 0
);
```



---

## 3. Items & Inventory

### `items`
```sql
CREATE TABLE items (
  id               SERIAL        PRIMARY KEY,
  item_code        VARCHAR(100)  NOT NULL,
  description      VARCHAR(500)  NOT NULL,
  drawing_number   VARCHAR(255),
  long_description TEXT,
  margin           NUMERIC(10,2) DEFAULT 0.00,
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `inventory`
```sql
CREATE TABLE inventory (
  id            SERIAL      PRIMARY KEY,
  location      VARCHAR(255),
  company_id    INTEGER     REFERENCES companies(id),
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  trace_item_id INTEGER     REFERENCES trace_item(id)
);
```

### `trace`
```sql
CREATE TABLE trace (
  id           SERIAL        PRIMARY KEY,
  item_code    INTEGER,               -- references items.id
  qty          NUMERIC(12)   DEFAULT 0,
  cost_price   NUMERIC(12)   DEFAULT 0.00,
  inventory_id INTEGER       REFERENCES inventory(id),
  history      JSONB         DEFAULT '[]',
  status       VARCHAR(50)   DEFAULT 'In Inventory',
  company_id   INTEGER       REFERENCES companies(id),
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```



---

## 4. RFQ & Quotations

### `rfqs`
```sql
CREATE TABLE rfqs (
  id                      SERIAL        PRIMARY KEY,
  rfq_no                  VARCHAR(100)  NOT NULL,
  rfq_date                DATE          NOT NULL,
  commercial_bid_due_date DATE          NOT NULL,
  technical_bid_due_date  DATE          NOT NULL,
  buyer_id                INTEGER       REFERENCES buyers(id),
  customer_id             INTEGER       REFERENCES customers(id),
  trade_id                INTEGER       REFERENCES trades(id),
  status                  VARCHAR(50)   DEFAULT 'quotation',
  company_id              INTEGER       REFERENCES companies(id),
  created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `rfq_items`
```sql
CREATE TABLE rfq_items (
  id         SERIAL        PRIMARY KEY,
  rfq_id     INTEGER       REFERENCES rfqs(id),
  item_id    INTEGER       REFERENCES items(id),
  quantity   NUMERIC(12)   NOT NULL DEFAULT 1,
  unit       VARCHAR(50)   DEFAULT 'Piece',
  company_id INTEGER       REFERENCES companies(id),
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `quotations`
```sql
CREATE TABLE quotations (
  id                   SERIAL        PRIMARY KEY,
  quotation_no         VARCHAR(100)  NOT NULL,
  rfq_id               INTEGER       REFERENCES rfqs(id),
  quotation_date       DATE          NOT NULL,
  terms_and_conditions TEXT,
  trade_id             INTEGER       REFERENCES trades(id),
  status               VARCHAR(50)   DEFAULT 'active',
  company_id           INTEGER       REFERENCES companies(id),
  created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `quotation_items`
```sql
CREATE TABLE quotation_items (
  id           SERIAL        PRIMARY KEY,
  quotation_id INTEGER       REFERENCES quotations(id),
  item_id      INTEGER       REFERENCES items(id),
  quantity     NUMERIC(12)   NOT NULL,
  unit_price   NUMERIC(12)   NOT NULL,
  unit         VARCHAR(50)   DEFAULT 'Piece',
  company_id   INTEGER       REFERENCES companies(id),
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `received_quotations`
```sql
CREATE TABLE received_quotations (
  id                    SERIAL        PRIMARY KEY,
  received_quotation_no VARCHAR(100)  NOT NULL,
  buyer_id              INTEGER       REFERENCES buyers(id),
  customer_id           INTEGER       REFERENCES customers(id),
  quotation_date        DATE          NOT NULL,
  terms_and_conditions  TEXT,
  trade_id              INTEGER       REFERENCES trades(id),
  company_id            INTEGER       REFERENCES companies(id),
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `received_quotation_items`
```sql
CREATE TABLE received_quotation_items (
  id                    SERIAL        PRIMARY KEY,
  received_quotation_id INTEGER       REFERENCES received_quotations(id),
  item_id               INTEGER       REFERENCES items(id),
  quantity              NUMERIC(12)   NOT NULL,
  unit_price            NUMERIC(12)   NOT NULL,
  process_name          VARCHAR(255),
  expected_output_code  VARCHAR(255),
  target_item_id        INTEGER       REFERENCES items(id),
  target_quantity       INTEGER       DEFAULT 1,
  company_id            INTEGER       REFERENCES companies(id),
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `quotation_received_quotations`
```sql
-- Junction: quotations <-> received_quotations (many-to-many)
CREATE TABLE quotation_received_quotations (
  quotation_id          INTEGER  NOT NULL REFERENCES quotations(id),
  received_quotation_id INTEGER  NOT NULL REFERENCES received_quotations(id),
  company_id            INTEGER  REFERENCES companies(id),
  PRIMARY KEY (quotation_id, received_quotation_id)
);
```

---

## 5. Purchase Orders

### `purchase_orders`
```sql
CREATE TABLE purchase_orders (
  id                    SERIAL        PRIMARY KEY,
  po_no                 VARCHAR(100)  NOT NULL UNIQUE,
  quotation_id          INTEGER       REFERENCES quotations(id),
  received_quotation_id INTEGER       REFERENCES received_quotations(id),
  contract_ref          VARCHAR(255),
  po_date               DATE          NOT NULL,
  delivery_date         DATE,
  gst                   NUMERIC(12)   DEFAULT 0.00,
  gst_type              VARCHAR(50),
  gst_rate              NUMERIC(5)    DEFAULT 0.00,
  transport             NUMERIC(12)   DEFAULT 0.00,
  other                 NUMERIC(12)   DEFAULT 0.00,
  basic_value           NUMERIC(12)   DEFAULT 0.00,
  packing_forward       NUMERIC(12)   DEFAULT 0.00,
  trade_id              INTEGER       REFERENCES trades(id),
  company_id            INTEGER       REFERENCES companies(id),
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `purchase_order_items`
```sql
CREATE TABLE purchase_order_items (
  id                  SERIAL        PRIMARY KEY,
  po_id               INTEGER       REFERENCES purchase_orders(id),
  item_id             INTEGER       REFERENCES items(id),
  quantity            NUMERIC(12)   NOT NULL,
  unit_price          NUMERIC(12)   NOT NULL,
  gst_type            VARCHAR(50),
  gst_rate            NUMERIC(5)    DEFAULT 0.00,
  shipping_address    TEXT,
  delivery_date       DATE,
  status              VARCHAR(50)   DEFAULT 'ordered',
  vendor              VARCHAR(255)  DEFAULT '',
  target_item_id      INTEGER       REFERENCES items(id),
  target_quantity     INTEGER       DEFAULT 1,
  linked_inventory_id INTEGER       REFERENCES inventory(id),
  company_id          INTEGER       REFERENCES companies(id),
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Release Orders

### `release_orders`
```sql
CREATE TABLE release_orders (
  id              SERIAL        PRIMARY KEY,
  ro_no           VARCHAR(100)  NOT NULL UNIQUE,
  contract_ref    VARCHAR(255),
  buyer_id        INTEGER       REFERENCES buyers(id),
  customer_id     INTEGER       REFERENCES customers(id),
  ro_date         DATE          NOT NULL,
  delivery_date   DATE,
  gst             NUMERIC(12)   DEFAULT 0.00,
  gst_type        VARCHAR(50),
  gst_rate        NUMERIC(5)    DEFAULT 0.00,
  transport       NUMERIC(12)   DEFAULT 0.00,
  other           NUMERIC(12)   DEFAULT 0.00,
  basic_value     NUMERIC(12)   DEFAULT 0.00,
  packing_forward NUMERIC(12)   DEFAULT 0.00,
  trade_id        INTEGER       REFERENCES trades(id),
  company_id      INTEGER       REFERENCES companies(id),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `release_order_items`
```sql
CREATE TABLE release_order_items (
  id               SERIAL        PRIMARY KEY,
  ro_id            INTEGER       REFERENCES release_orders(id),
  item_id          INTEGER       REFERENCES items(id),
  quantity         NUMERIC(12)   NOT NULL,
  unit_price       NUMERIC(12)   NOT NULL,
  gst_type         VARCHAR(50),
  gst_rate         NUMERIC(5)    DEFAULT 0.00,
  shipping_address TEXT,
  delivery_date    DATE,
  status           VARCHAR(50)   DEFAULT 'ordered',
  vendor           VARCHAR(255)  DEFAULT '',
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Contracts

### `contracts`
```sql
CREATE TABLE contracts (
  id           SERIAL        PRIMARY KEY,
  company_name VARCHAR(255),
  company_id   INTEGER       REFERENCES companies(id),
  buyer_id     INTEGER       REFERENCES buyers(id),
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
   type    
);
```

### `contract_items`
```sql
CREATE TABLE contract_items (
  id          SERIAL      PRIMARY KEY,
  contract_id INTEGER     REFERENCES contracts(id),
  item_id     INTEGER     REFERENCES items(id),
  price       NUMERIC(12) NOT NULL,
  date        DATE,
  expiry_date DATE,
  history     JSONB       DEFAULT '[]',   -- [{price, date}] snapshots
  company_id  INTEGER     REFERENCES companies(id),
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Delivery

### `delivery_notes`
```sql
CREATE TABLE delivery_notes (
  id               SERIAL        PRIMARY KEY,
  delivery_note_no VARCHAR(100)  NOT NULL,
  po_id            INTEGER       REFERENCES purchase_orders(id),
  ro_id            INTEGER       REFERENCES release_orders(id),
  delivery_date    DATE          NOT NULL,
  dispatch_doc_no  VARCHAR(255),
  dispatch_through VARCHAR(255)  NOT NULL,
  motor_vehicle_no VARCHAR(255)  NOT NULL,
  trade_id         INTEGER       REFERENCES trades(id),
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `delivery_note_items`
```sql
CREATE TABLE delivery_note_items (
  id                           SERIAL      PRIMARY KEY,
  delivery_note_id             INTEGER     REFERENCES delivery_notes(id),
  item_id                      INTEGER     REFERENCES items(id),
  quantity                     NUMERIC(12) NOT NULL,
  rate_per_piece               NUMERIC(12) NOT NULL,
  shipping_address             TEXT,
  delivery_date                DATE,
  next_activity                JSONB,
  process_target_trace_item_id INTEGER     REFERENCES trace_item(id),
  company_id                   INTEGER     REFERENCES companies(id),
  created_at                   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `delivery_invoices`
```sql
-- Legacy challan-linked invoice
CREATE TABLE delivery_invoices (
  invoice_no          VARCHAR(100)  NOT NULL,   -- PK
  delivery_challan_no VARCHAR(100),
  ro_no               VARCHAR(100),
  po_no               VARCHAR(100),
  invoice_date        DATE          NOT NULL,
  delivery_date       DATE,
  dispatch_through    VARCHAR(255),
  motor_vehicle_no    VARCHAR(100),
  gst                 NUMERIC(12)   DEFAULT 0.00,
  transport           NUMERIC(12)   DEFAULT 0.00,
  other               NUMERIC(12)   DEFAULT 0.00,
  basic_value         NUMERIC(12)   DEFAULT 0.00,
  packing_forward     NUMERIC(12)   DEFAULT 0.00,
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `delivery_invoice_items`
```sql
CREATE TABLE delivery_invoice_items (
  id         SERIAL        PRIMARY KEY,
  invoice_no VARCHAR(100)  NOT NULL,
  item_code  VARCHAR(100)  NOT NULL,
  quantity   INTEGER       NOT NULL,
  unit_price NUMERIC(12)   NOT NULL,
  gst_type   VARCHAR(100),
  gst_rate   NUMERIC(5)    DEFAULT 0.00,
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 9. GRN & Rejections

### `grns`
```sql
CREATE TABLE grns (
  id               SERIAL        PRIMARY KEY,
  grn_no           VARCHAR(100)  NOT NULL,
  delivery_note_id INTEGER       REFERENCES delivery_notes(id),
  trade_id         INTEGER       REFERENCES trades(id),
  grn_date         DATE          NOT NULL,
  has_rejection    BOOLEAN       DEFAULT false,
  rejection_items  JSONB         NOT NULL DEFAULT '[]',  -- [{item_code, quantity}]
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `rejections`
```sql
CREATE TABLE rejections (
  rejection_no     VARCHAR(100)  NOT NULL,  -- PK
  delivery_note_no VARCHAR(100),
  trade_id         VARCHAR(100),
  rejection_date   DATE          NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `rejection_items`
```sql
CREATE TABLE rejection_items (
  id            SERIAL        PRIMARY KEY,
  rejection_no  VARCHAR(100)  NOT NULL,
  item_code     VARCHAR(100)  NOT NULL,
  quantity      INTEGER       NOT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Invoices & Payments

### `invoices`
```sql
CREATE TABLE invoices (
  id               SERIAL        PRIMARY KEY,
  invoice_no       VARCHAR(100)  NOT NULL,
  invoice_date     DATE          NOT NULL,
  delivery_note_id INTEGER       REFERENCES delivery_notes(id),
  po_id            INTEGER       REFERENCES purchase_orders(id),
  ro_id            INTEGER       REFERENCES release_orders(id),
  dispatch_doc_no  VARCHAR(255),
  dispatch_through VARCHAR(255)  NOT NULL,
  motor_vehicle_no VARCHAR(255)  NOT NULL,
  trade_id         INTEGER       REFERENCES trades(id),
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `invoice_items`
```sql
CREATE TABLE invoice_items (
  id               SERIAL      PRIMARY KEY,
  invoice_id       INTEGER     REFERENCES invoices(id),
  item_id          INTEGER     REFERENCES items(id),
  quantity         NUMERIC(12) NOT NULL,
  rate_per_piece   NUMERIC(12) NOT NULL,
  shipping_address TEXT,
  delivery_date    DATE,
  company_id       INTEGER     REFERENCES companies(id),
  created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `payments`
```sql
CREATE TABLE payments (
  id               SERIAL        PRIMARY KEY,
  payment_no       VARCHAR(100)  NOT NULL,
  delivery_note_id INTEGER       REFERENCES delivery_notes(id),
  trade_id         INTEGER       REFERENCES trades(id),
  payment_date     DATE          NOT NULL,
  total_amount     NUMERIC(12)   NOT NULL,
  po_id            INTEGER       REFERENCES purchase_orders(id),
  ro_id            INTEGER       REFERENCES release_orders(id),
  note             TEXT,
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `payment_items`
```sql
CREATE TABLE payment_items (
  id         SERIAL        PRIMARY KEY,
  payment_no VARCHAR(100)  REFERENCES payments(payment_no),
  po_no      VARCHAR(100),
  ro_no      VARCHAR(100),
  amount     NUMERIC(12)   NOT NULL DEFAULT 0.00,
  status     VARCHAR(50),
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 11. Process / Manufacturing

### `job`
```sql
CREATE TABLE job (
  id            SERIAL        PRIMARY KEY,
  process_name  VARCHAR(255),
  date_of_start DATE,
  date_of_end   DATE,
  message       TEXT,
  company_id    INTEGER       REFERENCES companies(id),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `manufacture`
```sql
CREATE TABLE manufacture (
  id         SERIAL      PRIMARY KEY,
  status     VARCHAR(50) DEFAULT 'in_progress',
  job_id     INTEGER     REFERENCES job(id),
  loss_qty   JSONB       DEFAULT '[]',  -- [{item_code, qty}]
  company_id INTEGER     REFERENCES companies(id),
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `source_item`
```sql
CREATE TABLE source_item (
  id         SERIAL    PRIMARY KEY,
  job_id     INTEGER   REFERENCES job(id),
  items      JSONB     DEFAULT '[]',  -- [{item_code, qty, trace_id}]
  company_id INTEGER   REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `target_item`
```sql
CREATE TABLE target_item (
  id         SERIAL    PRIMARY KEY,
  job_id     INTEGER   REFERENCES job(id),
  items      JSONB     DEFAULT '[]',  -- [{item_code, qty, trace_id}]
  company_id INTEGER   REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `multiple_item`
```sql
CREATE TABLE multiple_item (
  id                  SERIAL      PRIMARY KEY,
  manufacture_item_id INTEGER,
  source_item_id      INTEGER     REFERENCES source_item(id),
  trace_id            INTEGER     REFERENCES trace(id),
  qty                 NUMERIC(12) DEFAULT 0,
  company_id          INTEGER     REFERENCES companies(id),
  created_at          TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `p_item`
```sql
-- Older parallel to trace_item
CREATE TABLE p_item (
  id         SERIAL      PRIMARY KEY,
  item_code  INTEGER,
  process    INTEGER[]   DEFAULT '{}',   -- array of process IDs
  message    TEXT,
  quantity   INTEGER     DEFAULT 0,
  price      NUMERIC(12) DEFAULT 0.00,
  company_id INTEGER     REFERENCES companies(id),
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. Process PO (Internal)

### `process_po`
```sql
CREATE TABLE process_po (
  id               SERIAL        PRIMARY KEY,
  po_no            VARCHAR(100)  NOT NULL,
  date             DATE,
  delivery_date    DATE,
  date_of_start    DATE,
  date_of_end      DATE,
  rq_process_id    INTEGER       REFERENCES rq_process(id),
  received_q_id    INTEGER       REFERENCES received_quotations(id),
  trade_id         INTEGER       REFERENCES trades(id),
  seller           VARCHAR(255),
  party            VARCHAR(255),
  gst_type         VARCHAR(50)   DEFAULT 'CGST+SGST',
  gst_rate         NUMERIC(5)    DEFAULT 0.00,
  gst              NUMERIC(12)   DEFAULT 0.00,
  transport        NUMERIC(12)   DEFAULT 0.00,
  packing_forward  NUMERIC(12)   DEFAULT 0.00,
  other            NUMERIC(12)   DEFAULT 0.00,
  basic_value      NUMERIC(12)   DEFAULT 0.00,
  shipping_address TEXT,
  job_ids          JSONB         DEFAULT '[]',
  message          TEXT,
  company_id       INTEGER       REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `process_po_item`
```sql
CREATE TABLE process_po_item (
  id                    SERIAL      PRIMARY KEY,
  process_po_id         INTEGER     REFERENCES process_po(id),
  source_item_id        INTEGER     REFERENCES items(id),
  target_item_id        INTEGER     REFERENCES items(id),
  source_trace_id_array JSONB       DEFAULT '[]',
  target_trace_id_array JSONB       DEFAULT '[]',
  process_name          VARCHAR(255),
  price                 NUMERIC(12) DEFAULT 0.00,
  source_qty            NUMERIC     DEFAULT 0,
  target_qty            NUMERIC     DEFAULT 0,
  delivered_qty         NUMERIC(12) DEFAULT 0,
  delivered_price       NUMERIC(12) DEFAULT 0,
  remaining_price       NUMERIC(12) DEFAULT 0,
  company_id            INTEGER     REFERENCES companies(id),
  created_at            TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `process_po_items`
```sql
CREATE TABLE process_po_items (
  id                SERIAL        PRIMARY KEY,
  prpo_id           INTEGER       REFERENCES process_pos(id),
  prrfq_item_id     INTEGER       REFERENCES process_rfq_items(id),
  source_item_code  VARCHAR(100),
  target_item_code  VARCHAR(100),
  process_name      VARCHAR(200),
  quantity          INTEGER       NOT NULL DEFAULT 1,
  unit_price        NUMERIC(12)   NOT NULL DEFAULT 0,
  gst_type          VARCHAR(50),
  gst_rate          NUMERIC(5)    DEFAULT 0,
  delivery_date     DATE,
  delivery_location TEXT,
  company_id        INTEGER       NOT NULL REFERENCES companies(id)
);
```

### `process_pos`
```sql
CREATE TABLE process_pos (
  id              SERIAL        PRIMARY KEY,
  prpo_no         VARCHAR(50)   NOT NULL,
  prrfq_no        VARCHAR(50)   NOT NULL,
  po_date         DATE          NOT NULL,
  trade_id        INTEGER       REFERENCES trades(id),
  transport       NUMERIC(12)   DEFAULT 0,
  packing_forward NUMERIC(12)   DEFAULT 0,
  other           NUMERIC(12)   DEFAULT 0,
  basic_value     NUMERIC(12)   DEFAULT 0,
  company_id      INTEGER       NOT NULL REFERENCES companies(id),
  created_at      TIMESTAMPTZ   DEFAULT now()
);
```

### `process_po_source_item`
```sql
CREATE TABLE process_po_source_item (
  id            SERIAL      PRIMARY KEY,
  process_po_id INTEGER     REFERENCES process_po(id),
  item_code     INTEGER,
  trace_item_id INTEGER     REFERENCES trace_item(id),
  qty           NUMERIC(12) NOT NULL DEFAULT 0,
  company_id    INTEGER     REFERENCES companies(id),
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `process_po_target_item`
```sql
CREATE TABLE process_po_target_item (
  id               SERIAL      PRIMARY KEY,
  process_po_id    INTEGER     REFERENCES process_po(id),
  item_code        INTEGER,
  qty              NUMERIC(12) NOT NULL DEFAULT 0,
  delivered_qty    NUMERIC(12) NOT NULL DEFAULT 0,
  price            NUMERIC(12) DEFAULT 0.00,
  gst_type         VARCHAR(50),
  gst_rate         NUMERIC(5)  DEFAULT 0.00,
  shipping_address TEXT,
  delivery_date    DATE,
  status           VARCHAR(50) DEFAULT 'ordered',
  process_name     VARCHAR,
  company_id       INTEGER     REFERENCES companies(id),
  created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `po_process`
```sql
CREATE TABLE po_process (
  id               SERIAL        PRIMARY KEY,
  po_no            VARCHAR(100)  NOT NULL,
  quotation_no     VARCHAR(100),
  trade_id         INTEGER       REFERENCES trades(id),
  po_date          DATE          NOT NULL,
  delivery_date    DATE,
  shipping_address TEXT,
  basic_value      NUMERIC(15)   DEFAULT 0,
  gst              NUMERIC(15)   DEFAULT 0,
  transport        NUMERIC(15)   DEFAULT 0,
  packing_forward  NUMERIC(15)   DEFAULT 0,
  other            NUMERIC(15)   DEFAULT 0,
  company_id       INTEGER       NOT NULL REFERENCES companies(id),
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `po_process_item`
```sql
CREATE TABLE po_process_item (
  id                        SERIAL      PRIMARY KEY,
  process_po_id             INTEGER     REFERENCES process_po(id),
  source_item_id            INTEGER     REFERENCES items(id),
  source_item_quantity      NUMERIC(15) NOT NULL DEFAULT 0,
  target_item_id            INTEGER     REFERENCES items(id),
  target_item_quantity      NUMERIC(15) NOT NULL DEFAULT 0,
  price                     NUMERIC(12) DEFAULT 0.00,
  source_item_traceid_array JSONB       DEFAULT '[]',
  target_item_traceid_array JSONB       DEFAULT '[]',
  company_id                INTEGER     REFERENCES companies(id),
  created_at                TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
```

### `po_process_items`
```sql
CREATE TABLE po_process_items (
  id                   SERIAL        PRIMARY KEY,
  po_process_id        INTEGER       REFERENCES po_process(id),
  item_id              INTEGER       REFERENCES items(id),
  process_name         VARCHAR(255),
  expected_output_code VARCHAR(255),
  quantity             NUMERIC(12)   NOT NULL,
  unit_price           NUMERIC(15)   DEFAULT 0,
  gst_rate             NUMERIC(5)    DEFAULT 0,
  linked_inventory_id  INTEGER       REFERENCES inventory(id),
  linked_trace_item_id INTEGER       REFERENCES trace_item(id),
  company_id           INTEGER       NOT NULL REFERENCES companies(id),
  created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 13. Process RFQ (Internal)

### `rq_process`
```sql
CREATE TABLE rq_process (
  id          SERIAL        PRIMARY KEY,
  number      VARCHAR(100)  NOT NULL,
  dateOfStart DATE          NOT NULL,
  dateOfEnd   DATE,
  seller      VARCHAR(255),
  party       VARCHAR(255),
  party_id    INTEGER       REFERENCES customers(id),
  customer_id INTEGER       REFERENCES customers(id),
  message     TEXT,
  trade_id    INTEGER       REFERENCES trades(id),
  job_ids     JSONB         DEFAULT '[]',
  company_id  INTEGER       REFERENCES companies(id),
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `process_received_rfqs`
```sql
CREATE TABLE process_received_rfqs (
  id             SERIAL        PRIMARY KEY,
  prrfq_no       VARCHAR(100)  NOT NULL,
  rfq_no         VARCHAR(255)  NOT NULL,
  rfq_date       DATE          NOT NULL,
  source_item_id INTEGER       REFERENCES items(id),
  target_item_id INTEGER       REFERENCES items(id),
  process_name   VARCHAR(255),
  price_per_unit NUMERIC(12),
  quantity       INTEGER       DEFAULT 1,
  trade_id       INTEGER       REFERENCES trades(id),
  company_id     INTEGER       REFERENCES companies(id),
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `process_rfq_items`
```sql
CREATE TABLE process_rfq_items (
  id             SERIAL        PRIMARY KEY,
  prrfq_id       INTEGER       REFERENCES process_received_rfqs(id),
  source_item_id INTEGER       REFERENCES items(id),
  target_item_id INTEGER       REFERENCES items(id),
  process_name   VARCHAR(255)  NOT NULL,
  price_per_unit NUMERIC(12)   NOT NULL,
  quantity       INTEGER       DEFAULT 1,
  company_id     INTEGER       REFERENCES companies(id),
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `processReceivedQuotation`
```sql
CREATE TABLE "processReceivedQuotation" (
  id                      SERIAL        PRIMARY KEY,
  quotation_number        VARCHAR(100)  NOT NULL,
  quotation_date          DATE          NOT NULL,
  commercial_bid_due_date DATE          NOT NULL,
  technical_bid_due_date  DATE          NOT NULL,
  buyer_id                INTEGER       REFERENCES buyers(id),
  customer_id             INTEGER       REFERENCES customers(id),
  trade_id                INTEGER       REFERENCES trades(id),
  status                  VARCHAR(50)   DEFAULT 'active',
  company_id              INTEGER       REFERENCES companies(id),
  created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `processReceivedQuotation_item`
```sql
CREATE TABLE "processReceivedQuotation_item" (
  id                            SERIAL        PRIMARY KEY,
  process_received_quotation_id INTEGER       REFERENCES "processReceivedQuotation"(id),
  item_id                       INTEGER       REFERENCES items(id),
  item_code                     VARCHAR(100)  NOT NULL,
  quantity                      NUMERIC(12, 3) NOT NULL DEFAULT 1,
  price                         DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  process_name                  VARCHAR(255)  NOT NULL,
  company_id                    INTEGER       REFERENCES companies(id),
  created_at                    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## 14. Vendor Orders

### `vendor_purchase_orders`
```sql
CREATE TABLE vendor_purchase_orders (
  po_no                 VARCHAR(100)  NOT NULL,   -- PK
  received_quotation_no VARCHAR(100),
  po_date               DATE          NOT NULL,
  delivery_date         DATE,
  payment_terms         TEXT,
  gst                   NUMERIC(12)   DEFAULT 0.00,
  transport             NUMERIC(12)   DEFAULT 0.00,
  other                 NUMERIC(12)   DEFAULT 0.00,
  basic_value           NUMERIC(12)   DEFAULT 0.00,
  packing_forward       NUMERIC(12)   DEFAULT 0.00,
  status                VARCHAR(100)  DEFAULT 'Pending',
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

### `vendor_purchase_order_items`
```sql
CREATE TABLE vendor_purchase_order_items (
  id               SERIAL        PRIMARY KEY,
  po_no            VARCHAR(100)  NOT NULL,
  item_code        VARCHAR(100)  NOT NULL,
  quantity         INTEGER       NOT NULL,
  pending_quantity INTEGER,
  unit_price       NUMERIC(12)   NOT NULL,
  gst_type         VARCHAR(100),
  gst_rate         NUMERIC(5)    DEFAULT 0.00,
  status           VARCHAR(50)   DEFAULT 'Pending',
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key Relationships (ERD Summary)

```
companies ──< users
companies ──< buyers
companies ──< customers
companies ──< items
companies ──< trades

trades ──< rfqs ──< rfq_items ──> items
trades ──< quotations ──< quotation_items ──> items
trades ──< received_quotations ──< received_quotation_items ──> items
quotations ─< quotation_received_quotations >─ received_quotations

trades ──< purchase_orders ──< purchase_order_items ──> items
trades ──< release_orders  ──< release_order_items  ──> items

purchase_orders ──< delivery_notes ──< delivery_note_items ──> items
release_orders  ──< delivery_notes

delivery_notes ──< grns
delivery_notes ──< invoices ──< invoice_items
delivery_notes ──< payments

trades ──< process_po ──< process_po_item
trades ──< rq_process ──< process_received_rfqs ──< process_rfq_items
trades ──< process_pos ──< process_po_items

items ──< inventory ──< trace
job ──< manufacture
job ──< source_item
job ──< target_item
```

---

## JSONB Columns Reference

| Table | Column | Contents |
|---|---|---|
| `trades` | `documents` | `[{type, url, name}]` |
| `grns` | `rejection_items` | `[{item_code, quantity}]` |
| `trace` | `history` | audit log array |
| `contract_items` | `history` | `[{price, date}]` price snapshots |
| `process_po` | `job_ids` | `[job_id, ...]` |
| `rq_process` | `job_ids` | `[job_id, ...]` |
| `trace_item` | `process` | process step array |
| `source_item` | `items` | `[{item_code, qty, trace_id}]` |
| `target_item` | `items` | `[{item_code, qty, trace_id}]` |
| `delivery_note_items` | `next_activity` | next workflow step object |
| `manufacture` | `loss_qty` | `[{item_code, qty}]` |
| `process_po_item` | `source_trace_id_array` | `[trace_item_id, ...]` |
| `process_po_item` | `target_trace_id_array` | `[trace_item_id, ...]` |
| `po_process_item` | `source_item_traceid_array` | `[trace_item_id, ...]` |
| `po_process_item` | `target_item_traceid_array` | `[trace_item_id, ...]` |
| `users` | `permissions` | `["view_pricing", "admin", ...]` |

---

## 15. Buy Process Contract Order (Direct Trade & Delivery Flow)

- **Entry**: `/addProcessContractOrder` accessible from Sidebar under **Buy Process → Contract Order**.
- **Form**: Process PO Form in **direct Contract Order mode** (clean, no auto-fill, fresh PO generation).
- **Backend Flow (`POST /api/process-po`)**:
  - When `trade_id` is not passed:
    - Automatically creates a new record in `trades` table (`trade_id = 'TRD-PPO-xxxx'`, `status = 'ordered'`, `trade_type = 'BUY_PROCESS'`, `documents = [{type: 'PO', id: po_no}]`).
    - Automatically creates linked manufacturing records: `job`, `source_item`, `target_item`, and `manufacture` (`status = 'in_progress'`), saving the generated ID into `process_po.job_ids`.
    - Associates `process_po.trade_id` with the newly created trade.
- **Next Step**:
  - Redirects to `/trade/:trade_id`.
  - The trade displays the Process Purchase Order with **Assigned Jobs** (raw materials and target output products).
  - Displays the **"Next Step: Delivery Note (DN)"** action banner with a direct link to `/addDeliveryNote?trade_id=${tradeId}` for finished goods dispatch.
