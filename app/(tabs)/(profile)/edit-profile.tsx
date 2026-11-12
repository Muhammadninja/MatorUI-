import { Stack } from 'expo-router';

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';

import EditProfileScreen from '@/components/screens/edit-profile-screen';

export default function EditProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthenticatedRoute titleKey="editProfile.title" fallbackHref="/profile">
        <EditProfileScreen />
      </AuthenticatedRoute>
    </>
  );
}
