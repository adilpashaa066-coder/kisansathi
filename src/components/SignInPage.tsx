import { useEffect, useRef, useState } from 'react';
import {
  getDistrictsForState,
  getTaluksForDistrict,
  INDIAN_STATES,
} from '../data/indiaLocations';
import { kisanApi } from '../services/api';
import type { Profession, UserProfile } from '../types/kisan';
import { KISAN_LOGO_URL } from './AppHeader';
import { ResilientImage } from './ResilientImage';

interface SignInPageProps {
  googleAuthConfigured: boolean;
  onAuthSuccess: (user: UserProfile, mode: 'signin' | 'signup' | 'google') => void;
}

const ROLES: Array<{
  value: Profession;
  label: string;
  description: string;
  icon: string;
  iconTone: string;
}> = [
  {
    value: 'farmer',
    label: 'Farmer',
    description: 'Cultivates crops & manages agricultural land',
    icon: 'agriculture',
    iconTone: 'text-primary',
  },
  {
    value: 'worker',
    label: 'Farm Worker',
    description: 'Agricultural labor, harvesting & daily wage tasks',
    icon: 'handyman',
    iconTone: 'text-secondary',
  },
  {
    value: 'supplier',
    label: 'Supplier / Trader',
    description: 'Sells seeds, fertilizers, agri equipment & buys crops in bulk',
    icon: 'storefront',
    iconTone: 'text-secondary',
  },
];

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string }
          ) => void;
        };
      };
    };
  }
}

export function SignInPage({ googleAuthConfigured, onAuthSuccess }: SignInPageProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Shared credentials (always initialized empty — never prefilled with another user's info)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign-Up specific registration fields
  const [name, setName] = useState('');
  const [profession, setProfession] = useState<Profession>('farmer');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const professionRef = useRef<Profession>(profession);
  professionRef.current = profession;

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';
  const canShowGoogleSignIn = Boolean(googleAuthConfigured && googleClientId);

  useEffect(() => {
    if (!canShowGoogleSignIn || !googleBtnRef.current) return;
    let cancelled = false;

    const initGoogleButton = () => {
      if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) return;
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp) => {
          if (!resp.credential) {
            setErrorMsg('Google Sign-In did not return a valid credential.');
            return;
          }
          setErrorMsg('');
          setSubmitting(true);
          try {
            const result = await kisanApi.googleSignIn({
              idToken: resp.credential,
              profession: professionRef.current,
            });
            onAuthSuccess(result.user, 'google');
          } catch (err) {
            setErrorMsg(
              err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.'
            );
          } finally {
            setSubmitting(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(360, googleBtnRef.current.clientWidth || 320),
        text: 'continue_with',
      });
    };

    if (window.google?.accounts?.id) {
      initGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', initGoogleButton);
      return () => {
        cancelled = true;
        existingScript.removeEventListener('load', initGoogleButton);
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleButton;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [canShowGoogleSignIn, googleClientId, onAuthSuccess]);

  const availableDistricts = state ? getDistrictsForState(state) : [];
  const availableTaluks = state && district ? getTaluksForDistrict(state, district) : [];

  const handleModeSwitch = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setErrorMsg('');
    setPassword('');
    setShowPassword(false);
  };

  const handleStateChange = (nextState: string) => {
    setState(nextState);
    setDistrict('');
    setTaluk('');
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setDistrict(nextDistrict);
    setTaluk('');
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      const result = await kisanApi.login({ email: cleanEmail, password });
      setPassword('');
      onAuthSuccess(result.user, 'signin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (!state) {
      setErrorMsg('Please select your State.');
      return;
    }
    if (!district) {
      setErrorMsg('Please select your District.');
      return;
    }
    if (!taluk) {
      setErrorMsg('Please select your Taluk.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      const result = await kisanApi.signup({
        name: cleanName,
        email: cleanEmail,
        password,
        profession,
        state,
        district,
        taluk,
      });
      setPassword('');
      onAuthSuccess(result.user, 'signup');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-surface text-on-surface flex flex-col pt-safe pb-safe">
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-8">
        {/* Brand Header Card with Application Logo */}
        <div className="relative w-full rounded-2xl bg-surface-container-lowest shadow-md overflow-hidden p-4 flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-surface-bright shadow-sm p-1.5 flex items-center justify-center flex-shrink-0 border border-outline-variant/40">
              <ResilientImage
                src={KISAN_LOGO_URL}
                alt="Kisan Sathi Application Logo"
                className="w-full h-full object-contain"
                fallbackIcon="eco"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-[1.2rem] leading-tight text-primary font-extrabold tracking-tight truncate">
                KISAN SATHI
              </h1>
              <p className="text-xs text-on-surface-variant mt-0.5 font-medium truncate">
                Smart Farmer &amp; Rural Network
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span>{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
          </span>
        </div>

        {/* Separate Sign In / Sign Up Switcher */}
        <div
          role="tablist"
          aria-label="Authentication Options"
          className="w-full mt-3 p-1 rounded-2xl bg-surface-container flex items-center gap-1 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signin'}
            onClick={() => handleModeSwitch('signin')}
            className={`flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              authMode === 'signin'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>Sign In</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signup'}
            onClick={() => handleModeSwitch('signup')}
            className={`flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              authMode === 'signup'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Sign Up</span>
          </button>
        </div>

        {/* Real Google Sign-In (only rendered when configured with a valid Google Client ID) */}
        {canShowGoogleSignIn && (
          <div className="w-full mt-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-secondary font-bold block mb-1">
              Google Authentication
            </span>
            <p className="text-xs text-on-surface-variant mb-3">
              Sign in securely with your Google account
            </p>
            <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
          </div>
        )}

        {authMode === 'signin' ? (
          <form
            onSubmit={handleSignInSubmit}
            autoComplete="on"
            className="w-full mt-3 rounded-2xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm flex flex-col gap-4"
          >
            <div>
              <h2 className="text-base font-bold text-on-surface">Sign In to Your Account</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Enter your registered email and password to continue
              </p>
            </div>

            <div>
              <label htmlFor="signin-email" className="text-sm text-on-surface block mb-1 font-semibold">
                Email Address <span className="text-error">*</span>
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl px-4 h-12 shadow-sm focus-within:ring-2 focus-within:ring-secondary">
                <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">mail</span>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="bg-transparent flex-1 min-w-0 text-on-surface text-base focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signin-password" className="text-sm text-on-surface block mb-1 font-semibold">
                Password <span className="text-error">*</span>
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl px-4 h-12 shadow-sm focus-within:ring-2 focus-within:ring-secondary">
                <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">lock</span>
                <input
                  id="signin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-transparent flex-1 min-w-0 text-on-surface text-base focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-on-surface-variant hover:text-primary ml-2 shrink-0"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <p role="alert" className="text-sm text-error bg-error-container px-3 py-2 rounded-xl font-medium">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-1 h-13 bg-primary-container text-on-primary rounded-xl text-base font-semibold flex items-center justify-center gap-2 shadow-md hover:bg-primary transition-all active:scale-[0.99] disabled:opacity-60"
            >
              <span>{submitting ? 'Signing In...' : 'Sign In & Continue'}</span>
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>

            <p className="text-xs text-center text-on-surface-variant">
              New to Kisan Sathi?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signup')}
                className="text-primary font-bold underline underline-offset-2"
              >
                Create a new account
              </button>
            </p>
          </form>
        ) : (
          <form
            onSubmit={handleSignUpSubmit}
            autoComplete="on"
            className="w-full mt-3 rounded-2xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm flex flex-col gap-4"
          >
            <div>
              <h2 className="text-base font-bold text-on-surface">Create New Account</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Register with your details and select your State, District &amp; Taluk
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="signup-fullname" className="text-sm text-on-surface block mb-1 font-semibold">
                Full Name <span className="text-error">*</span>
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl px-4 h-12 shadow-sm focus-within:ring-2 focus-within:ring-secondary">
                <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">person</span>
                <input
                  id="signup-fullname"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="bg-transparent flex-1 min-w-0 text-on-surface text-base focus:outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="text-sm text-on-surface block mb-1 font-semibold">
                Email Address <span className="text-error">*</span>
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl px-4 h-12 shadow-sm focus-within:ring-2 focus-within:ring-secondary">
                <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">mail</span>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="bg-transparent flex-1 min-w-0 text-on-surface text-base focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="text-sm text-on-surface block mb-1 font-semibold">
                Password <span className="text-error">*</span>
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl px-4 h-12 shadow-sm focus-within:ring-2 focus-within:ring-secondary">
                <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">lock</span>
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="bg-transparent flex-1 min-w-0 text-on-surface text-base focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-on-surface-variant hover:text-primary ml-2 shrink-0"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Category / Profession Selection (Agricultural Expert removed) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-on-surface font-semibold">
                  Select Category <span className="text-error">*</span>
                </span>
                <span className="text-xs text-on-surface-variant font-semibold">Select one</span>
              </div>
              <div className="flex flex-col gap-2">
                {ROLES.map((role) => {
                  const selected = profession === role.value;
                  return (
                    <label
                      key={role.value}
                      className={`cursor-pointer rounded-xl p-3 shadow-sm flex items-center justify-between gap-2 transition-all ${
                        selected
                          ? 'bg-secondary-container/30 border border-secondary-container opacity-100'
                          : 'bg-surface-container-low border border-transparent opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 pr-2 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selected
                              ? 'bg-primary text-on-primary'
                              : `bg-surface-container-highest ${role.iconTone}`
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-xl ${
                              selected ? 'material-symbols-filled' : ''
                            }`}
                          >
                            {role.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`text-sm font-bold truncate ${
                              selected ? 'text-primary' : 'text-on-surface'
                            }`}
                          >
                            {role.label}
                          </div>
                          <div className="text-xs text-on-surface-variant">{role.description}</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="profession"
                        value={role.value}
                        checked={selected}
                        onChange={() => setProfession(role.value)}
                        className="w-4 h-4 accent-primary shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Cascading State -> District -> Taluk Dropdowns (All 28 States) */}
            <div className="flex flex-col gap-2.5">
              <div>
                <label htmlFor="signup-state" className="text-sm text-on-surface block mb-1 font-semibold">
                  State (28 Indian States) <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center bg-surface-container-low rounded-xl px-4 h-12 shadow-sm">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">map</span>
                  <select
                    id="signup-state"
                    required
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="bg-transparent flex-1 min-w-0 text-on-surface text-base appearance-none focus:outline-none pr-6 cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="signup-district" className="text-sm text-on-surface block mb-1 font-semibold">
                  District <span className="text-error">*</span>
                </label>
                <div
                  className={`relative flex items-center rounded-xl px-4 h-12 shadow-sm ${
                    !state ? 'bg-surface-container-low/60 opacity-65' : 'bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">
                    location_city
                  </span>
                  <select
                    id="signup-district"
                    required
                    disabled={!state}
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="bg-transparent flex-1 min-w-0 text-on-surface text-base appearance-none focus:outline-none pr-6 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <option value="">{state ? 'Select District' : 'Select State first'}</option>
                    {availableDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="signup-taluk" className="text-sm text-on-surface block mb-1 font-semibold">
                  Taluk <span className="text-error">*</span>
                </label>
                <div
                  className={`relative flex items-center rounded-xl px-4 h-12 shadow-sm ${
                    !district ? 'bg-surface-container-low/60 opacity-65' : 'bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-xl mr-2">
                    pin_drop
                  </span>
                  <select
                    id="signup-taluk"
                    required
                    disabled={!district}
                    value={taluk}
                    onChange={(e) => setTaluk(e.target.value)}
                    className="bg-transparent flex-1 min-w-0 text-on-surface text-base appearance-none focus:outline-none pr-6 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <option value="">{district ? 'Select Taluk' : 'Select District first'}</option>
                    {availableTaluks.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <p role="alert" className="text-sm text-error bg-error-container px-3 py-2 rounded-xl font-medium">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-1 h-13 bg-primary-container text-on-primary rounded-xl text-base font-semibold flex items-center justify-center gap-2 shadow-md hover:bg-primary transition-all active:scale-[0.99] disabled:opacity-60"
            >
              <span>{submitting ? 'Creating Account...' : 'Sign Up & Continue'}</span>
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>

            <p className="text-xs text-center text-on-surface-variant">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signin')}
                className="text-primary font-bold underline underline-offset-2"
              >
                Sign In here
              </button>
            </p>
          </form>
        )}

        {/* AgriStack & Privacy Badge */}
        <div className="w-full mt-3 p-3 rounded-xl bg-surface-container-low flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 text-primary text-xs font-semibold mb-0.5">
            <span className="material-symbols-outlined text-sm">security</span>
            <span>Protected under Digital India AgriStack</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Session isolated per account. Passwords hashed securely on server.
          </p>
        </div>
      </main>
    </div>
  );
}
