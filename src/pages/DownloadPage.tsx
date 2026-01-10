import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { Download, Key, AlertTriangle, Loader2, ArrowLeft, Lock, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { decryptFile, base64ToUint8Array } from '@/lib/encryption';
import { parseEncryptedFilename } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

export const DownloadPage = () => {
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractFileIdFromUrl = (url: string): string | null => {
    // Extract Google Drive file ID from various URL formats
    const patterns = [
      /drive\.google\.com\/file\/d\/([^\/]+)/,
      /drive\.google\.com\/open\?id=([^&]+)/,
      /id=([^&]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    // If it's just an ID
    if (url.length > 20 && !url.includes('/')) {
      return url;
    }

    return null;
  };

  const handleDownload = async () => {
    if (!fileUrl || !decryptionKey) {
      setError('Please enter both file URL/ID and decryption key');
      return;
    }

    if (decryptionKey.length < 3) {
      setError('Decryption key must be at least 3 characters');
      return;
    }

    const fileId = extractFileIdFromUrl(fileUrl);
    if (!fileId) {
      setError('Invalid Google Drive URL or file ID');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      // First, get file metadata to extract filename
      const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size`;
      const metadataResponse = await fetch(metadataUrl);
      
      if (!metadataResponse.ok) {
        throw new Error('Failed to fetch file metadata. Make sure the file is publicly accessible.');
      }

      const metadata = await metadataResponse.json();
      const filename = metadata.name;

      // Parse encryption metadata from filename
      const encryptionMeta = parseEncryptedFilename(filename);
      
      if (!encryptionMeta) {
        throw new Error('Invalid encrypted file. The filename must contain encryption metadata.');
      }

      // Fetch the encrypted file
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('Failed to download file. Make sure the file is publicly accessible.');
      }

      const encryptedData = await response.arrayBuffer();

      // Decrypt the file
      const salt = base64ToUint8Array(encryptionMeta.salt);
      const iv = base64ToUint8Array(encryptionMeta.iv);
      
      const decryptedData = await decryptFile(encryptedData, decryptionKey, salt, iv);
      
      // Trigger download
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

      // Reset form
      setFileUrl('');
      setDecryptionKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download and decrypt file. Check your decryption key.');
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
                Enter the file link and decryption key to download
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>How it works:</strong>
                  <ol className="mt-2 text-xs space-y-1 list-decimal list-inside">
                    <li>Someone shares their Google Drive file link with you</li>
                    <li>They also share the encryption key (e.g., "saksham")</li>
                    <li>You enter both here to decrypt and download</li>
                    <li>The encryption metadata is stored in the filename itself</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="fileUrl" className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Google Drive File Link or ID
                </Label>
                <Input
                  id="fileUrl"
                  placeholder="https://drive.google.com/file/d/..."
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  disabled={isDownloading}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the Google Drive link shared with you
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decryptionKey" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Decryption Key
                </Label>
                <Input
                  id="decryptionKey"
                  type="password"
                  placeholder="Enter the key (e.g., saksham)"
                  value={decryptionKey}
                  onChange={(e) => setDecryptionKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                  disabled={isDownloading}
                />
                <p className="text-xs text-muted-foreground">
                  The encryption key shared with you (minimum 3 characters)
                </p>
              </div>

              <Button
                onClick={handleDownload}
                disabled={!fileUrl || !decryptionKey || isDownloading}
                className="w-full"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading & Decrypting...
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
                <AlertDescription className="text-sm">
                  <strong>Security Note:</strong> Files are encrypted with AES-256. The encryption metadata 
                  (salt/IV) is encoded in the filename and is public, but the file content remains encrypted 
                  without the correct decryption key.
                </AlertDescription>
              </Alert>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">For file uploaders:</p>
                <p className="text-xs text-muted-foreground">
                  After uploading, share both the Google Drive link AND the encryption key with your recipient. 
                  They can then download and decrypt the file here without needing a Google account.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};