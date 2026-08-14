-- Needed for the EXCLUDE constraint below: lets a GiST index compare
-- plain equality columns (seat_id, is_outbound) alongside a range column
-- (segment).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_id UUID NOT NULL REFERENCES seats(id),
    -- The passenger's actual boarding/alighting order, so origin_seq can be
    -- greater than destination_seq for an inbound (e.g. Badulla -> Colombo
    -- Fort) booking.
    origin_seq INT NOT NULL REFERENCES stations(sequence),
    destination_seq INT NOT NULL REFERENCES stations(sequence),
    -- Derived, not stored input: always consistent with origin_seq/
    -- destination_seq, so a row can never claim a direction that
    -- contradicts its own boarding/alighting stations. An outbound and
    -- inbound booking on the same seat are different trips and must never
    -- be treated as conflicting with each other.
    is_outbound BOOLEAN GENERATED ALWAYS AS (origin_seq < destination_seq) STORED,
    -- The booked leg normalized to the ascending station range regardless
    -- of travel direction, e.g. both Colombo Fort(0)->Kandy(7) and
    -- Kandy(7)->Colombo Fort(0) produce [0,7). Derived automatically so it
    -- can never drift out of sync with origin/destination.
    segment int4range GENERATED ALWAYS AS (
        int4range(LEAST(origin_seq, destination_seq), GREATEST(origin_seq, destination_seq), '[)')
    ) STORED,
    email TEXT NOT NULL,
    mobile TEXT NOT NULL,
    fare NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Only booking a station against itself is nonsensical; either travel
    -- direction is otherwise valid.
    CHECK (origin_seq <> destination_seq),
    -- The actual correctness guarantee: Postgres itself refuses to store two
    -- bookings for the same seat, same direction, whose segments overlap.
    -- Adjacent legs (e.g. [0,7) and [7,23)) are allowed - that's the whole
    -- point of reselling a vacated seat. Opposite-direction bookings never
    -- conflict regardless of overlap, since they're different trips.
    EXCLUDE USING gist (seat_id WITH =, is_outbound WITH =, segment WITH &&)
);
