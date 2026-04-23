import { SignIn } from '@clerk/clerk-react';
import { Activity } from 'lucide-react';

export function AuthPage() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 mb-4 shadow-lg shadow-brand-500/25">
            <Activity size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SwingFlow</h1>
          <p className="text-sm text-gray-500 mt-1.5">Your intelligent trading assistant</p>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox:                     'w-full',
              card:                        'bg-surface-800 border border-surface-700 shadow-2xl rounded-2xl',
              headerTitle:                 'text-white',
              headerSubtitle:              'text-gray-500',
              socialButtonsBlockButton:    'bg-surface-700 border-surface-600 text-white hover:bg-surface-600 rounded-xl',
              socialButtonsBlockButtonText:'text-gray-200 font-medium',
              dividerLine:                 'bg-surface-700',
              dividerText:                 'text-gray-600',
              formFieldLabel:              'text-gray-400 text-sm',
              formFieldInput:              'bg-surface-700 border-surface-600 text-white placeholder-gray-600 focus:border-brand-500 rounded-xl',
              formButtonPrimary:           'bg-brand-500 hover:bg-brand-600 text-white rounded-xl',
              footerActionLink:            'text-brand-400 hover:text-brand-300',
              identityPreviewText:         'text-white',
              identityPreviewEditButtonIcon:'text-gray-500',
            },
          }}
        />

        <p className="text-center text-xs text-gray-700 mt-6">
          SwingFlow does not provide financial advice. Trade responsibly.
        </p>
      </div>
    </div>
  );
}
