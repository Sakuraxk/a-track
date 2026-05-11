import { create } from "zustand"
import { persist } from "zustand/middleware"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"

export type NotificationType =
  | "chapter_complete"
  | "exercise_complete"
  | "review_complete"
  | "streak"
  | "level_up"
  | "badge"
  | "general"
  | "community_reply"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  icon: string
  read: boolean
  createdAt: number // timestamp
  /** For community notifications, links to the post */
  postId?: string
}

// ── Motivational message pools ──

const chapterCompleteMessages = [
  { title: "🎉 章节学习完成！", message: "太棒了！你已完成本章节的学习，知识正在一点点积累。坚持就是胜利！" },
  { title: "📚 又攻克一章！", message: "每一步学习都在拉开你与昨天的差距，继续加油！" },
  { title: "🌟 知识 +1！", message: "学完一个章节就是一次小小的胜利，为你的毅力点赞！" },
  { title: "🚀 学习进度更新！", message: "恭喜你完成了又一个学习章节！你的知识版图正在不断扩大。" },
  { title: "💡 概念已掌握！", message: "你已经完成了本章的概念学习，理论基础又扎实了一分！" },
]

const exerciseCompleteMessages = [
  { title: "✅ 练习完成！", message: "做完练习才是真正的巩固！你的理解力又提升了一个档次。" },
  { title: "🏆 练习题挑战成功！", message: "从理论到实践，你做到了！继续保持这份学习热情吧。" },
  { title: "💪 实战演练结束！", message: "动手做题是最好的学习方式，你正在建立扎实的知识体系！" },
  { title: "🎯 题目全部攻克！", message: "每一道题都是一次思维的锻炼，你越来越强了！" },
  { title: "⭐ 练习已提交！", message: "恭喜完成练习！不断练习是通向精通的必经之路。" },
]

const reviewCompleteMessages = [
  { title: "🔄 复习圆满完成！", message: "温故而知新，你的记忆已经更加牢固了！" },
  { title: "📖 回顾已完成！", message: "复习是学习闭环中最重要的一环，你做得很好！" },
  { title: "🧠 知识巩固成功！", message: "通过复习，那些零散的知识点已经被你串联起来了。" },
]

const levelUpMessages = [
  { title: "🎊 等级提升！", message: "你的学习水平又上了一个台阶，继续突破自我吧！" },
  { title: "⬆️ 恭喜升级！", message: "学习等级提升了！你的努力正在被系统记录和认可。" },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const iconMap: Record<NotificationType, string> = {
  chapter_complete: "solar:book-bookmark-bold-duotone",
  exercise_complete: "solar:pen-new-square-bold-duotone",
  review_complete: "solar:refresh-circle-bold-duotone",
  streak: "solar:fire-bold-duotone",
  level_up: "solar:star-shine-bold-duotone",
  badge: "solar:medal-ribbons-star-bold-duotone",
  general: "solar:bell-bing-bold-duotone",
  community_reply: "solar:chat-round-dots-bold-duotone",
}

type NotificationState = {
  notifications: AppNotification[]
  unreadCount: number
  /** IDs of community notifications already synced from backend (avoid duplicates) */
  _syncedBackendIds: Set<string>
  addNotification: (type: NotificationType, title?: string, message?: string, extra?: { postId?: string }) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  removeNotification: (id: string) => void
  /** Poll backend for new community notifications */
  pollCommunityNotifications: () => Promise<void>
}

// Helper to auto-generate motivational messages
function getAutoMessage(type: NotificationType): { title: string; message: string } {
  switch (type) {
    case "chapter_complete":
      return pickRandom(chapterCompleteMessages)
    case "exercise_complete":
      return pickRandom(exerciseCompleteMessages)
    case "review_complete":
      return pickRandom(reviewCompleteMessages)
    case "level_up":
      return pickRandom(levelUpMessages)
    case "badge":
      return { title: "🏅 获得新徽章！", message: "恭喜你解锁了新成就，快去看看吧！" }
    case "streak":
      return { title: "🔥 学习连续打卡！", message: "你的学习热情令人钦佩，继续保持这份节奏！" }
    case "community_reply":
      return { title: "💬 新的回复", message: "有人回复了你的帖子" }
    default:
      return { title: "📢 新通知", message: "你有一条新的系统通知。" }
  }
}

const MAX_NOTIFICATIONS = 50

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      _syncedBackendIds: new Set<string>(),

      addNotification: (type, customTitle, customMessage, extra) => {
        const auto = getAutoMessage(type)
        const notification: AppNotification = {
          id: generateId(),
          type,
          title: customTitle || auto.title,
          message: customMessage || auto.message,
          icon: iconMap[type],
          read: false,
          createdAt: Date.now(),
          postId: extra?.postId,
        }
        set((state) => {
          const updated = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          }
        })
      },

      markAsRead: (id) =>
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          }
        }),

      markAllAsRead: () => {
        // Also mark community notifications as read on backend
        const profile = useAuthStore.getState().profile
        if (profile?.user_id) {
          api.post("/api/community/notifications/mark-read", null, {
            params: { user_id: profile.user_id },
          }).catch(() => {})
        }
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }))
      },

      clearAll: () => set({ notifications: [], unreadCount: 0, _syncedBackendIds: new Set() }),

      removeNotification: (id) =>
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id)
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          }
        }),

      pollCommunityNotifications: async () => {
        const profile = useAuthStore.getState().profile
        if (!profile?.user_id) return

        try {
          const res = await api.get("/api/community/notifications", {
            params: { user_id: profile.user_id, unread_only: true, page_size: 20 },
          })

          const backendNotifs = res.data?.notifications || []
          const syncedIds = get()._syncedBackendIds

          const newNotifs: AppNotification[] = []
          const newSyncedIds = new Set(syncedIds)

          for (const bn of backendNotifs) {
            if (syncedIds.has(bn.id)) continue
            newSyncedIds.add(bn.id)

            const isReply = bn.notification_type === "reply_to_comment"
            const actorName = bn.actor?.nickname || "某人"
            const postTitle = bn.post_title
              ? (bn.post_title.length > 20 ? bn.post_title.slice(0, 20) + "…" : bn.post_title)
              : "你的帖子"

            const title = isReply
              ? `💬 ${actorName} 回复了你的评论`
              : `💬 ${actorName} 评论了你的帖子`

            const message = bn.comment_preview
              ? `在「${postTitle}」中：${bn.comment_preview}`
              : `在「${postTitle}」中发表了评论`

            newNotifs.push({
              id: `community-${bn.id}`,
              type: "community_reply",
              title,
              message,
              icon: iconMap.community_reply,
              read: false,
              createdAt: new Date(bn.created_at).getTime(),
              postId: bn.post_id,
            })
          }

          if (newNotifs.length > 0) {
            set((state) => {
              const merged = [...newNotifs, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
              // Sort by time descending
              merged.sort((a, b) => b.createdAt - a.createdAt)
              return {
                notifications: merged,
                unreadCount: merged.filter((n) => !n.read).length,
                _syncedBackendIds: newSyncedIds,
              }
            })
          }
        } catch (err) {
          // Silently ignore polling errors
          console.debug("[notification] poll error:", err)
        }
      },
    }),
    {
      name: "notification-store-v3",
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        // Persist synced IDs as array (Set is not JSON-serializable)
        _syncedBackendIds: Array.from(state._syncedBackendIds),
      }),
      merge: (persisted: unknown, currentState) => {
        const p = persisted as Record<string, unknown> | undefined
        const syncedArr = (p?._syncedBackendIds ?? []) as string[]
        return {
          ...currentState,
          notifications: (p?.notifications ?? []) as AppNotification[],
          unreadCount: (p?.unreadCount ?? 0) as number,
          _syncedBackendIds: new Set(syncedArr),
        }
      },
    }
  )
)
