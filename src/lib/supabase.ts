/**
 * Supabase 客户端初始化
 * 存储加密笔记的后端
 */

import { createClient } from "@supabase/supabase-js";

// 从环境变量中读取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "警告: 未设置 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 环境变量"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // 不持久化 session，因为我们不需要认证
  },
});

/**
 * 笔记数据库记录接口
 */
export interface NoteRecord {
  id: string;
  encrypted_content: string;
  encrypted_auth: string;
  updated_at: string;
}

/**
 * 从 Supabase 查询笔记
 * @param noteId - SHA-256(noteName) 的十六进制字符串
 * @returns 笔记记录或 null
 */
export async function fetchNote(noteId: string): Promise<NoteRecord | null> {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (error) {
      // 记录不存在是正常的
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error("查询笔记时出错:", error);
    throw error;
  }
}

/**
 * 保存或更新笔记到 Supabase
 * @param noteId - SHA-256(noteName) 的十六进制字符串
 * @param encryptedContent - Base64 编码的加密内容
 * @param encryptedAuth - Base64 编码的加密认证字符串
 * @returns 保存的笔记记录
 */
export async function saveNote(
  noteId: string,
  encryptedContent: string,
  encryptedAuth: string
): Promise<NoteRecord> {
  try {
    const { data, error } = await supabase
      .from("notes")
      .upsert(
        {
          id: noteId,
          encrypted_content: encryptedContent,
          encrypted_auth: encryptedAuth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("保存笔记时出错:", error);
    throw error;
  }
}
