var auth = require('../../services/auth');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    favoritesCount: 0,
    wordBookCount: 0,
    seedDone: false,   // 种子数据是否已写入
    seeding: false     // 正在写入中
  },

  onShow: function() {
    var app = getApp();

    // 同步 TabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 3 });
    }

    this.setData({
      userInfo: auth.getUserInfo(),
      isLoggedIn: auth.isLoggedIn(),
      favoritesCount: (app.globalData.favorites || []).length,
      wordBookCount: (app.globalData.wordBook || []).length
    });
  },

  /* ===== 初始化文章数据（调用 seedEssays 云函数） ===== */
  onTapSeedEssays: function() {
    var self = this;
    if (this.data.seeding) return;

    this.setData({ seeding: true });

    wx.cloud.callFunction({ name: 'seedEssays' })
      .then(function(res) {
        var result = res.result;
        wx.showToast({ title: result.message, icon: 'none', duration: 2000 });
        self.setData({ seedDone: true, seeding: false });
      })
      .catch(function(err) {
        console.error('[Seed] 初始化失败:', err);
        wx.showToast({ title: '初始化失败，请确认云函数已部署', icon: 'none', duration: 2500 });
        self.setData({ seeding: false });
      });
  },

  /* ===== 登录/获取用户信息 ===== */
  onTapLogin: function() {
    var self = this;

    if (auth.isLoggedIn()) {
      // 已登录，尝试获取用户头像昵称
      auth.requestUserInfo().then(function(userInfo) {
        self.setData({ userInfo: userInfo });
      }).catch(function() {
        wx.showToast({ title: '获取用户信息失败', icon: 'none' });
      });
      return;
    }

    // 未登录，先静默登录
    auth.login().then(function(openid) {
      if (openid) {
        self.setData({ isLoggedIn: true });
        // 尝试获取用户信息
        return auth.requestUserInfo();
      }
      return null;
    }).then(function(userInfo) {
      if (userInfo) {
        self.setData({ userInfo: userInfo });
      }
    }).catch(function() {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    });
  }
});
