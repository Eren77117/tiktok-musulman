import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, AlertCircle, Zap } from 'lucide-react';

const TEST_ACCOUNTS = [
  { label: 'Admin', email: 'admin@tiktok-musulman.local', password: 'Admin1234!' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (testEmail: string, testPassword: string) => {
    setError('');
    setLoading(true);
    try {
      await login(testEmail, testPassword);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm px-4 animate-slide-up relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-4">
            <Activity size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">TikTok Musulman</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
        </div>

        {/* Quick login test buttons */}
        <div className="mb-4 space-y-1.5">
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <Zap size={10} className="text-indigo-500" />
            Quick access
          </p>
          {TEST_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              onClick={() => quickLogin(acc.email, acc.password)}
              disabled={loading}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors disabled:opacity-50 text-sm group"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {acc.label[0]}
                </div>
                <span className="text-indigo-300 font-medium">{acc.label}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-mono">{acc.email}</p>
                <p className="text-xs text-gray-700 font-mono">{acc.password}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/50 backdrop-blur-sm">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2.5 text-sm mb-4">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
