package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/tent-of-trials/market/orderbook"
	"github.com/tent-of-trials/market/types"
)

type Recorder struct {
	registry         *prometheus.Registry
	orders           *prometheus.CounterVec
	trades           prometheus.Counter
	activeConnection prometheus.Gauge
	matchingLatency  prometheus.Histogram
}

func NewRecorder(books map[types.Symbol]*orderbook.OrderBook) *Recorder {
	registry := prometheus.NewRegistry()

	r := &Recorder{
		registry: registry,
		orders: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "market_orders_total",
			Help: "Total accepted market orders by side and order type.",
		}, []string{"type"}),
		trades: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "market_trades_total",
			Help: "Total trades emitted by the matching engine.",
		}),
		activeConnection: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "market_active_connections",
			Help: "Current number of active market WebSocket connections.",
		}),
		matchingLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "market_matching_latency_seconds",
			Help:    "Time spent matching accepted market orders.",
			Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1},
		}),
	}

	registry.MustRegister(r.orders, r.trades, r.activeConnection, r.matchingLatency)
	r.registerOrderBookDepth(books)
	return r
}

func (r *Recorder) Handler() http.Handler {
	return promhttp.HandlerFor(r.registry, promhttp.HandlerOpts{})
}

func (r *Recorder) RecordOrder(side string, orderType string) {
	r.orders.WithLabelValues(side).Inc()
	r.orders.WithLabelValues(orderType).Inc()
}

func (r *Recorder) RecordTrades(count int) {
	if count <= 0 {
		return
	}
	r.trades.Add(float64(count))
}

func (r *Recorder) SetActiveConnections(count int) {
	r.activeConnection.Set(float64(count))
}

func (r *Recorder) ObserveMatchingLatency(duration time.Duration) {
	r.matchingLatency.Observe(duration.Seconds())
}

func (r *Recorder) registerOrderBookDepth(books map[types.Symbol]*orderbook.OrderBook) {
	for symbol, book := range books {
		symbol := symbol
		book := book
		r.registry.MustRegister(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name:        "market_orderbook_depth",
			Help:        "Current number of order book levels by symbol and side.",
			ConstLabels: prometheus.Labels{"symbol": string(symbol), "side": "bids"},
		}, func() float64 {
			if book == nil {
				return 0
			}
			return float64(len(book.GetBids()))
		}))
		r.registry.MustRegister(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name:        "market_orderbook_depth",
			Help:        "Current number of order book levels by symbol and side.",
			ConstLabels: prometheus.Labels{"symbol": string(symbol), "side": "asks"},
		}, func() float64 {
			if book == nil {
				return 0
			}
			return float64(len(book.GetAsks()))
		}))
	}
}
