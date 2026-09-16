import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { BrandLogo } from '../components/BrandLogo';
import { RoleSelectScreen } from '../screens/auth/RoleSelectScreen';
import { StaffLoginScreen } from '../screens/auth/StaffLoginScreen';
import { PatientLoginScreen } from '../screens/auth/PatientLoginScreen';
import { StaffDashboardScreen } from '../screens/staff/StaffDashboardScreen';
import { StaffScheduleScreen } from '../screens/staff/StaffScheduleScreen';
import { StaffSkilledNurseVisitScreen } from '../screens/staff/StaffSkilledNurseVisitScreen';
import { StaffHhaVisitNoteScreen } from '../screens/staff/StaffHhaVisitNoteScreen';
import { StaffMissedVisitNoteScreen } from '../screens/staff/StaffMissedVisitNoteScreen';
import { StaffPlanOfCareScreen } from '../screens/staff/StaffPlanOfCareScreen';
import { StaffAddProblemStatementScreen } from '../screens/staff/StaffAddProblemStatementScreen';
import { StaffWoundManagerScreen } from '../screens/staff/StaffWoundManagerScreen';
import { StaffNewWoundOrderScreen } from '../screens/staff/StaffNewWoundOrderScreen';
import { StaffWoundOrderProfilesScreen } from '../screens/staff/StaffWoundOrderProfilesScreen';
import { StaffPatientsScreen } from '../screens/staff/StaffPatientsScreen';
import { StaffPatientDetailScreen } from '../screens/staff/StaffPatientDetailScreen';
import { StaffMessagesScreen } from '../screens/staff/StaffMessagesScreen';
import {
  StaffAvailableShiftsScreen,
  StaffShiftOffersScreen,
} from '../screens/staff/StaffShiftMarketplaceScreens';
import { StaffLicensesScreen } from '../screens/staff/StaffLicensesScreen';
import { StaffPayrollScreen } from '../screens/staff/StaffPayrollScreen';
import { StaffEvvClockInScreen } from '../screens/staff/StaffEvvClockInScreen';
import { StaffEvvNursingNoteScreen } from '../screens/staff/StaffEvvNursingNoteScreen';
import { StaffEvvClockOutScreen } from '../screens/staff/StaffEvvClockOutScreen';
import {
  StaffMenuHomeScreen,
  StaffMenuAccountScreen,
  StaffMenuInfoScreen,
  StaffMenuBadgeScreen,
  StaffMenuTimeScreen,
  StaffMenuMileageScreen,
  StaffMenuEvvScreen,
  StaffMenuSwitchAgencyScreen,
} from '../screens/staff/StaffMenuScreen';
import { StaffMenuRouteVisitsScreen } from '../screens/staff/StaffRouteVisitsScreen';
import { PatientHomeScreen } from '../screens/patient/PatientHomeScreen';
import { PatientScheduleScreen } from '../screens/patient/PatientScheduleScreen';
import { PatientMedsScreen } from '../screens/patient/PatientMedsScreen';
import {
  PatientMessagesScreen,
  PatientProfileScreen,
  PatientCareTeamScreen,
  PatientCarePlansScreen,
  PatientNotificationsScreen,
  PatientGrievancesScreen,
} from '../screens/patient/PatientMoreScreens';
import type {
  AuthStackParamList,
  PatientHomeStackParamList,
  PatientTabParamList,
  StaffHomeStackParamList,
  StaffMenuStackParamList,
  StaffPatientsStackParamList,
  StaffScheduleStackParamList,
  StaffTabParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const StaffTabs = createBottomTabNavigator<StaffTabParamList>();
const StaffHomeStack = createNativeStackNavigator<StaffHomeStackParamList>();
const StaffPatientsStack = createNativeStackNavigator<StaffPatientsStackParamList>();
const StaffScheduleStack = createNativeStackNavigator<StaffScheduleStackParamList>();
const StaffMenuStack = createNativeStackNavigator<StaffMenuStackParamList>();
const PatientTabs = createBottomTabNavigator<PatientTabParamList>();
const PatientHomeStack = createNativeStackNavigator<PatientHomeStackParamList>();

function StaffHomeNavigator() {
  return (
    <StaffHomeStack.Navigator screenOptions={{ headerShown: false }}>
      <StaffHomeStack.Screen name="HomeMain" component={StaffDashboardScreen} />
      <StaffHomeStack.Screen name="RouteVisits" component={StaffMenuRouteVisitsScreen} />
      <StaffHomeStack.Screen name="ElectronicIdBadge" component={StaffMenuBadgeScreen} />
      <StaffHomeStack.Screen name="AvailableShifts" component={StaffAvailableShiftsScreen} />
      <StaffHomeStack.Screen name="ShiftOffers" component={StaffShiftOffersScreen} />
    </StaffHomeStack.Navigator>
  );
}

function StaffPatientsNavigator() {
  return (
    <StaffPatientsStack.Navigator screenOptions={{ headerShown: false }}>
      <StaffPatientsStack.Screen name="PatientsList" component={StaffPatientsScreen} />
      <StaffPatientsStack.Screen
        name="PatientDetail"
        component={StaffPatientDetailScreen}
        options={{ headerShown: false }}
      />
    </StaffPatientsStack.Navigator>
  );
}

function StaffScheduleNavigator() {
  return (
    <StaffScheduleStack.Navigator screenOptions={{ headerShown: false }}>
      <StaffScheduleStack.Screen name="ScheduleList" component={StaffScheduleScreen} />
      <StaffScheduleStack.Screen name="SkilledNurseVisit" component={StaffSkilledNurseVisitScreen} />
      <StaffScheduleStack.Screen name="HhaVisitNote" component={StaffHhaVisitNoteScreen} />
      <StaffScheduleStack.Screen name="MissedVisitNote" component={StaffMissedVisitNoteScreen} />
      <StaffScheduleStack.Screen name="PlanOfCareProfile" component={StaffPlanOfCareScreen} />
      <StaffScheduleStack.Screen name="AddProblemStatement" component={StaffAddProblemStatementScreen} />
      <StaffScheduleStack.Screen name="WoundManager" component={StaffWoundManagerScreen} />
      <StaffScheduleStack.Screen name="WoundOrderProfiles" component={StaffWoundOrderProfilesScreen} />
      <StaffScheduleStack.Screen name="NewWoundOrder" component={StaffNewWoundOrderScreen} />
    </StaffScheduleStack.Navigator>
  );
}

function StaffMenuNavigator() {
  return (
    <StaffMenuStack.Navigator screenOptions={{ headerShown: false }}>
      <StaffMenuStack.Screen name="MenuHome" component={StaffMenuHomeScreen} />
      <StaffMenuStack.Screen name="MenuAccount" component={StaffMenuAccountScreen} />
      <StaffMenuStack.Screen name="MenuNva" component={StaffMenuInfoScreen} />
      <StaffMenuStack.Screen name="MenuCovid" component={StaffMenuInfoScreen} />
      <StaffMenuStack.Screen name="MenuImmunizations" component={StaffMenuInfoScreen} />
      <StaffMenuStack.Screen name="MenuContact" component={StaffMenuInfoScreen} />
      <StaffMenuStack.Screen name="MenuCertification" component={StaffLicensesScreen} />
      <StaffMenuStack.Screen name="MenuUpdates" component={StaffMenuInfoScreen} />
      <StaffMenuStack.Screen name="MenuTime" component={StaffMenuTimeScreen} />
      <StaffMenuStack.Screen name="MenuPay" component={StaffPayrollScreen} />
      <StaffMenuStack.Screen name="MenuMileage" component={StaffMenuMileageScreen} />
      <StaffMenuStack.Screen name="MenuEvv" component={StaffMenuEvvScreen} />
      <StaffMenuStack.Screen name="MenuEvvClockIn" component={StaffEvvClockInScreen} />
      <StaffMenuStack.Screen name="MenuEvvNursingNote" component={StaffEvvNursingNoteScreen} />
      <StaffMenuStack.Screen name="MenuEvvClockOut" component={StaffEvvClockOutScreen} />
      <StaffMenuStack.Screen name="MenuSwitchAgency" component={StaffMenuSwitchAgencyScreen} />
    </StaffMenuStack.Navigator>
  );
}

function StaffApp() {
  return (
    <StaffTabs.Navigator
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brandMagenta,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Patients: 'person-circle-outline',
            Schedule: 'calendar-outline',
            Messages: 'mail-outline',
            Menu: 'menu',
          };
          return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <StaffTabs.Screen name="Home" component={StaffHomeNavigator} />
      <StaffTabs.Screen name="Patients" component={StaffPatientsNavigator} />
      <StaffTabs.Screen
        name="Schedule"
        component={StaffScheduleNavigator}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Schedule', { screen: 'ScheduleList' });
          },
        })}
      />
      <StaffTabs.Screen name="Messages" component={StaffMessagesScreen} />
      <StaffTabs.Screen
        name="Menu"
        component={StaffMenuNavigator}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Always return to the full Menu list (not a nested page like Certification).
            e.preventDefault();
            navigation.navigate('Menu', { screen: 'MenuHome' });
          },
        })}
      />
    </StaffTabs.Navigator>
  );
}

function PatientHomeNavigator() {
  return (
    <PatientHomeStack.Navigator
      screenOptions={{
        headerTintColor: colors.brandMagenta,
        headerTitleStyle: { fontWeight: '700', color: colors.ink },
      }}
    >
      <PatientHomeStack.Screen name="PatientHomeMain" component={PatientHomeScreen} options={{ title: 'Home' }} />
      <PatientHomeStack.Screen name="PatientMeds" component={PatientMedsScreen} options={{ title: 'Medications' }} />
      <PatientHomeStack.Screen name="PatientCarePlans" component={PatientCarePlansScreen} options={{ title: 'Care plans' }} />
      <PatientHomeStack.Screen name="PatientCareTeam" component={PatientCareTeamScreen} options={{ title: 'Care team' }} />
      <PatientHomeStack.Screen name="PatientNotifications" component={PatientNotificationsScreen} options={{ title: 'Notifications' }} />
      <PatientHomeStack.Screen name="PatientGrievances" component={PatientGrievancesScreen} options={{ title: 'Grievances' }} />
      <PatientHomeStack.Screen name="PatientProfile" component={PatientProfileScreen} options={{ title: 'Profile' }} />
    </PatientHomeStack.Navigator>
  );
}

function PatientApp() {
  return (
    <PatientTabs.Navigator
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: route.name === 'Home' ? false : true,
        headerTintColor: colors.brandMagenta,
        headerTitleStyle: { fontWeight: '700', color: colors.ink },
        tabBarActiveTintColor: colors.brandPink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Schedule: 'calendar',
            Meds: 'medkit',
            Messages: 'mail',
            Profile: 'person',
          };
          return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <PatientTabs.Screen name="Home" component={PatientHomeNavigator} options={{ headerShown: false }} />
      <PatientTabs.Screen name="Schedule" component={PatientScheduleScreen} />
      <PatientTabs.Screen name="Meds" component={PatientMedsScreen} />
      <PatientTabs.Screen name="Messages" component={PatientMessagesScreen} />
      <PatientTabs.Screen
        name="Profile"
        component={PatientProfileScreen}
        options={{ headerShown: false, title: 'Profile' }}
      />
    </PatientTabs.Navigator>
  );
}

function AuthApp() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <AuthStack.Screen name="StaffLogin" component={StaffLoginScreen} />
      <AuthStack.Screen name="PatientLogin" component={PatientLoginScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { ready, token, persona } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <BrandLogo size="md" tone="black" />
        <ActivityIndicator size="large" color={colors.brandPink} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!token ? <AuthApp /> : persona === 'patient' ? <PatientApp /> : <StaffApp />}
    </NavigationContainer>
  );
}
