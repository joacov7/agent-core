-- Permisos de SOLO LECTURA para la línea SEGURIDAD de guaynet (módulo sec_*). Se suma a
-- `solo-lectura.sql` (que crea el rol `agentcore_ro`): corré primero ese.
--
--   docker compose exec db psql -U guaynet -d guaynet     (y pegá esto)
--
-- Permisos POR COLUMNA, solo lo que los agentes necesitan: el estado de las alertas y de las
-- suscripciones, el nombre del cliente/propiedad (para mostrarlo en la app), y las fechas de
-- vencimiento. NUNCA se conceden (el rol no puede leerlos aunque el código lo intentara):
--   sec_pin_credentials ........ PINs de los clientes
--   sec_safe_words ............. palabras seguras
--   sec_app_devices ............ tokens de la app móvil
--   sec_telegram_links ......... vínculos de Telegram de titulares y miembros
--   sec_beat_webhooks .......... mensajes crudos de la central
--   sec_subscriptions: portal_token, client_telegram_id, beat_account_id, notes
--   sec_properties: address, city, province, latitude, longitude, notes, owner_user_id
--   sec_events: raw_data, user_code, description
--   sec_property_members, sec_emergency_contacts, sec_elderly_configs, sec_contracts, etc.

GRANT SELECT (id, subscription_id, alert_type, status, triggered_at, acknowledged_at) ON sec_alerts TO agentcore_ro;
GRANT SELECT (id, property_id, plan_id, status, contract_end) ON sec_subscriptions TO agentcore_ro;
GRANT SELECT (id, name) ON sec_properties TO agentcore_ro;
GRANT SELECT (id, name) ON sec_plans TO agentcore_ro;
GRANT SELECT (id, subscription_id, event_type, occurred_at) ON sec_events TO agentcore_ro;
GRANT SELECT (id, subscription_id, device_type, install_date, warranty_months, is_active) ON sec_devices TO agentcore_ro;
GRANT SELECT (id, subscription_id, issued_at, valid_until) ON sec_certificates TO agentcore_ro;
