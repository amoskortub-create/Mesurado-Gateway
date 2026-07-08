import { useState } from 'react';
import { SettingsPanel, type PlaygroundSettings } from '@/components/playground/settings-panel';
import { ChatInterface } from '@/components/playground/chat-interface';
import { MOCK_USAGE } from '@/lib/mock';

const isPaidUser = MOCK_USAGE.plan === 'payg';

const DEFAULT_SETTINGS: PlaygroundSettings = {
  temperature: 0.75,
  systemPrompt: 'You are Mesurado AI, built by Media Tech Liberia. You are helpful, accurate, and concise.',
  maxTokens: 500,
  liveSearch: isPaidUser, // on by default for paid users
};

export default function PlaygroundPage() {
  const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS);
  // Mobile: show settings panel as full-screen overlay
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* ── Desktop: side-by-side layout ─────────────────────────────────── */}
      {/* ── Mobile: chat full-width, settings as overlay ─────────────────── */}

      {/* Settings overlay backdrop — mobile only */}
      {mobileSettingsOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileSettingsOpen(false)}
        />
      )}

      {/* Settings Panel */}
      <div
        className={[
          // Mobile: fixed overlay sliding up from bottom
          'fixed bottom-0 left-0 right-0 z-50 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto',
          'md:w-72 md:flex-shrink-0',
          // Mobile show/hide
          mobileSettingsOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto',
          'transition-all duration-300 ease-in-out',
          // Height: full on desktop, 85% of screen on mobile
          'h-[85vh] md:h-full',
          'p-3 md:p-0',
        ].join(' ')}
      >
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          isPaidUser={isPaidUser}
          onMobileClose={() => setMobileSettingsOpen(false)}
        />
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-w-0 h-full p-3 md:p-0 md:pl-4">
        <ChatInterface
          settings={settings}
          isPaidUser={isPaidUser}
          onSettingsClick={() => setMobileSettingsOpen(true)}
        />
      </div>
    </div>
  );
}
