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
};
