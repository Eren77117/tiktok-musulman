import { useQuery } from '@tanstack/react-query';
import { Users, Film, Flag, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  total_users: number;
  total_posts: number;
  pending_reports: number;
  new_users_30d: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value?.toLocaleString() ?? '—'}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const chartData = [
    { name: 'Users', value: stats?.total_users ?? 0 },
    { name: 'Posts', value: stats?.total_posts ?? 0 },
    { name: 'New 30d', value: stats?.new_users_30d ?? 0 },
    { name: 'Reports', value: stats?.pending_reports ?? 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-white">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.total_users} icon={Users} color="bg-indigo-600" />
        <StatCard label="Total Posts" value={stats?.total_posts} icon={Film} color="bg-purple-600" />
        <StatCard label="Pending Reports" value={stats?.pending_reports} icon={Flag} color="bg-red-600" />
        <StatCard label="New Users (30d)" value={stats?.new_users_30d} icon={TrendingUp} color="bg-emerald-600" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Overview</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
