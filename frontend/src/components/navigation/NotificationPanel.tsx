import { useState, useRef, useEffect, useCallback } from "react"
import { Icon } from "@/components/ui/Icon"
import { useNotificationStore } from "@/stores/notification"
import type { AppNotification } from "@/stores/notification"

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "刚刚"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString("zh-CN")
}

function NotificationItem({
  notification,
  onMarkRead,
  onRemove,
}: {
  notification: AppNotification
  onMarkRead: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3.5 transition-colors cursor-pointer ${
        notification.read
          ? "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
          : "bg-primary/[0.04] dark:bg-primary/[0.08] hover:bg-primary/[0.07] dark:hover:bg-primary/[0.12]"
      }`}
      onClick={() => !notification.read && onMarkRead(notification.id)}
    >
      {/* Unread dot */}
      {!notification.read && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-sm shadow-primary/40" />
      )}

      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
          notification.read
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            : notification.type === "community_reply"
            ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-500"
            : "bg-primary/10 dark:bg-primary/20 text-primary"
        }`}
      >
        <Icon icon={notification.icon} className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold leading-snug truncate ${
            notification.read
              ? "text-slate-500 dark:text-slate-400"
              : "text-slate-800 dark:text-slate-100"
          }`}
        >
          {notification.title}
        </p>
        <p
          className={`text-xs leading-relaxed mt-0.5 line-clamp-2 ${
            notification.read
              ? "text-slate-400 dark:text-slate-500"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatTimeAgo(notification.createdAt)}
          </p>
          {notification.type === "community_reply" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-500 font-medium">
              社区
            </span>
          )}
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(notification.id)
        }}
        className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        title="删除通知"
      >
        <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
      </button>
    </div>
  )
}

// ── Polling interval for community notifications ──
const POLL_INTERVAL_MS = 30_000 // 30 seconds

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const removeNotification = useNotificationStore((s) => s.removeNotification)
  const pollCommunityNotifications = useNotificationStore((s) => s.pollCommunityNotifications)

  // Poll for community notifications
  useEffect(() => {
    // Poll immediately on mount
    pollCommunityNotifications()

    const interval = setInterval(() => {
      pollCommunityNotifications()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [pollCommunityNotifications])

  // Also poll when panel is opened
  useEffect(() => {
    if (isOpen) {
      pollCommunityNotifications()
    }
  }, [isOpen, pollCommunityNotifications])

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      panelRef.current &&
      !panelRef.current.contains(e.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(e.target as Node)
    ) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, handleClickOutside])

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:text-primary shadow-sm hover:shadow-md transition-all relative"
        title="通知中心"
      >
        <Icon icon="solar:bell-bing-bold-duotone" className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-white dark:border-slate-800 shadow-sm animate-in zoom-in duration-200">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/60 z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">通知中心</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary">
                  {unreadCount} 未读
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  title="全部标记为已读"
                >
                  全部已读
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="清空所有通知"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={markAsRead}
                  onRemove={removeNotification}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Icon icon="solar:bell-sleep-bold-duotone" className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  暂无通知
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                  完成学习任务或收到帖子回复时将收到通知
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
