import { useState } from 'react';
import { submitSupportTicket } from '../services/api';
import type { NavigateFn } from '../App';

interface Props { navigate: NavigateFn; }

const FAQS = [
  { q: 'How do I connect my MT5 account?', a: 'Go to the MT5 screen, enter your login, password, and server. The bot connects automatically once saved.' },
  { q: 'Why did the bot stop trading?', a: 'Daily limit reached (5 trades), 3 consecutive losses (24h cooldown), news pause, or package exhausted.' },
  { q: 'How do I purchase more trades?', a: 'Go to Subscription screen and choose a package. Payments are processed securely via Flutterwave.' },
  { q: 'What is the risk per trade?', a: 'You set 1-10% in Settings. Long-term respects your setting; Short-term uses up to 10% dynamic.' },
  { q: 'Is my data secure?', a: 'Yes. All MT5 credentials are encrypted. We use RLS policies and never share your data with third parties.' },
];

export default function Support(_props: Props) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) { showToast('Title and description are required.', 'error'); return; }
    setSubmitting(true);
    const result = await submitSupportTicket(title.trim(), desc.trim());
    setSubmitting(false);
    if (result && result.status === 'ok') {
      showToast('✓ Issue submitted. We will respond within 24 hours.', 'success');
      setTitle(''); setDesc('');
    } else {
      showToast(result?.detail || 'Submission failed. Try again.', 'error');
    }
  }

  function ContactRow({ icon, label, href }: { icon: string; label: string; href: string }) {
    return (
      <a className="contact-row" href={href} target="_blank" rel="noopener noreferrer">
        <span className="contact-icon">{icon}</span>
        <span className="contact-text">{label}</span>
        <svg className="contact-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </a>
    );
  }

  return (
    <div className="page page-support">
      {toast && <div className={`toast-global visible ${toast.type}`}>{toast.msg}</div>}

      {/* Report Issue */}
      <div className="card">
        <div className="card-title">📝 Report an Issue</div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Title</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description" maxLength={100} required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="form-textarea" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Please provide details..." maxLength={1000} rows={4} required />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting && <span className="spinner" />}
            {submitting ? 'Submitting...' : 'Submit Issue'}
          </button>
        </form>
      </div>

      {/* Contact */}
      <div className="card">
        <div className="card-title">📞 Contact Us</div>
        <ContactRow icon="✉️" label="vyluxtechinc@gmail.com" href="mailto:vyluxtechinc@gmail.com" />
        <ContactRow icon="📱" label="+256704909060 (Dev)" href="https://wa.me/256704909060" />
        <ContactRow icon="💬" label="@FUTURES_Support (Telegram)" href="https://t.me/FUTURES_Support" />
      </div>

      {/* Business */}
      <div className="card">
        <div className="card-title">💼 Business Inquiries</div>
        <div className="contact-row" style={{ cursor: 'default' }}>
          <span className="contact-icon">👤</span>
          <div><div className="contact-text">Richie Rich (Owner)</div><div className="contact-sub">+256741378713</div></div>
        </div>
        <ContactRow icon="🌐" label="VYLUX TECH" href="https://vylux-tech.vercel.app/" />
        <div className="contact-row" style={{ cursor: 'default' }}>
          <span className="contact-icon">📧</span>
          <div><div className="contact-text">vyluxtechinc@gmail.com</div><div className="contact-sub">For any issues</div></div>
        </div>
        <ContactRow icon="📱" label="+256704909060 (Dev WhatsApp)" href="https://wa.me/256704909060" />
        <ContactRow icon="📞" label="+256741378713 (Owner Call)" href="tel:+256741378713" />
      </div>

      {/* FAQ */}
      <div className="card">
        <div className="card-title">❓ FAQ</div>
        {FAQS.map((faq, i) => (
          <div key={i} className={`faq-item ${faqOpen === i ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
              {faq.q}
              <svg className="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div className="faq-answer">{faq.a}</div>
          </div>
        ))}
      </div>

      <p className="support-footer">© FUTURES – VYLUX TECH INC.</p>
    </div>
  );
}
