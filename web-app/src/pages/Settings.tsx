import { useState, useEffect, useCallback } from 'react';
import { loadSettings, saveSettings, getSupabase, getAuthToken } from '../services/api';
import type { NavigateFn } from '../App';

interface Props { navigate: NavigateFn; }

const NOTIF_LABELS: Record<string, string> = {
  trade_execution: 'Trade execution', trade_closed: 'Trade closed',
  daily_summary: 'Daily summary', loss_cooldown: '3-loss cooldown',
  maintenance: 'Maintenance', email_trade: 'Email trade notifications',
};

export default function Settings({ navigate }: Props) {
  const [displayName, setDisplayName] = useState('Trader');
  const [riskPercent, setRiskPercent] = useState(5);
  const [bePolicy, setBePolicy] = useState('auto');
  const [autoCompounding, setAutoCompounding] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    trade_execution: true, trade_closed: true, daily_summary: true,
    loss_cooldown: true, maintenance: true, email_trade: false,
  });
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    loadSettings().then((data) => {
      if (!data) return;
      setDisplayName((data.display_name as string) || 'Trader');
      setRiskPercent((data.risk_percent as number) || 5);
      setBePolicy((data.be_policy as string) || 'auto');
      setAutoCompounding(!!data.auto_compounding);
      setDryRun(!!data.dry_run);
      if (data.notifications) setNotifications(data.notifications as Record<string, boolean>);
      if (data.sound_enabled !== undefined) setSoundEnabled(!!data.sound_enabled);
    });
    getSupabase().then((sb) => {
      sb.auth.getSession().then((s) => {
        const u = s.data.session?.user?.email;
        if (u) setEmail(u);
      });
    });
  }, []);

  function debouncedSave(updates: Record<string, unknown>) {
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => saveSettings(updates), 500));
  }

  function handleRiskChange(val: number) {
    setRiskPercent(val);
    debouncedSave({ risk_percent: val });
  }

  function toggleNotif(key: string) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    saveSettings({ notifications: updated });
  }

  async function handleChangePassword() {
    const sb = await getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) showToast(error.message, 'error');
    else showToast('Password reset email sent to ' + email, 'success');
  }

  async function handleExport() {
    try {
      const token = await getAuthToken();
      if (!token) { showToast('Not authenticated', 'error'); return; }
      const res = await fetch('/api/trades/export?format=csv', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'trade_history.csv';
      a.click(); URL.revokeObjectURL(url);
      showToast('Trade history exported', 'success');
    } catch { showToast('Export failed', 'error'); }
  }

  async function handleLogout() {
    const sb = await getSupabase();
    await sb.auth.signOut();
    Object.keys(localStorage).forEach((k) => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
    navigate('login');
  }

  return (
    <div className="page page-settings" style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {toast && <div className={`toast-global visible ${toast.type}`}>{toast.msg}</div>}

      {/* Account */}
      <div className="card">
        <div className="card-title">👤 Account</div>
        <div className="setting-row">
          <div className="setting-label">
            <div className="setting-title">Display name</div>
            <div className="setting-desc">{displayName}</div>
          </div>
          <input className="form-input" style={{ width: 'auto', maxWidth: 160, margin: 0, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => displayName.trim() && saveSettings({ display_name: displayName.trim() }).then((ok) => ok && showToast('Saved'))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <div className="setting-title">Email</div>
            <div className="setting-desc">{email || 'Loading...'}</div>
          </div>
          <span className="setting-value">Verified</span>
        </div>
        <button className="btn-action" onClick={handleChangePassword}>Change Password</button>
        <button className="btn-action btn-danger" onClick={handleLogout} style={{ marginTop: '0.5rem' }}>Logout</button>
      </div>

      {/* Trading */}
      <div className="card">
        <div className="card-title">️ Trading</div>
        <div className="setting-row" style={{ border: 'none', paddingBottom: 0 }}>
          <div className="setting-label">
            <div className="setting-title">Risk per trade</div>
            <div className="setting-desc">{riskPercent}% of balance</div>
          </div>
        </div>
        <div className="risk-slider-container">
          <input type="range" className="risk-slider" min={1} max={10} step={0.5}
            value={riskPercent} onChange={(e) => handleRiskChange(parseFloat(e.target.value))} />
        </div>

        <div className="be-section">
          <div className="setting-label" style={{ marginBottom: '0.5rem' }}>
            <div className="setting-title">Breakeven policy</div>
          </div>
          <div className="radio-group">
            {(['auto', 'notify', 'none'] as const).map((p) => (
              <div key={p} className={`radio-option ${bePolicy === p ? 'active' : ''}`}
                onClick={() => { setBePolicy(p); saveSettings({ be_policy: p }); }}>
                <div className="radio-dot" />
                <span className="radio-label">
                  {p === 'auto' ? 'Auto BE (Move SL to entry)' :
                   p === 'notify' ? 'Notify & Exit' : 'No BE (Trailing only)'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {autoCompounding && (
          <div className="warning-banner warning visible">
            ⚠ Auto-compounding reinvests profits — risk increases after wins. Use with caution.
          </div>
        )}
        <div className="setting-row">
          <div className="setting-label">
            <div className="setting-title">Auto-compounding</div>
            <div className="setting-desc">Recalculate risk on new balance</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={autoCompounding}
              onChange={(e) => { setAutoCompounding(e.target.checked); saveSettings({ auto_compounding: e.target.checked }); }} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <div className="setting-title">Dry-run mode</div>
            <div className="setting-desc">Paper trading without real orders</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={dryRun}
              onChange={(e) => { setDryRun(e.target.checked); saveSettings({ dry_run: e.target.checked }); }} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="card-title">🔔 Notifications</div>
        {Object.entries(notifications).map(([key, val]) => (
          <div key={key} className="setting-row" style={{ border: 'none' }}>
            <div className="setting-label">
              <div className="setting-title">{NOTIF_LABELS[key] || key}</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={val} onChange={() => toggleNotif(key)} />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="card-title">🎨 Appearance</div>
        <div className="setting-row">
          <div className="setting-label">
            <div className="setting-title">Sound effects</div>
            <div className="setting-desc">Cash-out sound on splash</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={soundEnabled}
              onChange={(e) => { setSoundEnabled(e.target.checked); saveSettings({ sound_enabled: e.target.checked }); }} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Data */}
      <div className="card">
        <div className="card-title">📁 Data</div>
        <button className="btn-action" onClick={handleExport}>Export Trade History</button>
        <button className="btn-action btn-danger" style={{ marginTop: '0.5rem' }}
          onClick={() => { saveSettings({}).then(() => showToast('Cache cleared')); }}>
          Clear Cached Chat History
        </button>
      </div>
    </div>
  );
}
