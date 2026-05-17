/**
 * 收藏同步服务
 * 策略：本地缓存优先 + 云端同步为辅
 *   - 收藏操作立即更新本地 globalData（保证 UI 即时响应）
 *   - 异步同步到云数据库 favorites 集合
 *   - 页面 onShow 时从云端拉取合并（处理多端同步）
 */
var db = require('./database');
var auth = require('./auth');

var COLLECTION_NAME = 'favorites';

/**
 * 加入收藏
 * @param {string} essayId 文章 ID
 * @param {object} essayData 文章摘要（标题等，用于收藏页展示）
 */
function addFavorite(essayId, essayData) {
  // 1. 立即更新本地
  var app = getApp();
  var favs = app.globalData.favorites || [];
  if (favs.indexOf(essayId) === -1) {
    favs.push(essayId);
    app.globalData.favorites = favs;
  }

  // 2. 异步同步到云端
  auth.ensureLogin().then(function(openid) {
    if (!openid) return;
    return db.add(COLLECTION_NAME, {
      essayId: essayId,
      essayTitle: essayData.title || '',
      essayCoverQuote: essayData.coverQuote || ''
    });
  }).catch(function(err) {
    console.error('[Favorites] 云端同步失败:', err.message);
  });

  return true;
}

/**
 * 取消收藏
 * @param {string} essayId 文章 ID
 */
function removeFavorite(essayId) {
  // 1. 立即更新本地
  var app = getApp();
  app.globalData.favorites = (app.globalData.favorites || []).filter(function(id) {
    return id !== essayId;
  });

  // 2. 异步同步到云端
  auth.ensureLogin().then(function(openid) {
    if (!openid) return;
    return db.removeWhere(COLLECTION_NAME, { essayId: essayId });
  }).catch(function(err) {
    console.error('[Favorites] 云端同步失败:', err.message);
  });

  return true;
}

/**
 * 从云端拉取收藏列表
 * @returns {Promise<Array>}
 */
function fetchFromCloud() {
  return db.query(COLLECTION_NAME, {
    orderBy: ['createdAt', 'desc'],
    limit: 200
  }).then(function(res) {
    if (res && res.data) {
      return res.data.map(function(item) { return item.essayId; });
    }
    return [];
  });
}

/**
 * 合并本地与云端收藏
 * 本地为主，云端补充
 */
function syncFromCloud() {
  if (!auth.isLoggedIn()) return Promise.resolve();
  return fetchFromCloud().then(function(cloudIds) {
    if (!cloudIds.length) return;
    var app = getApp();
    var localIds = app.globalData.favorites || [];
    var merged = {};
    localIds.forEach(function(id) { merged[id] = true; });
    cloudIds.forEach(function(id) { merged[id] = true; });
    app.globalData.favorites = Object.keys(merged);
    console.log('[Favorites] 同步完成, 共 ' + app.globalData.favorites.length + ' 条');
  }).catch(function(err) {
    console.error('[Favorites] 云端拉取失败:', err.message);
  });
}

module.exports = {
  addFavorite: addFavorite,
  removeFavorite: removeFavorite,
  syncFromCloud: syncFromCloud,
  COLLECTION_NAME: COLLECTION_NAME
};
