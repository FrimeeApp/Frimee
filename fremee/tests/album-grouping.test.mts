// Run with: npm run test:agrupado
process.env.TZ = "Europe/Madrid";

import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparAlbum, type GroupActivity, type GroupPhoto } from "../src/lib/album-grouping.ts";

const t = (dia: number, h: number, mi = 0) => new Date(2026, 10, dia, h, mi).toISOString();
const act = (id: number, titulo: string, tipo: string, ini: string, fin: string, all_day = false): GroupActivity => ({
  id, titulo, tipo, inicio_at: ini, fin_at: fin, all_day, ubicacion_nombre: null,
});
let n = 0;
const foto = (at: string | null, extra: Partial<GroupPhoto> = {}): GroupPhoto => ({
  id: ++n, tomada_at: at, tomada_fuente: at ? "exif" : null, colocacion: null, subplan_id: null, created_at: t(30, 12), url: `https://x/${n}.jpg`, user_id: "u1", ...extra,
});

const vuelo = act(1, "Vuelo", "TRANSPORTE", t(21, 7), t(21, 8));
const hotel = act(2, "Hotel Alfama", "HOTEL", t(21, 15), t(25, 11));
const mirador = act(3, "Mirador", "ACTIVIDAD", t(21, 17), t(21, 18, 30));
const torre = act(4, "Torre de Belém", "ACTIVIDAD", t(22, 10), t(22, 12));
const comida = act(5, "Comida", "RESTAURANTE", t(22, 14), t(22, 15));
const acts = [vuelo, hotel, mirador, torre, comida];
const plan = { planInicio: t(21, 0), planFin: t(25, 0) };

test("días del plan, con su número, y fotos en su actividad", () => {
  const g = agruparAlbum({ ...plan, actividades: acts, fotos: [foto(t(21, 7, 30)), foto(t(22, 11))] });
  assert.deepEqual(g.days.map((d) => [d.key, d.numero, d.fotoCount]), [
    ["2026-11-21", 1, 1], ["2026-11-22", 2, 1], ["2026-11-23", 3, 0], ["2026-11-24", 4, 0], ["2026-11-25", 5, 0],
  ]);
  assert.equal(g.days[0].blocks[0].kind === "actividad" && g.days[0].blocks[0].actividad.titulo, "Vuelo");
  assert.equal(g.total, 2);
});

test("el viaje sale entre sus dos actividades, con la de origen", () => {
  const g = agruparAlbum({ ...plan, actividades: acts, fotos: [foto(t(22, 13)), foto(t(22, 11))] });
  const bloques = g.days[1].blocks;
  assert.deepEqual(bloques.map((b) => b.kind), ["actividad", "viaje"]);
  const v = bloques[1];
  assert.ok(v.kind === "viaje" && v.desde?.titulo === "Torre de Belém" && v.hasta.titulo === "Comida");
});

test("la estancia aparece día a día con «Sigue» y la noche", () => {
  const g = agruparAlbum({ ...plan, actividades: acts, fotos: [foto(t(21, 16)), foto(t(22, 8)), foto(t(25, 9))] });
  const dia1 = g.days[0].blocks[0];
  assert.ok(dia1.kind === "actividad" && dia1.sigue === null && dia1.actividad.titulo === "Hotel Alfama");
  const dia2 = g.days[1].blocks[0];
  assert.ok(dia2.kind === "actividad" && dia2.sigue?.noche === 2 && dia2.sigue.total === 4 && dia2.ordinal === null);
  const dia5 = g.days[4].blocks[0];
  assert.ok(dia5.kind === "actividad" && dia5.sigue?.salida === true);
});

test("sin clasificar por motivo y, si es enorme, por fecha", () => {
  const pocas = agruparAlbum({ ...plan, actividades: acts, fotos: [foto(null), foto(t(10, 12)), foto(t(30, 12))] });
  assert.equal(pocas.sinClasificar.porFecha, false);
  assert.deepEqual(pocas.sinClasificar.grupos.map((x) => x.motivo), ["antes", "despues", "sin_hora"]);
  const muchas = agruparAlbum({
    ...plan, actividades: acts,
    fotos: [...Array.from({ length: 12 }, () => foto(t(28, 21))), ...Array.from({ length: 9 }, () => foto(t(29, 21))), foto(null)],
  });
  assert.equal(muchas.sinClasificar.porFecha, true);
  assert.deepEqual(muchas.sinClasificar.grupos.map((x) => [x.dayKey, x.fotos.length]), [["2026-11-28", 12], ["2026-11-29", 9], [null, 1]]);
});

test("álbum sin fotos: con incluirVacios salen todas las actividades vacías", () => {
  const g = agruparAlbum({ ...plan, actividades: acts, fotos: [], incluirVacios: true });
  assert.equal(g.days[0].blocks.length, 3);
  assert.ok(g.days[0].blocks.every((b) => b.fotos.length === 0));
  assert.equal(agruparAlbum({ ...plan, actividades: acts, fotos: [] }).days.every((d) => d.blocks.length === 0), true);
});

test("foto movida a mano a una actividad: sale en esa actividad", () => {
  const g = agruparAlbum({ ...plan, actividades: acts, fotos: [foto(t(22, 11), { colocacion: "actividad", subplan_id: 5 })] });
  const b = g.days[1].blocks[0];
  assert.ok(b.kind === "actividad" && b.actividad.id === 5 && b.fotos[0].colocacion.manual);
});

test("Mover a…: días con actividades, viajes y estancias que siguen, con cuántas fotos hay", async () => {
  const { opcionesMover } = await import("../src/lib/album-grouping.ts");
  const g = agruparAlbum({ ...plan, actividades: acts, fotos: [foto(t(22, 11)), foto(t(22, 8))] });
  const dias = opcionesMover(acts, g);
  assert.equal(dias.length, 5);
  assert.deepEqual(dias[0].options.map((o) => [o.kind, o.titulo]), [
    ["actividad", "Vuelo"], ["viaje", "Vuelo → Hotel Alfama"], ["actividad", "Hotel Alfama"], ["actividad", "Mirador"],
  ]);
  assert.deepEqual(dias[1].options.map((o) => [o.id, o.count]), [
    ["sigue-2-2026-11-22", 1], ["act-4", 1], ["viaje-5", 0], ["act-5", 0],
  ]);
  assert.equal(dias[1].options[0].detalle, "noche 2");
  assert.equal(dias[4].options[0].detalle, "salida");
  assert.equal(dias[0].options[3].ordinal, 2);
});
