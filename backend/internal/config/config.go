package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

// URL assembles the Postgres DSN from the individual fields.
func (c DBConfig) URL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Name, c.SSLMode)
}

type Config struct {
	Port string

	DB DBConfig

	RedisAddr string

	RatePerKm         float64
	FragmentationRate float64
	HoldTTL           time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		Port: getEnv("PORT", "8080"),

		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", ""),
			Password: getEnv("DB_PASSWORD", ""),
			Name:     getEnv("DB_NAME", ""),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},

		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),
	}

	if cfg.DB.User == "" {
		return nil, fmt.Errorf("DB_USER is required")
	}
	if cfg.DB.Name == "" {
		return nil, fmt.Errorf("DB_NAME is required")
	}

	rate, err := strconv.ParseFloat(getEnv("RATE_PER_KM", "10"), 64)
	if err != nil {
		return nil, fmt.Errorf("invalid RATE_PER_KM: %w", err)
	}
	cfg.RatePerKm = rate

	fragmentationRate, err := strconv.ParseFloat(getEnv("FRAGMENTATION_RATE", "0.5"), 64)
	if err != nil {
		return nil, fmt.Errorf("invalid FRAGMENTATION_RATE: %w", err)
	}
	cfg.FragmentationRate = fragmentationRate

	ttlSeconds, err := strconv.Atoi(getEnv("HOLD_TTL_SECONDS", "300"))
	if err != nil {
		return nil, fmt.Errorf("invalid HOLD_TTL_SECONDS: %w", err)
	}
	cfg.HoldTTL = time.Duration(ttlSeconds) * time.Second

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
