export const VALID_TASK_CATEGORIES = ["vuelo", "ferry", "coche", "alojamiento", "actividad", "comida", "otro"] as const;

export const PLAN_WRITE_COMMANDS = new Set([
  "tarea",
  "gasto",
  "votar",
  "voto",
  "recordar",
  "admin",
  "deadmin",
  "expulsar",
]);
