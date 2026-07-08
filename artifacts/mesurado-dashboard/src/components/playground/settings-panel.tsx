import { Sliders, Cpu } from 'lucide-react';

export interface PlaygroundSettings {
  temperature: number;
  systemPrompt: string;
  maxTokens: number;
}

interface SettingsPanelProps {
  settings: PlaygroundSettings;
  onChange: (s: PlaygroundSettings) => void;
}

function update<K extends keyof PlaygroundSettings>(
  settings: PlaygroundSettings,
  onChange: (s: PlaygroundSettings) => void,
  key: K,
  value: PlaygroundSettings[K],
) {
  onChange({ ...settings, [key]: value });
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <div className="h-full bg-card border border-card-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-border flex items-center gap-2 flex-shrink-0">
        <Sliders size={15} className="text-primary flex-shrink-0" />
        <h3 className="font-bold text-sm text-foreground">Model Settings</h3>
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto">
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

        <div>
          <label className="block text-xs font-bold text-foreground mb-2">System Prompt</label>
          <textarea
            value={settings.systemPrompt}
            onChange={e => update(settings, onChange, 'systemPrompt', e.target.value)}
            rows={7}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs resize-none focus:outline-none focus:ring-2 focus:border-primary transition"
            placeholder="System instructions for the model…"
          />
        </div>

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

        <div className="rounded-xl p-3.5" style={{ background: 'hsl(217 72% 47% / 0.08)', border: '1px solid hsl(217 72% 47% / 0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={13} style={{ color: 'hsl(217 72% 47%)' }} />
            <p className="text-xs font-bold" style={{ color: 'hsl(217 72% 47%)' }}>Active Model</p>
          </div>
          <p className="text-sm font-extrabold text-foreground">mesurado-llama3.2-3b</p>
          <p className="text-xs text-muted-foreground mt-0.5">Mesurado Engine Core</p>
        </div>

        <div className="rounded-xl p-3 bg-muted/60">
          <p className="text-xs font-bold text-foreground mb-1.5">Tips</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Press Enter to send, Shift+Enter for newline</li>
            <li>• System prompt sets model behaviour</li>
            <li>• Lower temp → focused; higher → creative</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
