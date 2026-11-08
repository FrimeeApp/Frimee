-- Global expense categories (owner_user_id and owner_group_id null), copied
-- from production on 2026-10-27. Reference data the app needs: AddGastoSheet
-- defaults to id 0, so without these rows every new expense fails the
-- gastos_categoria_id_fkey foreign key.
-- ids are fixed to match production, hence OVERRIDING SYSTEM VALUE.

insert into public.categorias_gasto (id, nombre, icono, color)
overriding system value
values
  (0, 'Otros', NULL, NULL),
  (1, 'Vuelo', NULL, NULL),
  (2, 'Ferry', NULL, NULL),
  (3, 'Tren', NULL, NULL),
  (4, 'Bus', NULL, NULL),
  (5, 'Coche de alquiler', NULL, NULL),
  (6, 'Taxi / Uber', NULL, NULL),
  (7, 'Gasolina', NULL, NULL),
  (8, 'Parking', NULL, NULL),
  (9, 'Hotel', NULL, NULL),
  (10, 'Airbnb', NULL, NULL),
  (11, 'Hostel', NULL, NULL),
  (12, 'Casa rural', NULL, NULL),
  (13, 'Restaurante', NULL, NULL),
  (14, 'Supermercado', NULL, NULL),
  (15, 'Bar / Cafetería', NULL, NULL),
  (16, 'Entradas / Tickets', NULL, NULL),
  (17, 'Excursión', NULL, NULL),
  (18, 'Tour guiado', NULL, NULL),
  (19, 'Deporte / Aventura', NULL, NULL),
  (20, 'Seguro de viaje', NULL, NULL),
  (21, 'Equipaje', NULL, NULL),
  (22, 'Souvenirs', NULL, NULL),
  (23, 'Farmacia', NULL, NULL),
  (24, 'Comunicación', NULL, NULL)
on conflict (id) do nothing;

-- Next category created in the app continues after the copied ids.
select setval('public.categorias_gasto_id_seq', (select max(id) from public.categorias_gasto));
