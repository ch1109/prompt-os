-- =====================================================================
-- Prompt OS · 行业模板邀请码体系 · Supabase Schema
-- =====================================================================
-- 部署方式：复制全文到 Supabase Dashboard → SQL Editor → Run
-- 重复执行幂等：使用 CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION
--
-- 安全模型：
--   - templates / invite_codes / redemptions 三张表 RLS 启用，默认拒绝所有 anon 操作
--   - anon 仅能通过 SECURITY DEFINER RPC（preview_invite_code / redeem_invite_code）读到限定内容
--   - 创作者后台用 service_role key 直连绕过 RLS（service_role key 仅手动粘贴到 /admin 输入框，
--     存当前 sessionStorage，永不进 git）
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 模板表：内容快照 + 版本
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id               TEXT PRIMARY KEY,            -- nanoid，业务侧自定
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  audience         TEXT,                        -- 适用人群（运营备注）
  version          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published','archived')),
  payload          JSONB NOT NULL,              -- { prompts:[], scenarios:[], taskPacks:[] }
  stats            JSONB,                       -- { promptCount, scenarioCount, taskPackCount }
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);


-- ---------------------------------------------------------------------
-- 2. 邀请码表：状态机
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_codes (
  code                 TEXT PRIMARY KEY,        -- 16 字符大写字母+数字，建议格式 XXXX-XXXX-XXXX-XXXX
  template_id          TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  template_version     INTEGER NOT NULL,        -- 兑换时锁定到该版本，模板再发版不影响存量码
  status               TEXT NOT NULL DEFAULT 'unused'
                       CHECK (status IN ('unused','used','revoked')),
  expires_at           TIMESTAMPTZ,             -- NULL 表示永久有效
  notes                TEXT,                    -- 运营备注
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at              TIMESTAMPTZ,
  used_by_fingerprint  TEXT
);

CREATE INDEX IF NOT EXISTS idx_codes_template ON invite_codes(template_id);
CREATE INDEX IF NOT EXISTS idx_codes_status ON invite_codes(status);


-- ---------------------------------------------------------------------
-- 3. 兑换记录表：审计日志（码被删/撤销也保留）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS redemptions (
  id                   BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL,
  template_id          TEXT NOT NULL,
  template_version     INTEGER NOT NULL,
  redeemed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  fingerprint          TEXT,
  user_agent           TEXT
);

CREATE INDEX IF NOT EXISTS idx_redemptions_template ON redemptions(template_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_time ON redemptions(redeemed_at DESC);


-- ---------------------------------------------------------------------
-- 4. RLS：默认拒绝 anon 一切操作
-- ---------------------------------------------------------------------
ALTER TABLE templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions     ENABLE ROW LEVEL SECURITY;

-- 不创建任何 policy = anon 完全无法 SELECT/INSERT/UPDATE/DELETE
-- 创作者后台用 service_role key 自动绕过 RLS（不需要 policy）
-- 用户兑换走 SECURITY DEFINER 函数，函数内部以 owner 权限执行


-- ---------------------------------------------------------------------
-- 5. RPC: preview_invite_code（只读，不核销）
--    用户端 dry-run 拿到模板 payload 做本地冲突预检
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION preview_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code     invite_codes%ROWTYPE;
  v_payload  JSONB;
BEGIN
  SELECT * INTO v_code FROM invite_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;
  IF v_code.status = 'used' THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;
  IF v_code.status = 'revoked' THEN
    RAISE EXCEPTION 'CODE_REVOKED';
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'CODE_EXPIRED';
  END IF;

  SELECT payload INTO v_payload
    FROM templates
   WHERE id = v_code.template_id
     AND version = v_code.template_version;

  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'TEMPLATE_NOT_FOUND';
  END IF;

  RETURN v_payload;
END;
$$;

-- 授权 anon 调用（这是唯一对外公开的读取入口）
GRANT EXECUTE ON FUNCTION preview_invite_code(TEXT) TO anon;


-- ---------------------------------------------------------------------
-- 6. RPC: redeem_invite_code（核销，写日志，返回 payload）
--    SELECT FOR UPDATE 保证并发安全
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_invite_code(
  p_code        TEXT,
  p_fingerprint TEXT,
  p_ua          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code     invite_codes%ROWTYPE;
  v_payload  JSONB;
BEGIN
  -- 行级锁，防止两个客户端同时兑换同一个码
  SELECT * INTO v_code FROM invite_codes WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;
  IF v_code.status = 'used' THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;
  IF v_code.status = 'revoked' THEN
    RAISE EXCEPTION 'CODE_REVOKED';
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'CODE_EXPIRED';
  END IF;

  UPDATE invite_codes
     SET status              = 'used',
         used_at             = now(),
         used_by_fingerprint = p_fingerprint
   WHERE code = p_code;

  INSERT INTO redemptions(code, template_id, template_version, fingerprint, user_agent)
  VALUES (p_code, v_code.template_id, v_code.template_version, p_fingerprint, p_ua);

  SELECT payload INTO v_payload
    FROM templates
   WHERE id = v_code.template_id
     AND version = v_code.template_version;

  IF v_payload IS NULL THEN
    -- 极端情况：模板被删但码还在。回滚整个事务避免脏数据
    RAISE EXCEPTION 'TEMPLATE_NOT_FOUND';
  END IF;

  RETURN v_payload;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT, TEXT, TEXT) TO anon;


-- ---------------------------------------------------------------------
-- 7. 触发器：templates.updated_at 自动维护
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS templates_updated_at ON templates;
CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();


-- =====================================================================
-- 8. Admin 用户白名单：替代 service_role key 直连
-- =====================================================================
-- 登录走 Supabase Auth（auth.users），是否拥有后台权限取决于 admins 表是否有对应行
-- 未来加协作运营：Dashboard 创建账号 + 此处 INSERT 一行
CREATE TABLE IF NOT EXISTS admins (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 登录用户只能查到自己那一行，防止枚举 admin 邮箱
DROP POLICY IF EXISTS admin_read_self ON admins;
CREATE POLICY admin_read_self ON admins
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- helper: 当前登录用户是否在白名单内（前端登录后立即调用一次校验权限）
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM admins WHERE id = auth.uid()); $$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;


-- ---------------------------------------------------------------------
-- 9. 三张业务表 RLS：admin 可操作，anon 仍然被默认拒绝
-- ---------------------------------------------------------------------
-- templates：admin 全权
DROP POLICY IF EXISTS templates_admin_all ON templates;
CREATE POLICY templates_admin_all ON templates
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- invite_codes：admin 全权
DROP POLICY IF EXISTS codes_admin_all ON invite_codes;
CREATE POLICY codes_admin_all ON invite_codes
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- redemptions：admin 只读，写入由 redeem_invite_code RPC（SECURITY DEFINER）完成
DROP POLICY IF EXISTS redemptions_admin_read ON redemptions;
CREATE POLICY redemptions_admin_read ON redemptions
  FOR SELECT TO authenticated
  USING (is_admin());


-- =====================================================================
-- 部署后自检 SQL（手动执行验证）
-- =====================================================================
-- 1. 插一个测试模板：
--   INSERT INTO templates(id, title, description, version, status, payload, stats)
--   VALUES ('tpl_test_designer','测试·设计师','本期测试模板',1,'published',
--           '{"prompts":[],"scenarios":[],"taskPacks":[]}'::jsonb,
--           '{"promptCount":0,"scenarioCount":0,"taskPackCount":0}'::jsonb);
--
-- 2. 插一个测试码：
--   INSERT INTO invite_codes(code, template_id, template_version)
--   VALUES ('TEST-TEST-TEST-TEST','tpl_test_designer',1);
--
-- 3. preview 应该返回 payload：
--   SELECT preview_invite_code('TEST-TEST-TEST-TEST');
--
-- 4. redeem 第一次成功：
--   SELECT redeem_invite_code('TEST-TEST-TEST-TEST','test_fp','test_ua');
--
-- 5. redeem 第二次应该报 CODE_ALREADY_USED：
--   SELECT redeem_invite_code('TEST-TEST-TEST-TEST','test_fp','test_ua');
--
-- 6. 检查审计：
--   SELECT * FROM redemptions WHERE code='TEST-TEST-TEST-TEST';
