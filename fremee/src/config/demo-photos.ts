/**
 * Photos of the guest demo (public/demo/lisboa, public/demo/roma and the covers in public/demo/portadas), from Wikimedia Commons.
 * Resized and converted to WebP (the miradouro one also cropped to 3:2); CC BY-SA
 * adaptations keep the same licence. The album shows these credits next to them.
 * Real trips only ever show photos their members uploaded.
 */
export type DemoPhotoCredit = {
  autor: string;
  licencia: string;
  /** Licence deed; null for public domain. */
  licenciaUrl: string | null;
  fuente: string;
};

const BY_2 = "https://creativecommons.org/licenses/by/2.0/";
const BY_4 = "https://creativecommons.org/licenses/by/4.0/";
const BY_SA_2 = "https://creativecommons.org/licenses/by-sa/2.0/";
const BY_SA_3 = "https://creativecommons.org/licenses/by-sa/3.0/";
const BY_SA_4 = "https://creativecommons.org/licenses/by-sa/4.0/";
const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

export const DEMO_PHOTO_CREDITS: Record<string, DemoPhotoCredit> = {
  "/demo/lisboa/hotel.webp": {
    autor: "Susanne Nilsson",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: BY_SA_2,
    fuente: "https://commons.wikimedia.org/wiki/File:Hotel_Avenida_Palace.jpg",
  },
  "/demo/lisboa/time-out-market.webp": {
    autor: "Ji Soo Song",
    licencia: "CC BY 2.0",
    licenciaUrl: BY_2,
    fuente: "https://commons.wikimedia.org/wiki/File:Lisbon_Time_Out_Market_(48679798813).jpg",
  },
  "/demo/lisboa/miradouro.webp": {
    autor: "Reino Baptista",
    licencia: "Dominio público",
    licenciaUrl: null,
    fuente: "https://commons.wikimedia.org/wiki/File:O_Castelo_de_S%C3%A3o_Jorge_e_a_cidade_de_Lisboa_vistos_do_Miradouro_da_Senhora_do_Monte.jpg",
  },
  "/demo/lisboa/torre-belem.webp": {
    autor: "Rodrigo Tetsuo Argenton",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Torre_de_Bel%C3%A9m_por_Rodrigo_Tetsuo_Argenton_(2).jpg",
  },
  "/demo/lisboa/pastel-de-nata.webp": {
    autor: "amanderson2",
    licencia: "Dominio público",
    licenciaUrl: null,
    fuente: "https://commons.wikimedia.org/wiki/File:Pastel_de_Nata_Porto_Portugal_(52786494622).jpg",
  },
  "/demo/lisboa/jeronimos.webp": {
    autor: "Norbert Nagel",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Jer%C3%B3nimos_Monastery_in_Bel%C3%A9m_-_Lisbon_-_Portugal_-_02.jpg",
  },
  "/demo/lisboa/alfama.webp": {
    autor: "Ingo Mehling",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Lissabon_-_Alfama_-_Largo_Santa_Luzia_-_Streetcar_-_1.jpg",
  },
  "/demo/lisboa/praca-comercio.webp": {
    autor: "Norbert Nagel",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Praca_do_Comercio_-_Lisbon_-_Portugal.jpg",
  },
  "/demo/lisboa/lx-factory.webp": {
    autor: "Andrzej Otrębski",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Lisboa_LX_Factory_1.jpg",
  },
  "/demo/lisboa/regaleira.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Quinta_da_Regaleira,_Sintra,_Portugal,_2022-07-25,_DD_15.jpg",
  },
  "/demo/lisboa/cabo-da-roca.webp": {
    autor: "Jakub Hałun",
    licencia: "CC BY 4.0",
    licenciaUrl: BY_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Cliffs_at_Cabo_da_Roca,_Portugal,_20250606_1522_0263.jpg",
  },
  "/demo/lisboa/oceanario.webp": {
    autor: "Sonse",
    licencia: "CC BY 2.0",
    licenciaUrl: BY_2,
    fuente: "https://commons.wikimedia.org/wiki/File:Batoidea_Manta_Ray_%E2%80%A2_Lisbon_Oceanarium_%E2%80%A2_Ocean%C3%A1rio_de_Lisboa.jpg",
  },
  "/demo/lisboa/pena.webp": {
    autor: "Jakub Hałun",
    licencia: "CC BY 4.0",
    licenciaUrl: BY_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Pal%C3%A1cio_Nacional_da_Pena,_Sintra,_Portugal,_20250606_1155_0102.jpg",
  },
  "/demo/roma/coliseo.webp": {
    autor: "Wilfredor",
    licencia: "CC0",
    licenciaUrl: CC0,
    fuente: "https://commons.wikimedia.org/wiki/File:Colosseum_of_Rome_and_Roman_forum.jpg",
  },
  "/demo/roma/trevi.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Fuente_de_Trevi,_Roma,_Italia,_2022-09-15,_DD_02.jpg",
  },
  "/demo/roma/san-pedro.webp": {
    autor: "Diliff",
    licencia: "CC BY-SA 3.0",
    licenciaUrl: BY_SA_3,
    fuente: "https://commons.wikimedia.org/wiki/File:St_Peter%27s_Square,_Vatican_City_-_April_2007.jpg",
  },
  "/demo/roma/trastevere.webp": {
    autor: "Krzysztof Golik",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Santa_Maria_in_Trastevere_church_in_Rome_(13).jpg",
  },
  "/demo/roma/navona.webp": {
    autor: "Dietmar Rabich",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Rome_(Italy),_Piazza_Navona_--_2013_--_4418.jpg",
  },
  "/demo/roma/escalinata.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: BY_SA_4,
    fuente: "https://commons.wikimedia.org/wiki/File:Escalinata_de_la_plaza_de_Espa%C3%B1a,_Roma,_Italia,_2022-09-14,_DD_21.jpg",
  },
  "/demo/portadas/cumpleanos.webp": {
    autor: "Shixart1985",
    licencia: "CC BY 2.0",
    licenciaUrl: BY_2,
    fuente: "https://commons.wikimedia.org/wiki/File:Celebrating_a_50th_birthday_with_a_cake_featuring_lit_candles_and_chocolate_frosting.jpg",
  },
  "/demo/lisboa/aeropuerto.webp": {
    autor: "Jcornelius",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Lisbon_Airport,_Terminal_2_(1).jpg",
  },
  "/demo/lisboa/hotel-avenida.webp": {
    autor: "Juanje Orío from Logroño, España (Europa)",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:%F0%9F%87%B5%F0%9F%87%B9_%F0%9F%87%AA%F0%9F%87%BA_Hotel_Avenida_Palace_(Lisboa,_Portugal,_10-7-2010)_(49945669856).jpg",
  },
  "/demo/lisboa/rossio.webp": {
    autor: "Simon Burchell",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Pra%C3%A7a_Dom_Pedro_IV,_Lisboa_01.jpg",
  },
  "/demo/lisboa/santa-justa.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Elevador_de_Santa_Justa,_Lisboa,_Portugal,_2022-07-24,_DD_09.jpg",
  },
  "/demo/lisboa/arco-augusta.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 3.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Arco_Triunfal_da_Rua_Augusta,_Plaza_del_Comercio,_Lisboa,_Portugal,_2012-05-12,_DD_02.JPG",
  },
  "/demo/lisboa/tranvia.webp": {
    autor: "Sonse",
    licencia: "CC BY 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Tram_Line_28_in_Alfama_(50662582522).jpg",
  },
  "/demo/lisboa/castelo.webp": {
    autor: "Simon Burchell",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Castelo_de_S%C3%A3o_Jorge,_Lisboa_116.jpg",
  },
  "/demo/lisboa/santa-luzia.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 3.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Vistas_de_Lisboa_desde_el_Mirador_de_Santa_Luzia,_Portugal,_2012-05-12,_DD_01.JPG",
  },
  "/demo/lisboa/fado.webp": {
    autor: "Vitor Oliveira from Torres Vedras, PORTUGAL",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Museu_do_Fado_-_Lisboa_-_Portugal_(52852487437).jpg",
  },
  "/demo/lisboa/se-lisboa.webp": {
    autor: "Jakub Hałun",
    licencia: "CC BY 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Rose_window,_center_of_west_facade_of_S%C3%A9_de_Lisboa,_20250603_1954_9005.jpg",
  },
  "/demo/lisboa/padrao.webp": {
    autor: "Jakub Hałun",
    licencia: "CC BY 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Monument_of_the_Discoveries_in_Bel%C3%A9m,_Lisbon,_20250607_1022_0430.jpg",
  },
  "/demo/lisboa/jeronimos-claustro.webp": {
    autor: "Norbert Nagel",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Frontal_view_of_the_cloister_arcades_-_Mosteiro_dos_Jer%C3%B3nimos_-_Lisbon_-_2026-05-14.jpg",
  },
  "/demo/lisboa/ler-devagar.webp": {
    autor: "Vitor Oliveira from Torres Vedras, PORTUGAL",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Livraria_Ler_Devagar_-_Lx_Factory_-_Lisboa_-_Portugal_%F0%9F%87%B5%F0%9F%87%B9_(54128161728).jpg",
  },
  "/demo/lisboa/ponte-abril.webp": {
    autor: "Vitor Oliveira from Torres Vedras, PORTUGAL",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Ponte_25_de_Abril_-_Lisboa_-_Portugal_(48002947667).jpg",
  },
  "/demo/lisboa/sintra-palacio.webp": {
    autor: "Diego Delso",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Palacio_Nacional,_Sintra,_Portugal,_2019-05-25,_DD_89.jpg",
  },
  "/demo/lisboa/pena-terraza.webp": {
    autor: "tak.wing",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Sintra,_Pal%C3%A1cio_Nacional_da_Pena,_Terra%C3%A7o_da_Rainha_(1).jpg",
  },
  "/demo/lisboa/regaleira-poco.webp": {
    autor: "Jules Verne Times Two",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Po%C3%A7o_inici%C3%A1tico,_Quinta_da_Regaleira,_Sintra,_Portugal_julesvernex2.jpg",
  },
  "/demo/lisboa/sintra-tren.webp": {
    autor: "Edgar Jiménez from Ibagué, Colombia",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Comboio_do_CP_na_esta%C3%A7%C3%A3o_do_Rossio.jpg",
  },
  "/demo/lisboa/cabo-faro.webp": {
    autor: "CEphoto, Uwe Aranas",
    licencia: "CC BY-SA 3.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Portugal_Cabo-da-Roca-Lighthouse-03.jpg",
  },
  "/demo/lisboa/oceanario-tanque.webp": {
    autor: "Vitor Oliveira from Torres Vedras, PORTUGAL",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Ocean%C3%A1rio_de_Lisboa_-_Portugal_(46201161184).jpg",
  },
  "/demo/lisboa/parque-naciones.webp": {
    autor: "Vitor Oliveira from Torres Vedras, PORTUGAL",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Torre_Vasco_da_Gama_e_Parque_das_Na%C3%A7%C3%B5es_-_Lisboa_(Portugal)_(55169543).jpg",
  },
  "/demo/lisboa/pastel-nata.webp": {
    autor: "Dietmar Rabich",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Funchal_(Madeira,_Portugal),_Rua_Dr._Fern%C3%A3o_de_Ornelas,_Nata_7_-_Fern%C3%A3o_Ornelas_--_2025_--_1205.jpg",
  },
  "/demo/lisboa/mercado-time-out.webp": {
    autor: "Sonse",
    licencia: "CC BY 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Mercado_da_Ribeira,_Time_Out_Market,_Lisbon.jpg",
  },
  "/demo/lisboa/tuk-tuk.webp": {
    autor: "@ondasderuido",
    licencia: "CC BY-SA 2.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Lisboa,_tuk-tuk,_preto_e_branco.jpg",
  },
  "/demo/lisboa/azulejos.webp": {
    autor: "LBM1948",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Lisboa,_azulejos_2.jpg",
  },
  "/demo/lisboa/pasteis-belem.webp": {
    autor: "Ø11",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Past%C3%A9is_de_Bel%C3%A9m_-_Lisbon.jpg",
  },
  "/demo/lisboa/cabo-acantilado.webp": {
    autor: "Ввласенко",
    licencia: "CC BY-SA 3.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Cabo_da_Roca_-_Cape_Roca.JPG",
  },
  "/demo/lisboa/atardecer-tejo.webp": {
    autor: "Jules Verne Times Two",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fuente: "https://commons.wikimedia.org/wiki/File:Eborense_ferry_at_sunset,_Esta%C3%A7%C3%A3o_Fluvial_de_Bel%C3%A9m,_Lisbon,_Portugal_julesvernex2.jpg",
  },
};

/** The seed repeats each image under «?n=N» so every photo row has its own url; credits are by path. */
export function demoPhotoCredit(url: string): DemoPhotoCredit | undefined {
  return DEMO_PHOTO_CREDITS[url.split("?")[0]];
}

/** The credits of a set of photos, one per source: the seed repeats each image, but its credit is listed once. */
export function uniqueDemoCredits(urls: string[]): DemoPhotoCredit[] {
  const seen = new Map<string, DemoPhotoCredit>();
  for (const url of urls) {
    const c = demoPhotoCredit(url);
    if (c && !seen.has(c.fuente)) seen.set(c.fuente, c);
  }
  return [...seen.values()];
}
