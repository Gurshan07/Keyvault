import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Upload, Key, AlertTriangle, Check, Loader2, Lock, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFileToDrive, generateHumanKey } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onUploadComplete?: () => void;
}

export const FileUploader = ({ onUploadComplete }: FileUploaderProps) => {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'public' | 'encrypted'>('encrypted');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ shareUrl: string; humanKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!file || !accessToken || !user) {
      setError('Please select a file');
      return;
    }

    if (encryptionKey.length < 5) {
      setError('Encryption key must be at least 5 characters');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadFileToDrive(
        accessToken,
        file,
        encryptionKey,
        {
          expiresAt: undefined,
          maxDownloads: undefined,
          selfDestruct: false,
        }
      );
      
      setUploadResult(result);
      
      toast({
        title: 'File encrypted and uploaded!',
        description: 'Your file is securely stored in your Google Drive.',
      });

      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const generateKey = () => {
    const key = generateHumanKey();
    setEncryptionKey(key);
  };

  const resetForm = () => {
    setFile(null);
    setUploadMode('encrypted');
    setEncryptionKey('');
    setUseCustomKey(false);
    setUploadResult(null);
    setError(null);
  };

  if (uploadResult) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-primary">
            <Check className="h-5 w-5" />
            Upload Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-accent p-4">
            <p className="text-sm font-medium mb-2">
              File: {file?.name}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Encrypted and saved in your Drive
            </p>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Lock className="h-3 w-3" />
                  Share Link
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={uploadResult.shareUrl}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(uploadResult.shareUrl);
                      toast({
                        title: 'Link copied!',
                        description: 'Share with encryption key for access.',
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Key className="h-3 w-3" />
                  Encryption Key
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={uploadResult.humanKey}
                    readOnly
                    className="font-mono text-sm font-bold"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(uploadResult.humanKey);
                      toast({
                        title: 'Key copied!',
                        description: 'Keep this safe!',
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded">
                <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Share these with the recipient:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>The share link above</li>
                    <li>Your encryption key: <code className="bg-background px-1 rounded">{uploadResult.humanKey}</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              File is encrypted with AES-256. Only those with the correct key can decrypt it.
            </AlertDescription>
          </Alert>

          <Button variant="outline" onClick={resetForm} className="w-full">
            Upload Another File
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-primary" />
          Upload & Encrypt File
        </CardTitle>
        <CardDescription>
          Zero-knowledge encryption with human-readable keys
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
            Files are encrypted in your browser before upload. Google sees only ciphertext.
          </AlertDescription>
        </Alert>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                Drag and drop a file here, or click to browse
              </p>
              <Input
                type="file"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Encryption Key
            </Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="custom-key" className="text-xs">Custom</Label>
              <Switch
                id="custom-key"
                checked={useCustomKey}
                onCheckedChange={setUseCustomKey}
              />
            </div>
          </div>

          {useCustomKey ? (
            <Input
              placeholder="Enter custom key (min 5 chars)"
              value={encryptionKey}
              onChange={(e) => setEncryptionKey(e.target.value)}
              type="password"
            />
          ) : (
            <div className="flex gap-2">
              <Input
                value={encryptionKey || 'Click generate'}
                readOnly
                className="font-mono"
              />
              <Button onClick={generateKey} variant="outline">
                Generate
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {useCustomKey 
              ? 'Use a memorable passphrase (min 5 characters)' 
              : 'Auto-generated human-readable key (e.g., iron-sparrow-echo)'}
          </p>
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || !encryptionKey || encryptionKey.length < 5 || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Encrypting & Uploading...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Encrypt & Upload
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};