package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/cache"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/config"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/db"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/httpapi"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/seats"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/internal/stations"
	"github.com/MohamadNazik/Segment-Based-Train-Seat-Booking-System/backend/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if err := db.RunMigrations(cfg.DB.URL(), migrations.FS); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	startupCtx, cancelStartup := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelStartup()

	pool, err := db.NewPool(startupCtx, cfg.DB.URL())
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	redisClient, err := cache.NewClient(startupCtx, cfg.RedisAddr)
	if err != nil {
		log.Fatalf("connect redis: %v", err)
	}
	defer redisClient.Close()

	stationsRepo := stations.NewRepo(pool)
	seatsRepo := seats.NewRepo(pool)
	seatsService := seats.NewService(seatsRepo, stationsRepo, cfg.RatePerKm, cfg.FragmentationRate)

	deps := httpapi.Deps{
		Stations: stations.NewHandler(stationsRepo),
		Seats:    seats.NewHandler(seatsService),
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewRouter(deps),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	runCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		<-runCtx.Done()
		shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelShutdown()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
	}()

	log.Printf("Server is listening on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}
