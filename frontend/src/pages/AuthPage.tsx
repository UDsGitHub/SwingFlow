import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

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

        {/* Auth card */}
        <div className="bg-surface-800 rounded-2xl border border-surface-600 p-6 shadow-2xl">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand:            '#0ea5e9',
                    brandAccent:      '#0284c7',
                    brandButtonText:  'white',
                    defaultButtonBackground: '#1a2235',
                    defaultButtonBackgroundHover: '#1e2a40',
                    inputBackground:  '#1a2235',
                    inputBorder:      '#243048',
                    inputBorderFocus: '#0ea5e9',
                    inputText:        'white',
                    inputPlaceholder: '#6b7280',
                    messageText:      '#9ca3af',
                    anchorTextColor:  '#38bdf8',
                    dividerBackground: '#243048',
                  },
                  radii: {
                    borderRadiusButton: '0.5rem',
                    buttonBorderRadius: '0.5rem',
                    inputBorderRadius:  '0.5rem',
                  },
                  space: {
                    inputPadding:  '0.75rem',
                    buttonPadding: '0.75rem',
                  },
                  fonts: {
                    bodyFontFamily: 'Inter, system-ui, sans-serif',
                  },
                },
              },
            }}
            providers={['google', 'github']}
            redirectTo={window.location.origin}
            localization={{
              variables: {
                sign_in: { email_label: 'Email', password_label: 'Password' },
              },
            }}
          />
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          By signing in you agree to use this tool responsibly.
          SwingFlow does not provide financial advice.
        </p>
      </div>
    </div>
  );
}
