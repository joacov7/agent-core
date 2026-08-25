import { randomUUID } from "node:crypto";

/** Reloj inyectable (para tests/determinismo). */
export type Reloj = () => Date;
/** Generador de ids inyectable (para tests/determinismo). */
export type GenerarId = () => string;

export const relojPorDefecto: Reloj = () => new Date();
export const generarIdPorDefecto: GenerarId = () => randomUUID();
