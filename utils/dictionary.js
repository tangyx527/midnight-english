/**
 * 轻量单词词典
 * 覆盖 mock 数据中所有 token 单词
 */

var wordMap = {
  'sky': '天空',
  'shifts': '转变；变换',
  'gold': '金色；黄金',
  'indigo': '靛蓝',
  'shade': '色调；阴影',
  'street': '街道',
  'lamps': '灯',
  'flicker': '闪烁；摇曳',
  'blinking': '眨眼的；闪烁的',
  'stars': '星星',
  'walks': '走过；步行',
  'coffee': '咖啡',
  'steam': '蒸汽',
  'curling': '卷曲的；缭绕的',
  'cold': '寒冷；冷的',
  'bench': '长椅',
  'watch': '观看；注视',
  'city': '城市',
  'exhale': '呼气；呼出',
  'morning': '早晨',
  'light': '光线；光',
  'wooden': '木制的',
  'table': '桌子',
  'golden': '金色的',
  'stripes': '条纹',
  'cat': '猫',
  'stretches': '伸展；舒展',
  'sunbeam': '阳光；日光束',
  'paws': '爪子',
  'reaching': '伸向；到达',
  'kettle': '水壶',
  'hum': '嗡嗡声',
  'quiet': '安静的',
  'promise': '承诺',
  'tea': '茶',
  'first': '第一',
  'drop': '滴；落下',
  'glass': '玻璃',
  'soft': '轻柔的；柔软的',
  'tap': '轻敲；轻拍',
  'rain': '雨',
  'steady': '稳定的；持续的',
  'rhythm': '节奏',
  'lullaby': '摇篮曲',
  'insomniacs': '失眠者',
  'lights': '灯光',
  'blur': '模糊',
  'watercolor': '水彩',
  'smears': '涂抹；污迹',
  'pavement': '路面；人行道',
  'pull': '拉；拽',
  'blanket': '毯子',
  'closer': '更近的',
  'sound': '声音',
  'wash': '冲刷；洗涤',
  'deeply': '深深地',
  'safe': '安全的',
  'dry': '干燥的',
  'outside': '外面',
  'wet': '湿的',
  'automatic': '自动的',
  'door': '门',
  'slides': '滑开；滑动',
  'chime': '提示音；鸣响',
  'welcoming': '欢迎',
  'fluorescent': '荧光的',
  'spills': '倾泻；溢出',
  'asphalt': '沥青',
  'rectangle': '矩形',
  'cashier': '收银员',
  'paperback': '平装书',
  'turning': '翻页；转动',
  'mechanical': '机械的',
  'patience': '耐心',
  'warm': '温暖的',
  'milky': '奶味的；乳状的',
  'empty': '空旷的；空的',
  'breathe': '呼吸'
};

/**
 * 查单词
 * @param {string} word
 * @returns {string|null}
 */
function lookup(word) {
  if (!word) return null;
  var lower = word.toLowerCase();
  return wordMap[lower] || null;
}

module.exports = {
  lookup: lookup,
  wordMap: wordMap
};
