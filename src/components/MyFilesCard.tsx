import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FolderOpen, Copy, Trash2, Download, Loader2, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFiles, deleteFile, formatBytes, downloadFileFromDrive } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface MyFilesCardProps {
  refreshTrigger?: number;
}

interface FileItem {
  driveFileId: string;
  filename: string;
  size: string;
  createdTime: string;
  policies: {
    expiresAt?: number;
    maxDownloads?: number;
    selfDestruct?: boolean;
  };
}

export const MyFilesCard = ({ refreshTrigger }: MyFilesCardProps) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [decryptionKeys, setDecryptionKeys] = useState<Record<string, string>>({});

  const fetchFiles = async () => {
    if (!accessToken) return;

    try {
      const userFiles = await getUserFiles(accessToken);
      setFiles(userFiles);
      
      // Load stored keys from localStorage
      const keyMap = JSON.parse(localStorage.getItem('keyvault_keys') || '{}');
      setDecryptionKeys(keyMap);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [accessToken, refreshTrigger]);

  const handleDelete = async (fileId: string, filename: string) => {
    if (!accessToken) return;

    setDeletingId(fileId);
    try {
      await deleteFile(accessToken, fileId);
      setFiles(files.filter(f => f.driveFileId !== fileId));
      toast({
        title: 'File deleted',
        description: `${filename} has been removed from your Drive.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to delete',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    const key = decryptionKeys[fileId];
    
    if (!key || key.trim().length < 5) {
      toast({
        title: 'Key required',
        description: 'Please enter the decryption key (minimum 5 characters)',
        variant: 'destructive',
      });
      return;
    }

    setDownloadingId(fileId);

    try {
      const { file, filename: decryptedFilename } = await downloadFileFromDrive(fileId, key.trim());

      // Trigger download
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = decryptedFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download successful!',
        description: `${decryptedFilename} has been downloaded.`,
      });
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Wrong decryption key or file corrupted',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const copyShareLink = async (fileId: string, filename: string) => {
    const key = decryptionKeys[fileId];
    
    if (!key || key.trim().length < 5) {
      toast({
        title: 'Key required',
        description: 'Enter the decryption key first (minimum 5 characters)',
        variant: 'destructive',
      });
      return;
    }

    const shareUrl = `${window.location.origin}/f/${fileId}#key=${encodeURIComponent(key.trim())}`;
    await navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Link copied!',
      description: 'Share this link - the key is included in the URL.',
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="h-5 w-5 text-primary" />
            My Encrypted Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FolderOpen className="h-5 w-5 text-primary" />
          My Encrypted Files
          {files.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No files uploaded yet</p>
            <p className="text-sm">Upload a file to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Decryption Key</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.driveFileId}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {file.filename}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatBytes(parseInt(file.size || '0'))}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        placeholder="Enter key"
                        value={decryptionKeys[file.driveFileId] || ''}
                        onChange={(e) => {
                          const newKeys = {
                            ...decryptionKeys,
                            [file.driveFileId]: e.target.value
                          };
                          setDecryptionKeys(newKeys);
                          // Save to localStorage
                          localStorage.setItem('keyvault_keys', JSON.stringify(newKeys));
                        }}
                        className="w-32 text-xs"
                        readOnly={!!decryptionKeys[file.driveFileId]}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(file.driveFileId, file.filename)}
                          title="Download & decrypt"
                          disabled={downloadingId === file.driveFileId}
                        >
                          {downloadingId === file.driveFileId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyShareLink(file.driveFileId, file.filename)}
                          title="Copy share link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete file"
                              disabled={deletingId === file.driveFileId}
                            >
                              {deletingId === file.driveFileId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete file?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{file.filename}" from your Google Drive. 
                                Anyone with the share link will no longer be able to access it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(file.driveFileId, file.filename)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};