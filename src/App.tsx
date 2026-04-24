import type {ReactNode} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {
  Check,
  ChevronDown,
  Clock3,
  History,
  LogOut,
  PencilLine,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {AuthSession, AuthUser} from '@supabase/supabase-js';
import {
  measurementDefinitions,
  measurementDefinitionsByKey,
} from './measurements';
import {
  getSupabaseBrowserClient,
  isSupabaseAuthConfigured,
  signInWithGoogle,
  signOutFromSupabase,
} from './supabase';
import {
  createProfile as createStoredProfile,
  deleteProfile as deleteStoredProfile,
  loadMeasurementHistory,
  loadProfileHeightHistory,
  loadProfiles,
  saveMeasurement as saveStoredMeasurement,
  updateProfile as updateStoredProfile,
  type MeasurementHistoryResponse,
  type ProfileHeightHistoryResponse,
} from './storage';
import {TechnicalMeasurementPlate} from './technicalPlate';
import {
  formatMeasurement,
  getCompletionSummary,
  getMeasurementValue,
  normalizeMeasurementInput,
  stripTrailingZeroes,
} from './utils';
import {
  getMeasurementMax,
  MAX_HEIGHT_CM,
  MAX_PROFILE_NAME_LENGTH,
  MIN_HEIGHT_CM,
} from './validation';
import type {MeasurementKey, MeasurementView, Profile, Sex, Unit} from './types';
import emptyStateNoProfileImage from './assets/empty-state-no-profile.png';
import mascotGuideImage from './assets/mascot-guide.png';
import mascotLoginSceneImage from './assets/mascot-login-scene.png';

type ApiStatus = 'loading' | 'ready' | 'offline';
type AuthStatus = 'loading' | 'signed_in' | 'signed_out' | 'config_error';

type DraftProfile = {
  name: string;
  sex: Sex;
  heightCm: string;
};

type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

type MeasurementGroup = {
  title: string;
  caption: string;
  keys: MeasurementKey[];
};

const elegantEase = [0.22, 1, 0.36, 1] as const;
const decisiveEase = [0.16, 1, 0.3, 1] as const;
const calmEase = [0.25, 1, 0.5, 1] as const;

const measurementGroups: MeasurementGroup[] = [
  {
    title: 'Head & neck',
    caption: 'Small measures that anchor every fit.',
    keys: ['hatSize', 'neck'],
  },
  {
    title: 'Torso',
    caption: 'The core reference for tops, dresses, and jackets.',
    keys: ['shoulderCircumference', 'bust', 'underBust', 'shoulder', 'back', 'torso', 'sleeveLength'],
  },
  {
    title: 'Waist & hip',
    caption: 'The balance line for trousers, skirts, and tailoring ease.',
    keys: ['waist', 'hips', 'rise'],
  },
  {
    title: 'Leg',
    caption: 'Length and contour records for lower garments.',
    keys: ['thigh', 'knee', 'outseam', 'inseam'],
  },
];

const fadeUpVariants = {
  hidden: {opacity: 0, y: 14},
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.34,
      ease: elegantEase,
      delay: index * 0.04,
    },
  }),
  exit: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 0.2,
      ease: decisiveEase,
    },
  },
};

const defaultDraftProfile: DraftProfile = {
  name: '',
  sex: 'female',
  heightCm: '',
};

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  if (normalized === '') {
    return '';
  }

  const firstDotIndex = normalized.indexOf('.');
  if (firstDotIndex === -1) {
    return normalized;
  }

  const integerPart = normalized.slice(0, firstDotIndex);
  const decimalPart = normalized.slice(firstDotIndex + 1).replace(/\./g, '');

  return `${integerPart || '0'}.${decimalPart}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getProfileInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'AT';
}

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    isSupabaseAuthConfigured ? 'loading' : 'config_error',
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<MeasurementView>('front');
  const [unit, setUnit] = useState<Unit>('cm');
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementKey | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState<DraftProfile>(defaultDraftProfile);
  const [profileModalMode, setProfileModalMode] = useState<'create' | 'edit'>('create');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isEditingMeasurement, setIsEditingMeasurement] = useState(false);
  const [isProfilesMenuOpen, setIsProfilesMenuOpen] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [profileSubmitError, setProfileSubmitError] = useState<string | null>(null);
  const [measurementSubmitError, setMeasurementSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('idle');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [measurementHistory, setMeasurementHistory] =
    useState<MeasurementHistoryResponse | null>(null);
  const [heightHistory, setHeightHistory] =
    useState<ProfileHeightHistoryResponse | null>(null);
  const hasLoadedProfilesRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const shouldHighlightAddProfile =
    apiStatus === 'ready' && profiles.length === 0 && !prefersReducedMotion;
  const currentMeasurement =
    selectedMeasurement && selectedProfile
      ? measurementDefinitionsByKey[selectedMeasurement]
      : null;

  const visibleDefinitions = useMemo(
    () => measurementDefinitions.filter((definition) => definition.view === currentView),
    [currentView],
  );
  const draftName = draftProfile.name.trim();
  const parsedHeightCm = Number(draftProfile.heightCm);
  const profileNameError = !draftName
    ? 'Enter a profile name.'
    : draftName.length > MAX_PROFILE_NAME_LENGTH
      ? `Name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer.`
      : null;
  const profileHeightError =
    draftProfile.heightCm.trim() === ''
      ? 'Enter a height.'
      : !Number.isFinite(parsedHeightCm)
        ? 'Height must be a valid number.'
        : parsedHeightCm < MIN_HEIGHT_CM || parsedHeightCm > MAX_HEIGHT_CM
          ? `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`
          : null;
  const canSaveProfile = !profileNameError && !profileHeightError;
  const parsedEditValue = editValue.trim() === '' ? 0 : Number(editValue);
  const measurementMax = getMeasurementMax(unit);
  const measurementError = !Number.isFinite(parsedEditValue)
    ? 'Enter a valid number.'
    : parsedEditValue < 0
      ? 'Value cannot be negative.'
      : parsedEditValue > measurementMax
        ? `Value must be ${measurementMax} ${unit} or less.`
        : null;
  const canSaveMeasurement = !measurementError;

  useEffect(() => {
    if (!isSupabaseAuthConfigured) {
      setAuthStatus('config_error');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function hydrateSession() {
      try {
        const {
          data: {session},
          error,
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (error) {
          throw error;
        }

        setAuthSession(session);
        setAuthUser(session?.user ?? null);
        setAuthStatus(session ? 'signed_in' : 'signed_out');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAuthSession(null);
        setAuthUser(null);
        setAuthStatus('signed_out');
        setAuthError(getErrorMessage(error, 'Unable to restore your session.'));
      }
    }

    void hydrateSession();

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
      setAuthUser(session?.user ?? null);
      setAuthStatus(session ? 'signed_in' : 'signed_out');
      if (session) {
        setAuthError(null);
      }
      setIsAuthPending(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isHistoryOpen || !selectedProfile || !selectedMeasurement) {
      return;
    }

    void handleOpenHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHistoryOpen, selectedMeasurement, selectedProfile?.id]);

  useEffect(() => {
    if (authStatus === 'signed_in') {
      return;
    }

    setProfiles([]);
    setSelectedProfileId(null);
    setSelectedMeasurement(null);
    setIsEditingMeasurement(false);
    setIsQuickAddOpen(false);
    setProfileModalMode('create');
    setEditingProfileId(null);
    setDraftProfile(defaultDraftProfile);
    setProfileSubmitError(null);
    setMeasurementSubmitError(null);
    setActionError(null);
    setServiceError(null);
    setApiStatus('ready');
    hasLoadedProfilesRef.current = false;
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== 'signed_in') {
      return;
    }

    let cancelled = false;

    async function hydrateProfiles() {
      setApiStatus('loading');
      setServiceError(null);

      try {
        const nextProfiles = await loadProfiles();

        if (cancelled) {
          return;
        }

        setProfiles(nextProfiles);
        setApiStatus('ready');
        setActionError(null);
        setSelectedProfileId((current) => {
          if (current && nextProfiles.some((profile) => profile.id === current)) {
            return current;
          }

          return nextProfiles[0]?.id ?? null;
        });

        if (!hasLoadedProfilesRef.current && nextProfiles.length === 0) {
          setIsQuickAddOpen(true);
        }

        hasLoadedProfilesRef.current = true;
      } catch (error) {
        if (cancelled) {
          return;
        }

        setProfiles([]);
        setSelectedProfileId(null);
        setSelectedMeasurement(null);
        setIsEditingMeasurement(false);
        setIsQuickAddOpen(false);
        setApiStatus('offline');
        setServiceError(
          getErrorMessage(error, 'Unable to reach the local data service.'),
        );
      }
    }

    void hydrateProfiles();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    if (!selectedProfile) {
      setSelectedMeasurement(null);
      setIsEditingMeasurement(false);
      return;
    }

    const selectedDefinition = selectedMeasurement
      ? measurementDefinitionsByKey[selectedMeasurement]
      : null;

    if (selectedMeasurement && !selectedDefinition) {
      setSelectedMeasurement(null);
      setIsEditingMeasurement(false);
      return;
    }

    if (selectedDefinition && selectedDefinition.view !== currentView) {
      setSelectedMeasurement(null);
      setIsEditingMeasurement(false);
    }
  }, [currentView, selectedMeasurement, selectedProfile]);

  function handleStartCreatingProfile() {
    setProfileSubmitError(null);
    setDraftProfile(defaultDraftProfile);
    setProfileModalMode('create');
    setEditingProfileId(null);
    setIsQuickAddOpen(true);
  }

  async function handleSignIn() {
    setAuthError(null);
    setIsAuthPending(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(getErrorMessage(error, 'Unable to start Google sign-in.'));
      setIsAuthPending(false);
    }
  }

  async function handleSignOut() {
    setAuthError(null);
    setIsAuthPending(true);

    try {
      await signOutFromSupabase();
    } catch (error) {
      setAuthError(getErrorMessage(error, 'Unable to sign out right now.'));
      setIsAuthPending(false);
    }
  }

  function handleStartEditingProfile(profileId: string) {
    const profile = profiles.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

    setProfileSubmitError(null);
    setDraftProfile({
      name: profile.name,
      sex: profile.sex,
      heightCm: stripTrailingZeroes(profile.heightCm),
    });
    setEditingProfileId(profile.id);
    setProfileModalMode('edit');
    setIsQuickAddOpen(true);
    setIsProfilesMenuOpen(false);
  }

  async function handleSaveProfileDetails() {
    if (!canSaveProfile || isSavingProfile) {
      return;
    }

    const heightCm = Number(draftProfile.heightCm);
    const payload = {
      heightCm,
      name: draftName,
      sex: draftProfile.sex,
    };

    setProfileSubmitError(null);
    setActionError(null);
    setIsSavingProfile(true);

    try {
      if (profileModalMode === 'create' || !editingProfileId) {
        const nextProfile = await createStoredProfile(payload);

        setProfiles((current) => [nextProfile, ...current]);
        setSelectedProfileId(nextProfile.id);
        setCurrentView('front');
        setSelectedMeasurement(null);
        setIsEditingMeasurement(false);
      } else {
        const updatedProfile = await updateStoredProfile(editingProfileId, payload);

        setProfiles((current) =>
          current.map((profile) =>
            profile.id === editingProfileId ? updatedProfile : profile,
          ),
        );
      }

      setIsQuickAddOpen(false);
      setProfileModalMode('create');
      setEditingProfileId(null);
      setDraftProfile(defaultDraftProfile);
    } catch (error) {
      setProfileSubmitError(getErrorMessage(error, 'Unable to save profile.'));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleDeleteProfile(profileId: string) {
    if (deletingProfileId === profileId) {
      return;
    }

    const profile = profiles.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

    const confirmed = window.confirm(`Delete ${profile.name}'s profile?`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeletingProfileId(profileId);

    try {
      await deleteStoredProfile(profileId);

      const remainingProfiles = profiles.filter((entry) => entry.id !== profileId);
      setProfiles(remainingProfiles);

      if (selectedProfileId === profileId) {
        setSelectedProfileId(remainingProfiles[0]?.id ?? null);
        setSelectedMeasurement(null);
        setIsEditingMeasurement(false);
      }

      if (editingProfileId === profileId) {
        setIsQuickAddOpen(false);
        setProfileModalMode('create');
        setEditingProfileId(null);
        setDraftProfile(defaultDraftProfile);
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to delete profile.'));
    } finally {
      setDeletingProfileId(null);
    }
  }

  function handleSelectProfile(profileId: string) {
    setActionError(null);
    setSelectedProfileId(profileId);
    setCurrentView('front');
    setSelectedMeasurement(null);
    setIsEditingMeasurement(false);
    setIsHistoryOpen(false);
    setIsProfilesMenuOpen(false);
  }

  function handleSelectMeasurement(measurementKey: MeasurementKey) {
    setMeasurementSubmitError(null);
    setCurrentView(measurementDefinitionsByKey[measurementKey].view);
    setSelectedMeasurement(measurementKey);
    setIsEditingMeasurement(false);
  }

  async function handleOpenHistory() {
    if (!selectedProfile || !selectedMeasurement) {
      return;
    }

    const measurementKey = selectedMeasurement;
    setIsHistoryOpen(true);
    setHistoryStatus('loading');
    setHistoryError(null);

    try {
      const [nextMeasurementHistory, nextHeightHistory] = await Promise.all([
        loadMeasurementHistory(selectedProfile.id, measurementKey),
        loadProfileHeightHistory(selectedProfile.id),
      ]);

      setMeasurementHistory(nextMeasurementHistory);
      setHeightHistory(nextHeightHistory);
      setHistoryStatus('ready');
    } catch (error) {
      setMeasurementHistory(null);
      setHeightHistory(null);
      setHistoryError(getErrorMessage(error, 'Unable to load fitting history.'));
      setHistoryStatus('error');
    }
  }

  function handleStartEditing(measurementKey?: MeasurementKey) {
    if (!selectedProfile) {
      return;
    }

    const targetMeasurementKey = measurementKey ?? selectedMeasurement;
    if (!targetMeasurementKey) {
      return;
    }

    setMeasurementSubmitError(null);
    setSelectedMeasurement(targetMeasurementKey);

    const value = getMeasurementValue(selectedProfile, targetMeasurementKey, unit);
    setEditValue(value === 0 ? '' : stripTrailingZeroes(value));
    setIsEditingMeasurement(true);
  }

  async function handleSaveMeasurement() {
    if (!selectedProfile || !selectedMeasurement || isSavingMeasurement) {
      return;
    }

    if (!canSaveMeasurement) {
      return;
    }

    const normalizedValue = normalizeMeasurementInput(parsedEditValue, unit);
    const valueCm = Number(normalizedValue.toFixed(2));

    setMeasurementSubmitError(null);
    setActionError(null);
    setIsSavingMeasurement(true);

    try {
      const updatedProfile = await saveStoredMeasurement(
        selectedProfile.id,
        selectedMeasurement,
        valueCm,
      );

      setProfiles((current) =>
        current.map((profile) =>
          profile.id === selectedProfile.id ? updatedProfile : profile,
        ),
      );
      setIsEditingMeasurement(false);
    } catch (error) {
      setMeasurementSubmitError(getErrorMessage(error, 'Unable to save measurement.'));
    } finally {
      setIsSavingMeasurement(false);
    }
  }

  if (authStatus === 'loading') {
    return (
      <AuthStateScreen
        body="Restoring your secure workspace and laying out the fitting room for your household profiles."
        eyebrow="Private fitting room"
        illustrationAlt="The Atelier mascot preparing to guide the fitting workspace."
        illustrationSrc={mascotGuideImage}
        noteBody="Once you're in, profiles keep each family member’s measurements organized separately."
        noteTitle="Atelier note"
        title="Preparing your atelier"
      />
    );
  }

  if (authStatus === 'config_error') {
    return (
      <AuthStateScreen
        eyebrow="Configuration needed"
        illustrationAlt="The Atelier mascot presenting a setup tip."
        illustrationSrc={mascotGuideImage}
        noteBody="Add the Supabase values once, and the private wardrobe workspace will be ready after restart."
        noteTitle="Atelier note"
        body="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file before starting the app."
        title="Supabase Auth is not configured"
      />
    );
  }

  if (authStatus === 'signed_out') {
    return (
      <AuthStateScreen
        action={
          <div className="relative inline-flex">
            {!isAuthPending && !prefersReducedMotion ? (
              <>
                <motion.span
                  aria-hidden="true"
                  animate={{
                    opacity: [0, 0.5, 0],
                    scale: [0.92, 1.1, 1.18],
                  }}
                  className="pointer-events-none absolute inset-[-0.38rem] rounded-full border border-secondary/45"
                  transition={{
                    duration: 2,
                    ease: calmEase,
                    repeat: Infinity,
                    repeatDelay: 0.28,
                  }}
                />
                <motion.span
                  aria-hidden="true"
                  animate={{
                    opacity: [0.18, 0.34, 0.18],
                  }}
                  className="pointer-events-none absolute inset-[-0.28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(253,220,152,0.34),transparent_68%)] blur-[12px]"
                  transition={{
                    duration: 1.7,
                    ease: calmEase,
                    repeat: Infinity,
                    repeatType: 'mirror',
                  }}
                />
                <motion.span
                  aria-hidden="true"
                  animate={{
                    opacity: [0, 0.3, 0],
                    x: ['-135%', '135%', '135%'],
                  }}
                  className="pointer-events-none absolute inset-y-[0.1rem] left-0 w-12 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)] blur-[1px]"
                  transition={{
                    duration: 2.6,
                    ease: calmEase,
                    repeat: Infinity,
                    repeatDelay: 1.1,
                  }}
                />
              </>
            ) : null}
            <motion.button
              animate={{
                boxShadow:
                  !isAuthPending && !prefersReducedMotion
                    ? '0 18px 34px -18px rgba(3,25,46,0.84)'
                    : '0 18px 32px -22px rgba(3,25,46,0.8)',
              }}
              className="type-button relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-5 py-3 text-white shadow-[0_18px_32px_-22px_rgba(3,25,46,0.8)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAuthPending}
              onClick={() => void handleSignIn()}
              transition={{duration: 0.3, ease: calmEase}}
              type="button"
            >
              <motion.span
                animate={
                  !isAuthPending && !prefersReducedMotion
                    ? {
                        rotate: [0, 0, 10, 0],
                        scale: [1, 1, 1.08, 1],
                        y: [0, 0, -1, 0],
                      }
                    : {rotate: 0, scale: 1, y: 0}
                }
                className="inline-flex h-5 w-5 items-center justify-center"
                transition={
                  !isAuthPending && !prefersReducedMotion
                    ? {
                      duration: 2.4,
                      ease: calmEase,
                        repeat: Infinity,
                        repeatDelay: 0.9,
                      }
                    : {duration: 0.2}
                }
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 18 18"
                >
                  <path
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.32 0 2.5.45 3.43 1.33l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
                    fill="#EA4335"
                  />
                </svg>
              </motion.span>
              <span>{isAuthPending ? 'Redirecting to Google…' : 'Continue with Google'}</span>
            </motion.button>
          </div>
        }
        actionPlacement="illustration"
        body="Sign in with Google to access a calm, private fitting room for your household measurements."
        eyebrow="Household wardrobe reference"
        error={authError}
        illustrationAlt="The Atelier mascot welcoming the user into a refined fitting room."
        illustrationSrc={mascotLoginSceneImage}
        title="Sign in to The Atelier"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(253,220,152,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.55),_transparent_45%)]" />
      <header className="sticky top-0 z-30 border-b border-outline-variant/10 bg-background/80 backdrop-blur-[20px]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <p className="type-overline text-secondary">
              Household Wardrobe Reference
            </p>
            <h1 className="type-title text-primary">The Atelier</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="group relative">
              <button
                aria-label={isAuthPending ? 'Signing out' : 'Sign out'}
                className="type-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-outline-variant/16 bg-surface px-3 py-2.5 text-primary shadow-[0_16px_30px_-24px_rgba(3,25,46,0.45)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                disabled={isAuthPending}
                onClick={() => void handleSignOut()}
                type="button"
              >
                <LogOut size={16} />
                <span className="hidden md:inline">
                  {isAuthPending ? 'Signing out…' : 'Sign out'}
                </span>
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 min-w-max -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white opacity-0 shadow-[0_14px_24px_-18px_rgba(3,25,46,0.9)] transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                Sign out
              </div>
            </div>
            <ProfileSwitcher
              deletingProfileId={deletingProfileId}
              onDeleteProfile={handleDeleteProfile}
              onEditProfile={handleStartEditingProfile}
              onCreateProfile={handleStartCreatingProfile}
              onClose={() => setIsProfilesMenuOpen(false)}
              isOpen={isProfilesMenuOpen}
              onSelectProfile={handleSelectProfile}
              onToggle={() => setIsProfilesMenuOpen((current) => !current)}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
            />
            {profiles.length === 0 ? (
              <div className="relative">
                {shouldHighlightAddProfile ? (
                  <>
                    <motion.span
                      aria-hidden="true"
                      animate={{
                        opacity: [0, 0.5, 0],
                        scale: [0.92, 1.1, 1.18],
                      }}
                      className="pointer-events-none absolute inset-[-0.38rem] rounded-full border border-secondary/45"
                      transition={{
                        duration: 2,
                        ease: calmEase,
                        repeat: Infinity,
                        repeatDelay: 0.28,
                      }}
                    />
                    <motion.span
                      aria-hidden="true"
                      animate={{
                        opacity: [0.18, 0.34, 0.18],
                      }}
                      className="pointer-events-none absolute inset-[-0.28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(253,220,152,0.34),transparent_68%)] blur-[12px]"
                      transition={{
                        duration: 1.7,
                        ease: calmEase,
                        repeat: Infinity,
                        repeatType: 'mirror',
                      }}
                    />
                    <motion.span
                      aria-hidden="true"
                      animate={{
                        opacity: [0, 0.3, 0],
                        x: ['-135%', '135%', '135%'],
                      }}
                      className="pointer-events-none absolute inset-y-[0.1rem] left-0 w-12 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)] blur-[1px]"
                      transition={{
                        duration: 2.6,
                        ease: calmEase,
                        repeat: Infinity,
                        repeatDelay: 1.1,
                      }}
                    />
                  </>
                ) : null}
                <motion.button
                  animate={{
                    boxShadow: shouldHighlightAddProfile
                      ? '0 18px 34px -18px rgba(3,25,46,0.84)'
                      : '0 16px 30px -18px rgba(3,25,46,0.75)',
                  }}
                  className="type-button relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-4 py-2.5 text-white shadow-[0_16px_30px_-18px_rgba(3,25,46,0.75)] transition-transform active:scale-[0.98]"
                  onClick={handleStartCreatingProfile}
                  transition={{duration: 0.3, ease: calmEase}}
                  type="button"
                >
                  <motion.span
                    animate={
                      shouldHighlightAddProfile
                        ? {rotate: [0, 0, 14, 0], scale: [1, 1, 1.08, 1]}
                        : {rotate: 0, scale: 1}
                    }
                    className="inline-flex"
                    transition={
                      shouldHighlightAddProfile
                        ? {
                            duration: 2.4,
                            ease: calmEase,
                            repeat: Infinity,
                            repeatDelay: 0.9,
                          }
                        : {duration: 0.2}
                    }
                  >
                    <Plus size={16} />
                  </motion.span>
                  <span>Add profile</span>
                </motion.button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[96rem] px-4 py-6 md:px-8 md:py-8">
        <section className="min-h-[42rem] rounded-[2.4rem] bg-surface/92 p-5 shadow-[0_12px_32px_-4px_rgba(26,28,25,0.06)] ring-1 ring-outline-variant/12 md:p-7">
          {apiStatus === 'loading' ? (
            <SubtleWorkspaceSkeleton />
          ) : apiStatus === 'offline' ? (
            <IllustratedStatePanel
              action={
                <button
                  className="type-button mt-6 inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-5 py-3 text-white shadow-[0_18px_32px_-22px_rgba(3,25,46,0.8)]"
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  Retry connection
                </button>
              }
              body={
                serviceError ??
                'The local data service is unavailable. Start it with pnpm dev, then retry.'
              }
              eyebrow="Connection needed"
              illustrationAlt="The Atelier mascot presenting a gentle connection reminder."
              illustrationSrc={mascotGuideImage}
              noteBody="If you are working locally, start the app services first and then retry this page."
              noteTitle="Atelier note"
              title="Data service offline"
            />
          ) : selectedProfile ? (
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={{opacity: 1, y: 0}}
                exit={
                  prefersReducedMotion
                    ? {opacity: 0}
                    : {opacity: 0, y: 12, transition: {duration: 0.18, ease: decisiveEase}}
                }
                initial={prefersReducedMotion ? {opacity: 0} : {opacity: 0, y: 18}}
                key={selectedProfile.id}
                transition={
                  prefersReducedMotion
                    ? {duration: 0.01}
                    : {duration: 0.34, ease: elegantEase}
                }
              >
                <ProfileWorkspace
                  currentMeasurement={currentMeasurement}
                  currentView={currentView}
                  onOpenHistory={handleOpenHistory}
                  onSelectMeasurement={handleSelectMeasurement}
                  onSetCurrentView={setCurrentView}
                  onStartEditing={handleStartEditing}
                  onToggleUnit={() => setUnit((current) => (current === 'cm' ? 'in' : 'cm'))}
                  profile={selectedProfile}
                  selectedMeasurement={selectedMeasurement}
                  unit={unit}
                  visibleDefinitions={visibleDefinitions}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <IllustratedStatePanel
              body="The atelier crew is ready for its first fitting. Add a family profile to start capturing front and back measurements."
              illustrationFrame="cutout"
              illustrationSize="hero"
              eyebrow="First fitting"
              illustrationAlt="Playful atelier helpers searching for the first profile card."
              illustrationSrc={emptyStateNoProfileImage}
              title="No profiles yet"
            />
          )}

          {actionError ? (
            <div className="type-note mt-6 rounded-[1.5rem] bg-secondary-container/28 px-4 py-3 text-secondary">
              {actionError}
            </div>
          ) : null}
        </section>
      </main>

      <AnimatePresence>
        {isHistoryOpen && selectedProfile && selectedMeasurement ? (
          <HistoryDrawer
            heightHistory={heightHistory}
            measurementHistory={measurementHistory}
            onClose={() => setIsHistoryOpen(false)}
            profile={selectedProfile}
            selectedMeasurement={measurementDefinitionsByKey[selectedMeasurement]}
            status={historyStatus}
            error={historyError}
            unit={unit}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isQuickAddOpen && (
          <ProfileDetailsModal
            canSaveProfile={canSaveProfile && !isSavingProfile}
            draftProfile={draftProfile}
            isSavingProfile={isSavingProfile}
            profileHeightError={profileHeightError}
            profileNameError={profileNameError}
            mode={profileModalMode}
            onChangeDraftProfile={setDraftProfile}
            onClose={() => {
              setProfileSubmitError(null);
              setIsQuickAddOpen(false);
              setProfileModalMode('create');
              setEditingProfileId(null);
              setDraftProfile(defaultDraftProfile);
            }}
            onSaveProfile={() => {
              void handleSaveProfileDetails();
            }}
            saveError={profileSubmitError}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingMeasurement && currentMeasurement && (
          <MeasurementEditModal
            canSaveMeasurement={canSaveMeasurement && !isSavingMeasurement}
            currentMeasurement={currentMeasurement}
            editValue={editValue}
            isSavingMeasurement={isSavingMeasurement}
            measurementError={measurementError}
            onChangeEditValue={setEditValue}
            onClose={() => {
              setMeasurementSubmitError(null);
              setIsEditingMeasurement(false);
            }}
            onSaveMeasurement={() => {
              void handleSaveMeasurement();
            }}
            saveError={measurementSubmitError}
            unit={unit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SubtleWorkspaceSkeleton() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="relative min-h-[32rem] overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,rgba(244,244,239,0.54),rgba(250,250,245,0.78))] p-5 ring-1 ring-outline-variant/8 md:min-h-[35rem] md:p-6"
    >
      <motion.div
        animate={
          prefersReducedMotion
            ? {opacity: 0.16, x: '0%'}
            : {
                opacity: [0.14, 0.28, 0.14],
                x: ['-8%', '6%', '-8%'],
              }
        }
        className="pointer-events-none absolute inset-y-0 left-[-18%] w-[42%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)] blur-2xl"
        transition={{
          duration: prefersReducedMotion ? 0.01 : 2.8,
          ease: calmEase,
          repeat: prefersReducedMotion ? 0 : Infinity,
          repeatType: 'loop',
        }}
      />

      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(180deg,rgba(244,244,239,0.88),rgba(250,250,245,0.96))] p-4 ring-1 ring-outline-variant/12 md:p-6 xl:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(253,220,152,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(3,25,46,0.04),transparent_28%)]" />

          <div className="relative mx-auto max-w-4xl">
            <div className="rounded-[2rem] bg-white/40 p-4 ring-1 ring-white/30 md:p-6">
              <div className="mx-auto min-h-[24rem] w-full max-w-[30rem] rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(244,244,239,0.48))] ring-1 ring-outline-variant/10 sm:min-h-[30rem]">
                <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
                  <div className="h-5 w-28 rounded-full bg-primary/10" />
                  <div className="h-28 w-28 rounded-full bg-primary/8" />
                  <div className="space-y-3 text-center">
                    <div className="mx-auto h-4 w-44 rounded-full bg-primary/10" />
                    <div className="mx-auto h-4 w-32 rounded-full bg-primary/8" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[1.9rem] bg-white/74 p-5 ring-1 ring-outline-variant/12">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded-full bg-primary/8" />
                  <div className="h-4 w-[22rem] max-w-full rounded-full bg-primary/10" />
                </div>
                <div className="h-10 w-32 rounded-full bg-secondary-container/34" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2.2rem] bg-surface-container-low/78 p-4 ring-1 ring-outline-variant/10 md:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-3">
              <div className="h-3 w-28 rounded-full bg-primary/8" />
              <div className="h-9 w-60 max-w-full rounded-full bg-primary/10" />
            </div>
            <div className="h-9 w-28 rounded-full bg-white/70" />
          </div>

          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {Array.from({length: 6}).map((_, index) => (
              <div
                className="rounded-[1.45rem] bg-white/60 px-4 py-4 ring-1 ring-outline-variant/8"
                key={index}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="h-3 w-16 rounded-full bg-primary/8" />
                    <div className="h-4 w-24 rounded-full bg-primary/10" />
                  </div>
                  <div className="space-y-3 text-right">
                    <div className="h-6 w-16 rounded-full bg-primary/10" />
                    <div className="h-3 w-12 rounded-full bg-primary/8" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 h-14 w-full rounded-full bg-surface-container-high/72" />
        </div>
      </div>
    </div>
  );
}

function AuthStateScreen({
  action,
  actionPlacement = 'content',
  body,
  eyebrow,
  error,
  illustrationAlt,
  illustrationSrc,
  noteBody,
  noteTitle,
  title,
}: {
  action?: ReactNode;
  actionPlacement?: 'content' | 'illustration';
  body: string;
  eyebrow?: string;
  error?: string | null;
  illustrationAlt?: string;
  illustrationSrc?: string;
  noteBody?: string;
  noteTitle?: string;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-on-surface md:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(253,220,152,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.55),_transparent_45%)]" />
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2.4rem] bg-surface/92 shadow-[0_12px_32px_-4px_rgba(26,28,25,0.06)] ring-1 ring-outline-variant/12">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="flex flex-col justify-center p-8 md:p-10 lg:p-12">
              <div className="mb-8">
                <p className="type-overline text-secondary">
                  {eyebrow ?? 'Protected workspace'}
                </p>
                <h1 className="type-title mt-3 text-primary">{title}</h1>
                <p className="type-body mt-5 text-on-surface-variant">{body}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.6rem] bg-surface-container-low/92 p-4 ring-1 ring-outline-variant/10">
                  <p className="type-label text-on-surface-variant">Profiles</p>
                  <p className="type-note mt-2 text-primary">One for each family member.</p>
                </div>
                <div className="rounded-[1.6rem] bg-surface-container-low/92 p-4 ring-1 ring-outline-variant/10">
                  <p className="type-label text-on-surface-variant">Views</p>
                  <p className="type-note mt-2 text-primary">Front and back, kept in step.</p>
                </div>
                <div className="rounded-[1.6rem] bg-surface-container-low/92 p-4 ring-1 ring-outline-variant/10">
                  <p className="type-label text-on-surface-variant">Units</p>
                  <p className="type-note mt-2 text-primary">Switch cm or in whenever needed.</p>
                </div>
              </div>

              {action && actionPlacement === 'content' ? <div className="mt-8">{action}</div> : null}
              {error ? (
                <div className="type-note mt-6 rounded-[1.5rem] bg-secondary-container/28 px-4 py-3 text-secondary">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(244,244,239,0.84),rgba(250,250,245,0.98))] p-6 md:p-8 lg:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(253,220,152,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(3,25,46,0.08),transparent_30%)]" />
              <div className="pointer-events-none absolute right-[10%] top-[12%] h-24 w-24 rounded-full bg-secondary-container/18 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[20%] left-[8%] h-28 w-28 rounded-full bg-primary/6 blur-3xl" />
              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="relative flex min-h-[18rem] items-center justify-center px-2 pt-2 md:min-h-[22rem] md:px-4 lg:min-h-[24rem]">
                  <div className="pointer-events-none absolute bottom-[8%] left-1/2 h-10 w-[60%] -translate-x-1/2 rounded-full bg-[rgba(3,25,46,0.08)] blur-2xl" />
                  {illustrationSrc ? (
                    <img
                      alt={illustrationAlt ?? ''}
                      className="relative mx-auto w-full max-w-[31rem] drop-shadow-[0_24px_42px_rgba(3,25,46,0.16)]"
                      src={illustrationSrc}
                    />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/8 text-primary">
                      <ShieldCheck size={28} />
                    </div>
                  )}
                </div>

                {action && actionPlacement === 'illustration' ? (
                  <div className="flex justify-center lg:-mt-6">
                    {action}
                  </div>
                ) : null}

                {noteBody ? (
                  <div className="max-w-md rounded-[1.8rem] bg-primary px-5 py-5 text-white shadow-[0_22px_44px_-30px_rgba(3,25,46,0.75)] lg:-mt-8">
                    <p className="type-overline text-white/64">{noteTitle ?? 'Atelier note'}</p>
                    <p className="type-note mt-3 text-white/82">{noteBody}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function IllustratedStatePanel({
  action,
  body,
  eyebrow,
  illustrationAlt,
  illustrationFrame = 'card',
  illustrationSize = 'default',
  illustrationSrc,
  noteBody,
  noteTitle,
  title,
}: {
  action?: ReactNode;
  body: string;
  eyebrow?: string;
  illustrationAlt: string;
  illustrationFrame?: 'card' | 'cutout';
  illustrationSize?: 'default' | 'hero';
  illustrationSrc: string;
  noteBody?: string;
  noteTitle?: string;
  title: string;
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-[2rem] bg-surface-container-low p-5 md:p-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(17rem,22rem)] lg:items-center">
        <div className="order-2 text-left lg:order-1">
          <p className="type-overline text-secondary">{eyebrow ?? 'Atelier guidance'}</p>
          <h2 className="type-section-title mt-3 text-primary">{title}</h2>
          <p className="type-body mt-4 text-on-surface-variant">{body}</p>
          {action}
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          {illustrationFrame === 'cutout' ? (
            <div
              className={`relative flex items-center justify-center px-2 py-4 ${
                illustrationSize === 'hero'
                  ? 'min-h-[19rem] sm:min-h-[23rem] lg:min-h-[25rem]'
                  : 'min-h-[16rem] sm:min-h-[18rem]'
              }`}
            >
              <div
                className={`pointer-events-none absolute bottom-[10%] left-1/2 -translate-x-1/2 rounded-full bg-[rgba(3,25,46,0.06)] blur-2xl ${
                  illustrationSize === 'hero' ? 'h-10 w-[68%]' : 'h-8 w-[56%]'
                }`}
              />
              <img
                alt={illustrationAlt}
                className={`relative mx-auto w-full drop-shadow-[0_20px_36px_rgba(3,25,46,0.12)] ${
                  illustrationSize === 'hero'
                    ? 'max-w-[22rem] sm:max-w-[26rem] lg:max-w-[28rem]'
                    : 'max-w-[18rem] sm:max-w-[21rem]'
                }`}
                src={illustrationSrc}
              />
            </div>
          ) : (
            <div className="rounded-[2rem] bg-white/64 p-4 ring-1 ring-white/50 shadow-[0_20px_36px_-30px_rgba(3,25,46,0.35)]">
              <img
                alt={illustrationAlt}
                className="mx-auto w-full max-w-[18rem] drop-shadow-[0_18px_36px_rgba(3,25,46,0.08)] sm:max-w-[21rem]"
                src={illustrationSrc}
              />
            </div>
          )}
          {noteBody ? (
            <div className="rounded-[1.8rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(244,244,239,0.9))] px-5 py-4 ring-1 ring-outline-variant/12">
              <p className="type-overline text-on-surface-variant">{noteTitle ?? 'Atelier note'}</p>
              <p className="type-note mt-3 text-primary/82">{noteBody}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AtelierTipCard({
  accent,
  body,
  imageAlt,
  imageSrc,
  title,
}: {
  accent: string;
  body: string;
  imageAlt: string;
  imageSrc: string;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(244,244,239,0.86))] ring-1 ring-outline-variant/12 shadow-[0_16px_34px_-30px_rgba(3,25,46,0.3)]">
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_13rem] md:items-center md:p-6">
        <div>
          <p className="type-overline text-secondary">Atelier note</p>
          <h3 className="type-ui mt-3 text-primary">{title}</h3>
          <p className="type-note mt-2 text-on-surface-variant">{body}</p>
          <div className="type-button mt-4 inline-flex rounded-full bg-secondary-container/44 px-4 py-2 text-secondary">
            {accent}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[10rem] md:max-w-[11.5rem]">
          <div className="pointer-events-none absolute inset-x-6 bottom-2 h-6 rounded-full bg-secondary-container/30 blur-2xl" />
          <img
            alt={imageAlt}
            className="relative mx-auto w-full"
            src={imageSrc}
          />
        </div>
      </div>
    </div>
  );
}

function ProfileSwitcher({
  deletingProfileId,
  onCreateProfile,
  onDeleteProfile,
  onEditProfile,
  isOpen,
  onClose,
  onSelectProfile,
  onToggle,
  profiles,
  selectedProfileId,
}: {
  deletingProfileId: string | null;
  onCreateProfile: () => void;
  onDeleteProfile: (profileId: string) => void;
  onEditProfile: (profileId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onSelectProfile: (profileId: string) => void;
  onToggle: () => void;
  profiles: Profile[];
  selectedProfileId: string | null;
}) {
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="type-button inline-flex min-w-[11rem] items-center justify-between gap-3 rounded-full bg-surface px-4 py-2.5 text-primary ring-1 ring-outline-variant/12 shadow-[0_10px_25px_-22px_rgba(3,25,46,0.7)] transition-transform active:scale-[0.98]"
        onClick={onToggle}
        title={selectedProfile ? selectedProfile.name : undefined}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-container/44 text-[0.68rem] font-bold tracking-[0.12em] text-secondary">
            {selectedProfile ? getProfileInitials(selectedProfile.name) : <Users size={14} />}
          </span>
          <span className="truncate">
            {selectedProfile ? selectedProfile.name : profiles.length === 0 ? 'No profiles' : 'Profiles'}
          </span>
        </span>
        <motion.span
          animate={{rotate: isOpen ? 180 : 0}}
          transition={
            prefersReducedMotion
              ? {duration: 0.01}
              : {duration: 0.22, ease: elegantEase}
          }
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && profiles.length > 0 ? (
          <motion.div
            animate="visible"
            className="absolute right-0 z-40 mt-3 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.8rem] bg-background/98 p-3 shadow-[0_24px_60px_-32px_rgba(3,25,46,0.34)] ring-1 ring-outline-variant/12 backdrop-blur-md"
            exit="exit"
            initial="hidden"
            variants={
              prefersReducedMotion
                ? {
                    hidden: {opacity: 0},
                    visible: {opacity: 1, transition: {duration: 0.01}},
                    exit: {opacity: 0, transition: {duration: 0.01}},
                  }
                : {
                    hidden: {opacity: 0, y: -8, scale: 0.985},
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        duration: 0.24,
                        ease: elegantEase,
                        when: 'beforeChildren',
                        staggerChildren: 0.04,
                      },
                    },
                    exit: {
                      opacity: 0,
                      y: -6,
                      scale: 0.99,
                      transition: {duration: 0.16, ease: decisiveEase},
                    },
                  }
            }
          >
            <motion.div className="px-3 pb-3 pt-1" variants={fadeUpVariants}>
              <p className="type-overline text-on-surface-variant">
                Household archive
              </p>
              <p className="type-note mt-1 text-primary/72">
                Choose the fitting card to open.
              </p>
            </motion.div>
            <div className="space-y-2">
              {profiles.map((profile, index) => {
                const isActive = selectedProfileId === profile.id;
                const filled = measurementDefinitions.filter(
                  (definition) => profile.measurements[definition.key] > 0,
                ).length;

                return (
                  <motion.div
                    className={`relative overflow-hidden rounded-[1.35rem] p-3 transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-[0_18px_34px_-25px_rgba(3,25,46,0.74)]'
                        : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(244,244,239,0.72))] text-primary hover:bg-white ring-1 ring-outline-variant/8'
                    }`}
                    key={profile.id}
                    layout
                    variants={fadeUpVariants}
                    custom={index + 1}
                  >
                    <div className="pointer-events-none absolute right-3 top-3 h-12 w-12 rounded-full border border-current/10" />
                    <button
                      className="flex w-full min-w-0 items-start gap-3 text-left"
                      onClick={() => onSelectProfile(profile.id)}
                      type="button"
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-headline text-[1.2rem] font-semibold ${
                          isActive ? 'bg-white/12 text-white' : 'bg-secondary-container/48 text-secondary'
                        }`}
                      >
                        {getProfileInitials(profile.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="type-section-title max-w-full break-words text-[1.55rem] leading-[0.95]">
                          {profile.name}
                        </p>
                        <p
                          className={`type-label mt-1 ${
                            isActive ? 'text-white/65' : 'text-on-surface-variant'
                          }`}
                        >
                          {profile.sex} • {stripTrailingZeroes(profile.heightCm)} cm
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`type-button rounded-full px-3 py-1 ${isActive ? 'bg-white/12 text-white/78' : 'bg-surface-container-low text-secondary'}`}>
                            {filled} of {measurementDefinitions.length} filled
                          </span>
                          <span className={`type-button rounded-full px-3 py-1 ${isActive ? 'bg-white/12 text-white/78' : 'bg-surface-container-low text-primary/56'}`}>
                            {formatDateTime(profile.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {isActive ? (
                          <motion.div
                            animate={{opacity: 1, scale: 1}}
                            className="pt-1"
                            exit={{opacity: 0, scale: 0.7}}
                            initial={{opacity: 0, scale: 0.7}}
                            transition={
                              prefersReducedMotion
                                ? {duration: 0.01}
                                : {duration: 0.18, ease: decisiveEase}
                            }
                          >
                            <Check size={16} />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </button>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        className={`type-button rounded-full px-2.5 py-1 ${
                          isActive ? 'bg-white/12 text-white' : 'bg-secondary-container/50 text-secondary'
                        }`}
                        onClick={() => onEditProfile(profile.id)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        aria-label={`Delete ${profile.name}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isActive ? 'bg-white/12 text-white' : 'bg-surface-container-low text-primary'
                        }`}
                        disabled={deletingProfileId === profile.id}
                        onClick={() => onDeleteProfile(profile.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <motion.div className="mt-3 border-t border-outline-variant/10 pt-3" variants={fadeUpVariants}>
              <button
                className="type-button inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-4 py-3 text-white shadow-[0_16px_30px_-22px_rgba(3,25,46,0.75)] transition-transform active:scale-[0.98]"
                onClick={() => {
                  onClose();
                  onCreateProfile();
                }}
                type="button"
              >
                <Plus size={15} />
                Add profile
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProfileWorkspace({
  currentMeasurement,
  currentView,
  onOpenHistory,
  onSelectMeasurement,
  onSetCurrentView,
  onStartEditing,
  onToggleUnit,
  profile,
  selectedMeasurement,
  unit,
  visibleDefinitions,
}: {
  currentMeasurement: (typeof measurementDefinitions)[number] | null;
  currentView: MeasurementView;
  onOpenHistory: () => void;
  onSelectMeasurement: (measurementKey: MeasurementKey) => void;
  onSetCurrentView: (view: MeasurementView) => void;
  onStartEditing: (measurementKey?: MeasurementKey) => void;
  onToggleUnit: () => void;
  profile: Profile;
  selectedMeasurement: MeasurementKey | null;
  unit: Unit;
  visibleDefinitions: (typeof measurementDefinitions)[number][];
}) {
  const selectedMeasurementValueCm = currentMeasurement
    ? profile.measurements[currentMeasurement.key]
    : null;
  const prefersReducedMotion = useReducedMotion();
  const previousHasCurrentMeasurementRef = useRef(Boolean(currentMeasurement));
  const shouldAnimateGuidanceToggle =
    previousHasCurrentMeasurementRef.current !== Boolean(currentMeasurement);

  useEffect(() => {
    previousHasCurrentMeasurementRef.current = Boolean(currentMeasurement);
  }, [currentMeasurement]);

  return (
    <motion.div
      animate="visible"
      className="space-y-6"
      initial="hidden"
      variants={
        prefersReducedMotion
          ? {
              hidden: {},
              visible: {
                transition: {staggerChildren: 0},
              },
            }
          : {
              hidden: {},
              visible: {
                transition: {staggerChildren: 0.06, delayChildren: 0.04},
              },
            }
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.58fr)] xl:items-start 2xl:grid-cols-[minmax(0,0.88fr)_minmax(27rem,0.6fr)]">
        <motion.div
          className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(180deg,rgba(244,244,239,0.88),rgba(250,250,245,0.96))] p-4 ring-1 ring-outline-variant/12 md:p-6 xl:sticky xl:top-[7.25rem] xl:p-5"
          variants={fadeUpVariants}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(253,220,152,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(3,25,46,0.06),transparent_28%)]" />
          <div className="relative mx-auto xl:max-w-[35rem] 2xl:max-w-[36.5rem]">
            <TechnicalMeasurementPlate
              currentView={currentView}
              onEditSelectedMeasurement={onStartEditing}
              onSetCurrentView={onSetCurrentView}
              onToggleUnit={onToggleUnit}
              onSelectMeasurement={onSelectMeasurement}
              profile={profile}
              selectedMeasurement={selectedMeasurement}
              selectedMeasurementLabel={currentMeasurement?.label ?? null}
              selectedMeasurementValueCm={selectedMeasurementValueCm}
              unit={unit}
            />
          </div>
        </motion.div>

        <motion.div
          className="space-y-5"
          variants={fadeUpVariants}
        >
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: currentMeasurement
                  ? '0 18px 36px -26px rgba(139,107,40,0.3)'
                  : '0 0 0 0 rgba(139,107,40,0)',
              }}
              className={`rounded-[1.9rem] p-5 transition-all ${
                currentMeasurement
                  ? 'bg-secondary-container/38 text-secondary ring-1 ring-secondary/24 shadow-[0_18px_36px_-26px_rgba(139,107,40,0.3)]'
                  : 'bg-white/74 text-primary ring-1 ring-outline-variant/12'
              }`}
              layout={shouldAnimateGuidanceToggle}
              transition={
                prefersReducedMotion
                  ? {duration: 0.01}
                  : {
                      layout: {duration: 0.5, ease: calmEase},
                      boxShadow: {duration: 0.36, ease: calmEase},
                    }
              }
            >
              <AnimatePresence initial={false} mode="sync">
                {currentMeasurement ? (
                  <motion.div
                    animate={
                      shouldAnimateGuidanceToggle ? {opacity: 1, y: 0} : {opacity: 1, y: 0}
                    }
                    className="flex items-center"
                    exit={shouldAnimateGuidanceToggle ? {opacity: 0, y: -4} : undefined}
                    initial={shouldAnimateGuidanceToggle ? {opacity: 0, y: 6} : false}
                    key="selected-guidance"
                    transition={
                      prefersReducedMotion
                        ? {duration: 0.01}
                        : {duration: 0.3, ease: calmEase}
                    }
                  >
                    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between xl:flex-col xl:items-start">
                      <p className="type-note text-secondary">
                        Tip: {currentMeasurement.guide}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    animate={
                      shouldAnimateGuidanceToggle ? {opacity: 1, y: 0} : {opacity: 1, y: 0}
                    }
                    className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between xl:flex-col xl:items-start"
                    exit={shouldAnimateGuidanceToggle ? {opacity: 0, y: -4} : undefined}
                    initial={shouldAnimateGuidanceToggle ? {opacity: 0, y: 6} : false}
                    key="empty-guidance"
                    transition={
                      prefersReducedMotion
                        ? {duration: 0.01}
                        : {duration: 0.3, ease: calmEase}
                    }
                  >
                    <div>
                      <p className="type-overline text-on-surface-variant">
                        Ready to inspect
                      </p>
                      <p className="type-note mt-2 text-on-surface-variant">
                        Tap a callout on the plate to bring a measurement into focus. Saved measurements gain a gold accent on the diagram.
                      </p>
                    </div>
                    <motion.div
                      className="type-button rounded-full bg-secondary-container/45 px-4 py-2 text-secondary"
                      layout
                    >
                      {getCompletionSummary(profile)}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div
            className="xl:max-h-[calc(100vh-15.75rem)] xl:overflow-y-auto xl:pr-1"
            data-measurement-ledger-scroll
          >
            <div className="rounded-[2.2rem] bg-surface-container-low/78 p-4 ring-1 ring-outline-variant/10 md:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="type-overline text-on-surface-variant">
                    Measurement ledger
                  </p>
                  <h3 className="type-section-title text-primary">
                    {currentView === 'front' ? 'Front measurements' : 'Back measurements'}
                  </h3>
                </div>
                <div className="type-button rounded-full bg-white/70 px-3 py-1 text-secondary">
                  Displaying {unit}
                </div>
              </div>

              <MeasurementFolio
                onOpenHistory={onOpenHistory}
                onStartEditing={onStartEditing}
                onSelectMeasurement={onSelectMeasurement}
                profile={profile}
                selectedMeasurement={selectedMeasurement}
                unit={unit}
                visibleDefinitions={visibleDefinitions}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function MeasurementFolio({
  onOpenHistory,
  onStartEditing,
  onSelectMeasurement,
  profile,
  selectedMeasurement,
  unit,
  visibleDefinitions,
}: {
  onOpenHistory: () => void;
  onStartEditing: (measurementKey: MeasurementKey) => void;
  onSelectMeasurement: (measurementKey: MeasurementKey) => void;
  profile: Profile;
  selectedMeasurement: MeasurementKey | null;
  unit: Unit;
  visibleDefinitions: (typeof measurementDefinitions)[number][];
}) {
  const prefersReducedMotion = useReducedMotion();
  const cardRefs = useRef(new Map<MeasurementKey, HTMLDivElement>());
  const visibleKeys = new Set(visibleDefinitions.map((definition) => definition.key));
  const groups = measurementGroups
    .map((group) => ({
      ...group,
      definitions: group.keys
        .map((key) => measurementDefinitionsByKey[key])
        .filter((definition) => visibleKeys.has(definition.key)),
    }))
    .filter((group) => group.definitions.length > 0);

  useEffect(() => {
    if (!selectedMeasurement || typeof window === 'undefined') {
      return;
    }

    if (!window.matchMedia('(min-width: 80rem)').matches) {
      return;
    }

    const selectedCard = cardRefs.current.get(selectedMeasurement);
    const scrollContainer = selectedCard?.closest('[data-measurement-ledger-scroll]');

    if (!(selectedCard instanceof HTMLElement) || !(scrollContainer instanceof HTMLElement)) {
      return;
    }

    const cardRect = selectedCard.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const verticalInset = 24;
    const isFullyComfortable =
      cardRect.top >= containerRect.top + verticalInset &&
      cardRect.bottom <= containerRect.bottom - verticalInset;

    if (isFullyComfortable) {
      return;
    }

    selectedCard.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [prefersReducedMotion, selectedMeasurement]);

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={
        prefersReducedMotion
          ? {
              hidden: {},
              visible: {
                transition: {staggerChildren: 0},
              },
            }
          : {
              hidden: {},
              visible: {
                transition: {staggerChildren: 0.045},
              },
            }
      }
    >
      {groups.map((group, groupIndex) => (
        <motion.section
          className="rounded-[1.65rem] bg-white/48 p-3 ring-1 ring-outline-variant/8"
          custom={groupIndex}
          key={group.title}
          variants={fadeUpVariants}
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="type-overline text-secondary">{group.title}</p>
              <p className="type-note mt-1 text-on-surface-variant">{group.caption}</p>
            </div>
            <div className="type-button rounded-full bg-secondary-container/34 px-3 py-1 text-secondary">
              {group.definitions.filter((definition) => profile.measurements[definition.key] > 0).length}
              {' '}saved
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {group.definitions.map((definition) => {
              const isActive = selectedMeasurement === definition.key;
              const value = profile.measurements[definition.key];
              const isMeasured = value > 0;
              const handleCardClick = () => {
                const shouldQuickEdit =
                  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

                if (shouldQuickEdit) {
                  onStartEditing(definition.key);
                  return;
                }

                onSelectMeasurement(definition.key);
              };

              return (
                <motion.div
                  animate={
                    isActive
                      ? {
                          opacity: 1,
                          scale: 1,
                          y: -2,
                          boxShadow: '0 22px 40px -26px rgba(36,88,92,0.42)',
                        }
                      : {
                          opacity: 1,
                          scale: 1,
                          y: 0,
                          boxShadow: '0 0 0 0 rgba(3,25,46,0)',
                        }
                  }
                  className={`scroll-mt-5 overflow-hidden rounded-[1.45rem] text-left transition-all ${
                    isActive
                      ? 'z-10 bg-primary text-white shadow-[0_18px_36px_-24px_rgba(36,88,92,0.42)] ring-1 ring-guidance/40'
                      : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(250,250,245,0.72))] text-primary ring-1 ring-outline-variant/10 hover:bg-white'
                  }`}
                  initial={prefersReducedMotion ? false : {opacity: 0, y: 14}}
                  key={definition.key}
                  layout
                  ref={(node) => {
                    if (node) {
                      cardRefs.current.set(definition.key, node);
                    } else {
                      cardRefs.current.delete(definition.key);
                    }
                  }}
                  transition={{
                    opacity: {duration: 0.12, ease: decisiveEase},
                    scale: {duration: 0.14, ease: decisiveEase},
                    y: {duration: isActive ? 0.22 : 0.08, ease: isActive ? elegantEase : decisiveEase},
                    boxShadow: {
                      duration: isActive ? 0.22 : 0.06,
                      ease: isActive ? elegantEase : decisiveEase,
                    },
                    layout: {duration: 0.18, ease: decisiveEase},
                  }}
                >
                  <button
                    className="w-full px-4 py-4 text-left"
                    onClick={handleCardClick}
                    type="button"
                  >
                    <div className="min-h-[5.5rem] space-y-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`block h-2.5 w-2.5 shrink-0 rounded-full ${
                            isActive
                              ? 'bg-guidance-soft'
                              : isMeasured
                                ? 'bg-secondary'
                                : 'bg-primary/25'
                          }`}
                        />
                        <p className="type-ui min-w-0 text-balance leading-snug">
                          {definition.label}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-end justify-between gap-3">
                        <p className={`type-metric-sm whitespace-nowrap ${isMeasured ? '' : isActive ? 'text-white/45' : 'text-primary/30'}`}>
                          {isMeasured ? formatMeasurement(value, unit) : '—'}
                        </p>
                        {!isMeasured ? (
                          <p className={`type-label whitespace-nowrap pb-1 ${isActive ? 'text-white/65' : 'text-on-surface-variant'}`}>
                            pending
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isActive ? (
                      <motion.div
                        animate={{opacity: 1, height: 'auto'}}
                        className="border-t border-white/10 px-4 pb-4"
                        exit={{opacity: 0, height: 0}}
                        initial={{opacity: 0, height: 0}}
                        onClick={() => onSelectMeasurement(definition.key)}
                        transition={{duration: 0.24, ease: calmEase}}
                      >
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            aria-label={`Edit ${definition.label}`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/18"
                            onClick={(event) => {
                              event.stopPropagation();
                              onStartEditing(definition.key);
                            }}
                            type="button"
                          >
                            <PencilLine size={15} />
                          </button>
                          <button
                            aria-label={`View ${definition.label} history`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/18"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectMeasurement(definition.key);
                              onOpenHistory();
                            }}
                            type="button"
                          >
                            <History size={15} />
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      ))}
    </motion.div>
  );
}

function HistoryDrawer({
  error,
  heightHistory,
  measurementHistory,
  onClose,
  profile,
  selectedMeasurement,
  status,
  unit,
}: {
  error: string | null;
  heightHistory: ProfileHeightHistoryResponse | null;
  measurementHistory: MeasurementHistoryResponse | null;
  onClose: () => void;
  profile: Profile;
  selectedMeasurement: (typeof measurementDefinitions)[number];
  status: HistoryStatus;
  unit: Unit;
}) {
  const entries = measurementHistory?.entries ?? [];
  const latestEntry = entries.at(-1) ?? null;
  const heightEntries = heightHistory?.entries ?? [];

  return (
    <motion.div
      animate={{opacity: 1}}
      className="fixed inset-0 z-40 bg-primary/22 backdrop-blur-[10px]"
      exit={{opacity: 0}}
      initial={{opacity: 0}}
    >
      <div className="flex min-h-full justify-end">
        <motion.aside
          animate={{x: 0}}
          className="flex h-screen w-full max-w-xl flex-col overflow-hidden bg-background shadow-[0_30px_80px_-34px_rgba(3,25,46,0.5)] ring-1 ring-outline-variant/12"
          exit={{x: '100%'}}
          initial={{x: '100%'}}
          transition={{duration: 0.28, ease: elegantEase}}
        >
          <div className="border-b border-outline-variant/10 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="type-overline text-secondary">Fitting history</p>
                <h2 className="type-section-title text-primary">{selectedMeasurement.label}</h2>
                <p className="type-note mt-2 text-on-surface-variant">
                  {profile.name}’s selected measurement record and compact height archive.
                </p>
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-primary"
                onClick={onClose}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {status === 'loading' ? (
              <div className="space-y-3">
                {Array.from({length: 4}).map((_, index) => (
                  <div className="h-20 rounded-[1.4rem] bg-surface-container-low" key={index} />
                ))}
              </div>
            ) : status === 'error' ? (
              <div className="rounded-[1.6rem] bg-secondary-container/28 p-5 text-secondary">
                <p className="type-overline">History unavailable</p>
                <p className="type-note mt-2">{error}</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[1.8rem] bg-primary p-5 text-white">
                  <p className="type-overline text-white/58">Latest stitch</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="type-metric">
                        {latestEntry?.valueCm
                          ? formatMeasurement(latestEntry.valueCm, unit)
                          : 'No value'}
                      </p>
                      <p className="type-note mt-2 text-white/72">
                        {latestEntry
                          ? `${latestEntry.eventType} • ${formatDateTime(latestEntry.changedAt)}`
                          : 'This measurement has not been recorded yet.'}
                      </p>
                    </div>
                    <Clock3 className="shrink-0 text-secondary-container" size={28} />
                  </div>
                </div>

                <section>
                  <p className="type-overline text-on-surface-variant">Measurement timeline</p>
                  <div className="mt-3 space-y-3">
                    {entries.length > 0 ? entries.slice().reverse().map((entry) => (
                      <div
                        className="rounded-[1.35rem] bg-white/72 p-4 ring-1 ring-outline-variant/10"
                        key={`${entry.changedAt}-${entry.eventType}-${entry.valueCm}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="type-ui text-primary">
                              {entry.valueCm === null ? 'Removed value' : formatMeasurement(entry.valueCm, unit)}
                            </p>
                            <p className="type-note mt-1 text-on-surface-variant">
                              {entry.previousValueCm === null
                                ? 'First recorded value'
                                : `Previous ${formatMeasurement(entry.previousValueCm, unit)}`}
                            </p>
                          </div>
                          <p className="type-label text-right text-secondary">
                            {formatDateTime(entry.changedAt)}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-[1.35rem] bg-white/72 p-4 ring-1 ring-outline-variant/10">
                        <p className="type-note text-on-surface-variant">
                          No history entries yet. Save this measurement once to create the first fitting note.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.6rem] bg-surface-container-low/78 p-4">
                  <p className="type-overline text-on-surface-variant">Height archive</p>
                  <p className="type-note mt-2 text-primary">
                    {heightEntries.length > 0
                      ? `${heightEntries.length} height ${heightEntries.length === 1 ? 'entry' : 'entries'} recorded. Latest: ${stripTrailingZeroes(heightEntries.at(-1)?.heightCm ?? profile.heightCm)} cm.`
                      : `Current profile height: ${stripTrailingZeroes(profile.heightCm)} cm.`}
                  </p>
                </section>
              </div>
            )}
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
}

function MeasurementEditModal({
  canSaveMeasurement,
  currentMeasurement,
  editValue,
  isSavingMeasurement,
  measurementError,
  onChangeEditValue,
  onClose,
  onSaveMeasurement,
  saveError,
  unit,
}: {
  canSaveMeasurement: boolean;
  currentMeasurement: (typeof measurementDefinitions)[number];
  editValue: string;
  isSavingMeasurement: boolean;
  measurementError: string | null;
  onChangeEditValue: (value: string) => void;
  onClose: () => void;
  onSaveMeasurement: () => void;
  saveError: string | null;
  unit: Unit;
}) {
  return (
    <motion.div
      animate={{opacity: 1}}
      className="fixed inset-0 z-40 bg-primary/20 px-4 py-6 backdrop-blur-[10px]"
      exit={{opacity: 0}}
      initial={{opacity: 0}}
    >
      <div className="mx-auto flex h-full max-w-2xl items-end md:items-center">
        <motion.div
          animate={{opacity: 1, y: 0}}
          className="w-full rounded-[2rem] rounded-b-none bg-background p-5 shadow-[0_30px_70px_-34px_rgba(3,25,46,0.42)] ring-1 ring-outline-variant/12 md:rounded-[2.2rem] md:p-7"
          exit={{opacity: 0, y: 24}}
          initial={{opacity: 0, y: 24}}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-overline text-secondary">
                Measurement edit
              </p>
              <h2 className="type-section-title text-primary">{currentMeasurement.label}</h2>
              <p className="type-note mt-2 hidden max-w-lg text-on-surface-variant md:block">
                Enter the updated value in {unit}. The diagram will keep the canonical record in centimeters behind the scenes.
              </p>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-primary"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-surface-container-low/78 p-5 hidden md:block">
            <p className="type-overline text-on-surface-variant">
              Measurement guidance
            </p>
            <p className="type-note mt-3 text-primary/82">
              {currentMeasurement.guide}
            </p>
          </div>

          <div className="mt-5 md:mt-6">
            <label
              className="type-overline block text-on-surface-variant"
              htmlFor="measurement-value"
            >
              Value in {unit}
            </label>
            <input
              className="type-metric-sm mt-3 w-full rounded-[1.25rem] bg-surface-container-low px-4 py-4 text-primary outline-none ring-1 ring-transparent transition focus:ring-guidance/35"
              id="measurement-value"
              inputMode="decimal"
              max={getMeasurementMax(unit)}
              min={0}
              onChange={(event) => onChangeEditValue(sanitizeDecimalInput(event.target.value))}
              placeholder={`Enter ${currentMeasurement.label.toLowerCase()}`}
              step="0.1"
              value={editValue}
            />
            {measurementError ? (
              <p className="mt-2 text-sm text-secondary">{measurementError}</p>
            ) : null}
            {saveError ? (
              <p className="mt-2 text-sm text-secondary">{saveError}</p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 md:mt-8 md:flex-row md:justify-end">
            <button
              className="type-button inline-flex items-center justify-center rounded-full bg-surface-container-high px-5 py-3 text-primary"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="type-button inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,_var(--color-guidance-strong),_var(--color-guidance))] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canSaveMeasurement}
              onClick={onSaveMeasurement}
              type="button"
            >
              <PencilLine size={15} />
              {isSavingMeasurement ? 'Saving...' : 'Save measurement'}
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ProfileDetailsModal({
  canSaveProfile,
  draftProfile,
  isSavingProfile,
  mode,
  onChangeDraftProfile,
  onClose,
  onSaveProfile,
  profileHeightError,
  profileNameError,
  saveError,
}: {
  canSaveProfile: boolean;
  draftProfile: DraftProfile;
  isSavingProfile: boolean;
  mode: 'create' | 'edit';
  onChangeDraftProfile: (nextDraft: DraftProfile) => void;
  onClose: () => void;
  onSaveProfile: () => void;
  profileHeightError: string | null;
  profileNameError: string | null;
  saveError: string | null;
}) {
  const isEditMode = mode === 'edit';

  return (
    <motion.div
      animate={{opacity: 1}}
      className="fixed inset-0 z-40 bg-primary/25 px-4 py-6 backdrop-blur-sm"
      exit={{opacity: 0}}
      initial={{opacity: 0}}
    >
      <div className="mx-auto flex h-full max-w-2xl items-end md:items-center">
        <motion.div
          animate={{opacity: 1, y: 0}}
          className="w-full rounded-[2rem] bg-background p-6 shadow-[0_24px_60px_-32px_rgba(26,28,25,0.35)] ring-1 ring-outline-variant/12 md:p-7"
          exit={{opacity: 0, y: 24}}
          initial={{opacity: 0, y: 24}}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-overline text-secondary">
                {isEditMode ? 'Edit profile' : 'Quick add'}
              </p>
              <h2 className="type-section-title text-primary">
                {isEditMode ? 'Update profile details' : 'Create a family profile'}
              </h2>
              <p className="type-note mt-2 max-w-lg text-on-surface-variant">
                {isEditMode
                  ? 'Adjust the profile name, sex, or height. Existing measurements stay attached to this profile.'
                  : 'Keep setup light now. Add the essentials, then fill measurements one by one inside the profile workspace.'}
              </p>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-primary"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="type-overline text-on-surface-variant">
                Name
              </span>
              <input
                className="type-input mt-2 w-full rounded-[1.2rem] bg-surface-container-low px-4 py-3 text-primary outline-none ring-1 ring-transparent transition focus:ring-guidance/35"
                maxLength={MAX_PROFILE_NAME_LENGTH}
                onChange={(event) =>
                  onChangeDraftProfile({...draftProfile, name: event.target.value})
                }
                placeholder="e.g. Sofia"
                value={draftProfile.name}
              />
              {profileNameError ? (
                <span className="mt-2 block text-sm text-secondary">{profileNameError}</span>
              ) : null}
            </label>

            <label className="block">
              <span className="type-overline text-on-surface-variant">
                Height (cm)
              </span>
              <input
                className="type-input mt-2 w-full rounded-[1.2rem] bg-surface-container-low px-4 py-3 text-primary outline-none ring-1 ring-transparent transition focus:ring-guidance/35"
                inputMode="decimal"
                max={MAX_HEIGHT_CM}
                min={MIN_HEIGHT_CM}
                onChange={(event) =>
                  onChangeDraftProfile({
                    ...draftProfile,
                    heightCm: sanitizeDecimalInput(event.target.value),
                  })
                }
                placeholder="164"
                step="0.1"
                value={draftProfile.heightCm}
              />
              {profileHeightError ? (
                <span className="mt-2 block text-sm text-secondary">{profileHeightError}</span>
              ) : null}
            </label>
          </div>

          <div className="mt-5">
            <span className="type-overline text-on-surface-variant">
              Sex
            </span>
            <div className="mt-2 flex gap-3">
              {(['female', 'male'] as Sex[]).map((value) => (
                <button
                  key={value}
                  className={`type-button rounded-full px-4 py-3 transition-all ${
                    draftProfile.sex === value
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low text-primary'
                  }`}
                  onClick={() => onChangeDraftProfile({...draftProfile, sex: value})}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {saveError ? (
            <p className="mt-5 text-sm text-secondary">{saveError}</p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <button
              className="type-button inline-flex items-center justify-center rounded-full bg-surface-container-low px-5 py-3 text-primary"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="type-button inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canSaveProfile}
              onClick={onSaveProfile}
              type="button"
            >
              {isEditMode ? <PencilLine size={15} /> : <Plus size={15} />}
              {isSavingProfile
                ? 'Saving...'
                : isEditMode
                  ? 'Save profile'
                  : 'Save and continue'}
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function SegmentedControl({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<{label: string; value: string}>;
  value: string;
}) {
  return (
    <div className="inline-flex rounded-full bg-surface-container-low p-1">
      {options.map((option) => (
        <button
          key={option.value}
          className={`type-button rounded-full px-4 py-2 transition-all ${
            option.value === value ? 'bg-primary text-white' : 'text-primary/70'
          }`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
