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
          <span class="status-text">
            <template v-if="isSaving">保存中...</template>
            <template v-else-if="lastSaved">{{ lastSaved }}</template>
            <template v-else>自动保存已启用</template>
          </span>
          <button @click="handleLogout" class="btn btn-logout">退出</button>
        </div>
      </div>

      <!-- 标签页导航 -->
      <div class="tabs-container">
        <div class="tabs-list">
          <button
            v-for="tab in collection.tabs"
            :key="tab.id"
            :class="['tab-button', { active: collection.activeTabId === tab.id }]"
            @click="selectTab(tab.id)"
          >
            <span class="tab-title">{{ tab.title }}</span>
            <button
              v-if="collection.tabs.length > 1"
              class="tab-close"
              @click.stop="deleteTab(tab.id)"
            >
              ×
            </button>
          </button>
        </div>

        <!-- 添加新标签页 -->
        <button
          v-if="collection.tabs.length < 8"
          @click="addNewTab"
          class="btn-add-tab"
          title="添加新标签页"
        >
          +
        </button>
      </div>

      <!-- 当前标签页统计信息 -->
      <div class="tab-stats">
        <span class="stat-item">
          行数: <strong>{{ currentTabStats.lines }}</strong>
        </span>
        <span class="stat-item">
          字数: <strong>{{ currentTabStats.chars }}</strong>
          <span v-if="currentTabStats.chars > 40000" class="warning">
            (接近限制)
          </span>
          <span v-if="currentTabStats.chars >= 50000" class="error">
            (已达限制)
          </span>
        </span>
      </div>


      <!-- 文本编辑框 -->
      <div class="textarea-wrapper">
        <textarea
          v-model="currentTabContent"
          placeholder="开始输入笔记内容..."
          class="textarea"
          :disabled="currentTabStats.chars >= 50000"
        ></textarea>
      </div>

      <!-- 固定底部信息区 -->
      <div class="editor-footer">
        <!-- 可放置版权、版本等信息，暂留空 -->
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  hashNoteName,
  encryptTabsCollection,
  decryptTabsCollection,
  verifyPassword,
  createNoteTab,
  extractTitleFromContent,
  validateTabsCollection,
  type NoteTabsCollection,
  type NoteTab,
} from "../utils/crypto";
import { fetchNote, saveNote } from "../lib/supabase";

// 状态
const authenticated = ref(false);
const formNoteName = ref("");
const formPassword = ref("");
const noteName = ref("");
const password = ref("");
const collection = ref<NoteTabsCollection>({
  tabs: [],
  activeTabId: "",
});
const errorMessage = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const lastSaved = ref<string | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let hideSavedTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * 获取当前选中标签页
 */
const currentTab = computed(() => {
  return collection.value.tabs.find((tab) => tab.id === collection.value.activeTabId);
});

/**
 * 获取当前标签页内容
 */
const currentTabContent = computed({
  get: () => currentTab.value?.content || "",
  set: (value: string) => {
    if (currentTab.value) {
      currentTab.value.content = value;
      currentTab.value.updatedAt = Date.now();
    }
  },
});

/**
 * 计算当前标签页统计信息
 */
const currentTabStats = computed(() => {
  const content = currentTabContent.value;
  const lines = content ? content.split("\n").length : 0;
  const chars = content.length;
  return { lines, chars };
});

/**
 * 处理登录/打开笔记
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

      // 解密标签页集合
      const decrypted = await decryptTabsCollection(
        formNoteName.value,
        formPassword.value,
        existingNote.encrypted_tabs
      );

      if (!decrypted.success || !decrypted.collection) {
        errorMessage.value = "无法访问该笔记（密码错误或不存在）";
        isLoading.value = false;
        return;
      }

      collection.value = decrypted.collection;
    } else {
      // 创建新笔记（包含一个默认标签页）
      const newTab = createNoteTab("");
      collection.value = {
        tabs: [newTab],
        activeTabId: newTab.id,
      };
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
  collection.value = { tabs: [], activeTabId: "" };
  errorMessage.value = "";
  lastSaved.value = null;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
};

/**
 * 选择标签页
 */
const selectTab = (tabId: string): void => {
  collection.value.activeTabId = tabId;
};

/**
 * 添加新标签页
 */
const addNewTab = (): void => {
  if (collection.value.tabs.length >= 8) {
    errorMessage.value = "最多只能有 8 个标签页";
    return;
  }
  const newTab = createNoteTab("");
  collection.value.tabs.push(newTab);
  collection.value.activeTabId = newTab.id;
};

/**
 * 删除标签页
 */
const deleteTab = (tabId: string): void => {
  if (collection.value.tabs.length <= 1) {
    errorMessage.value = "至少需要保留一个标签页";
    return;
  }

  const index = collection.value.tabs.findIndex((tab) => tab.id === tabId);
  if (index > -1) {
    collection.value.tabs.splice(index, 1);

    // 如果删除的是当前标签页，选择其他标签页
    if (collection.value.activeTabId === tabId) {
      collection.value.activeTabId =
        collection.value.tabs[Math.max(0, index - 1)].id;
    }
  }
};

/**
 * 自动保存标签页集合
 */
const autoSave = async (): Promise<void> => {
  if (!authenticated.value) {
    return;
  }

  // 更新标签页标题
  for (const tab of collection.value.tabs) {
    tab.title = extractTitleFromContent(tab.content);
  }

  // 验证数据
  const validation = validateTabsCollection(collection.value);
  if (!validation.valid) {
    lastSaved.value = validation.error || "保存失败";
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
      const encrypted = await encryptTabsCollection(
        noteName.value,
        password.value,
        collection.value
      );

      await saveNote(noteId, encrypted.encryptedContent, encrypted.encryptedAuth);

      // 更新保存时间提示
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      lastSaved.value = `已保存 ${timeStr}`;

      // 3 秒后隐藏保存提示，先清除旧的
      if (hideSavedTimeout) {
        clearTimeout(hideSavedTimeout);
      }
      hideSavedTimeout = setTimeout(() => {
        lastSaved.value = null;
        hideSavedTimeout = null;
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
 * 监听标签页内容变化，触发自动保存
 */
watch(
  () => collection.value,
  () => {
    autoSave();
  },
  { deep: true }
);

/**
 * 清理保存超时
 */
onMounted(() => {
  window.addEventListener("beforeunload", () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    if (hideSavedTimeout) {
      clearTimeout(hideSavedTimeout);
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
  flex-wrap: nowrap;
  white-space: nowrap;
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

/* 标签页容器 */
.tabs-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f9f9f9;
  overflow-x: auto;
}

.tabs-list {
  display: flex;
  gap: 4px;
  flex: 1;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  color: #666;
  max-width: 150px;
}

.tab-button:hover {
  border-color: #667eea;
  background: #f5f7ff;
}

.tab-button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
}

.tab-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}

.tab-button.active .tab-close:hover {
  opacity: 0.7;
}

.btn-add-tab {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 16px;
  color: #667eea;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-add-tab:hover {
  background: #f5f7ff;
  border-color: #667eea;
}

/* 标签页统计信息 */
.tab-stats {
  display: flex;
  gap: 24px;
  padding: 12px 20px;
  background: #f9f9f9;
  font-size: 13px;
  border-bottom: 1px solid #e0e0e0;
}

.stat-item {
  color: #666;
}

.stat-item strong {
  color: #333;
  font-weight: 600;
}

.warning {
  color: #ff9800;
}

.textarea-wrapper {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.textarea {
  flex: 1 1 auto;
  border: none;
  padding: 20px;
  font-size: 14px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
  resize: none;
  color: #333;
  min-height: 180px;
  max-height: calc(100vh - 320px);
  box-sizing: border-box;
}
.textarea:focus {
  outline: none;
}
.textarea:disabled {
  background: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
}
.editor-footer {
  flex-shrink: 0;
  height: 48px;
  min-height: 48px;
  background: #f9f9f9;
  border-top: 1px solid #e0e0e0;
  color: #999;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}

.textarea:disabled {
  background: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
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

  .tabs-container {
    padding: 8px 12px;
  }

  .tab-button {
    padding: 6px 10px;
    font-size: 12px;
  }

  .btn-add-tab {
    padding: 6px 10px;
  }

  .tab-stats {
    gap: 16px;
    padding: 10px 16px;
  }
}
</style>
