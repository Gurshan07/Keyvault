export const setFilePublic = async (accessToken: string, fileId: string): Promise<void> => {
  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to set file permissions');
  }
};// Google Drive API utilities with encryption

import { encryptFile, decryptFile, uint8ArrayToBase64, base64ToUint8Array } from './encryption';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const KEYVAULT_FOLDER_NAME = 'Keyvault';

export interface StorageQuota {
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  webContentLink?: string;
  webViewLink?: string;
  appProperties?: Record<string, string>;
  createdTime: string;
}

export const getStorageQuota = async (accessToken: string): Promise<StorageQuota> => {
  const response = await fetch(
    `${DRIVE_API_BASE}/about?fields=storageQuota`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch storage quota');
  }

  const data = await response.json();
  return {
    limit: parseInt(data.storageQuota.limit || '0'),
    usage: parseInt(data.storageQuota.usage || '0'),
    usageInDrive: parseInt(data.storageQuota.usageInDrive || '0'),
    usageInDriveTrash: parseInt(data.storageQuota.usageInDriveTrash || '0'),
  };
};

// Find or create Keyvault folder
const getOrCreateKeyvaultFolder = async (accessToken: string): Promise<string> => {
  // Search for existing Keyvault folder
  const query = `name='${KEYVAULT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const searchResponse = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchResponse.ok) {
    throw new Error('Failed to search for Keyvault folder');
  }

  const searchData = await searchResponse.json();
  
  // If folder exists, return its ID
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new Keyvault folder
  const createResponse = await fetch(
    `${DRIVE_API_BASE}/files`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: KEYVAULT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!createResponse.ok) {
    throw new Error('Failed to create Keyvault folder');
  }

  const folderData = await createResponse.json();
  return folderData.id;
};

export const uploadFile = async (
  accessToken: string,
  file: File,
  userKey: string,
  userId: string
): Promise<DriveFile> => {
  // Encrypt the file
  const { encryptedData, salt, iv } = await encryptFile(file, userKey);
  
  // Get or create Keyvault folder
  const folderId = await getOrCreateKeyvaultFolder(accessToken);
  
  // Encode salt and IV in filename
  const saltBase64 = uint8ArrayToBase64(salt);
  const ivBase64 = uint8ArrayToBase64(iv);
  const encodedFilename = `${file.name}_${saltBase64}_${ivBase64}.encrypted`;
  
  // Create file metadata with encryption info
  const metadata = {
    name: encodedFilename,
    parents: [folderId],
    appProperties: {
      originalName: file.name,
      uploaderId: userId,
      salt: saltBase64,
      iv: ivBase64,
      encryptedWith: 'AES-GCM-256',
    },
  };

  // Create multipart request
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataString = JSON.stringify(metadata);
  
  // Read encrypted file as ArrayBuffer
  const fileBuffer = await encryptedData.arrayBuffer();
  const fileBytes = new Uint8Array(fileBuffer);

  // Build multipart body
  const multipartRequestBody = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadataString +
    delimiter +
    'Content-Type: application/octet-stream\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    arrayBufferToBase64(fileBytes) +
    closeDelimiter;

  const response = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,webContentLink,webViewLink,appProperties,createdTime`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload file');
  }

  const uploadedFile = await response.json();

  // Set file permissions to "Anyone with link"
  await setFilePublic(accessToken, uploadedFile.id);

  // Fetch updated file info with webContentLink
  return getFileById(accessToken, uploadedFile.id);
};

const arrayBufferToBase64 = (buffer: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
};

export const getFileById = async (accessToken: string, fileId: string): Promise<DriveFile> => {
  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size,webContentLink,webViewLink,appProperties,createdTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch file');
  }

  return response.json();
};

export const downloadAndDecryptFile = async (
  accessToken: string,
  fileId: string,
  userKey: string
): Promise<{ data: Blob; filename: string }> => {
  // Get file metadata
  const fileInfo = await getFileById(accessToken, fileId);
  
  if (!fileInfo.appProperties?.salt || !fileInfo.appProperties?.iv) {
    throw new Error('File is not encrypted or missing encryption metadata');
  }
  
  // Download encrypted file
  const downloadResponse = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!downloadResponse.ok) {
    throw new Error('Failed to download file');
  }

  const encryptedData = await downloadResponse.arrayBuffer();
  
  // Decrypt the file
  const salt = base64ToUint8Array(fileInfo.appProperties.salt);
  const iv = base64ToUint8Array(fileInfo.appProperties.iv);
  
  const decryptedData = await decryptFile(encryptedData, userKey, salt, iv);
  
  // Return decrypted data as Blob with original filename
  const originalName = fileInfo.appProperties.originalName || fileInfo.name.replace('.encrypted', '');
  
  return {
    data: new Blob([decryptedData]),
    filename: originalName,
  };
};

export const getUserFiles = async (accessToken: string, userId: string): Promise<DriveFile[]> => {
  // Get Keyvault folder
  const folderId = await getOrCreateKeyvaultFolder(accessToken);
  
  const query = `'${folderId}' in parents and appProperties has { key='uploaderId' and value='${userId}' } and trashed=false`;
  
  const response = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webContentLink,webViewLink,appProperties,createdTime)&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user files');
  }

  const data = await response.json();
  return data.files || [];
};

export const deleteFile = async (accessToken: string, fileId: string): Promise<void> => {
  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
};

// Parse encryption metadata from filename
export const parseEncryptedFilename = (filename: string): {
  originalName: string;
  salt: string;
  iv: string;
} | null => {
  // Format: originalname_SALT_IV.encrypted
  const match = filename.match(/^(.+)_([A-Za-z0-9+/=]+)_([A-Za-z0-9+/=]+)\.encrypted$/);
  
  if (!match) {
    return null;
  }

  return {
    originalName: match[1],
    salt: match[2],
    iv: match[3],
  };
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};