'use client';

import { useState } from 'react';
import { SettingsPanel } from '@/components/playground/settings-panel';
import { ChatInterface } from '@/components/playground/chat-interface';

interface Settings {
  temperature: number;
  systemPrompt: string;
  maxTokens: number;
}

const DEFAULT_SETTINGS: Settings = {
  temperature: 0.75,
  systemPrompt:
    'You are Mesurado AI, built by Media Tech Liberia. You are helpful, accurate, and concise.',
  maxTokens: 500,
};

export default function PlaygroundPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  return (
    <div
      className="flex gap-4 overflow-hidden"
      style={{ height: 'calc(100vh - 64px - 48px)' }}
    >
      {/* Left panel — Settings (fixed width) */}
      <div className="w-72 flex-shrink-0 overflow-hidden">
        <SettingsPanel settings={settings} onChange={setSettings} />
      </div>

      {/* Right panel — Chat (flexible) */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ChatInterface settings={settings} />
      </div>
    </div>
  );
}
