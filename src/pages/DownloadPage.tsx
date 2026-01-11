import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { Download, Key, AlertTriangle, Loader2, ArrowLeft, Lock, FileText } from 'lucide-react';
import { downloadFileFromDrive, parseShareUrl } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

export const DownloadPage = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const { toast } = useToast();
  
  // Get key from URL fragment
  const [decryptionKey, setDecryptionKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse key from URL fragment (#key=iron-sparrow-echo)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const key = params.get('key');
      if (key) {
        setDecryptionKey(key);
      }
    }
  }, []);

  const handleDownload = async () => {
    if (!fileId || !decryptionKey) {
      setError('Please enter the decryption key');
      return;
    }

    if (decryptionKey.length < 5) {
      setError('Decryption key must be at least 5 characters');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const { file, filename, policies } = await downloadFileFromDrive(
        fileId,
        decryptionKey
      );

      // Trigger download
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download successful!',
        description: `${filename} has been decrypted and downloaded.`,
      });

      setDecryptionKey('');
    } catch (err) {
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to decrypt file. Check your decryption key and try again.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 md:py-16">
        <div className="mx-auto max-w-lg">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>

          <Card className="bg-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Download Encrypted File</CardTitle>
              <CardDescription>
                Enter your decryption key to download
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  This file is encrypted with AES-256. Enter the correct key to decrypt and download.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="decryptionKey" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Decryption Key
                </Label>
                <Input
                  id="decryptionKey"
                  type="text"
                  placeholder="e.g., iron-sparrow-echo"
                  value={decryptionKey}
                  onChange={(e) => setDecryptionKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                  disabled={isDownloading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the key shared with you (minimum 5 characters)
                </p>
              </div>

              <Button
                onClick={handleDownload}
                disabled={!decryptionKey || decryptionKey.length < 5 || isDownloading}
                className="w-full"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Decrypting & Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Decrypt & Download
                  </>
                )}
              </Button>

              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>How it works:</strong>
                  <ol className="mt-2 space-y-1 list-decimal list-inside">
                    <li>Enter the decryption key</li>
                    <li>File is downloaded and decrypted in your browser</li>
                    <li>Original file is saved to your device</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};