// Package apiformat holds shared wire-format constants with no dependencies
// of its own, so packages that must not depend on each other can share them
// without risking an import cycle.
package apiformat

// DateFormat is the plain YYYY-MM-DD form used for travel dates - no
// time-of-day, since bookings aren't scheduled to a specific departure time.
const DateFormat = "2006-01-02"
