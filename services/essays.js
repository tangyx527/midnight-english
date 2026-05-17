/**
 * 文章数据服务
 * 策略：云端优先 + 本地 mock 回退
 *   - 优先从云数据库 essays 集合加载
 *   - 如果云端为空或失败，使用本地 mock 数据
 *   - 加载成功后缓存到本地 globalData
 */
var db = require('./database');
var mockData = require('../mock/essays.js');

var COLLECTION_NAME = 'essays';

/**
 * 从云端获取所有文章
 * @returns {Promise<Array>}
 */
function fetchFromCloud() {
  return db.query(COLLECTION_NAME, {
    orderBy: ['sortOrder', 'asc'],
    limit: 50
  }).then(function(res) {
    if (res && res.data && res.data.length > 0) {
      return res.data.map(normalizeEssay);
    }
    return [];
  });
}

/**
 * 标准化文章数据结构
 * 统一云端和 mock 数据格式
 */
function normalizeEssay(raw) {
  return {
    id: raw._id || raw.id,
    title: raw.title || '',
    titleZh: raw.titleZh || '',
    coverQuote: raw.coverQuote || '',
    mood: raw.mood || '',
    scene: raw.scene || '',
    difficulty: raw.difficulty || 'easy',
    readingTime: raw.readingTime || 1,
    sentences: (raw.sentences || []).map(function(s) {
      return {
        en: s.en || '',
        zh: s.zh || '',
        tokens: s.tokens || [],
        showZh: false
      };
    }),
    expanded: false
  };
}

/**
 * 获取文章列表
 * 云端优先，失败或为空时回退到本地 mock
 */
function getEssays() {
  return fetchFromCloud().then(function(articles) {
    if (articles && articles.length > 0) {
      console.log('[Essays] 从云端加载了 ' + articles.length + ' 篇文章');
      return articles;
    }
    console.log('[Essays] 云端无数据，使用本地 mock');
    return mockData.mockArticles.map(normalizeEssay);
  }).catch(function(err) {
    console.error('[Essays] 云端加载失败，使用本地 mock:', err.message);
    return mockData.mockArticles.map(normalizeEssay);
  });
}

/**
 * 种子数据：将 mock 文章写入云端（首次初始化用）
 * 仅在管理场景使用，普通客户端不应调用
 */
function seedEssays() {
  var promises = mockData.mockArticles.map(function(article, index) {
    return db.add(COLLECTION_NAME, {
      title: article.title,
      coverQuote: article.coverQuote,
      mood: article.mood,
      scene: article.scene,
      difficulty: article.difficulty,
      readingTime: article.readingTime,
      sentences: article.sentences,
      sortOrder: index
    });
  });
  return Promise.all(promises);
}

module.exports = {
  getEssays: getEssays,
  seedEssays: seedEssays,
  COLLECTION_NAME: COLLECTION_NAME
};
