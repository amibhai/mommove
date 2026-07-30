import { registerRootComponent } from 'expo';

import App from './App';
import { registerNotificationHandling } from './src/services/reminderActions';
import { registerScreenTimeTrackerHeadlessTask } from './src/services/screenTimeTracker';

// Must run at JS bundle load, before any component renders — this is what
// lets the native ScreenTrackerService invoke the tracking tick even when
// the app was started headlessly (i.e. the user is in some other app).
registerScreenTimeTrackerHeadlessTask();

// Same reasoning: a notification action tap can cold-start the JS bundle
// with no App component ever mounting, so the category/background-task
// registration can't live inside a useEffect.
registerNotificationHandling();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
