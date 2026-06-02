import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Clock } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  user: { id: string; username: string; email: string };
}

const STATUS_BADGE: Record<string, React.ReactElement> = {
  OPEN: <Badge variant="warning">Open</Badge>,
  IN_PROGRESS: <Badge>In Progress</Badge>,
  RESOLVED: <Badge variant="success">Resolved</Badge>,
  CLOSED: <Badge variant="secondary">Closed</Badge>,
};

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
      setReply('');
      setSelected(null);
    },
  });

  return (
    <div className="p-6 space-y-4 animate-slide-up">
      <div>
        <h1 className="text-xl font-semibold text-white">Support Tickets</h1>
        <p className="text-sm text-gray-500 mt-0.5">User support requests</p>
      </div>

      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-10rem)]">
        {/* Ticket list */}
        <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-auto">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 border-b border-white/[0.04]">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          {data?.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => { setSelected(ticket); setReply(ticket.admin_reply ?? ''); }}
              className={cn(
                'w-full text-left p-4 border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]',
                selected?.id === ticket.id && 'bg-white/[0.06]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <span>@{ticket.user.username}</span>
                    <span>·</span>
                    <Clock size={10} />
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="shrink-0 mt-0.5">{STATUS_BADGE[ticket.status]}</div>
              </div>
            </button>
          ))}
          {!isLoading && !data?.length && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm gap-2">
              <MessageSquare size={20} className="opacity-30" />
              No tickets
            </div>
          )}
        </div>

        {/* Ticket detail */}
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{selected.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selected.user.email}</p>
                  </div>
                  {STATUS_BADGE[selected.status]}
                </div>
              </div>

              <div className="flex-1 p-5 space-y-4 overflow-auto">
                {/* User message */}
                <div className="bg-white/[0.04] rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
                  {selected.description}
                </div>

                {/* Admin reply */}
                {selected.admin_reply && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-xs font-medium text-indigo-400 mb-2">Your reply</p>
                    <p className="text-sm text-indigo-200 leading-relaxed">{selected.admin_reply}</p>
                  </div>
                )}
              </div>

              {selected.status !== 'RESOLVED' && selected.status !== 'CLOSED' && (
                <div className="p-4 border-t border-white/[0.06] space-y-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply..."
                    rows={3}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none placeholder:text-gray-600"
                  />
                  <Button
                    onClick={() => replyMutation.mutate({ id: selected.id, admin_reply: reply })}
                    disabled={!reply.trim() || replyMutation.isPending}
                    className="w-full"
                    size="sm"
                  >
                    <Send size={13} />
                    Send &amp; Resolve
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
              <MessageSquare size={32} className="opacity-20" />
              <p className="text-sm">Select a ticket to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
