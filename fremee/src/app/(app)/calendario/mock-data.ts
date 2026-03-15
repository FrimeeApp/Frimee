export type PlanStatus = "active" | "finished";
export type PlanBalanceType = "owed_to_me" | "i_owe" | "settled";

export type CalendarPlanCard = {
  id: string;
  title: string;
  rangeText: string;
  peopleCount: number;
  status: PlanStatus;
  imageUrl: string;
  balanceType: PlanBalanceType;
  balanceAmount: number;
};

export type PlanStory = {
  id: string;
  author: string;
  imageUrl: string;
};

export type PlanActivity = {
  id: string;
  title: string;
  subtitle: string;
  dateIso: string;
};

export type PlanExpenseMovement = {
  id: string;
  dateIso: string;
  from: string;
  to: string;
  concept: string;
  amount: number;
};

export type PlanChatMessage = {
  id: string;
  sender: string;
  text: string;
  sentAtIso: string;
  mine: boolean;
};

export type PlanDetailMock = {
  id: string;
  title: string;
  rangeText: string;
  peopleCount: number;
  status: PlanStatus;
  imageUrl: string;
  groupBalance: number;
  stories: PlanStory[];
  upcomingActivities: PlanActivity[];
  expenses: PlanExpenseMovement[];
  chat: PlanChatMessage[];
};

export const CALENDAR_PLANS: CalendarPlanCard[] = [
  {
    id: "plan-1",
    title: "Bali 2026",
    rangeText: "15 jul - 29 jul",
    peopleCount: 6,
    status: "active",
    imageUrl:
      "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1600&q=80",
    balanceType: "owed_to_me",
    balanceAmount: 84,
  },
  {
    id: "plan-2",
    title: "Escapada a Lisboa",
    rangeText: "8 may - 11 may",
    peopleCount: 4,
    status: "active",
    imageUrl:
      "https://images.unsplash.com/photo-1520880867055-1e30d1cb001c?auto=format&fit=crop&w=1600&q=80",
    balanceType: "i_owe",
    balanceAmount: 32,
  },
  {
    id: "plan-3",
    title: "Nieve en Andorra",
    rangeText: "2 ene - 6 ene",
    peopleCount: 5,
    status: "finished",
    imageUrl:
      "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=1600&q=80",
    balanceType: "settled",
    balanceAmount: 0,
  },
  {
    id: "plan-4",
    title: "Roma en pareja",
    rangeText: "11 mar - 15 mar",
    peopleCount: 2,
    status: "finished",
    imageUrl:
      "https://images.unsplash.com/photo-1529154691717-3306083d869e?auto=format&fit=crop&w=1600&q=80",
    balanceType: "owed_to_me",
    balanceAmount: 20,
  },
];

export const PLAN_DETAILS_BY_ID: Record<string, PlanDetailMock> = {
  "plan-1": {
    id: "plan-1",
    title: "Bali 2026",
    rangeText: "15 jul - 29 jul",
    peopleCount: 6,
    status: "active",
    imageUrl:
      "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1800&q=80",
    groupBalance: -76,
    stories: [
      {
        id: "s1",
        author: "Marta",
        imageUrl:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: "s2",
        author: "Alex",
        imageUrl:
          "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: "s3",
        author: "Irene",
        imageUrl:
          "https://images.unsplash.com/photo-1501554728187-ce583db33af7?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: "s4",
        author: "Nico",
        imageUrl:
          "https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: "s5",
        author: "Lucia",
        imageUrl:
          "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=600&q=80",
      },
    ],
    upcomingActivities: [
      {
        id: "a1",
        title: "Reservar villa",
        subtitle: "Confirmar transferencia del grupo",
        dateIso: "2026-06-16T10:00:00Z",
      },
      {
        id: "a2",
        title: "Comprar vuelos internos",
        subtitle: "Ruta Denpasar - Labuan Bajo",
        dateIso: "2026-06-18T13:00:00Z",
      },
      {
        id: "a3",
        title: "Check de equipaje",
        subtitle: "Lista final y pesos por persona",
        dateIso: "2026-07-10T19:00:00Z",
      },
    ],
    expenses: [
      {
        id: "e1",
        dateIso: "2026-06-03T09:30:00Z",
        from: "Tu",
        to: "Marta",
        concept: "Adelanto de alojamiento",
        amount: 84,
      },
      {
        id: "e2",
        dateIso: "2026-06-01T12:15:00Z",
        from: "Alex",
        to: "Tu",
        concept: "Reembolso taxi aeropuerto",
        amount: 26,
      },
      {
        id: "e3",
        dateIso: "2026-05-30T17:20:00Z",
        from: "Irene",
        to: "Nico",
        concept: "Entradas templo",
        amount: 14,
      },
    ],
    chat: [
      {
        id: "c1",
        sender: "Marta",
        text: "He subido fotos del alojamiento en historias.",
        sentAtIso: "2026-06-03T08:10:00Z",
        mine: false,
      },
      {
        id: "c2",
        sender: "Tu",
        text: "Perfecto, esta noche reviso el balance.",
        sentAtIso: "2026-06-03T08:24:00Z",
        mine: true,
      },
      {
        id: "c3",
        sender: "Alex",
        text: "Quien se encarga de la reserva del ferry?",
        sentAtIso: "2026-06-03T08:31:00Z",
        mine: false,
      },
    ],
  },
  "plan-2": {
    id: "plan-2",
    title: "Escapada a Lisboa",
    rangeText: "8 may - 11 may",
    peopleCount: 4,
    status: "active",
    imageUrl:
      "https://images.unsplash.com/photo-1520880867055-1e30d1cb001c?auto=format&fit=crop&w=1800&q=80",
    groupBalance: -32,
    stories: [
      {
        id: "s1",
        author: "Paula",
        imageUrl:
          "https://images.unsplash.com/photo-1491557345352-5929e343eb89?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: "s2",
        author: "Javi",
        imageUrl:
          "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=600&q=80",
      },
    ],
    upcomingActivities: [
      {
        id: "a1",
        title: "Reservar free tour",
        subtitle: "Barrio de Alfama",
        dateIso: "2026-04-28T11:00:00Z",
      },
      {
        id: "a2",
        title: "Check-in online",
        subtitle: "Todos los pasajeros",
        dateIso: "2026-05-06T18:00:00Z",
      },
    ],
    expenses: [
      {
        id: "e1",
        dateIso: "2026-04-20T18:00:00Z",
        from: "Tu",
        to: "Javi",
        concept: "Hotel 1a noche",
        amount: 32,
      },
    ],
    chat: [
      {
        id: "c1",
        sender: "Tu",
        text: "Recordad enviar DNI para el check-in.",
        sentAtIso: "2026-04-20T18:10:00Z",
        mine: true,
      },
    ],
  },
};
