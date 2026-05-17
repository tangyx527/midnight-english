/**
 * 生词本同步服务
 * 策略：本地缓存优先 + 云端同步为辅
 *   - 添加/删除立即更新本地 globalData
 *   - 异步同步到云数据库 wordbook 集合
 *   - 页面 onShow 时从云端拉取合并
 */
var db = require('./database');
var auth = require('./auth');

var COLLECTION_NAME = 'wordbook';

/**
 * 添加生词
 * @param {object} entry { word, meaning, sourceSentence, sourceTitle, collectedTime }
 * @returns {boolean} 是否添加成功
 */
function addWord(entry) {
  // 查重
  var app = getApp();
  var wordBook = app.globalData.wordBook || [];
  var exists = wordBook.some(function(item) {
    return item.word === entry.word;
  });
  if (exists) return false;

  // 1. 立即更新本地
  wordBook.push(entry);
  app.globalData.wordBook = wordBook;

  // 2. 异步同步到云端
  auth.ensureLogin().then(function(openid) {
    if (!openid) return;
    return db.add(COLLECTION_NAME, {
      word: entry.word,
      meaning: entry.meaning || '',
      sourceSentence: entry.sourceSentence || '',
      sourceTitle: entry.sourceTitle || '',
      collectedTime: entry.collectedTime || ''
    });
  }).catch(function(err) {
    console.error('[WordBook] 云端同步失败:', err.message);
  });

  return true;
}

/**
 * 删除生词
 * @param {string} word 单词
 */
function removeWord(word) {
  // 1. 立即更新本地
  var app = getApp();
  app.globalData.wordBook = (app.globalData.wordBook || []).filter(function(item) {
    return item.word !== word;
  });

  // 2. 异步同步到云端
  auth.ensureLogin().then(function(openid) {
    if (!openid) return;
    return db.removeWhere(COLLECTION_NAME, { word: word });
  }).catch(function(err) {
    console.error('[WordBook] 云端同步失败:', err.message);
  });

  return true;
}

/**
 * 从云端拉取生词本
 * @returns {Promise<Array>}
 */
function fetchFromCloud() {
  return db.query(COLLECTION_NAME, {
    orderBy: ['createdAt', 'desc'],
    limit: 500
  }).then(function(res) {
    if (res && res.data) {
      return res.data.map(function(item) {
        return {
          word: item.word,
          meaning: item.meaning || '',
          sourceSentence: item.sourceSentence || '',
          sourceTitle: item.sourceTitle || '',
          collectedTime: item.collectedTime || ''
        };
      });
    }
    return [];
  });
}

/**
 * 合并本地与云端生词本
 * 本地为主，云端补充（按 word 字段去重）
 */
function syncFromCloud() {
  if (!auth.isLoggedIn()) return Promise.resolve();
  return fetchFromCloud().then(function(cloudWords) {
    if (!cloudWords.length) return;
    var app = getApp();
    var local = app.globalData.wordBook || [];
    var seen = {};
    local.forEach(function(item) { seen[item.word] = true; });
    cloudWords.forEach(function(item) {
      if (!seen[item.word]) {
        local.push(item);
        seen[item.word] = true;
      }
    });
    app.globalData.wordBook = local;
    console.log('[WordBook] 同步完成, 共 ' + local.length + ' 条');
  }).catch(function(err) {
    console.error('[WordBook] 云端拉取失败:', err.message);
  });
}

module.exports = {
  addWord: addWord,
  removeWord: removeWord,
  syncFromCloud: syncFromCloud,
  COLLECTION_NAME: COLLECTION_NAME
};
