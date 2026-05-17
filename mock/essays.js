/**
 * 首页 Mock 数据
 * 数据结构符合项目规范：句子化存储
 */

var mockArticles = [
  {
    id: 'a1',
    title: 'The Blue Hour',
    coverQuote: 'There is a moment between daylight and darkness when the world holds its breath.',
    mood: '静谧',
    scene: '黄昏',
    difficulty: 'easy',
    readingTime: 3,
    sentences: [
      {
        en: 'The sky shifts from gold to indigo, one shade at a time.',
        zh: '天空从金色渐变为靛蓝，一次一种色调。',
        tokens: ['sky', 'shifts', 'gold', 'indigo', 'shade']
      },
      {
        en: 'Street lamps flicker on, one by one, like slow-blinking stars.',
        zh: '路灯一盏接一盏亮起，像缓慢眨眼的星星。',
        tokens: ['street', 'lamps', 'flicker', 'blinking', 'stars']
      },
      {
        en: 'Someone walks by with a cup of coffee, steam curling into the cold air.',
        zh: '有人端着一杯咖啡走过，蒸汽旋入冷空气中。',
        tokens: ['walks', 'coffee', 'steam', 'curling', 'cold']
      },
      {
        en: 'I sit on the bench and watch the city exhale.',
        zh: '我坐在长椅上，看着城市呼出一口气。',
        tokens: ['bench', 'watch', 'city', 'exhale']
      }
    ]
  },
  {
    id: 'a2',
    title: 'Small Things',
    coverQuote: 'The smallest moments carry the most weight.',
    mood: '温暖',
    scene: '日常',
    difficulty: 'easy',
    readingTime: 2,
    sentences: [
      {
        en: 'Morning light falls across the wooden table in thin, golden stripes.',
        zh: '晨光落在木桌上，变成细细的金色条纹。',
        tokens: ['morning', 'light', 'wooden', 'table', 'golden', 'stripes']
      },
      {
        en: 'A cat stretches in the sunbeam, paws reaching toward nothing.',
        zh: '一只猫在阳光下伸展，爪子伸向虚无。',
        tokens: ['cat', 'stretches', 'sunbeam', 'paws', 'reaching']
      },
      {
        en: 'The kettle begins to hum — a quiet promise of tea.',
        zh: '水壶开始嗡嗡作响——一个关于茶的安静承诺。',
        tokens: ['kettle', 'hum', 'quiet', 'promise', 'tea']
      }
    ]
  },
  {
    id: 'a3',
    title: 'Night Rain',
    coverQuote: 'Rain against the window is the city whispering secrets.',
    mood: '安静',
    scene: '雨夜',
    difficulty: 'medium',
    readingTime: 4,
    sentences: [
      {
        en: 'The first drop hits the glass with a soft tap, then another.',
        zh: '第一滴雨轻轻敲在玻璃上，然后是第二滴。',
        tokens: ['first', 'drop', 'glass', 'soft', 'tap']
      },
      {
        en: 'Soon the rain is a steady rhythm, a lullaby for insomniacs.',
        zh: '很快雨声变成了稳定的节奏，一首给失眠者的摇篮曲。',
        tokens: ['rain', 'steady', 'rhythm', 'lullaby', 'insomniacs']
      },
      {
        en: 'Street lights blur into watercolor smears on the wet pavement.',
        zh: '路灯在湿漉漉的路面上模糊成水彩般的涂抹。',
        tokens: ['street', 'lights', 'blur', 'watercolor', 'smears', 'pavement']
      },
      {
        en: 'I pull the blanket closer and let the sound wash over me.',
        zh: '我裹紧毯子，让声音冲刷过我。',
        tokens: ['pull', 'blanket', 'closer', 'sound', 'wash']
      },
      {
        en: 'There is something deeply safe about being dry while the world outside is wet.',
        zh: '当外面的世界湿漉漉时，保持干燥有一种深深的安心感。',
        tokens: ['deeply', 'safe', 'dry', 'outside', 'wet']
      }
    ]
  },
  {
    id: 'a4',
    title: 'Late Night Convenience Store',
    coverQuote: 'At 2 AM, the konbini glows like a paper lantern on a dark street.',
    mood: '孤独',
    scene: '深夜',
    difficulty: 'medium',
    readingTime: 3,
    sentences: [
      {
        en: 'The automatic door slides open with a soft chime, welcoming no one in particular.',
        zh: '自动门伴着轻柔的提示音滑开，不特别欢迎任何人。',
        tokens: ['automatic', 'door', 'slides', 'chime', 'welcoming']
      },
      {
        en: 'Fluorescent light spills onto the wet asphalt, a rectangle of cold white.',
        zh: '荧光灯的光倾泻在湿沥青上，一块冷白色的矩形。',
        tokens: ['fluorescent', 'spills', 'asphalt', 'rectangle', 'cold']
      },
      {
        en: 'The old cashier reads a paperback, turning pages with mechanical patience.',
        zh: '年长的收银员读着一本平装书，机械而耐心地翻着页。',
        tokens: ['cashier', 'paperback', 'turning', 'mechanical', 'patience']
      },
      {
        en: 'I buy a warm can of milky tea and stand outside, watching the empty street breathe.',
        zh: '我买了一罐温热的奶茶，站在外面，看着空旷的街道呼吸。',
        tokens: ['warm', 'milky', 'tea', 'empty', 'street', 'breathe']
      }
    ]
  }
];

module.exports = {
  mockArticles: mockArticles
};
