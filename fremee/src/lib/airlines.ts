/**
 * OpenSky identifica los vuelos por indicativo ICAO (IBE3157), no por el número comercial (IB3157).
 * Esta tabla pasa del código IATA de la aerolínea (2 caracteres) al ICAO (3 letras).
 */
const IATA_TO_ICAO: Record<string, string> = {
  // España y Portugal
  IB: "IBE", I2: "IBS", VY: "VLG", UX: "AEA", V7: "VOE", EB: "PLM", XG: "SXD", TP: "TAP", NI: "PGA", HV: "TRA",
  // Europa
  FR: "RYR", U2: "EZY", EC: "EJU", W6: "WZZ", W4: "WMT", BA: "BAW", LH: "DLH", EW: "EWG", AF: "AFR", HOP: "HOP",
  A5: "HOP", KL: "KLM", AZ: "ITY", LX: "SWR", OS: "AUA", SN: "BEL", SK: "SAS", DY: "NOZ", D8: "IBK", AY: "FIN",
  EI: "EIN", LO: "LOT", OK: "CSA", RO: "ROT", A3: "AEE", OA: "OAL", BT: "BTI", TK: "THY", PC: "PGT", TO: "TVF",
  EN: "DLA", LS: "EXS", MT: "TCX", BY: "TOM", VS: "VIR", KM: "AMC", JU: "ASL", OU: "CTN", FB: "LZB", JP: "ADR",
  // Oriente Medio y África
  EK: "UAE", QR: "QTR", EY: "ETD", SV: "SVA", FZ: "FDB", WY: "OMA", GF: "GFA", MS: "MSR", AT: "RAM", ET: "ETH",
  SA: "SAA", KQ: "KQA", TU: "TAR", AH: "DAH",
  // América
  AA: "AAL", UA: "UAL", DL: "DAL", WN: "SWA", B6: "JBU", AS: "ASA", NK: "NKS", F9: "FFT", AC: "ACA", WS: "WJA",
  AM: "AMX", AV: "AVA", CM: "CMP", LA: "LAN", JJ: "TAM", G3: "GLO", AR: "ARG", AD: "AZU", H2: "SKU", Y4: "VOI",
  CU: "CUB", UP: "BHS",
  // Asia y Oceanía
  QF: "QFA", NZ: "ANZ", SQ: "SIA", CX: "CPA", NH: "ANA", JL: "JAL", KE: "KAL", OZ: "AAR", AI: "AIC", "6E": "IGO",
  TG: "THA", MH: "MAS", GA: "GIA", PR: "PAL", VN: "HVN", CA: "CCA", MU: "CES", CZ: "CSN", BR: "EVA", CI: "CAL",
  AK: "AXM", TR: "TGW", "3K": "JSA", EL: "ELO",
};

/**
 * Indicativo ICAO a partir de un texto como «Iberia IB3157», «IB 3157» o «IBE3157».
 * Devuelve null si no hay número de vuelo o la aerolínea no está en la tabla.
 */
export function flightCallsign(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = /\b([A-Z]{2,3}|[A-Z][0-9]|[0-9][A-Z])\s?(\d{1,4})[A-Z]?\b/.exec(text.toUpperCase());
  if (!m) return null;
  const [, prefix, num] = m;
  if (prefix.length === 3) return `${prefix}${num}`; // ya es ICAO
  const icao = IATA_TO_ICAO[prefix];
  return icao ? `${icao}${num}` : null;
}
