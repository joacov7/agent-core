-- Esquema de guaynet (transcripción de backend/alembic/versions/001_initial_schema.py).
-- Solo para los tests de integración: si guaynet migra su esquema, hay que actualizarlo.
CREATE TYPE devicestatus AS ENUM ('online', 'offline', 'unknown');
CREATE TYPE ubiquitidevicetype AS ENUM ('airmax_ap', 'airmax_station', 'unifi_ap', 'unifi_switch', 'unifi_gateway');
CREATE TYPE clientstatus AS ENUM ('active', 'suspended', 'cancelled');
CREATE TYPE invoicestatus AS ENUM ('draft', 'pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE paymentmethod AS ENUM ('cash', 'transfer', 'mercadopago', 'other');

CREATE TABLE users (
  id SERIAL PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL DEFAULT '', hashed_password VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true, is_superuser BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT,
  download_mbps INTEGER NOT NULL, upload_mbps INTEGER NOT NULL,
  burst_download_mbps INTEGER, burst_upload_mbps INTEGER, burst_threshold_mbps INTEGER,
  burst_time_seconds INTEGER NOT NULL DEFAULT 10, price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mikrotik_routers (
  id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 8728, username VARCHAR(100) NOT NULL, password_encrypted VARCHAR(600) NOT NULL,
  location VARCHAR(255), notes TEXT, status devicestatus NOT NULL DEFAULT 'unknown', last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ubiquiti_devices (
  id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, host VARCHAR(255) NOT NULL,
  device_type ubiquitidevicetype NOT NULL, username VARCHAR(100), password_encrypted VARCHAR(600),
  mac_address VARCHAR(17), mikrotik_router_id INTEGER REFERENCES mikrotik_routers(id) ON DELETE SET NULL,
  location VARCHAR(255), notes TEXT, status devicestatus NOT NULL DEFAULT 'unknown', last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id SERIAL PRIMARY KEY, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
  dni VARCHAR(20), cuit VARCHAR(20), phone VARCHAR(50), email VARCHAR(255), address VARCHAR(500), notes TEXT,
  ip_address VARCHAR(45) NOT NULL UNIQUE, mac_address VARCHAR(17),
  plan_id INTEGER NOT NULL REFERENCES plans(id), router_id INTEGER NOT NULL REFERENCES mikrotik_routers(id),
  ubiquiti_device_id INTEGER REFERENCES ubiquiti_devices(id) ON DELETE SET NULL,
  status clientstatus NOT NULL DEFAULT 'active', service_start_date DATE, billing_day INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_clients_dni ON clients (dni);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), period VARCHAR(7) NOT NULL,
  amount NUMERIC(10,2) NOT NULL, issue_date DATE NOT NULL, due_date DATE NOT NULL, paid_date DATE,
  status invoicestatus NOT NULL DEFAULT 'pending', notes TEXT,
  afip_cae VARCHAR(20), afip_cae_expiry DATE, invoice_type VARCHAR(1), invoice_point_of_sale INTEGER, invoice_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_invoices_client_id ON invoices (client_id);
CREATE INDEX ix_invoices_due_date ON invoices (due_date);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id), amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL, method paymentmethod NOT NULL, reference VARCHAR(255), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_payments_invoice_id ON payments (invoice_id);
