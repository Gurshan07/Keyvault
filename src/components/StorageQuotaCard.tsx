import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Cloud, Trash2 } from 'lucide-react';
import { getStorageQuota, formatBytes, StorageQuota } from '@/lib/google-drive';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export const StorageQuotaCard = () => {
  const { accessToken } = useAuth();
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuota = async () => {
      if (!accessToken) return;

      try {
        const data = await getStorageQuota(accessToken);
        setQuota(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch storage');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuota();
  }, [accessToken]);

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="h-5 w-5 text-primary" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!quota) return null;

  const usagePercent = (quota.usage / quota.limit) * 100;
  const freeSpace = quota.limit - quota.usage;

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HardDrive className="h-5 w-5 text-primary" />
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatBytes(quota.usage)} of {formatBytes(quota.limit)}
            </span>
            <span className="font-medium text-primary">{usagePercent.toFixed(1)}%</span>
          </div>
          <Progress value={usagePercent} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-accent p-3 text-center">
            <Cloud className="mx-auto mb-1 h-5 w-5 text-accent-foreground" />
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold text-sm">{formatBytes(quota.limit)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <HardDrive className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground">Used</p>
            <p className="font-semibold text-sm">{formatBytes(quota.usage)}</p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <Trash2 className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Free</p>
            <p className="font-semibold text-sm">{formatBytes(freeSpace)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
