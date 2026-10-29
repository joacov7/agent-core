/** @type {import('next').NextConfig} */
const nextConfig = {
  // Driver de Postgres (adapter WISP): que Node lo cargue tal cual, sin empaquetarlo.
  serverExternalPackages: ["pg"],
  // Los paquetes @agent-core/* se consumen ya compilados (dist), no hace falta
  // transpilarlos. Si en algún momento consumís su fuente TS, agregá acá:
  //   transpilePackages: ["@agent-core/core", "@agent-core/agents", ...],
};

export default nextConfig;
