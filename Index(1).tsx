import { useState, useEffect } from "react";
import { ref, onValue, set } from "firebase/database";
import { database } from "@/lib/firebase";
import { DeviceData, Alert, DeviceConfig, LogEvent } from "@/types/device";
import { Dashboard } from "@/components/Dashboard";
import { AlertsPanel } from "@/components/AlertsPanel";
import { LocationTracker } from "@/components/LocationTracker";
import { ConfigPanel } from "@/components/ConfigPanel";
import { StatusLEDs } from "@/components/StatusLEDs";
import { EventLogs } from "@/components/EventLogs";
import { CalibrationPanel } from "@/components/CalibrationPanel";
import { NotificationSetup } from "@/components/NotificationSetup";
import { NotificationHistory } from "@/components/NotificationHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity } from "lucide-react";
import { useFCM } from "@/hooks/useFCM";

const Index = () => {
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hno] = useState("23"); // Default house number - can be made dynamic
  
  const { 
    notificationPermission, 
    notificationHistory,
    requestPermission,
    markAsRead,
    clearHistory
  } = useFCM(hno);

  useEffect(() => {
    // Listen to device data
    const dataRef = ref(database, `/devices/${hno}/current`);
    const unsubscribeData = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        setDeviceData(snapshot.val());
        setIsConnected(true);
      } else {
        // Mock data for testing
        setDeviceData({
          temperature: 28.5,
          humidity: 65,
          lpgLevel: 8500,
          flameStatus: false,
          gasLeakStatus: false,
          timestamp: new Date().toISOString(),
          location: {
            lat: 6.9271,
            lng: 79.8612
          }
        });
        setIsConnected(true);
      }
    }, (error) => {
      console.error("Firebase error:", error);
      setIsConnected(false);
    });

    // Listen to alerts
    const alertsRef = ref(database, `/devices/${hno}/alerts`);
    const unsubscribeAlerts = onValue(alertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const alertsData = snapshot.val();
        const alertsArray = Object.keys(alertsData).map(key => ({
          id: key,
          ...alertsData[key]
        }));
        setAlerts(alertsArray.slice(0, 10)); // Keep last 10 alerts
      } else {
        // Mock alerts for testing
        setAlerts([
          {
            id: "1",
            type: "auto-book",
            message: "LPG Level Low — Auto-book triggered",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });

    // Listen to logs
    const logsRef = ref(database, `/devices/${hno}/logs/events`);
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const logsData = snapshot.val();
        const logsArray = Object.values(logsData) as LogEvent[];
        setLogs(logsArray.slice(-50).reverse()); // Keep last 50 logs
      } else {
        // Mock logs for testing
        setLogs([
          {
            timestamp: new Date().toISOString(),
            eventType: "Normal",
            temperature: 28.5,
            humidity: 65,
            lpgLevel: 8500,
            flameStatus: false,
            gasLeakStatus: false,
          },
        ]);
      }
    });

    // Listen to config
    const configRef = ref(database, `/devices/${hno}/config`);
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.val());
      }
    });

    return () => {
      unsubscribeData();
      unsubscribeAlerts();
      unsubscribeLogs();
      unsubscribeConfig();
    };
  }, [hno]);

  const handleSaveConfig = async (newConfig: DeviceConfig) => {
    const configRef = ref(database, `/devices/${hno}/config`);
    await set(configRef, newConfig);
  };

  const handleCalibrate = async () => {
    const calibrateRef = ref(database, `/devices/${hno}/commands/calibrate`);
    await set(calibrateRef, { command: "START_CALIBRATION", timestamp: Date.now() });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">LPG Cylinder Monitor</h1>
              <p className="text-sm text-muted-foreground">Real-time IoT Monitoring System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <NotificationSetup 
            notificationPermission={notificationPermission}
            onRequestPermission={requestPermission}
          />
          <StatusLEDs data={deviceData} isConnected={isConnected} />
          
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="notifications">
                Notifications
                {notificationHistory.filter(n => !n.read).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                    {notificationHistory.filter(n => !n.read).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard" className="space-y-6 mt-6">
              <Dashboard data={deviceData} />
              <CalibrationPanel onCalibrate={handleCalibrate} />
            </TabsContent>
            
            <TabsContent value="alerts" className="mt-6">
              <AlertsPanel alerts={alerts} />
            </TabsContent>
            
            <TabsContent value="notifications" className="mt-6">
              <NotificationHistory 
                notifications={notificationHistory}
                onMarkAsRead={markAsRead}
                onClearHistory={clearHistory}
              />
            </TabsContent>
            
            <TabsContent value="location" className="mt-6">
              <LocationTracker data={deviceData} />
            </TabsContent>
            
            <TabsContent value="config" className="mt-6">
              <ConfigPanel config={config} onSave={handleSaveConfig} />
            </TabsContent>
            
            <TabsContent value="logs" className="mt-6">
              <EventLogs logs={logs} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
