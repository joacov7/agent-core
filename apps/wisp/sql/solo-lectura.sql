-- Rol de SOLO LECTURA para que los agentes lean la base de guaynet sin poder tocarla.
-- Permisos por columna: no ve `users` (hashes de contraseña) ni las claves de los equipos
-- (`password_encrypted`, usuario y host de MikroTik/Ubiquiti).
--
--   docker compose exec db psql -U guaynet -d guaynet
--   (pegá esto, cambiando la contraseña)

CREATE ROLE agentcore_ro LOGIN PASSWORD '<elegí una contraseña larga>';
GRANT CONNECT ON DATABASE guaynet TO agentcore_ro;
GRANT USAGE ON SCHEMA public TO agentcore_ro;

GRANT SELECT ON clients, plans, invoices, payments TO agentcore_ro;
GRANT SELECT (id, name, location, status, last_seen) ON mikrotik_routers TO agentcore_ro;
GRANT SELECT (id, name, device_type, location, status, last_seen) ON ubiquiti_devices TO agentcore_ro;

-- Que cualquier sesión de este rol sea de solo lectura aunque algún día se le otorgue de más.
ALTER ROLE agentcore_ro SET default_transaction_read_only = on;
