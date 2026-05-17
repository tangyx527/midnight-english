/**
 * 上传文章云函数 — 读取 mock/essays.json 并写入 essays 集合
 *
 * 用法 (在微信开发者工具中右键此云函数 → 上传并部署 → 云端测试调用):
 *   uploadEssays()
 *   uploadEssays({ dryRun: true })
 *
 * 与 scripts/upload-to-cloud.js 的区别:
 *   云函数运行在微信云环境内部，使用 wx-server-sdk
 *   不需要外部 API 密钥，自动获取当前环境上下文
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ===== 内置文章数据 =====
// 此数据与 scripts/generate-content.js 生成的内容一致
// 可直接用 require 引入外部 JSON 文件 (云函数不支持动态 require 本地 JSON)
// 因此数据以内联方式维护，或通过参数传入

exports.main = async function(event) {
  const dryRun = event && event.dryRun;
  const essays = event && event.essays; // 支持从参数传入

  // 如果没有传入数据，提示用法
  if (!essays || !Array.isArray(essays) || essays.length === 0) {
    return {
      ok: false,
      message: '请传入 essays 参数 (文章数组)。可从 /mock/essays.json 复制内容。',
      usage: '在云函数测试中输入: { "essays": [...] }',
      hint: '或在小程序端调用: wx.cloud.callFunction({ name: "uploadEssays", data: { essays: [...] } })',
    };
  }

  const coll = db.collection('essays');
  const stats = {
    total: essays.length,
    success: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  // 分批查询已有标题 (最多 1000 条)
  console.log(`[uploadEssays] 查询云端已有标题...`);
  const existingTitles = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await coll.field({ title: true }).skip(offset).limit(100).get();
    (res.data || []).forEach(doc => { if (doc.title) existingTitles.add(doc.title); });
    offset += (res.data || []).length;
    hasMore = (res.data || []).length === 100 && offset < 1000;
  }
  console.log(`[uploadEssays] 云端已有 ${existingTitles.size} 篇文章`);

  if (dryRun) {
    essays.forEach(e => {
      const dup = existingTitles.has(e.title);
      stats.details.push({ title: e.title, status: dup ? 'would-skip' : 'would-upload' });
      if (dup) stats.skipped++;
      else stats.success++;
    });
    stats.message = '模拟运行完成 (dry-run)';
    return { ok: true, stats };
  }

  // 逐条上传
  for (let i = 0; i < essays.length; i++) {
    const essay = essays[i];

    // 标题去重
    if (existingTitles.has(essay.title)) {
      console.log(`[uploadEssays] [跳过] "${essay.title}"`);
      stats.skipped++;
      stats.details.push({ title: essay.title, status: 'skipped', reason: '标题已存在' });
      continue;
    }

    try {
      const doc = {
        title: essay.title,
        coverQuote: essay.coverQuote,
        mood: essay.mood,
        scene: essay.scene,
        difficulty: essay.difficulty,
        readingTime: essay.readingTime,
        tags: essay.tags || [],
        sentences: (essay.sentences || []).map(s => ({
          en: s.en,
          zh: s.zh,
          tokens: s.tokens || [],
        })),
        createdAt: new Date().toISOString(),
      };

      const res = await coll.add({ data: doc });
      console.log(`[uploadEssays] [成功] "${essay.title}" → ${res._id}`);
      stats.success++;
      stats.details.push({ title: essay.title, status: 'success', cloudId: res._id });
      existingTitles.add(essay.title);
    } catch (err) {
      console.error(`[uploadEssays] [失败] "${essay.title}": ${err.message}`);
      stats.failed++;
      stats.details.push({ title: essay.title, status: 'failed', reason: err.message });
    }
  }

  console.log(`[uploadEssays] 完成: 成功 ${stats.success}, 跳过 ${stats.skipped}, 失败 ${stats.failed}`);
  return { ok: true, stats };
};
