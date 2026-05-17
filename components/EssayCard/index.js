var dictionary = require('../../utils/dictionary');

/**
 * EssayCard 组件
 * 职责：单张英语内容卡片渲染与交互
 *   - 折叠/展开（由父级 expanded 属性控制）
 *   - 句子翻译切换
 *   - 右滑收藏手势
 *   - 长按查词弹窗
 */
Component({

  properties: {
    article: {
      type: Object,
      value: {},
      observer: '_onArticleChange'
    },
    expanded: {
      type: Boolean,
      value: false,
      observer: '_onExpandedChange'
    },
    index: {
      type: Number,
      value: 0
    },
    isFavorited: {
      type: Boolean,
      value: false
    },
    swipeAction: {
      type: String,
      value: 'favorite'  // 'favorite' | 'delete' | 'none'
    }
  },

  data: {
    displaySentences: [],
    _lastArticleId: null,
    _sentenceCache: null,

    /* 标题翻译切换 */
    _showTitleZh: false,

    /* 右滑手势 */
    _swipeStyle: '',

    /* 查词弹窗 */
    wordPopupVisible: false,
    popupWord: '',
    popupMeaning: ''
  },

  /* 内部手势状态（不放 data 避免频繁 setData） */
  _touchStartX: 0,
  _touchStartY: 0,
  _touchMoved: false,

  methods: {
    /* ===== 数据响应 ===== */

    _onArticleChange: function(article) {
      if (!article || !article.sentences) return;
      if (article.id && article.id === this.data._lastArticleId) return;

      var processed = article.sentences.map(function(s, idx) {
        return {
          en: s.en,
          zh: s.zh,
          showZh: idx === 0 ? true : !!s.showZh,
          segments: splitSentenceByTokens(s.en, s.tokens || [])
        };
      });

      this.setData({
        _lastArticleId: article.id || null,
        _sentenceCache: processed,
        displaySentences: this.properties.expanded ? processed : processed.slice(0, 2)
      });
    },

    _onExpandedChange: function(expanded) {
      var cache = this.data._sentenceCache;
      if (!cache || !cache.length) return;
      this.setData({
        displaySentences: expanded ? cache : cache.slice(0, 2)
      });
    },

    /* ===== 卡片点击 → 展开/折叠 ===== */

    onCardTap: function() {
      if (this._touchMoved) return;
      this.triggerEvent('toggle', { expanded: !this.properties.expanded });
    },

    /* ===== 标题点击 → 中英切换 ===== */

    onTitleTap: function() {
      var current = this.data._showTitleZh;
      this.setData({ _showTitleZh: !current });
    },

    /* ===== 句子点击 → 翻译切换 ===== */

    onSentenceTap: function(e) {
      var idx = parseInt(e.currentTarget.dataset.sidx, 10);
      var cache = this.data._sentenceCache;
      if (!cache || !cache[idx]) return;

      var updated = cache.map(function(s, i) {
        if (i === idx) {
          return {
            en: s.en,
            zh: s.zh,
            showZh: !s.showZh,
            segments: s.segments
          };
        }
        return s;
      });

      this.setData({
        _sentenceCache: updated,
        displaySentences: this.properties.expanded ? updated : updated.slice(0, 2)
      });
    },

    /* ===== 滑动手势（收藏 / 删除） ===== */

    onTouchStart: function(e) {
      if (this.properties.swipeAction === 'none') return;
      var touch = e.touches[0];
      this._touchStartX = touch.clientX;
      this._touchStartY = touch.clientY;
      this._touchMoved = false;
    },

    onTouchMove: function(e) {
      var action = this.properties.swipeAction;
      if (action === 'none') return;

      var touch = e.touches[0];
      var deltaX = touch.clientX - this._touchStartX;
      var deltaY = touch.clientY - this._touchStartY;

      var isRightSwipe = deltaX > 10 && deltaX > Math.abs(deltaY);
      var isLeftSwipe = deltaX < -10 && Math.abs(deltaX) > Math.abs(deltaY);

      if (action === 'favorite' && isRightSwipe) {
        this._touchMoved = true;
        var offset = Math.min(deltaX * 0.5, 160);
        var scale = 1 - offset * 0.00025;
        var opacity = 1 - offset * 0.0015;
        this.setData({
          _swipeStyle:
            'transform: translateX(' + offset + 'rpx) scale(' + scale + ');' +
            'opacity: ' + Math.max(opacity, 0.75) + ';' +
            'transition: none;'
        });
      } else if (action === 'delete' && isLeftSwipe) {
        this._touchMoved = true;
        var absDelta = Math.abs(deltaX);
        var offsetD = Math.min(absDelta * 0.5, 200);
        var scaleD = 1 - offsetD * 0.0002;
        var opacityD = 1 - offsetD * 0.002;
        this.setData({
          _swipeStyle:
            'transform: translateX(-' + offsetD + 'rpx) scale(' + scaleD + ');' +
            'opacity: ' + Math.max(opacityD, 0.6) + ';' +
            'transition: none;'
        });
      }
    },

    onTouchEnd: function() {
      var style = this.data._swipeStyle;
      if (!style) return;

      var match = style.match(/translateX\((-?\d+)rpx\)/);
      var offset = match ? parseInt(match[1], 10) : 0;
      var action = this.properties.swipeAction;

      if (action === 'favorite' && offset > 80) {
        this.triggerEvent('favorite', { articleId: this.properties.article.id });
      } else if (action === 'delete' && offset < -100) {
        this.triggerEvent('delete', { articleId: this.properties.article.id });
      }

      this.setData({
        _swipeStyle:
          'transform: translateX(0) scale(1);' +
          'opacity: 1;' +
          'transition: transform 0.25s ease, opacity 0.25s ease;'
      });

      var self = this;
      setTimeout(function() {
        self.setData({ _swipeStyle: '' });
      }, 260);
    },

    /* ===== 长按单词 → 查词弹窗 ===== */

    onTokenLongPress: function(e) {
      var ds = e.currentTarget.dataset;
      var word = ds.word;
      if (!word) return;
      var meaning = dictionary.lookup(word) || '';

      this._pendingWord = word;
      this._pendingMeaning = meaning;
      this._pendingSourceSentence = ds.sentence || '';
      this._pendingSourceTitle = ds.articleTitle || '';

      this.setData({
        wordPopupVisible: true,
        popupWord: word,
        popupMeaning: meaning
      });
    },

    onWordPopupClose: function() {
      this.setData({ wordPopupVisible: false });
    },

    onAddToWordBook: function() {
      this.setData({ wordPopupVisible: false });
      this.triggerEvent('wordlongpress', {
        word: this._pendingWord,
        meaning: this._pendingMeaning,
        sourceSentence: this._pendingSourceSentence,
        sourceTitle: this._pendingSourceTitle
      });
    }
  }
});

/* 工具函数：按关键词拆分英文句子 */
function splitSentenceByTokens(en, tokens) {
  if (!tokens || tokens.length === 0) {
    return [{ type: 'text', value: en }];
  }

  var tokenSet = {};
  tokens.forEach(function(t) {
    tokenSet[t.toLowerCase()] = t;
  });

  var parts = [];
  var regex = /([a-zA-Z']+)/g;
  var lastIdx = 0;
  var match;

  while ((match = regex.exec(en)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', value: en.slice(lastIdx, match.index) });
    }
    var word = match[1];
    var lower = word.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(tokenSet, lower)) {
      parts.push({ type: 'token', value: word, word: tokenSet[lower] });
    } else {
      parts.push({ type: 'text', value: word });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < en.length) {
    parts.push({ type: 'text', value: en.slice(lastIdx) });
  }

  return parts;
}
