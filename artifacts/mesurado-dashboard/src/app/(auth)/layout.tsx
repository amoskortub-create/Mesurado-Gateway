import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(222 47% 8%) 0%, hsl(222 47% 14%) 40%, hsl(217 72% 20%) 100%)',
      }}
    >
      {/* Decorative background elements */}
      <div
        className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, hsl(0 72% 51%) 0%, transparent 50%), radial-gradient(circle at 80% 80%, hsl(217 72% 47%) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(hsl(222 47% 20% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(222 47% 20% / 0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">{children}</div>
    </div>
  );
}
