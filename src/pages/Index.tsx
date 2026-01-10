import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { LandingHero } from '@/components/LandingHero';
import { Dashboard } from '@/components/Dashboard';

const IndexContent = () => {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {isLoading ? (
          <div className="container py-24 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        ) : isAuthenticated ? (
          <Dashboard />
        ) : (
          <LandingHero />
        )}
      </main>
      
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>DriveShare — Store files in your Google Drive, share with custom keys.</p>
          <p className="mt-1">No database. No server storage. Your files, your Drive.</p>
        </div>
      </footer>
    </div>
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <IndexContent />
    </AuthProvider>
  );
};

export default Index;
