package metrics

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/orderbook"
	"github.com/tent-of-trials/market/types"
)

func TestRecorderExportsPrometheusMetrics(t *testing.T) {
	config := orderbook.Config{MaxDepth: 10, PriceDecimals: 8, VolumeDecimals: 8}
	book := orderbook.NewOrderBook(types.Symbol("BTC-USD"), config)
	if _, err := book.AddOrder(&types.Order{
		Symbol:       "BTC-USD",
		Side:         types.Buy,
		Type:         types.Limit,
		Price:        decimal.RequireFromString("100.50"),
		Quantity:     decimal.RequireFromString("1"),
		RemainingQty: decimal.RequireFromString("1"),
	}); err != nil {
		t.Fatalf("AddOrder() error = %v", err)
	}

	recorder := NewRecorder(map[types.Symbol]*orderbook.OrderBook{
		"BTC-USD": book,
	})
	recorder.RecordOrder("buy", "limit")
	recorder.RecordTrades(2)
	recorder.SetActiveConnections(3)
	recorder.ObserveMatchingLatency(2 * time.Millisecond)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	recorder.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("metrics status = %d, want %d", w.Code, http.StatusOK)
	}

	body := w.Body.String()
	for _, want := range []string{
		`market_orders_total{type="buy"} 1`,
		`market_orders_total{type="limit"} 1`,
		`market_trades_total 2`,
		`market_active_connections 3`,
		`market_orderbook_depth{side="bids",symbol="BTC-USD"} 1`,
		`market_matching_latency_seconds_bucket{le="0.005"} 1`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("metrics output missing %q\n%s", want, body)
		}
	}
}
