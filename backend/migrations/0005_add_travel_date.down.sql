ALTER TABLE bookings DROP CONSTRAINT bookings_seat_id_date_direction_segment_excl;
ALTER TABLE bookings DROP COLUMN travel_date;

ALTER TABLE bookings ADD CONSTRAINT bookings_seat_id_is_outbound_segment_excl
    EXCLUDE USING gist (seat_id WITH =, is_outbound WITH =, segment WITH &&);
