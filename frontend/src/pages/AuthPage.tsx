import { SignIn } from '@clerk/clerk-react';

export function AuthPage() {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-brand-500/30">
            SF
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SwingFlow</h1>
          <p className="text-gray-400 mt-2">Your personal trading assistant</p>
        </div>

        {/* Clerk handles all auth UI, OAuth providers, email magic links, etc. */}
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-surface-800 border border-surface-600 shadow-2xl rounded-2xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-gray-400',
              socialButtonsBlockButton: 'bg-surface-700 border-surface-600 text-white hover:bg-surface-600',
              socialButtonsBlockButtonText: 'text-white font-medium',
              dividerLine: 'bg-surface-600',
              dividerText: 'text-gray-500',
              formFieldLabel: 'text-gray-300',
              formFieldInput: 'bg-surface-700 border-surface-600 text-white placeholder-gray-500 focus:border-brand-500',
              formButtonPrimary: 'bg-brand-500 hover:bg-brand-600 text-white',
              footerActionLink: 'text-brand-400 hover:text-brand-300',
              identityPreviewText: 'text-white',
              identityPreviewEditButtonIcon: 'text-gray-400',
            },
          }}
        />

        <p className="text-center text-xs text-gray-600 mt-6">
          SwingFlow does not provide financial advice. Trade responsibly.
        </p>
      </div>
    </div>
  );
}
