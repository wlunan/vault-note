/**
 * VaultNote 加密流程测试
 * 
 * 这个文件展示了加密/解密的工作流程
 * 可在浏览器控制台中复制运行这些代码段测试
 */

import {
  hashNoteName,
  encryptNote,
  decryptNote,
  verifyPassword,
} from "../utils/crypto";

/**
 * 测试基本的加密和解密流程
 */
async function testEncryptionFlow() {
  console.log("=== VaultNote 加密流程测试 ===\n");

  const testNoteName = "test-note";
  const testPassword = "MyPassword123";
  const testContent = "这是一条机密笔记的内容\n\n包含多行文本。";

  try {
    // 1. 计算笔记 ID
    console.log("1️⃣ 计算笔记 ID...");
    const noteId = await hashNoteName(testNoteName);
    console.log(`   笔记名称: ${testNoteName}`);
    console.log(`   笔记 ID: ${noteId}\n`);

    // 2. 加密笔记
    console.log("2️⃣ 加密笔记内容...");
    const encrypted = await encryptNote(
      testNoteName,
      testPassword,
      testContent
    );
    console.log(`   加密内容长度: ${encrypted.encryptedContent.length} 字符`);
    console.log(`   加密认证长度: ${encrypted.encryptedAuth.length} 字符`);
    console.log(`   加密内容预览: ${encrypted.encryptedContent.substring(0, 50)}...\n`);

    // 3. 验证密码
    console.log("3️⃣ 验证密码...");
    const isValidPassword = await verifyPassword(
      testNoteName,
      testPassword,
      encrypted.encryptedAuth
    );
    console.log(`   密码验证结果: ${isValidPassword ? "✅ 正确" : "❌ 错误"}`);

    const isWrongPassword = await verifyPassword(
      testNoteName,
      "WrongPassword",
      encrypted.encryptedAuth
    );
    console.log(`   错误密码验证: ${isWrongPassword ? "✅ 正确" : "❌ 错误"}\n`);

    // 4. 解密笔记
    console.log("4️⃣ 解密笔记内容...");
    const decrypted = await decryptNote(
      testNoteName,
      testPassword,
      encrypted.encryptedContent
    );

    if (decrypted.success) {
      console.log(`   解密成功 ✅`);
      console.log(`   原内容: ${testContent}`);
      console.log(`   解密内容: ${decrypted.content}`);
      console.log(`   内容匹配: ${decrypted.content === testContent ? "✅ 是" : "❌ 否"}\n`);
    } else {
      console.log(`   解密失败 ❌: ${decrypted.error}\n`);
    }

    // 5. 尝试用错误密码解密
    console.log("5️⃣ 用错误密码解密...");
    const wrongDecrypt = await decryptNote(
      testNoteName,
      "WrongPassword",
      encrypted.encryptedContent
    );
    console.log(`   解密结果: ${wrongDecrypt.success ? "❌ 不应该成功" : "✅ 正确失败"}\n`);

    console.log("=== 测试完成 ===");
    return {
      noteId,
      encrypted,
      decrypted,
    };
  } catch (error) {
    console.error("测试失败:", error);
  }
}

/**
 * 测试 Base64 编码
 */
async function testBase64Encoding() {
  console.log("\n=== Base64 编码测试 ===\n");

  const testData = "VaultNote - 加密笔记系统";

  try {
    const encrypted = await encryptNote("test", "password", testData);

    // 检查 Base64 编码
    console.log("加密内容（Base64）:");
    console.log(encrypted.encryptedContent);
    console.log("\n加密认证（Base64）:");
    console.log(encrypted.encryptedAuth);

    // 验证是否有效的 Base64
    try {
      atob(encrypted.encryptedContent);
      console.log("\n✅ 加密内容是有效的 Base64");
    } catch {
      console.log("\n❌ 加密内容不是有效的 Base64");
    }

    try {
      atob(encrypted.encryptedAuth);
      console.log("✅ 加密认证是有效的 Base64");
    } catch {
      console.log("❌ 加密认证不是有效的 Base64");
    }
  } catch (error) {
    console.error("测试失败:", error);
  }
}

/**
 * 测试性能
 */
async function testPerformance() {
  console.log("\n=== 性能测试 ===\n");

  const testContent = "Lorem ipsum dolor sit amet. ".repeat(100); // ~3KB

  try {
    const startHash = performance.now();
    const noteId = await hashNoteName("test-note");
    const hashTime = performance.now() - startHash;
    console.log(`SHA-256 哈希耗时: ${hashTime.toFixed(2)}ms`);

    const startEncrypt = performance.now();
    await encryptNote("test", "password", testContent);
    const encryptTime = performance.now() - startEncrypt;
    console.log(`AES-GCM 加密耗时 (${testContent.length} 字符): ${encryptTime.toFixed(2)}ms`);

    const encrypted = await encryptNote("test", "password", testContent);

    const startDecrypt = performance.now();
    await decryptNote("test", "password", encrypted.encryptedContent);
    const decryptTime = performance.now() - startDecrypt;
    console.log(`AES-GCM 解密耗时 (${testContent.length} 字符): ${decryptTime.toFixed(2)}ms`);

    const startVerify = performance.now();
    await verifyPassword("test", "password", encrypted.encryptedAuth);
    const verifyTime = performance.now() - startVerify;
    console.log(`密码验证耗时: ${verifyTime.toFixed(2)}ms`);
  } catch (error) {
    console.error("测试失败:", error);
  }
}

/**
 * 导出所有测试函数以在浏览器控制台运行
 */
export { testEncryptionFlow, testBase64Encoding, testPerformance };

/**
 * 使用示例（在浏览器控制台）:
 * 
 * import { testEncryptionFlow, testBase64Encoding, testPerformance } from './test-crypto.ts'
 * 
 * await testEncryptionFlow()
 * await testBase64Encoding()
 * await testPerformance()
 */
