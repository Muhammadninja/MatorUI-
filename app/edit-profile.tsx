import { Stack } from 'expo-router';

import EditProfileScreen from '@/components/screens/edit-profile-screen';

export default function EditProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EditProfileScreen />
    </>
  );
}
