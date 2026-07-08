import { useState } from 'react';
import { SettingsPanel, type PlaygroundSettings } from '@/components/playground/settings-panel';
import { ChatInterface } from '@/components/playground/chat-interface';
import { MOCK_USAGE } from '@/lib/mock';

const isPaidUser = MOCK_USAGE.plan === 'payg';

const DEFAULT_SETTINGS: PlaygroundSettings = {
  temperature: 0.75,
  maxTokens: 500,
  liveSearch: isPaidUser,
};

export default function PlaygroundPage() {
  const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden">

      {/* ── Mobile settings backdrop ─────────────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      {/* ── Chat (always visible, full width on mobile) ──────────────────── */}
      <div className="flex-1 min-w-0 h-full overflow-hidden border-r border-border md:border-0">
        <ChatInterface
          settings={settings}
          isPaidUser={isPaidUser}
          settingsOpen={settingsOpen}
          onSettingsToggle={() => setSettingsOpen(o => !o)}
        />
      </div>

      {/* ── Settings panel ───────────────────────────────────────────────── */}
      {/*
          Desktop: slides in from the right as a 300px panel
          Mobile:  slides up from the bottom as a 75vh sheet
      */}
      <div
        className={[
          // Mobile: fixed bottom sheet
          'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl border-t border-border overflow-hidden',
          'md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:rounded-none md:shadow-none md:border-t-0 md:border-l md:border-border',
          // Width
          'md:w-80 md:flex-shrink-0',
          // Height
          'h-[78vh] md:h-full',
          // Show/hide with transition
          settingsOpen
            ? 'translate-y-0 md:translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-y-full md:translate-y-0 md:translate-x-full opacity-0 md:opacity-0 pointer-events-none',
          'transition-all duration-300 ease-in-out',
          'bg-card',
        ].join(' ')}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          isPaidUser={isPaidUser}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
