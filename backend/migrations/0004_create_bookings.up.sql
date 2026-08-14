-- Needed for the EXCLUDE constraint below: lets a GiST index compare a
-- plain equality column (seat_id) alongside a range column (segment).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_id UUID NOT NULL REFERENCES seats(id),
    origin_seq INT NOT NULL REFERENCES stations(sequence),
    destination_seq INT NOT NULL REFERENCES stations(sequence),
    -- The booked leg as a half-open range, e.g. Colombo Fort(0)->Kandy(7) is
    -- [0,7). Derived automatically from origin/destination so it can never
    -- drift out of sync with them.
    segment int4range GENERATED ALWAYS AS (int4range(origin_seq, destination_seq, '[)')) STORED,
    email TEXT NOT NULL,
    mobile TEXT NOT NULL,
    fare NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (origin_seq < destination_seq),
    -- The actual correctness guarantee: Postgres itself refuses to store two
    -- bookings for the same seat whose segments overlap. Adjacent legs
    -- (e.g. [0,7) and [7,23)) are allowed - that's the whole point of
    -- reselling a vacated seat.
    EXCLUDE USING gist (seat_id WITH =, segment WITH &&)
);
