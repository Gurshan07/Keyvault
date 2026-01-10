import { Button } from '@/components/ui/button';
import { Cloud, Key, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export const LandingHero = () => {
  const { signIn, isLoading, error } = useAuth();

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent to-background" />
      
      <div className="relative container py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border bg-card px-4 py-1.5 text-sm">
            <Cloud className="mr-2 h-4 w-4 text-primary" />
            <span>Serverless • No Database • Zero Storage Costs</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            Share Files with{' '}
            <span className="text-primary">Custom Keys</span>
          </h1>

          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Upload files to your own Google Drive and share them using simple, memorable keys. 
            Anyone with the key can download — no login required.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={signIn}
              disabled={isLoading}
              className="text-lg px-8"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Cloud className="mr-2 h-5 w-5" />
              )}
              Sign in with Google
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8">
              <Link to="/download">
                <Download className="mr-2 h-5 w-5" />
                Download a File
              </Link>
            </Button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}

          {/* Feature highlights */}
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Cloud className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">Your Storage</h3>
              <p className="text-sm text-muted-foreground">
                Files are stored in your Google Drive. We never touch your data.
              </p>
            </div>

            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">Custom Keys</h3>
              <p className="text-sm text-muted-foreground">
                Create memorable share keys like "vacation-2024" instead of random links.
              </p>
            </div>

            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">No Login to Download</h3>
              <p className="text-sm text-muted-foreground">
                Anyone with the key can download. No account required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
