import { useState, useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Check, Bell, BellOff, AlertTriangle } from 'lucide-react';
import { gsap } from 'gsap';
import { isAxiosError } from 'axios';
import { configApi, notificationsApi } from '../../services/api';
import { AccountConfig, GoalPeriod } from '../../types';
import { FieldMessages, PERIOD_ADJECTIVE, PERIOD_NOUN, SettingsField, validateSettings } from '../../lib/goalDisplay';
import { useGoalPreview, useRefreshGoal } from '../../hooks/useGoal';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { GoalFeasibilityPanel } from './GoalFeasibilityPanel';
import { PageContainer } from '../ui/PageContainer';
import { SectionLabel } from '../ui/SectionLabel';
import { Button } from '../ui/Button';
import { ThemePreference, useTheme } from '../../context/ThemeContext';
import { useAppContext } from '../../context/AppContext';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  getSubscriptionState,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../services/notifications';

// ── Main component ────────────────────────────────────────────────

const DEFAULT_CONFIG: AccountConfig = {
  accountSize: '5000', goalAmount: '100', goalPeriod: 'WEEKLY', riskPercent: '1.5', maxRiskPercent: '2',
};
const PERIODS: GoalPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

export function SettingsPanel() {
  const {
    developingHidden,
    setDevelopingHidden,
    developingConversionRate,
    developingCandidatesSeen,
    developingConverted,
  } = useAppContext();
  const { preference, resolved, setPreference } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const pageRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig]         = useState<AccountConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<AccountConfig>(DEFAULT_CONFIG);
  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const [touched, setTouched]       = useState<Set<SettingsField>>(new Set());
  const [serverErrors, setServerErrors] = useState<FieldMessages>({});
  const refreshGoal = useRefreshGoal();
  useEffect(() => {
    configApi.get()
      .then(c => { setConfig(c); setSavedConfig(c); setLoaded(true); })
      .catch(console.error);
  }, []);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const validation = validateSettings(config);
  const hasErrors = Object.keys(validation.errors).length > 0;
  // Errors show once a field was left (or after a save attempt); the server has the last word.
  const shown = (field: SettingsField) => serverErrors[field] ?? (touched.has(field) ? validation.errors[field] : undefined);

  // The feasibility preview follows the form as you type, once it is valid.
  const debouncedConfig = useDebouncedValue(config, 300);
  const previewDraft = loaded && Object.keys(validateSettings(debouncedConfig).errors).length === 0 ? debouncedConfig : null;
  const { preview, fetching } = useGoalPreview(previewDraft);

  const update = (patch: Partial<AccountConfig>) => {
    setConfig(c => ({ ...c, ...patch }));
    setServerErrors({});
  };

  // Warn browser on unload when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBlur = (field: SettingsField) => {
    setTouched(prev => new Set(prev).add(field));
  };

  const handleSave = async () => {
    setTouched(new Set(Object.keys(DEFAULT_CONFIG) as SettingsField[]));
    if (hasErrors) return;

    setSaving(true);
    try {
      const { config: saved } = await configApi.update(config);
      setConfig(saved);
      setSavedConfig(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await refreshGoal();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) setServerErrors(err.response.data?.fields ?? {});
      else console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(savedConfig);
    setTouched(new Set());
    setServerErrors({});
  };

  const footerVisible = isDirty || saveSuccess;

  useLayoutEffect(() => {
    if (prefersReducedMotion || !pageRef.current) return;
    const surfaces = pageRef.current.querySelectorAll('[data-sf-settings-surface]');
    if (surfaces.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        surfaces,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: 'power2.out',
          stagger: 0.06,
          clearProps: 'opacity,transform',
        },
      );
    }, pageRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  useLayoutEffect(() => {
    if (prefersReducedMotion || !footerVisible || !footerRef.current) return;
    gsap.fromTo(
      footerRef.current,
      { autoAlpha: 0, y: 10 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.22,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
      },
    );
  }, [prefersReducedMotion, footerVisible]);

  return (
    <PageContainer className={footerVisible ? 'pb-28' : ''}>
      <div ref={pageRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: form sections ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Account */}
          <Section title="Account" id="tour-settings-account" animated>
            <ValidatedField
              label="Account Size ($)"
              value={config.accountSize}
              onChange={v => update({ accountSize: v })}
              onBlur={() => handleBlur('accountSize')}
              error={shown('accountSize')}
              hint="Total trading capital"
              min="100" step="100"
            />
            <div>
              <ValidatedField
                label={`${PERIOD_ADJECTIVE[config.goalPeriod]} Goal ($)`}
                value={config.goalAmount}
                onChange={v => update({ goalAmount: v })}
                onBlur={() => handleBlur('goalAmount')}
                error={shown('goalAmount')}
                hint={`Profit you aim for each ${PERIOD_NOUN[config.goalPeriod]} from trades you take`}
                min="1"
              />
              <div role="group" aria-label="Goal period" className="inline-flex mt-2 bg-surface-700 rounded-lg p-1 border border-surface-600">
                {PERIODS.map(p => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={config.goalPeriod === p}
                    onClick={() => update({ goalPeriod: p })}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      config.goalPeriod === p ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {PERIOD_ADJECTIVE[p]}
                  </button>
                ))}
              </div>
            </div>
            <ValidatedField
              label="Risk Per Trade (%)"
              value={config.riskPercent}
              onChange={v => update({ riskPercent: v })}
              onBlur={() => handleBlur('riskPercent')}
              error={shown('riskPercent')}
              hint="1–2% recommended for swing trading"
              min="0.1" step="0.5"
            />
            <ValidatedField
              label="Risk Ceiling (%)"
              value={config.maxRiskPercent}
              onChange={v => update({ maxRiskPercent: v })}
              onBlur={() => handleBlur('maxRiskPercent')}
              error={shown('maxRiskPercent')}
              warning={validation.warnings.maxRiskPercent}
              hint="Risk per trade can never be set above this. SwingFlow never raises your risk for you."
              min="0.1" max="10" step="0.5"
            />
          </Section>

          <Section title="Appearance" animated>
            <ThemeToggle
              preference={preference}
              resolved={resolved}
              onChange={setPreference}
            />
            <div className="pt-3 border-t border-surface-700">
              <ThemedSwitch
                checked={developingHidden}
                onChange={setDevelopingHidden}
                label="Hide developing setups on dashboard"
                description="Toggle visibility of non-actionable developing candidates in the dashboard."
              />
              <p className="text-xs text-gray-500 mt-2">
                Developing conversion: {developingConverted}/{developingCandidatesSeen}
                {developingConversionRate != null ? ` (${developingConversionRate.toFixed(0)}%)` : ''}.
              </p>
            </div>
          </Section>

          {/* Alerts */}
          <Section title="Alerts & Notifications" id="tour-settings-notifications" animated>
            <PushToggle />
          </Section>
        </div>

        {/* ── Right column: sticky live preview ── */}
        <div>
          <div className="sticky top-4 space-y-5" id="tour-settings-sizing">
            <div data-sf-settings-surface className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel as="p" noMargin className="mb-0">
                  Is This Goal Realistic?
                </SectionLabel>
                <span className="flex items-center gap-1.5 text-sf-field text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse inline-block" />
                  Live preview
                </span>
              </div>
              <GoalFeasibilityPanel
                preview={preview}
                fetching={fetching}
                invalid={hasErrors}
                onApply={update}
              />
            </div>
          </div>
        </div>
      </div>

      {footerVisible && (
        <div
          ref={footerRef}
          className="sticky bottom-0 z-10 mt-8 -mx-4 sm:-mx-5 md:-mx-6 px-4 sm:px-5 md:px-6 py-4 border-t border-surface-700 bg-surface-950/95 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sf-body min-w-0">
              {isDirty && !saveSuccess && (
                <>
                  <span className="w-2 h-2 rounded-full bg-warn-400 flex-shrink-0" />
                  <span className="text-warn-400 truncate">Unsaved changes</span>
                </>
              )}
              {saveSuccess && !isDirty && (
                <>
                  <Check size={14} className="text-data-up flex-shrink-0" />
                  <span className="text-data-up">Saved successfully</span>
                </>
              )}
              {hasErrors && (
                <span className="text-data-down text-sf-field ml-2">Fix errors before saving</span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {isDirty && (
                <Button type="button" variant="ghost" onClick={handleDiscard}>
                  Discard
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || hasErrors || !isDirty}
                className={saveSuccess && !isDirty ? '!bg-bull-500 hover:!bg-bull-600' : ''}
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function ThemeToggle({
  preference,
  resolved,
  onChange,
}: {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  onChange: (next: ThemePreference) => void;
}) {
  const options: ThemePreference[] = ['light', 'dark', 'system'];
  const labels: Record<ThemePreference, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  };

  return (
    <div className="space-y-2.5">
      <div className="text-sf-body text-gray-300">
        Choose how SwingFlow looks.
      </div>
      <div className="inline-flex bg-surface-700 rounded-lg p-1 border border-surface-600">
        {options.map((opt) => {
          const active = preference === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                active
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
      <p className="text-sf-field text-gray-500">
        Active theme: <span className="capitalize text-gray-400">{resolved}</span>
      </p>
    </div>
  );
}

type PushState = 'subscribed' | 'not-subscribed' | 'unsupported' | 'loading';

function PushToggle() {
  const [state, setState] = useState<PushState>('loading');
  const [optimisticSubscribed, setOptimisticSubscribed] = useState<boolean | null>(null);
  const [health, setHealth] = useState<{ configured: boolean; subscriptions: number; lastNotificationAt: number | null; lastNotificationDelivered: boolean | null } | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const trackRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    getSubscriptionState().then(setState);
    notificationsApi.health().then(setHealth).catch(() => {});
  }, []);

  const handleToggle = async () => {
    if (state === 'unsupported' || state === 'loading') return;
    const currentlySubscribed = optimisticSubscribed ?? (state === 'subscribed');

    // Immediate visual feedback; rollback below if API work fails.
    setOptimisticSubscribed(!currentlySubscribed);

    if (currentlySubscribed) {
      const ok = await unsubscribeFromPush();
      if (ok) {
        setState('not-subscribed');
      } else {
        setOptimisticSubscribed(currentlySubscribed);
      }
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      setState('not-subscribed');
      setOptimisticSubscribed(false);
      return;
    }
    const reg = await registerServiceWorker();
    if (reg) {
      const ok = await subscribeToPush(reg);
      if (ok) {
        setState('subscribed');
      } else {
        setOptimisticSubscribed(false);
      }
    } else {
      setOptimisticSubscribed(false);
    }
  };

  const subscribed = optimisticSubscribed ?? (state === 'subscribed');

  useEffect(() => {
    if (state === 'loading') return;
    setOptimisticSubscribed(null);
  }, [state]);

  useLayoutEffect(() => {
    if (!trackRef.current || !thumbRef.current) return;

    if (prefersReducedMotion) {
      gsap.set(trackRef.current, { backgroundColor: subscribed ? '#0ea5e9' : '#314057' });
      gsap.set(thumbRef.current, { x: subscribed ? 20 : 0, scale: 1 });
      return;
    }

    const tl = gsap.timeline();
    tl.to(trackRef.current, {
      backgroundColor: subscribed ? '#0ea5e9' : '#314057',
      duration: 0.2,
      ease: 'power2.out',
    }, 0);
    tl.to(thumbRef.current, {
      x: subscribed ? 20 : 0,
      duration: 0.26,
      ease: 'back.out(1.5)',
    }, 0);
    tl.fromTo(thumbRef.current, { scale: 0.94 }, {
      scale: 1,
      duration: 0.22,
      ease: 'power2.out',
    }, 0.04);
  }, [subscribed, prefersReducedMotion]);

  return (
    <div className="space-y-3">
      <ThemedSwitch
        checked={subscribed}
        onChange={() => void handleToggle()}
        disabled={state === 'unsupported' || state === 'loading'}
        label="Enable browser notifications"
        description="Get notified when new setups are detected or price targets are hit, even when this tab is in the background."
        icon={subscribed ? <Bell size={14} className="text-brand-400" /> : <BellOff size={14} className="text-gray-400" />}
        trackRef={trackRef}
        thumbRef={thumbRef}
      />
      {state === 'unsupported' && (
        <p className="text-xs text-warn-400">Push notifications are not supported in this browser.</p>
      )}
      <p className="text-xs text-gray-500">
        {health
          ? `Status: ${health.configured ? 'configured' : 'not configured'} · ${health.subscriptions} device(s) subscribed`
          : 'Status: checking notification health...'}
      </p>
    </div>
  );
}

function ThemedSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  icon,
  trackRef,
  thumbRef,
}: {
  checked: boolean;
  onChange: (next: boolean) => void | Promise<void>;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  trackRef?: RefObject<HTMLButtonElement>;
  thumbRef?: RefObject<HTMLSpanElement>;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-sm font-medium text-gray-200">{label}</span>
        </div>
        {description && <p className="text-sm text-gray-400 leading-relaxed">{description}</p>}
      </div>
      <button
        ref={trackRef}
        type="button"
        onClick={() => void onChange(!checked)}
        disabled={disabled}
        className={`relative flex-shrink-0 h-6 w-11 rounded-full border transition-colors ${
          checked
            ? 'bg-brand-500 border-brand-400/60'
            : 'bg-surface-700 border-surface-500'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        role="switch"
        aria-checked={checked}
      >
        <span
          ref={thumbRef}
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function Section({
  title,
  children,
  id,
  animated = false,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
  animated?: boolean;
}) {
  return (
    <div id={id} data-sf-settings-surface={animated ? '1' : undefined} className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
      <SectionLabel as="h3">{title}</SectionLabel>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ValidatedField({ label, value, onChange, onBlur, error, warning, hint, min, max, step }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  error?: string;
  warning?: string;
  hint?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  const borderClass = error
    ? 'border-bear-500 focus:border-bear-400'
    : warning
    ? 'border-warn-500/60 focus:border-warn-500'
    : 'border-surface-600 focus:border-brand-500';
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sf-label text-gray-400 mb-1.5">{label}</label>
      <input
        id={id}
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onBlur?.(e.target.value)}
        className={`w-full bg-surface-700 border rounded-lg px-3 py-2.5 text-white text-sf-body focus:outline-none font-mono transition-colors ${borderClass}`}
      />
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-bear-400 mt-1.5">
          <AlertTriangle size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && warning && (
        <p className="flex items-center gap-1.5 text-xs text-warn-400 mt-1.5">
          <AlertTriangle size={11} className="flex-shrink-0" />
          {warning}
        </p>
      )}
      {!error && !warning && hint && (
        <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
      )}
    </div>
  );
}


