import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  business,
  calendar,
  calendarNumber,
  constructOutline,
  gitBranchOutline,
  home,
  imagesOutline,
  searchOutline,
  logOut,
  people,
  personCircle,
  pulseOutline,
  qrCodeOutline,
  scanOutline,
  settings,
  shieldCheckmark,
  timeOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Role } from '../lib/types';
import type { AdminPage } from '../lib/permissions';
import { useAuth } from '../lib/auth/AuthContext';
import { useConfirmSignOut } from '../lib/auth/useConfirmSignOut';
import { usePermissions } from '../lib/usePermissions';
import { ROUTES } from '../lib/routes';
import Avatar from './ui/Avatar';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import PoweredBy from './PoweredBy';

interface Item {
  path: string;
  labelKey: string;
  icon: string;
  page: AdminPage;
}

/**
 * Every admin screen, in sidebar order, each naming the page grant it needs.
 *
 * One list for everyone. A superadmin holds every page, so they see all of
 * it; an admin sees the entries the superadmin granted them — and nothing
 * before a grant is made. There is no "always shown" entry any more: the
 * location-bypass QR and the roster maker used to bypass the grants entirely,
 * which is exactly the kind of screen a grant exists to withhold.
 */
const MENU: Item[] = [
  { path: ROUTES.admin.dashboard, labelKey: 'nav.dashboard', icon: home, page: 'dashboard' },
  { path: ROUTES.admin.groups, labelKey: 'nav.groups', icon: calendar, page: 'groups' },
  { path: ROUTES.admin.branches, labelKey: 'nav.branches', icon: business, page: 'branches' },
  // Departments sit directly under Branches (hospitals).
  { path: ROUTES.admin.departments, labelKey: 'nav.departments', icon: gitBranchOutline, page: 'departments' },
  { path: ROUTES.admin.members, labelKey: 'nav.members', icon: people, page: 'members' },
  { path: ROUTES.admin.rosters, labelKey: 'nav.rosters', icon: calendarNumber, page: 'rosters' },
  { path: ROUTES.admin.rosterMaker, labelKey: 'nav.rosterMaker', icon: constructOutline, page: 'rosters' },
  { path: ROUTES.admin.review, labelKey: 'nav.review', icon: shieldCheckmark, page: 'review' },
  { path: ROUTES.admin.audit, labelKey: 'nav.audit', icon: documentTextOutline, page: 'audit' },
  { path: ROUTES.admin.presence, labelKey: 'nav.presence', icon: pulseOutline, page: 'presence' },
  { path: ROUTES.admin.faceTest, labelKey: 'nav.faceTest', icon: scanOutline, page: 'faceTest' },
  { path: ROUTES.admin.memberLookup, labelKey: 'nav.memberLookup', icon: searchOutline, page: 'memberLookup' },
  { path: ROUTES.admin.faceImages, labelKey: 'nav.faceImages', icon: imagesOutline, page: 'faceImages' },
  { path: ROUTES.admin.qr, labelKey: 'nav.qr', icon: qrCodeOutline, page: 'qr' },
  { path: ROUTES.admin.shifts, labelKey: 'nav.shifts', icon: timeOutline, page: 'shifts' },
  { path: ROUTES.admin.settings, labelKey: 'nav.settings', icon: settings, page: 'settings' },
  { path: ROUTES.admin.admins, labelKey: 'nav.admins', icon: personCircle, page: 'admins' },
  { path: ROUTES.admin.backup, labelKey: 'nav.backup', icon: shieldCheckmark, page: 'backup' },
];

export default function AppMenu({ role }: { role: Role }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const confirmSignOut = useConfirmSignOut();
  const { canPage } = usePermissions();
  const { pathname } = useLocation();

  const items = MENU.filter((it) => canPage(it.page));

  return (
    <>
      <IonMenu contentId="main" type="overlay">
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{t('common.appName')}</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
            <LanguageToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonMenuToggle autoHide={false}>
            <IonItem
              lines="full"
              button
              detail
              routerLink={ROUTES.admin.profile}
              routerDirection="root"
              className={pathname === ROUTES.admin.profile ? 'menu-active' : ''}
            >
              {/* The signed-in admin's own photo; initials stand in when there
                  isn't one. */}
              <div slot="start" style={{ marginInlineEnd: 10 }}>
                <Avatar name={profile?.full_name} src={profile?.avatar_url} size={38} />
              </div>
              <IonLabel>
                <h3>{profile?.full_name}</h3>
                <IonNote>{t(`roles.${role}`)}</IonNote>
              </IonLabel>
            </IonItem>
          </IonMenuToggle>

          {items.map((it) => (
            <IonMenuToggle key={it.path} autoHide={false}>
              <IonItem
                routerLink={it.path}
                routerDirection="root"
                detail={false}
                className={pathname === it.path ? 'menu-active' : ''}
              >
                <IonIcon slot="start" icon={it.icon} />
                <IonLabel>{t(it.labelKey)}</IonLabel>
              </IonItem>
            </IonMenuToggle>
          ))}

          <IonMenuToggle autoHide={false}>
            <IonItem button detail={false} onClick={() => void confirmSignOut()}>
              <IonIcon slot="start" icon={logOut} color="danger" />
              <IonLabel color="danger">{t('common.logout')}</IonLabel>
            </IonItem>
          </IonMenuToggle>
        </IonList>
        <PoweredBy />
      </IonContent>
      </IonMenu>
    </>
  );
}
