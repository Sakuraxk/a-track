<template>
  <div class="action-btn" title="消息通知" @click.stop="visible = !visible" :class="{ 'is-active': visible }">
    <el-badge :value="unreadCount" :max="99" class="badge-item" :hidden="unreadCount === 0">
      <el-icon :size="20"><Bell /></el-icon>
    </el-badge>
  </div>

  <Teleport to="#admin-notice-container" v-if="teleportReady">
    <transition name="el-zoom-in-bottom">
      <div v-show="visible" class="notice-container inline-notice-panel">
        <el-tabs v-model="activeName" class="notice-tabs flex-tabs">
        <el-tab-pane :label="`通知 (${notifications.length})`" name="notification">
          <el-scrollbar class="pane-scrollbar">
            <div class="notice-list" v-if="notifications.length > 0">
              <div v-for="item in notifications" :key="item.id" class="notice-item" :class="{ unread: !item.read }" @click="item.read = true">
                <div class="notice-avatar">
                  <div class="notice-icon" :class="item.type">
                    <el-icon><component :is="item.icon" /></el-icon>
                  </div>
                </div>
                <div class="notice-content">
                  <div class="notice-title">{{ item.title }}</div>
                  <div class="notice-time">{{ item.time }}</div>
                </div>
              </div>
            </div>
            <div class="notice-empty" v-else>
              <el-empty description="你已查看所有通知" :image-size="60" />
            </div>
          </el-scrollbar>
        </el-tab-pane>
        
        <el-tab-pane :label="`消息 (${messages.length})`" name="message">
          <el-scrollbar class="pane-scrollbar">
             <div class="notice-list" v-if="messages.length > 0">
              <div v-for="item in messages" :key="item.id" class="notice-item" :class="{ unread: !item.read }" @click="item.read = true">
                <div class="notice-avatar">
                  <el-avatar :size="32" :src="item.avatar" />
                </div>
                <div class="notice-content">
                  <div class="notice-title">{{ item.title }}</div>
                  <div class="notice-desc">{{ item.desc }}</div>
                  <div class="notice-time">{{ item.time }}</div>
                </div>
              </div>
            </div>
            <div class="notice-empty" v-else>
              <el-empty description="您已读完所有消息" :image-size="60" />
            </div>
          </el-scrollbar>
        </el-tab-pane>

        <el-tab-pane :label="`待办 (${todos.length})`" name="todo">
          <el-scrollbar class="pane-scrollbar">
            <div class="notice-list" v-if="todos.length > 0">
              <div v-for="item in todos" :key="item.id" class="notice-item" :class="{ unread: !item.read }" @click="item.read = true">
                <div class="notice-content">
                  <div class="notice-title">
                    <span class="title-text">{{ item.title }}</span>
                    <el-tag :type="item.statusType" size="small" style="margin-left: 8px">{{ item.status }}</el-tag>
                  </div>
                  <div class="notice-desc">{{ item.desc }}</div>
                </div>
              </div>
            </div>
            <div class="notice-empty" v-else>
              <el-empty description="你已完成所有待办" :image-size="60" />
            </div>
          </el-scrollbar>
        </el-tab-pane>
      </el-tabs>
      
      <div class="notice-footer">
        <div class="footer-btn" @click="readCurrentTab">全部已读</div>
        <div class="footer-divider"></div>
        <div class="footer-btn" @click="clearCurrentTab">清空{{ currentTabName }}</div>
      </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Bell, Message, Warning, Star, ChatDotRound } from '@element-plus/icons-vue'

const visible = ref(false)
const teleportReady = ref(false)

onMounted(() => {
  teleportReady.value = true
})

const activeName = ref('notification')

const notifications = ref([
  { id: 1, type: 'primary', icon: 'Message', title: '你收到了 14 份新周报', time: '10 分钟前', read: false },
  { id: 2, type: 'success', icon: 'Star', title: '你推荐的 刘强东 已通过第三轮面试', time: '1 小时前', read: false },
  { id: 3, type: 'warning', icon: 'Warning', title: '这种模板可以区分多种通知类型', time: '2 小时前', read: false },
  { id: 4, type: 'info', icon: 'ChatDotRound', title: '左侧图标用于区分不同的类型', time: '1 小时前', read: true }
])

const messages = ref([
  { id: 1, avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix', title: '曲丽丽 评论了你', desc: '描述信息描述信息描述信息', time: '10 分钟前', read: false },
  { id: 2, avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka', title: '林东东 回复了你', desc: '这种模板用于提醒谁与你发生了互动', time: '1 小时前', read: false },
  { id: 3, avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack', title: '周星星 关注了你', desc: '这种模板用于提醒谁与你发生了互动', time: '2 小时前', read: true }
])

const todos = ref([
  { id: 1, title: '任务名称', desc: '任务需要在 2026-04-08 20:00 前启动', status: '未开始', statusType: 'info', read: false },
  { id: 2, title: '第三方紧急代码变更', desc: '冠霖 提交于 2026-04-07', status: '马上到期', statusType: 'danger', read: false },
  { id: 3, title: '信息安全考试', desc: '指派竹尔于 2026-04-09 前完成更新并发布', status: '已耗时 8 天', statusType: 'warning', read: true }
])

const currentTabName = computed(() => {
  if (activeName.value === 'notification') return '通知'
  if (activeName.value === 'message') return '消息'
  return '待办'
})

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length + 
         messages.value.filter(m => !m.read).length + 
         todos.value.filter(t => !t.read).length
})

function readCurrentTab() {
  if (activeName.value === 'notification') notifications.value.forEach(item => item.read = true)
  if (activeName.value === 'message') messages.value.forEach(item => item.read = true)
  if (activeName.value === 'todo') todos.value.forEach(item => item.read = true)
}

function clearCurrentTab() {
  if (activeName.value === 'notification') notifications.value = []
  if (activeName.value === 'message') messages.value = []
  if (activeName.value === 'todo') todos.value = []
}
</script>

<style>
/* Global popover style adjustment for zero padding */
.notice-popover-container {
  padding: 0 !important;
  border-radius: 8px !important;
  overflow: hidden;
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08), 0 9px 28px 0 rgba(0, 0, 0, 0.05), 0 12px 48px 16px rgba(0, 0, 0, 0.03) !important;
}

html.dark .notice-popover-container {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.2), 0 9px 28px 0 rgba(0, 0, 0, 0.15), 0 12px 48px 16px rgba(0, 0, 0, 0.1) !important;
}
</style>

<style scoped>
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out-quart);
}

.action-btn:hover {
  background: var(--bg-base);
  color: var(--primary);
}

.badge-item {
  display: flex;
  align-items: center;
  justify-content: center;
}

.notice-container {
  display: flex;
  flex-direction: column;
}

.inline-notice-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: transparent;
  border-top: 1px solid var(--border-color);
}

.flex-tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.flex-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.flex-tabs :deep(.el-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pane-scrollbar {
  height: 100%;
}

.notice-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--border-color);
}

.notice-tabs :deep(.el-tabs__nav-scroll) {
  display: flex;
  justify-content: center;
}

.notice-tabs :deep(.el-tabs__item) {
  height: 48px;
  line-height: 48px;
  font-weight: 500;
  color: var(--text-secondary);
}

.notice-tabs :deep(.el-tabs__item.is-active) {
  color: var(--primary);
}

.notice-list {
  display: flex;
  flex-direction: column;
}

.notice-item {
  display: flex;
  padding: 12px 24px;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s;
  border-bottom: 1px solid var(--border-color);
  opacity: 0.6;
}

.notice-item.unread {
  opacity: 1;
}

h3 {
    margin: 0;
}

.notice-item:hover {
  background-color: var(--bg-base);
}

.notice-item:last-child {
  border-bottom: none;
}

.notice-avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.notice-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.notice-icon.primary { background-color: var(--primary); }
.notice-icon.success { background-color: var(--success); }
.notice-icon.warning { background-color: var(--warning); }
.notice-icon.info { background-color: var(--info); }
.notice-icon.danger { background-color: var(--danger); }

.notice-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.notice-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.5;
}

.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.notice-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.notice-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 250px;
}

.notice-footer {
  display: flex;
  align-items: center;
  border-top: 1px solid var(--border-color);
  height: 46px;
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.3s;
  height: 100%;
}

.footer-btn:hover {
  color: var(--primary);
  background-color: var(--bg-base);
}

.footer-divider {
  width: 1px;
  height: 16px;
  background-color: var(--border-color);
}
</style>
