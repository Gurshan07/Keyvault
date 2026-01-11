// Simplified Drive-Only System
// Uses Drive File IDs directly in share URLs

import { encryptFile, decryptFile, uint8ArrayToBase64, base64ToUint8Array } from './encryption';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

// ============================================================================
// CORE CONCEPT
// ============================================================================
// 
// Share URL format: yourapp.com/f/{driveFileId}#key=iron-sparrow-echo
//
// File structure in Drive:
// - filename_SALT_IV_METADATA.encrypted
//
// Metadata encoded in filename:
// - Original name
// - Salt (base64)
// - IV (base64)
// - Policies (JSON, base64)
//
// Example: photo.jpg_ABC123_DEF456_eyJleHBpcmVzQXQiOjE3M...encrypted
// ============================================================================

export interface Policies {
  expiresAt?: number;
  maxDownloads?: number;
  selfDestruct?: boolean;
  allowedCountries?: string[];
}

// ============================================================================
// FILENAME ENCODING (Metadata in Filename)
// ============================================================================

const encodeMetadataInFilename = (
  originalName: string,
  salt: Uint8Array,
  iv: Uint8Array,
  policies: Policies
): string => {
  const saltB64 = uint8ArrayToBase64(salt);
  const ivB64 = uint8ArrayToBase64(iv);
  const policiesB64 = btoa(JSON.stringify(policies));
  
  // Format: originalname_SALT_IV_POLICIES.encrypted
  return `${originalName}_${saltB64}_${ivB64}_${policiesB64}.encrypted`;
};

const decodeMetadataFromFilename = (
  filename: string
): {
  originalName: string;
  salt: string;
  iv: string;
  policies: Policies;
} | null => {
  // Remove .encrypted extension
  const withoutExt = filename.replace('.encrypted', '');
  
  // Split by underscore
  const parts = withoutExt.split('_');
  
  if (parts.length < 4) return null;
  
  // Last 3 parts are salt, iv, policies
  const policiesB64 = parts.pop()!;
  const ivB64 = parts.pop()!;
  const saltB64 = parts.pop()!;
  
  // Everything else is the original filename
  const originalName = parts.join('_');
  
  try {
    const policies = JSON.parse(atob(policiesB64));
    return {
      originalName,
      salt: saltB64,
      iv: ivB64,
      policies,
    };
  } catch {
    return null;
  }
};

// ============================================================================
// UPLOAD
// ============================================================================

export const uploadFileToDrive = async (
  accessToken: string,
  file: File,
  humanKey: string,
  policies: Policies
): Promise<{
  driveFileId: string;
  shareUrl: string;
  humanKey: string;
}> => {
  // 1. Encrypt file
  const { encryptedData, salt, iv } = await encryptFile(file, humanKey);
  
  // 2. Create filename with metadata
  const filename = encodeMetadataInFilename(file.name, salt, iv, policies);
  
  // 3. Upload to Drive
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const metadata = {
    name: filename,
    description: `Keyvault encrypted file - Key hint: ${humanKey.substring(0, 4)}...`,
  };
  
  const fileBuffer = await encryptedData.arrayBuffer();
  const fileBytes = new Uint8Array(fileBuffer);
  
  let binary = '';
  for (let i = 0; i < fileBytes.length; i++) {
    binary += String.fromCharCode(fileBytes[i]);
  }
  const base64Data = btoa(binary);
  
  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/octet-stream\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    closeDelimiter;
  
  const response = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,webContentLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    }
  );
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  const uploadResult = await response.json();
  const driveFileId = uploadResult.id;
  
  // 4. Make file publicly readable
  await fetch(
    `${DRIVE_API_BASE}/files/${driveFileId}/permissions`,
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
  
  // 5. Generate share URL
  const shareUrl = `${window.location.origin}/f/${driveFileId}#key=${humanKey}`;
  
  return {
    driveFileId,
    shareUrl,
    humanKey,
  };
};

// ============================================================================
// DOWNLOAD (No Auth Required)
// ============================================================================

export const downloadFileFromDrive = async (
  driveFileId: string,
  humanKey: string
): Promise<{
  file: Blob;
  filename: string;
  policies: Policies;
}> => {
  // 1. Get file metadata (public access)
  const metadataResponse = await fetch(
    `${DRIVE_API_BASE}/files/${driveFileId}?fields=name,size`,
    { method: 'GET' }
  );
  
  if (!metadataResponse.ok) {
    throw new Error('File not found or not publicly accessible');
  }
  
  const metadata = await metadataResponse.json();
  const filename = metadata.name;
  
  // 2. Parse metadata from filename
  const fileInfo = decodeMetadataFromFilename(filename);
  
  if (!fileInfo) {
    throw new Error('Invalid file format');
  }
  
  // 3. Check policies client-side
  if (fileInfo.policies.expiresAt && Date.now() > fileInfo.policies.expiresAt) {
    throw new Error('File has expired');
  }
  
  // 4. Download encrypted file (public access)
  const fileResponse = await fetch(
    `${DRIVE_API_BASE}/files/${driveFileId}?alt=media`,
    { method: 'GET' }
  );
  
  if (!fileResponse.ok) {
    throw new Error('Failed to download file');
  }
  
  const encryptedData = await fileResponse.arrayBuffer();
  
  // 5. Decrypt
  const salt = base64ToUint8Array(fileInfo.salt);
  const iv = base64ToUint8Array(fileInfo.iv);
  
  const decryptedData = await decryptFile(encryptedData, humanKey, salt, iv);
  
  return {
    file: new Blob([decryptedData]),
    filename: fileInfo.originalName,
    policies: fileInfo.policies,
  };
};

// ============================================================================
// STORAGE QUOTA
// ============================================================================

export interface StorageQuota {
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
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

// ============================================================================
// USER'S FILE LIST (Authenticated)
// ============================================================================

export const getUserFiles = async (
  accessToken: string
): Promise<Array<{
  driveFileId: string;
  filename: string;
  size: string;
  createdTime: string;
  policies: Policies;
}>> => {
  // Search for all .encrypted files
  const query = "name contains '.encrypted' and trashed=false";
  
  const response = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch files');
  }
  
  const data = await response.json();
  
  return data.files
    .map((file: any) => {
      const info = decodeMetadataFromFilename(file.name);
      if (!info) return null;
      
      return {
        driveFileId: file.id,
        filename: info.originalName,
        size: file.size,
        createdTime: file.createdTime,
        policies: info.policies,
      };
    })
    .filter(Boolean);
};

// ============================================================================
// DELETE FILE
// ============================================================================

export const deleteFile = async (
  accessToken: string,
  driveFileId: string
): Promise<void> => {
  await fetch(
    `${DRIVE_API_BASE}/files/${driveFileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
};

// ============================================================================
// HUMAN-READABLE KEY GENERATION
// ============================================================================

const ADJECTIVES = [
  'iron', 'swift', 'bright', 'silver', 'golden', 'brave', 'wise', 'calm',
  'bold', 'dark', 'light', 'fierce', 'gentle', 'mighty', 'quiet', 'strong'
];

const NOUNS = [
  'sparrow', 'tiger', 'eagle', 'wolf', 'dragon', 'phoenix', 'lion', 'bear',
  'falcon', 'hawk', 'raven', 'owl', 'fox', 'lynx', 'panther', 'leopard'
];

const WORDS = [
  'echo', 'flame', 'storm', 'wave', 'wind', 'shadow', 'light', 'stone',
  'thunder', 'frost', 'blaze', 'mist', 'dawn', 'dusk', 'star', 'moon'
];

export const generateHumanKey = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${adj}-${noun}-${word}`;
};

// ============================================================================
// SHARE URL PARSING
// ============================================================================

export const parseShareUrl = (url: string): { driveFileId: string; key: string } | null => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const driveFileId = pathParts[pathParts.length - 1];
    
    const fragment = urlObj.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const key = params.get('key');
    
    if (!driveFileId || !key) return null;
    
    return { driveFileId, key };
  } catch {
    return null;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// UPLOAD:
const result = await uploadFileToDrive(
  accessToken,
  file,
  'iron-sparrow-echo',
  {
    expiresAt: Date.now() + 86400000, // 24 hours
    maxDownloads: 5,
    selfDestruct: false,
  }
);
console.log('Share this:', result.shareUrl);

// DOWNLOAD (Public - No Auth):
const { file, filename } = await downloadFileFromDrive(
  'abc123...',
  'iron-sparrow-echo'
);
// Trigger download
const url = URL.createObjectURL(file);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();

// LIST USER FILES:
const files = await getUserFiles(accessToken);
console.log('Your files:', files);
*/

export default {
  uploadFileToDrive,
  downloadFileFromDrive,
  getUserFiles,
  deleteFile,
  generateHumanKey,
  parseShareUrl,
  formatBytes,
  getStorageQuota,
};