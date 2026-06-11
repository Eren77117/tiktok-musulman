import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, ThumbsUp, TrendingUp, BarChart2 } from 'lucide-react';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Analytics {
  total_views: number;
  total_likes: number;
  period_days: number;
  top_posts: { id: string; caption: string | null; view_count: number; like_count: number; user: { username: string } }[];
}

const PERIODS = [
  { label: '7 jours', value: '7' },
  { label: '30 jours', value: '30' },
  { label: '90 jours', value: '90' },
];

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#f87171', '#fbbf24', '#34d399'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7');

  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ['admin-analytics', period],
    queryFn: () => api.get('/admin/analytics', { params: { days: period } }).then(r => r.data),
    refetchInterval: 60_000,
  });

  const engagement = data
    ? data.total_views > 0 ? ((data.total_likes / data.total_views) * 100).toFixed(1) : '0.0'
    : null;

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métriques de la plateforme</p>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p.value
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-white/[0.06] hover:border-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Vues totales', value: data?.total_views, icon: Eye, color: 'from-indigo-500 to-blue-600' },
          { label: 'Likes totaux', value: data?.total_likes, icon: ThumbsUp, color: 'from-pink-500 to-rose-600' },
          { label: 'Taux engagement', value: engagement ? `${engagement}%` : undefined, icon: TrendingUp, color: 'from-emerald-500 to-teal-600', raw: true },
        ].map(({ label, value, icon: Icon, color, raw }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : raw ? (
                      <span>{value ?? '—'}</span>
                    ) : (
                      <AnimatedCounter value={(value as number) ?? 0} />
                    )}
                  </p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${color} shadow-lg`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3">Sur {period} jours</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top posts bar chart */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart2 size={15} className="text-indigo-400" />
          <CardTitle>Top 10 vidéos par vues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (data?.top_posts?.length ?? 0) === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-600">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data!.top_posts} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="user.username"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12, color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name === 'view_count' ? 'Vues' : 'Likes']}
                />
                <Bar dataKey="view_count" radius={[0, 4, 4, 0]} name="view_count">
                  {data!.top_posts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top posts table */}
      <Card>
        <CardHeader>
          <CardTitle>Détails top vidéos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5"><Skeleton className="h-40 w-full" /></div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {(data?.top_posts ?? []).map((post, i) => (
                <div key={post.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-gray-600 w-5 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{post.caption || '(sans titre)'}</p>
                    <p className="text-xs text-gray-500">@{post.user.username}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Vues</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{post.view_count.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Likes</p>
                      <p className="text-sm font-semibold text-pink-400 tabular-nums">{post.like_count.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
