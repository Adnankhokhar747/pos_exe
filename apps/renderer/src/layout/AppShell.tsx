import { type ReactNode, useState, useEffect } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CategoryIcon from '@mui/icons-material/Category';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import BadgeIcon from '@mui/icons-material/Badge';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import SummarizeIcon from '@mui/icons-material/Summarize';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PaymentsIcon from '@mui/icons-material/Payments';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth-context';
import { useLicense } from '../state/license-context';
import { useModules } from '../state/modules-context';
import { UpdateBanner } from '../components/UpdateBanner';
import type { WarningLevel } from '../api/types';

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  requiredPermission?: string;
  requiredModule?: string;
  offlineAllowed?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** If true, group header is clickable and collapses/expands sub-items */
  collapsible?: boolean;
  /** Icon shown in collapsible group header */
  groupIcon?: ReactNode;
  /** Collapsible groups with this flag default to open on first load */
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Sales',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
      { path: '/pos', label: 'POS Terminal', icon: <PointOfSaleIcon fontSize="small" />, offlineAllowed: true },
    ],
  },
  {
    label: 'Catalog & Stock',
    collapsible: true,
    groupIcon: <CategoryIcon fontSize="small" />,
    items: [
      { path: '/catalog',    label: 'Catalog',    icon: <CategoryIcon fontSize="small" />,   requiredPermission: 'product.manage' },
      { path: '/inventory',  label: 'Inventory',  icon: <InventoryIcon fontSize="small" />,  requiredPermission: 'inventory.adjust' },
      { path: '/promotions', label: 'Promotions', icon: <LocalOfferIcon fontSize="small" />, requiredPermission: 'settings.manage' },
    ],
  },
  {
    label: 'Partners & Buying',
    collapsible: true,
    groupIcon: <PeopleIcon fontSize="small" />,
    items: [
      { path: '/customers', label: 'Customers', icon: <PeopleIcon fontSize="small" />,        requiredPermission: 'customer.manage' },
      { path: '/suppliers', label: 'Suppliers', icon: <LocalShippingIcon fontSize="small" />, requiredPermission: 'supplier.manage' },
      { path: '/purchasing',label: 'Purchasing',icon: <ShoppingCartIcon fontSize="small" />,  requiredPermission: 'purchase.manage' },
    ],
  },
  {
    label: 'Insights',
    collapsible: true,
    groupIcon: <AssessmentIcon fontSize="small" />,
    items: [
      { path: '/reports',    label: 'Reports',    icon: <AssessmentIcon fontSize="small" />,     requiredPermission: 'report.view' },
      { path: '/accounting', label: 'Accounting', icon: <AccountBalanceIcon fontSize="small" />, requiredPermission: 'expense.manage' },
    ],
  },
  // ── Plugin modules — collapsed by default, expand only when needed ──
  {
    label: 'Hospital',
    collapsible: true,
    groupIcon: <LocalHospitalIcon fontSize="small" />,
    items: [
      { path: '/hospital/doctors',      label: 'Doctors',       icon: <LocalHospitalIcon fontSize="small" />,    requiredPermission: 'hospital.doctor.manage',      requiredModule: 'hospital' },
      { path: '/hospital/patients',     label: 'Patients',      icon: <BadgeIcon fontSize="small" />,            requiredPermission: 'hospital.patient.manage',     requiredModule: 'hospital' },
      { path: '/hospital/appointments', label: 'Appointments',  icon: <EventAvailableIcon fontSize="small" />,   requiredPermission: 'hospital.appointment.manage', requiredModule: 'hospital' },
      { path: '/hospital/queue',        label: 'Token Queue',   icon: <ConfirmationNumberIcon fontSize="small" />,                                                   requiredModule: 'hospital' },
      { path: '/hospital/reports',      label: 'Doctor Reports',icon: <SummarizeIcon fontSize="small" />,        requiredPermission: 'hospital.report.view',        requiredModule: 'hospital' },
    ],
  },
  {
    label: 'Lease',
    collapsible: true,
    groupIcon: <HomeWorkIcon fontSize="small" />,
    items: [
      { path: '/lease/dashboard',   label: 'Dashboard',   icon: <DashboardIcon fontSize="small" />,   requiredModule: 'lease' },
      { path: '/lease/agreements',  label: 'Agreements',  icon: <HandshakeIcon fontSize="small" />,  requiredModule: 'lease', requiredPermission: 'lease.agreement.manage' },
      { path: '/lease/reports',     label: 'Reports',     icon: <PaymentsIcon fontSize="small" />,   requiredModule: 'lease', requiredPermission: 'lease.report.view' },
    ],
  },
  {
    label: 'E-Invoice',
    collapsible: true,
    groupIcon: <ReceiptLongIcon fontSize="small" />,
    items: [
      { path: '/einvoice/settings', label: 'ZATCA Settings', icon: <ReceiptLongIcon fontSize="small" />, requiredModule: 'einvoice' },
    ],
  },
  {
    label: 'System',
    items: [{ path: '/settings', label: 'Settings', icon: <SettingsIcon fontSize="small" />, offlineAllowed: true }],
  },
];

const BANNER_SEVERITY: Record<Exclude<WarningLevel, 'none'>, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
};

const DRAWER_WIDTH = 210;

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { status, isOffline, offlineDaysRemaining } = useLicense();
  const { isModuleEnabled } = useModules();

  const permissions = user?.permissions ?? [];
  const hasAll = permissions.includes('ALL') || permissions.includes('*');

  const PHP_ALIASES: Record<string, string> = {
    'product.write': 'product.manage',
    'stock.adjust': 'inventory.adjust',
    'stock.transfer': 'inventory.manage',
    'settings.write': 'settings.manage',
    'customer.write': 'customer.manage',
    'supplier.write': 'supplier.manage',
    'purchase.create': 'purchase.manage',
    'report.financial.view': 'report.view',
    'accounting.write': 'expense.manage',
  };

  function hasPerm(code: string): boolean {
    return permissions.includes(code) || permissions.includes(PHP_ALIASES[code] ?? '');
  }

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!isOffline || (item.offlineAllowed ?? false)) &&
        (hasAll || !item.requiredPermission || hasPerm(item.requiredPermission)) &&
        (!item.requiredModule || isModuleEnabled(item.requiredModule)),
    ),
  })).filter((group) => group.items.length > 0);

  // Auto-expand: defaultOpen groups + whichever group contains the current route
  const activeGroupLabel = NAV_GROUPS.find(
    (g) => g.collapsible && g.items.some((i) => location.pathname.startsWith(i.path)),
  )?.label;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupLabel ? [activeGroupLabel] : []),
  );

  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroups((prev) => {
        if (prev.has(activeGroupLabel)) return prev;
        return new Set([...prev, activeGroupLabel]);
      });
    }
  }, [activeGroupLabel]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <UpdateBanner />
      {status && status.warningLevel !== 'none' && (
        <Alert severity={BANNER_SEVERITY[status.warningLevel]} sx={{ borderRadius: 0 }}>
          {status.message}
        </Alert>
      )}
      {isOffline && (
        <Alert severity="warning" icon={<WifiOffIcon fontSize="inherit" />} sx={{ borderRadius: 0 }}>
          You are offline — only POS Terminal is available. Cached license valid for{' '}
          {offlineDaysRemaining} more day{offlineDaysRemaining !== 1 ? 's' : ''}.
        </Alert>
      )}
      <Box display="flex" flex={1} minHeight={0}>
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              borderRight: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 48 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>Vantage POS</Typography>
          </Toolbar>

          <Box flex={1} overflow="auto" px={0.75} pb={1}>
            {visibleGroups.map((group, groupIdx) => {
              const isOpen = openGroups.has(group.label);
              const hasActiveChild = group.items.some((i) => location.pathname.startsWith(i.path));

              if (group.collapsible) {
                return (
                  <Box key={group.label}>
                    <Divider sx={{ my: 0.5 }} />
                    {/* Collapsible module group header */}
                    <ListItemButton
                      onClick={() => toggleGroup(group.label)}
                      sx={{
                        borderRadius: 1,
                        py: 0.6,
                        px: 1,
                        mb: 0.25,
                        bgcolor: hasActiveChild && !isOpen ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 28, color: hasActiveChild ? 'primary.main' : 'text.secondary' }}>
                        {group.groupIcon}
                      </ListItemIcon>
                      <ListItemText
                        primary={group.label}
                        primaryTypographyProps={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: 0.3,
                          color: hasActiveChild ? 'primary.main' : 'text.secondary',
                          noWrap: true,
                        }}
                      />
                      {isOpen
                        ? <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        : <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                    </ListItemButton>

                    {/* Sub-items */}
                    <Collapse in={isOpen} timeout="auto" unmountOnExit>
                      <List dense disablePadding sx={{ pl: 1 }}>
                        {group.items.map((item) => {
                          const active = location.pathname.startsWith(item.path);
                          return (
                            <ListItemButton
                              key={item.path}
                              selected={active}
                              onClick={() => navigate(item.path)}
                              sx={{
                                borderRadius: 1,
                                mb: 0.25,
                                py: 0.5,
                                px: 1,
                                borderLeft: '2px solid',
                                borderLeftColor: active ? 'primary.main' : 'transparent',
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 28, color: active ? 'primary.main' : 'text.secondary' }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.label}
                                primaryTypographyProps={{
                                  fontSize: '0.8rem',
                                  fontWeight: active ? 700 : 400,
                                  noWrap: true,
                                }}
                              />
                            </ListItemButton>
                          );
                        })}
                      </List>
                    </Collapse>
                  </Box>
                );
              }

              // Regular (non-collapsible) group
              return (
                <Box key={group.label} mb={0.25}>
                  {groupIdx > 0 && <Divider sx={{ my: 0.5 }} />}
                  <List
                    dense
                    disablePadding
                    subheader={
                      <ListSubheader
                        disableGutters
                        sx={{
                          px: 1,
                          lineHeight: '24px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: 0.6,
                          color: 'text.disabled',
                          bgcolor: 'transparent',
                        }}
                      >
                        {group.label.toUpperCase()}
                      </ListSubheader>
                    }
                  >
                    {group.items.map((item) => {
                      const active = location.pathname.startsWith(item.path);
                      return (
                        <ListItemButton
                          key={item.path}
                          selected={active}
                          onClick={() => navigate(item.path)}
                          sx={{
                            borderRadius: 1,
                            mb: 0.25,
                            py: 0.5,
                            px: 1,
                            borderLeft: '2px solid',
                            borderLeftColor: active ? 'primary.main' : 'transparent',
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28, color: active ? 'primary.main' : 'text.secondary' }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: '0.8rem',
                              fontWeight: active ? 700 : 400,
                              noWrap: true,
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Box>
              );
            })}
          </Box>
        </Drawer>

        <Box flex={1} display="flex" flexDirection="column" minWidth={0}>
          <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar sx={{ minHeight: '40px !important', px: 2, gap: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1, color: 'text.secondary', fontSize: '0.78rem' }}>
                {user?.branchName}
              </Typography>

              {/* Profile button */}
              <IconButton
                size="small"
                onClick={(e) => setProfileAnchor(e.currentTarget)}
                sx={{ borderRadius: 1.5, px: 1, py: 0.4, gap: 0.75, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem', bgcolor: 'primary.main', fontWeight: 700 }}>
                  {user?.fullName ? getInitials(user.fullName) : '?'}
                </Avatar>
                <Typography variant="body2" fontWeight={500} fontSize="0.78rem" noWrap sx={{ maxWidth: 140 }}>
                  {user?.fullName}
                </Typography>
                <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              </IconButton>

              {/* Profile dropdown */}
              <Menu
                anchorEl={profileAnchor}
                open={Boolean(profileAnchor)}
                onClose={() => setProfileAnchor(null)}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{ paper: { sx: { minWidth: 180, mt: 0.5 } } }}
              >
                <Box px={2} py={1}>
                  <Typography variant="body2" fontWeight={700} noWrap>{user?.fullName}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{user?.branchName}</Typography>
                </Box>
                <Divider />
                <MenuItem
                  dense
                  onClick={() => { setProfileAnchor(null); logout(); }}
                  sx={{ gap: 1, color: 'error.main', fontSize: '0.82rem' }}
                >
                  <LogoutIcon fontSize="small" />
                  Sign Out
                </MenuItem>
              </Menu>
            </Toolbar>
          </AppBar>
          <Box flex={1} overflow="auto">
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
