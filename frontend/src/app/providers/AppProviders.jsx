import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../store';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Note: Theme configuration is now handled in App.jsx with ConfigProvider
// This file only provides Redux store and persistence

const AppProviders = ({ children }) => {
  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
};

export default AppProviders;