importScripts('https://www.gstatic.com/firebasejs/9.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.10.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDM-5QUTz74Hf0VUU38pBrYdbgbc2kIOCM",
  authDomain: "college-management-syste-b653a.firebaseapp.com",
  projectId: "college-management-syste-b653a",
  storageBucket: "college-management-syste-b653a.firebasestorage.app",
  messagingSenderId: "737631393993",
  appId: "1:737631393993:web:b733f584412917bd3c5518",
  measurementId: "G-27XD1K5YK0"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
