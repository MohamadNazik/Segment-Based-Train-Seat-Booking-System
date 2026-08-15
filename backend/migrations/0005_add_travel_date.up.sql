-- Adds a real travel date to bookings. The line runs every day, so this is
-- just a plain calendar value tying a booking to a specific day's trip -
-- no separate schedule/operating-days concept needed. Without this, "the
-- same seat" was one eternal timeline; with it, the same seat/stations can
-- be booked on two different dates without conflict, exactly like it can
-- already be booked outbound and inbound without conflict.
ALTER TABLE bookings DROP CONSTRAINT bookings_seat_id_is_outbound_segment_excl;

ALTER TABLE bookings ADD COLUMN travel_date DATE NOT NULL;

ALTER TABLE bookings ADD CONSTRAINT bookings_seat_id_date_direction_segment_excl
    EXCLUDE USING gist (seat_id WITH =, travel_date WITH =, is_outbound WITH =, segment WITH &&);
