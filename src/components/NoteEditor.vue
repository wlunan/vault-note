<template>
  <div class="note-editor">
    <!-- 登录/创建笔记界面 -->
    <div v-if="!authenticated" class="login-container">
      <div class="login-box">
        <h1>VaultNote</h1>
        <p class="subtitle">隐私优先的端到端加密笔记</p>

        <div class="form-group">
          <input
            v-model="formNoteName"
            type="text"
            placeholder="笔记名称"
            class="input-field"
            @keyup.enter="handleLogin"
          />
        </div>

        <div class="form-group">
          <input
            v-model="formPassword"
            type="password"
            placeholder="访问密码（至少6位）"
            class="input-field"
            @keyup.enter="handleLogin"
          />
        </div>

        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="btn btn-primary"
        >
          {{ isLoading ? "加载中..." : "进入笔记" }}
        </button>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div class="info-text">
          只需记住名称和密码，无需注册。忘记密码将无法恢复内容。
        </div>
      </div>
    </div>

    <!-- 笔记编辑界面 -->
    <div v-else class="editor-container">
      <div class="editor-header">
        <h2>{{ noteName }}</h2>
        <div class="header-right">
          <span v-if="lastSaved" class="status-text">
            {{ lastSaved }}
          </span>
          <button @click="handleLogout" class="btn btn-logout">退出</button>
        </div>
      </div>

      <textarea
        v-model="content"
        placeholder="开始输入笔记内容..."
        class="textarea"
      ></textarea>

      <div class="editor-footer">
        <span v-if="isSaving" class="saving-text">保存中...</span>
        <span v-else class="auto-save-text">自动保存已启用</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  hashNoteName,
  encryptNote,
  decryptNote,
  verifyPassword,
} from "../utils/crypto";
import { fetchNote, saveNote } from "../lib/supabase";

// 状态
const authenticated = ref(false);
const formNoteName = ref("");
const formPassword = ref("");
const noteName = ref("");
const password = ref("");
const content = ref("");
const errorMessage = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const lastSaved = ref<string | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * 处理登录/创建笔记
 */
const handleLogin = async (): Promise<void> => {
  errorMessage.value = "";

  if (!formNoteName.value.trim()) {
    errorMessage.value = "请输入笔记名称";
    return;
  }

  if (!formPassword.value || formPassword.value.length < 6) {
    errorMessage.value = "密码至少需要 6 位";
    return;
  }

  isLoading.value = true;

  try {
    const noteId = await hashNoteName(formNoteName.value);
    const existingNote = await fetchNote(noteId);

    if (existingNote) {
      // 验证密码
      const isValid = await verifyPassword(
        formNoteName.value,
        formPassword.value,
        existingNote.encrypted_auth
      );

      if (!isValid) {
        errorMessage.value = "无法访问该笔记（密码错误或不存在）";
        isLoading.value = false;
        return;
      }

      // 解密内容
      const decrypted = await decryptNote(
        formNoteName.value,
        formPassword.value,
        existingNote.encrypted_content
      );

      if (!decrypted.success) {
        errorMessage.value = "无法访问该笔记（密码错误或不存在）";
        isLoading.value = false;
        return;
      }

      content.value = decrypted.content || "";
    } else {
      // 新笔记
      content.value = "";
    }

    // 设置已认证状态
    noteName.value = formNoteName.value;
    password.value = formPassword.value;
    authenticated.value = true;
  } catch (error) {
    console.error("登录失败:", error);
    errorMessage.value = "无法访问该笔记（密码错误或不存在）";
  } finally {
    isLoading.value = false;
  }
};

/**
 * 处理退出
 */
const handleLogout = (): void => {
  authenticated.value = false;
  formNoteName.value = "";
  formPassword.value = "";
  noteName.value = "";
  password.value = "";
  content.value = "";
  errorMessage.value = "";
  lastSaved.value = null;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
};

/**
 * 自动保存内容
 */
const autoSave = async (): Promise<void> => {
  if (!authenticated.value) {
    return;
  }

  // 清除之前的超时
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // 延迟 1 秒保存
  saveTimeout = setTimeout(async () => {
    try {
      isSaving.value = true;
      const noteId = await hashNoteName(noteName.value);
      const encrypted = await encryptNote(
        noteName.value,
        password.value,
        content.value
      );

      await saveNote(noteId, encrypted.encryptedContent, encrypted.encryptedAuth);

      // 更新保存时间提示
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      lastSaved.value = `已保存 ${timeStr}`;

      // 3 秒后隐藏保存提示
      setTimeout(() => {
        lastSaved.value = null;
      }, 3000);
    } catch (error) {
      console.error("保存失败:", error);
      lastSaved.value = "保存失败，请重试";
    } finally {
      isSaving.value = false;
    }
  }, 1000);
};

/**
 * 监听内容变化，触发自动保存
 */
watch(content, () => {
  autoSave();
});

/**
 * 清理保存超时
 */
onMounted(() => {
  window.addEventListener("beforeunload", () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
  });
});
</script>

<style scoped>
.note-editor {
  width: 100%;
  height: 100%;
}

/* 登录界面 */
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.login-box {
  background: white;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.login-box h1 {
  text-align: center;
  color: #667eea;
  font-size: 32px;
  margin-bottom: 8px;
  font-weight: 700;
}

.subtitle {
  text-align: center;
  color: #999;
  font-size: 14px;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 16px;
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-top: 8px;
  margin-bottom: 16px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
  margin-bottom: 16px;
}

.info-text {
  text-align: center;
  color: #999;
  font-size: 12px;
  line-height: 1.6;
}

/* 编辑界面 */
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: white;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.editor-header h2 {
  margin: 0;
  color: #333;
  font-size: 20px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-text {
  color: #999;
  font-size: 12px;
}

.btn-logout {
  background: #f0f0f0;
  color: #333;
  padding: 8px 16px;
  font-size: 13px;
}

.btn-logout:hover {
  background: #e0e0e0;
}

.textarea {
  flex: 1;
  border: none;
  padding: 20px;
  font-size: 14px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
  resize: none;
  color: #333;
}

.textarea:focus {
  outline: none;
}

.editor-footer {
  padding: 12px 20px;
  border-top: 1px solid #e0e0e0;
  background: #f9f9f9;
  color: #999;
  font-size: 12px;
  text-align: right;
}

.saving-text {
  color: #667eea;
  font-weight: 500;
}

.auto-save-text {
  color: #999;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .login-box {
    padding: 30px 20px;
  }

  .editor-header {
    flex-wrap: wrap;
    gap: 16px;
  }

  .editor-header h2 {
    width: 100%;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
