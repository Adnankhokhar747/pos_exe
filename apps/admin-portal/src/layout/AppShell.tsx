import { type ReactNode } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth-context';
import { SecondaryButton } from '../components/buttons';

const NAV_ITEMS = [
  { path: '/companies', label: 'Companies', icon: <BusinessIcon /> },
  { path: '/plans', label: 'Plans', icon: <WorkspacePremiumIcon /> },
  { path: '/alerts', label: 'Alerts', icon: <NotificationsActiveIcon /> },
];

const DRAWER_WIDTH = 220;

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();

  return (
    <Box display="flex" height="100vh">
      <Drawer
        variant="permanent"
        sx={{ width: DRAWER_WIDTH, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid', borderColor: 'divider', position: 'relative' } }}
      >
        <Toolbar>
          <Typography variant="h6">Super Admin</Typography>
        </Toolbar>
        <Box flex={1} overflow="auto" px={1}>
          <List dense>
            {NAV_ITEMS.map((item) => {
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
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>
      <Box flex={1} display="flex" flexDirection="column" minWidth={0}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ gap: 2 }}>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              Vantage POS — Platform
            </Typography>
            <Typography variant="body2">{admin?.fullName}</Typography>
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
  );
}
