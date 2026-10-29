-- Esquema REAL de guaynet: volcado (pg_dump --schema-only) de aplicar sus 43 migraciones de Alembic
-- (alembic upgrade head) sobre Postgres 16. Fuente: joacov7/guaynet, rama claude/wisp-management-system-TTAsI,
-- commit 14527ab. Solo para los tests de integración.
-- Para regenerarlo: crear una base vacía, correr 'alembic upgrade head' y volcar con:
--   pg_dump --schema-only --no-owner --no-privileges --no-comments <base>
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)


--
-- Name: clientstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clientstatus AS ENUM (
    'active',
    'suspended',
    'cancelled'
);


--
-- Name: devicestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.devicestatus AS ENUM (
    'online',
    'offline',
    'unknown'
);


--
-- Name: equipmentcondition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.equipmentcondition AS ENUM (
    'new',
    'good',
    'damaged',
    'scrapped'
);


--
-- Name: equipmentstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.equipmentstatus AS ENUM (
    'in_stock',
    'assigned',
    'returned',
    'lost'
);


--
-- Name: expensecategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expensecategory AS ENUM (
    'hosting',
    'equipment',
    'energy',
    'labor',
    'internet',
    'transport',
    'software',
    'maintenance',
    'other'
);


--
-- Name: invoicestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoicestatus AS ENUM (
    'draft',
    'pending',
    'paid',
    'overdue',
    'cancelled'
);


--
-- Name: paymentmethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.paymentmethod AS ENUM (
    'cash',
    'transfer',
    'mercadopago',
    'other'
);


--
-- Name: ticketcategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticketcategory AS ENUM (
    'connectivity',
    'speed',
    'billing',
    'equipment',
    'installation',
    'other'
);


--
-- Name: ticketpriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticketpriority AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: ticketstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticketstatus AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);


--
-- Name: ubiquitidevicetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ubiquitidevicetype AS ENUM (
    'airmax_ap',
    'airmax_station',
    'unifi_ap',
    'unifi_switch',
    'unifi_gateway',
    'airmax_ac_ap',
    'airmax_ac_station'
);




--
-- Name: alarms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alarms (
    id integer NOT NULL,
    router_id integer NOT NULL,
    type character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    triggered_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    details json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alarms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alarms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alarms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alarms_id_seq OWNED BY public.alarms.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    username character varying(50) DEFAULT 'system'::character varying NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    entity_name character varying(200) DEFAULT ''::character varying NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: automation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_logs (
    id integer NOT NULL,
    job character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    message text,
    affected integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: automation_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automation_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: automation_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automation_logs_id_seq OWNED BY public.automation_logs.id;


--
-- Name: bandwidth_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bandwidth_samples (
    id integer NOT NULL,
    router_id integer NOT NULL,
    client_id integer,
    ip_address character varying(50) NOT NULL,
    queue_name character varying(200) NOT NULL,
    upload_bytes bigint DEFAULT '0'::bigint NOT NULL,
    download_bytes bigint DEFAULT '0'::bigint NOT NULL,
    sampled_at timestamp with time zone NOT NULL
);


--
-- Name: bandwidth_samples_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bandwidth_samples_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bandwidth_samples_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bandwidth_samples_id_seq OWNED BY public.bandwidth_samples.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    dni character varying(20),
    cuit character varying(20),
    phone character varying(50),
    email character varying(255),
    address character varying(500),
    notes text,
    ip_address character varying(45) NOT NULL,
    mac_address character varying(17),
    plan_id integer NOT NULL,
    router_id integer NOT NULL,
    ubiquiti_device_id integer,
    status public.clientstatus DEFAULT 'active'::public.clientstatus NOT NULL,
    service_start_date date,
    billing_day integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision,
    longitude double precision,
    portal_enabled boolean DEFAULT false NOT NULL,
    portal_password_hash character varying(255),
    zone_id integer,
    pppoe_username character varying(100),
    pppoe_password_encrypted character varying(500)
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    description character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    category public.expensecategory DEFAULT 'other'::public.expensecategory NOT NULL,
    expense_date date NOT NULL,
    vendor character varying(255),
    invoice_number character varying(100),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    brand character varying(100),
    model character varying(100),
    serial_number character varying(255),
    quantity integer DEFAULT 1 NOT NULL,
    unit_cost numeric(10,2),
    condition public.equipmentcondition DEFAULT 'new'::public.equipmentcondition NOT NULL,
    status public.equipmentstatus DEFAULT 'in_stock'::public.equipmentstatus NOT NULL,
    client_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    description character varying(255) NOT NULL,
    quantity numeric(10,3) DEFAULT '1'::numeric NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL
);


--
-- Name: invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_items_id_seq OWNED BY public.invoice_items.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    client_id integer NOT NULL,
    period character varying(7) NOT NULL,
    amount numeric(10,2) NOT NULL,
    issue_date date NOT NULL,
    due_date date NOT NULL,
    paid_date date,
    status public.invoicestatus DEFAULT 'pending'::public.invoicestatus NOT NULL,
    notes text,
    afip_cae character varying(20),
    afip_cae_expiry date,
    invoice_type character varying(1),
    invoice_point_of_sale integer,
    invoice_number integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mp_payment_id character varying(100)
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: mikrotik_routers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mikrotik_routers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    host character varying(255) NOT NULL,
    port integer DEFAULT 8728 NOT NULL,
    username character varying(100) NOT NULL,
    password_encrypted character varying(600) NOT NULL,
    location character varying(255),
    notes text,
    status public.devicestatus DEFAULT 'unknown'::public.devicestatus NOT NULL,
    last_seen timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision,
    longitude double precision,
    uplink_download_mbps integer,
    uplink_upload_mbps integer,
    uplink_interface character varying(50),
    lan_interface character varying(50)
);


--
-- Name: mikrotik_routers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mikrotik_routers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mikrotik_routers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mikrotik_routers_id_seq OWNED BY public.mikrotik_routers.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_date date NOT NULL,
    method public.paymentmethod NOT NULL,
    reference character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    download_mbps integer NOT NULL,
    upload_mbps integer NOT NULL,
    burst_download_mbps integer,
    burst_upload_mbps integer,
    burst_threshold_mbps integer,
    burst_time_seconds integer DEFAULT 10 NOT NULL,
    price numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role character varying(20) NOT NULL,
    section character varying(50) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL
);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: sec_alert_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_alert_confirmations (
    id integer NOT NULL,
    alert_id integer NOT NULL,
    confirmed_by_member_id integer,
    confirmed_at timestamp with time zone NOT NULL,
    response character varying(20) NOT NULL,
    notes text
);


--
-- Name: sec_alert_confirmations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_alert_confirmations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_alert_confirmations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_alert_confirmations_id_seq OWNED BY public.sec_alert_confirmations.id;


--
-- Name: sec_alert_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_alert_deliveries (
    id integer NOT NULL,
    alert_id integer NOT NULL,
    channel character varying(20) NOT NULL,
    recipient character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    error_message text,
    attempt_count integer DEFAULT 0 NOT NULL
);


--
-- Name: sec_alert_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_alert_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_alert_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_alert_deliveries_id_seq OWNED BY public.sec_alert_deliveries.id;


--
-- Name: sec_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_alerts (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    source_event_id integer,
    alert_type character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    triggered_at timestamp with time zone NOT NULL,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    operator_id integer,
    operator_notes text,
    idempotency_key character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmation_sent_at timestamp with time zone,
    confirmation_expires_at timestamp with time zone,
    confirmation_telegram_msg_id integer
);


--
-- Name: sec_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_alerts_id_seq OWNED BY public.sec_alerts.id;


--
-- Name: sec_app_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_app_devices (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    device_name character varying(100) NOT NULL,
    platform character varying(20) DEFAULT 'android'::character varying NOT NULL,
    secret_hash character varying(64) NOT NULL,
    push_token character varying(512),
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_app_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_app_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_app_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_app_devices_id_seq OWNED BY public.sec_app_devices.id;


--
-- Name: sec_beat_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_beat_webhooks (
    id integer NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    remote_ip character varying(45),
    payload json NOT NULL,
    event_id character varying(64),
    event_type character varying(100),
    event_detail json,
    fetch_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    fetch_error text
);


--
-- Name: sec_beat_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_beat_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_beat_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_beat_webhooks_id_seq OWNED BY public.sec_beat_webhooks.id;


--
-- Name: sec_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_certificates (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    issued_at timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    verification_token character varying(64) NOT NULL,
    file_path character varying(500),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: sec_certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_certificates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_certificates_id_seq OWNED BY public.sec_certificates.id;


--
-- Name: sec_contract_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_contract_templates (
    id integer NOT NULL,
    version character varying(20) NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    body_hash character varying(64) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_contract_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_contract_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_contract_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_contract_templates_id_seq OWNED BY public.sec_contract_templates.id;


--
-- Name: sec_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_contracts (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    accepted_by_user_id integer,
    version character varying(20) NOT NULL,
    accepted_at character varying(30) NOT NULL,
    acceptance_ip character varying(45),
    acceptance_user_agent character varying(500),
    document_hash character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_id integer,
    signer_name character varying(150),
    signer_dni character varying(20),
    method character varying(30),
    pdf_path character varying(500)
);


--
-- Name: sec_contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_contracts_id_seq OWNED BY public.sec_contracts.id;


--
-- Name: sec_device_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_device_zones (
    id integer NOT NULL,
    device_id integer NOT NULL,
    zone_number integer NOT NULL,
    zone_name character varying(100),
    zone_type character varying(50),
    enabled boolean DEFAULT true NOT NULL
);


--
-- Name: sec_device_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_device_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_device_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_device_zones_id_seq OWNED BY public.sec_device_zones.id;


--
-- Name: sec_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_devices (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    device_type character varying(30) NOT NULL,
    brand character varying(100),
    model character varying(100),
    serial_number character varying(255),
    firmware_version character varying(50),
    install_date date,
    warranty_months integer,
    location_description character varying(255),
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_devices_id_seq OWNED BY public.sec_devices.id;


--
-- Name: sec_elderly_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_elderly_configs (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    check_from character varying(5) DEFAULT '07:00'::character varying NOT NULL,
    check_until character varying(5) DEFAULT '10:00'::character varying NOT NULL,
    notify_telegram_id character varying(100),
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: sec_elderly_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_elderly_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_elderly_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_elderly_configs_id_seq OWNED BY public.sec_elderly_configs.id;


--
-- Name: sec_emergency_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_emergency_contacts (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255),
    relation character varying(100),
    priority_order integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: sec_emergency_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_emergency_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_emergency_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_emergency_contacts_id_seq OWNED BY public.sec_emergency_contacts.id;


--
-- Name: sec_entry_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_entry_sessions (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    activated_by_user_id integer,
    duration_minutes integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason character varying(100),
    location_lat double precision,
    location_lon double precision
);


--
-- Name: sec_entry_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_entry_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_entry_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_entry_sessions_id_seq OWNED BY public.sec_entry_sessions.id;


--
-- Name: sec_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_events (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    event_type character varying(40) NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    received_at timestamp with time zone NOT NULL,
    zone_number integer,
    partition integer,
    user_code character varying(50),
    description character varying(255),
    source character varying(20) DEFAULT 'beat'::character varying NOT NULL,
    raw_data json,
    processed boolean DEFAULT false NOT NULL,
    idempotency_key character varying(150)
);


--
-- Name: sec_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_events_id_seq OWNED BY public.sec_events.id;


--
-- Name: sec_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_features (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    feature_name character varying(50) NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);


--
-- Name: sec_features_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_features_id_seq OWNED BY public.sec_features.id;


--
-- Name: sec_monthly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_monthly_reports (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    period character varying(7) NOT NULL,
    generated_at timestamp with time zone,
    file_path character varying(500),
    status character varying(20) DEFAULT 'generating'::character varying NOT NULL,
    event_count integer DEFAULT 0 NOT NULL,
    alert_count integer DEFAULT 0 NOT NULL,
    test_count integer DEFAULT 0 NOT NULL,
    visit_count integer DEFAULT 0 NOT NULL,
    error_message character varying(500)
);


--
-- Name: sec_monthly_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_monthly_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_monthly_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_monthly_reports_id_seq OWNED BY public.sec_monthly_reports.id;


--
-- Name: sec_neighborhood_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_neighborhood_groups (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    telegram_group_id character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_neighborhood_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_neighborhood_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_neighborhood_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_neighborhood_groups_id_seq OWNED BY public.sec_neighborhood_groups.id;


--
-- Name: sec_neighborhood_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_neighborhood_memberships (
    id integer NOT NULL,
    group_id integer NOT NULL,
    subscription_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_neighborhood_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_neighborhood_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_neighborhood_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_neighborhood_memberships_id_seq OWNED BY public.sec_neighborhood_memberships.id;


--
-- Name: sec_pin_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_pin_credentials (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    pin_type character varying(20) NOT NULL,
    pin_hash character varying(255) NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    label character varying(100)
);


--
-- Name: sec_pin_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_pin_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_pin_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_pin_credentials_id_seq OWNED BY public.sec_pin_credentials.id;


--
-- Name: sec_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_plans (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    default_features json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    includes_monitoring boolean DEFAULT false NOT NULL
);


--
-- Name: sec_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_plans_id_seq OWNED BY public.sec_plans.id;


--
-- Name: sec_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_properties (
    id integer NOT NULL,
    owner_user_id integer NOT NULL,
    internet_client_id integer,
    name character varying(200) NOT NULL,
    address character varying(500) NOT NULL,
    city character varying(100),
    province character varying(100),
    property_type character varying(20) DEFAULT 'home'::character varying NOT NULL,
    latitude double precision,
    longitude double precision,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_properties_id_seq OWNED BY public.sec_properties.id;


--
-- Name: sec_property_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_property_members (
    id integer NOT NULL,
    property_id integer NOT NULL,
    user_id integer,
    name character varying(200) NOT NULL,
    phone character varying(50),
    email character varying(255),
    role character varying(20) DEFAULT 'family'::character varying NOT NULL,
    can_arm boolean DEFAULT false NOT NULL,
    can_disarm boolean DEFAULT false NOT NULL,
    can_invite boolean DEFAULT false NOT NULL,
    can_view_cameras boolean DEFAULT false NOT NULL,
    notify_on_alarm boolean DEFAULT true NOT NULL,
    notify_on_entry boolean DEFAULT false NOT NULL,
    schedule_restricted boolean DEFAULT false NOT NULL,
    schedule_json json,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    invited_at timestamp with time zone,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telegram_chat_id character varying(50),
    telegram_linked_at timestamp with time zone
);


--
-- Name: sec_property_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_property_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_property_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_property_members_id_seq OWNED BY public.sec_property_members.id;


--
-- Name: sec_safe_words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_safe_words (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    word_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_safe_words_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_safe_words_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_safe_words_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_safe_words_id_seq OWNED BY public.sec_safe_words.id;


--
-- Name: sec_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_schedules (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    weekday smallint NOT NULL,
    open_time time without time zone NOT NULL,
    close_time time without time zone NOT NULL,
    tolerance_minutes integer DEFAULT 15 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    not_opened_notified_on date,
    CONSTRAINT ck_sec_schedule_times CHECK ((open_time < close_time)),
    CONSTRAINT ck_sec_schedule_weekday CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: sec_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_schedules_id_seq OWNED BY public.sec_schedules.id;


--
-- Name: sec_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_subscriptions (
    id integer NOT NULL,
    property_id integer NOT NULL,
    plan_id integer NOT NULL,
    status character varying(30) DEFAULT 'pending_install'::character varying NOT NULL,
    beat_account_id character varying(100),
    contract_start date,
    contract_end date,
    billing_day integer DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_telegram_id character varying(100),
    portal_token character varying(64)
);


--
-- Name: sec_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_subscriptions_id_seq OWNED BY public.sec_subscriptions.id;


--
-- Name: sec_telegram_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_telegram_links (
    id integer NOT NULL,
    code_hash character varying(64) NOT NULL,
    subscription_id integer NOT NULL,
    member_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    used_by_chat_id character varying(50)
);


--
-- Name: sec_telegram_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_telegram_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_telegram_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_telegram_links_id_seq OWNED BY public.sec_telegram_links.id;


--
-- Name: sec_vacation_modes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_vacation_modes (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    notes text,
    created_by_user_id integer,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sec_vacation_modes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_vacation_modes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_vacation_modes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_vacation_modes_id_seq OWNED BY public.sec_vacation_modes.id;


--
-- Name: sec_weekly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sec_weekly_reports (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    week_label character varying(10) NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    generated_at timestamp with time zone,
    sent_at timestamp with time zone,
    event_count integer DEFAULT 0 NOT NULL,
    armed_count integer DEFAULT 0 NOT NULL,
    disarmed_count integer DEFAULT 0 NOT NULL,
    alert_count integer DEFAULT 0 NOT NULL,
    test_count integer DEFAULT 0 NOT NULL,
    battery_warning_count integer DEFAULT 0 NOT NULL,
    battery_warnings json,
    power_failure_count integer DEFAULT 0 NOT NULL,
    power_failures json
);


--
-- Name: sec_weekly_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sec_weekly_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sec_weekly_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sec_weekly_reports_id_seq OWNED BY public.sec_weekly_reports.id;


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key character varying(100) NOT NULL,
    value text NOT NULL
);


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    author_id integer,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_comments_id_seq OWNED BY public.ticket_comments.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    client_id integer,
    assigned_to_id integer,
    title character varying(255) NOT NULL,
    description text,
    status public.ticketstatus DEFAULT 'open'::public.ticketstatus NOT NULL,
    priority public.ticketpriority DEFAULT 'medium'::public.ticketpriority NOT NULL,
    category public.ticketcategory DEFAULT 'other'::public.ticketcategory NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: ubiquiti_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ubiquiti_devices (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    host character varying(255) NOT NULL,
    device_type public.ubiquitidevicetype NOT NULL,
    username character varying(100),
    password_encrypted character varying(600),
    mac_address character varying(17),
    mikrotik_router_id integer,
    location character varying(255),
    notes text,
    status public.devicestatus DEFAULT 'unknown'::public.devicestatus NOT NULL,
    last_seen timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_name character varying(100),
    firmware_version character varying(100),
    ssid character varying(100),
    frequency_mhz integer,
    channel_width_mhz integer,
    signal_dbm integer,
    ccq integer,
    latitude double precision,
    longitude double precision
);


--
-- Name: ubiquiti_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ubiquiti_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ubiquiti_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ubiquiti_devices_id_seq OWNED BY public.ubiquiti_devices.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    section character varying(50) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL
);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(200) DEFAULT ''::character varying NOT NULL,
    hashed_password character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_superuser boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role character varying(20) DEFAULT 'operator'::character varying NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vpn_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vpn_connections (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    vpn_type character varying(20) NOT NULL,
    router_id integer,
    router_name character varying(100),
    wg_server_endpoint character varying(255),
    wg_server_port integer DEFAULT 51820,
    wg_server_public_key character varying(100),
    wg_client_private_key character varying(100),
    wg_client_public_key character varying(100),
    wg_client_ip character varying(50),
    wg_server_wg_ip character varying(50),
    wg_keepalive integer DEFAULT 25,
    l2tp_server_host character varying(255),
    l2tp_username character varying(100),
    l2tp_password character varying(100),
    l2tp_ipsec_secret character varying(100),
    l2tp_local_ip character varying(50),
    l2tp_remote_ip character varying(50),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vpn_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vpn_connections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vpn_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vpn_connections_id_seq OWNED BY public.vpn_connections.id;


--
-- Name: wan_interfaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wan_interfaces (
    id integer NOT NULL,
    router_id integer NOT NULL,
    interface_name character varying(64) NOT NULL,
    display_name character varying(64),
    weight integer,
    cap_gb integer,
    manual_override boolean,
    enabled boolean,
    accumulated_rx_bytes bigint,
    accumulated_tx_bytes bigint,
    last_rx_bytes bigint,
    last_tx_bytes bigint
);


--
-- Name: wan_interfaces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wan_interfaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wan_interfaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wan_interfaces_id_seq OWNED BY public.wan_interfaces.id;


--
-- Name: wan_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wan_schedules (
    id integer NOT NULL,
    wan_interface_id integer NOT NULL,
    action character varying(10) NOT NULL,
    days character varying(64) DEFAULT 'mon,tue,wed,thu,fri,sat,sun'::character varying NOT NULL,
    time_start character varying(8) NOT NULL,
    time_end character varying(8) NOT NULL
);


--
-- Name: wan_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wan_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wan_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wan_schedules_id_seq OWNED BY public.wan_schedules.id;


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'other'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    priority character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    client_id integer,
    assigned_to_id integer,
    scheduled_date timestamp with time zone,
    completed_at timestamp with time zone,
    address character varying(500),
    latitude double precision,
    longitude double precision,
    completion_notes text,
    photo_urls json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#1677ff'::character varying NOT NULL,
    router_id integer,
    latitude double precision,
    longitude double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- Name: alarms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alarms ALTER COLUMN id SET DEFAULT nextval('public.alarms_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: automation_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs ALTER COLUMN id SET DEFAULT nextval('public.automation_logs_id_seq'::regclass);


--
-- Name: bandwidth_samples id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bandwidth_samples ALTER COLUMN id SET DEFAULT nextval('public.bandwidth_samples_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: invoice_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items ALTER COLUMN id SET DEFAULT nextval('public.invoice_items_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: mikrotik_routers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mikrotik_routers ALTER COLUMN id SET DEFAULT nextval('public.mikrotik_routers_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: sec_alert_confirmations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_confirmations ALTER COLUMN id SET DEFAULT nextval('public.sec_alert_confirmations_id_seq'::regclass);


--
-- Name: sec_alert_deliveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_deliveries ALTER COLUMN id SET DEFAULT nextval('public.sec_alert_deliveries_id_seq'::regclass);


--
-- Name: sec_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alerts ALTER COLUMN id SET DEFAULT nextval('public.sec_alerts_id_seq'::regclass);


--
-- Name: sec_app_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_app_devices ALTER COLUMN id SET DEFAULT nextval('public.sec_app_devices_id_seq'::regclass);


--
-- Name: sec_beat_webhooks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_beat_webhooks ALTER COLUMN id SET DEFAULT nextval('public.sec_beat_webhooks_id_seq'::regclass);


--
-- Name: sec_certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_certificates ALTER COLUMN id SET DEFAULT nextval('public.sec_certificates_id_seq'::regclass);


--
-- Name: sec_contract_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contract_templates ALTER COLUMN id SET DEFAULT nextval('public.sec_contract_templates_id_seq'::regclass);


--
-- Name: sec_contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contracts ALTER COLUMN id SET DEFAULT nextval('public.sec_contracts_id_seq'::regclass);


--
-- Name: sec_device_zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_device_zones ALTER COLUMN id SET DEFAULT nextval('public.sec_device_zones_id_seq'::regclass);


--
-- Name: sec_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_devices ALTER COLUMN id SET DEFAULT nextval('public.sec_devices_id_seq'::regclass);


--
-- Name: sec_elderly_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_elderly_configs ALTER COLUMN id SET DEFAULT nextval('public.sec_elderly_configs_id_seq'::regclass);


--
-- Name: sec_emergency_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_emergency_contacts ALTER COLUMN id SET DEFAULT nextval('public.sec_emergency_contacts_id_seq'::regclass);


--
-- Name: sec_entry_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_entry_sessions ALTER COLUMN id SET DEFAULT nextval('public.sec_entry_sessions_id_seq'::regclass);


--
-- Name: sec_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_events ALTER COLUMN id SET DEFAULT nextval('public.sec_events_id_seq'::regclass);


--
-- Name: sec_features id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_features ALTER COLUMN id SET DEFAULT nextval('public.sec_features_id_seq'::regclass);


--
-- Name: sec_monthly_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_monthly_reports ALTER COLUMN id SET DEFAULT nextval('public.sec_monthly_reports_id_seq'::regclass);


--
-- Name: sec_neighborhood_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_groups ALTER COLUMN id SET DEFAULT nextval('public.sec_neighborhood_groups_id_seq'::regclass);


--
-- Name: sec_neighborhood_memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_memberships ALTER COLUMN id SET DEFAULT nextval('public.sec_neighborhood_memberships_id_seq'::regclass);


--
-- Name: sec_pin_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_pin_credentials ALTER COLUMN id SET DEFAULT nextval('public.sec_pin_credentials_id_seq'::regclass);


--
-- Name: sec_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_plans ALTER COLUMN id SET DEFAULT nextval('public.sec_plans_id_seq'::regclass);


--
-- Name: sec_properties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_properties ALTER COLUMN id SET DEFAULT nextval('public.sec_properties_id_seq'::regclass);


--
-- Name: sec_property_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_property_members ALTER COLUMN id SET DEFAULT nextval('public.sec_property_members_id_seq'::regclass);


--
-- Name: sec_safe_words id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_safe_words ALTER COLUMN id SET DEFAULT nextval('public.sec_safe_words_id_seq'::regclass);


--
-- Name: sec_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_schedules ALTER COLUMN id SET DEFAULT nextval('public.sec_schedules_id_seq'::regclass);


--
-- Name: sec_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.sec_subscriptions_id_seq'::regclass);


--
-- Name: sec_telegram_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_telegram_links ALTER COLUMN id SET DEFAULT nextval('public.sec_telegram_links_id_seq'::regclass);


--
-- Name: sec_vacation_modes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_vacation_modes ALTER COLUMN id SET DEFAULT nextval('public.sec_vacation_modes_id_seq'::regclass);


--
-- Name: sec_weekly_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_weekly_reports ALTER COLUMN id SET DEFAULT nextval('public.sec_weekly_reports_id_seq'::regclass);


--
-- Name: ticket_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments ALTER COLUMN id SET DEFAULT nextval('public.ticket_comments_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: ubiquiti_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubiquiti_devices ALTER COLUMN id SET DEFAULT nextval('public.ubiquiti_devices_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vpn_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vpn_connections ALTER COLUMN id SET DEFAULT nextval('public.vpn_connections_id_seq'::regclass);


--
-- Name: wan_interfaces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wan_interfaces ALTER COLUMN id SET DEFAULT nextval('public.wan_interfaces_id_seq'::regclass);


--
-- Name: wan_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wan_schedules ALTER COLUMN id SET DEFAULT nextval('public.wan_schedules_id_seq'::regclass);


--
-- Name: work_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);


--
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- Name: alarms alarms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alarms
    ADD CONSTRAINT alarms_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_logs automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);


--
-- Name: bandwidth_samples bandwidth_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bandwidth_samples
    ADD CONSTRAINT bandwidth_samples_pkey PRIMARY KEY (id);


--
-- Name: clients clients_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_ip_address_key UNIQUE (ip_address);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: mikrotik_routers mikrotik_routers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mikrotik_routers
    ADD CONSTRAINT mikrotik_routers_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: sec_alert_confirmations sec_alert_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_confirmations
    ADD CONSTRAINT sec_alert_confirmations_pkey PRIMARY KEY (id);


--
-- Name: sec_alert_deliveries sec_alert_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_deliveries
    ADD CONSTRAINT sec_alert_deliveries_pkey PRIMARY KEY (id);


--
-- Name: sec_alerts sec_alerts_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alerts
    ADD CONSTRAINT sec_alerts_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: sec_alerts sec_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alerts
    ADD CONSTRAINT sec_alerts_pkey PRIMARY KEY (id);


--
-- Name: sec_app_devices sec_app_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_app_devices
    ADD CONSTRAINT sec_app_devices_pkey PRIMARY KEY (id);


--
-- Name: sec_beat_webhooks sec_beat_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_beat_webhooks
    ADD CONSTRAINT sec_beat_webhooks_pkey PRIMARY KEY (id);


--
-- Name: sec_certificates sec_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_certificates
    ADD CONSTRAINT sec_certificates_pkey PRIMARY KEY (id);


--
-- Name: sec_contract_templates sec_contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contract_templates
    ADD CONSTRAINT sec_contract_templates_pkey PRIMARY KEY (id);


--
-- Name: sec_contract_templates sec_contract_templates_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contract_templates
    ADD CONSTRAINT sec_contract_templates_version_key UNIQUE (version);


--
-- Name: sec_contracts sec_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contracts
    ADD CONSTRAINT sec_contracts_pkey PRIMARY KEY (id);


--
-- Name: sec_device_zones sec_device_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_device_zones
    ADD CONSTRAINT sec_device_zones_pkey PRIMARY KEY (id);


--
-- Name: sec_devices sec_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_devices
    ADD CONSTRAINT sec_devices_pkey PRIMARY KEY (id);


--
-- Name: sec_elderly_configs sec_elderly_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_elderly_configs
    ADD CONSTRAINT sec_elderly_configs_pkey PRIMARY KEY (id);


--
-- Name: sec_emergency_contacts sec_emergency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_emergency_contacts
    ADD CONSTRAINT sec_emergency_contacts_pkey PRIMARY KEY (id);


--
-- Name: sec_entry_sessions sec_entry_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_entry_sessions
    ADD CONSTRAINT sec_entry_sessions_pkey PRIMARY KEY (id);


--
-- Name: sec_events sec_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_events
    ADD CONSTRAINT sec_events_pkey PRIMARY KEY (id);


--
-- Name: sec_features sec_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_features
    ADD CONSTRAINT sec_features_pkey PRIMARY KEY (id);


--
-- Name: sec_monthly_reports sec_monthly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_monthly_reports
    ADD CONSTRAINT sec_monthly_reports_pkey PRIMARY KEY (id);


--
-- Name: sec_neighborhood_groups sec_neighborhood_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_groups
    ADD CONSTRAINT sec_neighborhood_groups_pkey PRIMARY KEY (id);


--
-- Name: sec_neighborhood_memberships sec_neighborhood_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_memberships
    ADD CONSTRAINT sec_neighborhood_memberships_pkey PRIMARY KEY (id);


--
-- Name: sec_pin_credentials sec_pin_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_pin_credentials
    ADD CONSTRAINT sec_pin_credentials_pkey PRIMARY KEY (id);


--
-- Name: sec_plans sec_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_plans
    ADD CONSTRAINT sec_plans_pkey PRIMARY KEY (id);


--
-- Name: sec_properties sec_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_properties
    ADD CONSTRAINT sec_properties_pkey PRIMARY KEY (id);


--
-- Name: sec_property_members sec_property_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_property_members
    ADD CONSTRAINT sec_property_members_pkey PRIMARY KEY (id);


--
-- Name: sec_safe_words sec_safe_words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_safe_words
    ADD CONSTRAINT sec_safe_words_pkey PRIMARY KEY (id);


--
-- Name: sec_safe_words sec_safe_words_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_safe_words
    ADD CONSTRAINT sec_safe_words_subscription_id_key UNIQUE (subscription_id);


--
-- Name: sec_schedules sec_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_schedules
    ADD CONSTRAINT sec_schedules_pkey PRIMARY KEY (id);


--
-- Name: sec_subscriptions sec_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_subscriptions
    ADD CONSTRAINT sec_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: sec_telegram_links sec_telegram_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_telegram_links
    ADD CONSTRAINT sec_telegram_links_pkey PRIMARY KEY (id);


--
-- Name: sec_vacation_modes sec_vacation_modes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_vacation_modes
    ADD CONSTRAINT sec_vacation_modes_pkey PRIMARY KEY (id);


--
-- Name: sec_weekly_reports sec_weekly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_weekly_reports
    ADD CONSTRAINT sec_weekly_reports_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: ubiquiti_devices ubiquiti_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubiquiti_devices
    ADD CONSTRAINT ubiquiti_devices_pkey PRIMARY KEY (id);


--
-- Name: sec_neighborhood_memberships uq_neighborhood_membership_subscription; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_memberships
    ADD CONSTRAINT uq_neighborhood_membership_subscription UNIQUE (subscription_id);


--
-- Name: role_permissions uq_role_section; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT uq_role_section UNIQUE (role, section);


--
-- Name: sec_certificates uq_sec_cert_subscription; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_certificates
    ADD CONSTRAINT uq_sec_cert_subscription UNIQUE (subscription_id);


--
-- Name: sec_certificates uq_sec_cert_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_certificates
    ADD CONSTRAINT uq_sec_cert_token UNIQUE (verification_token);


--
-- Name: sec_contracts uq_sec_contracts_sub_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contracts
    ADD CONSTRAINT uq_sec_contracts_sub_version UNIQUE (subscription_id, version);


--
-- Name: sec_elderly_configs uq_sec_elderly_sub; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_elderly_configs
    ADD CONSTRAINT uq_sec_elderly_sub UNIQUE (subscription_id);


--
-- Name: sec_features uq_sec_feature; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_features
    ADD CONSTRAINT uq_sec_feature UNIQUE (subscription_id, feature_name);


--
-- Name: sec_monthly_reports uq_sec_monthly_report; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_monthly_reports
    ADD CONSTRAINT uq_sec_monthly_report UNIQUE (subscription_id, period);


--
-- Name: sec_schedules uq_sec_schedule_day; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_schedules
    ADD CONSTRAINT uq_sec_schedule_day UNIQUE (subscription_id, weekday);


--
-- Name: sec_subscriptions uq_sec_subscriptions_portal_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_subscriptions
    ADD CONSTRAINT uq_sec_subscriptions_portal_token UNIQUE (portal_token);


--
-- Name: sec_weekly_reports uq_sec_weekly_report; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_weekly_reports
    ADD CONSTRAINT uq_sec_weekly_report UNIQUE (subscription_id, week_label);


--
-- Name: user_permissions uq_user_section; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT uq_user_section UNIQUE (user_id, section);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: vpn_connections vpn_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vpn_connections
    ADD CONSTRAINT vpn_connections_pkey PRIMARY KEY (id);


--
-- Name: wan_interfaces wan_interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wan_interfaces
    ADD CONSTRAINT wan_interfaces_pkey PRIMARY KEY (id);


--
-- Name: wan_schedules wan_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wan_schedules
    ADD CONSTRAINT wan_schedules_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: ix_alarms_router_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_alarms_router_id ON public.alarms USING btree (router_id);


--
-- Name: ix_alarms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_alarms_status ON public.alarms USING btree (status);


--
-- Name: ix_alarms_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_alarms_type ON public.alarms USING btree (type);


--
-- Name: ix_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: ix_automation_logs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_automation_logs_job ON public.automation_logs USING btree (job);


--
-- Name: ix_bw_router_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bw_router_time ON public.bandwidth_samples USING btree (router_id, sampled_at);


--
-- Name: ix_clients_dni; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clients_dni ON public.clients USING btree (dni);


--
-- Name: ix_clients_ip_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clients_ip_address ON public.clients USING btree (ip_address);


--
-- Name: ix_clients_pppoe_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_clients_pppoe_username ON public.clients USING btree (pppoe_username);


--
-- Name: ix_clients_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clients_zone_id ON public.clients USING btree (zone_id);


--
-- Name: ix_expenses_expense_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_expenses_expense_date ON public.expenses USING btree (expense_date);


--
-- Name: ix_inventory_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_items_category ON public.inventory_items USING btree (category);


--
-- Name: ix_inventory_items_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_items_client_id ON public.inventory_items USING btree (client_id);


--
-- Name: ix_inventory_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_items_status ON public.inventory_items USING btree (status);


--
-- Name: ix_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);


--
-- Name: ix_invoices_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoices_client_id ON public.invoices USING btree (client_id);


--
-- Name: ix_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoices_due_date ON public.invoices USING btree (due_date);


--
-- Name: ix_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: ix_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: ix_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_role_permissions_role ON public.role_permissions USING btree (role);


--
-- Name: ix_sec_alert_confirmations_alert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_alert_confirmations_alert_id ON public.sec_alert_confirmations USING btree (alert_id);


--
-- Name: ix_sec_alert_deliveries_alert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_alert_deliveries_alert_id ON public.sec_alert_deliveries USING btree (alert_id);


--
-- Name: ix_sec_alerts_alert_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_alerts_alert_type ON public.sec_alerts USING btree (alert_type);


--
-- Name: ix_sec_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_alerts_status ON public.sec_alerts USING btree (status);


--
-- Name: ix_sec_alerts_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_alerts_subscription_id ON public.sec_alerts USING btree (subscription_id);


--
-- Name: ix_sec_alerts_triggered_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_alerts_triggered_at ON public.sec_alerts USING btree (triggered_at);


--
-- Name: ix_sec_app_devices_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_app_devices_subscription_id ON public.sec_app_devices USING btree (subscription_id);


--
-- Name: ix_sec_beat_webhooks_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_beat_webhooks_event_id ON public.sec_beat_webhooks USING btree (event_id);


--
-- Name: ix_sec_beat_webhooks_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_beat_webhooks_received_at ON public.sec_beat_webhooks USING btree (received_at);


--
-- Name: ix_sec_cert_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_cert_sub ON public.sec_certificates USING btree (subscription_id);


--
-- Name: ix_sec_cert_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_cert_token ON public.sec_certificates USING btree (verification_token);


--
-- Name: ix_sec_contracts_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_contracts_subscription_id ON public.sec_contracts USING btree (subscription_id);


--
-- Name: ix_sec_contracts_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_contracts_template_id ON public.sec_contracts USING btree (template_id);


--
-- Name: ix_sec_device_zones_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_device_zones_device_id ON public.sec_device_zones USING btree (device_id);


--
-- Name: ix_sec_devices_device_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_devices_device_type ON public.sec_devices USING btree (device_type);


--
-- Name: ix_sec_devices_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_devices_subscription_id ON public.sec_devices USING btree (subscription_id);


--
-- Name: ix_sec_elderly_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_elderly_sub ON public.sec_elderly_configs USING btree (subscription_id);


--
-- Name: ix_sec_emergency_contacts_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_emergency_contacts_subscription_id ON public.sec_emergency_contacts USING btree (subscription_id);


--
-- Name: ix_sec_entry_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_entry_sessions_expires_at ON public.sec_entry_sessions USING btree (expires_at);


--
-- Name: ix_sec_entry_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_entry_sessions_status ON public.sec_entry_sessions USING btree (status);


--
-- Name: ix_sec_entry_sessions_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_entry_sessions_subscription_id ON public.sec_entry_sessions USING btree (subscription_id);


--
-- Name: ix_sec_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_events_event_type ON public.sec_events USING btree (event_type);


--
-- Name: ix_sec_events_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_sec_events_idempotency_key ON public.sec_events USING btree (idempotency_key);


--
-- Name: ix_sec_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_events_occurred_at ON public.sec_events USING btree (occurred_at);


--
-- Name: ix_sec_events_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_events_processed ON public.sec_events USING btree (processed);


--
-- Name: ix_sec_events_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_events_received_at ON public.sec_events USING btree (received_at);


--
-- Name: ix_sec_events_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_events_subscription_id ON public.sec_events USING btree (subscription_id);


--
-- Name: ix_sec_features_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_features_subscription_id ON public.sec_features USING btree (subscription_id);


--
-- Name: ix_sec_monthly_reports_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_monthly_reports_period ON public.sec_monthly_reports USING btree (period);


--
-- Name: ix_sec_monthly_reports_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_monthly_reports_subscription_id ON public.sec_monthly_reports USING btree (subscription_id);


--
-- Name: ix_sec_neighborhood_memberships_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_neighborhood_memberships_group_id ON public.sec_neighborhood_memberships USING btree (group_id);


--
-- Name: ix_sec_neighborhood_memberships_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_neighborhood_memberships_subscription_id ON public.sec_neighborhood_memberships USING btree (subscription_id);


--
-- Name: ix_sec_pin_credentials_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_pin_credentials_subscription_id ON public.sec_pin_credentials USING btree (subscription_id);


--
-- Name: ix_sec_properties_internet_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_properties_internet_client_id ON public.sec_properties USING btree (internet_client_id);


--
-- Name: ix_sec_properties_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_properties_owner_user_id ON public.sec_properties USING btree (owner_user_id);


--
-- Name: ix_sec_property_members_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_property_members_property_id ON public.sec_property_members USING btree (property_id);


--
-- Name: ix_sec_property_members_telegram_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_property_members_telegram_chat_id ON public.sec_property_members USING btree (telegram_chat_id);


--
-- Name: ix_sec_property_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_property_members_user_id ON public.sec_property_members USING btree (user_id);


--
-- Name: ix_sec_schedules_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_schedules_subscription_id ON public.sec_schedules USING btree (subscription_id);


--
-- Name: ix_sec_subscriptions_beat_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_subscriptions_beat_account_id ON public.sec_subscriptions USING btree (beat_account_id);


--
-- Name: ix_sec_subscriptions_portal_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_subscriptions_portal_token ON public.sec_subscriptions USING btree (portal_token);


--
-- Name: ix_sec_subscriptions_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_subscriptions_property_id ON public.sec_subscriptions USING btree (property_id);


--
-- Name: ix_sec_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_subscriptions_status ON public.sec_subscriptions USING btree (status);


--
-- Name: ix_sec_telegram_links_code_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_sec_telegram_links_code_hash ON public.sec_telegram_links USING btree (code_hash);


--
-- Name: ix_sec_telegram_links_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_telegram_links_member_id ON public.sec_telegram_links USING btree (member_id);


--
-- Name: ix_sec_telegram_links_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_telegram_links_subscription_id ON public.sec_telegram_links USING btree (subscription_id);


--
-- Name: ix_sec_vacation_modes_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_vacation_modes_subscription_id ON public.sec_vacation_modes USING btree (subscription_id);


--
-- Name: ix_sec_weekly_reports_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_weekly_reports_subscription_id ON public.sec_weekly_reports USING btree (subscription_id);


--
-- Name: ix_sec_weekly_reports_week_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sec_weekly_reports_week_label ON public.sec_weekly_reports USING btree (week_label);


--
-- Name: ix_ticket_comments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ticket_comments_ticket_id ON public.ticket_comments USING btree (ticket_id);


--
-- Name: ix_tickets_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tickets_client_id ON public.tickets USING btree (client_id);


--
-- Name: ix_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tickets_status ON public.tickets USING btree (status);


--
-- Name: ix_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: ix_work_orders_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_work_orders_client_id ON public.work_orders USING btree (client_id);


--
-- Name: ix_work_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_work_orders_status ON public.work_orders USING btree (status);


--
-- Name: ix_zones_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_zones_name ON public.zones USING btree (name);


--
-- Name: uq_sec_contract_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sec_contract_templates_active ON public.sec_contract_templates USING btree (is_active) WHERE is_active;


--
-- Name: alarms alarms_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alarms
    ADD CONSTRAINT alarms_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.mikrotik_routers(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bandwidth_samples bandwidth_samples_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bandwidth_samples
    ADD CONSTRAINT bandwidth_samples_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: bandwidth_samples bandwidth_samples_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bandwidth_samples
    ADD CONSTRAINT bandwidth_samples_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.mikrotik_routers(id);


--
-- Name: clients clients_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: clients clients_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.mikrotik_routers(id);


--
-- Name: clients clients_ubiquiti_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_ubiquiti_device_id_fkey FOREIGN KEY (ubiquiti_device_id) REFERENCES public.ubiquiti_devices(id) ON DELETE SET NULL;


--
-- Name: clients clients_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: inventory_items inventory_items_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sec_alert_confirmations sec_alert_confirmations_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_confirmations
    ADD CONSTRAINT sec_alert_confirmations_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.sec_alerts(id) ON DELETE CASCADE;


--
-- Name: sec_alert_confirmations sec_alert_confirmations_confirmed_by_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_confirmations
    ADD CONSTRAINT sec_alert_confirmations_confirmed_by_member_id_fkey FOREIGN KEY (confirmed_by_member_id) REFERENCES public.sec_property_members(id) ON DELETE SET NULL;


--
-- Name: sec_alert_deliveries sec_alert_deliveries_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alert_deliveries
    ADD CONSTRAINT sec_alert_deliveries_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.sec_alerts(id) ON DELETE CASCADE;


--
-- Name: sec_alerts sec_alerts_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alerts
    ADD CONSTRAINT sec_alerts_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sec_alerts sec_alerts_source_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alerts
    ADD CONSTRAINT sec_alerts_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.sec_events(id) ON DELETE SET NULL;


--
-- Name: sec_alerts sec_alerts_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_alerts
    ADD CONSTRAINT sec_alerts_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id);


--
-- Name: sec_app_devices sec_app_devices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_app_devices
    ADD CONSTRAINT sec_app_devices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_certificates sec_certificates_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_certificates
    ADD CONSTRAINT sec_certificates_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id);


--
-- Name: sec_contract_templates sec_contract_templates_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contract_templates
    ADD CONSTRAINT sec_contract_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sec_contracts sec_contracts_accepted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contracts
    ADD CONSTRAINT sec_contracts_accepted_by_user_id_fkey FOREIGN KEY (accepted_by_user_id) REFERENCES public.users(id);


--
-- Name: sec_contracts sec_contracts_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contracts
    ADD CONSTRAINT sec_contracts_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_contracts sec_contracts_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_contracts
    ADD CONSTRAINT sec_contracts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.sec_contract_templates(id);


--
-- Name: sec_device_zones sec_device_zones_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_device_zones
    ADD CONSTRAINT sec_device_zones_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.sec_devices(id) ON DELETE CASCADE;


--
-- Name: sec_devices sec_devices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_devices
    ADD CONSTRAINT sec_devices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_elderly_configs sec_elderly_configs_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_elderly_configs
    ADD CONSTRAINT sec_elderly_configs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_emergency_contacts sec_emergency_contacts_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_emergency_contacts
    ADD CONSTRAINT sec_emergency_contacts_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_entry_sessions sec_entry_sessions_activated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_entry_sessions
    ADD CONSTRAINT sec_entry_sessions_activated_by_user_id_fkey FOREIGN KEY (activated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sec_entry_sessions sec_entry_sessions_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_entry_sessions
    ADD CONSTRAINT sec_entry_sessions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id);


--
-- Name: sec_events sec_events_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_events
    ADD CONSTRAINT sec_events_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id);


--
-- Name: sec_features sec_features_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_features
    ADD CONSTRAINT sec_features_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_monthly_reports sec_monthly_reports_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_monthly_reports
    ADD CONSTRAINT sec_monthly_reports_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id);


--
-- Name: sec_neighborhood_memberships sec_neighborhood_memberships_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_memberships
    ADD CONSTRAINT sec_neighborhood_memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.sec_neighborhood_groups(id) ON DELETE CASCADE;


--
-- Name: sec_neighborhood_memberships sec_neighborhood_memberships_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_neighborhood_memberships
    ADD CONSTRAINT sec_neighborhood_memberships_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_pin_credentials sec_pin_credentials_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_pin_credentials
    ADD CONSTRAINT sec_pin_credentials_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_properties sec_properties_internet_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_properties
    ADD CONSTRAINT sec_properties_internet_client_id_fkey FOREIGN KEY (internet_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: sec_properties sec_properties_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_properties
    ADD CONSTRAINT sec_properties_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: sec_property_members sec_property_members_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_property_members
    ADD CONSTRAINT sec_property_members_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.sec_properties(id) ON DELETE CASCADE;


--
-- Name: sec_property_members sec_property_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_property_members
    ADD CONSTRAINT sec_property_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sec_safe_words sec_safe_words_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_safe_words
    ADD CONSTRAINT sec_safe_words_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_schedules sec_schedules_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_schedules
    ADD CONSTRAINT sec_schedules_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_subscriptions sec_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_subscriptions
    ADD CONSTRAINT sec_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.sec_plans(id);


--
-- Name: sec_subscriptions sec_subscriptions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_subscriptions
    ADD CONSTRAINT sec_subscriptions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.sec_properties(id);


--
-- Name: sec_telegram_links sec_telegram_links_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_telegram_links
    ADD CONSTRAINT sec_telegram_links_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.sec_property_members(id) ON DELETE CASCADE;


--
-- Name: sec_telegram_links sec_telegram_links_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_telegram_links
    ADD CONSTRAINT sec_telegram_links_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_vacation_modes sec_vacation_modes_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_vacation_modes
    ADD CONSTRAINT sec_vacation_modes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sec_vacation_modes sec_vacation_modes_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_vacation_modes
    ADD CONSTRAINT sec_vacation_modes_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id) ON DELETE CASCADE;


--
-- Name: sec_weekly_reports sec_weekly_reports_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sec_weekly_reports
    ADD CONSTRAINT sec_weekly_reports_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.sec_subscriptions(id);


--
-- Name: ticket_comments ticket_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: tickets tickets_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: ubiquiti_devices ubiquiti_devices_mikrotik_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubiquiti_devices
    ADD CONSTRAINT ubiquiti_devices_mikrotik_router_id_fkey FOREIGN KEY (mikrotik_router_id) REFERENCES public.mikrotik_routers(id) ON DELETE SET NULL;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vpn_connections vpn_connections_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vpn_connections
    ADD CONSTRAINT vpn_connections_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.mikrotik_routers(id) ON DELETE SET NULL;


--
-- Name: wan_interfaces wan_interfaces_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wan_interfaces
    ADD CONSTRAINT wan_interfaces_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.mikrotik_routers(id) ON DELETE CASCADE;


--
-- Name: wan_schedules wan_schedules_wan_interface_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wan_schedules
    ADD CONSTRAINT wan_schedules_wan_interface_id_fkey FOREIGN KEY (wan_interface_id) REFERENCES public.wan_interfaces(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: zones zones_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.mikrotik_routers(id);


--
-- PostgreSQL database dump complete
--


