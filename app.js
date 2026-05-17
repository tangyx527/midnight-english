var auth = require('./services/auth');

App({
  /** 全局服务模块引用，供页面通过 getApp().services 访问 */
  services: {
    auth: auth
  },

  onLaunch: function() {
    var self = this;

    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d4ghzfsu9d400bf2d',
        traceUser: true
      });
      console.log('[App] 云开发初始化完成');

      // 静默登录 — 不弹授权框，仅获取 openid
      auth.login().then(function(openid) {
        if (openid) {
          console.log('[App] 静默登录成功');
        }
      });
    } else {
      console.warn('[App] 当前版本不支持云开发');
    }
  },

  globalData: {
    _openid: '',
    userInfo: null,
    // 收藏文章 ID 列表
    favorites: [],
    // 生词本
    wordBook: []
  }
});
