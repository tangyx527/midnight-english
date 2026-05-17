/**
 * WordCard 组件
 * 职责：单个生词卡片 — 文艺摘抄本风格
 *   - 单词 + 释义展示
 *   - 点击展开/收起来源句子
 *   - 左滑删除
 */
Component({

  properties: {
    entry: {
      type: Object,
      value: {}
    },
    index: {
      type: Number,
      value: 0
    }
  },

  data: {
    _expanded: false,
    _swipeStyle: ''
  },

  /* 手势内部状态 */
  _touchStartX: 0,
  _touchStartY: 0,
  _touchMoved: false,

  methods: {
    /* ===== 点击卡片 → 展开/收起来源句子 ===== */
    onCardTap: function() {
      if (this._touchMoved) return;
      this.setData({ _expanded: !this.data._expanded });
    },

    /* ===== 左滑删除手势 ===== */
    onTouchStart: function(e) {
      var touch = e.touches[0];
      this._touchStartX = touch.clientX;
      this._touchStartY = touch.clientY;
      this._touchMoved = false;
    },

    onTouchMove: function(e) {
      var touch = e.touches[0];
      var deltaX = touch.clientX - this._touchStartX;
      var deltaY = touch.clientY - this._touchStartY;

      if (deltaX < -10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        this._touchMoved = true;
        var offset = Math.min(Math.abs(deltaX) * 0.5, 200);
        var opacity = 1 - offset * 0.002;
        this.setData({
          _swipeStyle:
            'transform: translateX(-' + offset + 'rpx);' +
            'opacity: ' + Math.max(opacity, 0.5) + ';' +
            'transition: none;'
        });
      }
    },

    onTouchEnd: function() {
      var style = this.data._swipeStyle;
      if (!style) return;

      var match = style.match(/translateX\(-(\d+)rpx\)/);
      var offset = match ? parseInt(match[1], 10) : 0;

      if (offset > 100) {
        this.triggerEvent('delete', { entry: this.properties.entry });
        this.setData({
          _swipeStyle:
            'transform: translateX(-800rpx);' +
            'opacity: 0;' +
            'transition: transform 0.25s ease, opacity 0.25s ease;'
        });
        return;
      }

      // 未达阈值，归位
      this.setData({
        _swipeStyle:
          'transform: translateX(0);' +
          'opacity: 1;' +
          'transition: transform 0.25s ease, opacity 0.25s ease;'
      });

      var self = this;
      setTimeout(function() {
        self.setData({ _swipeStyle: '' });
      }, 260);
    }
  }
});
