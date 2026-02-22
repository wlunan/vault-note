/**
 * VaultNote 加密工具模块
 * 使用 Web Crypto API 进行端到端加密
 */

const AUTH_STRING = "VAULTNOTE_AUTH_2026";

/**
 * 将字符串转换为 Uint8Array
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * 将 Uint8Array 转换为字符串
 */
function uint8ArrayToString(arr: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(arr);
}

/**
 * 将 Uint8Array 转换为 Base64 字符串
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  arr.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/**
 * 将 Base64 字符串转换为 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * 使用 SHA-256 哈希计算笔记 ID
 * @param noteName - 笔记名称
 * @returns 十六进制 SHA-256 哈希字符串
 */
export async function hashNoteName(noteName: string): Promise<string> {
  const data = stringToUint8Array(noteName);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 从 noteName 和 password 派生 AES-GCM 密钥
 * 简化方案：使用 SHA-256(noteName + password)
 * @param noteName - 笔记名称
 * @param password - 访问密码
 * @returns 可用于 AES-GCM 的 CryptoKey
 */
export async function deriveKey(noteName: string, password: string): Promise<CryptoKey> {
  const combined = noteName + password;
  const data = stringToUint8Array(combined);
  
  // 使用 SHA-256 派生密钥
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  
  // 导入为 AES-GCM 密钥（256-bit）
  const key = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  return key;
}

/**
 * 加密接口
 */
export interface EncryptionResult {
  encryptedContent: string; // Base64 编码的加密内容 + IV + 标签
  encryptedAuth: string;    // Base64 编码的加密校验字符串 + IV + 标签
}

/**
 * 加密内容和认证标签
 * @param noteName - 笔记名称
 * @param password - 访问密码
 * @param content - 用户输入的笔记内容
 * @returns 包含加密内容和认证信息的对象
 */
export async function encryptNote(
  noteName: string,
  password: string,
  content: string
): Promise<EncryptionResult> {
  const key = await deriveKey(noteName, password);
  
  // 生成随机 IV（初始化向量）
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 加密内容
  const contentData = stringToUint8Array(content);
  const encryptedContentBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    contentData
  );
  const encryptedContentArray = new Uint8Array(encryptedContentBuffer);
  
  // 将 IV + 加密数据 合并
  const contentWithIv = new Uint8Array(iv.length + encryptedContentArray.length);
  contentWithIv.set(iv);
  contentWithIv.set(encryptedContentArray, iv.length);
  
  // 加密认证字符串
  const authIv = crypto.getRandomValues(new Uint8Array(12));
  const authData = stringToUint8Array(AUTH_STRING);
  const encryptedAuthBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: authIv },
    key,
    authData
  );
  const encryptedAuthArray = new Uint8Array(encryptedAuthBuffer);
  
  // 将 IV + 加密数据 合并
  const authWithIv = new Uint8Array(authIv.length + encryptedAuthArray.length);
  authWithIv.set(authIv);
  authWithIv.set(encryptedAuthArray, authIv.length);
  
  return {
    encryptedContent: uint8ArrayToBase64(contentWithIv),
    encryptedAuth: uint8ArrayToBase64(authWithIv),
  };
}

/**
 * 解密结果接口
 */
export interface DecryptionResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * 验证密码是否正确
 * @param noteName - 笔记名称
 * @param password - 访问密码
 * @param encryptedAuth - Base64 编码的加密认证字符串
 * @returns 密码是否正确
 */
export async function verifyPassword(
  noteName: string,
  password: string,
  encryptedAuth: string
): Promise<boolean> {
  try {
    const key = await deriveKey(noteName, password);
    const encryptedAuthArray = base64ToUint8Array(encryptedAuth);
    
    // 提取 IV（前 12 字节）和加密数据
    const iv = encryptedAuthArray.slice(0, 12);
    const encryptedData = encryptedAuthArray.slice(12);
    
    // 解密
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );
    
    const decryptedString = uint8ArrayToString(new Uint8Array(decryptedBuffer));
    
    // 比对认证字符串
    return decryptedString === AUTH_STRING;
  } catch (error) {
    console.error("验证密码时出错:", error);
    return false;
  }
}

/**
 * 解密笔记内容
 * @param noteName - 笔记名称
 * @param password - 访问密码
 * @param encryptedContent - Base64 编码的加密内容
 * @returns 解密结果
 */
export async function decryptNote(
  noteName: string,
  password: string,
  encryptedContent: string
): Promise<DecryptionResult> {
  try {
    const key = await deriveKey(noteName, password);
    const encryptedContentArray = base64ToUint8Array(encryptedContent);
    
    // 提取 IV（前 12 字节）和加密数据
    const iv = encryptedContentArray.slice(0, 12);
    const encryptedData = encryptedContentArray.slice(12);
    
    // 解密
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );
    
    const content = uint8ArrayToString(new Uint8Array(decryptedBuffer));
    
    return {
      success: true,
      content,
    };
  } catch (error) {
    console.error("解密内容时出错:", error);
    return {
      success: false,
      error: "解密失败，请检查密码",
    };
  }
}
