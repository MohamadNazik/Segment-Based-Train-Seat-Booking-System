CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sequence INT NOT NULL UNIQUE,
    distance_km NUMERIC(7,2) NOT NULL
);

-- Colombo Fort-Badulla line, in order. Distances are approximate cumulative
-- km from Colombo Fort, used only to compute distance-proportional fares.
INSERT INTO stations (code, name, sequence, distance_km) VALUES
    ('COL', 'Colombo Fort', 0, 0),
    ('RGM', 'Ragama', 1, 15),
    ('GMP', 'Gampaha', 2, 24),
    ('VYG', 'Veyangoda', 3, 36),
    ('PGH', 'Polgahawela', 4, 55),
    ('RBK', 'Rambukkana', 5, 66),
    ('KDG', 'Kadugannawa', 6, 94),
    ('KAN', 'Kandy', 7, 121),
    ('PRD', 'Peradeniya', 8, 127),
    ('GPL', 'Gampola', 9, 138),
    ('NWP', 'Nawalapitiya', 10, 154),
    ('HAT', 'Hatton', 11, 174),
    ('TLW', 'Talawakele', 12, 187),
    ('NNO', 'Nanu Oya', 13, 203),
    ('AMB', 'Ambewela', 14, 213),
    ('PTP', 'Pattipola', 15, 220),
    ('OHY', 'Ohiya', 16, 226),
    ('IDL', 'Idalgashinna', 17, 235),
    ('HPT', 'Haputale', 18, 245),
    ('DYT', 'Diyatalawa', 19, 254),
    ('BND', 'Bandarawela', 20, 263),
    ('ELL', 'Ella', 21, 280),
    ('DMD', 'Demodara', 22, 287),
    ('BAD', 'Badulla', 23, 294);
