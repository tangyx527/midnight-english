Component({
  options: {
    multipleSlots: true
  },

  properties: {
    extClass: { type: String, value: '' },
    title: { type: String, value: '' },
    background: { type: String, value: '' },
    color: { type: String, value: '' },
    back: { type: Boolean, value: true },
    loading: { type: Boolean, value: false },
    homeButton: { type: Boolean, value: false },
    animated: {
      type: Boolean,
      value: true
    },
    show: {
      type: Boolean,
      value: true,
      observer: '_showChange'
    },
    delta: { type: Number, value: 1 }
  },

  data: {
    displayStyle: ''
  },

  lifetimes: {
    attached: function() {
      var rect = wx.getMenuButtonBoundingClientRect();
      var platform = (wx.getDeviceInfo() || wx.getSystemInfoSync()).platform;
      var isAndroid = platform === 'android';
      var isDevtools = platform === 'devtools';
      var windowInfo = wx.getWindowInfo() || wx.getSystemInfoSync();
      var windowWidth = windowInfo.windowWidth;
      var safeArea = windowInfo.safeArea || {};
      var top = safeArea.top || 0;
      var bottom = safeArea.bottom || 0;
      this.setData({
        ios: !isAndroid,
        innerPaddingRight: 'padding-right: ' + (windowWidth - rect.left) + 'px',
        leftWidth: 'width: ' + (windowWidth - rect.left) + 'px',
        safeAreaTop: isDevtools || isAndroid
          ? 'height: calc(var(--height) + ' + top + 'px); padding-top: ' + top + 'px'
          : ''
      });
    }
  },

  methods: {
    _showChange: function(show) {
      var animated = this.data.animated;
      var displayStyle = '';
      if (animated) {
        displayStyle = 'opacity: ' + (show ? '1' : '0') + ';transition:opacity 0.5s;';
      } else {
        displayStyle = 'display: ' + (show ? '' : 'none');
      }
      this.setData({ displayStyle: displayStyle });
    },

    back: function() {
      var data = this.data;
      if (data.delta) {
        wx.navigateBack({ delta: data.delta });
      }
      this.triggerEvent('back', { delta: data.delta }, {});
    }
  }
});
