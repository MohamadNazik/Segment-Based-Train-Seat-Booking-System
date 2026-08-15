// Package apiformat holds small, shared wire-format constants used across
// the API boundary. It has no dependencies of its own, so packages that
// otherwise must not depend on each other (e.g. cache, which sits below
// both seats and holds) can all share these values without risking an
// import cycle or an unwanted cross-domain dependency.
package apiformat

// DateFormat is the plain YYYY-MM-DD form used for travel dates throughout
// the API - no time-of-day component, since bookings aren't scheduled to a
// specific departure time, just a day.
const DateFormat = "2006-01-02"
