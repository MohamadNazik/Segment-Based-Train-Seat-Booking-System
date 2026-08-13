CREATE TYPE coach_type AS ENUM ('reserved', 'unreserved');

CREATE TABLE coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    type coach_type NOT NULL,
    seat_count INT NOT NULL CHECK (seat_count > 0)
);

-- 3 reserved coaches (every seat individually bookable) + 5 unreserved
-- coaches (first-come-first-served, no seat assignment - see the seats
-- migration for why unreserved coaches get no seat rows).
INSERT INTO coaches (code, type, seat_count) VALUES
    ('R1', 'reserved', 40),
    ('R2', 'reserved', 40),
    ('R3', 'reserved', 40),
    ('U1', 'unreserved', 80),
    ('U2', 'unreserved', 80),
    ('U3', 'unreserved', 80),
    ('U4', 'unreserved', 80),
    ('U5', 'unreserved', 80);
