import { SignIn } from '@clerk/clerk-react';
import { Activity } from 'lucide-react';

export function AuthPage() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 mb-4 shadow-lg shadow-brand-500/25">
            <Activity size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SwingFlow</h1>
          <p className="text-sm text-gray-400 mt-1.5">Your intelligent trading assistant</p>
        </div>

        <SignIn
          appearance={{
            variables: {
              colorBackground: '#0f172a',
              colorInputBackground: '#111c3a',
              colorInputText: '#e2e8f0',
              colorPrimary: '#0ea5e9',
              colorTextSecondary: '#9ca3af',
              colorText:          '#e2e8f0',
              borderRadius: '12px',
            },
            elements: {
              rootBox:                      'w-full',
              cardBox:                      'w-full',
              card:                         'w-full bg-surface-800 border border-surface-700 shadow-2xl rounded-2xl overflow-hidden',
              headerTitle:                  'text-white',
              headerSubtitle:               'text-gray-400',
              socialButtonsBlockButton:     'bg-surface-600 border border-surface-500 text-white hover:bg-surface-500 rounded-xl transition-colors min-h-12 px-4',
              // GitHub ships a dark mark; invert for a white mark on dark buttons (Google stays full-color).
              socialButtonsProviderIcon__github: 'brightness-0 invert',
              socialButtonsBlockButtonText: 'text-gray-200 font-medium',
              dividerLine:                  'bg-surface-700',
              dividerText:                  'text-gray-400',
              formFieldLabel:               'text-gray-400 text-sm',
              formFieldInput:               'bg-surface-700 border border-surface-600 text-white placeholder-gray-500 focus:border-brand-500 rounded-xl min-h-12 px-4',
              formButtonPrimary:            'bg-brand-500 hover:bg-brand-600 text-white rounded-xl transition-colors min-h-12 px-4',
              footer:                       'bg-surface-800 border-t border-surface-700',
              footerAction:                 'bg-transparent',
              footerActionText:             'text-gray-400',
              footerActionLink:             'text-brand-400 hover:text-brand-300 font-medium',
              identityPreviewText:          'text-white',
              identityPreviewEditButtonIcon:'text-gray-400',
              formResendCodeLink:           'text-brand-400 hover:text-brand-300',
              alertText:                    'text-amber-300',
            },
          }}
        />

        <p className="text-center text-xs text-gray-400 mt-6">
          SwingFlow does not provide financial advice. Trade responsibly.
        </p>
      </main>
    </div>
  );
}
