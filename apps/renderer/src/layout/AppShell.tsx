import { type ReactNode } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
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
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth-context';
import { useLicense } from '../state/license-context';
import { useModules } from '../state/modules-context';
import { SecondaryButton } from '../components/buttons';
import { UpdateBanner } from '../components/UpdateBanner';
import type { WarningLevel } from '../api/types';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  requiredPermission?: string;
  requiredModule?: string;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Sales',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
      { path: '/pos', label: 'POS Terminal', icon: <PointOfSaleIcon /> },
    ],
  },
  {
    label: 'Catalog & Stock',
    items: [
      { path: '/catalog', label: 'Catalog', icon: <CategoryIcon />, requiredPermission: 'product.manage' },
      { path: '/inventory', label: 'Inventory', icon: <InventoryIcon />, requiredPermission: 'inventory.adjust' },
      { path: '/promotions', label: 'Promotions', icon: <LocalOfferIcon />, requiredPermission: 'settings.manage' },
    ],
  },
  {
    label: 'Partners & Buying',
    items: [
      { path: '/customers', label: 'Customers', icon: <PeopleIcon />, requiredPermission: 'customer.manage' },
      { path: '/suppliers', label: 'Suppliers', icon: <LocalShippingIcon />, requiredPermission: 'supplier.manage' },
      { path: '/purchasing', label: 'Purchasing', icon: <ShoppingCartIcon />, requiredPermission: 'purchase.manage' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { path: '/reports', label: 'Reports', icon: <AssessmentIcon />, requiredPermission: 'report.view' },
      { path: '/accounting', label: 'Accounting', icon: <AccountBalanceIcon />, requiredPermission: 'expense.manage' },
    ],
  },
  {
    label: 'Hospital',
    items: [
      { path: '/hospital/doctors', label: 'Doctors', icon: <LocalHospitalIcon />, requiredPermission: 'hospital.doctor.manage', requiredModule: 'hospital' },
      { path: '/hospital/patients', label: 'Patients', icon: <BadgeIcon />, requiredPermission: 'hospital.patient.manage', requiredModule: 'hospital' },
      { path: '/hospital/appointments', label: 'Appointments', icon: <EventAvailableIcon />, requiredPermission: 'hospital.appointment.manage', requiredModule: 'hospital' },
      { path: '/hospital/queue', label: 'Token Queue', icon: <ConfirmationNumberIcon />, requiredModule: 'hospital' },
      { path: '/hospital/reports', label: 'Doctor Reports', icon: <SummarizeIcon />, requiredPermission: 'hospital.report.view', requiredModule: 'hospital' },
    ],
  },
  {
    label: 'System',
    items: [{ path: '/settings', label: 'Settings', icon: <SettingsIcon /> }],
  },
];

const BANNER_SEVERITY: Record<Exclude<WarningLevel, 'none'>, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
};

const DRAWER_WIDTH = 232;

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { status } = useLicense();
  const { isModuleEnabled } = useModules();

  const permissions = user?.permissions ?? [];
  const hasAll = permissions.includes('ALL') || permissions.includes('*');

  // PHP backend uses different codes than NestJS — accept either
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
        (hasAll || !item.requiredPermission || hasPerm(item.requiredPermission)) &&
        (!item.requiredModule || isModuleEnabled(item.requiredModule)),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <UpdateBanner />
      {status && status.warningLevel !== 'none' && (
        <Alert severity={BANNER_SEVERITY[status.warningLevel]} sx={{ borderRadius: 0 }}>
          {status.message}
        </Alert>
      )}
      <Box display="flex" flex={1} minHeight={0}>
        <Drawer
          variant="permanent"
          sx={{ width: DRAWER_WIDTH, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid', borderColor: 'divider', position: 'relative' } }}
        >
          <Toolbar>
            <Typography variant="h6">Vantage POS</Typography>
          </Toolbar>
          <Box flex={1} overflow="auto" px={1}>
            {visibleGroups.map((group, groupIdx) => (
              <Box key={group.label} mb={0.5}>
                {groupIdx > 0 && <Divider sx={{ my: 1 }} />}
                <List
                  dense
                  subheader={
                    <ListSubheader sx={{ lineHeight: 2, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.5 }}>
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
                          borderRadius: 1.5,
                          mb: 0.25,
                          borderLeft: '3px solid',
                          borderLeftColor: active ? 'primary.main' : 'transparent',
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'inherit' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{ fontWeight: active ? 700 : 500 }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Box>
        </Drawer>
        <Box flex={1} display="flex" flexDirection="column" minWidth={0}>
          <AppBar position="static" color="default" elevation={1}>
            <Toolbar sx={{ gap: 2 }}>
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {user?.branchName}
              </Typography>
              <Typography variant="body2">{user?.fullName}</Typography>
              <SecondaryButton size="small" onClick={logout}>
                Sign out
              </SecondaryButton>
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
