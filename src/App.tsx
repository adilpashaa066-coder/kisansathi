import { useCallback, useEffect, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AvailableCropsPage } from './components/AvailableCropsPage';
import { AvailableJobsPage } from './components/AvailableJobsPage';
import { BottomNav } from './components/BottomNav';
import { CropAdvisorPage } from './components/CropAdvisorPage';
import { ExpertSathiPage } from './components/ExpertSathiPage';
import { HomeCalculatorPage } from './components/HomeCalculatorPage';
import { MarketHubPage } from './components/MarketHubPage';
import { SignInPage } from './components/SignInPage';
import { WorkersHubPage } from './components/WorkersHubPage';
import { kisanApi } from './services/api';
import type {
  AgriExpert,
  AgriculturalJob,
  AppNotification,
  CalculatorCrop,
  CropOffer,
  FarmerCropLot,
  JobApplication,
  MainTab,
  MandiRate,
  Profession,
  UserProfile,
} from './types/kisan';

type ScreenView = 'signin' | 'worker-jobs' | 'supplier-crops' | 'main';

const EMPTY_PROFILE: UserProfile = {
  id: '',
  name: '',
  email: '',
  profession: 'farmer',
  state: '',
  district: '',
  taluk: '',
  phone: '',
  googleConnected: false,
  profileCompleted: false,
  updatedAt: '',
};

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n-1',
    title: 'New Urgent Work Posted',
    message: 'Pepper Trellis & Organic Spray in Kushalnagar at ₹650/day.',
    timeAgo: '15m ago',
    read: false,
  },
  {
    id: 'n-2',
    title: 'Fresh Robusta Coffee Lot',
    message: '1,200 kg Estate Sun-Dried Robusta listed in Napoklu.',
    timeAgo: '1h ago',
    read: false,
  },
  {
    id: 'n-3',
    title: 'Mandi Rate Update',
    message: 'Black Pepper steady at ₹300/kg across markets.',
    timeAgo: '3h ago',
    read: false,
  },
];

const TAB_SUBTITLES: Record<MainTab, string> = {
  home: 'Home',
  workers: 'Workers',
  'expert-sathi': 'Expert Sathi',
  market: 'Market',
  insights: 'Crop Advisor',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('signin');
  const [previousScreen, setPreviousScreen] = useState<ScreenView>('signin');
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [googleAuthConfigured, setGoogleAuthConfigured] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authResetKey, setAuthResetKey] = useState(0);

  const [jobs, setJobs] = useState<AgriculturalJob[]>([]);
  const [crops, setCrops] = useState<FarmerCropLot[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [offers, setOffers] = useState<CropOffer[]>([]);
  const [experts, setExperts] = useState<AgriExpert[]>([]);
  const [mandiRates, setMandiRates] = useState<MandiRate[]>([]);
  const [calculatorCrops, setCalculatorCrops] = useState<CalculatorCrop[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const [loadingData, setLoadingData] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 3500);
  }, []);

  const routeForProfession = useCallback((profession: Profession, fromScreen: ScreenView) => {
    setPreviousScreen(fromScreen);
    if (profession === 'worker') {
      setScreen('worker-jobs');
    } else if (profession === 'supplier') {
      setScreen('supplier-crops');
    } else if (profession === 'expert') {
      setActiveTab('expert-sathi');
      setScreen('main');
    } else {
      setActiveTab('home');
      setScreen('main');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [
        authStatus,
        jobsData,
        cropsData,
        applicationsData,
        offersData,
        expertsData,
        mandiData,
        calcCropsData,
      ] = await Promise.all([
        kisanApi.getAuthStatus(),
        kisanApi.getJobs(),
        kisanApi.getCrops(),
        kisanApi.getApplications(),
        kisanApi.getOffers(),
        kisanApi.getExperts(),
        kisanApi.getMandiRates(),
        kisanApi.getCalculatorCrops(),
      ]);

      setGoogleAuthConfigured(authStatus.googleAuthConfigured);
      if (authStatus.authenticated && authStatus.user) {
        setProfile(authStatus.user);
        routeForProfession(authStatus.user.profession, 'signin');
      } else {
        setProfile(EMPTY_PROFILE);
        setScreen('signin');
      }

      setJobs(jobsData);
      setCrops(cropsData);
      setApplications(applicationsData);
      setOffers(offersData);
      setExperts(expertsData);
      setMandiRates(mandiData);
      setCalculatorCrops(calcCropsData);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load latest data from server.');
    } finally {
      setAuthChecked(true);
      setLoadingData(false);
    }
  }, [routeForProfession, showToast]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const handleAuthSuccess = (user: UserProfile, mode: 'signin' | 'signup' | 'google') => {
    setProfile(user);
    routeForProfession(user.profession, 'signin');

    if (mode === 'google') {
      showToast(`Signed in with Google (${user.email || user.name}).`);
      return;
    }

    const roleToast: Record<Profession, string> = {
      worker: 'Welcome! Showing available agricultural jobs.',
      supplier: 'Welcome! Showing available farmer crops.',
      farmer:
        mode === 'signup'
          ? 'Account created! Welcome to Kisan Sathi.'
          : 'Welcome back to Kisan Sathi!',
      expert: 'Welcome to Expert Sathi advisory desk.',
    };
    showToast(roleToast[user.profession]);
  };

  const handleLogout = async () => {
    try {
      await kisanApi.logout();
    } catch {
      // Clear local session state even if network request fails
    } finally {
      setProfile(EMPTY_PROFILE);
      setPreviousScreen('signin');
      setActiveTab('home');
      setScreen('signin');
      setAuthResetKey((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Signed out cleanly.');
    }
  };

  const handleSaveHomeProfile = async (payload: Partial<UserProfile>) => {
    const saved = await kisanApi.saveProfile({
      ...profile,
      ...payload,
      profileCompleted: true,
    });
    setProfile(saved);
    showToast('Profile saved permanently.');
  };

  const handleRefreshJobs = async () => {
    const latest = await kisanApi.getJobs();
    setJobs(latest);
    showToast('Job listings updated.');
  };

  const handleRefreshCrops = async () => {
    const latest = await kisanApi.getCrops();
    setCrops(latest);
    showToast('Crop listings refreshed.');
  };

  const handleApplyJob = async (job: AgriculturalJob) => {
    const app = await kisanApi.applyToJob({
      jobId: job.id,
      workName: job.workName,
      farmerName: job.farmerName,
      village: job.village,
      wagePerDay: job.wagePerDay,
      phone: job.phone,
      applicantName: profile.name,
    });
    setApplications((prev) => {
      if (prev.some((a) => a.jobId === app.jobId)) return prev;
      return [app, ...prev];
    });
    showToast(`Application sent for ${job.workName}.`);
  };

  const handlePostJob = async (payload: Partial<AgriculturalJob>) => {
    const created = await kisanApi.createJob(payload);
    const latestApplications = await kisanApi.getApplications();
    setJobs((prev) => [created, ...prev]);
    setApplications(latestApplications);
    showToast('Work requirement saved and added to Applied!');
  };

  const handleUpdateWorkerCount = async (
    jobId: string,
    action: 'assign' | 'unassign',
    gender: 'male' | 'female'
  ) => {
    try {
      const updatedJob = await kisanApi.updateJobWorkers(jobId, action, gender);
      const latestApplications = await kisanApi.getApplications();
      setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
      setApplications(latestApplications);
      showToast(
        action === 'assign'
          ? `Assigned 1 ${gender} worker. Remaining positions updated.`
          : `Removed 1 assigned ${gender} worker.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update worker count.');
    }
  };

  const handleDeleteApplication = async (id: string) => {
    await kisanApi.deleteApplication(id);
    setApplications((prev) => prev.filter((item) => item.id !== id));
    showToast('Record removed from Applied.');
  };

  const handleCreateCrop = async (payload: Partial<FarmerCropLot>) => {
    const created = await kisanApi.createCrop(payload);
    setCrops((prev) => [created, ...prev]);
    showToast('Crop lot published to Available Farmer Crops!');
  };

  const handleCreateOffer = async (payload: {
    cropId: string;
    cropName: string;
    farmerName: string;
    buyerName: string;
    buyerPhone: string;
    offeredPricePerUnit: number;
    quantity: number;
    unitShort: string;
    message?: string;
  }) => {
    const offer = await kisanApi.createOffer(payload);
    setOffers((prev) => [offer, ...prev]);
    showToast(
      `Offer of ₹${offer.totalOfferAmount.toLocaleString('en-IN')} sent to ${offer.farmerName}!`
    );
  };

  const handleDeleteCalculatorCrop = async (id: string) => {
    await kisanApi.deleteCalculatorCrop(id);
    setCalculatorCrops((prev) => prev.filter((item) => item.id !== id));
    showToast('Crop removed from saved list.');
  };

  const handleSwitchRoleQuick = async (profession: Profession) => {
    const saved = await kisanApi.saveProfile({ ...profile, profession });
    setProfile(saved);
    routeForProfession(profession, screen);
  };

  const renderScreen = () => {
    if (!authChecked) {
      return (
        <div className="min-h-screen w-full bg-surface text-on-surface flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-secondary-container border-t-primary animate-spin" />
            <p className="text-sm font-semibold text-primary">Loading Kisan Sathi...</p>
          </div>
        </div>
      );
    }

    if (screen === 'signin') {
      return (
        <SignInPage
          key={authResetKey}
          googleAuthConfigured={googleAuthConfigured}
          onAuthSuccess={handleAuthSuccess}
        />
      );
    }

    if (screen === 'worker-jobs') {
      return (
        <AvailableJobsPage
          jobs={jobs}
          applications={applications}
          loading={loadingData}
          profile={profile}
          onBack={() => {
            if (previousScreen === 'main') {
              setScreen('main');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              void handleLogout();
            }
          }}
          onApplyJob={handleApplyJob}
          onRefresh={handleRefreshJobs}
        />
      );
    }

    if (screen === 'supplier-crops') {
      return (
        <AvailableCropsPage
          crops={crops}
          offers={offers}
          loading={loadingData}
          profile={profile}
          onBack={() => {
            if (previousScreen === 'main') {
              setScreen('main');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              void handleLogout();
            }
          }}
          onRefresh={handleRefreshCrops}
          onCreateOffer={handleCreateOffer}
        />
      );
    }

    return (
      <div className="bg-surface text-on-surface antialiased flex flex-col min-h-screen w-full max-w-full overflow-x-clip">
        <AppHeader
          subtitle={TAB_SUBTITLES[activeTab]}
          profile={profile}
          notifications={notifications}
          onMarkAllRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
          onOpenProfile={() => {
            setActiveTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onLogout={() => void handleLogout()}
          onSwitchRoleQuick={handleSwitchRoleQuick}
        />

        <main className="flex flex-col flex-1 w-full max-w-full overflow-x-clip pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] bg-surface">
          {activeTab === 'home' && (
            <HomeCalculatorPage
              profile={profile}
              savedCrops={calculatorCrops}
              jobs={jobs}
              crops={crops}
              experts={experts}
              mandiRates={mandiRates}
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSaveProfile={handleSaveHomeProfile}
              onDeleteCrop={handleDeleteCalculatorCrop}
            />
          )}

          {activeTab === 'workers' && (
            <WorkersHubPage
              jobs={jobs}
              applications={applications}
              profile={profile}
              onPostJob={handlePostJob}
              onUpdateWorkerCount={handleUpdateWorkerCount}
              onDeleteApplication={handleDeleteApplication}
            />
          )}

          {activeTab === 'expert-sathi' && <ExpertSathiPage experts={experts} />}

          {activeTab === 'market' && (
            <MarketHubPage
              crops={crops}
              profile={profile}
              onCreateCrop={handleCreateCrop}
              onOpenFullTraderView={() => {
                setPreviousScreen('main');
                setScreen('supplier-crops');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {activeTab === 'insights' && (
            <CropAdvisorPage mandiRates={mandiRates} profile={profile} />
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      </div>
    );
  };

  return (
    <>
      {renderScreen()}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
