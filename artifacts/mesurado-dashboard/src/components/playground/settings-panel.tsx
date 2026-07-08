import { Sliders, Cpu, Globe, X } from 'lucide-react';

export interface PlaygroundSettings {
  temperature: number;
  systemPrompt: string;
  maxTokens: number;
  liveSearch: boolean;
}

interface SettingsPanelProps {
  settings: PlaygroundSettings;
  onChange: (s: PlaygroundSettings) => void;
  isPaidUser: boolean;
  onMobileClose?: () => void;
}

function update<K extends keyof PlaygroundSettings>(
  settings: PlaygroundSettings,
  onChange: (s: PlaygroundSettings) => void,
  key: K,
  value: PlaygroundSettings[K],
) {
  onChange({ ...settings, [key]: value });
}

export function SettingsPanel({ settings, onChange, isPaidUser, onMobileClose }: SettingsPanelProps) {
  return (
    <div className="h-full bg-card border border-card-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-primary flex-shrink-0" />
          <h3 className="font-bold text-sm text-foreground">Model Settings</h3>
        </div>
        {/* Mobile close */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto">
        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-foreground">Temperature</label>
            <code className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums" style={{ background: 'hsl(0 72% 51% / 0.1)', color: 'hsl(0 72% 51%)' }}>
              {settings.temperature.toFixed(2)}
            </code>
          </div>
          <input
            type="range" min={0} max={1} step={0.01} value={settings.temperature}
            onChange={e => update(settings, onChange, 'temperature', parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'hsl(0 72% 51%)' }}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>Precise</span><span>Creative</span>
          </div>
        </div>

        {/* Live Search toggle */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Globe size={13} style={{ color: isPaidUser ? 'hsl(142 76% 45%)' : 'hsl(215 20% 55%)' }} />
              <label className="text-xs font-bold text-foreground">Live Search</label>
            </div>
            <div className="relative group">
              <button
                role="switch"
                aria-checked={settings.liveSearch}
                disabled={!isPaidUser}
                onClick={() => isPaidUser && update(settings, onChange, 'liveSearch', !settings.liveSearch)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${
                  !isPaidUser ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${settings.liveSearch && isPaidUser ? '' : 'bg-muted'}`}
                style={settings.liveSearch && isPaidUser ? { background: 'hsl(142 76% 40%)' } : {}}
              >
                <span
                  className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                    settings.liveSearch && isPaidUser ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              {/* Tooltip for free users */}
              {!isPaidUser && (
                <div className="absolute right-0 bottom-7 hidden group-hover:block z-50 w-48 px-3 py-2 rounded-xl text-xs text-white shadow-xl"
                  style={{ background: 'hsl(222 47% 12%)' }}>
                  Upgrade to Pay-As-You-Go to enable live web search
                  <div className="absolute right-3 -bottom-1.5 w-3 h-3 rotate-45" style={{ background: 'hsl(222 47% 12%)' }} />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {isPaidUser
              ? settings.liveSearch
                ? 'Web results injected for time-sensitive queries'
                : 'Click to enable real-time web context'
              : 'Available on Pay-As-You-Go plan'}
          </p>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-2">System Prompt</label>
          <textarea
            value={settings.systemPrompt}
            onChange={e => update(settings, onChange, 'systemPrompt', e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs resize-none focus:outline-none focus:ring-2 focus:border-primary transition"
            placeholder="System instructions for the model…"
          />
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-2">Max Output Tokens</label>
          <input
            type="number" value={settings.maxTokens}
            onChange={e => update(settings, onChange, 'maxTokens', Math.max(1, Math.min(4096, parseInt(e.target.value) || 500)))}
            min={1} max={4096}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:border-primary transition"
          />
          <p className="text-xs text-muted-foreground mt-1">Range: 1–4096</p>
        </div>

        {/* Active Model */}
        <div className="rounded-xl p-3.5" style={{ background: 'hsl(217 72% 47% / 0.08)', border: '1px solid hsl(217 72% 47% / 0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={13} style={{ color: 'hsl(217 72% 47%)' }} />
            <p className="text-xs font-bold" style={{ color: 'hsl(217 72% 47%)' }}>Active Model</p>
          </div>
          <p className="text-sm font-extrabold text-foreground">mesurado-llama3.2-3b</p>
          <p className="text-xs text-muted-foreground mt-0.5">Mesurado Engine Core</p>
        </div>

        {/* Tips */}
        <div className="rounded-xl p-3 bg-muted/60">
          <p className="text-xs font-bold text-foreground mb-1.5">Tips</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Press Enter to send, Shift+Enter for newline</li>
            <li>• System prompt sets model behaviour</li>
            <li>• Lower temp → focused; higher → creative</li>
            {isPaidUser && <li>• 🌐 Live Search auto-triggers for time-sensitive queries</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
