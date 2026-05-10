// Push notification copy: maps notification type + actor name → { title, body }

export type PushCopy = { title: string; body: string };

const MAX_BODY = 100;

function trim(s: string): string {
  return s.length > MAX_BODY ? s.slice(0, MAX_BODY - 1) + "…" : s;
}

export function buildCopy(
  tipo: string,
  actorNombre: string | null,
  meta: Record<string, string> = {}
): PushCopy | null {
  const actor = actorNombre ?? "Alguien";
  const destino = meta.destino ?? "tu viaje";
  const actividad = meta.actividad ?? "una actividad";
  const concepto = meta.concepto ?? "un gasto";
  const importe = meta.importe ? `${meta.importe}€` : "";
  const pregunta = meta.pregunta ?? "una pregunta";
  const resultado = meta.resultado ?? "un resultado";
  const mensaje = meta.mensaje ?? "";

  switch (tipo) {
    // ─ Viajes ─
    case "plan_invite":
    case "trip_invitation_received":
      return { title: "¡Te invitan a un viaje!", body: trim(`${actor} te suma a ${destino}. ¿Te apuntas?`) };
    case "trip_invitation_accepted":
      return { title: "¡Nuevo compañero de viaje!", body: trim(`${actor} se une a ${destino} 🎉`) };
    case "trip_invitation_declined":
      return { title: "Se queda en casa...", body: trim(`${actor} no puede venir a ${destino}`) };
    case "trip_activity_added":
      return { title: "Nueva parada en el plan", body: trim(`${actor} añadió ${actividad}`) };
    case "trip_activity_updated":
      return { title: "Cambio en el itinerario", body: trim(`${actividad} ha cambiado de hora o lugar`) };
    case "trip_activity_deleted":
      return { title: "Una parada desaparece", body: trim(`${actor} eliminó ${actividad} del plan`) };
    case "trip_cancelled":
      return { title: "Viaje cancelado", body: trim(`${destino} se ha cancelado. Toca replanearlo`) };
    case "trip_starting_24h":
      return { title: "¡Mañana es el día!", body: trim(`Tu viaje a ${destino} empieza en 24 horas ✈️`) };
    case "trip_starting_1h":
      return { title: "El viaje empieza ya", body: trim(`${destino} en 1 hora. ¡Que no se te olvide nada!`) };
    case "trip_completed":
      return { title: "¿Qué tal el viaje?", body: trim(`${destino} ha terminado. ¡Cuéntanos cómo fue!`) };

    // ─ Gastos ─
    case "expense_added_you_owe":
      return { title: "Te toca pagar tu parte", body: trim(`${actor} pagó ${concepto}${importe ? ` — te corresponden ${importe}` : ""}`) };
    case "expense_added_fyi":
      return { title: "Nuevo gasto en el grupo", body: trim(`${actor} registró ${concepto}${importe ? ` (${importe})` : ""}`) };
    case "expense_payment_received":
      return { title: "¡Cobrado!", body: trim(`${actor} te ha pagado${importe ? ` ${importe}` : ""}`) };
    case "expense_payment_reminder":
      return { title: "Recuerda saldar tus cuentas", body: trim(`Aún tienes deudas pendientes en ${destino}`) };
    case "expense_split_updated":
      return { title: "El reparto ha cambiado", body: trim(`${actor} actualizó cómo se divide ${concepto}`) };
    case "expense_deleted":
      return { title: "Un gasto fue eliminado", body: trim(`${actor} borró ${concepto}${importe ? ` (${importe})` : ""}`) };
    case "balance_trip_closed":
      return { title: "Cuentas del viaje", body: trim(`Resumen final de ${destino} disponible`) };

    // ─ Grupo ─
    case "group_member_joined":
      return { title: "Nuevo en el grupo", body: trim(`${actor} acaba de unirse a ${destino}`) };
    case "group_member_left":
      return { title: "Alguien se va del grupo", body: trim(`${actor} ha salido de ${destino}`) };
    case "group_member_removed":
      return { title: "Te han sacado del viaje", body: trim(`Ya no formas parte de ${destino}`) };
    case "mention":
    case "group_chat_mention":
      return { title: "Te mencionaron", body: trim(`${actor}: "${mensaje}"`) };
    case "group_chat_message":
      return { title: "Mensaje nuevo en el grupo", body: trim(`${actor}: "${mensaje}"`) };
    case "group_poll_created":
      return { title: "Toca votar", body: trim(`${actor} quiere saber: ${pregunta}`) };
    case "group_poll_closing_soon":
      return { title: "La votación cierra pronto", body: trim(`Solo quedan pocas horas para votar en ${destino}`) };
    case "group_poll_result":
      return { title: "Los resultados están aquí", body: trim(`El grupo ha decidido: ${resultado}`) };

    // ─ Social ─
    case "follow":
      return { title: "Nuevo seguidor", body: trim(`${actor} ha empezado a seguirte`) };
    case "like":
      return { title: "A alguien le gusta tu plan", body: trim(`${actor} le dio me gusta a tu plan`) };
    case "comment":
      return { title: "Nuevo comentario", body: trim(`${actor} comentó tu plan`) };
    case "friend_request":
      return { title: "Solicitud de amistad", body: trim(`${actor} quiere ser tu amigo en Frimee`) };
    case "friend_accept":
      return { title: "¡Nueva amistad!", body: trim(`${actor} aceptó tu solicitud de amistad`) };

    // ─ Recordatorios ─
    case "recordatorio":
    case "reminder_custom":
      return { title: "Recordatorio del grupo", body: trim(mensaje || `Tienes cosas pendientes en ${destino}`) };
    case "reminder_document":
      return { title: "¿Tienes todo en regla?", body: trim(`Revisa tu visado y documentos para ${destino}`) };
    case "reminder_packing":
      return { title: "¿Ya has hecho la maleta?", body: trim(`Tu viaje a ${destino} está muy cerca ✓`) };

    // ─ Sistema ─
    case "recordatorio_deuda":
      return { title: "Deuda pendiente", body: trim(mensaje || "Tienes deudas pendientes de un viaje pasado") };

    default:
      return null;
  }
}

// Maps notification tipo to notification_preferences key
export function preferenceCategoryAndKey(tipo: string): { category: string; key: string } | null {
  const map: Record<string, { category: string; key: string }> = {
    plan_invite:                  { category: "viajes",        key: "trip_invitation_received" },
    trip_invitation_received:     { category: "viajes",        key: "trip_invitation_received" },
    trip_invitation_accepted:     { category: "viajes",        key: "trip_invitation_accepted" },
    trip_invitation_declined:     { category: "viajes",        key: "trip_invitation_accepted" },
    trip_activity_added:          { category: "viajes",        key: "trip_activity_added" },
    trip_activity_updated:        { category: "viajes",        key: "trip_activity_updated" },
    trip_activity_deleted:        { category: "viajes",        key: "trip_activity_deleted" },
    trip_cancelled:               { category: "viajes",        key: "trip_cancelled" },
    trip_starting_24h:            { category: "viajes",        key: "trip_starting_24h" },
    trip_starting_1h:             { category: "viajes",        key: "trip_starting_1h" },
    trip_completed:               { category: "viajes",        key: "trip_completed" },

    expense_added_you_owe:        { category: "gastos",        key: "expense_added_you_owe" },
    expense_added_fyi:            { category: "gastos",        key: "expense_added_fyi" },
    expense_payment_received:     { category: "gastos",        key: "expense_payment_received" },
    expense_payment_reminder:     { category: "gastos",        key: "expense_payment_reminder" },
    expense_split_updated:        { category: "gastos",        key: "expense_split_updated" },
    expense_deleted:              { category: "gastos",        key: "expense_deleted" },
    balance_trip_closed:          { category: "gastos",        key: "balance_trip_closed" },

    group_member_joined:          { category: "grupo",         key: "group_member_joined" },
    group_member_left:            { category: "grupo",         key: "group_member_left" },
    group_member_removed:         { category: "grupo",         key: "group_member_removed" },
    mention:                      { category: "grupo",         key: "group_chat_mention" },
    group_chat_mention:           { category: "grupo",         key: "group_chat_mention" },
    group_chat_message:           { category: "grupo",         key: "group_chat_message" },
    group_poll_created:           { category: "grupo",         key: "group_poll_created" },
    group_poll_closing_soon:      { category: "grupo",         key: "group_poll_closing_soon" },
    group_poll_result:            { category: "grupo",         key: "group_poll_result" },

    recordatorio:                 { category: "recordatorios", key: "reminder_custom" },
    reminder_custom:              { category: "recordatorios", key: "reminder_custom" },
    reminder_document:            { category: "recordatorios", key: "reminder_document" },
    reminder_packing:             { category: "recordatorios", key: "reminder_packing" },

    // Security: always send, not in preferences
    follow:         { category: "marketing", key: "reengagement_no_trip" },
    like:           { category: "grupo",     key: "group_chat_mention" },
    comment:        { category: "grupo",     key: "group_chat_mention" },
    friend_request: { category: "viajes",    key: "trip_invitation_received" },
    friend_accept:  { category: "viajes",    key: "trip_invitation_received" },
  };
  return map[tipo] ?? null;
}
