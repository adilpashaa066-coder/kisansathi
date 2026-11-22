import { signInWithPopup, signOut } from 'firebase/auth';
import { useState } from 'react';
import homeHeroImg from '../assets/images/kisan_home_hero_1795296050321.jpg';
import {
  getDistrictsForState,
  getTaluksForDistrict,
  INDIAN_STATES,
} from '../data/indiaLocations';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import {
  ApiError,
  getSavedLoginEmail,
  kisanApi,
  setSavedLoginEmail,
} from '../services/api';
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
}> = [
  {
    value: 'farmer',
    label: 'Farmer',
    description: 'Manage crops, hire workers & sell produce',
    icon: 'agriculture',
  },
  {
    value: 'worker',
    label: 'Farm Worker',
    description: 'Find daily wage & seasonal farm jobs',
    icon: 'handyman',
  },
  {
    value: 'supplier',
    label: 'Supplier / Trader',
    description: 'Source fresh farm lots & supply inputs',
    icon: 'storefront',
  },
];

function GoogleLogoIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function mapGoogleAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: unknown }).code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'Google Sign-In window was closed before completing. Please try again.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Your browser blocked the Google Sign-In popup. Please allow popups for this site and retry.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network issue while contacting Google Sign-In. Please check your connection.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized for Google Sign-In yet. Please use Email Sign In below.';
    }
  }
  return err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.';
}

export function SignInPage({ googleAuthConfigured, onAuthSuccess }: SignInPageProps) {
  const savedInitialEmail = getSavedLoginEmail();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<UserProfile | null>(null);

  // Credentials
  const [email, setEmail] = useState(savedInitialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // One-time Profile & Location fields (used for Email Sign-Up & First-Time Google Setup)
  const [name, setName] = useState('');
  const [profession, setProfession] = useState<Profession>('farmer');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorAction, setErrorAction] = useState<'google' | 'signin' | 'signup' | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const canUseGoogleSignIn = Boolean(
    (googleAuthConfigured || isFirebaseConfigured) && auth && googleProvider
  );

  const availableDistricts = state ? getDistrictsForState(state) : [];
  const availableTaluks = state && district ? getTaluksForDistrict(state, district) : [];

  const handleModeSwitch = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setErrorMsg('');
    setErrorAction(null);
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

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) {
      setErrorMsg('Google Sign-In is unavailable right now. Please sign in with Email.');
      setErrorAction(null);
      return;
    }

    setErrorMsg('');
    setErrorAction(null);
    setGoogleSubmitting(true);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken = await credential.user.getIdToken();
      const result = await kisanApi.googleSignIn({
        idToken,
        rememberMe,
      });

      if (result.user.profileCompleted) {
        onAuthSuccess(result.user, 'google');
        return;
      }

      // First-time Google user: show single once profile & save step
      setPendingGoogleUser(result.user);
      setName(result.user.name || credential.user.displayName || '');
      setProfession(
        result.user.profession === 'worker' || result.user.profession === 'supplier'
          ? result.user.profession
          : 'farmer'
      );
      setState(result.user.state || '');
      setDistrict(result.user.district || '');
      setTaluk(result.user.taluk || '');
    } catch (err) {
      setErrorMsg(mapGoogleAuthError(err));
      setErrorAction(null);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleCompleteGoogleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!state || !district || !taluk) {
      setErrorMsg('Please select your State, District, and Taluk.');
      return;
    }

    setErrorMsg('');
    setErrorAction(null);
    setSubmitting(true);
    try {
      const saved = await kisanApi.saveProfile({
        ...pendingGoogleUser,
        name: cleanName,
        profession,
        state,
        district,
        taluk,
        profileCompleted: true,
      });
      if (saved.email) {
        setSavedLoginEmail(saved.email, rememberMe);
      }
      onAuthSuccess(saved, 'google');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchGoogleAccount = async () => {
    setErrorMsg('');
    setErrorAction(null);
    setPendingGoogleUser(null);
    try {
      await kisanApi.logout();
      if (auth) await signOut(auth).catch(() => undefined);
    } catch {
      // ignore cleanup errors
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setErrorAction(null);
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      setErrorAction(null);
      return;
    }

    setErrorMsg('');
    setErrorAction(null);
    setSubmitting(true);
    try {
      const result = await kisanApi.login({
        email: cleanEmail,
        password,
        rememberMe,
      });
      setPassword('');
      onAuthSuccess(result.user, 'signin');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'USE_GOOGLE_SIGNIN') {
        setErrorMsg(err.message);
        setErrorAction(canUseGoogleSignIn ? 'google' : null);
      } else if (err instanceof ApiError && err.status === 401) {
        setErrorMsg(err.message);
        setErrorAction(err.code === 'INVALID_CREDENTIALS' ? 'signup' : null);
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to sign in. Please check your credentials.'
        );
        setErrorAction(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (minimum 2 characters).');
      setErrorAction(null);
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setErrorAction(null);
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      setErrorAction(null);
      return;
    }
    if (!state || !district || !taluk) {
      setErrorMsg('Please select your State, District, and Taluk.');
      setErrorAction(null);
      return;
    }

    setErrorMsg('');
    setErrorAction(null);
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
        rememberMe,
      });
      setPassword('');
      onAuthSuccess(result.user, 'signup');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_EXISTS') {
        setErrorMsg(err.message);
        setErrorAction('signin');
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to create account. Please try again.'
        );
        setErrorAction(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || googleSubmitting;

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8 pt-safe pb-safe">
      <main className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/30 overflow-hidden items-stretch">
        {/* Left Showcase Panel */}
        <section className="lg:col-span-5 bg-primary text-on-primary flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 p-6 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-lowest p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                <ResilientImage
                  src={KISAN_LOGO_URL}
                  alt="Kisan Sathi Logo"
                  className="w-full h-full object-contain"
                  fallbackIcon="eco"
                />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-extrabold tracking-tight block truncate">
                  KISAN SATHI
                </span>
                <span className="text-xs text-primary-fixed block truncate">
                  Smart Farmer &amp; Rural Network
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <h1 className="text-2xl sm:text-[1.85rem] font-extrabold leading-tight text-balance">
                Sign Up Once. Access Your Entire Farm Network.
              </h1>
              <p className="text-sm text-primary-fixed/90 leading-relaxed">
                Save your profile once with Google or Email to hire verified farm workers, list
                harvest lots for direct trade, and get regional crop advisory.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs sm:text-sm text-primary-fixed">
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-secondary-fixed shrink-0 mt-0.5">
                  check_circle
                </span>
                <span>One-time registration saved securely to your account</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-secondary-fixed shrink-0 mt-0.5">
                  check_circle
                </span>
                <span>Instant sign-in with Google or saved Email credentials</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-secondary-fixed shrink-0 mt-0.5">
                  check_circle
                </span>
                <span>District &amp; taluk tailored work listings and mandi rates</span>
              </li>
            </ul>
          </div>

          <div className="relative h-44 sm:h-52 lg:h-56 w-full mt-auto overflow-hidden">
            {!heroImgFailed ? (
              <img
                src={homeHeroImg}
                alt="Farmer inspecting sunlit agricultural crops"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-container to-secondary" />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-primary via-primary/35 to-transparent"
            />
            <div className="absolute bottom-4 inset-x-6 flex items-center justify-between text-xs text-primary-fixed/95">
              <span>Digital India AgriStack Ready</span>
              <span>28 States Supported</span>
            </div>
          </div>
        </section>

        {/* Right Authentication & One-Time Save Panel */}
        <section className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          {pendingGoogleUser ? (
            /* One-Time Google Profile Completion & Save */
            <form onSubmit={handleCompleteGoogleSetup} className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-3 min-w-0">
                  <ResilientImage
                    src={pendingGoogleUser.avatarUrl}
                    alt={pendingGoogleUser.name}
                    className="w-12 h-12 rounded-full object-cover border border-outline-variant/40 shrink-0"
                    fallbackText={(pendingGoogleUser.name || 'KS').slice(0, 2).toUpperCase()}
                    fallbackClassName="bg-primary text-on-primary text-sm"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-secondary block">
                      Google Account Connected
                    </span>
                    <h2 className="text-lg font-extrabold text-on-surface truncate">
                      Complete &amp; Save Your Profile
                    </h2>
                    <p className="text-xs text-on-surface-variant truncate">
                      {pendingGoogleUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSwitchGoogleAccount()}
                  className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-secondary hover:bg-surface-container-low transition-colors"
                >
                  Use another account
                </button>
              </div>

              <p className="text-xs sm:text-sm text-on-surface-variant">
                One-time setup: save your role and location once so future Google sign-ins open your
                workspace immediately.
              </p>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="google-setup-name"
                  className="text-sm font-semibold text-on-surface block mb-1.5"
                >
                  Full Name <span className="text-error">*</span>
                </label>
                <div className="flex items-center bg-surface-container-low rounded-xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-secondary">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2.5">
                    person
                  </span>
                  <input
                    id="google-setup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="bg-transparent flex-1 min-w-0 text-on-surface text-sm sm:text-base focus:outline-none"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <span className="text-sm font-semibold text-on-surface block mb-2">
                  Select Your Role <span className="text-error">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {ROLES.map((role) => {
                    const selected = profession === role.value;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setProfession(role.value)}
                        className={`text-left rounded-xl p-3 border transition-all min-h-[44px] flex flex-col gap-1 ${
                          selected
                            ? 'bg-secondary-container/30 border-secondary text-primary shadow-sm'
                            : 'bg-surface-container-low border-transparent text-on-surface hover:border-outline-variant/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="material-symbols-outlined text-[20px]">{role.icon}</span>
                          {selected && (
                            <span className="material-symbols-outlined text-[18px] text-secondary material-symbols-filled">
                              check_circle
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold block">{role.label}</span>
                        <span className="text-[11px] text-on-surface-variant leading-snug">
                          {role.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* State / District / Taluk */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="google-state"
                    className="text-xs font-semibold text-on-surface block mb-1"
                  >
                    State <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center bg-surface-container-low rounded-xl px-3 h-12">
                    <select
                      id="google-state"
                      required
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="bg-transparent flex-1 min-w-0 text-on-surface text-sm appearance-none focus:outline-none pr-6 cursor-pointer"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 text-on-surface-variant pointer-events-none text-lg">
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="google-district"
                    className="text-xs font-semibold text-on-surface block mb-1"
                  >
                    District <span className="text-error">*</span>
                  </label>
                  <div
                    className={`relative flex items-center rounded-xl px-3 h-12 bg-surface-container-low ${
                      !state ? 'opacity-60' : ''
                    }`}
                  >
                    <select
                      id="google-district"
                      required
                      disabled={!state}
                      value={district}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      className="bg-transparent flex-1 min-w-0 text-on-surface text-sm appearance-none focus:outline-none pr-6 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="">{state ? 'Select District' : 'State first'}</option>
                      {availableDistricts.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 text-on-surface-variant pointer-events-none text-lg">
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="google-taluk"
                    className="text-xs font-semibold text-on-surface block mb-1"
                  >
                    Taluk <span className="text-error">*</span>
                  </label>
                  <div
                    className={`relative flex items-center rounded-xl px-3 h-12 bg-surface-container-low ${
                      !district ? 'opacity-60' : ''
                    }`}
                  >
                    <select
                      id="google-taluk"
                      required
                      disabled={!district}
                      value={taluk}
                      onChange={(e) => setTaluk(e.target.value)}
                      className="bg-transparent flex-1 min-w-0 text-on-surface text-sm appearance-none focus:outline-none pr-6 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="">{district ? 'Select Taluk' : 'District first'}</option>
                      {availableTaluks.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 text-on-surface-variant pointer-events-none text-lg">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="text-sm text-on-error-container bg-error-container px-3.5 py-2.5 rounded-xl font-medium"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] bg-primary text-on-primary rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                <span>{submitting ? 'Saving Profile...' : 'Save Profile & Continue'}</span>
              </button>
            </form>
          ) : (
            /* Main Sign In / Single Sign Up View */
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">
                    {authMode === 'signin' ? 'Welcome Back' : 'Create & Save Account'}
                  </h2>
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                    {authMode === 'signin'
                      ? 'Sign in with Google or your saved email account'
                      : 'Sign up once — your profile stays saved for instant access'}
                  </p>
                </div>

                {/* Segmented Mode Switcher */}
                <div
                  role="tablist"
                  aria-label="Authentication Mode"
                  className="p-1 rounded-xl bg-surface-container flex items-center gap-1 self-start sm:self-auto shrink-0"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === 'signin'}
                    onClick={() => handleModeSwitch('signin')}
                    className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                      authMode === 'signin'
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === 'signup'}
                    onClick={() => handleModeSwitch('signup')}
                    className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                      authMode === 'signup'
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Sign Up Once
                  </button>
                </div>
              </div>

              {/* Google Sign-In Primary Action */}
              {canUseGoogleSignIn && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleGoogleSignIn()}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface text-sm sm:text-base font-bold flex items-center justify-center gap-3 shadow-sm hover:bg-surface-container-low active:scale-[0.99] transition-all disabled:opacity-60"
                  >
                    <GoogleLogoIcon />
                    <span>
                      {googleSubmitting ? 'Connecting to Google...' : 'Continue with Google'}
                    </span>
                  </button>

                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="h-px flex-1 bg-outline-variant/40" />
                    <span>or continue with email</span>
                    <span className="h-px flex-1 bg-outline-variant/40" />
                  </div>
                </>
              )}

              {authMode === 'signin' ? (
                <form onSubmit={handleSignInSubmit} autoComplete="on" className="flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="text-sm font-semibold text-on-surface block mb-1.5"
                    >
                      Email Address <span className="text-error">*</span>
                    </label>
                    <div className="flex items-center bg-surface-container-low rounded-xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-secondary">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2.5">
                        mail
                      </span>
                      <input
                        id="signin-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="bg-transparent flex-1 min-w-0 text-on-surface text-sm sm:text-base focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="signin-password"
                      className="text-sm font-semibold text-on-surface block mb-1.5"
                    >
                      Password <span className="text-error">*</span>
                    </label>
                    <div className="flex items-center bg-surface-container-low rounded-xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-secondary">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2.5">
                        lock
                      </span>
                      <input
                        id="signin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="bg-transparent flex-1 min-w-0 text-on-surface text-sm sm:text-base focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-on-surface-variant hover:text-primary -mr-1.5"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[40px]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span className="text-xs sm:text-sm text-on-surface-variant font-medium">
                      Save my login &amp; keep me signed in on this device
                    </span>
                  </label>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="text-sm text-on-error-container bg-error-container px-3.5 py-2.5 rounded-xl font-medium flex flex-col gap-2"
                    >
                      <span>{errorMsg}</span>
                      {errorAction === 'google' && canUseGoogleSignIn && (
                        <button
                          type="button"
                          onClick={() => void handleGoogleSignIn()}
                          className="self-start text-xs font-bold underline underline-offset-2 text-primary"
                        >
                          Continue with Google now
                        </button>
                      )}
                      {errorAction === 'signup' && (
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('signup')}
                          className="self-start text-xs font-bold underline underline-offset-2 text-primary"
                        >
                          New user? Sign Up Once &amp; Save this email
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[48px] bg-primary text-on-primary rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
                  >
                    <span>{submitting ? 'Signing In...' : 'Sign In & Continue'}</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>

                  <p className="text-xs text-center text-on-surface-variant">
                    First time on Kisan Sathi?{' '}
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('signup')}
                      className="text-primary font-bold underline underline-offset-2"
                    >
                      Sign Up Once &amp; Save
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleSignUpSubmit} autoComplete="on" className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="signup-fullname"
                        className="text-xs font-semibold text-on-surface block mb-1"
                      >
                        Full Name <span className="text-error">*</span>
                      </label>
                      <div className="flex items-center bg-surface-container-low rounded-xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-secondary">
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2">
                          person
                        </span>
                        <input
                          id="signup-fullname"
                          name="name"
                          type="text"
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your full name"
                          className="bg-transparent flex-1 min-w-0 text-on-surface text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="signup-email"
                        className="text-xs font-semibold text-on-surface block mb-1"
                      >
                        Email Address <span className="text-error">*</span>
                      </label>
                      <div className="flex items-center bg-surface-container-low rounded-xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-secondary">
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2">
                          mail
                        </span>
                        <input
                          id="signup-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="bg-transparent flex-1 min-w-0 text-on-surface text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="signup-password"
                      className="text-xs font-semibold text-on-surface block mb-1"
                    >
                      Create Password <span className="text-error">*</span>
                    </label>
                    <div className="flex items-center bg-surface-container-low rounded-xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-secondary">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2">
                        lock
                      </span>
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
                        className="bg-transparent flex-1 min-w-0 text-on-surface text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-on-surface-variant hover:text-primary -mr-1.5"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <span className="text-xs font-semibold text-on-surface block mb-1.5">
                      Category <span className="text-error">*</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {ROLES.map((role) => {
                        const selected = profession === role.value;
                        return (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => setProfession(role.value)}
                            className={`text-left rounded-xl p-2.5 border transition-all min-h-[44px] flex flex-col gap-0.5 ${
                              selected
                                ? 'bg-secondary-container/30 border-secondary text-primary shadow-sm'
                                : 'bg-surface-container-low border-transparent text-on-surface hover:border-outline-variant/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="material-symbols-outlined text-[18px]">
                                {role.icon}
                              </span>
                              {selected && (
                                <span className="material-symbols-outlined text-[16px] text-secondary material-symbols-filled">
                                  check_circle
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold block">{role.label}</span>
                            <span className="text-[11px] text-on-surface-variant leading-tight">
                              {role.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* State / District / Taluk */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label
                        htmlFor="signup-state"
                        className="text-xs font-semibold text-on-surface block mb-1"
                      >
                        State <span className="text-error">*</span>
                      </label>
                      <div className="relative flex items-center bg-surface-container-low rounded-xl px-3 h-11">
                        <select
                          id="signup-state"
                          required
                          value={state}
                          onChange={(e) => handleStateChange(e.target.value)}
                          className="bg-transparent flex-1 min-w-0 text-on-surface text-sm appearance-none focus:outline-none pr-5 cursor-pointer"
                        >
                          <option value="">Select State</option>
                          {INDIAN_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-lg">
                          expand_more
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="signup-district"
                        className="text-xs font-semibold text-on-surface block mb-1"
                      >
                        District <span className="text-error">*</span>
                      </label>
                      <div
                        className={`relative flex items-center rounded-xl px-3 h-11 bg-surface-container-low ${
                          !state ? 'opacity-60' : ''
                        }`}
                      >
                        <select
                          id="signup-district"
                          required
                          disabled={!state}
                          value={district}
                          onChange={(e) => handleDistrictChange(e.target.value)}
                          className="bg-transparent flex-1 min-w-0 text-on-surface text-sm appearance-none focus:outline-none pr-5 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="">{state ? 'Select District' : 'State first'}</option>
                          {availableDistricts.map((dist) => (
                            <option key={dist} value={dist}>
                              {dist}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-lg">
                          expand_more
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="signup-taluk"
                        className="text-xs font-semibold text-on-surface block mb-1"
                      >
                        Taluk <span className="text-error">*</span>
                      </label>
                      <div
                        className={`relative flex items-center rounded-xl px-3 h-11 bg-surface-container-low ${
                          !district ? 'opacity-60' : ''
                        }`}
                      >
                        <select
                          id="signup-taluk"
                          required
                          disabled={!district}
                          value={taluk}
                          onChange={(e) => setTaluk(e.target.value)}
                          className="bg-transparent flex-1 min-w-0 text-on-surface text-sm appearance-none focus:outline-none pr-5 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="">{district ? 'Select Taluk' : 'District first'}</option>
                          {availableTaluks.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-lg">
                          expand_more
                        </span>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[40px]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span className="text-xs sm:text-sm text-on-surface-variant font-medium">
                      Save my account &amp; keep me signed in on this device
                    </span>
                  </label>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="text-sm text-on-error-container bg-error-container px-3.5 py-2.5 rounded-xl font-medium flex flex-col gap-2"
                    >
                      <span>{errorMsg}</span>
                      {errorAction === 'signin' && (
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('signin')}
                          className="self-start text-xs font-bold underline underline-offset-2 text-primary"
                        >
                          Sign In with this email instead
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[48px] bg-primary text-on-primary rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    <span>{submitting ? 'Saving Account...' : 'Save & Create Account'}</span>
                  </button>

                  <p className="text-xs text-center text-on-surface-variant">
                    Already saved an account?{' '}
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
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
