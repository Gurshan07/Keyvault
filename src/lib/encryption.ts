// Encryption utilities using Web Crypto API

// Derive a cryptographic key from user's password/key using PBKDF2
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM key from password
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt file data
export const encryptFile = async (
  file: File,
  userKey: string
): Promise<{ encryptedData: Blob; salt: Uint8Array; iv: Uint8Array }> => {
  // Generate random salt and IV
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  
  // Read file as ArrayBuffer
  const fileData = await file.arrayBuffer();
  
  // Derive encryption key from user's key
  const cryptoKey = await deriveKey(userKey, salt);
  
  // Encrypt the file data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    cryptoKey,
    fileData
  );
  
  // Return encrypted data as Blob
  return {
    encryptedData: new Blob([encryptedBuffer]),
    salt,
    iv,
  };
};

// Decrypt file data
export const decryptFile = async (
  encryptedData: ArrayBuffer,
  userKey: string,
  salt: Uint8Array,
  iv: Uint8Array
): Promise<ArrayBuffer> => {
  // Derive the same encryption key
  const cryptoKey = await deriveKey(userKey, salt);
  
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
      },
      cryptoKey,
      encryptedData
    );
    
    return decryptedBuffer;
  } catch (error) {
    throw new Error('Decryption failed. Invalid key or corrupted data.');
  }
};

// Convert Uint8Array to base64 for storage
export const uint8ArrayToBase64 = (arr: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
};

// Convert base64 to Uint8Array
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
};