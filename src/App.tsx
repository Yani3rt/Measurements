import {useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  PencilLine,
  Plus,
  Ruler,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  createEmptyMeasurements,
  measurementDefinitions,
  measurementDefinitionsByKey,
} from './measurements';
import {loadProfiles, saveProfiles} from './storage';
import {TechnicalMeasurementPlate} from './technicalPlate';
import {
  createProfileId,
  formatMeasurement,
  getCompletionSummary,
  getMeasurementValue,
  normalizeMeasurementInput,
  stripTrailingZeroes,
} from './utils';
import type {MeasurementKey, MeasurementView, Profile, Sex, Unit} from './types';

type DraftProfile = {
  name: string;
  sex: Sex;
  heightCm: string;
};

const defaultDraftProfile: DraftProfile = {
  name: '',
  sex: 'female',
  heightCm: '',
};

export default function App() {
  const [initialLoad] = useState(() => loadProfiles());
  const {profiles: initialProfiles, storageAvailable: initialStorageAvailable} = initialLoad;
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [storageAvailable, setStorageAvailable] = useState(initialStorageAvailable);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    initialProfiles[0]?.id ?? null,
  );
  const [currentView, setCurrentView] = useState<MeasurementView>('front');
  const [unit, setUnit] = useState<Unit>('cm');
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementKey | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(initialProfiles.length === 0);
  const [draftProfile, setDraftProfile] = useState<DraftProfile>(defaultDraftProfile);
  const [profileModalMode, setProfileModalMode] = useState<'create' | 'edit'>('create');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isEditingMeasurement, setIsEditingMeasurement] = useState(false);
  const [isProfilesMenuOpen, setIsProfilesMenuOpen] = useState(false);
  const [editValue, setEditValue] = useState('');

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const currentMeasurement =
    selectedMeasurement && selectedProfile
      ? measurementDefinitionsByKey[selectedMeasurement]
      : null;

  const visibleDefinitions = useMemo(
    () => measurementDefinitions.filter((definition) => definition.view === currentView),
    [currentView],
  );

  useEffect(() => {
    const saved = saveProfiles(profiles);
    setStorageAvailable(saved || profiles.length === 0 || initialStorageAvailable);
  }, [profiles, initialStorageAvailable]);

  useEffect(() => {
    if (!selectedProfile) {
      setSelectedMeasurement(null);
      setIsEditingMeasurement(false);
      return;
    }

    if (
      selectedMeasurement &&
      measurementDefinitionsByKey[selectedMeasurement].view !== currentView
    ) {
      setSelectedMeasurement(null);
      setIsEditingMeasurement(false);
    }
  }, [currentView, selectedMeasurement, selectedProfile]);

  function handleCreateProfile() {
    const trimmedName = draftProfile.name.trim();
    const heightCm = Number(draftProfile.heightCm);

    if (!trimmedName || !Number.isFinite(heightCm) || heightCm <= 0) {
      return;
    }

    const nextProfile: Profile = {
      id: createProfileId(),
      name: trimmedName,
      sex: draftProfile.sex,
      heightCm,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      measurements: createEmptyMeasurements(),
    };

    setProfiles((current) => [nextProfile, ...current]);
    setSelectedProfileId(nextProfile.id);
    setCurrentView('front');
    setSelectedMeasurement(null);
    setIsEditingMeasurement(false);
    setDraftProfile(defaultDraftProfile);
    setIsQuickAddOpen(false);
    setProfileModalMode('create');
    setEditingProfileId(null);
  }

  function handleStartCreatingProfile() {
    setDraftProfile(defaultDraftProfile);
    setProfileModalMode('create');
    setEditingProfileId(null);
    setIsQuickAddOpen(true);
  }

  function handleStartEditingProfile(profileId: string) {
    const profile = profiles.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

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

  function handleSaveProfileDetails() {
    const trimmedName = draftProfile.name.trim();
    const heightCm = Number(draftProfile.heightCm);

    if (!trimmedName || !Number.isFinite(heightCm) || heightCm <= 0) {
      return;
    }

    if (profileModalMode === 'create' || !editingProfileId) {
      handleCreateProfile();
      return;
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === editingProfileId
          ? {
              ...profile,
              name: trimmedName,
              sex: draftProfile.sex,
              heightCm,
              updatedAt: new Date().toISOString(),
            }
          : profile,
      ),
    );
    setIsQuickAddOpen(false);
    setProfileModalMode('create');
    setEditingProfileId(null);
    setDraftProfile(defaultDraftProfile);
  }

  function handleDeleteProfile(profileId: string) {
    const profile = profiles.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

    const confirmed = window.confirm(`Delete ${profile.name}'s profile?`);
    if (!confirmed) {
      return;
    }

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
  }

  function handleSelectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    setCurrentView('front');
    setSelectedMeasurement(null);
    setIsEditingMeasurement(false);
    setIsProfilesMenuOpen(false);
  }

  function handleSelectMeasurement(measurementKey: MeasurementKey) {
    setSelectedMeasurement(measurementKey);
    setIsEditingMeasurement(false);
  }

  function handleStartEditing() {
    if (!selectedProfile || !selectedMeasurement) {
      return;
    }

    const value = getMeasurementValue(selectedProfile, selectedMeasurement, unit);
    setEditValue(value === 0 ? '' : stripTrailingZeroes(value));
    setIsEditingMeasurement(true);
  }

  function handleSaveMeasurement() {
    if (!selectedProfile || !selectedMeasurement) {
      return;
    }

    const parsedValue = Number(editValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return;
    }

    const normalizedValue = normalizeMeasurementInput(parsedValue, unit);

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === selectedProfile.id
          ? {
              ...profile,
              updatedAt: new Date().toISOString(),
              measurements: {
                ...profile.measurements,
                [selectedMeasurement]: Number(normalizedValue.toFixed(2)),
              },
            }
          : profile,
      ),
    );
    setIsEditingMeasurement(false);
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
            <ProfileSwitcher
              onDeleteProfile={handleDeleteProfile}
              onEditProfile={handleStartEditingProfile}
              onClose={() => setIsProfilesMenuOpen(false)}
              isOpen={isProfilesMenuOpen}
              onSelectProfile={handleSelectProfile}
              onToggle={() => setIsProfilesMenuOpen((current) => !current)}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
            />
            <button
              className="type-button inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-4 py-2.5 text-white shadow-[0_16px_30px_-18px_rgba(3,25,46,0.75)] transition-transform active:scale-[0.98]"
              onClick={handleStartCreatingProfile}
              type="button"
            >
              <Plus size={16} />
              Add profile
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <section className="min-h-[42rem] rounded-[2.4rem] bg-surface/92 p-5 shadow-[0_12px_32px_-4px_rgba(26,28,25,0.06)] ring-1 ring-outline-variant/12 md:p-7">
          {selectedProfile ? (
            <ProfileWorkspace
              currentMeasurement={currentMeasurement}
              currentView={currentView}
              onSelectMeasurement={handleSelectMeasurement}
              onSetCurrentView={setCurrentView}
              onStartEditing={handleStartEditing}
              onToggleUnit={() => setUnit((current) => (current === 'cm' ? 'in' : 'cm'))}
              profile={selectedProfile}
              selectedMeasurement={selectedMeasurement}
              unit={unit}
              visibleDefinitions={visibleDefinitions}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[2rem] bg-surface-container-low p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/8 text-primary">
                  <Ruler size={28} />
                </div>
                <h2 className="type-section-title text-primary">Choose a profile</h2>
                <p className="type-body mt-3 text-on-surface-variant">
                  Select a family member to view front and back measurements, switch units, and update values one by one.
                </p>
              </div>
            </div>
          )}

          {!storageAvailable && (
            <div className="type-note mt-6 rounded-[1.5rem] bg-secondary-container/28 px-4 py-3 text-secondary">
              Local storage is unavailable, so your changes will only last for this session.
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {isQuickAddOpen && (
          <ProfileDetailsModal
            draftProfile={draftProfile}
            mode={profileModalMode}
            onChangeDraftProfile={setDraftProfile}
            onClose={() => {
              setIsQuickAddOpen(false);
              setProfileModalMode('create');
              setEditingProfileId(null);
              setDraftProfile(defaultDraftProfile);
            }}
            onSaveProfile={handleSaveProfileDetails}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingMeasurement && currentMeasurement && (
          <MeasurementEditModal
            currentMeasurement={currentMeasurement}
            editValue={editValue}
            onChangeEditValue={setEditValue}
            onClose={() => setIsEditingMeasurement(false)}
            onSaveMeasurement={handleSaveMeasurement}
            unit={unit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileSwitcher({
  onDeleteProfile,
  onEditProfile,
  isOpen,
  onClose,
  onSelectProfile,
  onToggle,
  profiles,
  selectedProfileId,
}: {
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
        type="button"
      >
        <span className="flex items-center gap-2">
          <Users size={16} />
          {selectedProfile ? selectedProfile.name : profiles.length === 0 ? 'No profiles' : 'Profiles'}
        </span>
        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          size={16}
        />
      </button>

      {isOpen && profiles.length > 0 ? (
        <div className="absolute right-0 z-40 mt-3 w-[20rem] overflow-hidden rounded-[1.5rem] bg-background/98 p-2 shadow-[0_24px_60px_-32px_rgba(3,25,46,0.34)] ring-1 ring-outline-variant/12 backdrop-blur-md">
          <div className="px-3 pb-2 pt-1">
            <p className="type-overline text-on-surface-variant">
              Family profiles
            </p>
          </div>
          <div className="space-y-1">
            {profiles.map((profile) => {
              const isActive = selectedProfileId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`flex items-start justify-between gap-3 rounded-[1.15rem] px-3 py-3 transition-all ${
                    isActive ? 'bg-primary text-white' : 'bg-transparent text-primary hover:bg-surface-container-low'
                  }`}
                >
                  <button
                    className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                    onClick={() => onSelectProfile(profile.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="type-section-title text-[1.55rem] leading-[0.95]">{profile.name}</p>
                      <p
                        className={`type-label mt-1 ${
                          isActive ? 'text-white/65' : 'text-on-surface-variant'
                        }`}
                      >
                        {profile.sex} • {stripTrailingZeroes(profile.heightCm)} cm
                      </p>
                    </div>
                    <div className="pt-1">{isActive ? <Check size={16} /> : null}</div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
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
                      onClick={() => onDeleteProfile(profile.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileWorkspace({
  currentMeasurement,
  currentView,
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
  onSelectMeasurement: (measurementKey: MeasurementKey) => void;
  onSetCurrentView: (view: MeasurementView) => void;
  onStartEditing: () => void;
  onToggleUnit: () => void;
  profile: Profile;
  selectedMeasurement: MeasurementKey | null;
  unit: Unit;
  visibleDefinitions: (typeof measurementDefinitions)[number][];
}) {
  const selectedMeasurementValueCm = currentMeasurement
    ? profile.measurements[currentMeasurement.key]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SegmentedControl
            onChange={(value) => onSetCurrentView(value as MeasurementView)}
            options={[
              {label: 'Front', value: 'front'},
              {label: 'Back', value: 'back'},
            ]}
            value={currentView}
          />
          <button
            className="type-button inline-flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 text-primary"
            onClick={onToggleUnit}
            type="button"
          >
            <ArrowRightLeft size={14} />
            {unit}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(180deg,rgba(244,244,239,0.88),rgba(250,250,245,0.96))] p-4 ring-1 ring-outline-variant/12 md:p-6 xl:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(253,220,152,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(3,25,46,0.06),transparent_28%)]" />
        <div className="relative">
          <TechnicalMeasurementPlate
            currentView={currentView}
            onEditSelectedMeasurement={onStartEditing}
            onSelectMeasurement={onSelectMeasurement}
            profile={profile}
            selectedMeasurement={selectedMeasurement}
            selectedMeasurementLabel={currentMeasurement?.label ?? null}
            selectedMeasurementValueCm={selectedMeasurementValueCm}
            unit={unit}
          />
        </div>

        <div className="relative mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div
            className={`rounded-[1.9rem] p-5 transition-all ${
              currentMeasurement
                ? 'bg-primary text-white shadow-[0_18px_40px_-24px_rgba(3,25,46,0.75)]'
                : 'bg-white/74 text-primary ring-1 ring-outline-variant/12'
            }`}
          >
            {currentMeasurement ? (
                <p className="type-note text-white/78">
                  Tip: {currentMeasurement.guide}
                </p>
              ) : (
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="type-overline text-on-surface-variant">
                      Ready to inspect
                    </p>
                    <p className="type-note mt-2 text-on-surface-variant">
                      Tap a callout on the plate to bring a measurement into focus. Saved measurements gain a gold accent on the diagram.
                    </p>
                  </div>
                <div className="type-button rounded-full bg-secondary-container/45 px-4 py-2 text-secondary">
                  {getCompletionSummary(profile)}
                </div>
              </div>
            )}
          </div>

          <button
            className={`type-button inline-flex min-h-[3.6rem] items-center justify-center gap-2 rounded-full px-5 py-3 transition-all ${
              currentMeasurement
                ? 'bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] text-white shadow-[0_18px_32px_-22px_rgba(3,25,46,0.8)]'
                : 'cursor-not-allowed bg-surface-container-high text-primary/35'
            }`}
            disabled={!currentMeasurement}
            onClick={onStartEditing}
            type="button"
          >
            <PencilLine size={15} />
            Edit selected measurement
          </button>
        </div>
      </div>

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

        <MeasurementLedger
          onSelectMeasurement={onSelectMeasurement}
          profile={profile}
          selectedMeasurement={selectedMeasurement}
          unit={unit}
          visibleDefinitions={visibleDefinitions}
        />
      </div>
    </div>
  );
}

function MeasurementLedger({
  onSelectMeasurement,
  profile,
  selectedMeasurement,
  unit,
  visibleDefinitions,
}: {
  onSelectMeasurement: (measurementKey: MeasurementKey) => void;
  profile: Profile;
  selectedMeasurement: MeasurementKey | null;
  unit: Unit;
  visibleDefinitions: (typeof measurementDefinitions)[number][];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {visibleDefinitions.map((definition) => {
        const isActive = selectedMeasurement === definition.key;
        const value = profile.measurements[definition.key];
        const isMeasured = value > 0;

        return (
          <button
            key={definition.key}
            className={`rounded-[1.45rem] px-4 py-4 text-left transition-all ${
              isActive
                ? 'bg-primary text-white shadow-[0_18px_36px_-24px_rgba(3,25,46,0.72)]'
                : 'bg-white/72 text-primary ring-1 ring-outline-variant/10 hover:bg-white'
            }`}
            onClick={() => onSelectMeasurement(definition.key)}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isMeasured ? 'bg-secondary' : isActive ? 'bg-white' : 'bg-primary/25'
                    }`}
                  />
                  <p
                    className={`type-label ${
                      isActive ? 'text-white/65' : 'text-on-surface-variant'
                    }`}
                  >
                    {definition.view}
                  </p>
                </div>
                <p className="type-ui mt-3">{definition.label}</p>
              </div>
              <div className="text-right">
                <p className="type-metric-sm">{formatMeasurement(value, unit)}</p>
                <p
                  className={`type-label mt-1 ${
                    isActive ? 'text-white/65' : isMeasured ? 'text-secondary' : 'text-on-surface-variant'
                  }`}
                >
                  {isMeasured ? 'recorded' : 'pending'}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MeasurementEditModal({
  currentMeasurement,
  editValue,
  onChangeEditValue,
  onClose,
  onSaveMeasurement,
  unit,
}: {
  currentMeasurement: (typeof measurementDefinitions)[number];
  editValue: string;
  onChangeEditValue: (value: string) => void;
  onClose: () => void;
  onSaveMeasurement: () => void;
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
          className="w-full rounded-[2.2rem] bg-background p-6 shadow-[0_30px_70px_-34px_rgba(3,25,46,0.42)] ring-1 ring-outline-variant/12 md:p-7"
          exit={{opacity: 0, y: 24}}
          initial={{opacity: 0, y: 24}}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-overline text-secondary">
                Measurement edit
              </p>
              <h2 className="type-section-title text-primary">{currentMeasurement.label}</h2>
              <p className="type-note mt-2 max-w-lg text-on-surface-variant">
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

          <div className="mt-8 rounded-[1.8rem] bg-surface-container-low/78 p-5">
            <p className="type-overline text-on-surface-variant">
              Measurement guidance
            </p>
            <p className="type-note mt-3 text-primary/82">
              {currentMeasurement.guide}
            </p>
          </div>

          <div className="mt-6">
            <label
              className="type-overline block text-on-surface-variant"
              htmlFor="measurement-value"
            >
              Value in {unit}
            </label>
            <input
              className="type-metric-sm mt-3 w-full rounded-[1.25rem] bg-surface-container-low px-4 py-4 text-primary outline-none ring-1 ring-transparent transition focus:ring-primary/25"
              id="measurement-value"
              inputMode="decimal"
              onChange={(event) => onChangeEditValue(event.target.value)}
              placeholder={`Enter ${currentMeasurement.label.toLowerCase()}`}
              value={editValue}
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <button
              className="type-button inline-flex items-center justify-center rounded-full bg-surface-container-high px-5 py-3 text-primary"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="type-button inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-5 py-3 text-white"
              onClick={onSaveMeasurement}
              type="button"
            >
              <PencilLine size={15} />
              Save measurement
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ProfileDetailsModal({
  draftProfile,
  mode,
  onChangeDraftProfile,
  onClose,
  onSaveProfile,
}: {
  draftProfile: DraftProfile;
  mode: 'create' | 'edit';
  onChangeDraftProfile: (nextDraft: DraftProfile) => void;
  onClose: () => void;
  onSaveProfile: () => void;
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
                className="type-input mt-2 w-full rounded-[1.2rem] bg-surface-container-low px-4 py-3 text-primary outline-none ring-1 ring-transparent transition focus:ring-primary/25"
                onChange={(event) =>
                  onChangeDraftProfile({...draftProfile, name: event.target.value})
                }
                placeholder="e.g. Sofia"
                value={draftProfile.name}
              />
            </label>

            <label className="block">
              <span className="type-overline text-on-surface-variant">
                Height (cm)
              </span>
              <input
                className="type-input mt-2 w-full rounded-[1.2rem] bg-surface-container-low px-4 py-3 text-primary outline-none ring-1 ring-transparent transition focus:ring-primary/25"
                inputMode="decimal"
                onChange={(event) =>
                  onChangeDraftProfile({...draftProfile, heightCm: event.target.value})
                }
                placeholder="164"
                value={draftProfile.heightCm}
              />
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

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <button
              className="type-button inline-flex items-center justify-center rounded-full bg-surface-container-low px-5 py-3 text-primary"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="type-button inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,_var(--color-primary),_var(--color-primary-container))] px-5 py-3 text-white"
              onClick={onSaveProfile}
              type="button"
            >
              {isEditMode ? <PencilLine size={15} /> : <Plus size={15} />}
              {isEditMode ? 'Save profile' : 'Save and continue'}
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
