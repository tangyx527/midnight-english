Component({
  data: {
    active: 0,
    list: [
      {
        text: '首页',
        pagePath: '/pages/home/home',
        icon: 'home'
      },
      {
        text: '收藏',
        pagePath: '/pages/favorites/favorites',
        icon: 'heart'
      },
      {
        text: '生词本',
        pagePath: '/pages/words/words',
        icon: 'book'
      },
      {
        text: '我的',
        pagePath: '/pages/profile/profile',
        icon: 'profile'
      }
    ]
  },

  methods: {
    onTabChange: function(e) {
      var index = Number(e.currentTarget.dataset.index);
      var path = e.currentTarget.dataset.path;

      if (index === this.data.active) return;

      this.setData({ active: index });

      wx.switchTab({
        url: path,
        fail: function(err) {
          console.error('[TabBar] 切换失败:', err);
        }
      });
    }
  }
});
