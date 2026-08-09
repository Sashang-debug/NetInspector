import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Moon, Sun, Laptop, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { toast } from "sonner";

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, userProfile } = useAuth();
  
  const [name, setName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  const [shodanKey, setShodanKey] = useState("");
  const [vtKey, setVtKey] = useState("");
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || "");
      setShodanKey(userProfile.settings?.apiKeys?.shodan || "");
      setVtKey(userProfile.settings?.apiKeys?.virusTotal || "");
    }
  }, [userProfile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    
    try {
      // Update Auth Profile
      await updateProfile(user, { displayName: name });
      
      // Update Firestore Profile
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { name }, { merge: true });
      
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!user) return;
    setIsSavingKeys(true);
    
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        settings: {
          apiKeys: {
            shodan: shodanKey,
            virusTotal: vtKey
          }
        }
      }, { merge: true });
      
      toast.success("API keys updated successfully!");
    } catch (error: any) {
      console.error("Error updating API keys:", error);
      toast.error("Failed to update API keys.");
    } finally {
      setIsSavingKeys(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-lg">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Your Name" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={user?.email || ""} 
                  disabled 
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">Email is managed by Google authentication.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Theme Preferences</CardTitle>
              <CardDescription>Customize the look and feel of the application.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant={theme === 'light' ? 'default' : 'outline'} 
                  onClick={() => setTheme('light')}
                  className="flex-1 h-24 flex flex-col gap-2"
                >
                  <Sun className="h-6 w-6" />
                  Light
                </Button>
                <Button 
                  variant={theme === 'dark' ? 'default' : 'outline'} 
                  onClick={() => setTheme('dark')}
                  className="flex-1 h-24 flex flex-col gap-2"
                >
                  <Moon className="h-6 w-6" />
                  Dark
                </Button>
                <Button 
                  variant={theme === 'system' ? 'default' : 'outline'} 
                  onClick={() => setTheme('system')}
                  className="flex-1 h-24 flex flex-col gap-2"
                >
                  <Laptop className="h-6 w-6" />
                  System
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Manage your external API keys for advanced lookups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="shodan">Shodan API Key</Label>
                <Input 
                  id="shodan" 
                  type="password" 
                  value={shodanKey} 
                  onChange={(e) => setShodanKey(e.target.value)} 
                  placeholder="Enter Shodan API key" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vt">VirusTotal API Key</Label>
                <Input 
                  id="vt" 
                  type="password" 
                  value={vtKey} 
                  onChange={(e) => setVtKey(e.target.value)} 
                  placeholder="Enter VirusTotal API key" 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveKeys} disabled={isSavingKeys}>
                {isSavingKeys && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Keys
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
