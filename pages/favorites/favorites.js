var essaysService = require('../../services/essays');
var favoritesService = require('../../services/favorites');

Page({
  data: {
    favoritesList: [],
    deletingId: null   // 正在删除中的卡片 ID，用于退出动画
  },

  onShow: function() {
    var self = this;

    // 同步 TabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 1 });
    }

    // 从云端同步收藏
    favoritesService.syncFromCloud().then(function() {
      self._loadFavorites();
    }).catch(function() {
      self._loadFavorites();
    });
  },

  /** 从 globalData 加载收藏列表 */
  _loadFavorites: function() {
    var app = getApp();
    var favoriteIds = app.globalData.favorites || [];
    var favoriteIdMap = {};
    favoriteIds.forEach(function(id) {
      favoriteIdMap[id] = true;
    });

    // 加载配套文章数据：云端优先 + mock 回退
    essaysService.getEssays().then(function(articles) {
      var favoritesList = articles
        .filter(function(article) {
          return favoriteIdMap[article.id];
        });
      this.setData({ favoritesList: favoritesList, deletingId: null });
    }.bind(this));
  },

  /* ===== 卡片展开/折叠 ===== */
  onCardToggle: function(e) {
    var articleId = e.currentTarget.dataset.id;
    var expanded = e.detail.expanded;
    var list = this.data.favoritesList.map(function(item) {
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
    this.setData({ favoritesList: list });
  },

  /* ===== 左滑删除 ===== */
  onCardDelete: function(e) {
    var articleId = e.detail.articleId;
    if (!articleId) return;

    // 取消收藏（更新本地 + 云端同步）
    favoritesService.removeFavorite(articleId);

    // 触发退出动画
    var self = this;
    this.setData({ deletingId: articleId });

    setTimeout(function() {
      var list = self.data.favoritesList.filter(function(item) {
        return item.id !== articleId;
      });
      self.setData({
        favoritesList: list,
        deletingId: null
      });
    }, 350);
  }
});
