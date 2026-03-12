/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Project: TransMoreno (transmoreno.pages.dev)
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Wrench, 
  MapPin, 
  Package, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  ChevronRight,
  Fuel,
  Utensils,
  CheckCircle2,
  AlertCircle,
  History,
  LogIn,
  Loader2,
  FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { orderBy } from 'firebase/firestore';
import { auth, secondaryAuth } from './firebase';
import { 
  getUserProfile, 
  createUserProfile, 
  subscribeToCollection,
  addDocument,
  setDocument,
  updateDocument,
  deleteDocument
} from './services/firestoreService';
import { UserProfile, Driver, Truck as TruckType, Trailer, Supplier, Maintenance, Trip, Expense, Product, Invoice, FuelEntry, LunchEntry } from './types';
import { parseNFXml } from './utils/xmlParser';
import { compressImage } from './utils/imageUtils';
import Modal from './components/Modal';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-rose-500" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Ops! Algo deu errado.</h2>
            <p className="text-zinc-500 mb-6">
              Ocorreu um erro inesperado. Por favor, tente recarregar a página.
            </p>
            <pre className="text-xs bg-zinc-100 p-4 rounded-lg mb-6 overflow-auto max-h-32 text-left text-zinc-600">
              {error?.message}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-zinc-900 text-white py-3 rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

type View = 'dashboard' | 'fleet' | 'maintenance' | 'trips' | 'logistics' | 'users' | 'suppliers';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        let userProfile = await getUserProfile(firebaseUser.uid);
        
        if (!userProfile) {
          const isMaster = firebaseUser.email === 'apptransmorenoadm@gmail.com';
          const isDriver = firebaseUser.email?.endsWith('@fleet.com');
          
          userProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: isMaster ? 'Master' : (firebaseUser.displayName || 'Motorista'),
            role: isMaster ? 'master' : 'employee',
            createdAt: new Date().toISOString()
          };
          await createUserProfile(userProfile);
        }
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const formData = new FormData(e.currentTarget);
    const login = formData.get('login') as string;
    const password = formData.get('password') as string;

    let email = login;
    if (login.toLowerCase() === 'master') {
      email = 'apptransmorenoadm@gmail.com';
    } else if (!login.includes('@')) {
      // Normalize phone (remove non-digits)
      const cleanPhone = login.replace(/\D/g, '');
      email = `${cleanPhone}@fleet.com`;
    }

    try {
      console.log(`Tentando login com: ${email} (Senha: ${password})`);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.log(`Erro no login para ${email}:`, error.code, error.message);
      console.error("Login failed:", error);
      
      const isMasterLogin = login.toLowerCase() === 'master' && password === '@Master2026';

      if (isMasterLogin) {
        // For Master, if sign-in fails, try to create the account in case it doesn't exist
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          // Success! onAuthStateChanged will handle the redirect
        } catch (createError: any) {
          console.error("Master creation failed:", createError);
          if (createError.code === 'auth/email-already-in-use') {
            setLoginError("O usuário Master já existe, mas a senha digitada está incorreta.");
          } else if (createError.code === 'auth/operation-not-allowed') {
            setLoginError("AÇÃO NECESSÁRIA: O login por 'E-mail/Senha' está desativado no seu Firebase Console. Ative em: Authentication > Sign-in method.");
          } else if (createError.code === 'auth/invalid-credential') {
            setLoginError("Erro de credenciais. Verifique se o login por E-mail/Senha está ativo no Firebase.");
          } else {
            setLoginError(`Erro ao configurar Master: ${createError.message}`);
          }
        }
      } else {
        // Normal user errors
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          setLoginError("Login ou senha incorretos.");
        } else if (error.code === 'auth/operation-not-allowed') {
          setLoginError("O login por senha está desativado no servidor.");
        } else {
          setLoginError(`Erro no acesso: ${error.message}`);
        }
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl border border-zinc-200 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20 rotate-3">
              <Truck className="text-white" size={40} />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">FleetMaster</h1>
            <p className="text-zinc-500">Sistema de Controle de Frota e Logística</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Login</label>
              <input 
                name="login" 
                type="text" 
                required 
                defaultValue="Master"
                placeholder="Digite Master ou seu email"
                className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Senha</label>
              <input 
                name="password" 
                type="password" 
                required 
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" 
              />
              <p className="text-[10px] text-zinc-400 font-medium">Dica: Para o primeiro acesso Master, use a senha padrão.</p>
            </div>

            {loginError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
                <AlertCircle size={18} />
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-zinc-900/10"
            >
              <LogIn size={20} />
              Entrar no Sistema
            </button>
          </form>
          
          <p className="mt-8 text-xs text-zinc-400 text-center">
            Acesso restrito a funcionários autorizados.
          </p>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fleet', label: 'Frota', icon: Truck },
    { id: 'maintenance', label: 'Manutenção', icon: Wrench },
    { id: 'trips', label: 'Viagens', icon: MapPin },
    { id: 'logistics', label: 'Logística', icon: Package },
    { id: 'suppliers', label: 'Fornecedores', icon: FileText },
    ...(profile?.role === 'master' ? [{ id: 'users', label: 'Usuários', icon: Settings }] : []),
  ];

  return (
    <ErrorBoundary>
      <div className="flex bg-white min-h-screen">
        {profile?.role === 'master' ? (
          <>
            {/* Sidebar */}
            <aside 
              className={cn(
                "bg-zinc-900 text-zinc-400 w-64 flex-shrink-0 transition-all duration-300 ease-in-out border-r border-zinc-800 relative z-20",
                !isSidebarOpen && "w-20"
              )}
            >
              <div className="h-20 flex items-center px-6 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <Truck size={24} />
                  </div>
                  {isSidebarOpen && <span className="font-bold text-white text-xl tracking-tight">Frota Fácil</span>}
                </div>
              </div>

              <nav className="p-4 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id as View)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                      activeView === item.id 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                        : "hover:bg-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    <item.icon size={20} />
                    {isSidebarOpen && <span className="text-sm font-semibold">{item.label}</span>}
                  </button>
                ))}
              </nav>

              <div className="absolute bottom-0 w-full p-4 border-t border-zinc-800">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200 group"
                >
                  <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                  {isSidebarOpen && <span className="text-sm font-semibold">Sair do Sistema</span>}
                </button>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
              <header className="h-20 bg-white border-b border-zinc-200 flex items-center justify-between px-10 sticky top-0 z-10">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500"
                  >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 capitalize">
                      {navItems.find(i => i.id === activeView)?.label}
                    </h1>
                    <p className="text-xs text-zinc-400 font-medium">Bem-vindo de volta, {profile?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-2xl">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xs">
                      {profile?.name.charAt(0)}
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold text-zinc-900 leading-none">{profile?.name}</div>
                      <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">{profile?.role}</div>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 p-10 overflow-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeView}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeView === 'dashboard' && <DashboardView profile={profile} />}
                    {activeView === 'fleet' && <FleetView profile={profile} />}
                    {activeView === 'maintenance' && <MaintenanceView profile={profile} />}
                    {activeView === 'trips' && <TripsView profile={profile} />}
                    {activeView === 'logistics' && <LogisticsView profile={profile} />}
                    {activeView === 'suppliers' && <SuppliersView profile={profile} />}
                    {activeView === 'users' && <UsersView profile={profile} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </>
        ) : (
          /* Driver Specific Layout */
          <main className="flex-1 flex flex-col min-w-0 bg-zinc-50">
            <header className="h-20 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                  <Truck size={20} />
                </div>
                <div>
                  <h1 className="text-lg font-black text-zinc-900 tracking-tight leading-none">Frota Fácil</h1>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Driver Portal</p>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-900">{profile?.name}</p>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Motorista</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 p-6 overflow-auto">
              <DriverView profile={profile} />
            </div>
          </main>
        )}
      </div>
    </ErrorBoundary>
  );
}

// Sub-views will be implemented in the next turn to avoid token limits
function DashboardView({ profile }: { profile: UserProfile | null }) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);

  useEffect(() => {
    const unsubDrivers = subscribeToCollection<Driver>('drivers', setDrivers);
    const unsubTrucks = subscribeToCollection<TruckType>('trucks', setTrucks);
    const unsubTrips = subscribeToCollection<Trip>('trips', setTrips);
    const unsubMaint = subscribeToCollection<Maintenance>('maintenance', setMaintenances);
    return () => { unsubDrivers(); unsubTrucks(); unsubTrips(); unsubMaint(); };
  }, []);

  const stats = [
    { label: 'Caminhões em Viagem', value: trips.filter(t => t.status === 'active').length.toString(), icon: MapPin, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Manutenções Pendentes', value: maintenances.filter(m => m.status === 'pending').length.toString(), icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Total de Motoristas', value: drivers.length.toString(), icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Frota Total', value: trucks.length.toString(), icon: Truck, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  const SPREADSHEET_ID = '1-LiMadcWtaRNEH21XQJBB46Y7V2Un9Wrz8F2GI-SGSc';

  const fetchCSV = async (gid: string) => {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`);
    if (!response.ok) throw new Error(`Failed to fetch gid ${gid}`);
    const text = await response.text();
    return text.split('\n').map(line => {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.replace(/\r$/, '').trim());
      return row;
    }).filter(row => row.length > 0 && row.some(cell => cell !== ''));
  };

  const handleFullSync = async () => {
    if (!profile || profile.role !== 'master') return;
    setImporting(true);
    setImportProgress('Iniciando sincronização...');
    
    try {
      // 1. Drivers (gid=0)
      setImportProgress('Importando Motoristas...');
      const drivers = await fetchCSV('0');
      for (const row of drivers.slice(1)) {
        const [id, name, phone, password] = row;
        if (name && phone) {
          const cleanPhone = phone.replace(/\D/g, '');
          await setDocument('drivers', id || cleanPhone || name.replace(/\s/g, '_'), {
            externalId: id,
            name,
            phone: cleanPhone,
            password,
            licenseNumber: 'PENDENTE',
            status: 'active'
          });
        }
      }

      // 2. Trucks (gid=1831244482)
      setImportProgress('Importando Cavalinhos...');
      const trucks = await fetchCSV('1831244482');
      for (const row of trucks.slice(1)) {
        const [id, plate] = row;
        if (plate) {
          await setDocument('trucks', id || plate, {
            externalId: id,
            plate,
            model: 'Importado',
            year: 2024,
            status: 'available'
          });
        }
      }

      // 3. Trailers (gid=378037307)
      setImportProgress('Importando Carretas...');
      const trailers = await fetchCSV('378037307');
      for (const row of trailers.slice(1)) {
        const [id, plate] = row;
        if (plate && plate !== 'LEITURA DO SISTEMA') {
          await setDocument('trailers', id || plate, {
            externalId: id,
            plate,
            type: 'Importada',
            status: 'available'
          });
        }
      }

      // 4. Suppliers (gid=1903058866)
      setImportProgress('Importando Fornecedores...');
      const suppliers = await fetchCSV('1903058866');
      for (const row of suppliers.slice(1)) {
        const [id, name, cnpj, address, phone, contact] = row;
        if (name) {
          await setDocument('suppliers', id || name.replace(/\s/g, '_'), {
            externalId: id,
            name,
            cnpj: cnpj || 'PENDENTE',
            contact: contact || phone || 'PENDENTE'
          });
        }
      }

      // 5. Maintenance (gid=695536345)
      setImportProgress('Importando Manutenções...');
      const maintenance = await fetchCSV('695536345');
      for (const row of maintenance.slice(1)) {
        const [id, date, supplierId, cnpj, truckId, trailerId, paymentMethod] = row;
        if (id && date) {
          await setDocument('maintenance', id, {
            externalId: id,
            date,
            supplierId,
            truckId,
            trailerId: trailerId || undefined,
            description: 'Manutenção Importada',
            totalValue: 0,
            installments: 1,
            status: 'paid',
            paymentMethod
          });
        }
      }

      // 6. Products/Parts (gid=494038108)
      setImportProgress('Importando Peças e Serviços...');
      const parts = await fetchCSV('494038108');
      for (const row of parts.slice(1)) {
        const [id, description] = row;
        if (description) {
          await setDocument('products', id || description.replace(/\s/g, '_'), {
            externalId: id,
            name: description,
            code: id || 'S/N',
            unit: 'UN',
            stock: 0,
            minStock: 0
          });
        }
      }

      // 7. Trips (gid=1506768959)
      setImportProgress('Importando Viagens...');
      const trips = await fetchCSV('1506768959');
      for (const row of trips.slice(1)) {
        const [id, startDate, endDate, truckId, trailerId, driverId, route, trailerId2, status] = row;
        if (id && startDate) {
          await setDocument('trips', id, {
            externalId: id,
            startDate,
            endDate: endDate || undefined,
            truckId,
            trailerIds: [trailerId, trailerId2].filter(Boolean),
            driverId,
            route,
            status: status === 'Finalizadas' ? 'completed' : 'active',
            startKm: 0,
            checklist: { truckOk: true, trailersOk: true, tiresOk: true, lightsOk: true }
          });
        }
      }

      alert("Sincronização completa com sucesso!");
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Erro durante a sincronização. Verifique o console.");
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Visão Geral</h2>
          {importing && <p className="text-sm text-emerald-600 font-bold animate-pulse">{importProgress}</p>}
        </div>
        {profile?.role === 'master' && (
          <div className="flex gap-4">
            <button 
              onClick={async () => {
                if (drivers.length === 0) {
                  alert("Nenhum motorista carregado. Verifique se você já sincronizou os dados das planilhas.");
                  return;
                }
                if (!window.confirm(`Isso habilitará o acesso de ${drivers.length} motorista(s) cadastrado(s). Continuar?`)) return;
                setImporting(true);
                setImportProgress(`Habilitando acessos para ${drivers.length} motoristas...`);
                let successCount = 0;
                let errorDetails = "";
                
                try {
                  for (const driver of drivers) {
                    if (driver.phone) {
                      const cleanPhone = driver.phone.replace(/\D/g, '');
                      if (cleanPhone.length < 6) continue;

                      const email = `${cleanPhone}@fleet.com`;
                      const password = (driver.password && driver.password.length >= 6) 
                        ? driver.password 
                        : cleanPhone.slice(-6);

                      try {
                        setImportProgress(`Processando: ${driver.name} (${cleanPhone})...`);
                        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                        const uid = userCredential.user.uid;
                        await createUserProfile({
                          uid,
                          email: email,
                          name: driver.name,
                          role: 'employee',
                          createdAt: new Date().toISOString()
                        });
                        // Link UID to driver document
                        await updateDocument('drivers', driver.id, { uid });
                        await signOut(secondaryAuth);
                        successCount++;
                      } catch (e: any) {
                        if (e.code === 'auth/email-already-in-use') {
                          // Already exists, try to update profile just in case
                          successCount++;
                        } else {
                          console.error(`Erro no motorista ${driver.name}:`, e);
                          errorDetails += `\n- ${driver.name}: ${e.message}`;
                        }
                      }
                    }
                  }
                  alert(`Habilitação concluída!\nSucessos: ${successCount}${errorDetails ? '\n\nErros:' + errorDetails : ''}`);
                } catch (error: any) {
                  console.error(error);
                  alert("Erro fatal na operação: " + error.message);
                } finally {
                  setImporting(false);
                  setImportProgress('');
                }
              }}
              disabled={importing}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zinc-800 transition-all disabled:opacity-50 active:scale-95"
            >
              {importing ? <Loader2 className="animate-spin" size={20} /> : <Users size={20} />}
              Habilitar Acesso (Todos Motoristas)
            </button>
            <button 
              onClick={handleFullSync}
              disabled={importing}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 active:scale-95"
            >
              {importing ? <Loader2 className="animate-spin" size={20} /> : <History size={20} />}
              Sincronizar Dados (Planilhas)
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            whileHover={{ y: -4 }}
            className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 transition-all"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={stat.color} size={28} />
              </div>
            </div>
            <div className="text-3xl font-black text-zinc-900 tracking-tight">{stat.value}</div>
            <div className="text-sm text-zinc-400 font-bold uppercase tracking-wider mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-zinc-900">Viagens Recentes</h3>
            <button className="text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">Ver Todas</button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-emerald-200 transition-colors group cursor-pointer">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white rounded-xl border border-zinc-200 flex items-center justify-center group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all">
                    <Truck size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900">ABC-1234</div>
                    <div className="text-xs text-zinc-400 font-medium">São Paulo → Curitiba</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-emerald-500 uppercase tracking-widest">Em Trânsito</div>
                  <div className="text-[10px] text-zinc-400 font-bold mt-1">Iniciada há 4h</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-zinc-900">Alertas de Manutenção</h3>
            <button className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest">Ver Alertas</button>
          </div>
          <div className="space-y-4">
            {[1, 2].map((_, i) => (
              <div key={i} className="flex items-center gap-5 p-5 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <AlertCircle className="text-rose-500" size={24} />
                </div>
                <div>
                  <div className="font-bold text-rose-900">Troca de Óleo - DEF-5678</div>
                  <div className="text-xs text-rose-600 font-bold uppercase tracking-widest mt-1">Vencida há 2 dias</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



function FleetView({ profile }: { profile: UserProfile | null }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [activeTab, setActiveTab] = useState<'trucks' | 'trailers' | 'drivers'>('trucks');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    const unsubDrivers = subscribeToCollection<Driver>('drivers', setDrivers, [orderBy('name')]);
    const unsubTrucks = subscribeToCollection<TruckType>('trucks', setTrucks, [orderBy('plate')]);
    const unsubTrailers = subscribeToCollection<Trailer>('trailers', setTrailers, [orderBy('plate')]);
    return () => { unsubDrivers(); unsubTrucks(); unsubTrailers(); };
  }, []);

  const handleEnableAccess = async (driver: Driver) => {
    if (!driver.password || !driver.phone) {
      alert("Motorista sem senha ou telefone cadastrado.");
      return;
    }

    const email = `${driver.phone.replace(/\D/g, '')}@fleet.com`;
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, driver.password);
      const uid = userCredential.user.uid;
      await createUserProfile({
        uid,
        email: email,
        name: driver.name,
        role: 'employee',
        createdAt: new Date().toISOString()
      });
      // Link UID to driver document
      await updateDocument('drivers', driver.id, { uid });
      await signOut(secondaryAuth); // Sign out from secondary app immediately
      alert(`Acesso habilitado para ${driver.name}! Login: ${driver.phone}`);
    } catch (error: any) {
      console.error("Failed to enable access:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Este motorista já possui acesso habilitado.");
      } else {
        alert("Erro ao habilitar acesso: " + error.message);
      }
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      if (editingItem) {
        await updateDocument(activeTab, editingItem.id, data);
      } else {
        await addDocument(activeTab, { ...data, status: activeTab === 'drivers' ? 'active' : 'available' });
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este item?")) {
      await deleteDocument(activeTab, id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Gestão de Frota</h2>
          <p className="text-sm text-zinc-400 font-medium">Gerencie seus veículos e motoristas em um só lugar.</p>
        </div>
        {profile?.role === 'master' && (
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all font-bold shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            Novo {activeTab === 'trucks' ? 'Cavalo' : activeTab === 'trailers' ? 'Carreta' : 'Motorista'}
          </button>
        )}
      </div>

      <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl w-fit">
        {(['trucks', 'trailers', 'drivers'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all uppercase tracking-widest",
              activeTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            {tab === 'trucks' ? 'Cavalos' : tab === 'trailers' ? 'Carretas' : 'Motoristas'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder={`Buscar ${activeTab === 'trucks' ? 'cavalos' : activeTab === 'trailers' ? 'carretas' : 'motoristas'}...`} 
              className="w-full pl-12 pr-6 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100">
                <th className="px-8 py-5">Identificação</th>
                <th className="px-8 py-5">Detalhes</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {activeTab === 'trucks' && trucks.map((truck) => (
                <tr key={truck.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-black text-zinc-900 text-lg">{truck.plate}</div>
                      {truck.externalId && <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">ID: {truck.externalId}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-bold text-zinc-600">{truck.model}</div>
                    <div className="text-xs text-zinc-400 font-bold mt-1">{truck.year}</div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      truck.status === 'available' ? "bg-emerald-100 text-emerald-700" : 
                      truck.status === 'on-trip' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {truck.status === 'available' ? 'Disponível' : truck.status === 'on-trip' ? 'Em Viagem' : 'Manutenção'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setEditingItem(truck); setIsModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 'trailers' && trailers.map((trailer) => (
                <tr key={trailer.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-black text-zinc-900 text-lg">{trailer.plate}</div>
                      {trailer.externalId && <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">ID: {trailer.externalId}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-bold text-zinc-600">{trailer.type}</div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      trailer.status === 'available' ? "bg-emerald-100 text-emerald-700" : 
                      trailer.status === 'on-trip' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {trailer.status === 'available' ? 'Disponível' : trailer.status === 'on-trip' ? 'Em Viagem' : 'Manutenção'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => { setEditingItem(trailer); setIsModalOpen(true); }}
                      className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Settings size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {activeTab === 'drivers' && drivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 font-black">
                        {driver.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 flex items-center gap-2">
                          {driver.name}
                          {driver.externalId && <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">ID: {driver.externalId}</span>}
                        </div>
                        <div className="text-xs text-zinc-400 font-bold mt-0.5">{driver.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-bold text-zinc-600">CNH: {driver.licenseNumber}</div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      driver.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {driver.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {profile?.role === 'master' && driver.password && (
                        <button 
                          onClick={() => handleEnableAccess(driver)}
                          title="Habilitar Acesso ao App"
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <LogIn size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => { setEditingItem(driver); setIsModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`${editingItem ? 'Editar' : 'Novo'} ${activeTab === 'trucks' ? 'Cavalo' : activeTab === 'trailers' ? 'Carreta' : 'Motorista'}`}
      >
        <form onSubmit={handleSave} className="space-y-6">
          {activeTab === 'trucks' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Placa</label>
                <input name="plate" defaultValue={editingItem?.plate} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Modelo</label>
                <input name="model" defaultValue={editingItem?.model} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Ano</label>
                <input name="year" type="number" defaultValue={editingItem?.year} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
            </>
          )}
          {activeTab === 'trailers' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Placa</label>
                <input name="plate" defaultValue={editingItem?.plate} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Tipo</label>
                <input name="type" defaultValue={editingItem?.type} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
            </>
          )}
          {activeTab === 'drivers' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Nome Completo</label>
                <input name="name" defaultValue={editingItem?.name} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">CNH</label>
                <input name="licenseNumber" defaultValue={editingItem?.licenseNumber} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Telefone</label>
                <input name="phone" defaultValue={editingItem?.phone} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Senha de Acesso</label>
                <input name="password" defaultValue={editingItem?.password} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
              </div>
            </>
          )}
          
          <div className="flex gap-4 pt-4">
            {editingItem && (
              <button 
                type="button"
                onClick={() => handleDelete(editingItem.id)}
                className="flex-1 bg-rose-50 text-rose-500 py-4 rounded-2xl font-bold hover:bg-rose-100 transition-colors"
              >
                Excluir
              </button>
            )}
            <button 
              type="submit"
              className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


function MaintenanceView({ profile }: { profile: UserProfile | null }) {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Maintenance | null>(null);

  useEffect(() => {
    const unsubMaint = subscribeToCollection<Maintenance>('maintenance', setMaintenances, [orderBy('date', 'desc')]);
    const unsubTrucks = subscribeToCollection<TruckType>('trucks', setTrucks, [orderBy('plate')]);
    const unsubTrailers = subscribeToCollection<Trailer>('trailers', setTrailers, [orderBy('plate')]);
    const unsubSuppliers = subscribeToCollection<Supplier>('suppliers', setSuppliers, [orderBy('name')]);
    return () => { unsubMaint(); unsubTrucks(); unsubTrailers(); unsubSuppliers(); };
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      totalValue: parseFloat(data.totalValue as string),
      installments: parseInt(data.installments as string),
    };

    try {
      if (editingItem) {
        await updateDocument('maintenance', editingItem.id, payload);
      } else {
        await addDocument('maintenance', { ...payload, status: 'pending' });
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Controle de Manutenção</h2>
          <p className="text-sm text-zinc-400 font-medium">Lançamentos de manutenções, peças e parcelas.</p>
        </div>
        {profile?.role === 'master' && (
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all font-bold shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            Lançar Manutenção
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100">
                <th className="px-8 py-5">Data</th>
                <th className="px-8 py-5">Veículo</th>
                <th className="px-8 py-5">Descrição</th>
                <th className="px-8 py-5">Valor</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {maintenances.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-6 text-sm font-bold text-zinc-600">{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-8 py-6 font-mono font-black text-zinc-900">
                    <div className="flex flex-col">
                      <span>{trucks.find(t => t.externalId === m.truckId || t.id === m.truckId)?.plate || '---'}</span>
                      {m.trailerId && <span className="text-[10px] text-zinc-400">{trailers.find(t => t.externalId === m.trailerId || t.id === m.trailerId)?.plate || m.trailerId}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-zinc-600">{m.description}</td>
                  <td className="px-8 py-6 font-bold text-zinc-900">R$ {m.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      m.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {m.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => { setEditingItem(m); setIsModalOpen(true); }}
                      className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lançar Manutenção">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Veículo (Placa)</label>
              <select name="truckId" defaultValue={editingItem?.truckId} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none">
                <option value="">Selecione...</option>
                {trucks.map(t => <option key={t.id} value={t.id}>{t.plate} - {t.model}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Fornecedor</label>
              <select name="supplierId" defaultValue={editingItem?.supplierId} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none">
                <option value="">Selecione...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Data</label>
            <input name="date" type="date" defaultValue={editingItem?.date} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Descrição do Serviço / Peças</label>
            <textarea name="description" defaultValue={editingItem?.description} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none min-h-[100px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Valor Total (R$)</label>
              <input name="totalValue" type="number" step="0.01" defaultValue={editingItem?.totalValue} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Parcelas</label>
              <input name="installments" type="number" defaultValue={editingItem?.installments || 1} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
            Salvar Lançamento
          </button>
        </form>
      </Modal>
    </div>
  );
}

function SuppliersView({ profile }: { profile: UserProfile | null }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);

  useEffect(() => {
    const unsub = subscribeToCollection<Supplier>('suppliers', setSuppliers, [orderBy('name')]);
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      if (editingItem) {
        await updateDocument('suppliers', editingItem.id, data);
      } else {
        await addDocument('suppliers', data);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Fornecedores</h2>
          <p className="text-sm text-zinc-400 font-medium">Cadastro de fornecedores de peças e serviços.</p>
        </div>
        {profile?.role === 'master' && (
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all font-bold shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            Novo Fornecedor
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100">
                <th className="px-8 py-5">Nome</th>
                <th className="px-8 py-5">CNPJ</th>
                <th className="px-8 py-5">Contato</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-6 font-bold text-zinc-900">
                    <div className="flex items-center gap-2">
                      {s.name}
                      {s.externalId && <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">ID: {s.externalId}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-zinc-600">{s.cnpj}</td>
                  <td className="px-8 py-6 text-sm text-zinc-600">{s.contact}</td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => { setEditingItem(s); setIsModalOpen(true); }}
                      className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastro de Fornecedor">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Nome / Razão Social</label>
            <input name="name" defaultValue={editingItem?.name} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">CNPJ</label>
            <input name="cnpj" defaultValue={editingItem?.cnpj} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Contato / Telefone</label>
            <input name="contact" defaultValue={editingItem?.contact} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>
          <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
            Salvar Fornecedor
          </button>
        </form>
      </Modal>
    </div>
  );
}

function LogisticsView({ profile }: { profile: UserProfile | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const unsubInvoices = subscribeToCollection<Invoice>('invoices', setInvoices, [orderBy('date', 'desc')]);
    const unsubProducts = subscribeToCollection<Product>('products', setProducts, [orderBy('name')]);
    return () => { unsubInvoices(); unsubProducts(); };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const invoiceData = parseNFXml(text);
      
      await addDocument('invoices', {
        ...invoiceData,
        status: 'received'
      });

      for (const item of invoiceData.items) {
        const existingProduct = products.find(p => p.code === item.code);
        if (existingProduct) {
          await updateDocument('products', existingProduct.id, {
            stock: existingProduct.stock + item.quantity,
            lastPrice: item.unitValue
          });
        } else {
          await addDocument('products', {
            code: item.code,
            name: item.description,
            unit: item.unit,
            stock: item.quantity,
            lastPrice: item.unitValue
          });
        }
      }
      alert("Nota Fiscal importada com sucesso!");
    } catch (error) {
      console.error("XML Import failed:", error);
      alert("Erro ao importar XML.");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Logística e Estoque</h2>
          <p className="text-sm text-zinc-400 font-medium">Gestão de Notas Fiscais e saldo de produtos.</p>
        </div>
        <label className={cn(
          "bg-zinc-900 hover:bg-black text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all font-bold cursor-pointer shadow-lg active:scale-95",
          isUploading && "opacity-50 cursor-not-allowed"
        )}>
          <FileUp size={20} />
          {isUploading ? 'Processando...' : 'Importar XML NFe'}
          <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Notas Fiscais</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100">
                    <th className="px-6 py-4">Número</th>
                    <th className="px-6 py-4">Emitente</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-zinc-900">{inv.number}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600 truncate max-w-[200px]">{inv.issuer.name}</td>
                      <td className="px-6 py-4 font-bold text-zinc-900">R$ {inv.totalValue.toLocaleString('pt-BR')}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-widest">Recebida</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Saldo em Estoque</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {products.map((p) => (
              <div key={p.id} className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold text-zinc-900">{p.name}</p>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{p.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-600">{p.stock} <span className="text-xs font-medium text-zinc-400">{p.unit}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TripsView({ profile }: { profile: UserProfile | null }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Trip | null>(null);

  useEffect(() => {
    const unsubTrips = subscribeToCollection<Trip>('trips', setTrips, [orderBy('startDate', 'desc')]);
    const unsubDrivers = subscribeToCollection<Driver>('drivers', setDrivers, [orderBy('name')]);
    const unsubTrucks = subscribeToCollection<TruckType>('trucks', setTrucks, [orderBy('plate')]);
    const unsubTrailers = subscribeToCollection<Trailer>('trailers', setTrailers, [orderBy('plate')]);
    return () => { unsubTrips(); unsubDrivers(); unsubTrucks(); unsubTrailers(); };
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const trailerIds = formData.getAll('trailerIds') as string[];
      const tripData = {
        ...data,
        trailerIds, // replaces the single value if any
      };
      
      if (editingItem) {
        await updateDocument('trips', editingItem.id, tripData);
      } else {
        await addDocument('trips', {
          ...tripData,
          status: 'active',
          expenses: [],
          checklist: {
            items: [],
            notes: '',
            completedAt: null
          }
        });
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Gestão de Viagens</h2>
          <p className="text-sm text-zinc-400 font-medium">Controle de rotas, checklists e despesas.</p>
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all font-bold shadow-lg active:scale-95"
        >
          <Plus size={20} />
          Nova Viagem
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100">
                <th className="px-8 py-5">Início</th>
                <th className="px-8 py-5">Motorista</th>
                <th className="px-8 py-5">Veículo</th>
                <th className="px-8 py-5">Destino</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {trips.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-6 text-sm font-bold text-zinc-600">{new Date(t.startDate).toLocaleDateString('pt-BR')}</td>
                  <td className="px-8 py-6 font-bold text-zinc-900">{drivers.find(d => d.externalId === t.driverId || d.id === t.driverId)?.name || '---'}</td>
                  <td className="px-8 py-6 font-mono font-black text-zinc-900">
                    <div className="flex flex-col">
                      <span>{trucks.find(tr => tr.externalId === t.truckId || tr.id === t.truckId)?.plate || '---'}</span>
                      <div className="flex gap-1">
                        {t.trailerIds.map(tid => (
                          <span key={tid} className="text-[10px] text-zinc-400">{trailers.find(tr => tr.externalId === tid || tr.id === tid)?.plate || tid}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-zinc-600">{t.route || '---'}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      t.status === 'active' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {t.status === 'active' ? 'Em Viagem' : 'Finalizada'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => { setEditingItem(t); setIsModalOpen(true); }}
                      className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Settings size={18} />
                    </button>
                    <button className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Viagem" : "Nova Viagem"}>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Motorista</label>
              <select name="driverId" defaultValue={editingItem?.driverId} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none">
                <option value="">Selecione...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Caminhão</label>
              <select name="truckId" defaultValue={editingItem?.truckId} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none">
                <option value="">Selecione...</option>
                {trucks.map(tr => <option key={tr.id} value={tr.id}>{tr.plate}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Carretas</label>
            <div className="grid grid-cols-2 gap-2">
              {trailers.map(tr => (
                <label key={tr.id} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 hover:bg-emerald-50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="trailerIds" 
                    value={tr.id} 
                    defaultChecked={editingItem?.trailerIds.includes(tr.id)}
                    className="w-4 h-4 accent-emerald-500" 
                  />
                  <span className="text-xs font-bold text-zinc-700">{tr.plate}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Destino (Título da Viagem)</label>
            <input name="route" defaultValue={editingItem?.route} required placeholder="Ex: São Paulo → Curitiba" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Data de Início</label>
            <input name="startDate" type="date" defaultValue={editingItem?.startDate} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
          </div>
          <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg">
            {editingItem ? "Salvar Alterações" : "Iniciar Viagem"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function UsersView({ profile }: { profile: UserProfile | null }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeToCollection<UserProfile>('users', setUsers, [orderBy('email')]);
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      if (editingUser) {
        await updateDocument('users', editingUser.id, {
          role: data.role as 'master' | 'employee'
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  if (profile?.role !== 'master') {
    return <div className="p-10 text-center text-rose-500 font-bold">Acesso restrito ao administrador.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Gestão de Usuários</h2>
          <p className="text-sm text-zinc-400 font-medium">Controle de acesso e permissões da equipe.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100">
                <th className="px-8 py-5">Nome</th>
                <th className="px-8 py-5">Email</th>
                <th className="px-8 py-5">Função</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-6 font-bold text-zinc-900">{u.name}</td>
                  <td className="px-8 py-6 text-sm text-zinc-600">{u.email}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      u.role === 'master' ? "bg-purple-100 text-purple-700" : "bg-zinc-100 text-zinc-700"
                    )}>
                      {u.role === 'master' ? 'Master' : 'Funcionário'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => { setEditingUser(u); setIsModalOpen(true); }}
                      className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Editar Permissões">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Usuário</label>
            <p className="font-bold text-zinc-900">{editingUser?.name} ({editingUser?.email})</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Função</label>
            <select name="role" defaultValue={editingUser?.role} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none">
              <option value="employee">Funcionário</option>
              <option value="master">Master</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg">
            Salvar Alterações
          </button>
        </form>
      </Modal>
    </div>
  );
}

function DriverView({ profile }: { profile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'checklist' | 'fuel' | 'lunch'>('checklist');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    // First, subscribe to drivers to find our internal ID
    const unsubDrivers = subscribeToCollection<Driver>('drivers', (drivers) => {
      console.log("DEBUG: Drivers found:", drivers.length);
      const myDriverRecord = drivers.find(d => d.uid === profile.uid);
      
      if (!myDriverRecord) {
        console.warn("DEBUG: Driver record NOT found for UID:", profile.uid);
        return;
      }

      console.log("DEBUG: My Driver Record:", myDriverRecord.name, "ID:", myDriverRecord.id, "ExtID:", myDriverRecord.externalId);

      // Then subscribe to trips
      const unsubTrips = subscribeToCollection<Trip>('trips', (trips) => {
        const activeTrips = trips.filter(t => t.status === 'active');
        console.log("DEBUG: Total active trips:", activeTrips.length);
        
        const current = trips.find(t => 
          (t.driverId === myDriverRecord.id || t.driverId === myDriverRecord.externalId) && 
          t.status === 'active'
        );
        
        if (current) {
          console.log("DEBUG: Active trip found:", current.id, "Route:", current.route);
        } else {
          console.warn("DEBUG: No active trip found for driverId:", myDriverRecord.id, "or", myDriverRecord.externalId);
        }
        
        setActiveTrip(current || null);
      });
      return unsubTrips;
    });

    return () => unsubDrivers();
  }, [profile]);

  const handleChecklistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeTrip) return alert("Nenhuma viagem ativa encontrada.");
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      setUploading(true);
      const items = Array.from(e.currentTarget.elements)
        .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'checkbox' && el.checked)
        .map(el => el.nextElementSibling?.textContent?.replace(' OK', '') || el.value);

      await updateDocument('trips', activeTrip.id, {
        checklist: {
          items,
          notes: data.notes as string,
          completedAt: new Date().toISOString()
        }
      });
      alert("Checklist enviado com sucesso!");
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleFuelSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeTrip) return alert("Nenhuma viagem ativa encontrada.");
    const formData = new FormData(e.currentTarget);
    const file = (e.currentTarget.elements.namedItem('photo') as HTMLInputElement).files?.[0];
    
    try {
      setUploading(true);
      let photoUrl = '';
      if (file) {
        const compressed = await compressImage(file);
        photoUrl = 'URL_PROVISORIA'; 
      }

      await addDocument('fuel_entries', {
        tripId: activeTrip.id,
        date: new Date().toISOString(),
        km: parseFloat(formData.get('km') as string),
        liters: parseFloat(formData.get('liters') as string),
        value: parseFloat(formData.get('value') as string),
        photoUrl
      });
      alert("Abastecimento registrado!");
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleLunch = async () => {
    if (!activeTrip) return alert("Nenhuma viagem ativa encontrada.");
    try {
      await addDocument('lunch_entries', {
        tripId: activeTrip.id,
        date: new Date().toISOString()
      });
      alert("Almoço registrado!");
    } catch (error) {
      console.error(error);
    }
  };

  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);

  useEffect(() => {
    const unsubTrucks = subscribeToCollection<TruckType>('trucks', setTrucks);
    const unsubTrailers = subscribeToCollection<Trailer>('trailers', setTrailers);
    return () => { unsubTrucks(); unsubTrailers(); };
  }, []);

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white rounded-3xl border border-zinc-200">
        <AlertCircle className="text-zinc-400 mb-4" size={48} />
        <h3 className="text-xl font-bold text-zinc-900">Nenhuma Viagem Ativa</h3>
        <p className="text-zinc-500 text-center mt-2">Aguarde o administrador designar uma viagem para você.</p>
      </div>
    );
  }

  const truckPlate = trucks.find(t => t.id === activeTrip.truckId || t.externalId === activeTrip.truckId)?.plate || activeTrip.truckId;
  const trailerPlates = activeTrip.trailerIds?.map(tid => trailers.find(t => t.id === tid || t.externalId === tid)?.plate || tid);

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 p-8 rounded-3xl text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black">Viagem Atual</h2>
            <p className="text-zinc-400 font-medium">{activeTrip.route || 'Rota não definida'}</p>
          </div>
          <div className="bg-emerald-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Em Rota</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800 p-4 rounded-2xl">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Cavalinho</p>
            <p className="font-mono font-bold text-lg">{truckPlate}</p>
          </div>
          <div className="bg-zinc-800 p-4 rounded-2xl">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Carreta(s)</p>
            <p className="font-mono font-bold text-lg">{trailerPlates?.join(' / ') || 'Nenhuma'}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl w-full">
        {(['checklist', 'fuel', 'lunch'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest flex items-center justify-center gap-2",
              activeTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            {tab === 'checklist' && <CheckCircle2 size={16} />}
            {tab === 'fuel' && <Fuel size={16} />}
            {tab === 'lunch' && <Utensils size={16} />}
            {tab === 'checklist' ? 'Checklist' : tab === 'fuel' ? 'Abastecer' : 'Almoço'}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm"
      >
        {activeTab === 'checklist' && (
          <form onSubmit={handleChecklistSubmit} className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-bold text-zinc-900">Verifique os itens antes de sair:</p>
              <div className="grid gap-3">
                {['Pneus', 'Freios', 'Luzes', 'Nível de Óleo', 'Engate'].map(item => (
                  <label key={item} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 accent-emerald-500" required />
                    <span className="font-medium text-zinc-700">{item} OK</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Observações ou Fotos (Opcional)</label>
                <textarea name="notes" placeholder="Descreva qualquer detalhe importante..." className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" rows={3}></textarea>
                <div className="flex gap-4">
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl p-6 hover:border-emerald-500 transition-colors cursor-pointer text-zinc-400 hover:text-emerald-500">
                    <Plus size={24} className="mb-2" />
                    <span className="text-xs font-bold">Adicionar Foto</span>
                    <input type="file" className="hidden" accept="image/*" capture="environment" />
                  </label>
                </div>
              </div>
            </div>
            <button type="submit" disabled={uploading} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all">
              {uploading ? 'Enviando...' : 'Confirmar Checklist'}
            </button>
          </form>
        )}

        {activeTab === 'fuel' && (
          <form onSubmit={handleFuelSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">KM Atual</label>
                <input name="km" type="number" required placeholder="000.000" className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Litros</label>
                <input name="liters" type="number" step="0.01" required placeholder="00,00" className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Valor Total (R$)</label>
              <input name="value" type="number" step="0.01" required placeholder="R$ 0,00" className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Foto do Comprovante</label>
              <input name="photo" type="file" accept="image/*" capture="environment" required className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
            </div>
            <button type="submit" disabled={uploading} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all">
              {uploading ? 'Registrando...' : 'Salvar Abastecimento'}
            </button>
          </form>
        )}

        {activeTab === 'lunch' && (
          <div className="flex flex-col items-center justify-center p-10 space-y-6">
            <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
              <Utensils size={48} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-900">Hora do Almoço</h3>
              <p className="text-zinc-500 mt-2">Registre sua saída ou retorno do intervalo.</p>
            </div>
            <button onClick={handleLunch} className="w-full max-w-xs bg-amber-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">
              Registrar Agora
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
