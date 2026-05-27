import { useState, useRef, useEffect, useCallback } from 'react';
import { getSupabase } from '../services/supabase';
import type { NavigateFn } from '../App';

interface Props { navigate: NavigateFn; email: string; }

export default function Verification({ navigate, email }: Props) {
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    otpRefs.current[0]?.focus();
  }, []);

  // OTP timer
  useEffect(() => {
    if (otpTimer <= 0 || verified) return;
    const id = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [otpTimer, verified]);

  function handleOtpChange(index: number, value: string) {
    if (verified) return;
    const digit = value.replace(/[^0-9]/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (digit && index === 5) {
      handleVerify([...newOtp.slice(0, 5), digit]);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    if (verified) return;
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!data) return;
    const newOtp = [...otp];
    data.split('').forEach((char, i) => { if (i < 6) newOtp[i] = char; });
    setOtp(newOtp);
    const focusIndex = Math.min(data.length, 5);
    otpRefs.current[focusIndex]?.focus();
    if (data.length === 6) handleVerify(newOtp);
  }

  async function handleResendCode() {
    if (!email) { showToast('No email to resend to.', 'error'); return; }
    try {
      const sb = await getSupabase();
      if (!sb) return;
      const { error } = await sb.auth.resend({ type: 'signup', email });
      if (error) { showToast('Failed to resend: ' + error.message, 'error'); return; }
      setOtpTimer(60);
      showToast('Code resent to your email!');
    } catch { showToast('Network error.', 'error'); }
  }

  async function handleVerify(code?: string[]) {
    const otpValue = code || otp;
    const token = otpValue.join('');
    if (token.length !== 6 || !email || verified) return;
    setLoading(true);
    try {
      const sb = await getSupabase();
      if (!sb) { showToast('Connecting... please retry.', 'error'); setLoading(false); return; }
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'signup' });
      if (error) {
        showToast('Invalid code. Please check your email and try again.', 'error');
        setOtp(Array(6).fill(''));
        otpRefs.current[0]?.focus();
        setLoading(false);
        return;
      }
      setVerified(true);
      showToast('✓ Email verified!');
      setTimeout(() => navigate('dashboard'), 1500);
    } catch {
      showToast('Verification failed. Try again.', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {toast && <div className={`toast-global visible ${toast.type}`}>{toast.msg}</div>}
      <div className="auth-card card">
        <div className="fp-header">
          <button className="back-btn" onClick={() => navigate('signup')}>← Back</button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Verify Account</h1>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          📧 Email Verification
        </div>
        <p className="instruction-text">
          A confirmation code was sent to <strong>{email}</strong>. Enter it below to verify your account.
        </p>
        <div className="otp-container" onPaste={handleOtpPaste}>
          {otp.map((digit, i) => (
            <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
              type="text" className={`otp-input ${digit ? 'filled' : ''}`}
              maxLength={1} inputMode="numeric"
              value={digit} onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)} disabled={verified} />
          ))}
        </div>
        <div className="resend-row">
          <button className="resend-link" disabled={otpTimer > 0 || verified} onClick={handleResendCode}>
            Resend Code {otpTimer > 0 && <span>({otpTimer}s)</span>}
          </button>
        </div>
        <button className="btn-primary" disabled={otp.join('').length !== 6 || loading || verified}
          onClick={() => handleVerify()}>
          {loading && <span className="spinner" />}
          {verified ? '✓ Verified!' : loading ? 'Verifying...' : 'Verify & Continue'}
        </button>
      </div>
    </div>
  );
}
