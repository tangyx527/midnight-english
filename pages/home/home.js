var essaysService = require('../../services/essays');
var favoritesService = require('../../services/favorites');

Page({
  data: {
    articles: [],
    favoriteIds: {},
    currentIndex: 0
  },

  onLoad: function() {
    var self = this;

    var app = getApp();
    var savedFavorites = app.globalData.favorites || [];
    var favoriteIds = {};
    savedFavorites.forEach(function(id) {
      favoriteIds[id] = true;
    });

    essaysService.getEssays().then(function(articles) {
      self.setData({
        articles: articles,
        favoriteIds: favoriteIds
      });
    });
  },

  onShow: function() {
    var app = getApp();

    // 同步 TabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 0 });
    }

    var savedFavorites = app.globalData.favorites || [];
    var favoriteIds = {};
    savedFavorites.forEach(function(id) {
      favoriteIds[id] = true;
    });
    this.setData({ favoriteIds: favoriteIds });

    favoritesService.syncFromCloud().then(function() {
      var updated = getApp().globalData.favorites || [];
      var ids = {};
      updated.forEach(function(id) { ids[id] = true; });
      this.setData({ favoriteIds: ids });
    }.bind(this));
  },

  /* ===== Swiper 切换 ===== */
  onSwiperChange: function(e) {
    this.setData({ currentIndex: e.detail.current });
  },

  /* ===== 卡片展开/折叠 ===== */
  onCardToggle: function(e) {
    var articleId = e.currentTarget.dataset.id;
    var expanded = e.detail.expanded;
    var articles = this.data.articles.map(function(item) {
      if (item.id === articleId) {
        var updated = {};
        Object.keys(item).forEach(function(key) {
          updated[key] = item[key];
        });
        updated.expanded = expanded;
        return updated;
      }
      return item;
    });
    this.setData({ articles: articles });
  },

  /* ===== 右滑收藏/取消收藏 ===== */
  onToggleFavorite: function(e) {
    var articleId = e.detail.articleId;
    if (!articleId) return;

    var favoriteIds = Object.assign({}, this.data.favoriteIds);
    var isFav = favoriteIds[articleId];

    if (isFav) {
      delete favoriteIds[articleId];
      favoritesService.removeFavorite(articleId);
      wx.showToast({ title: '已取消收藏', icon: 'none', duration: 1200 });
    } else {
      favoriteIds[articleId] = true;
      var articles = this.data.articles;
      var essayData = {};
      for (var i = 0; i < articles.length; i++) {
        if (articles[i].id === articleId) {
          essayData = { title: articles[i].title, coverQuote: articles[i].coverQuote };
          break;
        }
      }
      favoritesService.addFavorite(articleId, essayData);
      wx.showToast({ title: '已加入收藏', icon: 'none', duration: 1200 });
    }

    this.setData({ favoriteIds: favoriteIds });
  },

  /* ===== 长按单词 → 加入生词本 ===== */
  onWordLongPress: function(e) {
    var detail = e.detail;
    var word = detail.word;
    if (!word) return;

    var app = getApp();
    var wordBook = app.globalData.wordBook || [];

    var exists = wordBook.some(function(entry) {
      return entry.word === word;
    });
    if (exists) {
      wx.showToast({ title: '已在生词本中', icon: 'none', duration: 1200 });
      return;
    }

    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    var collectedTime = month + '/' + day;

    var entry = {
      word: word,
      meaning: detail.meaning || '',
      sourceSentence: detail.sourceSentence || '',
      sourceTitle: detail.sourceTitle || '',
      collectedTime: collectedTime
    };

    var wordsService = require('../../services/words');
    var added = wordsService.addWord(entry);
    if (added) {
      wx.showToast({ title: '已加入生词本', icon: 'none', duration: 1500 });
    }
  }
});
