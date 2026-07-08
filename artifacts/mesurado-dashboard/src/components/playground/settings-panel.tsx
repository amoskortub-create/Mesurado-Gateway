import { X, Globe, Thermometer, Hash, Cpu, Info } from 'lucide-react';

export interface PlaygroundSettings {
  temperature: number;
  maxTokens: number;
  liveSearch: boolean;
}

interface SettingsPanelProps {
  settings: PlaygroundSettings;
  onChange: (s: PlaygroundSettings) => void;
  isPaidUser: boolean;
  onClose?: () => void;
}

function set<K extends keyof PlaygroundSettings>(
  settings: PlaygroundSettings,
  onChange: (s: PlaygroundSettings) => void,
  key: K,
  value: PlaygroundSettings[K],
) {
  onChange({ ...settings, [key]: value });
}

export function SettingsPanel({ settings, onChange, isPaidUser, onClose }: SettingsPanelProps) {
  const tempLabel =
    settings.temperature < 0.3 ? 'Precise' :
    settings.temperature < 0.6 ? 'Balanced' :
    settings.temperature < 0.85 ? 'Creative' : 'Wild';

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="font-bold text-sm text-foreground">Model Settings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">mesurado-1.0-lite</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Temperature */}
        <div className="px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(0 72% 51% / 0.1)' }}>
              <Thermometer size={14} style={{ color: 'hsl(0 72% 51%)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">Temperature</p>
              <p className="text-xs text-muted-foreground">Controls creativity</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-extrabold tabular-nums text-foreground">
                {settings.temperature.toFixed(2)}
              </span>
              <span className="text-xs font-medium" style={{ color: 'hsl(0 72% 51%)' }}>{tempLabel}</span>
            </div>
          </div>

          <input
            type="range" min={0} max={1} step={0.01} value={settings.temperature}
            onChange={e => set(settings, onChange, 'temperature', parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'hsl(0 72% 51%)' }}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>0 · Precise</span>
            <span>1 · Wild</span>
          </div>
        </div>

        {/* Live Search */}
        <div className="px-5 py-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  background: isPaidUser && settings.liveSearch
                    ? 'hsl(142 76% 45% / 0.12)'
                    : 'hsl(215 20% 50% / 0.1)',
                }}>
                <Globe size={14} style={{
                  color: isPaidUser && settings.liveSearch
                    ? 'hsl(142 76% 38%)'
                    : 'hsl(215 20% 55%)',
                }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Live Search</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                  {!isPaidUser
                    ? 'Pay-As-You-Go only'
                    : settings.liveSearch
                    ? 'Web results for time-sensitive queries'
                    : 'Enable for real-time web results'}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <div className="relative group flex-shrink-0 mt-0.5">
              <button
                role="switch"
                aria-checked={settings.liveSearch && isPaidUser}
                disabled={!isPaidUser}
                onClick={() => isPaidUser && set(settings, onChange, 'liveSearch', !settings.liveSearch)}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ${
                  !isPaidUser ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  background: settings.liveSearch && isPaidUser
                    ? 'hsl(142 76% 40%)'
                    : 'hsl(215 20% 80%)',
                }}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
                  settings.liveSearch && isPaidUser ? 'left-6' : 'left-1'
                }`} />
              </button>
              {!isPaidUser && (
                <div className="absolute right-0 bottom-8 hidden group-hover:block z-50 w-44 px-3 py-2 rounded-xl text-xs text-white shadow-xl pointer-events-none"
                  style={{ background: 'hsl(222 47% 12%)' }}>
                  Upgrade to Pay-As-You-Go to enable live search
                  <span className="absolute right-3 -bottom-1.5 w-3 h-3 rotate-45 block"
                    style={{ background: 'hsl(222 47% 12%)' }} />
                </div>
              )}
            </div>
          </div>

          {isPaidUser && settings.liveSearch && (
            <div className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ background: 'hsl(142 76% 45% / 0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-xs font-medium" style={{ color: 'hsl(142 76% 38%)' }}>
                Searches Liberia news, prices &amp; live data
              </span>
            </div>
          )}
        </div>

        {/* Max Tokens */}
        <div className="px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(217 72% 47% / 0.1)' }}>
              <Hash size={14} style={{ color: 'hsl(217 72% 47%)' }} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Max Output Tokens</p>
              <p className="text-xs text-muted-foreground">Response length limit</p>
            </div>
          </div>
          <input
            type="number" value={settings.maxTokens}
            onChange={e => set(settings, onChange, 'maxTokens', Math.max(1, Math.min(4096, parseInt(e.target.value) || 500)))}
            min={1} max={4096}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:border-primary transition"
          />
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <Info size={10} />
            Range: 1 – 4,096 tokens
          </p>
        </div>

        {/* Active Model */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(222 47% 14%)' }}>
              <Cpu size={14} className="text-white" />
            </div>
            <p className="text-xs font-bold text-foreground">Active Model</p>
          </div>
          <div className="rounded-2xl p-4 border"
            style={{
              background: 'linear-gradient(135deg, hsl(222 47% 10%) 0%, hsl(222 47% 14%) 100%)',
              borderColor: 'hsl(222 47% 20%)',
            }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Operational</span>
            </div>
            <p className="text-white font-extrabold text-sm">mesurado-1.0-lite</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(213 27% 60%)' }}>Mesurado Engine Core · Media Tech Liberia</p>
          </div>
        </div>
      </div>
    </div>
  );
}
