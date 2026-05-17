/**
 * 格式化工具函数
 */

/**
 * 格式化阅读时间
 * @param {number} minutes
 * @returns {string}
 */
function formatReadingTime(minutes) {
  if (minutes < 1) return '< 1 min read';
  if (minutes === 1) return '1 min read';
  return minutes + ' min read';
}

/**
 * 获取难度标签
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {string}
 */
function getDifficultyLabel(difficulty) {
  var map = { easy: '轻松', medium: '适中', hard: '进阶' };
  return map[difficulty] || difficulty;
}

/**
 * 防抖
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  delay = delay || 300;
  var timer = null;
  return function() {
    if (timer) clearTimeout(timer);
    var args = arguments;
    var self = this;
    timer = setTimeout(function() {
      fn.apply(self, args);
    }, delay);
  };
}

module.exports = {
  formatReadingTime: formatReadingTime,
  getDifficultyLabel: getDifficultyLabel,
  debounce: debounce
};
