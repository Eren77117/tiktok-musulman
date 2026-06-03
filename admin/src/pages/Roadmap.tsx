import { useState } from 'react';
import roadmapData from '../data/roadmap.json';

type Status = 'all' | 'todo' | 'in_progress' | 'done';
type Priority = 'all' | 'critical' | 'high' | 'medium' | 'low';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  tags: string[];
}

const STATUS_CONFIG = {
  todo: { label: 'À faire', color: 'text-gray-400', bg: 'bg-gray-800', dot: 'bg-gray-500' },
  in_progress: { label: 'En cours', color: 'text-blue-400', bg: 'bg-blue-900/30', dot: 'bg-blue-400' },
  done: { label: 'Terminé', color: 'text-emerald-400', bg: 'bg-emerald-900/30', dot: 'bg-emerald-400' },
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critique', color: 'text-red-400', border: 'border-red-800' },
  high: { label: 'Haute', color: 'text-orange-400', border: 'border-orange-800' },
  medium: { label: 'Moyenne', color: 'text-yellow-400', border: 'border-yellow-800' },
  low: { label: 'Basse', color: 'text-gray-500', border: 'border-gray-700' },
};

export default function Roadmap() {
  const [statusFilter, setStatusFilter] = useState<Status>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const items = roadmapData.items as RoadmapItem[];

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category)))];

  const filtered = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    return true;
  });

  const counts = {
    done: items.filter(i => i.status === 'done').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    todo: items.filter(i => i.status === 'todo').length,
  };

  const pct = Math.round((counts.done / items.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roadmap Nour</h1>
          <p className="text-gray-400 text-sm mt-1">Mis à jour le {roadmapData.lastUpdated}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-emerald-400">{pct}%</p>
          <p className="text-gray-400 text-xs">complété</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-3">
        <div
          className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'done', label: 'Terminé', val: counts.done, color: 'text-emerald-400' },
          { key: 'in_progress', label: 'En cours', val: counts.in_progress, color: 'text-blue-400' },
          { key: 'todo', label: 'À faire', val: counts.todo, color: 'text-gray-400' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key as Status)}
            className={`bg-gray-800 rounded-xl p-4 text-center border transition-colors ${
              statusFilter === s.key ? 'border-emerald-600' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-gray-400 text-sm mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <span className="text-gray-500 text-sm self-center">Priorité:</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                priorityFilter === p
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p === 'all' ? 'Toutes' : PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-gray-500 text-sm self-center">Catégorie:</span>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                categoryFilter === c
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {c === 'all' ? 'Toutes' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <p className="text-gray-500 text-sm">{filtered.length} tâche{filtered.length !== 1 ? 's' : ''}</p>
        {filtered.map(item => {
          const st = STATUS_CONFIG[item.status];
          const pr = PRIORITY_CONFIG[item.priority];
          return (
            <div
              key={item.id}
              className={`${st.bg} border ${pr.border} rounded-xl p-4 transition-colors hover:opacity-90`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${st.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-900/50 ${st.color}`}>
                      {st.label}
                    </span>
                    <span className={`text-xs font-medium ${pr.color}`}>{pr.label}</span>
                    <span className="text-xs text-gray-600 capitalize">{item.category}</span>
                  </div>
                  <h3 className="text-white font-semibold mt-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">{item.description}</p>
                  {item.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {item.tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-900/60 text-gray-500 px-2 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
