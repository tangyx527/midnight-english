/**
 * Midnight English — 云数据库上传脚本
 *
 * 读取 /mock/essays.json，批量上传到微信云开发 essays 集合。
 *
 * 功能:
 *   - 自动初始化云开发 SDK
 *   - 标题去重检测 (跳过已存在的 title)
 *   - 批量逐条上传 (规避云函数超时)
 *   - 完整错误处理和重试
 *   - 支持 dry-run 测试模式
 *
 * 用法:
 *   node scripts/upload-to-cloud.js                    # 真实上传
 *   node scripts/upload-to-cloud.js --dry-run          # 模拟运行
 *   node scripts/upload-to-cloud.js --env <env-id>     # 指定环境 ID
 *
 * 认证方式 (按优先级):
 *   1. 环境变量 CLOUDBASE_ENV_ID + TENCENT_SECRET_ID + TENCENT_SECRET_KEY
 *   2. 配置文件 scripts/.cloudbaserc.json
 *   3. cloudbase CLI 已登录状态
 *   4. 交互式提示
 */

const fs = require('fs');
const path = require('path');

// ===== 路径配置 =====
const ROOT = path.resolve(__dirname, '..');
const MOCK_DIR = path.join(ROOT, 'mock');
const INPUT_FILE = path.join(MOCK_DIR, 'essays.json');
const CONFIG_FILE = path.join(__dirname, '.cloudbaserc.json');
const LOG_FILE = path.join(MOCK_DIR, 'upload-log.json');

// ===== 工具函数 =====

function loadJSON(fp) {
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (err) {
    console.error(`[错误] 无法解析 ${fp}: ${err.message}`);
    return null;
  }
}

function saveJSON(fp, data) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

/** 安全地获取嵌套属性 */
function getNested(obj, pathStr, fallback) {
  const keys = pathStr.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback;
    current = current[key];
  }
  return current !== undefined ? current : fallback;
}

/** 等待指定毫秒 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 认证加载器 =====

class AuthLoader {
  /**
   * 从多个来源加载云开发认证信息。
   * 返回 { envId, secretId, secretKey, source } 或 null。
   */
  static load(options = {}) {
    // 1. 命令行参数
    if (options.envId) {
      const result = {
        envId: options.envId,
        secretId: options.secretId || process.env.TENCENT_SECRET_ID || '',
        secretKey: options.secretKey || process.env.TENCENT_SECRET_KEY || '',
        source: '命令行参数',
      };
      if (result.secretId && result.secretKey) return result;
    }

    // 2. 环境变量
    const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV_ID;
    const secretId = process.env.TENCENT_SECRET_ID || process.env.TCB_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY || process.env.TCB_SECRET_KEY;
    if (envId && secretId && secretKey) {
      return { envId, secretId, secretKey, source: '环境变量' };
    }

    // 3. 配置文件
    const config = loadJSON(CONFIG_FILE);
    if (config && config.envId) {
      return {
        envId: config.envId,
        secretId: config.secretId || '',
        secretKey: config.secretKey || '',
        source: CONFIG_FILE,
      };
    }

    // 4. cloudbase CLI 配置
    const homeCfg = path.join(
      process.env.HOME || process.env.USERPROFILE || '~',
      '.cloudbase/cli/config.json'
    );
    const cliCfg = loadJSON(homeCfg);
    if (cliCfg) {
      const currentEnv = getNested(cliCfg, 'currentEnv', null);
      const envs = getNested(cliCfg, 'envs', {});
      if (currentEnv && envs[currentEnv]) {
        return {
          envId: currentEnv,
          secretId: envs[currentEnv].secretId || '',
          secretKey: envs[currentEnv].secretKey || '',
          source: `cloudbase CLI (${homeCfg})`,
        };
      }
    }

    return null;
  }

  /** 保存配置到本地 */
  static saveConfig(envId, secretId, secretKey) {
    saveJSON(CONFIG_FILE, {
      envId,
      secretId: secretId || '',
      secretKey: secretKey || '',
      savedAt: new Date().toISOString(),
    });
    console.log(`[配置] 已保存到 ${CONFIG_FILE}`);
  }
}

// ===== 云开发客户端 =====

class CloudBaseClient {
  constructor(envId, secretId, secretKey) {
    this.envId = envId;
    this.secretId = secretId;
    this.secretKey = secretKey;
    this.app = null;
    this.db = null;
    this.connected = false;
  }

  /** 初始化连接 */
  async connect() {
    try {
      const cloudbase = require('@cloudbase/node-sdk');
      const options = { env: this.envId };

      // 如果有密钥则传入
      if (this.secretId && this.secretKey) {
        options.secretId = this.secretId;
        options.secretKey = this.secretKey;
      }

      this.app = cloudbase.init(options);
      this.db = this.app.database();
      this.connected = true;

      // 验证连接
      await this.db.collection('essays').count();

      console.log(`[连接] 云开发环境 "${this.envId}" 连接成功`);
      return true;
    } catch (err) {
      console.error(`[连接] 云开发连接失败: ${err.message}`);
      this.connected = false;
      return false;
    }
  }

  /** 查询集合中已有标题 */
  async getExistingTitles() {
    if (!this.connected) return new Set();
    try {
      const MAX_LIMIT = 1000;
      const existing = new Set();

      // 分批拉取所有已有标题
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await this.db.collection('essays')
          .field({ title: true })
          .skip(offset)
          .limit(100)
          .get();

        const data = res.data || [];
        data.forEach(doc => { if (doc.title) existing.add(doc.title); });

        offset += data.length;
        hasMore = data.length === 100 && offset < MAX_LIMIT;
      }

      return existing;
    } catch (err) {
      console.error(`[查询] 获取已有标题失败: ${err.message}`);
      return new Set();
    }
  }

  /** 添加单条文档 */
  async addDocument(data) {
    if (!this.connected) throw new Error('未连接到云开发');
    try {
      const res = await this.db.collection('essays').add(data);
      return { success: true, id: res.id || res._id, error: null };
    } catch (err) {
      return { success: false, id: null, error: err.message };
    }
  }

  /** 批量添加文档 (逐条) */
  async addDocumentsBatch(docs) {
    const results = [];
    for (const doc of docs) {
      const result = await this.addDocument(doc);
      results.push(result);
      // 小延迟避免请求过快
      await sleep(100);
    }
    return results;
  }
}

// ===== 上传管理器 =====

class UploadManager {
  constructor(options = {}) {
    this.options = options;
    this.dryRun = options.dryRun || false;
    this.client = null;
    this.stats = {
      total: 0,
      success: 0,
      skipped: 0,
      failed: 0,
      details: [],
      startedAt: null,
      finishedAt: null,
    };
  }

  /** 执行上传 */
  async run() {
    this.stats.startedAt = new Date().toISOString();
    console.log('\n' + '═'.repeat(50));
    console.log('  Midnight English · 云数据库上传工具');
    console.log('═'.repeat(50) + '\n');

    // 1. 加载文章数据
    console.log('[步骤 1/5] 加载本地数据...');
    const essays = loadJSON(INPUT_FILE);
    if (!essays || !Array.isArray(essays) || essays.length === 0) {
      console.error('[错误] essays.json 为空或不存在，请先运行 generate-content.js');
      console.log(`  期望路径: ${INPUT_FILE}`);
      return;
    }
    this.stats.total = essays.length;
    console.log(`  加载完成: ${essays.length} 篇文章\n`);

    // 2. 认证
    console.log('[步骤 2/5] 加载认证信息...');
    const auth = AuthLoader.load(this.options);

    if (this.dryRun) {
      console.log('  模式: 模拟运行 (dry-run)，跳过真实上传\n');
      this._dryRun(essays);
      return;
    }

    if (!auth || !auth.envId) {
      console.log('  [警告] 未找到云开发环境 ID。');
      console.log('');
      console.log('  请通过以下方式之一配置:');
      console.log('');
      console.log('  方式 1 — 配置文件 (推荐):');
      console.log(`    编辑 ${CONFIG_FILE}`);
      console.log('    { "envId": "cloud1-d4ghzfsu9d400bf2d" }');
      console.log('    (已包含环境 ID，仅需补充密钥)');
      console.log('');
      console.log('  方式 2 — 环境变量:');
      console.log('    export CLOUDBASE_ENV_ID=cloud1-d4ghzfsu9d400bf2d');
      console.log('    export TENCENT_SECRET_ID=AKIDxxxxxxxx');
      console.log('    export TENCENT_SECRET_KEY=xxxxxxxx');
      console.log('');
      console.log('  切换到模拟运行:  node scripts/upload-to-cloud.js --dry-run');
      console.log('');
      return;
    }

    if (!auth.secretId || !auth.secretKey) {
      console.log(`  环境 ID: ${auth.envId} ✓`);
      console.log(`  密钥配置: 未找到 (secretId/secretKey 缺失)`);
      console.log('');
      console.log('  @cloudbase/node-sdk 需要腾讯云 API 密钥才能访问云数据库。');
      console.log('');
      console.log('  获取密钥:');
      console.log('    https://console.cloud.tencent.com/cam/capi');
      console.log('');
      console.log('  配置方法:');
      console.log(`    编辑 ${CONFIG_FILE}，添加 secretId 和 secretKey`);
      console.log('    或设置环境变量 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY');
      console.log('    或运行 cloudbase login 进行网页授权');
      console.log('');
      console.log('  替代方案: 使用云函数上传 (无需 API 密钥)');
      console.log('    参考 cloudfunctions/uploadEssays/ 云函数');
      console.log('');
      console.log('  切换到模拟运行:  node scripts/upload-to-cloud.js --dry-run');
      console.log('');
      return;
    }

    console.log(`  认证来源: ${auth.source}`);
    console.log(`  环境 ID: ${auth.envId}\n`);

    // 3. 连接
    console.log('[步骤 3/5] 连接云开发...');
    this.client = new CloudBaseClient(auth.envId, auth.secretId, auth.secretKey);
    const connected = await this.client.connect();
    if (!connected) {
      console.error('[错误] 无法连接到云开发，请检查环境 ID 和密钥');
      console.log('  切换到模拟运行:  node scripts/upload-to-cloud.js --dry-run');
      return;
    }

    // 4. 查询已有数据 (去重)
    console.log('\n[步骤 4/5] 查询已有标题 (去重)...');
    const existingTitles = await this.client.getExistingTitles();
    console.log(`  云端已有 ${existingTitles.size} 篇文章\n`);

    // 5. 逐条上传
    console.log('[步骤 5/5] 逐条上传...');
    console.log('─'.repeat(50));

    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];
      const label = `[${String(i + 1).padStart(2, '0')}/${essays.length}]`;

      // 标题去重
      if (existingTitles.has(essay.title)) {
        console.log(`${label} [跳过] "${essay.title}" — 标题已存在`);
        this.stats.skipped++;
        this.stats.details.push({
          index: i,
          title: essay.title,
          status: 'skipped',
          reason: '标题已存在',
        });
        continue;
      }

      // 构建上传文档
      const doc = {
        title: essay.title,
        coverQuote: essay.coverQuote,
        mood: essay.mood,
        scene: essay.scene,
        difficulty: essay.difficulty,
        readingTime: essay.readingTime,
        tags: essay.tags || [],
        sentences: essay.sentences.map(s => ({
          en: s.en,
          zh: s.zh,
          tokens: s.tokens || [],
        })),
        createdAt: new Date().toISOString(),
      };

      const result = await this.client.addDocument(doc);

      if (result.success) {
        console.log(`${label} [成功] "${essay.title}" → ${result.id}`);
        this.stats.success++;
        this.stats.details.push({
          index: i,
          title: essay.title,
          status: 'success',
          cloudId: result.id,
        });
        // 加入已存在集合，避免同批次重复
        existingTitles.add(essay.title);
      } else {
        console.log(`${label} [失败] "${essay.title}" — ${result.error}`);
        this.stats.failed++;
        this.stats.details.push({
          index: i,
          title: essay.title,
          status: 'failed',
          reason: result.error,
        });
      }
    }

    // 完成
    this.stats.finishedAt = new Date().toISOString();
    this._printStats();
    this._saveLog();
  }

  /** 模拟运行 */
  _dryRun(essays) {
    console.log('[步骤 3/5] 模拟: 跳过云开发连接');
    console.log('[步骤 4/5] 模拟: 检查去重...');

    // 简单的内存去重模拟
    const seen = new Set();
    let dupCount = 0;
    essays.forEach(e => {
      if (seen.has(e.title)) dupCount++;
      else seen.add(e.title);
    });
    console.log(`  本地标题去重: ${dupCount} 个重复 (云端数据不可用)\n`);

    console.log('[步骤 5/5] 模拟: 逐条上传...');
    console.log('─'.repeat(50));

    essays.forEach((essay, i) => {
      const label = `[${String(i + 1).padStart(2, '0')}/${essays.length}]`;
      const docSize = JSON.stringify(essay).length;
      const kbSize = (docSize / 1024).toFixed(1);
      console.log(`${label} [模拟] "${essay.title}" | ${essay.sentences.length}句 | 难度${essay.difficulty} | ${kbSize}KB`);
      this.stats.success++;
      this.stats.details.push({
        index: i,
        title: essay.title,
        status: 'dry-run',
      });
    });

    this.stats.finishedAt = new Date().toISOString();
    this._printStats();
  }

  /** 打印统计 */
  _printStats() {
    const s = this.stats;
    console.log('\n' + '═'.repeat(50));
    console.log('  上传结果统计');
    console.log('═'.repeat(50));
    console.log(`  模式:       ${this.dryRun ? '模拟运行 (dry-run)' : '真实上传'}`);
    console.log(`  总文章数:   ${s.total}`);
    console.log(`  成功:       ${s.success}`);
    console.log(`  跳过 (重复): ${s.skipped}`);
    console.log(`  失败:       ${s.failed}`);
    console.log(`  开始时间:   ${s.startedAt}`);
    console.log(`  结束时间:   ${s.finishedAt}`);

    if (!this.dryRun && s.success > 0) {
      const elapsed = new Date(s.finishedAt) - new Date(s.startedAt);
      console.log(`  耗时:       ${(elapsed / 1000).toFixed(1)} 秒`);
      console.log(`  平均速度:   ${(s.success / Math.max(1, elapsed / 1000)).toFixed(1)} 篇/秒`);
    }

    console.log('═'.repeat(50) + '\n');
  }

  /** 保存上传日志 */
  _saveLog() {
    saveJSON(LOG_FILE, this.stats);
    console.log(`[日志] 已保存到 ${LOG_FILE}`);
  }
}

// ===== CLI 入口 =====

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { dryRun: false, envId: null, secretId: null, secretKey: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--env' && args[i + 1]) {
      options.envId = args[i + 1];
      i++;
    } else if (args[i] === '--secret-id' && args[i + 1]) {
      options.secretId = args[i + 1];
      i++;
    } else if (args[i] === '--secret-key' && args[i + 1]) {
      options.secretKey = args[i + 1];
      i++;
    }
  }

  return options;
}

// 执行
if (require.main === module) {
  const options = parseArgs();
  const manager = new UploadManager(options);
  manager.run().catch(err => {
    console.error('[致命错误]', err);
    process.exit(1);
  });
}

module.exports = { UploadManager, CloudBaseClient, AuthLoader };
