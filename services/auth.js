/**
 * 登录认证服务
 * 职责：
 *   1. 静默登录（获取 openid）
 *   2. 确保已登录（各页面收藏/生词操作前调用）
 *   3. 用户信息管理
 *
 * 策略：游客可浏览 → 收藏/生词需要登录 → 微信授权
 */
var auth = {
  _openid: '',
  _userInfo: null,

  /**
   * 是否已登录（持有 openid 即为已登录）
   */
  isLoggedIn: function() {
    return !!this._openid;
  },

  /**
   * 获取 openid
   */
  getOpenid: function() {
    return this._openid;
  },

  /**
   * 静默登录 — 通过云函数获取 openid
   * 不弹授权框，仅获取 openid 作为用户标识
   */
  login: function() {
    var self = this;
    if (this._openid) {
      return Promise.resolve(this._openid);
    }
    return wx.cloud.callFunction({ name: 'login' })
      .then(function(res) {
        if (!res || !res.result) {
          console.warn('[Auth] 云函数返回数据为空，使用本地 ID');
          return null;
        }
        self._openid = res.result.openid;
        // 持久化到全局
        var app = getApp();
        if (app) {
          app.globalData._openid = self._openid;
        }
        console.log('[Auth] 静默登录成功, openid:', self._openid.substring(0, 8) + '...');
        return self._openid;
      })
      .catch(function(err) {
        console.error('[Auth] 登录失败:', err);
        return null;
      });
  },

  /**
   * 显式登录 — 用于需要用户信息的场景
   * 调用 getUserProfile 弹出授权框
   */
  requestUserInfo: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      wx.getUserProfile({
        desc: '用于展示您的头像和昵称',
        success: function(res) {
          self._userInfo = res.userInfo;
          var app = getApp();
          if (app) {
            app.globalData.userInfo = self._userInfo;
          }
          resolve(self._userInfo);
        },
        fail: function(err) {
          console.error('[Auth] 获取用户信息失败:', err);
          reject(err);
        }
      });
    });
  },

  /**
   * 获取用户信息
   * 如果有缓存直接返回，否则返回默认值
   */
  getUserInfo: function() {
    return this._userInfo || {
      nickName: '深夜读者',
      avatarUrl: ''
    };
  },

  /**
   * 确保已登录 — 在收藏/生词操作前调用
   * 未登录则尝试静默登录，失败则引导用户授权
   */
  ensureLogin: function() {
    var self = this;
    if (this._openid) return Promise.resolve(this._openid);
    return this.login().then(function(openid) {
      if (!openid) {
        // 静默登录失败，需要用户显式授权
        return wx.showModal({
          title: '需要登录',
          content: '收藏和生词本功能需要微信登录后才能使用',
          confirmText: '去登录',
          cancelText: '暂不登录'
        }).then(function(modalRes) {
          if (modalRes.confirm) {
            return self.requestUserInfo().then(function() {
              return self.login();
            });
          }
          return null;
        });
      }
      return openid;
    });
  }
};

module.exports = auth;
