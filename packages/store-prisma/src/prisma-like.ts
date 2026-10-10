// Interfaz ESTRUCTURAL del subconjunto de Prisma que usa el adapter. No importa
// `@prisma/client`: así este paquete compila y testea sin generar el cliente ni una
// DB (el CI corre sin Postgres). En producción le pasás tu `PrismaClient` real: lo
// satisface estructuralmente. Un `PrismaClient` generado desde `prisma/schema.prisma`
// expone exactamente estos delegados (recomendacion, resultadoAccion, …).

export interface FilaConData {
  data: unknown;
}
export interface FilaGasto {
  costo: number;
  data: unknown;
}

type Where = Record<string, unknown>;

export interface DelegadoLectura<Row> {
  findMany(args?: { where?: Where }): Promise<Row[]>;
  findFirst(args: { where?: Where }): Promise<Row | null>;
}
export interface DelegadoEscritura<Row> extends DelegadoLectura<Row> {
  create(args: { data: Record<string, unknown> }): Promise<Row>;
}
export interface DelegadoUpsert<Row> extends DelegadoLectura<Row> {
  upsert(args: { where: Where; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Row>;
}

/** El cliente de datos que el adapter necesita (subconjunto de PrismaClient). */
export interface PrismaLike {
  recomendacion: DelegadoEscritura<FilaConData>;
  resultadoAccion: DelegadoEscritura<FilaConData>;
  impacto: DelegadoEscritura<FilaConData>;
  entradaMemoria: DelegadoEscritura<FilaConData>;
  gastoIA: DelegadoEscritura<FilaGasto>;
  agenteConfig: DelegadoUpsert<FilaConData>;
}
