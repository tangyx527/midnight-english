/**
 * 本地缓存工具
 * 封装 wx.getStorageSync/setStorageSync，统一异常处理
 */

/**
 * 读取缓存
 * @param {string} key
 * @param {*} fallback 缓存为空时的默认值
 */
function get(key, fallback) {
  try {
    var value = wx.getStorageSync(key);
    return value !== '' && value !== undefined ? value : fallback;
  } catch (e) {
    console.warn('[Storage] 读取失败:', key, e.message);
    return fallback;
  }
}

/**
 * 写入缓存
 * @param {string} key
 * @param {*} value
 */
function set(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    console.warn('[Storage] 写入失败:', key, e.message);
  }
}

/**
 * 删除缓存
 * @param {string} key
 */
function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.warn('[Storage] 删除失败:', key, e.message);
  }
}

module.exports = {
  get: get,
  set: set,
  remove: remove
};
