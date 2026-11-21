// Run with: npm run test:colocacion   (Node's own test runner, no extra dependencies)
process.env.TZ = "Europe/Madrid";

import { test } from "node:test";
import assert from "node:assert/strict";
import { colocarFoto, buildPlacementIndex, type PlacementActivity, type PlacementPhoto } from "../src/lib/album-placement.ts";

// Local time of the plan: «dia 20 a las 13:30».
const t = (dia: number, h: number, mi = 0) => new Date(2026, 10, dia, h, mi).toISOString();
const act = (id: number, tipo: string, ini: string, fin: string, all_day = false): PlacementActivity => ({ id, tipo, inicio_at: ini, fin_at: fin, all_day });
const foto = (at: string | null, extra: Partial<PlacementPhoto> = {}): PlacementPhoto => ({
  id: 1, tomada_at: at, tomada_fuente: at ? "exif" : null, colocacion: null, subplan_id: null, ...extra,
});
const donde = (acts: PlacementActivity[], p: PlacementPhoto) => colocarFoto(buildPlacementIndex(acts), p);

const museo = act(1, "ACTIVIDAD", t(20, 10), t(20, 12));
const comida = act(2, "RESTAURANTE", t(20, 14), t(20, 15, 30));
const cena = act(3, "RESTAURANTE", t(20, 21), t(21, 2)); // acaba a las 02:00 del día siguiente
const manana = act(4, "ACTIVIDAD", t(21, 10), t(21, 12));
const hotel = act(5, "HOTEL", t(20, 15), t(22, 11));

test("dentro de una actividad con hora", () => {
  assert.deepEqual(donde([museo, comida], foto(t(20, 11))).destino, { kind: "actividad", subplanId: 1 });
});

test("solapadas: gana la que empezó más tarde", () => {
  const larga = act(10, "ACTIVIDAD", t(20, 10), t(20, 18));
  const corta = act(11, "ACTIVIDAD", t(20, 12), t(20, 13));
  assert.deepEqual(donde([larga, corta], foto(t(20, 12, 30))).destino, { kind: "actividad", subplanId: 11 });
  assert.deepEqual(donde([larga, corta], foto(t(20, 14))).destino, { kind: "actividad", subplanId: 10 });
});

test("entre dos actividades del mismo día: «Viaje» hasta la siguiente", () => {
  assert.deepEqual(donde([museo, comida], foto(t(20, 13))).destino, { kind: "viaje", hastaSubplanId: 2 });
});

test("con solapadas, el viaje cuenta desde el final de la que acaba más tarde", () => {
  const larga = act(10, "ACTIVIDAD", t(20, 10), t(20, 13));
  const corta = act(11, "ACTIVIDAD", t(20, 11), t(20, 12));
  const luego = act(12, "ACTIVIDAD", t(20, 16), t(20, 17));
  assert.deepEqual(donde([larga, corta, luego], foto(t(20, 12, 30))).destino, { kind: "actividad", subplanId: 10 });
  assert.deepEqual(donde([larga, corta, luego], foto(t(20, 14))).destino, { kind: "viaje", hastaSubplanId: 12 });
});

test("la noche no es un viaje: sin hotel va a «Sin clasificar»", () => {
  const r = donde([comida, manana], foto(t(21, 8)));
  assert.deepEqual(r.destino, { kind: "sin_clasificar", motivo: "otro" });
});

test("la noche va al hotel que cubre ese momento", () => {
  assert.deepEqual(donde([comida, manana, hotel], foto(t(21, 8))).destino, { kind: "actividad", subplanId: 5 });
});

test("un hotel no genera «Viaje» después de su entrada", () => {
  const cenaTarde = act(6, "RESTAURANTE", t(20, 20), t(20, 22));
  assert.deepEqual(donde([hotel, cenaTarde], foto(t(20, 17))).destino, { kind: "actividad", subplanId: 5 });
});

test("una actividad con hora dentro de la estancia gana al hotel", () => {
  assert.deepEqual(donde([hotel, comida], foto(t(20, 14, 30))).destino, { kind: "actividad", subplanId: 2 });
});

test("una cena de 21:00 a 02:00 no es de varios días", () => {
  assert.deepEqual(donde([cena, hotel], foto(t(21, 1))).destino, { kind: "actividad", subplanId: 3 });
});

test("alquiler de coche (más de 12 h, varios días) cubre las noches", () => {
  const coche = act(7, "ACTIVIDAD", t(20, 9), t(22, 9));
  assert.deepEqual(donde([coche], foto(t(21, 3))).destino, { kind: "actividad", subplanId: 7 });
});

test("todo el día: solo recibe lo que sobra, y si es la única de ese día", () => {
  const dia = act(8, "ACTIVIDAD", t(20, 0), t(21, 0), true);
  assert.deepEqual(donde([museo, dia], foto(t(20, 11))).destino, { kind: "actividad", subplanId: 1 });
  assert.deepEqual(donde([museo, dia], foto(t(20, 18))).destino, { kind: "actividad", subplanId: 8 });
});

test("todo el día: varias el mismo día → no hay forma de elegir", () => {
  const a = act(8, "ACTIVIDAD", t(20, 0), t(21, 0), true);
  const b = act(9, "ACTIVIDAD", t(20, 0), t(21, 0), true);
  assert.deepEqual(donde([a, b], foto(t(20, 18))).destino, { kind: "sin_clasificar", motivo: "otro" });
});

test("todo el día en varios días: el día siguiente cuenta, el de después no", () => {
  const v = act(8, "ACTIVIDAD", t(20, 0), t(22, 0), true); // 20 y 21
  assert.deepEqual(donde([v], foto(t(21, 18))).destino, { kind: "actividad", subplanId: 8 });
  assert.equal(donde([v], foto(t(22, 18))).destino.kind, "sin_clasificar");
});

test("sin clasificar: sin hora, antes del viaje y después de la última actividad", () => {
  assert.deepEqual(donde([museo, comida], foto(null)).destino, { kind: "sin_clasificar", motivo: "sin_hora" });
  assert.deepEqual(donde([museo, comida], foto(t(20, 8))).destino, { kind: "sin_clasificar", motivo: "antes" });
  assert.deepEqual(donde([museo, comida], foto(t(20, 20))).destino, { kind: "sin_clasificar", motivo: "despues" });
});

test("plan sin actividades: todo a «Sin clasificar»", () => {
  assert.equal(donde([], foto(t(20, 11))).destino.kind, "sin_clasificar");
});

test("hora aproximada: solo si viene del nombre o de la fecha del archivo", () => {
  assert.equal(donde([museo], foto(t(20, 11), { tomada_fuente: "exif" })).aprox, false);
  assert.equal(donde([museo], foto(t(20, 11), { tomada_fuente: "gps" })).aprox, false);
  assert.equal(donde([museo], foto(t(20, 11), { tomada_fuente: "nombre" })).aprox, true);
  assert.equal(donde([museo], foto(t(20, 11), { tomada_fuente: "archivo" })).aprox, true);
  assert.equal(donde([museo], foto(null)).aprox, false);
});

test("movida a mano: manda sobre la hora y avisa de que no coincide", () => {
  const r = donde([museo, comida], foto(t(20, 11), { colocacion: "actividad", subplan_id: 2 }));
  assert.deepEqual(r.destino, { kind: "actividad", subplanId: 2 });
  assert.deepEqual(r.auto, { kind: "actividad", subplanId: 1 });
  assert.equal(r.manual, true);
  assert.equal(r.noCoincide, true);
});

test("movida a mano a donde ya iría por su hora: no hay aviso", () => {
  const r = donde([museo, comida], foto(t(20, 11), { colocacion: "actividad", subplan_id: 1 }));
  assert.equal(r.manual, true);
  assert.equal(r.noCoincide, false);
});

test("movida a mano a un viaje y a «Sin clasificar»", () => {
  assert.deepEqual(donde([museo, comida], foto(t(20, 11), { colocacion: "viaje", subplan_id: 2 })).destino, { kind: "viaje", hastaSubplanId: 2 });
  const s = donde([museo, comida], foto(t(20, 11), { colocacion: "sin_clasificar" }));
  assert.equal(s.destino.kind, "sin_clasificar");
  assert.equal(s.noCoincide, true);
});

test("movida a mano a una actividad que ya no existe: vuelve a su hora", () => {
  const r = donde([museo, comida], foto(t(20, 11), { colocacion: "actividad", subplan_id: 99 }));
  assert.equal(r.manual, false);
  assert.deepEqual(r.destino, { kind: "actividad", subplanId: 1 });
});

test("una foto sin hora movida a mano no cuenta como «no coincide» al ir a «Sin clasificar»", () => {
  const r = donde([museo], foto(null, { colocacion: "sin_clasificar" }));
  assert.equal(r.noCoincide, false);
});

test("antes de la entrada del hotel es un viaje hasta el hotel; desde la entrada, del hotel", () => {
  const vuelo = act(20, "TRANSPORTE", t(20, 7), t(20, 8));
  const mirador = act(21, "ACTIVIDAD", t(20, 17), t(20, 18));
  const acts = [vuelo, hotel, mirador];
  assert.deepEqual(donde(acts, foto(t(20, 11))).destino, { kind: "viaje", hastaSubplanId: 5 });
  assert.deepEqual(donde(acts, foto(t(20, 16))).destino, { kind: "actividad", subplanId: 5 });
  assert.deepEqual(donde(acts, foto(t(20, 18, 30))).destino, { kind: "actividad", subplanId: 5 });
});
