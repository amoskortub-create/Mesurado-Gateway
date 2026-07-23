import { Trash2, Plus, MessageSquare, Loader2 } from 'lucide-react';
import type { ConversationSummary } from '@/hooks/use-conversations';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (conv: ConversationSummary) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ConversationSidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: ConversationSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">History</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white transition hover:opacity-90 active:scale-95"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            <Plus size={12} />
            New
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-1 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition md:hidden"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="text-muted-foreground animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <MessageSquare size={24} className="mx-auto text-muted-foreground opacity-30 mb-2" />
            <p className="text-xs text-muted-foreground">No saved chats yet.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Send a message to start one.</p>
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={[
                'group flex items-start gap-2 px-3 py-2.5 mx-1 rounded-xl cursor-pointer transition',
                conv.id === activeId
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/60',
              ].join(' ')}
            >
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-xs font-medium text-foreground truncate leading-snug">
                  {conv.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelative(conv.updatedAt)}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
                className="flex-shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition"
                title="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
