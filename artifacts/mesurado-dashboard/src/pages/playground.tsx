import { useState } from 'react';
import { SettingsPanel, type PlaygroundSettings } from '@/components/playground/settings-panel';
import { ChatInterface } from '@/components/playground/chat-interface';
import { useUsage } from '@/hooks/use-usage';

const DEFAULT_SETTINGS: PlaygroundSettings = {
  temperature: 0.75,
  maxTokens: 500,
  liveSearch: false,
};

export default function PlaygroundPage() {
  const { plan, tokensRemaining, refetch } = useUsage();
  const isPaidUser = plan === 'payg';
  const [settings, setSettings] = useState<PlaygroundSettings>({
    ...DEFAULT_SETTINGS,
    liveSearch: isPaidUser,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden">
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSettingsOpen(false)} />
      )}

      <div className="flex-1 min-w-0 h-full overflow-hidden border-r border-border md:border-0">
        <ChatInterface
          settings={settings}
          isPaidUser={isPaidUser}
          tokensRemaining={tokensRemaining}
          settingsOpen={settingsOpen}
          onSettingsToggle={() => setSettingsOpen(o => !o)}
          onTokensUsed={refetch}
        />
      </div>

      <div className={[
        'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl border-t border-border overflow-hidden',
        'md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:rounded-none md:shadow-none md:border-t-0 md:border-l md:border-border',
        'md:w-80 md:flex-shrink-0',
        'h-[78vh] md:h-full',
        settingsOpen
          ? 'translate-y-0 md:translate-x-0 opacity-100 pointer-events-auto'
          : 'translate-y-full md:translate-y-0 md:translate-x-full opacity-0 md:opacity-0 pointer-events-none',
        'transition-all duration-300 ease-in-out',
        'bg-card',
      ].join(' ')}>
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <SettingsPanel settings={settings} onChange={setSettings} isPaidUser={isPaidUser} onClose={() => setSettingsOpen(false)} />
      </div>
    </div>
  );
}
