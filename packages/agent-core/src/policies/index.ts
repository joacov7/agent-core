// Policies / Enforcement (motor): resolución de políticas (perAgentTool > tools >
// default) y evaluación de writes (límites, horarios, precios, autonomía). El
// enforcement intercepta TODA tool de escritura (core o dominio). Portado de Regionales.
export * from "./policies.logic.js";
