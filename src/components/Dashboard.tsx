import { useState } from 'react';
import { StorageQuotaCard } from './StorageQuotaCard';
import { FileUploader } from './FileUploader';
import { MyFilesCard } from './MyFilesCard';

export const Dashboard = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container py-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <StorageQuotaCard />
          <FileUploader onUploadComplete={handleUploadComplete} />
        </div>
        <div>
          <MyFilesCard refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
};
