/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Suppress ALL dev overlays — users must never see RN dev UI
LogBox.ignoreAllLogs();

// Suppress console errors that trigger red overlay in dev builds
if (__DEV__) {
  const _consoleError = console.error.bind(console);
  console.error = (...args) => {
    const msg = String(args[0] ?? '');
    // Suppress known non-critical RN dev warnings
    if (
      msg.includes('VirtualizedLists') ||
      msg.includes('Each child in a list') ||
      msg.includes('Warning:') ||
      msg.includes('componentWillMount') ||
      msg.includes('componentWillReceiveProps')
    ) return;
    _consoleError(...args);
  };
}

AppRegistry.registerComponent(appName, () => App);
