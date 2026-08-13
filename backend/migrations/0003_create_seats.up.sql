CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    seat_number INT NOT NULL CHECK (seat_number > 0),
    UNIQUE (coach_id, seat_number)
);

-- Seats are only generated for reserved coaches. Unreserved coaches are
-- first-come-first-served with no seat assignment, so there is nothing to
-- book at the seat level for them - seat_count on the coach is enough.
INSERT INTO seats (coach_id, seat_number)
SELECT c.id, gs.seat_number
FROM coaches c
CROSS JOIN LATERAL generate_series(1, c.seat_count) AS gs(seat_number)
WHERE c.type = 'reserved';
