import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTrades } from '../services/api';
import type { Trade } from '../types';
import type { NavigateFn } from '../App';

interface Props { navigate: NavigateFn; }

type DateFilter = 7 | 30 | 90 | 0;

const FILTERS: { label: string; value: DateFilter }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 0 },
];

const JPY_PAIRS = new Set(['USDJPY', 'GBPJPY', 'EURJPY', 'AUDJPY', 'CHFJPY', 'CADJPY', 'NZDJPY']);

function formatPrice(pair: string | undefined, price: number | undefined | null): string {
  if (price == null) return '-';
  const decimals = pair && JPY_PAIRS.has(pair.toUpperCase()) ? 3 : 5;
  return `$${price.toFixed(decimals)}`;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function filterTrades(trades: Trade[], days: DateFilter): Trade[] {
  if (days === 0) return trades;
  const cutoff = Date.now() - days * 86400000;
  return trades.filter((t) => {
    const date = t.closed_at || t.opened_at;
    return date && new Date(date).getTime() >= cutoff;
  });
}

function exportCsv(trades: Trade[]) {
  const headers = ['Ticket', 'Pair', 'Direction', 'Lots', 'Entry', 'Exit', 'SL', 'TP', 'P&L', 'Status', 'Opened', 'Closed'];
  const rows = trades.map((t) => [
    t.ticket ?? '', t.pair ?? '', t.direction ?? '', t.lots ?? '',
    t.entry_price ?? '', t.close_price ?? '', t.sl_price ?? '', t.tp_price ?? '',
    t.pnl ?? '', t.status ?? '', t.opened_at ?? '', t.closed_at ?? '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function Accountability(_props: Props) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DateFilter>(30);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchTrades(200).then((data) => {
      setTrades(data?.trades ?? []);
      setLoading(false);
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchTrades(200).then((d) => { setTrades(d?.trades ?? []); setLoading(false); });
  }, []);

  const filtered = useMemo(() => filterTrades(trades, filter), [trades, filter]);

  const closed = filtered.filter((t) => t.status === 'CLOSED' && t.pnl != null);
  const wins = closed.filter((t) => (t.pnl ?? 0) >= 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : '-';

  return (
    <div className="page page-trades">
      {toast && <div className="toast-global visible">{toast}</div>}

      {/* Header */}
      <div className="trades-header">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>📋 Trade History</h2>
        <div className="trades-actions">
          <button className="btn-icon" onClick={refresh} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
          <button className="btn-icon" onClick={() => { exportCsv(filtered); showToast('CSV exported'); }} title="Export CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="trades-filters">
        {FILTERS.map((f) => (
          <button key={f.value} className={`filter-chip ${filter === f.value ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="trades-summary">
          <div className="summary-item">
            <span className="summary-label">P&amp;L</span>
            <span className={`summary-value ${totalPnl >= 0 ? 'pnl-profit' : 'pnl-loss'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Win Rate</span>
            <span className="summary-value">{winRate}{winRate !== '-' ? '%' : ''}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Wins</span>
            <span className="summary-value pnl-profit">{wins.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Losses</span>
            <span className="summary-value pnl-loss">{losses.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total</span>
            <span className="summary-value">{filtered.length}</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <span className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📉</p>
          <p className="text-muted">No trades found for this period.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="trades-table">
            <thead>
              <tr>
                <th className="col-ticket">Ticket</th>
                <th>Pair</th>
                <th>Type</th>
                <th className="col-lots">Lots</th>
                <th className="col-entry">Entry</th>
                <th className="col-exit">Exit</th>
                <th className="col-sl">SL</th>
                <th className="col-tp">TP</th>
                <th>P&amp;L</th>
                <th className="col-status">St</th>
                <th className="col-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const pnl = Number(t.pnl ?? 0);
                const isOpen = t.status !== 'CLOSED';
                return (
                  <tr key={t.ticket ?? i} className={isOpen ? 'row-open' : ''}>
                    <td className="col-ticket td-ticket">{t.ticket ?? '-'}</td>
                    <td><span className="pair-badge">{t.pair ?? '-'}</span></td>
                    <td><span className={`trade-type ${t.direction === 'sell' ? 'sell' : 'buy'}`}>{(t.direction ?? '').toUpperCase()}</span></td>
                    <td className="col-lots">{t.lots ?? '-'}</td>
                    <td className="col-entry">{formatPrice(t.pair, t.entry_price)}</td>
                    <td className="col-exit">{isOpen ? <span className="live-dot" title="Open position" /> : formatPrice(t.pair, t.close_price)}</td>
                    <td className="col-sl">{formatPrice(t.pair, t.sl_price)}</td>
                    <td className="col-tp">{formatPrice(t.pair, t.tp_price)}</td>
                    <td className={pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</td>
                    <td className="col-status"><span className={`status-badge ${isOpen ? 'open' : 'closed'}`}>{isOpen ? 'OPN' : 'CLS'}</span></td>
                    <td className="col-time">{formatTime(t.closed_at || t.opened_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="trades-footer">{filtered.length} trade{filtered.length !== 1 ? 's' : ''}{!loading && ` · ${closed.length} closed`}</p>
    </div>
  );
}
