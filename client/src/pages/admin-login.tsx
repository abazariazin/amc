import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/lib/wallet-context";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";
import logoImage from "@assets/generated_images/blue_shield_a_crypto_icon.png";

export default function AdminLoginPage() {
  const { loginAdmin, isAdminLoggedIn } = useWallet();
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect to admin dashboard once logged in
  useEffect(() => {
    if (isAdminLoggedIn) {
      setLocation("/admin");
    }
  }, [isAdminLoggedIn, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await loginAdmin(password);
    if (success) {
      toast({ title: "Welcome back", description: "Successfully logged in as administrator" });
      // Navigation will happen via useEffect when isAdminLoggedIn becomes true
    } else {
      toast({ title: "Access Denied", description: "Invalid credentials", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
               <img src={logoImage} alt="Logo" className="w-12 h-12 rounded-full" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display font-bold">Admin Portal</CardTitle>
            <CardDescription>Restricted access for system administrators</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Access Key</Label>
              <Input 
                id="password"
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-lg"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg">
              <ShieldCheck className="mr-2 h-5 w-5" />
              Authenticate
            </Button>
          </form>
          <div className="mt-8 text-center">
            <Button variant="link" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground">
              Return to Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
