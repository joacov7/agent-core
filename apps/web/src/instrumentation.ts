// Next ejecuta esto una vez al arrancar el server (dev y prod). Levanta el programador de avisos
// del Asistente personal (solo con SCHEDULER=on). Edge no tiene fs ni timers: solo Node.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarProgramador } = await import("./lib/avisos");
  iniciarProgramador();
}
