/**
 * Midnight English - AI 内容生成系统 v2
 *
 * 增强功能:
 *   - 意象频率硬限制 (ImageFrequencyLimiter)
 *   - 场景轮换系统 (SceneRotationSystem)
 *   - coverQuote 相似度检测 (QuoteSimilarityDetector)
 *   - 真实感增强 (RealismEnhancer)
 *   - 难度分档优化 (DifficultyAnalyzer v2)
 *   - 标签生活化 (TagOptimizer)
 *
 * 用法:
 *   node scripts/generate-content.js
 *   node scripts/generate-content.js --count 100
 *   node scripts/generate-content.js --validate
 *   node scripts/generate-content.js --stats
 */

const fs = require('fs');
const path = require('path');

// ===== 路径配置 =====
const ROOT = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(ROOT, 'prompts');
const MOCK_DIR = path.join(ROOT, 'mock');
const OUTPUT_FILE = path.join(MOCK_DIR, 'essays.json');
const STATS_FILE = path.join(MOCK_DIR, 'stats.json');

// ===== 工具函数 =====

function loadJSON(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function loadText(fp) {
  return fs.readFileSync(fp, 'utf-8').trim();
}

function saveJSON(fp, data) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

function padSeq(n, len = 3) {
  return String(n).padStart(len, '0');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Levenshtein 距离 */
function levenshtein(a, b) {
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[la][lb];
}

// ===== 分词器 =====

class TokenSplitter {
  static split(sentence) {
    if (!sentence || typeof sentence !== 'string') return [];

    const contractions = [
      [/don't/gi, 'DONT_P'], [/can't/gi, 'CANT_P'], [/won't/gi, 'WONT_P'],
      [/isn't/gi, 'ISNT_P'], [/aren't/gi, 'ARENT_P'], [/wasn't/gi, 'WASNT_P'],
      [/weren't/gi, 'WERENT_P'], [/hasn't/gi, 'HASNT_P'], [/haven't/gi, 'HAVENT_P'],
      [/hadn't/gi, 'HADNT_P'], [/doesn't/gi, 'DOESNT_P'], [/didn't/gi, 'DIDNT_P'],
      [/wouldn't/gi, 'WOULDNT_P'], [/couldn't/gi, 'COULDNT_P'], [/shouldn't/gi, 'SHOULDNT_P'],
      [/mightn't/gi, 'MIGHTNT_P'], [/mustn't/gi, 'MUSTNT_P'], [/needn't/gi, 'NEEDNT_P'],
      [/I'm/gi, 'IM_P'], [/I've/gi, 'IVE_P'], [/I'll/gi, 'ILL_P'], [/I'd/gi, 'ID_P'],
      [/you're/gi, 'YOURE_P'], [/you've/gi, 'YOUVE_P'], [/you'll/gi, 'YOULL_P'], [/you'd/gi, 'YOUD_P'],
      [/he's/gi, 'HES_P'], [/he'll/gi, 'HELL_P'], [/he'd/gi, 'HED_P'],
      [/she's/gi, 'SHES_P'], [/she'll/gi, 'SHELL_P'], [/she'd/gi, 'SHED_P'],
      [/it's/gi, 'ITS_P'], [/it'll/gi, 'ITLL_P'],
      [/we're/gi, 'WERE_P'], [/we've/gi, 'WEVE_P'], [/we'll/gi, 'WELL_P'], [/we'd/gi, 'WED_P'],
      [/they're/gi, 'THEYRE_P'], [/they've/gi, 'THEYVE_P'], [/they'll/gi, 'THEYLL_P'], [/they'd/gi, 'THEYD_P'],
      [/that's/gi, 'THATS_P'], [/what's/gi, 'WHATS_P'], [/let's/gi, 'LETS_P'],
      [/here's/gi, 'HERES_P'], [/there's/gi, 'THERES_P'], [/who's/gi, 'WHOS_P'],
    ];

    let text = sentence;
    contractions.forEach(([re, placeholder]) => { text = text.replace(re, placeholder); });

    text = text.replace(/([.,!?;:()"'—…''—])/g, ' $1 ');

    const restoreMap = {
      'DONT_P': "don't", 'CANT_P': "can't", 'WONT_P': "won't",
      'ISNT_P': "isn't", 'ARENT_P': "aren't", 'WASNT_P': "wasn't",
      'WERENT_P': "weren't", 'HASNT_P': "hasn't", 'HAVENT_P': "haven't",
      'HADNT_P': "hadn't", 'DOESNT_P': "doesn't", 'DIDNT_P': "didn't",
      'WOULDNT_P': "wouldn't", 'COULDNT_P': "couldn't", 'SHOULDNT_P': "shouldn't",
      'MIGHTNT_P': "mightn't", 'MUSTNT_P': "mustn't", 'NEEDNT_P': "needn't",
      'IM_P': "I'm", 'IVE_P': "I've", 'ILL_P': "I'll", 'ID_P': "I'd",
      'YOURE_P': "you're", 'YOUVE_P': "you've", 'YOULL_P': "you'll", 'YOUD_P': "you'd",
      'HES_P': "he's", 'HELL_P': "he'll", 'HED_P': "he'd",
      'SHES_P': "she's", 'SHELL_P': "she'll", 'SHED_P': "she'd",
      'ITS_P': "it's", 'ITLL_P': "it'll",
      'WERE_P': "we're", 'WEVE_P': "we've", 'WELL_P': "we'll", 'WED_P': "we'd",
      'THEYRE_P': "they're", 'THEYVE_P': "they've", 'THEYLL_P': "they'll", 'THEYD_P': "they'd",
      'THATS_P': "that's", 'WHATS_P': "what's", 'LETS_P': "let's",
      'HERES_P': "here's", 'THERES_P': "there's", 'WHOS_P': "who's",
    };

    return text.split(/\s+/).filter(Boolean).map(t => restoreMap[t] || t);
  }

  static wordCount(sentence) {
    return TokenSplitter.split(sentence).filter(t => !/^[.,!?;:()"'—…''—]$/.test(t)).length;
  }
}

// ===== 难度分析器 v2 =====

class DifficultyAnalyzer {
  /**
   * 分档标准:
   *   1 = 极简短句 (小学), 每句 3-8 词, 最高频基础词汇
   *   2 = 简单短句 (初中), 每句 5-12 词
   *   3 = 日常表达 (高中), 每句 8-18 词, 少量中级词汇
   *   4 = 自然叙述 (大学), 每句 10-22 词, 有画面感和细微感受
   *   5 = 文学质感 (高阶), 每句 12-25 词, 精准用词, 但不晦涩
   */

  static level1Words = new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that',
    'the', 'a', 'an', 'is', 'are', 'am', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'can', 'will', 'would',
    'in', 'on', 'at', 'to', 'for', 'with', 'from', 'of', 'by', 'up', 'down', 'out',
    'not', 'no', 'yes', 'so', 'if', 'but', 'and', 'or', 'as', 'all', 'just', 'only',
    'go', 'come', 'get', 'make', 'know', 'think', 'see', 'say', 'look', 'want',
    'good', 'bad', 'big', 'small', 'new', 'old', 'hot', 'cold', 'warm', 'cool',
    'dark', 'light', 'night', 'day', 'time', 'home', 'room', 'door', 'street',
    'walk', 'sit', 'stand', 'open', 'close', 'turn', 'stop', 'start', 'talk',
    'coffee', 'rain', 'bus', 'car', 'train', 'window', 'book', 'phone', 'bag',
    'morning', 'evening', 'today', 'now', 'here', 'there', 'very', 'really',
    'too', 'also', 'still', 'always', 'never', 'often', 'sometimes',
  ]);

  static level3Words = new Set([
    'observe', 'reflect', 'wander', 'glance', 'fade', 'linger', 'drift',
    'murmur', 'rustle', 'shimmer', 'flicker', 'settle', 'stretch', 'gather',
    'scatter', 'absorb', 'pretend', 'appreciate', 'recognize', 'imagine',
    'expect', 'wonder', 'suppose', 'notice', 'realize', 'consider',
    'silence', 'shadow', 'pattern', 'texture', 'atmosphere', 'presence',
    'absence', 'comfort', 'distance', 'surface', 'reflection', 'silhouette',
    'familiar', 'strange', 'ordinary', 'peculiar', 'subtle', 'vague',
    'distant', 'steady', 'occasional', 'brief', 'eventually', 'gradually',
    'somehow', 'anyway', 'instead', 'exactly', 'certainly', 'perhaps',
  ]);

  static level5Words = new Set([
    'melancholy', 'wistful', 'translucent', 'ephemeral', 'luminous',
    'resonance', 'dissonance', 'palpable', 'imperceptible', 'incandescent',
    'solitude', 'contemplation', 'reverie', 'sonder', 'liminal',
    'ineffable', 'evocative', 'poignant', 'understated', 'laconic',
    'patina', 'wane', 'dapple', 'bleed', 'smudge', 'fray',
    'unspool', 'crease', 'fracture', 'dissolve',
  ]);

  static analyze(essay) {
    const allWords = [];
    essay.sentences.forEach(s => {
      TokenSplitter.split(s.en).forEach(t => {
        const w = t.toLowerCase().replace(/[.,!?;:()"']/g, '');
        if (w && w.length > 1) allWords.push(w);
      });
    });

    if (allWords.length === 0) return 3;

    const total = allWords.length;
    const avgPerSentence = total / essay.sentences.length;

    let l3Count = 0, l5Count = 0;
    allWords.forEach(w => {
      if (DifficultyAnalyzer.level5Words.has(w)) l5Count++;
      if (DifficultyAnalyzer.level3Words.has(w)) l3Count++;
    });

    const l3Ratio = l3Count / total;
    const l5Ratio = l5Count / total;

    // 分档逻辑
    if (avgPerSentence <= 8 && l5Ratio < 0.02 && l3Ratio < 0.05) return 1;
    if (avgPerSentence <= 12 && l5Ratio < 0.03 && l3Ratio < 0.08) return 2;
    if (l5Ratio >= 0.06 || (l3Ratio >= 0.15 && avgPerSentence >= 16)) return 5;
    if (l5Ratio >= 0.03 || l3Ratio >= 0.12 || avgPerSentence >= 18) return 4;
    return 3;
  }
}

// ===== 阅读时间计算器 =====

class ReadingTimeCalculator {
  static calculate(essay) {
    let totalWords = 0;
    essay.sentences.forEach(s => { totalWords += TokenSplitter.wordCount(s.en); });
    return Math.max(12, Math.round((totalWords / 120) * 60));
  }
}

// ===== 意象频率限制器 (NEW) =====

class ImageFrequencyLimiter {
  constructor(config) {
    this.perEssayLimit = (config && config.perEssay) || {};
    this.globalLimit = (config && config.global && config.global.maxEssaysPerWord) || {};
  }

  /** 检查单篇文章内的意象频率 */
  checkEssay(essay) {
    const violations = [];
    const text = [
      essay.title || '',
      essay.coverQuote || '',
      ...(essay.sentences || []).map(s => s.en || ''),
    ].join(' ').toLowerCase();

    Object.entries(this.perEssayLimit).forEach(([word, maxCount]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      const count = matches ? matches.length : 0;
      if (count > maxCount) {
        violations.push(`意象"${word}"出现 ${count} 次 (上限 ${maxCount})`);
      }
    });

    return { passed: violations.length === 0, violations };
  }

  /** 检查全局意象频率 */
  checkGlobal(essays) {
    const violations = [];
    Object.entries(this.globalLimit).forEach(([word, maxEssays]) => {
      let essayCount = 0;
      essays.forEach(e => {
        const text = [
          e.title || '', e.coverQuote || '',
          ...(e.sentences || []).map(s => s.en || ''),
        ].join(' ').toLowerCase();
        if (new RegExp(`\\b${word}\\b`, 'gi').test(text)) essayCount++;
      });
      if (essayCount > maxEssays) {
        violations.push(`全局意象"${word}"出现在 ${essayCount} 篇文章中 (上限 ${maxEssays})`);
      }
    });
    return { passed: violations.length === 0, violations };
  }
}

// ===== 场景轮换系统 (NEW) =====

class SceneRotationSystem {
  constructor(minGap = 3) {
    this.minGap = minGap;
    this.history = [];
  }

  /** 检查场景是否可以出现 */
  canUse(scene) {
    if (this.history.length < this.minGap) return true;
    const recent = this.history.slice(-this.minGap);
    return !recent.includes(scene);
  }

  /** 从候选中选出可用的场景 */
  filterAvailable(essays) {
    return essays.filter(e => this.canUse(e.scene));
  }

  /** 记录使用的场景 */
  record(scene) {
    this.history.push(scene);
    if (this.history.length > 20) this.history = this.history.slice(-20);
  }

  /** 获取下次推荐场景列表 */
  suggestNext(allScenes) {
    const recent = this.history.slice(-this.minGap);
    return allScenes.filter(s => !recent.includes(s));
  }
}

// ===== coverQuote 相似度检测器 (NEW) =====

class QuoteSimilarityDetector {
  constructor(config = {}) {
    this.bannedOpeners = (config.bannedOpeners || []).map(o => o.toLowerCase());
    this.minEditDistance = config.minEditDistance || 8;
  }

  /** 检测单个 coverQuote */
  check(quote) {
    if (!quote) return { passed: true, violations: [] };
    const lower = quote.toLowerCase();
    const violations = [];

    this.bannedOpeners.forEach(opener => {
      if (lower.startsWith(opener)) {
        violations.push(`coverQuote 使用了禁用开头: "${opener}"`);
      }
    });

    return { passed: violations.length === 0, violations };
  }

  /** 检测 coverQuote 与已有集合的相似度 */
  checkSimilarity(newQuote, existingQuotes) {
    const violations = [];
    existingQuotes.forEach((eq, i) => {
      const dist = levenshtein(
        newQuote.toLowerCase().replace(/[^a-z0-9 ]/g, ''),
        eq.toLowerCase().replace(/[^a-z0-9 ]/g, '')
      );
      // 短 quote (<30) 的距离阈值降低
      const threshold = newQuote.length < 30 ? 5 : this.minEditDistance;
      if (dist < threshold) {
        violations.push(`coverQuote 与已有过于相似 (编辑距离 ${dist}): "${eq.substring(0, 40)}..."`);
      }
    });
    return { passed: violations.length === 0, violations };
  }
}

// ===== 真实感增强器 (NEW) =====

class RealismEnhancer {
  /**
   * 检测文章是否有足够的"真实生活感"。
   * 评估维度:
   *   - 具体动作数 (动词丰富度)
   *   - 感官细节 (听觉/触觉/嗅觉)
   *   - 具体物品命名
   *   - 抽象词占比
   */
  static check(essay) {
    const allEn = (essay.sentences || []).map(s => s.en || '').join(' ');
    const words = allEn.toLowerCase().split(/\s+/).filter(Boolean);
    const totalWords = words.length;
    const sentenceCount = (essay.sentences || []).length;
    if (totalWords === 0) return { score: 0, issues: ['空文章'] };
    const difficulty = essay.difficulty || 3;

    // 动作动词计数
    const actionVerbs = [
      'walk', 'walked', 'walking', 'open', 'opened', 'close', 'closed',
      'pick', 'picked', 'grab', 'grabbed', 'put', 'pull', 'pulled',
      'push', 'pushed', 'turn', 'turned', 'pour', 'poured', 'stir',
      'stirred', 'tap', 'tapped', 'press', 'pressed', 'hold', 'held',
      'lean', 'leaned', 'reach', 'reached', 'slide', 'slid', 'nod',
      'nodded', 'shake', 'shook', 'step', 'stepped', 'sit', 'sat',
      'stand', 'stood', 'cross', 'crossed', 'wait', 'stop', 'stopped',
      'drink', 'drinking', 'drank', 'eat', 'eating', 'ate', 'cook',
      'cooking', 'wash', 'washing', 'hang', 'hanging', 'hung',
      'carry', 'carrying', 'wipe', 'wiped', 'drop', 'dropped',
      'fold', 'folded', 'tie', 'tied', 'check', 'checking',
      'pay', 'paying', 'buy', 'bought', 'order', 'ordering',
      'fill', 'filled', 'empty', 'emptied', 'sweep', 'sweeping',
      'push', 'pushed', 'brush', 'brushed', 'clip', 'clipped',
      'trace', 'traced', 'cup', 'cupped', 'slide', 'slid',
      'runs', 'run', 'riding', 'rode', 'riding', 'go', 'went',
      'come', 'came', 'leave', 'left', 'bring', 'brought',
    ];
    const actionCount = words.filter(w => actionVerbs.includes(w)).length;

    // 感官词
    const sensoryWords = [
      'smell', 'smelled', 'scent', 'sound', 'sounded', 'noise', 'warm',
      'warmth', 'cool', 'cold', 'hot', 'soft', 'hard', 'rough', 'smooth',
      'wet', 'dry', 'damp', 'bright', 'dim', 'dark', 'loud', 'faint',
      'hum', 'humming', 'buzz', 'buzzing', 'echo', 'echoed', 'taste',
      'tasted', 'bitter', 'sweet', 'salty', 'sour', 'fresh', 'stale',
      'creaks', 'creak', 'creaked', 'drips', 'drip', 'dripping', 'drumming',
      'tick', 'ticks', 'vibrates', 'vibrating', 'murmur', 'murmuring',
    ];
    const sensoryCount = words.filter(w => sensoryWords.includes(w)).length;

    // 具体物品
    const concreteObjects = [
      'cup', 'mug', 'glass', 'bottle', 'bag', 'phone', 'key', 'keys',
      'book', 'shoe', 'shoes', 'coat', 'jacket', 'umbrella', 'newspaper',
      'ticket', 'card', 'money', 'coin', 'pen', 'paper', 'notebook',
      'lamp', 'light', 'candle', 'chair', 'table', 'desk', 'bed',
      'pillow', 'blanket', 'curtain', 'fridge', 'kettle', 'pot', 'pan',
      'rice', 'noodle', 'egg', 'bread', 'milk', 'tea', 'coffee', 'water',
      'bicycle', 'bus', 'train', 'car', 'bike', 'scooter', 'subway',
      'sign', 'poster', 'clock', 'watch', 'mirror', 'window', 'door',
      'elevator', 'stair', 'floor', 'ceiling', 'wall', 'plant', 'flower',
      'tree', 'leaf', 'bench', 'railing', 'handle', 'button', 'switch',
      'basket', 'slippers', 'sweater', 'shirt', 'sock', 'socks',
      'mug', 'pitcher', 'tray', 'counter', 'shelf', 'spine', 'spines',
      'crate', 'shutter', 'shutters', 'vending', 'machine', 'can', 'bun',
    ];
    const objectCount = words.filter(w => concreteObjects.includes(w)).length;

    // 抽象哲学词 (越少越好)
    const abstractWords = [
      'meaning', 'purpose', 'life', 'death', 'time', 'existence',
      'truth', 'reality', 'dream', 'dreams', 'thought', 'thoughts',
      'thinking', 'feeling', 'feelings', 'emotion', 'mind', 'heart',
      'love', 'hate', 'fear', 'hope', 'peace', 'happiness', 'sadness',
      'loneliness', 'belonging', 'identity', 'change', 'growing',
      'becoming', 'finding', 'losing', 'letting go', 'moving on',
      'forgiveness', 'acceptance', 'understanding', 'realization',
    ];
    const abstractCount = words.filter(w => abstractWords.includes(w)).length;

    // 根据难度调整评分基准
    // 难度1 短句文章自然词少，降低期望
    const diffMultiplier = difficulty === 1 ? 2.5 : difficulty === 2 ? 1.8 : difficulty === 5 ? 0.8 : 1;

    const actionScore = Math.min(3, (actionCount / Math.max(1, sentenceCount)) * diffMultiplier * 1.5);
    const sensoryScore_ = Math.min(2, (sensoryCount / Math.max(1, sentenceCount)) * diffMultiplier * 2);
    const objectScore = Math.min(3, (objectCount / Math.max(1, sentenceCount)) * diffMultiplier);
    const abstractPenalty = Math.min(3, (abstractCount / Math.max(1, sentenceCount)) / diffMultiplier);

    const score = Math.round((actionScore + sensoryScore_ + objectScore - abstractPenalty) * 10) / 10;
    const issues = [];

    if (score < 1.5) issues.push('动作描写或感官细节可加强');
    if (abstractPenalty > 1.5) issues.push('抽象词汇偏多');

    return { score, issues, details: { actionScore, sensoryScore: sensoryScore_, objectScore, abstractPenalty } };
  }
}

// ===== 标签优化器 (NEW) =====

class TagOptimizer {
  /**
   * 生成更生活化的标签。
   * 禁止抽象大词，使用具体事物和场景。
   */
  static optimize(essay) {
    const raw = essay.tags || [];
    const optimized = new Set();

    // 场景映射标签
    const sceneTags = {
      convenience_store: ['便利店', '深夜食物', '热饮'],
      subway: ['地铁', '通勤', '车厢'],
      rainy_window: ['下雨', '车窗', '水雾'],
      coffee_shop: ['咖啡店', '拿铁', '窗边'],
      night_walk: ['散步', '街道', '路灯'],
      after_work: ['下班', '黄昏', '通勤路'],
      night_room: ['房间', '台灯', '深夜'],
      late_bus: ['公交', '末班车', '夜路'],
      kitchen_midnight: ['厨房', '冰箱', '深夜'],
      balcony: ['阳台', '城市夜景', '晾衣服'],
      bookstore: ['书店', '书架', '纸书'],
      park_bench: ['公园', '长椅', '树荫'],
    };

    // 情绪映射标签
    const moodTags = {
      calm: ['平静', '安静时刻'],
      wistful: ['回忆', '旧时光'],
      tired: ['疲惫', '下班后'],
      cozy: ['舒适', '慢下来'],
      lonely_gentle: ['独处', '一个人的时间'],
      curious: ['观察', '路人'],
      rainy_mood: ['雨天', '听雨'],
    };

    // 添加场景标签
    const st = sceneTags[essay.scene] || [];
    st.forEach(t => optimized.add(t));

    // 添加情绪标签
    const mt = moodTags[essay.mood] || [];
    mt.forEach(t => optimized.add(t));

    // 从原始标签中保留好的具体词
    const goodConcrete = ['coffee', 'rain', 'window', 'book', 'night', 'morning',
      'evening', 'afternoon', 'sunday', 'monday', 'walking', 'bus', 'train',
      'street', 'home', 'water', 'tea', 'milk', 'rice', 'noodle', 'bread',
      'music', 'cat', 'dog', 'plant', 'flower', 'tree', 'sky', 'cloud',
      'wind', 'snow', 'umbrella', 'light', 'candle', 'blanket', 'pillow',
    ];
    raw.forEach(t => {
      if (goodConcrete.includes(t.toLowerCase())) optimized.add(t);
    });

    // 最多 5 个
    const result = [...optimized].slice(0, 5);
    return result;
  }
}

// ===== 内容校验器 v2 =====

class ContentValidator {
  constructor(configs) {
    this.blacklist = configs.blacklist || {};
    this.moods = configs.moods || {};
    this.imageLimiter = new ImageFrequencyLimiter(
      (configs.blacklist && configs.blacklist.imageFrequencyLimit) || {}
    );
    this.quoteDetector = new QuoteSimilarityDetector(
      (configs.blacklist && configs.blacklist.coverQuoteSimilarity) || {}
    );
    this.errors = [];
    this.warnings = [];
  }

  validate(essay, existingEssays = []) {
    this.errors = [];
    this.warnings = [];

    this._checkRequiredFields(essay);
    this._checkIdUnique(essay, existingEssays);
    this._checkTitle(essay, existingEssays);
    this._checkCoverQuote(essay, existingEssays);
    this._checkSentences(essay);
    this._checkBlacklist(essay);
    this._checkImageFrequency(essay);
    this._checkQuoteSimilarity(essay, existingEssays);
    this._checkRealism(essay);
    this._checkMoodSceneMatch(essay);

    return { valid: this.errors.length === 0, errors: [...this.errors], warnings: [...this.warnings] };
  }

  _checkRequiredFields(essay) {
    ['title', 'coverQuote', 'mood', 'scene', 'sentences'].forEach(f => {
      if (!essay[f]) this.errors.push(`缺少必填字段: ${f}`);
    });
    if (essay.sentences && essay.sentences.length < 4) this.errors.push('sentences 至少需要 4 句');
    if (essay.sentences && essay.sentences.length > 10) this.errors.push('sentences 最多 10 句');
    if (essay.difficulty && (essay.difficulty < 1 || essay.difficulty > 5)) {
      this.errors.push('difficulty 必须在 1-5 之间');
    }
  }

  _checkIdUnique(essay, existing) {
    const dup = existing.find(e => e.id === essay.id && e !== essay);
    if (dup) this.errors.push(`ID 重复: ${essay.id}`);
  }

  _checkTitle(essay, existing) {
    if (!essay.title) return;
    if (essay.title.length > 40) this.errors.push(`标题过长: ${essay.title}`);
    const dup = existing.find(e => e !== essay && e.title === essay.title);
    if (dup) this.errors.push(`标题重复: "${essay.title}"`);
  }

  _checkCoverQuote(essay, existing) {
    if (!essay.coverQuote) return;

    // 长度检查 (放宽到 120 字符，文学性 coverQuote 需要足够空间)
    if (essay.coverQuote.length > 120) {
      this.warnings.push(`coverQuote 过长 (${essay.coverQuote.length} > 120)`);
    }

    // 去重
    const dup = existing.find(e => e !== essay && e.coverQuote === essay.coverQuote);
    if (dup) this.errors.push(`coverQuote 重复 (与 ${dup.id})`);

    // 禁用开头
    const qc = this.quoteDetector.check(essay.coverQuote);
    qc.violations.forEach(v => this.errors.push(v));
  }

  _checkSentences(essay) {
    if (!essay.sentences) return;
    essay.sentences.forEach((s, i) => {
      if (!s.en) this.errors.push(`sentences[${i}] 缺少 en`);
      if (!s.zh) this.errors.push(`sentences[${i}] 缺少 zh`);
      if (!Array.isArray(s.tokens) || s.tokens.length === 0) {
        this.errors.push(`sentences[${i}] tokens 缺失`);
      } else {
        const expected = TokenSplitter.split(s.en);
        if (s.tokens.length !== expected.length) {
          this.warnings.push(`sentences[${i}] tokens 数量不匹配: 期望 ${expected.length}, 实际 ${s.tokens.length}`);
        }
      }
    });
  }

  _checkBlacklist(essay) {
    const allText = [
      essay.title || '', essay.coverQuote || '',
      ...(essay.sentences || []).map(s => s.en || ''),
    ].join(' ').toLowerCase();

    (this.blacklist.bannedPhrases || []).forEach(phrase => {
      if (allText.includes(phrase.toLowerCase())) {
        this.errors.push(`包含禁止短语: "${phrase}"`);
      }
    });

    (this.blacklist.bannedWords || []).forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(allText)) {
        this.errors.push(`包含禁止词汇: "${word}"`);
      }
    });

    (this.blacklist.bannedPatterns || []).forEach(pattern => {
      try {
        if (new RegExp(pattern, 'i').test(allText)) {
          this.warnings.push(`匹配禁止模式: ${pattern}`);
        }
      } catch (_) {}
    });
  }

  _checkImageFrequency(essay) {
    const result = this.imageLimiter.checkEssay(essay);
    result.violations.forEach(v => this.errors.push(v));
  }

  _checkQuoteSimilarity(essay, existing) {
    const quotes = existing
      .filter(e => e !== essay && e.coverQuote)
      .map(e => e.coverQuote);
    const result = this.quoteDetector.checkSimilarity(essay.coverQuote || '', quotes);
    result.violations.forEach(v => this.warnings.push(v));
  }

  _checkRealism(essay) {
    const result = RealismEnhancer.check(essay);
    if (result.score < 0.5) this.warnings.push(`真实感评分过低 (${result.score}), 问题: ${result.issues.join(', ')}`);
  }

  _checkMoodSceneMatch(essay) {
    const weights = (this.moods.moodToSceneWeights) || {};
    const allowed = weights[essay.mood];
    if (allowed && !allowed.includes(essay.scene)) {
      this.warnings.push(`mood "${essay.mood}" 与 scene "${essay.scene}" 不在推荐组合中`);
    }
  }
}

// ===== 统计报告器 v2 =====

class StatsReporter {
  static generate(essays) {
    const stats = {
      total: essays.length,
      generatedAt: new Date().toISOString(),
      byMood: {},
      byScene: {},
      byDifficulty: {},
      avgReadingTime: 0,
      avgSentencesPerEssay: 0,
      avgWordsPerSentence: 0,
      totalWords: 0,
      realismScores: [],
      avgRealismScore: 0,
    };

    let totalReadingTime = 0, totalSentences = 0, totalWords = 0;
    let totalSentenceCount = 0;

    essays.forEach(e => {
      stats.byMood[e.mood] = (stats.byMood[e.mood] || 0) + 1;
      stats.byScene[e.scene] = (stats.byScene[e.scene] || 0) + 1;
      stats.byDifficulty[e.difficulty || 3] = (stats.byDifficulty[e.difficulty || 3] || 0) + 1;
      totalReadingTime += e.readingTime || 0;
      totalSentences += (e.sentences || []).length;
      (e.sentences || []).forEach(s => {
        totalWords += TokenSplitter.wordCount(s.en || '');
        totalSentenceCount++;
      });
      const realism = RealismEnhancer.check(e);
      stats.realismScores.push(realism.score);
    });

    stats.avgReadingTime = essays.length > 0 ? Math.round(totalReadingTime / essays.length) : 0;
    stats.avgSentencesPerEssay = essays.length > 0 ? Math.round(totalSentences / essays.length) : 0;
    stats.avgWordsPerSentence = totalSentenceCount > 0 ? Math.round((totalWords / totalSentenceCount) * 10) / 10 : 0;
    stats.totalWords = totalWords;
    stats.avgRealismScore = essays.length > 0
      ? Math.round(stats.realismScores.reduce((a, b) => a + b, 0) / essays.length * 10) / 10
      : 0;

    return stats;
  }

  static print(stats) {
    const boxW = 44;
    const title = 'Midnight English · 生成统计报告 v2';
    const pad = Math.max(0, Math.floor((boxW - title.length) / 2));

    console.log(`\n${'═'.repeat(boxW)}`);
    console.log(`${' '.repeat(pad)}${title}`);
    console.log(`${'═'.repeat(boxW)}\n`);

    console.log(`  生成时间: ${stats.generatedAt}`);
    console.log(`  文章总数: ${stats.total}\n`);

    console.log('  ── 按情绪分布 ──');
    const moodNames = { calm: '平静', wistful: '淡淡怀念', tired: '疲惫满足',
      cozy: '舒适安心', lonely_gentle: '温和孤独', curious: '好奇观察', rainy_mood: '雨天情绪' };
    Object.entries(stats.byMood).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
      console.log(`  ${(moodNames[m] || m).padEnd(12)} ${String(c).padStart(2)}  ${'█'.repeat(c)}`);
    });

    console.log('\n  ── 按场景分布 ──');
    Object.entries(stats.byScene).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
      console.log(`  ${s.replace(/_/g, ' ').padEnd(22)} ${String(c).padStart(2)}  ${'█'.repeat(c)}`);
    });

    console.log('\n  ── 按难度分布 ──');
    const diffLabels = ['', '1 极简短句', '2 简单短句', '3 日常表达', '4 自然叙述', '5 文学质感'];
    for (let i = 1; i <= 5; i++) {
      const c = stats.byDifficulty[i] || 0;
      console.log(`  ${diffLabels[i].padEnd(16)} ${String(c).padStart(2)}  ${'█'.repeat(c)}`);
    }

    console.log('\n  ── 阅读指标 ──');
    console.log(`  平均阅读时间:     ${stats.avgReadingTime} 秒/篇`);
    console.log(`  平均句子数:       ${stats.avgSentencesPerEssay} 句/篇`);
    console.log(`  平均句长:         ${stats.avgWordsPerSentence} 词/句`);
    console.log(`  总词汇量:         ${stats.totalWords} 词`);
    console.log(`  平均真实感评分:   ${stats.avgRealismScore} / 5`);

    // 场景轮换统计
    const scenes = stats.byScene;
    const sceneCount = Object.keys(scenes).length;
    console.log(`  场景覆盖率:       ${sceneCount} / 12 个场景`);

    console.log('');
  }
}

// ===== 内置内容池 v2 =====

/**
 * v2 改进:
 *   - 更多具体动作 (verbs of motion)
 *   - 更多感官细节 (smell, sound, touch)
 *   - 更多具体物品命名
 *   - 更少抽象反思
 *   - 难度 1-5 合理分布
 *   - 标签生活化
 */
class BuiltinContentPool {
  static essays = [
    // ===== 难度 1: 极简短句 =====
    {
      title: '一杯热水',
      coverQuote: 'I pour hot water into a cup. That is all.',
      mood: 'calm',
      scene: 'kitchen_midnight',
      difficulty: 1,
      tags: ['水', '杯子', '厨房', '深夜'],
      sentences: [
        { en: 'I wake up at 2am.', zh: '我凌晨两点醒了。', tokens: [] },
        { en: 'The room is dark and quiet.', zh: '房间又黑又安静。', tokens: [] },
        { en: 'I go to the kitchen. The floor is cold.', zh: '我去厨房。地板很凉。', tokens: [] },
        { en: 'I pour hot water into a cup. That is all.', zh: '我倒了一杯热水。就这样。', tokens: [] },
        { en: 'I hold the cup with both hands. It is warm.', zh: '我双手捧着杯子。很暖。', tokens: [] },
      ],
    },
    {
      title: '便利店门口',
      coverQuote: 'I stand outside the store and drink my tea. No one talks to me.',
      mood: 'tired',
      scene: 'convenience_store',
      difficulty: 1,
      tags: ['便利店', '茶', '晚上', '站着'],
      sentences: [
        { en: 'I buy a bottle of tea from the store.', zh: '我在便利店买了一瓶茶。', tokens: [] },
        { en: 'It is warm in my hand.', zh: '在我手里暖暖的。', tokens: [] },
        { en: 'I stand outside the store and drink my tea.', zh: '我站在店外面喝茶。', tokens: [] },
        { en: 'No one talks to me. I like it.', zh: '没人跟我说话。我喜欢这样。', tokens: [] },
        { en: 'The street is still and the air is cool.', zh: '街上静静的，空气很凉。', tokens: [] },
      ],
    },
    {
      title: '末班车里',
      coverQuote: 'Four people on the last bus. Each in their own world.',
      mood: 'tired',
      scene: 'late_bus',
      difficulty: 1,
      tags: ['公交', '末班车', '晚上', '空车'],
      sentences: [
        { en: 'I get on the last bus at 11pm.', zh: '我晚上十一点上了末班车。', tokens: [] },
        { en: 'There are maybe four people on the bus.', zh: '车上大概就四个人。', tokens: [] },
        { en: 'Just me and three other people.', zh: '就我和另外三个人。', tokens: [] },
        { en: 'I sit by the window. The glass is cold.', zh: '我坐在窗边。玻璃很冰。', tokens: [] },
        { en: 'I watch the lights go by. One by one.', zh: '我看着灯光一盏一盏地过去。', tokens: [] },
      ],
    },
    {
      title: '在阳台站着',
      coverQuote: 'I stand on the balcony for five minutes. That is enough.',
      mood: 'calm',
      scene: 'balcony',
      difficulty: 1,
      tags: ['阳台', '站着', '夜晚', '空气'],
      sentences: [
        { en: 'I open the balcony door. The air is fresh.', zh: '我打开阳台门。空气很新鲜。', tokens: [] },
        { en: 'I stand on the balcony for five minutes.', zh: '我在阳台上站了五分钟。', tokens: [] },
        { en: 'That is enough. I feel better now.', zh: '够了。我现在感觉好些了。', tokens: [] },
        { en: 'I look at the other buildings. Some lights are on.', zh: '我看着其他的楼。有些灯还亮着。', tokens: [] },
        { en: 'Then I go back inside. The room is warm.', zh: '然后我回到屋子里。房间很暖和。', tokens: [] },
      ],
    },

    // ===== 难度 2: 简单短句 =====
    {
      title: '周日早上的咖啡店',
      coverQuote: 'A Sunday with no plans is a small, quiet thing. I hold it carefully.',
      mood: 'cozy',
      scene: 'coffee_shop',
      difficulty: 2,
      tags: ['咖啡店', '周日', '窗边', '拿铁'],
      sentences: [
        { en: 'The coffee shop opens at 8am on Sundays. I got here at 8:05.', zh: '咖啡店周日八点开门。我八点零五到的。', tokens: [] },
        { en: 'The barista is still wiping down the counter. She smiles but doesn\'t say much.', zh: '咖啡师还在擦台面。她笑了笑，没怎么说话。', tokens: [] },
        { en: 'I take the corner seat by the window. The sun hasn\'t reached it yet.', zh: '我坐了窗边的角落位置。阳光还没照到那儿。', tokens: [] },
        { en: 'A Sunday with no plans is a small, quiet thing. I hold it carefully.', zh: '一个没有计划的周日是一件小小的、安静的东西。我小心地捧着。', tokens: [] },
        { en: 'The coffee is too hot to drink. I wait. I have time.', zh: '咖啡太烫了没法喝。我等。我有时间。', tokens: [] },
        { en: 'Outside, someone walks past with a bag of bread. Sunday routines.', zh: '外面有人提着一袋面包经过。周日日常。', tokens: [] },
      ],
    },
    {
      title: '早班地铁上',
      coverQuote: 'Morning subway faces are the most honest thing you will see all day.',
      mood: 'tired',
      scene: 'subway',
      difficulty: 2,
      tags: ['地铁', '早班', '通勤', '人群'],
      sentences: [
        { en: 'The 7:40 train is packed as always. I find a spot near the door.', zh: '七点四十的车照常很挤。我在门边找到个位置。', tokens: [] },
        { en: 'The woman next to me is doing her makeup. One hand on the rail, one hand with the brush.', zh: '旁边的女生在化妆。一只手扶栏杆，一只手拿刷子。', tokens: [] },
        { en: 'Morning subway faces are the most honest thing you will see all day.', zh: '早班地铁上的脸，是你一天中见过最真实的东西。', tokens: [] },
        { en: 'No one has put on their work face yet. We are all just tired humans in a metal tube.', zh: '还没人戴上工作的面具。我们都只是铁管子里疲惫的人。', tokens: [] },
        { en: 'The train goes into a tunnel. The windows turn into mirrors for six seconds.', zh: '列车进隧道。车窗变成镜子，持续六秒。', tokens: [] },
        { en: 'Then daylight again. People blink and adjust their bags.', zh: '然后又亮了。人们眨眨眼，整理一下包。', tokens: [] },
      ],
    },
    {
      title: '午后的长椅',
      coverQuote: 'Sitting on a park bench alone is underrated. You notice small things.',
      mood: 'slow_life',
      scene: 'park_bench',
      difficulty: 2,
      tags: ['公园', '长椅', '午后', '树荫'],
      sentences: [
        { en: 'I found an empty bench under a sycamore tree. Dappled shade, the good kind.', zh: '我在一棵梧桐树下找到了空长椅。斑驳的树荫，很好的那种。', tokens: [] },
        { en: 'An old man throws breadcrumbs to pigeons. A kid wobbles past on a pink bike.', zh: '一个老人给鸽子丢面包屑。一个小孩骑着粉色小自行车歪歪扭扭地经过。', tokens: [] },
        { en: 'Sitting on a park bench alone is underrated. You notice small things.', zh: '一个人坐长椅这件事被低估了。你会注意到很多小事。', tokens: [] },
        { en: 'The sound of different shoes on gravel. Sneakers scuff. Leather shoes click.', zh: '不同鞋子踩碎石的声音。运动鞋沙沙响。皮鞋嗒嗒嗒。', tokens: [] },
        { en: 'I finish my drink and stay another ten minutes. No reason.', zh: '我喝完饮料又坐了十分钟。没什么原因。', tokens: [] },
      ],
    },

    // ===== 难度 3: 日常表达 =====
    {
      title: '便利店关东煮',
      coverQuote: 'The broth is too salty and the daikon is overcooked. But the warmth from the paper cup is real.',
      mood: 'calm',
      scene: 'convenience_store',
      difficulty: 3,
      tags: ['便利店', '关东煮', '暖手', '深夜食物'],
      sentences: [
        { en: 'The oden pot by the counter bubbles steadily. It has been bubbling since 6pm.', zh: '柜台旁的关东煮锅稳稳地咕嘟着。从下午六点就开始咕嘟了。', tokens: [] },
        { en: 'I slide open the glass lid and pick the daikon and a fish cake. The same two things I always get.', zh: '我推开玻璃盖，拿了萝卜和鱼饼。每次都这两样。', tokens: [] },
        { en: 'The broth is too salty and the daikon is a bit overcooked. But the warmth from the paper cup is real.', zh: '汤太咸了，萝卜也煮过头了。但纸杯传过来的暖意是真的。', tokens: [] },
        { en: 'I lean against the window counter and eat standing up. Outside, a delivery scooter goes past.', zh: '我靠着窗台站着吃。外面一辆外卖电动车开过去。', tokens: [] },
        { en: 'The cashier restocks the rice balls behind me. The fridge door opens and closes.', zh: '店员在我身后补饭团。冰箱门开了又关。', tokens: [] },
        { en: 'I finish the daikon first, then the fish cake. Three minutes. Then I leave.', zh: '我先吃完萝卜，再吃鱼饼。三分钟。然后我走了。', tokens: [] },
      ],
    },
    {
      title: '黄昏的街',
      coverQuote: 'The sky does the same thing every evening. I still look up.',
      mood: 'wistful',
      scene: 'after_work',
      difficulty: 3,
      tags: ['下班', '黄昏', '天空', '走路'],
      sentences: [
        { en: 'Got off work at 6:30. The sky is doing that orange-to-purple thing again.', zh: '六点半下班。天空又在做那个橙色变紫色的事。', tokens: [] },
        { en: 'The sky does the same thing every evening. I still look up every time.', zh: '天空每天晚上做同样的事。我每次还是会抬头看。', tokens: [] },
        { en: 'The bakery on the corner is closing. The owner wipes down the empty trays and stacks them.', zh: '拐角的面包店在收摊。老板擦着空烤盘，一个个叠起来。', tokens: [] },
        { en: 'I buy the last red bean bun. It is slightly cold but still soft.', zh: '我买了最后一个红豆包。有点凉了，但还是软的。', tokens: [] },
        { en: 'I eat it while walking. Crumbs fall on my shirt. I brush them off.', zh: '我边走边吃。碎屑掉在衬衫上。我拍了拍。', tokens: [] },
        { en: 'The street is quieter than it was an hour ago. The rush is over.', zh: '街道比一小时前安静多了。高峰期已经过去了。', tokens: [] },
      ],
    },
    {
      title: '冰箱灯下',
      coverQuote: 'The fridge light at midnight shows you exactly who you are. Leftover rice, half a lemon, three eggs.',
      mood: 'lonely_gentle',
      scene: 'kitchen_midnight',
      difficulty: 3,
      tags: ['深夜', '冰箱', '厨房', '独处'],
      sentences: [
        { en: 'I open the fridge at 12:30am. The light spills onto the dark kitchen floor.', zh: '半夜十二点半打开冰箱。光洒在黑暗的厨房地板上。', tokens: [] },
        { en: 'Leftover rice, half a lemon wrapped in plastic, three eggs in the door shelf.', zh: '剩饭、半个用保鲜膜包着的柠檬、门架上三个鸡蛋。', tokens: [] },
        { en: 'The fridge light at midnight shows you exactly who you are.', zh: '午夜冰箱灯如实地照出你是谁。', tokens: [] },
        { en: 'I pour a glass of cold water from the pitcher and lean against the counter.', zh: '我从凉水壶里倒了一杯冷水，靠在台面上。', tokens: [] },
        { en: 'The fridge hums. The clock on the wall ticks. Somewhere upstairs, a chair scrapes the floor.', zh: '冰箱在嗡鸣。墙上的钟在滴答。楼上某处，椅子刮过地板。', tokens: [] },
        { en: 'I should close the fridge door. I will. In a minute.', zh: '我该关上冰箱门的。会的。再过一分钟。', tokens: [] },
      ],
    },

    // ===== 难度 4: 自然叙述 =====
    {
      title: '凌晨两点的热柠茶',
      coverQuote: 'The hot lemon tea from the convenience store is not great. But at 2am it is exactly what I need.',
      mood: 'tired',
      scene: 'convenience_store',
      difficulty: 4,
      tags: ['便利店', '柠檬茶', '凌晨', '加班后'],
      sentences: [
        { en: 'The automatic door slides open with that two-note chime. The cashier doesn\'t look up.', zh: '自动门滑开，两声提示音。店员没抬头。', tokens: [] },
        { en: 'He has seen too many people like me at this hour. Eyes tired, wallet out, buying one small thing.', zh: '这个点他见过太多像我一样的人。眼神疲惫，掏着钱包，只买一样小东西。', tokens: [] },
        { en: 'I grab a hot lemon tea from the warmer. The bottle is almost too hot to hold.', zh: '我从热饮柜拿了一瓶热柠茶。瓶子烫得几乎拿不住。', tokens: [] },
        { en: 'The hot lemon tea from the convenience store is not great. But at 2am it is exactly what I need.', zh: '便利店的热柠茶不好喝。但凌晨两点就是刚好。', tokens: [] },
        { en: 'I stand by the window, switching the bottle from hand to hand. The neon sign outside hums.', zh: '我站在窗边，把瓶子在两只手之间倒来倒去。外面的霓虹灯牌在嗡嗡响。', tokens: [] },
        { en: 'A man on a bicycle rides past slowly, no hands on the handlebars. He looks free.', zh: '一个骑自行车的男的慢慢经过，双手放开把手。他看起来好自由。', tokens: [] },
      ],
    },
    {
      title: '雨打在公交车窗上',
      coverQuote: 'Rain on the bus window makes the streetlights bleed into watercolor. Red and yellow, no sharp edges.',
      mood: 'rainy_mood',
      scene: 'rainy_window',
      difficulty: 4,
      tags: ['下雨', '车窗', '水彩', '公交'],
      sentences: [
        { en: 'The bus is half empty, which never happens at this hour. I take a seat in the middle.', zh: '公交车半空，这个点从不这样。我在中间找了个位子。', tokens: [] },
        { en: 'Rain starts hitting the roof, soft taps at first, then a steady drumming.', zh: '雨开始敲车顶，先是轻轻的嗒嗒声，然后变成持续的鼓点。', tokens: [] },
        { en: 'Rain on the bus window makes the streetlights bleed into watercolor. Red and yellow, no sharp edges.', zh: '雨打在车窗上，路灯晕成水彩。红色和黄色，没有棱角。', tokens: [] },
        { en: 'I draw a smiley face on the fogged glass with my fingertip. It drips and disappears in ten seconds.', zh: '我用指尖在雾窗上画了个笑脸。它淌下来，十秒就消失了。', tokens: [] },
        { en: 'At the third stop, a woman gets on with a folded wet umbrella. She shakes it three times before sitting.', zh: '第三站上来一个女人，拿着一把收好的湿伞。她甩了三次才坐下。', tokens: [] },
        { en: 'I am two stops past mine. I think I will stay on a little longer. The rain can wait.', zh: '我已经坐过了两站。我想再多坐一会儿。雨可以等。', tokens: [] },
      ],
    },
    {
      title: '末班地铁的乘客',
      coverQuote: 'On the last train, no one scrolls through their phone the same way. Slower. Less pretending.',
      mood: 'tired',
      scene: 'subway',
      difficulty: 4,
      tags: ['地铁', '末班车', '陌生人', '夜间通勤'],
      sentences: [
        { en: 'The last train pulls in at 11:47. It is never empty but it is never loud either.', zh: '末班车十一点四十七进站。永远不会空，但也永远不会吵。', tokens: [] },
        { en: 'A man in a gray suit loosens his tie with one finger. A woman slides her heels off under the seat.', zh: '一个穿灰色西装的男的用一根手指松开领带。一个女人在座位下脱掉高跟鞋。', tokens: [] },
        { en: 'On the last train, no one scrolls through their phone the same way. Slower. Less pretending.', zh: '末班车上，大家滑手机的样子都不一样了。更慢。更不装了。', tokens: [] },
        { en: 'The teenager across from me is asleep with his mouth slightly open. His headphones are slipping off.', zh: '对面的少年张着嘴睡着了。耳机快滑下来了。', tokens: [] },
        { en: 'The recorded voice announces each station. Door opens. Door closes. Fewer people each time.', zh: '录音广播报着每一站。门开了。门关了。每次人都少一些。', tokens: [] },
        { en: 'At my stop, I look back at the train before the doors close. A capsule of tired strangers, heading home.', zh: '到站时，我在门关之前回头看了一眼。一车厢疲惫的陌生人，各回各家。', tokens: [] },
      ],
    },
    {
      title: '夜里一点的小巷',
      coverQuote: 'Some streets are better at 1am. No traffic, no crowds, just the hum of a vending machine.',
      mood: 'lonely_gentle',
      scene: 'night_walk',
      difficulty: 4,
      tags: ['散步', '小巷', '深夜', '安静'],
      sentences: [
        { en: 'I take the long way home, through the alley behind the old market. The metal shutters are all pulled down.', zh: '我绕远路回家，穿过老市场后面的巷子。铁闸门全都拉下来了。', tokens: [] },
        { en: 'The alley looks completely different at night. The fruit crates are gone. The shouting is gone.', zh: '小巷夜里看起来完全不一样。水果筐没了。叫卖声没了。', tokens: [] },
        { en: 'Some streets are better at 1am. No traffic, no crowds, just the hum of a vending machine.', zh: '有些街道在凌晨一点更好。没有车，没有人，只有自动贩卖机的嗡鸣。', tokens: [] },
        { en: 'A bicycle leans against a wall with no lock. Someone\'s laundry drips from a balcony above.', zh: '一辆自行车没锁靠在墙上。楼上阳台晾着谁的衣服往下滴水。', tokens: [] },
        { en: 'I stop at the vending machine and buy a can of cold milk tea. The can clunks down into the tray.', zh: '我在自动贩卖机前停下来买了一罐冰奶茶。罐子咣当掉进托盘。', tokens: [] },
        { en: 'I don\'t know the people who live here. But I know this street. That is a strange and good thing.', zh: '我不认识住在这里的人。但我认识这条街。这是一件又奇怪又好的事。', tokens: [] },
      ],
    },
    {
      title: '书店地下室',
      coverQuote: 'I pick up a book I have opened five times before. Never bought it, never will.',
      mood: 'calm',
      scene: 'bookstore',
      difficulty: 4,
      tags: ['书店', '书架', '纸', '地下'],
      sentences: [
        { en: 'The bookstore is in the basement of an old building on Huaihai Road. You have to know the door is there.', zh: '书店在淮海路一栋老楼的地下室。你得知道那个门在那才行。', tokens: [] },
        { en: 'The stairs creak under my shoes. At the bottom, the smell hits first: old paper, new paper, wood shelves.', zh: '楼梯在我鞋下嘎吱响。走到底，味道先扑面而来：旧书、新书、木头书架。', tokens: [] },
        { en: 'I pick up a book I have opened five times before. The same page, the same paragraph. Never bought it, never will.', zh: '我拿起一本翻过五遍的书。同一页，同一段。从来没买过，以后也不会。', tokens: [] },
        { en: 'The owner is reading behind the counter. He glances up, recognizes me, goes back to his page.', zh: '老板在柜台后面看书。他抬头看了一眼，认出我了，继续看他的书。', tokens: [] },
        { en: 'I run my fingers along the spines. Some are cracked, some are smooth. Each one has been held by someone.', zh: '我用手指划过书脊。有的开裂了，有的还很光滑。每一本都被人拿过。', tokens: [] },
        { en: 'I leave without buying anything. The stairs creak again on the way up. The smell stays on my sweater.', zh: '我什么都没买就走了。上楼时楼梯又嘎吱响。毛衣上还留着那个味道。', tokens: [] },
      ],
    },
    {
      title: '晾衣夜的阳台',
      coverQuote: 'Hanging wet laundry at 11pm is a small bet on tomorrow.',
      mood: 'calm',
      scene: 'balcony',
      difficulty: 4,
      tags: ['阳台', '晾衣服', '深夜', '独居'],
      sentences: [
        { en: 'I do laundry at 11pm because that is when the washing machine finishes its two-hour cycle.', zh: '我晚上十一点晾衣服，因为洗衣机两小时的程序刚结束。', tokens: [] },
        { en: 'The clothes are warm from the dryer. I carry the basket to the balcony, stepping over a pair of slippers.', zh: '衣服从烘干机里拿出来还是热的。我提着衣篮走向阳台，跨过一双拖鞋。', tokens: [] },
        { en: 'Hanging wet laundry at 11pm is a small bet on tomorrow. The clothes will be dry by morning.', zh: '深夜晾湿衣服是给明天投的一个小赌注。衣服早上就会干。', tokens: [] },
        { en: 'The white shirt sways in the night breeze. It looks like a ghost that decided to stay for breakfast.', zh: '白衬衫在夜风里轻轻摆。看起来像一个决定留下来吃早餐的鬼。', tokens: [] },
        { en: 'I clip each sock carefully. Losing one sock to the wind at midnight feels like a life metaphor I do not need.', zh: '我仔细夹好每一只袜子。半夜被风吹掉一只袜子，这种生活隐喻我不需要。', tokens: [] },
        { en: 'I look out at the other apartment buildings. Four lit windows. Four other people awake at this hour.', zh: '我望了望其他楼。四扇亮着灯的窗户。四个在这个点还醒着的人。', tokens: [] },
      ],
    },

    // ===== 难度 5: 文学质感 =====
    {
      title: '咖啡店里的拿铁拉花',
      coverQuote: 'The latte art is already dissolving. A lopsided heart fading into beige. I watch it disappear.',
      mood: 'calm',
      scene: 'coffee_shop',
      difficulty: 5,
      tags: ['拿铁', '奶泡', '窗边', '午后光线'],
      sentences: [
        { en: 'The latte art is already half dissolved by the time I notice it. A lopsided heart bleeding into beige foam.', zh: '拿铁拉花等我注意的时候已经散了一半。一颗歪斜的心正在奶泡里融成米色。', tokens: [] },
        { en: 'I cup my hands around the ceramic mug. The heat seeps into my palms first, then my fingers, then nowhere else.', zh: '我双手捧着陶瓷杯。热度先是渗进掌心，然后是手指，然后就哪也不去了。', tokens: [] },
        { en: 'The couple at the next table is having one of those quiet arguments you can only have in public. The woman stirs her drink without drinking.', zh: '隔壁桌的情侣在吵那种只能在公共场合吵的架。女的一直搅着饮料，一口没喝。', tokens: [] },
        { en: 'I slide my headphones on but do not play anything. The padded silence and the coffee shop murmur layer over each other.', zh: '我戴上耳机但什么都不播。海绵的隔音和店里的低语声叠在一起。', tokens: [] },
        { en: 'The afternoon light hits the table at a long angle, the kind you only get in October. It makes the sugar jar glow.', zh: '午后的光线拉成一个长角照在桌上，那种只有十月才有的角度。糖罐在发光。', tokens: [] },
        { en: 'I stay until the foam is completely gone and the coffee is cold. Then I pay and leave through the side door.', zh: '我一直坐到奶泡完全消失，咖啡变冷。然后买单，从侧门走了。', tokens: [] },
      ],
    },
    {
      title: '失眠的几点观察',
      coverQuote: 'The ceiling at 3am is a blank page. I have memorized the single crack that runs from the light fixture to the wall.',
      mood: 'wistful',
      scene: 'night_room',
      difficulty: 5,
      tags: ['失眠', '天花板', '凌晨', '房间'],
      sentences: [
        { en: 'The ceiling at 3am is a blank page I have read too many times. The crack running from the light fixture to the south wall is my favorite sentence.', zh: '凌晨三点的天花板是一张我读过太多次的空白纸。从灯座裂到南墙的那条缝是我最喜欢的一句。', tokens: [] },
        { en: 'I think about the email I forgot to send. The plant on the windowsill I forgot to water. The friend I forgot to call back. At 3am, every small failure takes its turn.', zh: '我想起忘了发的邮件，窗台上忘了浇的植物，忘了回电话的朋友。凌晨三点，每个小疏漏都轮番登场。', tokens: [] },
        { en: 'The fridge compressor kicks on in the kitchen. A low mechanical hum that vibrates through the wall. It has been doing this for three years.', zh: '厨房里冰箱压缩机启动了。低沉的机械嗡鸣透过墙壁传过来。它已经这样响了三年了。', tokens: [] },
        { en: 'I do not fight it anymore. If sleep wants to come, it knows my address. If not, I have memorized the crack in the ceiling.', zh: '我不再挣扎了。如果睡眠想来，它知道我的地址。如果不想，我已经背下了天花板的裂缝。', tokens: [] },
        { en: 'At 4:16am, a car passes outside. The headlights sweep across the ceiling in a slow arc. Then darkness again. Then the crack again.', zh: '凌晨四点十六分，外面一辆车经过。车灯在天花板上扫出一个缓慢的弧线。然后又暗了。然后又是那条裂缝。', tokens: [] },
      ],
    },
    {
      title: '台灯下的桌面',
      coverQuote: 'The desk lamp carves out a small yellow world. Just large enough for one person and a cup of tea.',
      mood: 'calm',
      scene: 'night_room',
      difficulty: 5,
      tags: ['台灯', '书桌', '深夜', '安静'],
      sentences: [
        { en: 'The desk lamp is the only light on in the apartment. It carves a yellow circle out of the darkness, about the size of a dinner plate expanded.', zh: '台灯是整间公寓里唯一的光源。它在黑暗中刻出一个黄色的圆，大小约等于一个被撑开的餐盘。', tokens: [] },
        { en: 'Inside the circle: a half-empty mug, three pens (two of them dry), a phone face-down, and a book I have been reading since March.', zh: '圆圈里有：一个半空的杯子，三支笔（两支没水了），一部屏幕朝下的手机，和一本我从三月读到现在的书。', tokens: [] },
        { en: 'Outside the circle, the rest of the room could be anything. A storage unit. A waiting room. The surface of the moon.', zh: '圆圈之外，房间的其他部分可以是什么都行。一个仓库。一个候车室。月球表面。', tokens: [] },
        { en: 'I reach for the mug. The tea is cold. I drink it anyway. Cold tea at midnight tastes like yesterday\'s decisions.', zh: '我伸手去拿杯子。茶是冷的。我还是喝了。午夜的冷茶喝起来像昨天的决定。', tokens: [] },
        { en: 'Through the window, I can see three other lit rectangles in the building across. Three other small yellow worlds. Three other people not sleeping.', zh: '透过窗户，能看到对面楼里三扇亮着灯的矩形。另外三个小小的黄色世界。另外三个没睡的人。', tokens: [] },
      ],
    },
    {
      title: '雨天的咖啡馆',
      coverQuote: 'Rain outside, coffee inside. The arithmetic of comfort is simple.',
      mood: 'cozy',
      scene: 'rainy_window',
      difficulty: 5,
      tags: ['下雨', '咖啡店', '窗户', '避雨'],
      sentences: [
        { en: 'The rain started twenty minutes ago and the cafe has gotten quieter with each passing minute. As if the rain is turning down the volume on the world.', zh: '雨下了二十分钟了，咖啡馆随着每一分钟变得更安静。仿佛雨在调低世界的音量。', tokens: [] },
        { en: 'People keep pushing through the door, shaking off umbrellas in the entryway. A small puddle forms on the doormat.', zh: '不断有人推门进来，在门口甩伞。门垫上积了一小摊水。', tokens: [] },
        { en: 'I have the window seat. Rain streaks down the glass, distorting the street outside into a wobbly watercolor of grays and muted reds.', zh: '我坐在窗边。雨水顺着玻璃往下淌，把外面的街扭曲成一幅晃荡的水彩画——灰色和暗红。', tokens: [] },
        { en: 'Rain outside, coffee inside. The arithmetic of comfort is simple. You subtract the wet and add the warm.', zh: '外面下雨，里面有咖啡。舒适的算术很简单。减去潮湿，加上温暖。', tokens: [] },
        { en: 'A woman at the counter orders the same thing she always does. The barista starts making it before she finishes speaking.', zh: '柜台边一个女人点了她每次都点的东西。咖啡师在她说完之前就开始做了。', tokens: [] },
        { en: 'The window fogs up from the warmth inside. Someone has traced a small star on the glass with their fingertip. Now it is dripping.', zh: '窗户因为室内的暖气起雾了。有人用指尖在玻璃上画了一颗小星星。现在正在往下淌。', tokens: [] },
      ],
    },
  ];
}

// ===== 主流程 v2 =====

class ContentGenerator {
  constructor() {
    this.configs = {};
    this.essays = [];
    this.stats = {};
    this.sceneRotator = null;
  }

  loadConfigs() {
    console.log('[配置] 加载配置文件...');
    try {
      this.configs.blacklist = loadJSON(path.join(PROMPTS_DIR, 'blacklist.json'));
      this.configs.moods = loadJSON(path.join(PROMPTS_DIR, 'moods.json'));
      this.configs.themes = loadJSON(path.join(PROMPTS_DIR, 'themes.json'));
      this.configs.schema = loadJSON(path.join(PROMPTS_DIR, 'output-schema.json'));
      console.log('[配置] 加载完成 (4 个文件)\n');
    } catch (err) {
      console.error('[配置] 加载失败:', err.message);
      this.configs.blacklist = { bannedPhrases: [], bannedWords: [], bannedPatterns: [], imageFrequencyLimit: { perEssay: {}, global: { maxEssaysPerWord: {} } }, coverQuoteSimilarity: { bannedOpeners: [], minEditDistance: 8 }, sceneTransition: { minGapBetweenSameScene: 3 } };
      this.configs.moods = { moods: [], moodToSceneWeights: {} };
      this.configs.themes = { primaryThemes: [], secondaryScenes: [] };
      this.configs.schema = {};
    }

    this.sceneRotator = new SceneRotationSystem(
      (this.configs.blacklist.sceneTransition || {}).minGapBetweenSameScene || 3
    );
  }

  loadExisting() {
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const existing = loadJSON(OUTPUT_FILE);
        this.essays = Array.isArray(existing) ? existing : [];
        // 重建场景轮换历史
        this.essays.forEach(e => { if (e.scene) this.sceneRotator.record(e.scene); });
        console.log(`[数据] 加载已有 ${this.essays.length} 篇文章`);
      } catch (err) {
        console.log('[数据] 已有数据损坏，从零开始');
        this.essays = [];
      }
    } else {
      console.log('[数据] 无已有数据，从零开始');
    }
  }

  postProcess(essay) {
    // Token 拆分
    essay.sentences.forEach(s => {
      if (!s.tokens || s.tokens.length === 0) {
        s.tokens = TokenSplitter.split(s.en);
      }
    });

    // 难度评分（如果内容池未预设）
    if (!essay.difficulty) {
      essay.difficulty = DifficultyAnalyzer.analyze(essay);
    }

    // 阅读时间
    if (!essay.readingTime) {
      essay.readingTime = ReadingTimeCalculator.calculate(essay);
    }

    // 标签优化
    essay.tags = TagOptimizer.optimize(essay);

    return essay;
  }

  generateId(scene, seq) {
    return `essay_${scene}_${padSeq(seq)}`;
  }

  async run(options = {}) {
    const count = options.count || 20;
    const validateOnly = options.validate || false;
    const statsOnly = options.stats || false;

    const boxW = 44;
    console.log(`\n${'═'.repeat(boxW)}`);
    console.log('  Midnight English · AI 内容生成系统 v2');
    console.log(`${'═'.repeat(boxW)}\n`);

    this.loadConfigs();

    if (statsOnly) {
      this.loadExisting();
      this.printStats();
      return;
    }

    if (validateOnly) {
      this.loadExisting();
      this.validateAll();
      return;
    }

    this.loadExisting();

    const pool = shuffle(BuiltinContentPool.essays);
    const validator = new ContentValidator(this.configs);
    const imageLimiter = new ImageFrequencyLimiter(
      (this.configs.blacklist && this.configs.blacklist.imageFrequencyLimit) || {}
    );
    const sceneCounter = {};
    const generated = [];

    console.log(`[生成] 目标: ${count} 篇, 内置池: ${pool.length} 篇`);
    console.log(`[场景轮换] 最小间隔: ${this.sceneRotator.minGap} 篇\n`);

    let attempts = 0;
    const maxAttempts = pool.length * 3;

    for (let i = 0; i < Math.min(count, pool.length) && attempts < maxAttempts; i++, attempts++) {
      const raw = JSON.parse(JSON.stringify(pool[attempts % pool.length]));

      // === 场景轮换检查 ===
      if (!this.sceneRotator.canUse(raw.scene)) {
        // 尝试找下一个可用场景
        let found = false;
        for (let j = (attempts + 1) % pool.length; j !== attempts % pool.length; j = (j + 1) % pool.length) {
          const alt = pool[j];
          if (this.sceneRotator.canUse(alt.scene) && !generated.find(g => g._poolIndex === j)) {
            Object.assign(raw, JSON.parse(JSON.stringify(alt)));
            raw._poolIndex = j;
            found = true;
            break;
          }
        }
        if (!found) { attempts++; continue; }
      } else {
        raw._poolIndex = attempts % pool.length;
      }

      // 跳过已使用的
      if (generated.find(g => g._poolIndex === raw._poolIndex)) {
        let found = false;
        for (let j = 0; j < pool.length; j++) {
          if (!generated.find(g => g._poolIndex === j)) {
            Object.assign(raw, JSON.parse(JSON.stringify(pool[j])));
            raw._poolIndex = j;
            found = true;
            break;
          }
        }
        if (!found) continue;
      }

      // === 意象频率检查 ===
      const imgCheck = imageLimiter.checkEssay(raw);
      if (!imgCheck.passed) {
        console.log(`[意象拒绝] ${raw.title}: ${imgCheck.violations.join('; ')}`);
        continue;
      }

      // 分配 ID
      if (!sceneCounter[raw.scene]) sceneCounter[raw.scene] = 0;
      sceneCounter[raw.scene]++;
      raw.id = this.generateId(raw.scene, sceneCounter[raw.scene]);

      // 后处理
      this.postProcess(raw);

      // 校验
      const result = validator.validate(raw, [...this.essays, ...generated]);
      if (!result.valid) {
        console.log(`[拒绝] ${raw.title}: ${result.errors.join('; ')}`);
        continue;
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`  ⚠ ${raw.id}: ${w}`));
      }

      // 真实感评估
      const realism = RealismEnhancer.check(raw);

      generated.push(raw);
      this.sceneRotator.record(raw.scene);
      console.log(`[生成] ${raw.id}  "${raw.title}" | 难度${raw.difficulty} | ${raw.readingTime}s | 真实感${realism.score}`);
    }

    // 合并到总数据
    this.essays.push(...generated);

    // 全局意象频率检查
    console.log(`\n[意象频率] 全局检查...`);
    const globalCheck = imageLimiter.checkGlobal(this.essays);
    if (globalCheck.passed) {
      console.log('  全部通过 ✓');
    } else {
      globalCheck.violations.forEach(v => console.log(`  ⚠ ${v}`));
    }

    // 保存
    this.save();

    // 全局校验
    console.log('\n[校验] 全局校验...');
    this.validateAll();

    // 统计
    this.printStats();
  }

  validateAll() {
    const validator = new ContentValidator(this.configs);
    const imageLimiter = new ImageFrequencyLimiter(
      (this.configs.blacklist && this.configs.blacklist.imageFrequencyLimit) || {}
    );
    let totalErrors = 0;
    let totalWarnings = 0;

    // 意象频率全局检测
    const imgGlobal = imageLimiter.checkGlobal(this.essays);
    imgGlobal.violations.forEach(v => { console.log(`  ⚠ ${v}`); totalWarnings++; });

    // 标题去重
    const titleSet = new Set();
    this.essays.forEach(e => {
      if (titleSet.has(e.title)) {
        console.log(`  ✗ 标题重复: "${e.title}"`);
        totalErrors++;
      }
      titleSet.add(e.title);
    });

    // coverQuote 去重
    const quoteSet = new Set();
    this.essays.forEach(e => {
      if (quoteSet.has(e.coverQuote)) {
        console.log(`  ✗ coverQuote 重复: "${e.coverQuote.substring(0, 30)}..."`);
        totalErrors++;
      }
      quoteSet.add(e.coverQuote);
    });

    // 相似度检测
    const quoteDetector = new QuoteSimilarityDetector(
      (this.configs.blacklist && this.configs.blacklist.coverQuoteSimilarity) || {}
    );
    for (let i = 0; i < this.essays.length; i++) {
      for (let j = i + 1; j < this.essays.length; j++) {
        if (this.essays[i].coverQuote && this.essays[j].coverQuote) {
          const dist = levenshtein(
            this.essays[i].coverQuote.toLowerCase().replace(/[^a-z0-9 ]/g, ''),
            this.essays[j].coverQuote.toLowerCase().replace(/[^a-z0-9 ]/g, '')
          );
          const threshold = Math.min(this.essays[i].coverQuote.length, this.essays[j].coverQuote.length) < 30 ? 5 : 8;
          if (dist < threshold) {
            console.log(`  ⚠ coverQuote 相似 (编辑距离 ${dist}): "${this.essays[i].coverQuote.substring(0, 30)}..." ↔ "${this.essays[j].coverQuote.substring(0, 30)}..."`);
            totalWarnings++;
          }
        }
      }
    }

    // 逐篇校验
    this.essays.forEach(e => {
      const result = validator.validate(e, this.essays);
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    });

    console.log(`\n  ── 去重检查 ──`);
    console.log(`  标题去重:      ${totalErrors > 0 ? '有重复 ✗' : '全部唯一 ✓'}`);
    console.log(`  coverQuote 去重: ${totalErrors > 0 ? '有重复 ✗' : '全部唯一 ✓'}`);

    console.log(`\n  ── 整体质量 ──`);
    console.log(`  错误: ${totalErrors}`);
    console.log(`  警告: ${totalWarnings}`);
    if (totalErrors === 0) console.log(`  状态: 全部通过 ✓`);
  }

  save() {
    saveJSON(OUTPUT_FILE, this.essays);
    console.log(`\n[保存] ${this.essays.length} 篇文章 → ${OUTPUT_FILE}`);

    this.stats = StatsReporter.generate(this.essays);
    saveJSON(STATS_FILE, this.stats);
    console.log(`[保存] 统计报告 → ${STATS_FILE}`);
  }

  printStats() {
    if (this.essays.length === 0) {
      console.log('[统计] 暂无数据');
      return;
    }
    this.stats = StatsReporter.generate(this.essays);
    StatsReporter.print(this.stats);
  }
}

// ===== CLI 入口 =====

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { count: 20, validate: false, stats: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) { options.count = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--validate') options.validate = true;
    else if (args[i] === '--stats') options.stats = true;
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs();
  const generator = new ContentGenerator();
  generator.run(options).catch(err => { console.error('[错误]', err); process.exit(1); });
}

module.exports = {
  ContentGenerator, TokenSplitter, DifficultyAnalyzer,
  ReadingTimeCalculator, ImageFrequencyLimiter, SceneRotationSystem,
  QuoteSimilarityDetector, RealismEnhancer, TagOptimizer,
  ContentValidator, StatsReporter, BuiltinContentPool,
};
