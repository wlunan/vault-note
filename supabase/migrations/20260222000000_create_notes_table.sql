-- VaultNote 数据库迁移脚本
-- 创建 notes 表并配置 RLS

-- 创建 notes 表
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  encrypted_content TEXT NOT NULL,
  encrypted_auth TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

-- 启用 RLS（Row Level Security）
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS allow_all_select ON notes;
DROP POLICY IF EXISTS allow_all_insert ON notes;
DROP POLICY IF EXISTS allow_all_update ON notes;
DROP POLICY IF EXISTS allow_all_delete ON notes;

-- 允许所有人读取（因为数据已加密）
CREATE POLICY allow_all_select ON notes
  FOR SELECT
  USING (true);

-- 允许所有人插入新笔记
CREATE POLICY allow_all_insert ON notes
  FOR INSERT
  WITH CHECK (true);

-- 允许所有人更新笔记
CREATE POLICY allow_all_update ON notes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 允许所有人删除笔记
CREATE POLICY allow_all_delete ON notes
  FOR DELETE
  USING (true);

-- 创建自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除现有触发器（如果存在）
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;

-- 创建触发器
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
