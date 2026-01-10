import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Key, AlertTriangle, Check, Loader2, Lock, Copy } from 'lucide-react';
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
    if (!file || !encryptionKey || !accessToken || !user) {
      setError('Please select a file and enter an encryption key');
      return;
    }

    if (encryptionKey.length < 3) {
      setError('Encryption key must be at least 3 characters');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Upload and encrypt file
      const uploaded = await uploadFile(accessToken, file, encryptionKey, user.id);
      
      setUploadedFile(uploaded);
      
      toast({
        title: 'File encrypted and uploaded!',
        description: 'Your file is securely stored in your Google Drive.',
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
    setEncryptionKey('');
    setUploadedFile(null);
    setError(null);
  };

  if (uploadedFile) {
    const shareUrl = uploadedFile.webContentLink || uploadedFile.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view`;
    
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
            <p className="text-sm font-medium mb-2">File: {uploadedFile.appProperties?.originalName || uploadedFile.name}</p>
            <p className="text-sm text-muted-foreground mb-4">
              Encrypted and saved in your Keyvault folder
            </p>
            
            <div className="space-y-2">
              <Label className="text-xs">Share this Google Drive link:</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: 'Link copied!',
                      description: 'Share this link along with your encryption key.',
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded mt-3">
              <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Share this link AND your encryption key with anyone who needs to download the file. 
                They can decrypt it at <code className="bg-background px-1 rounded">/download</code>
              </p>
            </div>
          </div>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The file is publicly accessible but remains encrypted. Anyone with the link AND the correct 
              encryption key can download and decrypt it.
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
          Upload a file to your Google Drive with end-to-end encryption
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
            Your files are encrypted client-side before upload. Only you can decrypt them with your key.
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
          <Label htmlFor="encryptionKey" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Encryption Key
          </Label>
          <Input
            id="encryptionKey"
            type="password"
            placeholder="Enter your encryption key (e.g., saksham)"
            value={encryptionKey}
            onChange={(e) => setEncryptionKey(e.target.value)}
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground">
            Minimum 3 characters. All characters allowed (letters, numbers, symbols, spaces).
          </p>
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || !encryptionKey || isUploading}
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