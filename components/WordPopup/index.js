/**
 * WordPopup 组件
 * 职责：轻量查词弹窗 — 显示单词、中文释义、加入生词本
 * 动画：opacity + scale
 */
Component({

  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    word: {
      type: String,
      value: ''
    },
    meaning: {
      type: String,
      value: ''
    }
  },

  methods: {
    /* ===== 点击遮罩 → 关闭 ===== */
    onOverlayTap: function() {
      this.triggerEvent('close');
    },

    /* ===== 阻止冒泡（卡片区域点击不透传） ===== */
    onCardTap: function() {
      // 空函数，阻止冒泡到遮罩
    },

    /* ===== 加入生词本 ===== */
    onAddToWordBook: function() {
      this.triggerEvent('addtowordbook', { word: this.properties.word });
    },

    /* ===== 取消 ===== */
    onCancel: function() {
      this.triggerEvent('close');
    }
  }
});
