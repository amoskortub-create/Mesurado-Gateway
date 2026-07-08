import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Trash2, Key, Check, Loader2, AlertCircle, Shield, RefreshCw } from 'lucide-react';
import { appwriteClient, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { formatDate, maskKeyPrefix } from '@/lib/utils';

interface ApiKey {
  $id: string;
  label: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState('');
  const [copied, setCopied] = useState('');
  const [deleting, setDeleting] = useState('');

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/keys/list', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch keys');
      const data = await res.json() as { keys: ApiKey[] };
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  // Real-time: re-fetch when api_keys collection changes
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = appwriteClient.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.API_KEYS}.documents`,
        (ev) => {
          const relevant = (ev.events as string[]).some(
            e => e.includes('.create') || e.includes('.update') || e.includes('.delete'),
          );
          if (relevant) fetchKeys();
        },
      );
    } catch { /* no Appwrite session yet */ }
    return () => { unsub?.(); };
  }, [fetchKeys]);

  async function createKey() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      const data = await res.json() as { success?: boolean; keyString?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to generate key');
      setCreatedKey(data.keyString ?? '');
      setNewLabel('');
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key');
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    setDeleting(id);
    try {
      const res = await fetch('/api/keys/delete', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: id }),
      });
      if (!res.ok) throw new Error('Failed to delete key');
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    } finally {
      setDeleting('');
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch { /* ignore */ }
  }

  function openModal()  { setCreatedKey(''); setNewLabel(''); setShowModal(true); }
  function closeModal() { setShowModal(false); setCreatedKey(''); }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">API Keys</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Manage developer credentials for the Mesurado API</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchKeys} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-3 py-2 rounded-lg hover:bg-muted disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition hover:opacity-90 shadow-sm active:scale-[0.98]"
            style={{ background: 'hsl(0 72% 51%)' }}>
            <Plus size={16} />Generate Key
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
        style={{ background: 'hsl(217 72% 47% / 0.06)', borderColor: 'hsl(217 72% 47% / 0.2)' }}>
        <Shield size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'hsl(217 72% 47%)' }} />
        <div>
          <p className="font-semibold" style={{ color: 'hsl(217 72% 47%)' }}>Keys are stored hashed — copy them at creation time</p>
          <p className="text-muted-foreground mt-0.5">
            Endpoint:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">POST /v1/chat/completions</code>
            {' · '}Header:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">Authorization: Bearer mesurado_sk_live_…</code>
          </p>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading && keys.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading keys…</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-16 text-center">
            <Key size={32} className="mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-sm font-medium text-muted-foreground">No API keys yet</p>
            <p className="text-xs text-muted-foreground mt-1">Generate your first key to start using the Mesurado API.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Label', 'Key Preview', 'Created', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map(key => (
                  <tr key={key.$id} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground">{key.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                          {maskKeyPrefix(key.key_prefix)}
                        </code>
                        <button onClick={() => copyToClipboard(key.key_prefix, key.$id)}
                          className="text-muted-foreground hover:text-foreground transition">
                          {copied === key.$id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(key.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${key.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {key.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => deleteKey(key.$id)} disabled={!!deleting}
                        className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium transition disabled:opacity-50">
                        {deleting === key.$id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        {deleting === key.$id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-card-border">
            <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}>
              <div className="flex items-center gap-2"><Key size={18} /><h3 className="font-extrabold text-lg">Generate API Key</h3></div>
              <p className="text-white/75 text-sm mt-0.5">Keys are prefixed with <code className="font-mono text-white/90">mesurado_sk_live_</code></p>
            </div>

            {createdKey ? (
              <div className="p-6">
                <div className="rounded-xl p-4 mb-5" style={{ background: 'hsl(217 72% 47% / 0.06)', border: '1px solid hsl(217 72% 47% / 0.25)' }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <AlertCircle size={14} style={{ color: 'hsl(0 72% 51%)' }} />
                    <p className="text-xs font-bold" style={{ color: 'hsl(0 72% 51%)' }}>Copy now — this key cannot be retrieved again</p>
                  </div>
                  <code className="text-xs font-mono break-all text-foreground block leading-relaxed bg-muted px-3 py-2.5 rounded-lg">{createdKey}</code>
                </div>
                <button onClick={() => copyToClipboard(createdKey, 'new')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold mb-3 transition hover:opacity-90"
                  style={{ background: 'hsl(0 72% 51%)', color: 'white' }}>
                  {copied === 'new' ? <><Check size={15} />Copied!</> : <><Copy size={15} />Copy API Key</>}
                </button>
                <button onClick={closeModal} className="w-full py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition border border-border">
                  I&apos;ve saved my key — Close
                </button>
              </div>
            ) : (
              <div className="p-6">
                <label className="block text-sm font-bold text-foreground mb-2">Key Label</label>
                <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createKey()}
                  placeholder="e.g. Production App, CI/CD Pipeline"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:border-primary transition mb-5" />
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:bg-muted transition">Cancel</button>
                  <button onClick={createKey} disabled={creating || !newLabel.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 hover:opacity-90"
                    style={{ background: 'hsl(0 72% 51%)' }}>
                    {creating ? <><Loader2 size={14} className="animate-spin" />Generating…</> : <><Key size={14} />Generate Key</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
