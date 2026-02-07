import toast from 'react-hot-toast';

// Transaction tracking
const transactions = new Map();
const stateSnapshots = new Map();

// Generate unique transaction ID
export const generateTxnId = () => `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Optimistic update helpers
export const optimisticHelpers = {
  add: (items, newItem) => [...items, { ...newItem, _isOptimistic: true, _tempId: generateTxnId() }],

  update: (items, updatedItem) => items.map(item =>
    item.id === updatedItem.id ? { ...item, ...updatedItem, _isOptimistic: true } : item
  ),

  delete: (items, itemId) => items.filter(item => item.id !== itemId),

  confirmAdd: (items, tempId, realItem) => items.map(item =>
    item._tempId === tempId ? { ...realItem, _isOptimistic: false } : item
  ),

  confirmUpdate: (items, itemId) => items.map(item =>
    item.id === itemId ? { ...item, _isOptimistic: false } : item
  ),

  rollback: (items, snapshot) => snapshot,
};

// State snapshot manager
export const snapshotManager = {
  save: (txnId, sliceName, state) => {
    stateSnapshots.set(txnId, { sliceName, state, timestamp: Date.now() });
    // Auto-cleanup after 5 minutes
    setTimeout(() => stateSnapshots.delete(txnId), 5 * 60 * 1000);
  },

  get: (txnId) => stateSnapshots.get(txnId),

  delete: (txnId) => stateSnapshots.delete(txnId),
};

// Toast helpers for optimistic UI
export const optimisticToast = {
  loading: (txnId, message) => {
    const toastId = toast.loading(message);
    transactions.set(txnId, toastId);
    return toastId;
  },

  success: (txnId, message) => {
    const toastId = transactions.get(txnId);
    if (toastId) {
      toast.success(message, { id: toastId });
      transactions.delete(txnId);
    } else {
      toast.success(message);
    }
  },

  error: (txnId, message) => {
    const toastId = transactions.get(txnId);
    if (toastId) {
      toast.error(message, { id: toastId });
      transactions.delete(txnId);
    } else {
      toast.error(message);
    }
  },
};

// Optimistic middleware
export const optimisticMiddleware = (store) => (next) => (action) => {
  // Handle optimistic actions
  if (action.meta?.optimistic) {
    const { txnId, sliceName, rollbackAction } = action.meta.optimistic;

    // Save snapshot before optimistic update
    const currentState = store.getState()[sliceName];
    snapshotManager.save(txnId, sliceName, currentState);

    // Execute optimistic update
    const result = next(action);

    // If it's a rejected action, rollback
    if (action.type?.endsWith('/rejected') && rollbackAction) {
      const snapshot = snapshotManager.get(txnId);
      if (snapshot) {
        store.dispatch(rollbackAction(snapshot.state));
        snapshotManager.delete(txnId);
      }
    }

    return result;
  }

  return next(action);
};
