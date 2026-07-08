import { useState } from 'react';
import { Plus, Copy, Trash2, Key, Check, Loader2, AlertCircle, Shield } from 'lucide-react';
import { MOCK_API_KEYS } from '@/lib/mock';
import { formatDate, maskKeyPrefix } from '@/lib/utils';

type MockKey = typeof MOCK_API_KEYS[0];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<MockKey[]>([...MOCK_API_KEYS]);
  const [showModal, setShowModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState('');
  const [copied, setCopied] = useState('');
  const [deleting, setDeleting] = useState('');

  async function createKey() {
    if (!newLabel.trim()) return;
    setCreating(true);
    await new Promise(r => setTimeout(r, 700));
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const keyString = `mesurado_sk_live_${hex}`;
    const newKey: MockKey = {
      $id: `key_${Date.now()}`,
      label: newLabel.trim(),
      key_prefix: keyString.slice(0, 24),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setKeys(prev => [newKey, ...prev]);
    setCreatedKey(keyString);
    setNewLabel('');
    setCreating(false);
  }

  async function deleteKey(id: string) {
    setDeleting(id);
    await new Promise(r => setTimeout(r, 500));
    setKeys(prev => prev.map(k => k.$id === id ? { ...k, is_active: false } : k));
    setDeleting('');
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch { /* ignore */ }
  }

  function openModal() { setCreatedKey(''); setNewLabel(''); setShowModal(true); }
  function closeModal() { setShowModal(false); setCreatedKey(''); }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">API Keys</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Manage developer credentials for the Mesurado API</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition hover:opacity-90 shadow-sm active:scale-[0.98]"
          style={{ background: 'hsl(0 72% 51%)' }}>
          <Plus size={16} />Generate Key
        </button>
      </div>

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
                <tr key={key.$id} className="border-b border-border last:border-0 hover:bg-muted/25 transition">
                  <td className="px-5 py-4">
                    <span className="font-semibold text-sm text-foreground">{key.label}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                        {maskKeyPrefix(key.key_prefix)}
                      </code>
                      <button onClick={() => copyToClipboard(key.key_prefix, key.$id)}
                        className="p-1 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground">
                        {copied === key.$id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(key.created_at)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${key.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {key.is_active ? '● Active' : '● Frozen'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => deleteKey(key.$id)} disabled={deleting === key.$id || !key.is_active}
                      className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:bg-red-50 px-3 py-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {deleting === key.$id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {deleting === key.$id ? 'Deactivating…' : 'Deactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
