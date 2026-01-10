import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { Download, Key, AlertTriangle, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';

export const DownloadPage = () => {
  const { key: urlKey } = useParams<{ key: string }>();
  const [inputKey, setInputKey] = useState(urlKey || '');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    downloadUrl: string;
    size?: string;
  } | null>(null);

  const handleSearch = async () => {
    if (!inputKey.trim()) {
      setError('Please enter a share key');
      return;
    }

    setIsSearching(true);
    setError(null);
    setFileInfo(null);

    try {
      // For public access, we need to search using the Drive API
      // This requires either:
      // 1. A service account with access to all uploaded files
      // 2. A serverless function that stores file mappings
      // 3. User to be authenticated to search their files
      
      // Since we're using session-only auth and no database,
      // we'll guide users to use the correct approach
      
      // The key format is: userId_customKey
      // We'll construct a direct Drive link if possible
      
      const keyParts = inputKey.split('_');
      if (keyParts.length < 2) {
        setError('Invalid key format. Keys should be in format: userId_customKey');
        setIsSearching(false);
        return;
      }

      // For demonstration, we'll show how the download would work
      // In a real implementation, you'd need a way to resolve the key
      
      // Option 1: If the file ID is encoded in the key
      // Option 2: Use a public Google Sheet/JSON to map keys
      // Option 3: The uploader shares the direct download link
      
      setError(
        'To download files shared via DriveShare, the uploader should share the complete download link with you, ' +
        'which they can copy from their dashboard after uploading.'
      );
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find file');
    } finally {
      setIsSearching(false);
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
              <CardTitle className="text-2xl">Download File</CardTitle>
              <CardDescription>
                Enter the share key to download a file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {fileInfo ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-accent p-4 text-center">
                    <p className="font-medium mb-2">{fileInfo.name}</p>
                    {fileInfo.size && (
                      <p className="text-sm text-muted-foreground mb-4">
                        Size: {fileInfo.size}
                      </p>
                    )}
                    <Button asChild className="w-full">
                      <a 
                        href={fileInfo.downloadUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download File
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="shareKey" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Share Key
                    </Label>
                    <Input
                      id="shareKey"
                      placeholder="e.g., abc123_vacation-photos"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      disabled={isSearching}
                    />
                  </div>

                  <Button
                    onClick={handleSearch}
                    disabled={!inputKey.trim() || isSearching}
                    className="w-full"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Find & Download
                      </>
                    )}
                  </Button>
                </>
              )}

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">How it works:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>The file owner uploads to their Google Drive</li>
                  <li>They create a custom share key</li>
                  <li>They share the download link with you</li>
                  <li>You can download without logging in</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Want to share your own files?
            </p>
            <Button variant="outline" asChild>
              <Link to="/">
                <ExternalLink className="mr-2 h-4 w-4" />
                Sign in with Google
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
