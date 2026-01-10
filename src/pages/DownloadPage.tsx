import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { Download, Key, AlertTriangle, Loader2, ArrowLeft, Lock, FileText, Unlock } from 'lucide-react';
import { decryptFile, base64ToUint8Array } from '@/lib/encryption';
import { parseEncryptedFilename } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

export const DownloadPage = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const { toast } = useToast();
  const [decryptionKey, setDecryptionKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCheckingFile, setIsCheckingFile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size?: string;
    isEncrypted: boolean;
  } | null>(null);

  useEffect(() => {
    checkFileMetadata();
  }, [fileId]);

  const checkFileMetadata = async () => {
    if (!fileId) {
      setError('No file ID provided');
      setIsCheckingFile(false);
      return;
    }

    setIsCheckingFile(true);
    setError(null);

    try {
      // Fetch file metadata without authentication (public access)
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size,mimeType`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('File not found or not publicly accessible');
      }

      const metadata = await response.json();
      const filename = metadata.name;
      
      // Check if file is encrypted by parsing filename
      const encryptionMeta = parseEncryptedFilename(filename);
      
      setFileInfo({
        name: encryptionMeta ? encryptionMeta.originalName : filename,
        size: metadata.size ? `${(parseInt(metadata.size) / 1024 / 1024).toFixed(2)} MB` : undefined,
        isEncrypted: encryptionMeta !== null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check file. Make sure it exists and is publicly shared.');
    } finally {
      setIsCheckingFile(false);
    }
  };

  const handlePublicDownload = async () => {
    if (!fileId) return;

    setIsDownloading(true);
    setError(null);

    try {
      // Direct download without decryption
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo?.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download successful!',
        description: `${fileInfo?.name} has been downloaded.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEncryptedDownload = async () => {
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
      // Fetch metadata again to get encryption params
      const metadataResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`,
        { method: 'GET' }
      );

      if (!metadataResponse.ok) {
        throw new Error('Failed to fetch file metadata');
      }

      const metadata = await metadataResponse.json();
      const encryptionMeta = parseEncryptedFilename(metadata.name);

      if (!encryptionMeta) {
        throw new Error('This file is not encrypted');
      }

      // Download encrypted file
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const encryptedData = await response.arrayBuffer();

      // Decrypt
      const salt = base64ToUint8Array(encryptionMeta.salt);
      const iv = base64ToUint8Array(encryptionMeta.iv);
      
      const decryptedData = await decryptFile(encryptedData, decryptionKey, salt, iv);

      // Download
      const blob = new Blob([decryptedData]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = encryptionMeta.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download successful!',
        description: `${encryptionMeta.originalName} has been decrypted and downloaded.`,
      });

      setDecryptionKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decrypt file. Check your decryption key.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isCheckingFile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 md:py-16">
          <div className="mx-auto max-w-lg text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">Checking file...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !fileInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 md:py-16">
          <div className="mx-auto max-w-lg">
            <Card className="bg-card">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">File Not Found</CardTitle>
                <CardDescription>
                  This file doesn't exist or isn't publicly accessible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                
                <Button asChild className="w-full mt-4" variant="outline">
                  <Link to="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go to Home
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
              <CardTitle className="text-2xl">Download File</CardTitle>
              <CardDescription>
                {fileInfo?.isEncrypted ? 'Enter decryption key to download' : 'Click to download'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {fileInfo && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p><strong>File:</strong> {fileInfo.name}</p>
                      {fileInfo.size && <p><strong>Size:</strong> {fileInfo.size}</p>}
                      <p>
                        <strong>Type:</strong>{' '}
                        {fileInfo.isEncrypted ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Encrypted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Unlock className="h-3 w-3" /> Public
                          </span>
                        )}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {fileInfo?.isEncrypted ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="decryptionKey" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Decryption Key
                    </Label>
                    <Input
                      id="decryptionKey"
                      type="password"
                      placeholder="Enter the encryption key (min 5 characters)"
                      value={decryptionKey}
                      onChange={(e) => setDecryptionKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEncryptedDownload()}
                      disabled={isDownloading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ask the uploader for the decryption key
                    </p>
                  </div>

                  <Button
                    onClick={handleEncryptedDownload}
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
                    <Lock className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This file is encrypted with AES-256. Decryption happens securely in your browser.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
                  <Button
                    onClick={handlePublicDownload}
                    disabled={isDownloading}
                    className="w-full"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download File
                      </>
                    )}
                  </Button>

                  <Alert>
                    <Unlock className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This file is publicly accessible and not encrypted.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};