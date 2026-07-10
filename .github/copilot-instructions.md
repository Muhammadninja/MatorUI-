# uPick Development Guide for AI Agents

## Project Overview
React Native + Expo 54 mobile app with custom design system, comprehensive permissions layer, and type-safe form framework. Built with file-based routing (expo-router), React Native's New Architecture enabled.

## Critical Architecture

### Theme System
- **Two-layer design**: raw palette (`themes/palette.ts`) → semantic tokens (`themes/roles.ts`)
- **Always use semantic tokens**, never raw palette colors in components
- Access via `useThemeContext()` hook: `const { tokens, scheme, isDark } = useThemeContext()`
- Use `AppView` and `AppText` with `colorName` props for themed styling: `<AppView colorName="card" />`
- Theme tokens are immutable frozen objects (V8 optimization)
- Verify theme parity: `npm run tokens:verify` (light/dark must have matching structure)

### Path Aliases
- **All imports use `@/` prefix**: `import { AppButton } from '@/components/shared/app-button'`
- Configured in `tsconfig.json` with `"paths": { "@/*": ["./*"] }`
- Never use relative imports (`../../../`) - always use `@/`

### Component Library Structure
- **Reusable UI**: `components/shared/*` - strictly decoupled from business logic
- **Screen-specific**: `components/*-screen-components/` - business logic components
- **Naming**: prefix all shared components with `App` (e.g., `AppButton`, `AppTextField`)
- Each component folder contains: `index.ts` (barrel export), implementation files, and `tokens.ts` for constants

### Form System (React Hook Form + Zod)
```tsx
// Preferred: use defineForm() for single-source field definitions
import { defineForm } from '@/components/shared/app-form';

const { config, defaultValues, schema } = defineForm<FormValues>([
  { name: 'email', type: 'text', label: 'Email', schema: z.string().email(), defaultValue: '' },
  { name: 'age', type: 'numeric', label: 'Age', schema: z.number().min(18), defaultValue: 0 },
]);

<AppForm config={config} schema={schema} defaultValues={defaultValues} onSubmit={handle} />
```
- Field presets: `textField()`, `emailField()`, `passwordField()`, `selectField()`, `rangeField()`, etc.
- Field types: `text`, `price`, `select`, `segmented`, `toggle`, `range`, `code`, `date`, `image`
- Override renderers via `registry` prop for custom fields
- See `docs/app-forms.md` for field-specific props

### Icon System
```tsx
// Multi-family icon support with unified API
<AppIcon name="chevron.right" family="symbol" size="lg" colorName="primary" />
<AppIconButton name="settings" onPress={action} />
```
- Families: `material`, `material-community`, `ion`, `feather`, `ant`, `fa6`, `entypo`, `octicons`, `symbol` (SF Symbols on iOS), `custom`
- Custom icons: register in `utils/custom-icon-map.ts`, generate with `npm run icons:gen`
- Size tokens: `xs | sm | md | lg | xl` (defined in `components/shared/app-icon/tokens.ts`)

### HTTP Client & Auth
- **Base service**: `services/http-api/http.ts` (Axios wrapper with auto-retry and token injection)
- **Setup**: `setupApiAuth()` called in `app/_layout.tsx` configures token provider and refresh handler
- **Request flags**: pass `{ noAuth: true, skipRefresh: true }` as options to bypass auth/refresh
- **Auth flow**: `contexts/auth.context.tsx` manages auth state, auto-hydrates from storage on mount
- **Auth events**: emit via `emitAuthEvent('auth:authed')` / `emitAuthEvent('auth:guest')` from `auth.events.ts`
- Token refresh is deduped (single in-flight promise prevents storms)
- Auth-related storage/service in `services/http-api/auth/` (auth.storage.ts, auth.service.ts, jwt.ts)
- **API URLs**: hardcoded in `constants/api-urls.ts` (no .env file pattern used)

### WebSocket Service
- **Location**: `services/websocket.service.ts` - production-grade WebSocket client
- **Features**: auto-reconnect with exponential backoff, heartbeat ping/pong, inactivity timeout detection
- **Auth integration**: automatically fetches and injects access token on connection
- **Configuration**: `autoReconnect`, `maxRetries`, `backoffBase`, `heartbeatInterval`, `inactivityTimeout`
- **Lifecycle hooks**: `onOpen`, `onClose`, `onReconnected`, `onGiveUp` for tracking connection state
- **Message handlers**: register handlers for different message types, auto-parsed JSON

### Permissions Architecture
- **Unified API**: `ensureLocation()`, `ensureCamera()`, `ensurePhotoLibrary()`, `ensureNotifications()`
- **Pre-prompt rationale**: pass `{ prePrompt: true, rationaleKey: 'location-map' }` to show custom modal before OS prompt
- **Settings deep-links**: `openSettings()` for app settings, `openNotificationSettings()` for notification settings
- Rationale presenter mounted at root: `contexts/permission-rationale-host.tsx`
- Status normalization: all permissions return `{ status: 'granted' | 'denied' | 'blocked' | 'limited' | 'unavailable', canAskAgain: boolean }`
- See `docs/permissions.md` for detailed flows

### Error Tracking with Sentry (CRITICAL - Always Include)
- **Purpose**: Technical health monitoring (crashes, errors, performance bottlenecks, session replay)
- **Configuration**: `services/sentry/` with `@sentry/react-native ~7.2.0`  
- **Settings**: 10% session replay, 100% replay on errors, Spotlight debug tool enabled
- **Documentation**: `docs/sentry.md`
- **ALWAYS wrap catch blocks with Sentry**:
```tsx
import * as Sentry from '@sentry/react-native';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { 
      component: 'ComponentName',
      action: 'operationName'
    },
    extra: { userId, context: 'additional info' }
  });
  // Show user-friendly error message
  ToastService.error('Operation failed');
}
```
- **Error boundaries**: `AppErrorBoundary` wraps root layout in `app/_layout.tsx`
- **Integration**: All HTTP errors, permission failures, websocket issues, and storage errors are logged

#### When Building New Features - MANDATORY Checklist:
1. **Error Handling**: Wrap all try/catch blocks with `Sentry.captureException()`
2. **Context Tags**: Add component/action tags for better error grouping
3. **User Context**: Include user IDs (not PII) for debugging
4. **Test Errors**: Verify errors appear in Sentry dashboard

#### Privacy:
- Never log PII (emails, phone numbers, real names) - use user IDs only
- Sentry user context cleared on logout

### State Management
- **Auth**: `contexts/auth.context.tsx` (status: `checking | guest | authed`)
- **Theme**: `contexts/theme.context.tsx` + `contexts/color-scheme-override.context.tsx`
- **Network**: `contexts/network.context.tsx` tracks connectivity with `useNetwork()` hook
- **Push Notifications**: `contexts/push-notification.context.tsx` manages notification permissions and tokens
- **Global state**: Zustand for simple stores (e.g., `stores/notification-filter.store.ts`, `stores/add-car.store.ts`)
- **Server state**: TanStack Query (2min stale, 30min gcTime) configured in `services/react-query/query-client.ts`
- **IMPORTANT**: TanStack Query is configured but **not wrapped with QueryClientProvider** - add wrapper in `_layout.tsx` if using queries/mutations
- **Focus tracking**: Optional `setupReactQueryFocusTracking()` wires AppState to refetch on app foreground
- Query client configured with: `refetchOnWindowFocus`, `refetchOnReconnect`, automatic retry logic

## File Routing (Expo Router)
- **Entry**: `app/_layout.tsx` wraps app with providers (order: ErrorBoundary → ColorScheme → Theme → Auth → Notification)
- **Critical provider nesting**: this order ensures theme is available before Auth, which may need themed components
- **Tabs**: `app/(tabs)/_layout.tsx` and `app/(tabs)/index.tsx`
- **Groups**: `(onboarding)` and `(tabs)` - parentheses hide from URL
- **Navigation**: use `router.push()`, `router.replace()` from `expo-router`
- **GestureHandler**: `GestureHandlerRootView` must wrap navigation for gestures to work
- **Root-level components**: `ToastHost`, `PermissionRationaleHost`, and `GlobalModal` mounted in `_layout.tsx` for app-wide access

## Essential Scripts
```bash
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator
npm start                # Start dev server with dev client
npm start:cc             # Start dev server with cache cleared
npm run lint             # ESLint check
npx tsc --noEmit         # Type-check
npm run tokens:verify    # Verify theme parity
npm run tokens:contrast  # Check color contrast ratios
npm run icons:gen        # Generate custom icon map
npm run i18n             # Find missing translations
npm run pre              # Prebuild native projects
npm run pre:cc           # Prebuild native projects (clean)
npm run doctor           # Run Expo doctor diagnostics
npm run analyze:ios      # Analyze iOS bundle size
npm run analyze:android  # Analyze Android bundle size
```

### EAS Build Commands
```bash
npm run build:ios:dev    # Development build (iOS)
npm run build:and:dev    # Development build (Android)
npm run build:ios:prev   # Preview/TestFlight build
npm run build:ios:prod   # Production build
npm run submit:ios:prod  # Submit to App Store
```

### Device Management
```bash
npm run dev:list         # List registered devices
npm run dev:create       # Register new device
```

## Development Patterns

### Creating New Components
1. Place in `components/shared/<component-name>/`
2. Name with `App` prefix: `AppNewComponent`
3. Export from `index.ts` barrel
4. Use `ColorName` type for color props (from `@/themes`)
5. Document in `docs/app-<component-name>.md`
6. Add `tokens.ts` for component-specific constants
7. Use semantic color tokens via `useThemeContext()` hook

### Creating New Screens
1. Place in `app/` directory following Expo Router conventions
2. **Wrap errors with Sentry**: All try/catch blocks must log to Sentry
3. Example screen with error handling:
```tsx
import * as Sentry from '@sentry/react-native';

export default function CreateListingScreen() {
  const handleSubmit = async (data: FormData) => {
    try {
      const listing = await listingService.create(data);
      router.push(`/listing/${listing.id}`);
      ToastService.success('Listing created');
    } catch (error) {
      // Log error to Sentry
      Sentry.captureException(error, {
        tags: { component: 'CreateListingScreen', action: 'submit' },
        extra: { category: data.category }
      });
      
      ToastService.error('Failed to create listing');
    }
  };
  
  return <AppView>{/* Form */}</AppView>;
}
```

### Common Component Patterns
```tsx
// Themed view with semantic colors
import { AppView } from '@/components/shared/app-view';
import { AppText } from '@/components/shared/app-text';

<AppView colorName="card" style={{ padding: 16 }}>
  <AppText colorName="text" variant="heading">Title</AppText>
</AppView>

// Icon button with haptic feedback
import { AppIconButton } from '@/components/shared/app-icon';
import * as Haptics from 'expo-haptics';

<AppIconButton 
  name="settings" 
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handlePress();
  }}
/>

// Accessing theme programmatically
import { useThemeContext } from '@/contexts/theme.context';

const { tokens, isDark, scheme } = useThemeContext();
const backgroundColor = tokens.card;
```

### Adding New API Endpoints
1. Create service file in `services/http-api/api-calls/`
2. Use `http.get()`, `http.post()`, etc. from `@/services/http-api/http`
3. Wrap in TanStack Query hooks for caching: `useQuery()`, `useMutation()`
4. Handle errors with `HttpError` type (check with `isHttpError()`)

### Working with Storage
- **Secure data**: Use `SecureStore` from `expo-secure-store` (tokens, sensitive data)
- **Regular data**: Use `AsyncStorage` from `@react-native-async-storage/async-storage`
- **Auth storage**: See `services/http-api/auth/auth.storage.ts` for token persistence patterns
- **Onboarding state**: `services/onboarding.storage.ts` for completion tracking
- Always handle storage errors gracefully (quota limits, permission issues)

### Adding Translations
- Files: `locales/en.json`, `locales/ru.json`, `locales/uz.json`
- Access: `const { t } = useTranslation()` then `t('key.path')`
- Find missing: `npm run i18n`
- Configured in `locales/i18n.ts` with i18next

### Adding Global Modals
1. Create content in `components/shared/global-modal-contents/`
2. Register in `services/global-modal-service/global-modal-mapping.ts`
3. Open via `modalService.openModal('modalType', props)`
4. Animations: `slide-up` (default), `fade`, or `none`
5. Modal wrapper handles backdrop, gestures, and lifecycle

### Working with Notifications
- Service: `services/push-notification.service.ts` handles registration and token management
- Context: `contexts/push-notification.context.tsx` provides `usePushNotifications()` hook
- Handler configured in `app/_layout.tsx` with `Notifications.setNotificationHandler()`
- Request permission via permissions API: `ensureNotifications()`

### Error Handling Patterns
```tsx
// HTTP errors with Sentry tracking
import { http, isHttpError } from '@/services/http-api/http';
import { ToastService } from '@/services/toast.service';
import * as Sentry from '@sentry/react-native';

try {
  const data = await http.get('/endpoint');
} catch (error) {
  // Log to Sentry for monitoring
  Sentry.captureException(error, {
    tags: { component: 'DataFetch', endpoint: '/endpoint' },
    extra: { userId: user?.id }
  });
  
  // Show user-friendly message
  if (isHttpError(error)) {
    ToastService.error(`Error ${error.status}: ${error.message}`);
  } else {
    ToastService.error('An unexpected error occurred');
  }
}

// Permission errors
import { ensureCamera } from '@/services/permissions/camera.permission';

const result = await ensureCamera({ prePrompt: true, rationaleKey: 'camera-profile' });
if (result.status !== 'granted') {
  ToastService.warning('Camera access is required');
  return;
}

// Form submission with error handling
const handleSubmit = async (data: FormData) => {
  try {
    const result = await submitService.create(data);
    ToastService.success('Created successfully');
    router.push(`/listing/${result.id}`);
  } catch (error) {
    // Log to Sentry
    Sentry.captureException(error, {
      tags: { component: 'CreateListing', action: 'submit' },
      extra: { category: data.category }
    });
    
    ToastService.error('Failed to create listing');
  }
};
```

### Debugging Tips
- Use `console.log()` for development - logs appear in Metro bundler terminal
- Check iOS/Android logs: `npx react-native log-ios` or `npx react-native log-android`
- Use React DevTools: install browser extension and connect to Metro
- Sentry configured in `services/sentry/` for production error tracking
- Test error boundaries by throwing errors in components

## Key Conventions
- **TypeScript strict mode** enabled - all code must type-check
- **Verify changes**: After editing any file, always check for errors with `npx tsc --noEmit` or use the editor's error panel to ensure no type errors were introduced
- **No prop spreading** in components - explicit props only for clarity
- **Haptic feedback**: use `Haptics.impactAsync()` from `expo-haptics` for user interactions
- **Error boundaries**: `AppErrorBoundary` wraps root layout
- **Toast notifications**: `ToastService.success()`, `.error()`, `.info()`, `.warning()`
- **Modal dialogs**: `modalService.openModal('modalType', props)` for imperative modals
- **Auth guards**: use `guards/auth-guard/auth-guard.tsx` to protect authenticated routes
- **Network status**: `NetworkProvider` in `contexts/network.context.tsx` tracks connectivity (use `useNetwork()` hook)
- **Device ID**: `getDeviceId()` from `services/device-id.service.ts` generates persistent device identifier
- **Error tracking**: ALWAYS wrap catch blocks with `Sentry.captureException()` for production monitoring
- **Privacy**: Never log PII (emails, phone numbers, names) - use user IDs only in Sentry context

## Testing & Quality
- **Always check errors after file changes**: Run `npx tsc --noEmit` or check the Problems panel in your editor
- Run type-check before committing: `npx tsc --noEmit`
- Lint with: `npm run lint`
- Playground screen available when `EXPO_PUBLIC_COMPONENT_PLAYGROUND=true`
- Bundle analysis: `npm run analyze:ios` or `npm run analyze:android`
- Expo doctor: `npm run doctor` to check for common issues

## External Dependencies
- **UI**: Expo SDK 54, React Native 0.81.5, React 19.1
- **Forms**: React Hook Form + Zod + `@hookform/resolvers`
- **Data**: TanStack Query, Axios
- **Navigation**: Expo Router + React Navigation
- **Animation**: react-native-reanimated, react-native-gesture-handler
- **Monitoring**: Sentry (setup in `services/sentry/`)
- **Storage**: AsyncStorage, SecureStore
- **I18n**: i18next, react-i18next

## Documentation
Comprehensive guides in `docs/`:
- `theme-system.md` - complete theme token reference
- `permissions.md` - permission flows and API
- `app-forms.md` - form field registry and validation
- `app-icon.md` - icon families and usage
- Component-specific docs for each UI element

## Performance Best Practices

### React Native Optimization
```tsx
// ✅ Use React.memo for expensive components
const ExpensiveCard = React.memo(({ data }) => {
  return <AppCard>{/* expensive render */}</AppCard>;
});

// ✅ Use useCallback for callbacks passed to child components
const handlePress = useCallback(() => {
  navigation.navigate('Detail', { id });
}, [id, navigation]);

// ✅ Use useMemo for expensive calculations
const filteredData = useMemo(() => 
  data.filter(item => item.active), 
  [data]
);

// ✅ Use FlatList with proper optimization
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
  initialNumToRender={10}
  updateCellsBatchingPeriod={50}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### Image Optimization
```tsx
// ✅ Use Expo Image with proper sizing and caching
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
  style={{ width: 200, height: 200 }}
/>

// ✅ Always specify image dimensions to prevent layout shift
// ❌ Never use dynamic sizing without placeholders
```

### Memory Management
```tsx
// ✅ Always cleanup subscriptions and listeners
useEffect(() => {
  const subscription = eventEmitter.addListener('event', handler);
  const timer = setTimeout(() => {}, 1000);
  
  return () => {
    subscription.remove();
    clearTimeout(timer);
  };
}, []);

// ✅ Avoid creating functions/objects in render
// ❌ Bad: <Button onPress={() => handlePress(id)} />
// ✅ Good: <Button onPress={handlePress} /> (with useCallback)
```

### Bundle Optimization
- Keep bundle size under 20MB for optimal download/install experience
- Use `npm run analyze:ios` or `npm run analyze:android` to track bundle size
- Lazy-load heavy dependencies when possible
- Avoid importing entire libraries - use specific imports: `import debounce from 'lodash/debounce'`

## Platform-Specific Code

### When to Use Platform-Specific Code
```tsx
import { Platform } from 'react-native';

// ✅ Use Platform.OS for simple checks
const padding = Platform.OS === 'ios' ? 12 : 16;

// ✅ Use Platform.select() for multiple platform values
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

// ✅ Platform-specific imports
const DatePicker = Platform.select({
  ios: () => require('./DatePicker.ios').default,
  android: () => require('./DatePicker.android').default,
})();

// ✅ Platform-specific files (preferred for large differences)
// DatePicker.ios.tsx
// DatePicker.android.tsx
// Import as: import DatePicker from './DatePicker';
```

### Common Platform Differences
- **Shadows**: iOS uses shadow props, Android uses `elevation`
- **Status bar**: Different handling on iOS vs Android
- **Keyboard**: iOS shows/hides differently, use `keyboardWillShow` (iOS) vs `keyboardDidShow` (Android)
- **Safe areas**: iOS requires safe area handling, Android usually doesn't
- **Ripple**: Android native ripple effect, iOS use opacity/scale animations
- **Haptics**: Different intensity levels and feedback types
- **Modals**: Different animation and dismissal behaviors

## Keyboard Handling

### Dismissing Keyboard
```tsx
// ✅ Use utility for keyboard dismissal
import { dismissKeyboardAsync } from '@/utils/dismiss-keyboard-async';

// Dismiss keyboard before navigation
await dismissKeyboardAsync();
router.push('/next-screen');

// ✅ Auto-dismiss on route change (in root layout)
import { useDismissKeyboard } from '@/hooks/use-dismiss-keyboard';
useDismissKeyboard(); // Dismisses keyboard on pathname change
```

### Keyboard-Aware Screens
```tsx
// ✅ Use KeyboardAvoidingView for simple cases
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  {/* Content */}
</KeyboardAvoidingView>

// ✅ Use AppKeyboardController for complex forms (already built)
import AppKeyboardController from '@/components/shared/keyboard-controller';

<AppKeyboardController offset={190} showToolbar={true}>
  {/* Form fields */}
</AppKeyboardController>

// ✅ Set keyboard dismiss mode on ScrollView
<ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
  {/* Content */}
</ScrollView>
```

### Keyboard Listeners
```tsx
// ✅ Listen to keyboard events for custom behavior
useEffect(() => {
  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
  
  const showSub = Keyboard.addListener(showEvent, (e) => {
    // Animate or adjust layout
    animateValue.value = e.endCoordinates.height;
  });
  
  const hideSub = Keyboard.addListener(hideEvent, () => {
    animateValue.value = 0;
  });
  
  return () => {
    showSub.remove();
    hideSub.remove();
  };
}, []);
```

## Loading States & Skeletons

### Use Skeleton Loaders
```tsx
// ✅ Use pre-built skeleton components
import { AvatarLinesSkeleton, RectSkeleton, ListSkeleton } from '@/components/shared/app-skeleton';

// List item placeholder
<AvatarLinesSkeleton />

// Image placeholder
<RectSkeleton width={320} height={180} />

// Multiple rows
<ListSkeleton count={4} />

// ✅ Custom skeleton shapes
import { AppSkeleton } from '@/components/shared/app-skeleton';
import SkeletonPlaceholder from '@/components/shared/app-skeleton/skeleton-builder';

<AppSkeleton>
  <SkeletonPlaceholder.Item flexDirection="row" alignItems="center">
    <SkeletonPlaceholder.Item width={48} height={48} borderRadius={24} />
    <SkeletonPlaceholder.Item marginLeft={12}>
      <SkeletonPlaceholder.Item width={160} height={14} borderRadius={8} />
      <SkeletonPlaceholder.Item marginTop={8} width={220} height={12} borderRadius={8} />
    </SkeletonPlaceholder.Item>
  </SkeletonPlaceholder.Item>
</AppSkeleton>
```

### Loading States Pattern
```tsx
// ✅ Consistent loading state UI
const { data, isLoading, error } = useQuery({ queryKey: ['items'], queryFn: fetchItems });

if (isLoading) return <ListSkeleton count={5} />;
if (error) return <ErrorState error={error} onRetry={refetch} />;
if (!data || data.length === 0) return <EmptyState />;

return <FlatList data={data} renderItem={renderItem} />;
```

## Empty States

### Use AppEmptyState Component
```tsx
import { AppEmptyState } from '@/components/shared/app-empty-state';

// ✅ Standard empty state
<AppEmptyState
  icon={{ family: 'custom', name: '3D-bell-sleep' }}
  title="No notifications"
  message="You're all caught up!"
  primaryAction={{ label: 'Refresh', onPress: refetch }}
/>

// ✅ With image
<AppEmptyState
  image={{ source: require('@/assets/images/empty.png'), width: 120, height: 120 }}
  title="No results found"
  message="Try adjusting your search filters"
  primaryAction={{ label: 'Clear filters', onPress: clearFilters }}
  secondaryAction={{ label: 'Go back', onPress: goBack }}
/>
```

## Pagination & Infinite Scroll

### Using AppScrollView with onReachEnd
```tsx
// ✅ Infinite scroll with AppScrollView
import { AppScrollView } from '@/components/shared/app-scroll-view';

<AppScrollView
  onReachEnd={() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }}
  reachEndThreshold={100} // pixels from bottom
  refreshing={isRefreshing}
  onRefresh={handleRefresh}
>
  {items.map(item => <ItemCard key={item.id} item={item} />)}
  {isFetchingNextPage && <ActivityIndicator />}
</AppScrollView>
```

### Using FlatList with TanStack Query
```tsx
// ✅ Infinite scroll with FlatList + TanStack Query
import { useInfiniteQuery } from '@tanstack/react-query';

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['items'],
  queryFn: ({ pageParam = 1 }) => fetchItems(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextPage,
  initialPageParam: 1,
});

const items = data?.pages.flatMap(page => page.items) ?? [];

<FlatList
  data={items}
  renderItem={renderItem}
  onEndReached={() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }}
  onEndReachedThreshold={0.5}
  ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
/>
```

## Data Fetching Patterns

### TanStack Query Best Practices
```tsx
// ✅ Use query hooks for read operations
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['listing', id],
  queryFn: () => listingService.getById(id),
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
});

// ✅ Use mutations for write operations
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (data: FormData) => listingService.create(data),
  onSuccess: (newListing) => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['listings'] });
    
    // Or optimistically update
    queryClient.setQueryData(['listings'], (old) => [...old, newListing]);
    
    ToastService.success('Listing created successfully');
  },
  onError: (error) => {
    Sentry.captureException(error, {
      tags: { component: 'ListingMutation', action: 'create' }
    });
    ToastService.error('Failed to create listing');
  },
});

// ✅ Prefetch data
queryClient.prefetchQuery({
  queryKey: ['listing', id],
  queryFn: () => listingService.getById(id),
});
```

### Cache Invalidation Patterns
```tsx
// ✅ Invalidate specific queries
queryClient.invalidateQueries({ queryKey: ['listings'] });

// ✅ Invalidate queries with filters
queryClient.invalidateQueries({ 
  queryKey: ['listings'], 
  predicate: (query) => query.queryKey[1] === 'active'
});

// ✅ Remove queries from cache
queryClient.removeQueries({ queryKey: ['listing', id] });

// ✅ Set query data directly (optimistic updates)
queryClient.setQueryData(['listing', id], newData);
```

## Navigation Patterns

### Navigation Best Practices
```tsx
import { router } from 'expo-router';

// ✅ Use router methods for navigation
router.push('/profile');
router.replace('/login'); // Replace current route
router.back(); // Go back
router.canGoBack(); // Check if back is possible

// ✅ Pass params safely
router.push({
  pathname: '/listing/[id]',
  params: { id: listing.id }
});

// ✅ Use href for links (type-safe with typed routes)
import { Link } from 'expo-router';

<Link href={{ pathname: '/listing/[id]', params: { id } }}>
  View Listing
</Link>
```

### Deep Linking
```tsx
// ✅ Handle deep links (configured in app.json with scheme: "upick")
// Links like upick://listing/123 will work automatically with file-based routing

// ✅ Universal links (for production)
// Configure in app.json with intentFilters and associatedDomains
```

## Date & Time Handling

### Always Consider Timezones
```tsx
// ✅ Use date-fns for consistent formatting
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { enUS, ru, uz } from 'date-fns/locale';

// Format dates
const formatted = format(new Date(), 'PPP', { locale: ru });

// Parse ISO dates from API
const date = parseISO('2024-01-15T10:30:00Z');

// Relative time
const ago = formatDistanceToNow(date, { addSuffix: true, locale: ru });

// ✅ Store dates in ISO format
const timestamp = new Date().toISOString();

// ✅ Use UTC for server communication
// ✅ Convert to local timezone for display only
```

## Async Operations & Race Conditions

### Prevent Race Conditions
```tsx
// ✅ Use AbortController for cancellable requests
const handleSearch = useCallback(async (query: string) => {
  const controller = new AbortController();
  
  try {
    const results = await searchService.search(query, { signal: controller.signal });
    setResults(results);
  } catch (error) {
    if (error.name === 'AbortError') return; // Ignore cancelled requests
    Sentry.captureException(error);
  }
  
  return () => controller.abort(); // Cleanup
}, []);

// ✅ Use debouncing for search inputs
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    fetchResults(query);
  }, 300),
  []
);

useEffect(() => {
  return () => debouncedSearch.cancel(); // Cleanup on unmount
}, [debouncedSearch]);

// ✅ Track in-flight operations
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  if (isLoading) return; // Prevent duplicate submissions
  setIsLoading(true);
  try {
    await submitService.create(data);
  } finally {
    setIsLoading(false);
  }
};
```

### Handling Concurrent Operations
```tsx
// ✅ Use Promise.all for parallel operations
const [user, settings, notifications] = await Promise.all([
  userService.getProfile(),
  settingsService.get(),
  notificationService.getUnread(),
]);

// ✅ Use Promise.allSettled when some can fail
const results = await Promise.allSettled([
  fetchUserData(),
  fetchSettings(),
  fetchNotifications(),
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    // Handle success
  } else {
    // Handle individual failure
    Sentry.captureException(result.reason);
  }
});
```

## Accessibility (a11y)

### Core Principles
```tsx
// ✅ Always add accessibility labels to interactive elements
<AppButton
  accessibilityLabel="Submit registration form"
  accessibilityHint="Double tap to submit your information"
  onPress={handleSubmit}
>
  Submit
</AppButton>

// ✅ Use semantic roles
<Pressable
  accessibilityRole="button"
  accessibilityState={{ disabled: isDisabled }}
>
  {/* content */}
</Pressable>

// ✅ Group related content
<View accessible={true} accessibilityLabel="User profile section">
  <AppText>{userName}</AppText>
  <AppText>{userEmail}</AppText>
</View>

// ✅ Announce dynamic content changes
import { AccessibilityInfo } from 'react-native';

AccessibilityInfo.announceForAccessibility('Item added to cart');
```

### Screen Reader Support
- Test with VoiceOver (iOS) and TalkBack (Android)
- Ensure logical focus order
- Provide meaningful labels, not technical terms
- Hide decorative elements: `accessibilityElementsHidden={true}` (iOS) or `importantForAccessibility="no"` (Android)

## Security Best Practices

### Token and Secret Management
```tsx
// ✅ Store sensitive data in SecureStore only
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('accessToken', token);

// ✅ Never log tokens or sensitive data
// ❌ console.log('Token:', token);

// ✅ Clear tokens on logout
await SecureStore.deleteItemAsync('accessToken');
await SecureStore.deleteItemAsync('refreshToken');
```

### Input Validation
```tsx
// ✅ Always validate and sanitize user input
import { z } from 'zod';

const emailSchema = z.string().email().toLowerCase().trim();
const phoneSchema = z.string().regex(/^\+?[1-9]\d{10,14}$/);

// ✅ Use Zod schemas in forms for consistent validation
// ✅ Validate on both client and server
```

### API Security
```tsx
// ✅ Use HTTPS only - configured in constants/api-urls.ts
// ✅ Implement certificate pinning for production (add to expo-build-properties)
// ✅ Set proper timeouts to prevent hanging requests
// ✅ Rate limit sensitive operations client-side
```

## Code Quality Standards

### Component Organization
```tsx
// ✅ Organize component file structure:
// 1. Imports (React, third-party, local)
// 2. Types/Interfaces
// 3. Constants
// 4. Component definition
// 5. Styles/tokens

import React, { useCallback } from 'react';
import { Pressable } from 'react-native';
import { AppText } from '@/components/shared/app-text';
import type { ColorName } from '@/themes';

interface ButtonProps {
  label: string;
  onPress: () => void;
  colorName?: ColorName;
}

const DEFAULT_COLOR: ColorName = 'primary';

export const AppCustomButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  colorName = DEFAULT_COLOR,
}) => {
  // Component logic here
  return (
    <Pressable onPress={onPress}>
      <AppText colorName={colorName}>{label}</AppText>
    </Pressable>
  );
};
```

### Type Safety
```tsx
// ✅ Always define explicit types, avoid 'any'
// ✅ Use strict null checks
// ✅ Prefer union types over enums for better tree-shaking

type Status = 'idle' | 'loading' | 'success' | 'error';

// ✅ Use discriminated unions for state management
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: string };
```

### Error Handling
```tsx
// ✅ Always handle errors at the right level
// ✅ Show user-friendly error messages
// ✅ Log errors to Sentry in production
// ✅ Implement error boundaries for component failures
// ✅ Provide fallback UI for error states

try {
  await riskyOperation();
} catch (error) {
  // Log to monitoring service
  console.error('Operation failed:', error);
  
  // Show user-friendly message
  ToastService.error('Unable to complete action. Please try again.');
  
  // Report to Sentry in production
  // Sentry.captureException(error);
}
```

### Testing Strategy
```tsx
// ✅ Write unit tests for utility functions
// ✅ Integration tests for API calls
// ✅ Component tests for business logic
// ✅ E2E tests for critical user flows

// Test location: __tests__/ or component.test.tsx
// Run with: npm run test
```

## Internationalization Best Practices

### RTL Support
```tsx
// ✅ Use I18nManager for RTL-aware layouts
import { I18nManager } from 'react-native';

const isRTL = I18nManager.isRTL;

// ✅ Use start/end instead of left/right
style={{ paddingStart: 16 }}  // ✅ Adapts to RTL
style={{ paddingLeft: 16 }}   // ❌ Always left

// ✅ Use React Native's direction-aware properties
```

### Translation Keys
```tsx
// ✅ Use namespaced, descriptive keys
t('auth.login.emailPlaceholder')
t('errors.network.timeout')

// ✅ Use pluralization and interpolation
t('items.count', { count: 5 })  // "5 items" or "1 item"

// ✅ Keep translations in sync with npm run i18n
```

## Offline-First Patterns

```tsx
// ✅ Check connectivity before operations
import { useNetwork } from '@/contexts/network.context';

const { isConnected } = useNetwork();

if (!isConnected) {
  ToastService.warning('No internet connection');
  return;
}

// ✅ Implement optimistic updates
const mutation = useMutation({
  mutationFn: updateItem,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['items'] });
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['items']);
    
    // Optimistically update
    queryClient.setQueryData(['items'], (old) => [...old, newData]);
    
    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['items'], context.previous);
  },
});

// ✅ Cache API responses appropriately
// ✅ Implement retry logic with exponential backoff
```

## Common Pitfalls
- ❌ Don't import from `themes/palette.ts` directly - use semantic tokens from `themes/roles.ts`
- ❌ Don't use relative imports - always use `@/` path alias
- ❌ Don't bypass form registry - extend it with custom renderers
- ❌ Don't request permissions without rationale - use `prePrompt: true`
- ❌ Don't mutate theme tokens - they are frozen objects
- ❌ Don't forget `GestureHandlerRootView` when adding gesture-based components
- ❌ Don't use `any` type - prefer `unknown` and type guards
- ❌ Don't ignore accessibility - test with screen readers
- ❌ Don't skip cleanup in useEffect - prevent memory leaks
- ❌ Don't create new objects/functions in render - use useMemo/useCallback
- ❌ Don't use index as key in lists - use stable unique identifiers
- ❌ Don't log sensitive data - protect user privacy
- ❌ **Don't skip Sentry in catch blocks** - wrap all errors with `Sentry.captureException()`
- ❌ **Don't log PII to Sentry** - use user IDs instead of names/emails/phone numbers
