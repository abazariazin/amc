import { Layout } from "@/components/layout";
import { WalletOverview } from "@/components/wallet/wallet-overview";
import { RecentTransactions } from "@/components/wallet/transaction-list";
import { NotificationSettings } from "@/components/wallet/notification-settings";
import { useWallet } from "@/lib/wallet-context";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function HomePage() {
  const { user, isLoading } = useWallet();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Only redirect if loading is complete and no user is found
    // This ensures we don't redirect while user data is still loading
    if (!isLoading && !user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse text-muted-foreground">Loading wallet...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    // Show loading state instead of blank screen while checking session
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse text-muted-foreground">Verifying session...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          <WalletOverview />
          <NotificationSettings />
        </div>
        <div className="space-y-8">
          <RecentTransactions />
        </div>
      </div>
    </Layout>
  );
}
