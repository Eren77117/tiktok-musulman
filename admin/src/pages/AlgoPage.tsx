import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sliders, Save, RefreshCw, Info } from 'lucide-react';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface AlgoConfig {
  id: string;
  key: string;
  value: number;
  description: string | null;
  updated_at: string;
}

const CONFIG_META: Record<string, { label: string; description: string; min: number; max: number; step: number }> = {
  watch_time_weight:   { label: 'Watch time weight',    description: 'Poids du temps de visionnage dans le score', min: 0, max: 20, step: 0.5 },
  rewatch_weight:      { label: 'Rewatch weight',        description: 'Poids des relectures (> 1x)', min: 0, max: 20, step: 0.5 },
  like_weight:         { label: 'Like weight',           description: 'Poids des likes', min: 0, max: 20, step: 0.5 },
  comment_weight:      { label: 'Comment weight',        description: 'Poids des commentaires', min: 0, max: 30, step: 0.5 },
  share_weight:        { label: 'Share weight',          description: 'Poids des partages', min: 0, max: 30, step: 0.5 },
  skip_penalty:        { label: 'Skip penalty',          description: 'Pénalité pour un skip rapide', min: 0, max: 20, step: 0.5 },
  age_decay_factor:    { label: 'Age decay factor',      description: 'Décroissance du score avec le temps (0.90–0.99)', min: 0.85, max: 0.99, step: 0.01 },
};

const DEFAULTS: Record<string, number> = {
  watch_time_weight: 3,
  rewatch_weight: 5,
  like_weight: 10,
  comment_weight: 15,
  share_weight: 20,
  skip_penalty: 10,
  age_decay_factor: 0.97,
};

export default function AlgoPage() {
  const qc = useQueryClient();
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const { data: configs, isLoading } = useQuery<AlgoConfig[]>({
    queryKey: ['algo-config'],
    queryFn: () => api.get('/admin/algo-config').then(r => r.data),
    onSuccess: (data) => {
      const initial: Record<string, number> = {};
      data.forEach(c => { initial[c.key] = c.value; });
      setLocalValues(initial);
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) =>
      api.put(`/admin/algo-config/${key}`, { value }),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['algo-config'] });
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
    },
  });

  const handleSave = (key: string) => {
    const value = localValues[key] ?? DEFAULTS[key] ?? 0;
    saveMutation.mutate({ key, value });
  };

  const handleReset = (key: string) => {
    const def = DEFAULTS[key];
    if (def !== undefined) {
      setLocalValues(s => ({ ...s, [key]: def }));
      saveMutation.mutate({ key, value: def });
    }
  };

  const configMap: Record<string, number> = {};
  configs?.forEach(c => { configMap[c.key] = c.value; });

  const allKeys = [...new Set([...Object.keys(CONFIG_META), ...(configs?.map(c => c.key) ?? [])])];

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Algo Tuning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajuster les poids de l'algorithme du feed</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
          <Info size={12} />
          Changements appliqués en temps réel
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {allKeys.map(key => {
          const meta = CONFIG_META[key];
          const currentValue = localValues[key] ?? configMap[key] ?? DEFAULTS[key] ?? 0;
          const isSaving = saveMutation.isPending && saveMutation.variables?.key === key;
          const wasSaved = saved[key];

          return (
            <Card key={key}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sliders size={13} className="text-indigo-400" />
                      <span className="text-sm font-semibold text-white">
                        {meta?.label ?? key}
                      </span>
                    </div>
                    {meta?.description && (
                      <p className="text-xs text-gray-500 mt-0.5 ml-5">{meta.description}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-indigo-300 tabular-nums">
                    {isLoading ? '—' : currentValue.toFixed(key === 'age_decay_factor' ? 2 : 1)}
                  </span>
                </div>

                {isLoading ? (
                  <Skeleton className="h-2 w-full" />
                ) : (
                  <input
                    type="range"
                    min={meta?.min ?? 0}
                    max={meta?.max ?? 100}
                    step={meta?.step ?? 1}
                    value={currentValue}
                    onChange={e => setLocalValues(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 rounded-full accent-indigo-500 cursor-pointer"
                  />
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleSave(key)}
                    disabled={isLoading || isSaving}
                    className={`flex-1 h-7 text-xs gap-1.5 transition-colors ${
                      wasSaved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                        : ''
                    }`}
                    variant={wasSaved ? 'outline' : 'default'}
                  >
                    {isSaving ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <Save size={11} />
                    )}
                    {wasSaved ? 'Sauvegardé' : 'Sauvegarder'}
                  </Button>
                  {DEFAULTS[key] !== undefined && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReset(key)}
                      disabled={isLoading || isSaving}
                      className="h-7 text-xs text-gray-500 hover:text-gray-300"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info card */}
      <Card className="border-indigo-500/20 bg-indigo-500/5">
        <CardContent className="p-4">
          <p className="text-xs text-indigo-300/70">
            <strong className="text-indigo-300">Score = </strong>
            watch_time × watch_time_weight + rewatch × rewatch_weight + likes × like_weight + comments × comment_weight + shares × share_weight − skips × skip_penalty, puis multiplié par age_decay_factor^jours
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
