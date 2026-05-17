var wordsService = require('../../services/words');

Page({
  data: {
    wordList: [],
    deletingWord: ''  // 正在删除中的单词，用于退出动画
  },

  onShow: function() {
    var self = this;

    // 同步 TabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 2 });
    }

    // 从云端同步生词本
    wordsService.syncFromCloud().then(function() {
      self._loadWords();
    }).catch(function() {
      self._loadWords();
    });
  },

  /** 从 globalData 加载生词本 */
  _loadWords: function() {
    var app = getApp();
    this.setData({
      wordList: app.globalData.wordBook || [],
      deletingWord: ''
    });
  },

  /* ===== 左滑删除词条 ===== */
  onWordDelete: function(e) {
    var entry = e.detail.entry;
    if (!entry) return;

    // 删除生词（更新本地 + 云端同步）
    wordsService.removeWord(entry.word);

    // 标记删除中（word-card 内部播放退出动画）
    var self = this;
    this.setData({ deletingWord: entry.word });

    // 延迟移除，让退出动画完整播放（250ms 动画 + 50ms 缓冲）
    setTimeout(function() {
      var list = self.data.wordList.filter(function(item) {
        return item.word !== entry.word;
      });
      self.setData({ wordList: list, deletingWord: null });
    }, 300);
  }
});
