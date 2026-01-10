import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { Download, Key, AlertTriangle, Loader2, ArrowLeft, Lock, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFiles, downloadAndDecryptFile, DriveFile } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

export const DownloadPage = () => {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [decryptionKey, setDecryptionKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken && user) {
      loadUserFiles();
    }
  }, [accessToken, user]);

  const loadUserFiles = async () => {
    if (!accessToken || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      const userFiles = await getUserFiles(accessToken, user.id);
      setFiles(userFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile || !decryptionKey || !accessToken) {
      setError('Please select a file and enter the decryption key');
      return;
    }

    if (decryptionKey.length < 3) {
      setError('Decryption key must be at least 3 characters');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const { data, filename } = await downloadAndDecryptFile(
        accessToken,
        selectedFile.id,
        decryptionKey
      );

      // Trigger download
      const url = URL.createObjectURL(data);
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

      // Reset form
      setSelectedFile(null);
      setDecryptionKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file. Check your decryption key.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Check if user is authenticated - use multiple checks
  if (!accessToken || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8 md:py-16">
          <div className="mx-auto max-w-lg">
            <Card className="bg-card">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Authentication Required</CardTitle>
                <CardDescription>
                  Sign in with Google to access your encrypted files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Your files are encrypted and stored in your Google Drive. Sign in to decrypt and download them.
                  </AlertDescription>
                </Alert>
                
                <Button asChild className="w-full mt-4">
                  <Link to="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go to Home & Sign In
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 md:py-16">
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <Card className="bg-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Download & Decrypt File</CardTitle>
              <CardDescription>
                Select a file and enter your encryption key to download
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* File Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Select File
                </Label>
                
                {isLoading ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading your files...
                  </div>
                ) : files.length === 0 ? (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      No encrypted files found. Upload a file first from the dashboard.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          selectedFile?.id === file.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {file.appProperties?.originalName || file.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(file.createdTime).toLocaleDateString()} • {file.size ? `${(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                            </p>
                          </div>
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Decryption Key Input */}
              {selectedFile && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="decryptionKey" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Decryption Key
                    </Label>
                    <Input
                      id="decryptionKey"
                      type="password"
                      placeholder="Enter the encryption key you used"
                      value={decryptionKey}
                      onChange={(e) => setDecryptionKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                      disabled={isDownloading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the same key you used when uploading this file
                    </p>
                  </div>

                  <Button
                    onClick={handleDownload}
                    disabled={!decryptionKey || isDownloading}
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
                </>
              )}

              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Your files are encrypted with AES-256. The wrong key will fail to decrypt the file.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};