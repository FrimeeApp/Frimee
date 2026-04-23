export type Airport = { lat: number; lon: number; city: string; name: string };

export const AIRPORTS: Record<string, Airport> = {
  // ── España ──────────────────────────────────────────────────────────────────
  MAD: { lat: 40.4719, lon: -3.5626, city: "Madrid",        name: "Barajas" },
  BCN: { lat: 41.2971, lon:  2.0785, city: "Barcelona",     name: "El Prat" },
  AGP: { lat: 36.6749, lon: -4.4991, city: "Málaga",        name: "Costa del Sol" },
  PMI: { lat: 39.5517, lon:  2.7388, city: "Palma",         name: "Son Sant Joan" },
  ALC: { lat: 38.2822, lon: -0.5582, city: "Alicante",      name: "El Altet" },
  VLC: { lat: 39.4893, lon: -0.4816, city: "Valencia",      name: "Valencia" },
  SVQ: { lat: 37.4180, lon: -5.8931, city: "Sevilla",       name: "San Pablo" },
  BIO: { lat: 43.3011, lon: -2.9106, city: "Bilbao",        name: "Loiu" },
  SDR: { lat: 43.4271, lon: -3.8200, city: "Santander",     name: "Parayas" },
  SCQ: { lat: 42.8963, lon: -8.4151, city: "Santiago",      name: "Rosaleda" },
  LPA: { lat: 27.9319, lon:-15.3866, city: "Gran Canaria",  name: "Las Palmas" },
  TFN: { lat: 28.4827, lon:-16.3415, city: "Tenerife",      name: "Norte" },
  TFS: { lat: 28.0445, lon:-16.5725, city: "Tenerife",      name: "Sur" },
  IBZ: { lat: 38.8729, lon:  1.3731, city: "Ibiza",         name: "Ibiza" },
  GRX: { lat: 37.1887, lon: -3.7774, city: "Granada",       name: "Federico García Lorca" },
  MRS: { lat: 43.4393, lon:  5.2215, city: "Marsella",      name: "Provence" },
  FLR: { lat: 43.8099, lon: 11.2051, city: "Florencia",     name: "Amerigo Vespucci" },
  PSA: { lat: 43.6839, lon: 10.3927, city: "Pisa",          name: "Galileo Galilei" },
  VCE: { lat: 45.5053, lon: 12.3519, city: "Venecia",       name: "Marco Polo" },
  BLQ: { lat: 44.5354, lon: 11.2887, city: "Bolonia",       name: "Guglielmo Marconi" },
  TRN: { lat: 45.2009, lon:  7.6497, city: "Turín",         name: "Caselle" },
  GEN: { lat: 44.4133, lon:  8.8375, city: "Génova",        name: "Cristoforo Colombo" },

  // ── Europa ───────────────────────────────────────────────────────────────────
  LHR: { lat: 51.4700, lon: -0.4543, city: "Londres",       name: "Heathrow" },
  LGW: { lat: 51.1481, lon: -0.1903, city: "Londres",       name: "Gatwick" },
  STN: { lat: 51.8850, lon:  0.2350, city: "Londres",       name: "Stansted" },
  CDG: { lat: 49.0097, lon:  2.5479, city: "París",         name: "Charles de Gaulle" },
  ORY: { lat: 48.7233, lon:  2.3794, city: "París",         name: "Orly" },
  AMS: { lat: 52.3105, lon:  4.7683, city: "Ámsterdam",     name: "Schiphol" },
  FRA: { lat: 50.0379, lon:  8.5622, city: "Fráncfort",     name: "Main" },
  MUC: { lat: 48.3537, lon: 11.7750, city: "Múnich",        name: "Franz Josef Strauss" },
  BER: { lat: 52.3667, lon: 13.5033, city: "Berlín",        name: "Brandenburg" },
  HAM: { lat: 53.6304, lon:  9.9882, city: "Hamburgo",      name: "Hamburg" },
  VIE: { lat: 48.1103, lon: 16.5697, city: "Viena",         name: "Schwechat" },
  ZRH: { lat: 47.4647, lon:  8.5492, city: "Zúrich",        name: "Kloten" },
  GVA: { lat: 46.2380, lon:  6.1089, city: "Ginebra",       name: "Cointrin" },
  FCO: { lat: 41.8003, lon: 12.2389, city: "Roma",          name: "Fiumicino" },
  MXP: { lat: 45.6306, lon:  8.7281, city: "Milán",         name: "Malpensa" },
  LIN: { lat: 45.4509, lon:  9.2768, city: "Milán",         name: "Linate" },
  NAP: { lat: 40.8860, lon: 14.2908, city: "Nápoles",       name: "Capodichino" },
  BRU: { lat: 50.9010, lon:  4.4844, city: "Bruselas",      name: "Zaventem" },
  CPH: { lat: 55.6180, lon: 12.6560, city: "Copenhague",    name: "Kastrup" },
  OSL: { lat: 60.1939, lon: 11.1004, city: "Oslo",          name: "Gardermoen" },
  ARN: { lat: 59.6519, lon: 17.9186, city: "Estocolmo",     name: "Arlanda" },
  HEL: { lat: 60.3172, lon: 24.9633, city: "Helsinki",      name: "Vantaa" },
  LIS: { lat: 38.7742, lon: -9.1342, city: "Lisboa",        name: "Humberto Delgado" },
  OPO: { lat: 41.2481, lon: -8.6814, city: "Oporto",        name: "Francisco Sá Carneiro" },
  ATH: { lat: 37.9364, lon: 23.9445, city: "Atenas",        name: "Venizelos" },
  IST: { lat: 41.2753, lon: 28.7519, city: "Estambul",      name: "Ataturk" },
  SAW: { lat: 40.8985, lon: 29.3092, city: "Estambul",      name: "Sabiha Gökçen" },
  DUB: { lat: 53.4213, lon: -6.2701, city: "Dublín",        name: "Dublin" },
  PRG: { lat: 50.1008, lon: 14.2600, city: "Praga",         name: "Václav Havel" },
  WAW: { lat: 52.1657, lon: 20.9671, city: "Varsovia",      name: "Chopin" },
  BUD: { lat: 47.4298, lon: 19.2611, city: "Budapest",      name: "Liszt" },
  OTP: { lat: 44.5722, lon: 26.1020, city: "Bucarest",      name: "Otopeni" },
  SVO: { lat: 55.9726, lon: 37.4146, city: "Moscú",         name: "Sheremetyevo" },
  DME: { lat: 55.4088, lon: 37.9063, city: "Moscú",         name: "Domodedovo" },
  TXL: { lat: 52.5597, lon: 13.2877, city: "Berlín",        name: "Tegel" },
  NCE: { lat: 43.6584, lon:  7.2159, city: "Niza",          name: "Côte d'Azur" },
  LYS: { lat: 45.7256, lon:  5.0811, city: "Lyon",          name: "Saint-Exupéry" },
  NTE: { lat: 47.1532, lon: -1.6108, city: "Nantes",        name: "Atlantique" },
  TLS: { lat: 43.6293, lon:  1.3638, city: "Toulouse",      name: "Blagnac" },

  // ── América del Norte ────────────────────────────────────────────────────────
  JFK: { lat: 40.6413, lon:-73.7781, city: "Nueva York",    name: "JFK" },
  LGA: { lat: 40.7772, lon:-73.8726, city: "Nueva York",    name: "LaGuardia" },
  EWR: { lat: 40.6895, lon:-74.1745, city: "Nueva York",    name: "Newark" },
  LAX: { lat: 33.9425, lon:-118.4081,city: "Los Ángeles",   name: "LAX" },
  ORD: { lat: 41.9742, lon:-87.9073, city: "Chicago",       name: "O'Hare" },
  ATL: { lat: 33.6407, lon:-84.4277, city: "Atlanta",       name: "Hartsfield-Jackson" },
  DFW: { lat: 32.8998, lon:-97.0403, city: "Dallas",        name: "Fort Worth" },
  SFO: { lat: 37.6213, lon:-122.3790,city: "San Francisco", name: "SFO" },
  MIA: { lat: 25.7959, lon:-80.2870, city: "Miami",         name: "Miami" },
  BOS: { lat: 42.3656, lon:-71.0096, city: "Boston",        name: "Logan" },
  SEA: { lat: 47.4502, lon:-122.3088,city: "Seattle",       name: "Sea-Tac" },
  DEN: { lat: 39.8561, lon:-104.6737,city: "Denver",        name: "Denver" },
  LAS: { lat: 36.0840, lon:-115.1537,city: "Las Vegas",     name: "Harry Reid" },
  MCO: { lat: 28.4294, lon:-81.3089, city: "Orlando",       name: "Orlando" },
  YYZ: { lat: 43.6777, lon:-79.6248, city: "Toronto",       name: "Pearson" },
  YUL: { lat: 45.4706, lon:-73.7408, city: "Montreal",      name: "Trudeau" },
  YVR: { lat: 49.1967, lon:-123.1815,city: "Vancouver",     name: "YVR" },
  MEX: { lat: 19.4363, lon:-99.0721, city: "Ciudad de México", name: "AICM" },
  CUN: { lat: 21.0365, lon:-86.8771, city: "Cancún",        name: "Cancún" },

  // ── América del Sur ──────────────────────────────────────────────────────────
  GRU: { lat:-23.4356, lon:-46.4731, city: "São Paulo",     name: "Guarulhos" },
  GIG: { lat:-22.8099, lon:-43.2505, city: "Río de Janeiro",name: "Galeão" },
  EZE: { lat:-34.8222, lon:-58.5358, city: "Buenos Aires",  name: "Ezeiza" },
  SCL: { lat:-33.3930, lon:-70.7858, city: "Santiago",      name: "Arturo Merino Benítez" },
  BOG: { lat:  4.7016, lon:-74.1469, city: "Bogotá",        name: "El Dorado" },
  LIM: { lat:-12.0219, lon:-77.1143, city: "Lima",          name: "Jorge Chávez" },

  // ── Asia ─────────────────────────────────────────────────────────────────────
  DXB: { lat: 25.2532, lon: 55.3657, city: "Dubái",         name: "Dubai" },
  AUH: { lat: 24.4330, lon: 54.6511, city: "Abu Dabi",      name: "Zayed" },
  DOH: { lat: 25.2731, lon: 51.6080, city: "Doha",          name: "Hamad" },
  SIN: { lat:  1.3644, lon: 103.9915,city: "Singapur",      name: "Changi" },
  HKG: { lat: 22.3080, lon: 113.9185,city: "Hong Kong",     name: "HKIA" },
  PEK: { lat: 40.0801, lon: 116.5846,city: "Pekín",         name: "Capital" },
  PVG: { lat: 31.1443, lon: 121.8083,city: "Shanghái",      name: "Pudong" },
  NRT: { lat: 35.7653, lon: 140.3856,city: "Tokio",         name: "Narita" },
  HND: { lat: 35.5494, lon: 139.7798,city: "Tokio",         name: "Haneda" },
  ICN: { lat: 37.4602, lon: 126.4407,city: "Seúl",          name: "Incheon" },
  BKK: { lat: 13.6811, lon: 100.7475,city: "Bangkok",       name: "Suvarnabhumi" },
  KUL: { lat:  2.7456, lon: 101.7099,city: "Kuala Lumpur",  name: "KLIA" },
  DEL: { lat: 28.5665, lon: 77.1031, city: "Nueva Delhi",   name: "Indira Gandhi" },
  BOM: { lat: 19.0896, lon: 72.8656, city: "Bombay",        name: "Chhatrapati Shivaji" },
  TLV: { lat: 32.0114, lon: 34.8867, city: "Tel Aviv",      name: "Ben Gurion" },

  // ── África ───────────────────────────────────────────────────────────────────
  CAI: { lat: 30.1219, lon: 31.4056, city: "El Cairo",      name: "Cairo" },
  JNB: { lat:-26.1392, lon: 28.2460, city: "Johannesburgo", name: "O.R. Tambo" },
  CMN: { lat: 33.3675, lon: -7.5900, city: "Casablanca",    name: "Mohammed V" },
  NBO: { lat: -1.3192, lon: 36.9275, city: "Nairobi",       name: "Jomo Kenyatta" },

  // ── Oceanía ──────────────────────────────────────────────────────────────────
  SYD: { lat:-33.9399, lon: 151.1753,city: "Sídney",        name: "Kingsford Smith" },
  MEL: { lat:-37.6733, lon: 144.8430,city: "Melbourne",     name: "Tullamarine" },
  AKL: { lat:-37.0082, lon: 174.7917,city: "Auckland",      name: "Auckland" },
};

export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Projects the current position onto the great-circle path origin→dest
 * and returns the fraction [0,1] along that path.
 *
 * Uses the cross-track / along-track distance formula so lateral deviations
 * (holding patterns, ATC vectoring) don't inflate the progress.
 */
export function flightProgressFromPosition(
  originIata: string,
  destIata:   string,
  currentLat: number,
  currentLon: number,
): number | null {
  const origin = AIRPORTS[originIata.toUpperCase()];
  const dest   = AIRPORTS[destIata.toUpperCase()];
  if (!origin || !dest) return null;

  const total   = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
  const covered = haversineKm(origin.lat, origin.lon, currentLat, currentLon);
  if (total === 0) return null;
  return Math.min(1, Math.max(0, covered / total));
}

/**
 * Time-based progress fallback when GPS position is unavailable.
 */
export function flightProgressFromTime(
  startsAt: string,
  endsAt:   string,
): number {
  const now   = Date.now();
  const start = new Date(startsAt).getTime();
  const end   = new Date(endsAt).getTime();
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
