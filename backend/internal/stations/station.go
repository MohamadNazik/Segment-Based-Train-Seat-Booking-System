package stations

type Station struct {
	ID         string  `json:"id"`
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Sequence   int     `json:"sequence"`
	DistanceKm float64 `json:"distance_km"`
}
