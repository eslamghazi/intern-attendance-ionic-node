import { useEffect } from 'react';
import { Redirect, Route, useHistory, useLocation } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonSplitPane,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { constructOutline, home, personCircle, qrCode, scanCircle, shieldCheckmark, time } from 'ionicons/icons';
import { IonReactRouter } from '@ionic/react-router';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from './lib/theme';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.class.css';

/* Leaflet (map picker) */
import 'leaflet/dist/leaflet.css';

/* App theme */
import './theme/variables.css';
import './theme/ui.css';

import { queryClient } from './lib/queryClient';
import { env } from './lib/env';
import { AuthProvider, useAuth } from './lib/auth/AuthContext';
import { usePermissions } from './lib/usePermissions';
import { GRANTABLE_PAGES, type AdminPage } from './lib/permissions';
import { ROUTES } from './lib/routes';
import type { Role } from './lib/types';
import NotConfigured from './components/NotConfigured';
import LoadingScreen from './components/LoadingScreen';
import AppMenu from './components/AppMenu';
import ServerDown from './components/ServerDown';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import SettingsGate from './components/SettingsGate';
import { useServerReachable } from './lib/useServerReachable';
import { pingServer } from './lib/serverStatus';
import { requestStartupPermissions } from './lib/permissions/startup';
import { useClockSync } from './lib/clock';
import { useApplyTerminology } from './lib/branding';

import LoginPage from './pages/auth/LoginPage';
import FaceEnrollmentPage from './pages/auth/FaceEnrollmentPage';
import MemberHome from './pages/member/MemberHome';
import CheckInPage from './pages/member/CheckInPage';
import HistoryPage from './pages/member/HistoryPage';
import MemberQrPage from './pages/member/MemberQrPage';
import MemberChangePasswordPage from './pages/member/MemberChangePasswordPage';
import MemberProfilePage from './pages/member/MemberProfilePage';
import MemberRosterMakerPage from './pages/member/MemberRosterMakerPage';
import MemberFaceToolPage from './pages/member/MemberFaceToolPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import GroupsPage from './pages/admin/GroupsPage';
import BranchesPage from './pages/admin/BranchesPage';
import MembersPage from './pages/admin/MembersPage';
import RosterPage from './pages/admin/RosterPage';
import AdminsPage from './pages/admin/AdminsPage';
import BackupPage from './pages/admin/BackupPage';
import AttendanceReviewPage from './pages/admin/AttendanceReviewPage';
import LivePresencePage from './pages/admin/LivePresencePage';
import AuditPage from './pages/admin/AuditPage';
import FaceTestPage from './pages/admin/FaceTestPage';
import FaceImagesPage from './pages/admin/FaceImagesPage';
import MemberLookupPage from './pages/admin/MemberLookupPage';
import PresenceConfirmModal from './components/PresenceConfirmModal';
import PermissionBanner from './components/PermissionBanner';
import SettingsPage from './pages/admin/SettingsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import RosterMakerPage from './pages/admin/RosterMakerPage';
import QRPage from './pages/manager/QRPage';
import ShiftsPage from './pages/admin/ShiftsPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';

setupIonicReact();

/** Refetch page data on every navigation (Ionic keeps pages mounted, so they
 *  don't refetch on their own when re-opened). */
function RouteWatcher() {
  const location = useLocation();
  const qc = useQueryClient();
  useEffect(() => {
    void qc.invalidateQueries();
  }, [location.pathname, qc]);
  return null;
}

/** When auth state flips (sign in / out), the outlet tree swaps but the URL
 *  doesn't — Ionic won't re-run the outlet's redirect on that swap. Push an
 *  explicit navigation so the active shell can land the user on the right page
 *  without needing a manual refresh. */
function AuthRedirector() {
  const { loading, session } = useAuth();
  const history = useHistory();
  const location = useLocation();
  useEffect(() => {
    if (loading) return;
    if (session && location.pathname === ROUTES.login) {
      history.replace('/'); // the active shell redirects '/' to its landing page
    } else if (!session && location.pathname !== ROUTES.login) {
      history.replace(ROUTES.login);
    }
  }, [loading, session, location.pathname, history]);
  return null;
}

function MemberShell() {
  const { t } = useTranslation();
  const { member, isEnrolled } = useAuth();
  const canQr = !!member?.can_generate_qr;
  const canRosterMaker = !!member?.can_make_roster;
  const canResetFace = !!member?.can_reset_face;
  // Request camera + location up front (once per app open) so the member isn't
  // interrupted by prompts mid check-in. A persistent banner (below) warns while
  // any is still missing.
  useEffect(() => {
    void requestStartupPermissions();
  }, []);
  // Face enrollment is the first priority: until it's done the member lands on
  // the enroll tab, and check-in itself prompts them to enroll first.
  const landing = isEnrolled ? ROUTES.member.home : ROUTES.enroll;
  return (
    <>
    <PermissionBanner />
    <PresenceConfirmModal />
    <IonTabs>
      {/* NOTE: Ionic's StackManager calls `.props` on every child of an
          IonRouterOutlet, so a falsy child (`{canQr && <Route/>}` → `false`)
          crashes it. Build the children as an array and filter out falsies. */}
      <IonRouterOutlet>
        {[
          <Route key="home" exact path={ROUTES.member.home} component={MemberHome} />,
          <Route key="checkin" exact path={ROUTES.member.checkIn} component={CheckInPage} />,
          <Route key="enroll" exact path={ROUTES.enroll} component={FaceEnrollmentPage} />,
          <Route key="history" exact path={ROUTES.member.history} component={HistoryPage} />,
          <Route key="profile" exact path={ROUTES.member.profile} component={MemberProfilePage} />,
          <Route
            key="chpw"
            exact
            path={ROUTES.member.changePassword}
            component={MemberChangePasswordPage}
          />,
          canQr && (
            <Route key="qr" exact path={ROUTES.member.qr} component={MemberQrPage} />
          ),
          canRosterMaker && (
            <Route key="rmaker" exact path={ROUTES.member.rosterMaker} component={MemberRosterMakerPage} />
          ),
          canResetFace && (
            <Route key="facetool" exact path={ROUTES.member.faceTool} component={MemberFaceToolPage} />
          ),
          <Route key="root" exact path="/">
            <Redirect to={landing} />
          </Route>,
          // Any other path (e.g. /login after sign-in) lands on the priority page.
          <Route key="catch" render={() => <Redirect to={landing} />} />,
        ].filter(Boolean)}
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="tabs-scroll">
        <IonTabButton tab="home" href={ROUTES.member.home}>
          <IonIcon icon={home} />
          <IonLabel>{t('nav.home')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="checkin" href={ROUTES.member.checkIn}>
          <IonIcon icon={shieldCheckmark} />
          <IonLabel>{t('nav.checkIn')}</IonLabel>
        </IonTabButton>
        {/* Enrollment tab sits right after check-in and is always available;
            its own page reflects whether the member already has a face print. */}
        <IonTabButton tab="enroll" href={ROUTES.enroll}>
          <IonIcon icon={scanCircle} />
          <IonLabel>{t('nav.enroll')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="history" href={ROUTES.member.history}>
          <IonIcon icon={time} />
          <IonLabel>{t('nav.history')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href={ROUTES.member.profile}>
          <IonIcon icon={personCircle} />
          <IonLabel>{t('nav.profile')}</IonLabel>
        </IonTabButton>
        {canQr && (
          <IonTabButton tab="qr" href={ROUTES.member.qr}>
            <IonIcon icon={qrCode} />
            <IonLabel>{t('nav.qr')}</IonLabel>
          </IonTabButton>
        )}
        {canRosterMaker && (
          <IonTabButton tab="rmaker" href={ROUTES.member.rosterMaker}>
            <IonIcon icon={constructOutline} />
            <IonLabel>{t('nav.rosterMaker')}</IonLabel>
          </IonTabButton>
        )}
        {canResetFace && (
          <IonTabButton tab="facetool" href={ROUTES.member.faceTool}>
            <IonIcon icon={scanCircle} />
            <IonLabel>{t('faceTool.tab')}</IonLabel>
          </IonTabButton>
        )}
      </IonTabBar>
    </IonTabs>
    </>
  );
}

function AdminShell({ role }: { role: Role }) {
  const { superadmin, canPage } = usePermissions();
  const show = (p: AdminPage) => superadmin || canPage(p);
  const landing = superadmin
    ? ROUTES.admin.dashboard
    : ROUTES.admin[GRANTABLE_PAGES.find((p) => canPage(p)) ?? 'dashboard'];
  return (
    <IonSplitPane contentId="main">
      <AppMenu role={role} />
      {/* Array + filter(Boolean): falsy children crash Ionic's StackManager. */}
      <IonRouterOutlet id="main">
        {[
          show('dashboard') && <Route key="dashboard" exact path={ROUTES.admin.dashboard} component={AdminDashboard} />,
          show('groups') && <Route key="groups" exact path={ROUTES.admin.groups} component={GroupsPage} />,
          show('branches') && <Route key="branches" exact path={ROUTES.admin.branches} component={BranchesPage} />,
          show('members') && <Route key="members" exact path={ROUTES.admin.members} component={MembersPage} />,
          show('rosters') && <Route key="rosters" exact path={ROUTES.admin.rosters} component={RosterPage} />,
          show('review') && <Route key="review" exact path={ROUTES.admin.review} component={AttendanceReviewPage} />,
          show('audit') && <Route key="audit" exact path={ROUTES.admin.audit} component={AuditPage} />,
          show('presence') && <Route key="presence" exact path={ROUTES.admin.presence} component={LivePresencePage} />,
          show('faceTest') && <Route key="face-test" exact path={ROUTES.admin.faceTest} component={FaceTestPage} />,
          show('faceImages') && <Route key="face-images" exact path={ROUTES.admin.faceImages} component={FaceImagesPage} />,
          show('memberLookup') && <Route key="member-lookup" exact path={ROUTES.admin.memberLookup} component={MemberLookupPage} />,
          <Route key="qr" exact path={ROUTES.admin.qr} component={QRPage} />,
          <Route key="rmaker" exact path={ROUTES.admin.rosterMaker} component={RosterMakerPage} />,
          <Route key="profile" exact path={ROUTES.admin.profile} component={AdminProfilePage} />,
          superadmin && <Route key="shifts" exact path={ROUTES.admin.shifts} component={ShiftsPage} />,
          superadmin && <Route key="departments" exact path={ROUTES.admin.departments} component={DepartmentsPage} />,
          superadmin && <Route key="admins" exact path={ROUTES.admin.admins} component={AdminsPage} />,
          superadmin && <Route key="settings" exact path={ROUTES.admin.settings} component={SettingsPage} />,
          superadmin && <Route key="backup" exact path={ROUTES.admin.backup} component={BackupPage} />,
          <Route key="catch" render={() => <Redirect to={landing} />} />,
        ].filter(Boolean)}
      </IonRouterOutlet>
    </IonSplitPane>
  );
}

function AppRoutes() {
  const { loading, session, role } = useAuth();
  // Gate the clock fetch on auth being resolved so the FIRST sample uses the
  // signed-in identity (a member's frozen clock, if set), not a signed-out one.
  useClockSync(!loading); // keep the single app clock synced to the server
  useApplyTerminology(); // swap member/student/employee wording per org setting

  if (loading) return <LoadingScreen />;

  if (!session) {
    return (
      <IonRouterOutlet>
        <Route exact path={ROUTES.login} component={LoginPage} />
        <Route render={() => <Redirect to={ROUTES.login} />} />
      </IonRouterOutlet>
    );
  }

  // Face enrollment is still the first priority, but it now lives as a tab
  // inside the member shell (MemberShell lands unenrolled members there and
  // check-in prompts them to enroll) rather than a full-screen dead-end.
  // Everything past auth relies on the global settings — gate on them loading.
  const shell =
    role === 'member' ? (
      <MemberShell />
    ) : role === 'manager' ? (
      <ManagerShell />
    ) : (
      <AdminShell role={role ?? 'admin'} />
    );
  return <SettingsGate>{shell}</SettingsGate>;
}

/** Renders the full-screen "server unreachable" overlay only when the backend
 *  can't be reached AT APP OPEN (a one-time startup check) — not on every failed
 *  request. A 500 from a normal API/edge call never triggers it. */
function ConnectivityOverlay() {
  const reachable = useServerReachable();
  useEffect(() => {
    void pingServer(); // single connectivity probe at startup
  }, []);
  return reachable ? null : <ServerDown />;
}

function ManagerShell() {
  return (
    <IonRouterOutlet>
      <Route exact path={ROUTES.manager.qr} component={QRPage} />
      <Route render={() => <Redirect to={ROUTES.manager.qr} />} />
    </IonRouterOutlet>
  );
}

export default function App() {
  if (!env.isConfigured) {
    return (
      <IonApp>
        <NotConfigured />
      </IonApp>
    );
  }

  return (
    <IonApp>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <IonReactRouter>
              <RouteWatcher />
              <AuthRedirector />
              <AppRoutes />
            </IonReactRouter>
            <ConnectivityOverlay />
            <InstallPrompt />
            <UpdatePrompt />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </IonApp>
  );
}
