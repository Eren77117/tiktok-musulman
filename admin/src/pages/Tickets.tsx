import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  user: { id: string; username: string; email: string };
}

export default function Tickets() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');

  const { data, isLoading } = useQuery<Ticket[]>({
    queryKey: ['admin-tickets'],
    queryFn: () => api.get('/admin/tickets').then((r) => r.data),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, admin_reply }: { id: string; admin_reply: string }) =>
      api.patch(`/admin/tickets/${id}`, { admin_reply, status: 'RESOLVED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      setSelected(null);
      setReply('');
    },
  });

  const statusColor: Record<string, string> = {
    OPEN: 'bg-yellow-900/50 text-yellow-300',
    IN_PROGRESS: 'bg-blue-900/50 text-blue-300',
    RESOLVED: 'bg-emerald-900/50 text-emerald-300',
    CLOSED: 'bg-gray-800 text-gray-400',
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Support Tickets</h2>

      <div className="grid grid-cols-2 gap-4 h-[calc(100vh-10rem)]">
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
          {isLoading && <p className="text-center py-8 text-gray-500">Loading...</p>}
          {data?.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => { setSelected(ticket); setReply(ticket.admin_reply ?? ''); }}
              className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                selected?.id === ticket.id ? 'bg-gray-800' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">@{ticket.user.username}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColor[ticket.status] ?? ''}`}>
                  {ticket.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
          {selected ? (
            <>
              <div className="flex-1 space-y-3 overflow-auto">
                <div>
                  <h3 className="font-medium text-white">{selected.subject}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selected.user.email} — {new Date(selected.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">{selected.description}</div>
                {selected.admin_reply && (
                  <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg p-3 text-sm text-indigo-200">
                    <p className="text-xs text-indigo-400 mb-1">Your reply</p>
                    {selected.admin_reply}
                  </div>
                )}
              </div>
              {selected.status !== 'RESOLVED' && selected.status !== 'CLOSED' && (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                  <button
                    onClick={() => replyMutation.mutate({ id: selected.id, admin_reply: reply })}
                    disabled={!reply.trim() || replyMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                  >
                    Send & Resolve
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Select a ticket
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
