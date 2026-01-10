import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Key, AlertTriangle, Check, Loader2, Lock, Copy, Unlock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile, DriveFile } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onUploadComplete?: (file: DriveFile) => void;
}

export const FileUploader = ({ onUploadComplete }: FileUploaderProps) => {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'public' | 'encrypted'>('public');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<DriveFile | null>(null);
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

    if (uploadMode === 'encrypted' && encryptionKey.length < 5) {
      setError('Encryption key must be at least 5 characters');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const keyToUse = uploadMode === 'encrypted' ? encryptionKey : null;
      const uploaded = await uploadFile(accessToken, file, keyToUse, user.id);
      
      setUploadedFile(uploaded);
      
      toast({
        title: uploadMode === 'encrypted' ? 'File encrypted and uploaded!' : 'File uploaded!',
        description: uploadMode === 'encrypted' 
          ? 'Your file is encrypted and stored securely.' 
          : 'Your file is publicly accessible.',
      });

      onUploadComplete?.(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setUploadMode('public');
    setEncryptionKey('');
    setUploadedFile(null);
    setError(null);
  };

  if (uploadedFile) {
    const shareUrl = uploadedFile.webContentLink || uploadedFile.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view`;
    const isEncrypted = uploadedFile.appProperties?.encrypted === 'true';
    
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
              File: {uploadedFile.appProperties?.originalName || uploadedFile.name}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {isEncrypted ? 'Encrypted and ' : ''}Saved in your Keyvault folder
            </p>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  {isEncrypted ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {isEncrypted ? 'Encrypted Download Link' : 'Public Download Link'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/download/${uploadedFile.id}`}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/download/${uploadedFile.id}`);
                      toast({
                        title: 'Link copied!',
                        description: isEncrypted ? 'Share with encryption key for access.' : 'Anyone can download this file.',
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isEncrypted && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded">
                  <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Share these with the recipient:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>The download link above</li>
                      <li>Your encryption key: <code className="bg-background px-1 rounded">{encryptionKey}</code></li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <Alert>
            {isEncrypted ? <Lock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>
              {isEncrypted 
                ? 'File is encrypted with AES-256. Only those with the correct key can decrypt it.'
                : 'This file is publicly accessible. Anyone with the link can download it directly.'}
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
          Upload File
        </CardTitle>
        <CardDescription>
          Upload files to your Google Drive with optional encryption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Label>Upload Mode</Label>
          <RadioGroup value={uploadMode} onValueChange={(v) => setUploadMode(v as 'public' | 'encrypted')}>
            <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent transition-colors">
              <RadioGroupItem value="public" id="public" />
              <Label htmlFor="public" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Unlock className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Public Download</p>
                    <p className="text-xs text-muted-foreground">Anyone with link can download directly (no key needed)</p>
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent transition-colors">
              <RadioGroupItem value="encrypted" id="encrypted" />
              <Label htmlFor="encrypted" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Encrypted Download</p>
                    <p className="text-xs text-muted-foreground">Requires encryption key to download and decrypt</p>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

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

        {uploadMode === 'encrypted' && (
          <div className="space-y-2">
            <Label htmlFor="encryptionKey" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Encryption Key
            </Label>
            <Input
              id="encryptionKey"
              type="password"
              placeholder="Enter your encryption key (min 5 characters)"
              value={encryptionKey}
              onChange={(e) => setEncryptionKey(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 5 characters. Remember this key - you'll need it to decrypt the file.
            </p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || (uploadMode === 'encrypted' && encryptionKey.length < 5) || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadMode === 'encrypted' ? 'Encrypting & Uploading...' : 'Uploading...'}
            </>
          ) : (
            <>
              {uploadMode === 'encrypted' ? <Lock className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploadMode === 'encrypted' ? 'Encrypt & Upload' : 'Upload'}
            </>
          )}
        </Button>

        <Alert>
          {uploadMode === 'encrypted' ? <Lock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertDescription className="text-xs">
            {uploadMode === 'encrypted' 
              ? 'Files are encrypted client-side with AES-256 before upload. Your Drive is secure.'
              : 'Files uploaded in public mode can be downloaded by anyone with the link without a key.'}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};