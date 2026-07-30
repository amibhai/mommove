import { registerRootComponent } from 'expo';

import App from './App';
import { registerScreenTimeTrackerHeadlessTask } from './src/services/screenTimeTracker';

// Must run at JS bundle load, before any component renders — this is what
// lets the native ScreenTrackerService invoke the tracking tick even when
// the app was started headlessly (i.e. the user is in some other app).
registerScreenTimeTrackerHeadlessTask();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
