/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los paquetes @agent-core/* se consumen ya compilados (dist), no hace falta
  // transpilarlos. Si en algún momento consumís su fuente TS, agregá acá:
  //   transpilePackages: ["@agent-core/core", "@agent-core/agents", ...],
};

export default nextConfig;
