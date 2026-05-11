import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  MessageSquare, Heart, Share2, MoreHorizontal, Check,
  Send, ChevronDown, ChevronUp, Hash, ThumbsUp,
  Sparkles, Users, Flame, Clock, BookOpen, Award,
  Reply, X, AlertCircle, User, Edit2, Trash2, PenSquare
} from "lucide-react"
import { api, getApiErrorMessage } from "@/lib/api"
import type {
  CommunityPost, PostComment, PostListResponse, LikeResponse,
  CommentListResponse, CreatePostRequest, UpdatePostRequest, DeletePostResponse
} from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"

/* ──────────────── helpers ──────────────── */
function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString()
}

const TAG_OPTIONS = ["Python", "算法", "数据科学", "教程", "机器学习", "Web开发", "进阶", "作品展示"]
const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-500",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
  "from-amber-500 to-yellow-600",
  "from-lime-500 to-green-600",
]
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/* ──────────────── Avatar ──────────────── */
function UserAvatar({ name, avatar, size = "md" }: { name: string; avatar?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base" }
  
  if (avatar && (avatar.startsWith("http") || avatar.startsWith("/"))) {
    return (
      <div className={`${sizes[size]} rounded-full flex items-center justify-center shadow-md ring-2 ring-white/20 flex-shrink-0 overflow-hidden`}>
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${sizes[size]} bg-gradient-to-br ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white/20 flex-shrink-0`}>
      {name.charAt(0)}
    </div>
  )
}

/* ──────────────── Comment Item (recursive) ──────────────── */
function CommentItem({
  comment,
  postId,
  postAuthorId,
  userId,
  depth = 0,
  onReplySubmit,
  onDeleteComment,
}: {
  comment: PostComment
  postId: string
  postAuthorId?: string
  userId?: string
  depth?: number
  onReplySubmit: (postId: string, content: string, parentId: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}) {
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [isLiked, setIsLiked] = useState(comment.is_liked || false)
  const [likesCount, setLikesCount] = useState(comment.likes || 0)
  const [liking, setLiking] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isCommentAuthor = userId && comment.author?.id?.toLowerCase() === userId.toLowerCase()
  const isPostAuthor = userId && postAuthorId && postAuthorId.toLowerCase() === userId.toLowerCase()
  const canDelete = isCommentAuthor || isPostAuthor

  const handleLike = async () => {
    if (!userId || liking) return
    setLiking(true)
    try {
      const res = await api.post(`/api/community/comments/${comment.id}/like`, {}, { params: { user_id: userId } })
      setIsLiked(res.data.is_liked)
      setLikesCount(res.data.likes)
    } catch (e) {
      console.error(e)
    } finally {
      setLiking(false)
    }
  }

  const handleSubmitReply = async () => {
    if (!replyText.trim() || submitting) return
    setSubmitting(true)
    try {
      await onReplySubmit(postId, replyText.trim(), comment.id)
      setReplyText("")
      setIsReplying(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onDeleteComment(comment.id)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className={`relative ${depth > 0 ? "ml-8" : ""}`} style={{ animationDelay: `${depth * 50}ms` }}>
      {/* Timeline connector line */}
      {depth > 0 && (
        <div className="absolute -left-5 top-0 bottom-0 w-[2px] bg-gradient-to-b from-slate-200 to-transparent dark:from-slate-700" />
      )}
      {depth > 0 && (
        <div className="absolute -left-5 top-4 w-4 h-[2px] bg-slate-200 dark:bg-slate-700" />
      )}

      <div className="flex gap-3 py-3 group animate-fade-in">
        <UserAvatar name={comment.author?.nickname || "?"} avatar={comment.author?.avatar} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              {comment.author?.nickname || "匿名"}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {comment.author?.role || "学习者"}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              · {formatTime(comment.created_at)}
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Delete confirmation modal via portal */}
          {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div
                className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">确认删除评论</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">此操作不可撤销</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">确定要删除这条评论吗？删除后将无法恢复。</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? "删除中..." : "确认删除"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={handleLike}
              disabled={liking}
              className={`flex items-center gap-1 text-xs transition-colors ${isLiked ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              {likesCount > 0 && <span>{likesCount}</span>}
            </button>
            {userId && depth < 2 && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                <span>回复</span>
              </button>
            )}
            {canDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                <span>删除</span>
              </button>
            )}
          </div>

          {/* Reply input */}
          {isReplying && (
            <div className="mt-3 flex gap-2 items-start animate-fade-in">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitReply()}
                placeholder={`回复 @${comment.author?.nickname || ""}...`}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                autoFocus
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || submitting}
                className="px-3 py-2 bg-primary hover:bg-primaryHover text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-all shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setIsReplying(false); setReplyText("") }}
                className="px-2 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              postAuthorId={postAuthorId}
              userId={userId}
              depth={depth + 1}
              onReplySubmit={onReplySubmit}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ──────────────── Post Card ──────────────── */
function PostCard({
  post,
  userId,
  onLike,
  onShare,
  onEdit,
  onDelete,
  copiedPostId,
  likingPostId,
}: {
  post: CommunityPost
  userId?: string
  onLike: (id: string) => void
  onShare: (id: string) => void
  onEdit: (id: string, data: UpdatePostRequest) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  copiedPostId: string | null
  likingPostId: string | null
}) {
  const profile = useAuthStore((s) => s.profile)

  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentsTotal, setCommentsTotal] = useState(post.comments_count)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(post.title)
  const [editContent, setEditContent] = useState(post.content)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Dropdown menu state
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isOwner = userId && post.author?.id && post.author.id.toLowerCase() === userId.toLowerCase()

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  const loadComments = async () => {
    setCommentsLoading(true)
    try {
      const res = await api.get<CommentListResponse>(`/api/community/posts/${post.id}/comments`, {
        params: { user_id: profile?.user_id }
      })
      setComments(res.data.comments)
      setCommentsTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setCommentsLoading(false)
    }
  }

  const toggleComments = () => {
    if (!expanded) {
      loadComments()
    }
    setExpanded(!expanded)
  }

  const handleSubmitComment = async () => {
    if (!userId || !commentText.trim() || commentSubmitting) return
    setCommentSubmitting(true)
    try {
      await api.post(`/api/community/posts/${post.id}/comments`, { content: commentText.trim() }, {
        params: { user_id: userId }
      })
      setCommentText("")
      loadComments()
    } catch (err) {
      console.error(err)
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleReplySubmit = async (postId: string, content: string, parentId: string) => {
    if (!userId) return
    await api.post(`/api/community/posts/${postId}/comments`, { content, parent_id: parentId }, {
      params: { user_id: userId }
    })
    loadComments()
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!userId) return
    try {
      await api.delete(`/api/community/comments/${commentId}`, {
        params: { user_id: userId }
      })
      loadComments()
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  const handleSaveEdit = async () => {
    if (editSubmitting) return
    setEditSubmitting(true)
    try {
      const success = await onEdit(post.id, { title: editTitle.trim(), content: editContent.trim() })
      if (success) setIsEditing(false)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteSubmitting) return
    setDeleteSubmitting(true)
    try {
      await onDelete(post.id)
    } finally {
      setDeleteSubmitting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Removed accent border logic
  return (
    <>
    {/* Delete confirmation modal - rendered via portal to root to ensure it overlaps everything */}
    {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">确认删除帖子</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">此操作不可撤销</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">确定要删除这篇帖子吗？删除后将无法恢复。</p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteSubmitting}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteSubmitting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    <article className="bg-white dark:bg-slate-800/70 rounded-none shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 dark:border-slate-700/50 overflow-hidden group">
      {/* Post Header */}
      <div className="p-5 pb-0">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <UserAvatar name={post.author?.nickname || "?"} avatar={post.author?.avatar} size="md" />
            <div>
              <div className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-primary transition-colors">
                {post.author?.nickname || "匿名"}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                  {post.author?.role || "学习者"}
                </span>
                <span>·</span>
                <Clock className="w-3 h-3" />
                <span>{formatTime(post.created_at)}</span>
              </div>
            </div>
          </div>
          {/* Menu button - only for own posts */}
          {isOwner && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[120px] animate-fade-in">
                  <button
                    onClick={() => { setIsEditing(true); setShowMenu(false); setEditTitle(post.title); setEditContent(post.content) }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(true); setShowMenu(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title & content - edit mode or display mode */}
        {isEditing ? (
          <div className="space-y-3 mb-3 animate-fade-in">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-700 dark:text-slate-200"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-700 dark:text-slate-200 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSubmitting || editTitle.trim().length < 5 || editContent.trim().length < 10}
                className="px-4 py-1.5 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {editSubmitting ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-primary transition-colors leading-snug">
              {post.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-line">
              {post.content}
            </p>
          </>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 rounded-md text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">
                <Hash className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-5 py-3 flex items-center gap-1 border-t border-slate-100 dark:border-slate-700/40">
        <button
          onClick={() => onLike(post.id)}
          disabled={likingPostId === post.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            post.is_liked
              ? "text-red-500 bg-red-50 dark:bg-red-500/10"
              : "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          }`}
        >
          <Heart className={`w-4 h-4 transition-transform ${post.is_liked ? "fill-current scale-110" : "hover:scale-110"}`} />
          <span>{post.likes}</span>
        </button>

        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            expanded
              ? "text-primary bg-primary/10"
              : "text-slate-400 hover:text-primary hover:bg-primary/10"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{commentsTotal}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <button
          onClick={() => onShare(post.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
        >
          {copiedPostId === post.id ? (
            <><Check className="w-4 h-4 text-green-500" /> <span className="text-green-500">已复制</span></>
          ) : (
            <><Share2 className="w-4 h-4" /> <span>分享</span></>
          )}
        </button>
      </div>

      {/* Comments section */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-700/40 animate-fade-in">
          {/* Comment input */}
          {userId && (
            <div className="flex gap-3 items-start mt-4 mb-2">
              <UserAvatar name={profile?.portrait?.nickname || "我"} avatar={profile?.portrait?.avatar_url} size="sm" />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
                  placeholder="写下你的评论…"
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || commentSubmitting}
                  className="px-4 py-2.5 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>发送</span>
                </button>
              </div>
            </div>
          )}

          {/* Comments list */}
          {commentsLoading ? (
            <div className="py-6 text-center text-sm text-slate-400 animate-pulse">加载评论中...</div>
          ) : comments.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              暂无评论，来发表第一条吧
            </div>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/30">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  postId={post.id}
                  postAuthorId={post.author?.id}
                  userId={userId}
                  onReplySubmit={handleReplySubmit}
                  onDeleteComment={handleDeleteComment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
    </>
  )
}

/* ──────────────── Composer ──────────────── */
function PostComposer({
  onSubmit,
  isSubmitting,
  isOpen,
  onClose,
}: {
  onSubmit: (data: CreatePostRequest) => Promise<boolean>
  isSubmitting: boolean
  isOpen: boolean
  onClose: () => void
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 3 ? [...prev, tag] : prev
    )
  }

  // Frontend validation matching backend min_length requirements
  const titleTrimmed = title.trim()
  const contentTrimmed = content.trim()
  const titleTooShort = titleTrimmed.length > 0 && titleTrimmed.length < 5
  const contentTooShort = contentTrimmed.length > 0 && contentTrimmed.length < 10
  const canSubmit = titleTrimmed.length >= 5 && contentTrimmed.length >= 10 && !isSubmitting

  const handleSubmit = async () => {
    setErrorMsg(null)
    if (!canSubmit) {
      if (titleTrimmed.length < 5) {
        setErrorMsg("标题至少需要 5 个字符")
      } else if (contentTrimmed.length < 10) {
        setErrorMsg("内容至少需要 10 个字符")
      }
      return
    }
    try {
      const success = await onSubmit({ title: titleTrimmed, content: contentTrimmed, tags: selectedTags })
      if (success) {
        setTitle("")
        setContent("")
        setSelectedTags([])
        onClose()
        setErrorMsg(null)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "发布失败，请稍后重试")
    }
  }

  if (!isOpen) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
            发布新帖
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrorMsg(null) }}
            placeholder="输入标题（至少 5 个字符）…"
            className={`w-full px-4 py-3 text-sm font-semibold rounded-xl border bg-slate-50 dark:bg-slate-800/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${
              titleTooShort ? "border-red-300 dark:border-red-700" : "border-slate-200 dark:border-slate-600"
            }`}
          />
          {titleTooShort && (
            <p className="text-[11px] text-red-500 mt-1 ml-1">标题至少需要 5 个字符（当前 {titleTrimmed.length} 个）</p>
          )}
        </div>

        <div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); setErrorMsg(null) }}
            placeholder="分享你的想法（至少 10 个字符）…"
            rows={5}
            className={`w-full px-4 py-3 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 resize-none ${
              contentTooShort ? "border-red-300 dark:border-red-700" : "border-slate-200 dark:border-slate-600"
            }`}
          />
          {contentTooShort && (
            <p className="text-[11px] text-red-500 mt-1 ml-1">内容至少需要 10 个字符（当前 {contentTrimmed.length} 个）</p>
          )}
        </div>

        {/* Tags */}
        <div>
          <p className="text-[11px] text-slate-400 mb-2 font-medium">选择标签（最多 3 个）</p>
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all ${
                  selectedTags.includes(tag)
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-2.5 bg-primary hover:bg-primaryHover text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "发布中..." : "发布"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ──────────────── Main Component ──────────────── */
const FILTER_TABS = [
  { key: "全部", icon: Users, label: "全部" },
  { key: "最新", icon: Clock, label: "最新" },
  { key: "热门", icon: Flame, label: "热门" },
  { key: "教程", icon: BookOpen, label: "教程" },
  { key: "作品展示", icon: Award, label: "作品展示" },
  { key: "我的帖子", icon: User, label: "我的帖子" },
]

export default function LearningCommunity() {
  const profile = useAuthStore((s) => s.profile)
  const [activeFilter, setActiveFilter] = useState("全部")
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [likingPostId, setLikingPostId] = useState<string | null>(null)
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  const [isSubmittingPost, setIsSubmittingPost] = useState(false)
  const [totalPosts, setTotalPosts] = useState(0)

  // Fetch posts whenever filter or user changes
  useEffect(() => {
    const isMyPosts = activeFilter === "我的帖子"

    // "我的帖子" requires a logged-in user
    if (isMyPosts && !profile?.user_id) {
      setPosts([])
      setTotalPosts(0)
      setPostsLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchPosts = async () => {
      setPostsLoading(true)
      try {
        const filterMap: Record<string, string> = {
          "全部": "all", "最新": "latest", "热门": "hot", "教程": "tutorial", "作品展示": "showcase"
        }
        const params: Record<string, string | number> = {
          filter: isMyPosts ? "all" : (filterMap[activeFilter] || "all"),
          page: 1,
          page_size: 20,
        }
        if (profile?.user_id) {
          params.user_id = profile.user_id
        }
        if (isMyPosts) {
          params.author_id = profile!.user_id
        }
        const res = await api.get<PostListResponse>("/api/community/posts", {
          params,
          signal: controller.signal,
        })

        if (!cancelled) {
          setPosts(res.data.posts)
          setTotalPosts(res.data.total)
        }
      } catch (err: unknown) {
        if (!cancelled && !(err instanceof Error && err.name === "CanceledError")) {
          console.error(err)
        }
      } finally {
        if (!cancelled) {
          setPostsLoading(false)
        }
      }
    }

    fetchPosts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [activeFilter, profile?.user_id])

  // Helper to reload posts (used after create/delete)
  const reloadPosts = async () => {
    const isMyPosts = activeFilter === "我的帖子"
    try {
      const filterMap: Record<string, string> = {
        "全部": "all", "最新": "latest", "热门": "hot", "教程": "tutorial", "作品展示": "showcase"
      }
      const params: Record<string, string | number> = {
        filter: isMyPosts ? "all" : (filterMap[activeFilter] || "all"),
        page: 1,
        page_size: 20,
      }
      if (profile?.user_id) {
        params.user_id = profile.user_id
      }
      if (isMyPosts) {
        params.author_id = profile!.user_id
      }
      const res = await api.get<PostListResponse>("/api/community/posts", { params })
      setPosts(res.data.posts)
      setTotalPosts(res.data.total)
    } catch (err) {
      console.error(err)
    }
  }

  const handleLike = async (postId: string) => {
    if (!profile?.user_id || likingPostId) return
    setLikingPostId(postId)
    try {
      const res = await api.post<LikeResponse>(`/api/community/posts/${postId}/like`, {}, {
        params: { user_id: profile.user_id }
      })
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, likes: res.data.likes, is_liked: res.data.is_liked } : p
      ))
    } catch (err) {
      console.error(err)
    } finally {
      setLikingPostId(null)
    }
  }

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/community/post/${postId}`
    navigator.clipboard.writeText(url)
    setCopiedPostId(postId)
    setTimeout(() => setCopiedPostId(null), 2000)
  }

  const handleCreatePost = async (data: CreatePostRequest): Promise<boolean> => {
    if (!profile?.user_id) return false
    setIsSubmittingPost(true)
    try {
      await api.post("/api/community/posts", data, {
        params: { user_id: profile.user_id }
      })
      await reloadPosts()
      return true
    } catch (err) {
      console.error("发布帖子失败:", err)
      const msg = getApiErrorMessage(err)
      throw new Error(msg)
    } finally {
      setIsSubmittingPost(false)
    }
  }

  const handleEditPost = async (postId: string, data: UpdatePostRequest): Promise<boolean> => {
    if (!profile?.user_id) return false
    try {
      const res = await api.put<CommunityPost>(`/api/community/posts/${postId}`, data, {
        params: { user_id: profile.user_id }
      })
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, title: res.data.title, content: res.data.content, tags: res.data.tags } : p
      ))
      return true
    } catch (err) {
      console.error("编辑帖子失败:", err)
      return false
    }
  }

  const handleDeletePost = async (postId: string): Promise<boolean> => {
    if (!profile?.user_id) return false
    try {
      await api.delete<DeletePostResponse>(`/api/community/posts/${postId}`, {
        params: { user_id: profile.user_id }
      })
      setPosts(prev => prev.filter(p => p.id !== postId))
      setTotalPosts(prev => prev - 1)
      return true
    } catch (err) {
      console.error("删除帖子失败:", err)
      return false
    }
  }

  const [isComposerOpen, setIsComposerOpen] = useState(false)

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-violet-500/5 rounded-2xl pointer-events-none" />
        <div className="relative text-center py-6 px-4">
          {/* 发布新帖 button – top-right corner */}
          {profile?.user_id && (
            <button
              onClick={() => setIsComposerOpen(true)}
              className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all duration-200"
            >
              <PenSquare className="w-3.5 h-3.5" />
              发布新帖
            </button>
          )}

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[11px] font-bold rounded-full mb-3 uppercase tracking-widest">
            <Users className="w-3.5 h-3.5" />
            Learning Community
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">学习社区</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {totalPosts} 条讨论 · 分享知识，共同成长
          </p>

          {/* Filter tabs */}
          <div className="flex items-center justify-center gap-1.5 mt-5 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                  activeFilter === tab.key
                    ? "bg-slate-800 dark:bg-white text-white dark:text-slate-800 shadow-lg shadow-slate-800/20"
                    : "bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Composer */}
      {profile?.user_id && (
        <PostComposer onSubmit={handleCreatePost} isSubmitting={isSubmittingPost} isOpen={isComposerOpen} onClose={() => setIsComposerOpen(false)} />
      )}

      {/* Posts */}
      <div className="space-y-4">
        {postsLoading ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center gap-3 text-slate-400 animate-pulse">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
              加载中...
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            {activeFilter === "我的帖子" ? (
              <>
                <User className="w-12 h-12 mx-auto mb-3 text-slate-200 dark:text-slate-700" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">你还没有发布过帖子</p>
                <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">分享你的学习心得，和大家一起成长吧！</p>
              </>
            ) : (
              <>
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200 dark:text-slate-700" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">暂无帖子</p>
                <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">成为第一个分享的人吧！</p>
              </>
            )}
          </div>
        ) : (
          posts.map((post, i) => (
            <div
              key={post.id}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <PostCard
                post={post}
                userId={profile?.user_id}
                onLike={handleLike}
                onShare={handleShare}
                onEdit={handleEditPost}
                onDelete={handleDeletePost}
                copiedPostId={copiedPostId}
                likingPostId={likingPostId}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
