import { useState, useEffect } from 'react';
import { Button, Modal, Space, Typography } from 'antd';
import { DownloadOutlined, CloseOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import Cookies from 'js-cookie';

const { Title, Text, Paragraph } = Typography;

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);

      // Show the install prompt after a delay (optional)
      const hasPromptedBefore = Cookies.get('pwa-install-prompted');
      if (!hasPromptedBefore) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 10000); // Show after 10 seconds
      }
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      Cookies.set('pwa-installed', 'true', { expires: 365 }); // 1 year
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      // Install accepted
      Cookies.set('pwa-install-prompted', 'true', { expires: 365 }); // 1 year
    } else {
      // Install dismissed
      Cookies.set('pwa-install-prompted', 'true', { expires: 30 }); // 30 days for dismissal
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    Cookies.set('pwa-install-prompted', 'true', { expires: 30 }); // 30 days
  };

  // Don't show anything if already installed or no prompt available
  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <>
      {/* Install Prompt Modal - Auto popup only */}
      <Modal
        open={showInstallPrompt}
        onCancel={handleDismiss}
        footer={null}
        width={500}
        centered
        closeIcon={<CloseOutlined />}
        className="rounded-2xl overflow-hidden"
      >
        <div className="w-full py-6 flex flex-col gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-50 text-primary mb-4">
              <MobileOutlined className="text-5xl" />
            </div>
            <Title level={3} className="!mt-0">
              Install PlaceIntern App
            </Title>
          </div>

          <Paragraph className="text-center text-base text-text-secondary">
            Add PlaceIntern to your home screen for quick and easy access to all your Internship features.
          </Paragraph>

          <div className="flex justify-center gap-3 mt-4">
            <Button size="large" onClick={handleDismiss} className="rounded-xl px-6">
              Maybe Later
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              onClick={handleInstallClick}
              className="rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              Install Now
            </Button>
          </div>

          <div className="text-center">
            <Text type="secondary" className="text-xs">
              You can always install it later from the browser menu
            </Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PWAInstallPrompt;