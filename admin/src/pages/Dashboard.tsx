import { useQuery } from '@tanstack/react-query';
import { Users, Film, Flag, TrendingUp, Activity, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  total_users: number;
  total_posts: number;
  pending_reports: number;
  new_users_30d: number;
}

const METRIC_CONFIG = [
  { key: 'total_users', label: 'Total Users', icon: Users, color: 'from-indigo-500 to-blue-600', glow: 'shadow-indigo-500/20' },
  { key: 'total_posts', label: 'Total Posts', icon: Film, color: 'from-purple-500 to-pink-600', glow: 'shadow-purple-500/20' },
  { key: 'pending_reports', label: 'Pending Reports', icon: Flag, color: 'from-red-500 to-orange-600', glow: 'shadow-red-500/20' },
  { key: 'new_users_30d', label: 'New Users (30d)', icon: TrendingUp, color: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/20' },
] as const;

// Mock chart data until real analytics exist
const chartData = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  users: Math.floor(Math.random() * 500 + 100),
  posts: Math.floor(Math.random() * 300 + 50),
}));

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {METRIC_CONFIG.map(({ key, label, icon: Icon, color, glow }) => (
          <Card key={key} className="relative overflow-hidden group hover:border-white/10 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <AnimatedCounter value={stats?.[key] ?? 0} />
                    )}
                  </p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${color} shadow-lg ${glow}`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              {!isLoading && (
                <div className="flex items-center gap-1 mt-3 text-xs text-emerald-400">
                  <ArrowUpRight size={11} />
                  <span>updated now</span>
                </div>
              )}
            </CardContent>
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Area chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="users" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="posts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12, color: '#fff' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} fill="url(#users)" dot={false} name="Users" />
                <Area type="monotone" dataKey="posts" stroke="#a855f7" strokeWidth={2} fill="url(#posts)" dot={false} name="Posts" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Moderation rate', value: stats?.pending_reports && stats.total_posts ? `${((1 - stats.pending_reports / stats.total_posts) * 100).toFixed(0)}%` : '—' },
              { label: 'Growth (30d)', value: stats?.new_users_30d && stats.total_users ? `+${((stats.new_users_30d / stats.total_users) * 100).toFixed(1)}%` : '—' },
              { label: 'Active reports', value: stats?.pending_reports ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
