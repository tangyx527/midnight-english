/**
 * 数据库访问封装
 * 职责：统一数据库操作 + 错误处理
 */
var db = null;

function getDB() {
  if (!db) {
    db = wx.cloud.database();
  }
  return db;
}

/**
 * 统一错误处理
 * @param {Error} err
 * @param {*} fallback 可选的回退值
 */
function handleError(err, fallback) {
  console.error('[Cloud DB] 操作失败:', err.message || err);
  if (fallback !== undefined) return fallback;
  return null;
}

/**
 * 获取集合引用
 */
function coll(name) {
  return getDB().collection(name);
}

/**
 * 查询集合
 * @param {string} name 集合名
 * @param {object} options { where, orderBy, limit, skip }
 */
function query(name, options) {
  options = options || {};
  var q = coll(name);
  if (options.where) q = q.where(options.where);
  if (options.orderBy) q = q.orderBy(options.orderBy[0], options.orderBy[1]);
  if (options.limit) q = q.limit(options.limit);
  if (options.skip) q = q.skip(options.skip);
  return q.get().catch(function(err) { return handleError(err, { data: [] }); });
}

/**
 * 添加记录
 */
function add(name, data) {
  data.createdAt = data.createdAt || new Date();
  return coll(name).add({ data: data }).catch(function(err) { return handleError(err, null); });
}

/**
 * 根据 ID 删除记录
 */
function removeById(name, id) {
  return coll(name).doc(id).remove().catch(function(err) { return handleError(err, null); });
}

/**
 * 根据条件删除
 */
function removeWhere(name, condition) {
  return coll(name).where(condition).remove().catch(function(err) { return handleError(err, null); });
}

/**
 * 更新记录
 */
function updateById(name, id, data) {
  return coll(name).doc(id).update({ data: data }).catch(function(err) { return handleError(err, null); });
}

module.exports = {
  coll: coll,
  query: query,
  add: add,
  removeById: removeById,
  removeWhere: removeWhere,
  updateById: updateById,
  getDB: getDB
};
