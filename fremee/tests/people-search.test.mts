// Run with: node tests/people-search.test.mts   (Node's own test runner, no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparResultados, cabeceraSeccion, contexto, formatearDesde, iniciales, partirCoincidencia, tinte, type PersonaBusqueda } from "../src/lib/people-search.ts";

const base: PersonaBusqueda = {
  id: "u1", nombre: "Carmen López", username: "carmen.lopez", profile_image: null,
  relacion: "ninguna", amigos_comun: 0, nombres_comun: [], planes_juntos: 0, plan_titulo: null,
  desde: "2026-06-15T12:00:00Z",
};
const p = (o: Partial<PersonaBusqueda>): PersonaBusqueda => ({ ...base, ...o });

test("contexto: amigos, con y sin planes juntos", () => {
  assert.deepEqual(contexto(p({ relacion: "amigos" })), { tipo: "amigos", texto: "Amigos" });
  assert.equal(contexto(p({ relacion: "amigos", planes_juntos: 1 })).texto, "Amigos · 1 plan juntos");
  assert.equal(contexto(p({ relacion: "amigos", planes_juntos: 2 })).texto, "Amigos · 2 planes juntos");
});

test("contexto: solicitud pendiente gana a lo demás", () => {
  assert.deepEqual(contexto(p({ relacion: "pendiente", amigos_comun: 2, nombres_comun: ["A", "B"] })), { tipo: "pendiente", texto: "Solicitud pendiente" });
});

test("contexto: amigos en común, con nombres hasta 3", () => {
  assert.equal(contexto(p({ amigos_comun: 1, nombres_comun: ["Marc"] })).texto, "1 amigo en común: Marc");
  assert.equal(contexto(p({ amigos_comun: 2, nombres_comun: ["Laura", "Marc"] })).texto, "2 amigos en común: Laura y Marc");
  assert.equal(contexto(p({ amigos_comun: 3, nombres_comun: ["Laura", "Marc", "Sara"] })).texto, "3 amigos en común: Laura, Marc y Sara");
  // Más de 3: no se listan (no cabrían ni dirían quiénes son todos).
  assert.equal(contexto(p({ amigos_comun: 5, nombres_comun: ["Laura", "Marc", "Sara"] })).texto, "5 amigos en común");
});

test("contexto: viene a un plan, y la fecha de alta como último recurso", () => {
  assert.equal(contexto(p({ planes_juntos: 1, plan_titulo: "Barcelona → Lisboa" })).texto, "Viene a Barcelona → Lisboa");
  assert.equal(contexto(p({ planes_juntos: 3, plan_titulo: "Roma" })).texto, "Viene a Roma y 2 más");
  assert.deepEqual(contexto(p({})), { tipo: "desde", texto: "En Frimee desde jun 2026" });
  assert.equal(contexto(p({ desde: "no es una fecha" })).texto, "En Frimee");
});

test("formatearDesde", () => {
  assert.equal(formatearDesde("2025-04-10T12:00:00Z"), "abr 2025");
  assert.equal(formatearDesde("basura"), "");
});

test("agruparResultados: tres grupos en orden y sin grupos vacíos", () => {
  const gente = [
    p({ id: "1", relacion: "amigos" }),
    p({ id: "2", relacion: "pendiente" }),
    p({ id: "3", amigos_comun: 2 }),
    p({ id: "4", planes_juntos: 1, plan_titulo: "X" }),
    p({ id: "5" }),
  ];
  const s = agruparResultados(gente);
  assert.deepEqual(s.map((x) => [x.clave, x.personas.map((q) => q.id)]), [
    ["amigos", ["1"]],
    ["conoces", ["2", "3", "4"]],
    ["mas", ["5"]],
  ]);
  assert.equal(cabeceraSeccion(s[1]), "Puede que conozcas · 3");
  assert.deepEqual(agruparResultados([p({ id: "5" })]).map((x) => x.clave), ["mas"]);
  assert.deepEqual(agruparResultados([]), []);
});

test("partirCoincidencia: sin tildes ni mayúsculas, conserva el texto original", () => {
  assert.deepEqual(partirCoincidencia("Óscar Navarro", "osc"), { pre: "", hit: "Ósc", post: "ar Navarro", ok: true });
  assert.deepEqual(partirCoincidencia("Jordi Casas", "ca"), { pre: "Jordi ", hit: "Ca", post: "sas", ok: true });
  assert.deepEqual(partirCoincidencia("@carmen.lopez", "lopez"), { pre: "@carmen.", hit: "lopez", post: "", ok: true });
  assert.equal(partirCoincidencia("Pau Riera", "xyz").ok, false);
  assert.equal(partirCoincidencia("Pau Riera", "").ok, false);
});

test("iniciales y tinte", () => {
  assert.equal(iniciales("Carmen López"), "CL");
  assert.equal(iniciales("óscar navarro ruiz"), "ÓN");
  assert.equal(iniciales("Pau"), "P");
  assert.equal(iniciales("  "), "?");
  assert.equal(tinte("abc"), tinte("abc"));
  for (const id of ["a", "b", "c", "9f1c-aa", "zzzz"]) assert.ok(tinte(id) >= 0 && tinte(id) <= 5);
});
