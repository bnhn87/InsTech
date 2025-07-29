import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import JobScreen from './screens/JobScreen';
import FloorPlanScreen from './screens/FloorPlanScreen';
import CreateProjectScreen from './screens/CreateProjectScreen';
import TaskScreen from './screens/TaskScreen';
import FormsScreen from './screens/FormsScreen';
import FormFillScreen from './screens/FormFillScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Job: { id: string };
  FloorPlan: { id: string };
  CreateProject: undefined;
  Tasks: { id: string };
  Forms: { id: string };
  FormFill: { id: string; formId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
        <Stack.Screen name="Job" component={JobScreen} options={{ title: 'Job' }} />
        <Stack.Screen name="FloorPlan" component={FloorPlanScreen} options={{ title: 'Floor Plan' }} />
        <Stack.Screen name="CreateProject" component={CreateProjectScreen} options={{ title: 'Create Project' }} />
        <Stack.Screen name="Tasks" component={TaskScreen} options={{ title: 'Tasks' }} />
        <Stack.Screen name="Forms" component={FormsScreen} options={{ title: 'Forms' }} />
        <Stack.Screen name="FormFill" component={FormFillScreen} options={{ title: 'Fill Form' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}