import { useState, useEffect } from "react";
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet-context";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  isPushSupported,
  getPriceAlerts,
  createPriceAlert,
  deletePriceAlert,
  type PriceAlert,
} from "@/lib/push-notifications";

export function NotificationSettings() {
  const { user } = useWallet();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  
  const [newAlert, setNewAlert] = useState({
    symbol: "AMC",
    targetPrice: "",
    condition: "above",
  });

  useEffect(() => {
    checkSupport();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadAlerts();
    }
  }, [user?.id]);

  async function checkSupport() {
    const supported = await isPushSupported();
    setIsSupported(supported);
    
    if (supported) {
      const subscription = await getCurrentSubscription();
      setIsSubscribed(!!subscription);
    }
    setIsLoading(false);
  }

  async function loadAlerts() {
    if (!user?.id) return;
    try {
      const userAlerts = await getPriceAlerts(user.id);
      setAlerts(userAlerts);
    } catch (error) {
      console.error("Failed to load price alerts:", error);
    }
  }

  async function handleToggleNotifications() {
    if (isSubscribed) {
      const success = await unsubscribeFromPush();
      if (success) {
        setIsSubscribed(false);
        toast({
          title: "Notifications disabled",
          description: "You will no longer receive push notifications.",
        });
      }
    } else {
      const subscription = await subscribeToPush(user?.id);
      if (subscription) {
        setIsSubscribed(true);
        toast({
          title: "Notifications enabled",
          description: "You will now receive price alerts and transaction notifications.",
        });
      } else {
        toast({
          title: "Failed to enable notifications",
          description: "Please make sure notifications are allowed in your browser settings.",
          variant: "destructive",
        });
      }
    }
  }

  async function handleCreateAlert() {
    if (!user?.id || !newAlert.targetPrice) return;
    
    try {
      await createPriceAlert({
        userId: user.id,
        symbol: newAlert.symbol,
        targetPrice: newAlert.targetPrice,
        condition: newAlert.condition,
      });
      
      toast({
        title: "Price alert created",
        description: `You'll be notified when ${newAlert.symbol} goes ${newAlert.condition} $${newAlert.targetPrice}`,
      });
      
      setShowCreateAlert(false);
      setNewAlert({ symbol: "AMC", targetPrice: "", condition: "above" });
      loadAlerts();
    } catch (error) {
      toast({
        title: "Failed to create alert",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteAlert(id: string) {
    try {
      await deletePriceAlert(id);
      setAlerts(alerts.filter(a => a.id !== id));
      toast({
        title: "Alert deleted",
        description: "Price alert has been removed.",
      });
    } catch (error) {
      toast({
        title: "Failed to delete alert",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Card data-testid="card-notification-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Get alerts for price changes and transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported ? (
          <p className="text-sm text-muted-foreground" data-testid="text-notifications-unsupported">
            Push notifications are not supported in this browser.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed ? "Enabled" : "Disabled"}
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={isSubscribed}
                onCheckedChange={handleToggleNotifications}
                data-testid="switch-push-notifications"
              />
            </div>

            {isSubscribed && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Price Alerts</h4>
                  <Dialog open={showCreateAlert} onOpenChange={setShowCreateAlert}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-price-alert">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Alert
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Create Price Alert</DialogTitle>
                        <DialogDescription>
                          Get notified when a token reaches your target price.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Token</Label>
                          <Select
                            value={newAlert.symbol}
                            onValueChange={(v) => setNewAlert({ ...newAlert, symbol: v })}
                          >
                            <SelectTrigger data-testid="select-alert-token">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AMC">American Coin (AMC)</SelectItem>
                              <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                              <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Condition</Label>
                          <Select
                            value={newAlert.condition}
                            onValueChange={(v) => setNewAlert({ ...newAlert, condition: v })}
                          >
                            <SelectTrigger data-testid="select-alert-condition">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="above">Goes above</SelectItem>
                              <SelectItem value="below">Goes below</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Target Price (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newAlert.targetPrice}
                            onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                            data-testid="input-alert-price"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={handleCreateAlert}
                          disabled={!newAlert.targetPrice}
                          data-testid="button-create-alert"
                        >
                          Create Alert
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-alerts">
                    No price alerts set. Create one to get notified!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {alerts.filter(a => a.isActive === "true").map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        data-testid={`alert-item-${alert.id}`}
                      >
                        <div className="flex items-center gap-2">
                          {alert.condition === "above" ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">
                            {alert.symbol} {alert.condition} ${parseFloat(alert.targetPrice).toFixed(2)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAlert(alert.id)}
                          data-testid={`button-delete-alert-${alert.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
