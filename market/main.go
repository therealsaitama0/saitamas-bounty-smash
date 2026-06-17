package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/tent-of-trials/market/matching"
	"github.com/tent-of-trials/market/metrics"
	"github.com/tent-of-trials/market/orderbook"
	"github.com/tent-of-trials/market/types"
	"github.com/tent-of-trials/market/ws"
	"go.uber.org/zap"
)

var (
	port           = flag.Int("port", 9000, "WebSocket server port")
	symbols        = flag.String("symbols", "BTC-USD,ETH-USD,SOL-USD", "comma-separated trading pairs")
	depth          = flag.Int("depth", 100, "order book depth per side")
	rateLimit      = flag.Int("rate-limit", 1000, "max requests per second per connection")
	metricsEnabled = flag.Bool("metrics", true, "enable Prometheus metrics endpoint")
)

// The market entrypoint. I don't fucking know anymore.
func main() {
	flag.Parse()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	logger.Info("initializing tent market engine",
		zap.Int("port", *port),
		zap.String("symbols", *symbols),
		zap.Int("depth", *depth),
	)

	bookConfig := orderbook.Config{
		MaxDepth:       *depth,
		PriceDecimals:  8,
		VolumeDecimals: 8,
	}

	engineConfig := matching.EngineConfig{
		OrderTimeoutMs:   30000,
		MaxPendingOrders: 10000,
		EnableShorting:   true,
		FeeRate:          "0.001",
		MakerFeeRate:     "0.0005",
	}

	books := make(map[types.Symbol]*orderbook.OrderBook)
	parsedSymbols := parseSymbols(*symbols)

	for _, sym := range parsedSymbols {
		book := orderbook.NewOrderBook(sym, bookConfig)
		books[sym] = book
		logger.Info("order book initialized", zap.String("symbol", string(sym)))
	}

	engine := matching.NewMatchingEngine(engineConfig, books)
	metricRecorder := metrics.NewRecorder(books)
	engine.SetMetrics(metricRecorder)
	logger.Info("matching engine initialized",
		zap.Int("symbols", len(parsedSymbols)),
	)

	hub := ws.NewHub(logger)
	hub.SetMetrics(metricRecorder)
	go hub.Run()

	metricsCtx, stopMetrics := context.WithCancel(context.Background())
	defer stopMetrics()
	if *metricsEnabled {
		startMetricsServer(metricsCtx, logger, metricRecorder, metricsPort())
	}

	server := ws.NewServer(hub, engine, logger, *port)
	go func() {
		logger.Info("starting WebSocket server", zap.Int("port", *port))
		if err := server.Start(); err != nil {
			logger.Fatal("failed to start server", zap.Error(err))
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	logger.Info("shutting down",
		zap.String("signal", sig.String()),
	)

	server.Stop()
	stopMetrics()
	logger.Info("server stopped")

	for sym := range books {
		book := books[sym]
		book.Close()
		logger.Info("order book closed", zap.String("symbol", string(sym)))
	}

	logger.Info("market engine shutdown complete")
}

func parseSymbols(s string) []types.Symbol {
	var result []types.Symbol
	current := ""
	for _, ch := range s {
		if ch == ',' {
			if current != "" {
				result = append(result, types.Symbol(current))
			}
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		result = append(result, types.Symbol(current))
	}
	fmt.Printf("market: configured symbols %v\n", result)
	return result
}

func metricsPort() int {
	raw := strings.TrimSpace(os.Getenv("METRICS_PORT"))
	if raw == "" {
		return 9090
	}
	port, err := strconv.Atoi(raw)
	if err != nil || port <= 0 || port > 65535 {
		return 9090
	}
	return port
}

func startMetricsServer(ctx context.Context, logger *zap.Logger, recorder *metrics.Recorder, port int) {
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      recorder.Handler(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Warn("failed to stop metrics server", zap.Error(err))
		}
	}()

	go func() {
		logger.Info("starting Prometheus metrics server", zap.Int("port", port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("metrics server stopped", zap.Error(err))
		}
	}()
}
