// Google Drive API utilities

import {
  encryptFile,
  decryptFile,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from './encryption';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const KEYVAULT_FOLDER_NAME = 'Keyvault';

/* ─────────────────── Types ─────────────────── */

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

/* ─────────────────── Helpers ─────────────────── */

const arrayBufferToBase64 = (buffer: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
};

/* ─────────────────── Folder ─────────────────── */

const getOrCreateKeyvaultFolder = async (
  accessToken: string
): Promise<string> => {
  const query =
    `name='${KEYVAULT_FOLDER_NAME}' ` +
    `and mimeType='application/vnd.google-apps.folder' ` +
    `and trashed=false`;

  const search = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!search.ok) {
    throw new Error('Failed to search for Keyvault folder');
  }

  const result = await search.json();
  if (result.files?.length) {
    return result.files[0].id;
  }

  const create = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: KEYVAULT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!create.ok) {
    throw new Error('Failed to create Keyvault folder');
  }

  const folder = await create.json();
  return folder.id;
};

/* ─────────────────── Permissions ─────────────────── */

export const setFilePublic = async (
  accessToken: string,
  fileId: string
): Promise<void> => {
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
};

/* ─────────────────── Upload ─────────────────── */

export const uploadFile = async (
  accessToken: string,
  file: File,
  userKey: string | null,
  userId: string
): Promise<DriveFile> => {
  const folderId = await getOrCreateKeyvaultFolder(accessToken);

  let fileBuffer: ArrayBuffer;
  let filename: string;
  let metadata: any;

  if (userKey && userKey.length >= 5) {
    const { encryptedData, salt, iv } = await encryptFile(file, userKey);

    fileBuffer = await encryptedData.arrayBuffer();
    filename = `${file.name}_${uint8ArrayToBase64(salt)}_${uint8ArrayToBase64(
      iv
    )}.encrypted`;

    metadata = {
      name: filename,
      parents: [folderId],
      appProperties: {
        originalName: file.name,
        uploaderId: userId,
        encrypted: 'true',
        salt: uint8ArrayToBase64(salt),
        iv: uint8ArrayToBase64(iv),
      },
    };
  } else {
    fileBuffer = await file.arrayBuffer();
    filename = file.name;

    metadata = {
      name: filename,
      parents: [folderId],
      appProperties: {
        originalName: file.name,
        uploaderId: userId,
        encrypted: 'false',
      },
    };
  }

  const boundary = '-------314159265358979323846';
  const body =
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/octet-stream\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    arrayBufferToBase64(new Uint8Array(fileBuffer)) +
    `\r\n--${boundary}--`;

  const upload = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );

  if (!upload.ok) {
    const err = await upload.json();
    throw new Error(err.error?.message || 'Upload failed');
  }

  const uploaded = await upload.json();
  await setFilePublic(accessToken, uploaded.id);

  return getFileById(accessToken, uploaded.id);
};

/* ─────────────────── Fetch ─────────────────── */

export const getFileById = async (
  accessToken: string,
  fileId: string
): Promise<DriveFile> => {
  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size,webContentLink,webViewLink,appProperties,createdTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch file');
  }

  return response.json();
};

/* ─────────────────── Download & Decrypt ─────────────────── */

export const downloadAndDecryptFile = async (
  accessToken: string,
  fileId: string,
  userKey: string
): Promise<{ data: Blob; filename: string }> => {
  const fileInfo = await getFileById(accessToken, fileId);

  if (fileInfo.appProperties?.encrypted !== 'true') {
    throw new Error('File is not encrypted');
  }

  const response = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  const encrypted = await response.arrayBuffer();
  const salt = base64ToUint8Array(fileInfo.appProperties.salt);
  const iv = base64ToUint8Array(fileInfo.appProperties.iv);

  const decrypted = await decryptFile(encrypted, userKey, salt, iv);

  return {
    data: new Blob([decrypted]),
    filename:
      fileInfo.appProperties.originalName ||
      fileInfo.name.replace('.encrypted', ''),
  };
};

/* ─────────────────── Filename Parsing ─────────────────── */

export const parseEncryptedFilename = (
  filename: string
): {
  originalName: string;
  salt: string;
  iv: string;
} | null => {
  const match = filename.match(
    /^(.+)_([A-Za-z0-9+/=]+)_([A-Za-z0-9+/=]+)\.encrypted$/
  );

  if (!match) return null;

  return {
    originalName: match[1],
    salt: match[2],
    iv: match[3],
  };
};

/* ─────────────────── User Files ─────────────────── */

export const getUserFiles = async (
  accessToken: string,
  userId: string
): Promise<DriveFile[]> => {
  const folderId = await getOrCreateKeyvaultFolder(accessToken);

  const query =
    `'${folderId}' in parents ` +
    `and appProperties has { key='uploaderId' and value='${userId}' } ` +
    `and trashed=false`;

  const response = await fetch(
    `${DRIVE_API_BASE}/files` +
      `?q=${encodeURIComponent(query)}` +
      `&fields=files(id,name,mimeType,size,webContentLink,webViewLink,appProperties,createdTime)` +
      `&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user files');
  }

  const data = await response.json();
  return data.files ?? [];
};

/* ─────────────────── Delete ─────────────────── */

export const deleteFile = async (
  accessToken: string,
  fileId: string
): Promise<void> => {
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

/* ─────────────────── Utilities ─────────────────── */

export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/* ─────────────────── Storage Quota ─────────────────── */

export const getStorageQuota = async (
  accessToken: string
): Promise<StorageQuota> => {
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
    limit: Number(data.storageQuota.limit ?? 0),
    usage: Number(data.storageQuota.usage ?? 0),
    usageInDrive: Number(data.storageQuota.usageInDrive ?? 0),
    usageInDriveTrash: Number(data.storageQuota.usageInDriveTrash ?? 0),
  };
};
