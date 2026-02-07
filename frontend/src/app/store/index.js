import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import reducers
import authReducer from '../../features/auth/store/authSlice';
import stateReducer from '../../features/state/store/stateSlice';
import principalReducer from '../../features/principal/store/principalSlice';
import facultyReducer from '../../features/faculty/store/facultySlice';
import studentReducer from '../../features/student/store/studentSlice';
import industryReducer from '../../features/industry/store/industrySlice';
import sharedReducer from '../../features/shared/store/sharedSlice';
import lookupReducer from '../../features/shared/store/lookupSlice';
import instituteReducer from '../../store/slices/instituteSlice';
import companyReducer from '../../store/slices/companySlice';

// Import middlewares
import { cacheMiddleware } from '../../store/cacheMiddleware';
import { optimisticMiddleware } from '../../store/optimisticMiddleware';

// Import action types
import { RESET_STORE } from './actions';

// Re-export for backward compatibility
export { RESET_STORE };

// App reducer with nested structure
const appReducer = combineReducers({
  auth: authReducer,
  state: stateReducer,
  principal: principalReducer,
  faculty: facultyReducer,
  student: studentReducer,
  industry: industryReducer,
  shared: sharedReducer,
  lookup: lookupReducer,
  institute: instituteReducer,
  company: companyReducer,
});

// Root reducer that handles store reset
const rootReducer = (state, action) => {
  // Reset all state when RESET_STORE action is dispatched
  if (action.type === RESET_STORE) {
    // Clear persisted state from storage
    storage.removeItem('persist:root');
    // Return undefined to reset all reducers to their initial state
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

// Persist configuration
const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth'], // Only persist auth state
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(cacheMiddleware, optimisticMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);
