import { FormEvent, useState } from 'react';
import { LOCALES } from '@/constants';
import { ILoginProps } from '@/interfaces';
import { Locale } from '@/types';

export function Login({ onLogin }: ILoginProps) {
  const [reviewerId, setReviewerId] = useState('reviewer-1');
  const [locale, setLocale] = useState<Locale>('west-coast');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onLogin(reviewerId.trim(), locale);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card login-card">
      <h1>Content Review Queue</h1>
      <p className="muted">
        Sign in as a reviewer to browse and claim tickets for your locale.
      </p>
      <form onSubmit={submit}>
        <label>
          Reviewer ID
          <input
            value={reviewerId}
            onChange={event => setReviewerId(event.target.value)}
            placeholder="reviewer-1"
            required
          />
        </label>
        <label>
          Locale
          <select value={locale} onChange={event => setLocale(event.target.value as Locale)}>
            {LOCALES.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
