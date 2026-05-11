import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { User, Shield, Camera, Plus, Cpu, Trash2, FlaskConical, Pencil, Copy, Check } from "lucide-react"

import { api, getApiErrorMessage } from "@/lib/api"
import type { ProfileResponse, LLMConfigResponse, LLMConfigListResponse, LLMConfigCreate, LLMConfigUpdate, LLMConfigTestResponse, LLMConfigTestRequest } from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useNavigate } from "react-router-dom"

const MIN_LLM_OUTPUT_TOKENS = 100
const MAX_LLM_OUTPUT_TOKENS = 8192
const DEFAULT_LLM_OUTPUT_TOKENS = 2048

const clampMaxTokens = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return DEFAULT_LLM_OUTPUT_TOKENS
  return Math.min(Math.max(parsed, MIN_LLM_OUTPUT_TOKENS), MAX_LLM_OUTPUT_TOKENS)
}

export default function Profile() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const logout = useAuthStore((s) => s.logout)




  // LLM Config states
  const [llmConfigs, setLlmConfigs] = useState<LLMConfigResponse[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<LLMConfigResponse | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)


  // Form states for create/edit
  const [formApiUrl, setFormApiUrl] = useState("")
  const [formApiKey, setFormApiKey] = useState("")
  const [formModelName, setFormModelName] = useState("")
  const [formTemperature, setFormTemperature] = useState("0.7")
  const [formMaxTokens, setFormMaxTokens] = useState("2048")
  const [formTimeout, setFormTimeout] = useState("30")
  const [savingConfig, setSavingConfig] = useState(false)
  const [testingConfig, setTestingConfig] = useState(false)
  const [testResult, setTestResult] = useState<LLMConfigTestResponse | null>(null)

  // Confirm dialog states


  const [deleteLLMDialog, setDeleteLLMDialog] = useState<{
    open: boolean
    config: LLMConfigResponse | null
  }>({ open: false, config: null })

  // Security & Avatar states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Profile Edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editNickname, setEditNickname] = useState(profile?.portrait?.nickname || "")
  const [editGoals, setEditGoals] = useState<string[]>(
    profile?.portrait?.learning_goals
      ? profile.portrait.learning_goals.split(",").filter(Boolean)
      : []
  )
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [uidCopied, setUidCopied] = useState(false)
  const [showStageDetails, setShowStageDetails] = useState(false)

  // Ability Grouping
  const averageMastery = useMemo(() => {
    const tags = profile?.ability_tags ?? {}
    const values = Object.values(tags)
    if (values.length === 0) return 0
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }, [profile?.ability_tags])

  const userLevel = useMemo(() => {
    return Math.floor(averageMastery / 20) + 1
  }, [averageMastery])


  useEffect(() => {

    setEditNickname(profile?.portrait?.nickname || "")
    const goals = profile?.portrait?.learning_goals
      ? profile.portrait.learning_goals.split(",").filter(Boolean)
      : []
    setEditGoals(goals)
  }, [profile])

  // Load LLM configs on mount
  useEffect(() => {
    if (profile?.user_id) {
      loadLLMConfigs()
    }
  }, [profile?.user_id])


  const loadLLMConfigs = async () => {
    if (!profile?.user_id) return
    setLoadingConfigs(true)
    setConfigError(null)
    try {
      const res = await api.get<LLMConfigListResponse>("/api/llm-config/")
      setLlmConfigs(res.data.configs)
    } catch (err) {
      setConfigError(getApiErrorMessage(err))
    } finally {
      setLoadingConfigs(false)
    }
  }

  const resetForm = () => {
    setFormApiUrl("")
    setFormApiKey("")
    setFormModelName("")
    setFormTemperature("0.7")
    setFormMaxTokens("2048")
    setFormTimeout("30")
    setTestResult(null)
  }

  const handleCreateConfig = async () => {
    if (!profile?.user_id) return
    setSavingConfig(true)
    setConfigError(null)
    try {
      // Validate API URL format
      if (!formApiUrl.match(/^https?:\/\/.+/)) {
        const errorMsg = "请输入正确的 API Base URL（以 http:// 或 https:// 开头）"
        setConfigError(errorMsg)
        toast.error(errorMsg)
        setSavingConfig(false)
        return
      }
      if (!formModelName.trim()) {
        const errorMsg = "请输入模型名称"
        setConfigError(errorMsg)
        toast.error(errorMsg)
        setSavingConfig(false)
        return
      }
      if (!formApiKey.trim()) {
        const errorMsg = "请输入 API Key"
        setConfigError(errorMsg)
        toast.error(errorMsg)
        setSavingConfig(false)
        return
      }
      if (formApiKey.trim().length < 10) {
        const errorMsg = "API Key 长度不能少于 10 位"
        setConfigError(errorMsg)
        toast.error(errorMsg)
        setSavingConfig(false)
        return
      }

      const payload: LLMConfigCreate = {
        api_base_url: formApiUrl,
        api_key: formApiKey,
        model_name: formModelName,
        temperature: parseFloat(formTemperature),
        max_tokens: clampMaxTokens(formMaxTokens),
        timeout_seconds: parseInt(formTimeout)
      }
      await api.post("/api/llm-config/", payload)
      await loadLLMConfigs()
      setShowCreateForm(false)
      resetForm()
      toast.success('AI模型配置已创建')
    } catch (err) {
      const errorMsg = getApiErrorMessage(err)
      setConfigError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSavingConfig(false)
    }
  }

  const handleUpdateConfig = async () => {
    if (!profile?.user_id || !editingConfig) return
    setSavingConfig(true)
    setConfigError(null)
    try {
      if (formApiKey && formApiKey.trim().length < 10) {
        const errorMsg = "API Key 长度不能少于 10 位"
        setConfigError(errorMsg)
        toast.error(errorMsg)
        setSavingConfig(false)
        return
      }

      const payload: LLMConfigUpdate = {
        api_base_url: formApiUrl,
        api_key: formApiKey || "", // Empty string will be converted to None by backend
        model_name: formModelName,
        temperature: parseFloat(formTemperature),
        max_tokens: clampMaxTokens(formMaxTokens),
        timeout_seconds: parseInt(formTimeout)
      }
      await api.put(`/api/llm-config/${editingConfig.id}`, payload)
      await loadLLMConfigs()
      setEditingConfig(null)
      resetForm()
    } catch (err) {
      setConfigError(getApiErrorMessage(err))
    } finally {
      setSavingConfig(false)
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (!profile?.user_id) return
    const config = llmConfigs.find(c => c.id === configId)
    const confirmMessage = config
      ? `确定要删除「${getRoleName(config.model_role)}」的配置吗？\n模型: ${config.model_name}`
      : "确定要删除此配置吗？"
    if (!confirm(confirmMessage)) return
    try {
      await api.delete(`/api/llm-config/${configId}`)
      await loadLLMConfigs()
    } catch (err) {
      setConfigError(getApiErrorMessage(err))
    }
  }

  const handleTestConfig = async (configId?: string) => {
    if (!profile?.user_id) return
    setTestingConfig(true)
    setTestResult(null)
    try {
      let payload: LLMConfigTestRequest
      if (configId) {
        payload = { config_id: configId }
      } else {
        if (!formApiUrl || (!formApiKey && !editingConfig) || !formModelName) {
          toast.error("请填写必要的配置信息")
          setTestingConfig(false)
          return
        }
        if (formApiKey && formApiKey.trim().length < 10) {
          toast.error("API Key 长度不能少于 10 位")
          setTestingConfig(false)
          return
        }
        payload = {
          api_base_url: formApiUrl,
          model_name: formModelName,
          temperature: Number.parseFloat(formTemperature),
          max_tokens: clampMaxTokens(formMaxTokens),
          timeout_seconds: Number.parseInt(formTimeout, 10),
        }
        if (formApiKey) {
          payload.api_key = formApiKey
        }
        if (editingConfig) {
          payload.config_id = editingConfig.id
        }
      }

      const res = await api.post<LLMConfigTestResponse>("/api/llm-config/test", payload)
      setTestResult(res.data)

      // Let user manually dismiss the result via dialog
    } catch (err) {
      setTestResult({
        success: false,
        message: getApiErrorMessage(err),
        latency_ms: null,
        model_info: null
      })
    } finally {
      setTestingConfig(false)
    }
  }

  const startEditConfig = (config: LLMConfigResponse) => {
    setEditingConfig(config)
    setFormApiUrl(config.api_base_url)
    setFormApiKey("") // Don't pre-fill API key for security
    setFormModelName(config.model_name)
    setFormTemperature(config.temperature.toString())
    setFormMaxTokens(config.max_tokens.toString())
    setFormTimeout(config.timeout_seconds.toString())
    setShowCreateForm(false)
    setTestResult(null)
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Limit size to 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error("头像文件大小不能超过 2MB")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    setUploadingAvatar(true)
    try {
      const res = await api.post<{ avatar_url: string }>("/api/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })

      // Update local profile with new avatar URL
      if (profile) {
        setProfile({
          ...profile,
          portrait: {
            ...profile.portrait,
            avatar_url: res.data.avatar_url
          }
        })
      }
      toast.success("头像上传成功")
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }

    if (newPassword.length < 6) {
      toast.error("新密码长度不能少于 6 位")
      return
    }

    setChangingPassword(true)
    try {
      await api.post("/api/profile/password", {
        current_password: currentPassword,
        new_password: newPassword
      })
      toast.success("密码修改成功，请重新登录")
      // Logout and redirect to login after a short delay
      setTimeout(() => {
        logout()
        navigate("/login")
      }, 1500)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      await api.delete("/api/profile/account")
      toast.success("账号已注销，感谢您的使用")
      // Logout and redirect to landing page
      setTimeout(() => {
        logout()
        navigate("/")
      }, 1500)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
      setDeletingAccount(false)
      setDeleteAccountDialog(false)
    }
  }

  const getRoleName = (_role: string) => {
    return "AI 模型"
  }





  const handleUpdateProfile = async () => {
    if (!editNickname || editNickname.trim().length < 2) {
      toast.error("昵称长度至少为 2 个字符")
      return
    }
    setUpdatingProfile(true)
    try {
      const res = await api.put<ProfileResponse>("/api/profile", {
        nickname: editNickname,
        learning_goals: editGoals,
        learning_stage: profile?.portrait?.learning_stage // Keep current stage
      })
      setProfile(res.data)
      setIsEditingProfile(false)
      toast.success("个人资料已更新")
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUpdatingProfile(false)
    }
  }

  const toggleGoal = (goal: string) => {
    setEditGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    )
  }


  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-display">个人中心</h2>
        <p className="text-slate-500">管理你的账户信息和偏好设置。</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <User className="w-4 h-4 mr-2" />
            基本信息
          </TabsTrigger>
          <TabsTrigger value="llm-config" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Cpu className="w-4 h-4 mr-2" />
            AI模型配置
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="w-4 h-4 mr-2" />
            账号安全
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="border-2 border-slate-100 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle>个人资料</CardTitle>
              <CardDescription>查看并管理你的基本信息与学习偏好。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center gap-6">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                    {profile?.portrait?.avatar_url ? (
                      <img
                        key={profile.portrait.avatar_url}
                        src={profile.portrait.avatar_url}
                        alt="Avatar"
                        className="h-full w-full object-cover text-xs"
                        onError={(e) => {
                          // Fallback if image fails to load: hide the broken img
                          const img = e.target as HTMLImageElement
                          img.style.display = "none"
                          // Show the fallback icon by revealing sibling
                          const fallback = img.parentElement?.querySelector('.avatar-fallback') as HTMLElement | null
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    {!profile?.portrait?.avatar_url && (
                      <User className="h-10 w-10 text-slate-400" />
                    )}
                    {profile?.portrait?.avatar_url && (
                      <div className="avatar-fallback h-full w-full items-center justify-center" style={{ display: 'none' }}>
                        <User className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <input
                    type="file"
                    id="avatar-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      {isEditingProfile ? (
                        <div className="space-y-3 mt-1">
                          <div className="flex items-center gap-2">
                            <Input
                              value={editNickname}
                              onChange={(e) => setEditNickname(e.target.value)}
                              placeholder="设置昵称"
                              className="h-9 w-48 text-lg font-bold"
                            />
                            <Button size="sm" onClick={handleUpdateProfile} disabled={updatingProfile}>
                              {updatingProfile ? "..." : "保存"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditingProfile(false)}>
                              取消
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {["job", "academic", "hobby", "skill"].map(g => (
                              <button
                                key={g}
                                onClick={() => toggleGoal(g)}
                                className={`px-2 py-1 text-xs rounded-full border transition-colors ${editGoals.includes(g)
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                  : "bg-white border-slate-200 text-slate-500"
                                  }`}
                              >
                                {g === "job" ? "求职" : g === "academic" ? "学术" : g === "hobby" ? "兴趣" : "提升技能"}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-xl text-slate-900">{profile?.portrait?.nickname || "学习者"}</h3>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-md shadow-sm">
                              <span className="text-[10px] font-black uppercase tracking-tighter">Lv.{userLevel}</span>
                            </div>
                            <div
                              className="relative group/stage"
                              onMouseEnter={() => setShowStageDetails(true)}
                              onMouseLeave={() => setShowStageDetails(false)}
                            >
                              <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full cursor-help hover:bg-slate-200 transition-colors">
                                {profile?.portrait?.learning_stage === "beginner" ? "初学者" :
                                  profile?.portrait?.learning_stage === "elementary" ? "基础档" :
                                    profile?.portrait?.learning_stage === "intermediate" ? "进阶档" :
                                      profile?.portrait?.learning_stage === "advanced" ? "精通档" : "探索者"}
                              </span>

                              {showStageDetails && (
                                <div className="absolute top-full left-0 mt-2 w-48 p-3 bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-in fade-in zoom-in duration-200 origin-top-left">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">段位详情</div>
                                  <div className="space-y-2">
                                    {[
                                      { lv: 1, name: "初学者", desc: "掌握基本语法", color: "from-slate-400 to-slate-500" },
                                      { lv: 2, name: "基础档", desc: "熟悉常用逻辑", color: "from-blue-400 to-indigo-500" },
                                      { lv: 3, name: "进阶档", desc: "独立开发功能", color: "from-teal-400 to-emerald-500" },
                                      { lv: 4, name: "精通档", desc: "架构与性能专家", color: "from-amber-400 to-orange-500" },
                                      { lv: 5, name: "探索者", desc: "算法与前沿探索", color: "from-indigo-500 to-blue-600" }
                                    ].map((item) => (
                                      <div key={item.lv} className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors ${userLevel === item.lv ? 'bg-slate-50 border border-slate-100' : ''}`}>
                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-black text-white bg-gradient-to-br ${item.color}`}>
                                          L{item.lv}
                                        </div>
                                        <div>
                                          <div className={`text-[10px] font-bold ${userLevel === item.lv ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {item.name}
                                          </div>
                                          <div className="text-[8px] text-slate-400 leading-none">{item.desc}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setIsEditingProfile(true)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Experience/Mastery Bar */}
                          <div className="mt-3 w-64">
                            <div className="flex justify-between items-end mb-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">综合掌握度</span>
                              <span className="text-xs font-mono font-bold text-teal-600">{averageMastery}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                              <div
                                className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-1000 ease-out"
                                style={{ width: `${averageMastery}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex gap-1.5 mt-3">
                            {profile?.portrait?.learning_goals
                              ? profile.portrait.learning_goals.split(",").filter(Boolean).map(g => (
                                <span key={g} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase border border-emerald-100">
                                  {g === "job" ? "求职" : g === "academic" ? "学术" : g === "hobby" ? "兴趣" : g}
                                </span>
                              ))
                              : null
                            }
                            {(!profile?.portrait?.learning_goals || profile.portrait.learning_goals === "") && (
                              <span className="text-[10px] text-slate-400 italic">尚未设置目标</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                  </div>
                  <p className="text-sm text-slate-500 mt-2">{profile?.user_id?.toString().slice(0, 8) || "用户"}</p>
                </div>
              </div>



              <div className="grid gap-6 md:grid-cols-1">
                <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <Label className="text-slate-600 font-bold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    账号状态
                  </Label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">关联账号</span>
                      <span className="text-slate-700 font-medium">{profile?.email || profile?.phone || "未绑定"}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-500">用户 ID</span>
                      <div className="flex items-center gap-1">
                        <span
                          className="font-mono text-slate-700 cursor-help"
                          title={profile?.user_id?.toString()}
                        >
                          {profile?.user_id?.toString().slice(0, 8)}...{profile?.user_id?.toString().slice(-4)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-blue-500 hover:bg-transparent"
                          onClick={() => {
                            if (profile?.user_id) {
                              navigator.clipboard.writeText(profile.user_id.toString())
                              setUidCopied(true)
                              toast.success("用户 ID 已复制")
                              setTimeout(() => setUidCopied(false), 2000)
                            }
                          }}
                        >
                          {uidCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">注册时间</span>
                      <span className="text-slate-700">
                        {profile?.created_at ? (
                          (() => {
                            const dateStr = profile.created_at;
                            // Ensure naive ISO strings are treated as UTC
                            const utcStr = (dateStr.includes('T') && !dateStr.endsWith('Z') && !dateStr.includes('+'))
                              ? dateStr + 'Z'
                              : dateStr;
                            return new Date(utcStr).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric',
                              hour12: false
                            }).replace(/\//g, '-');
                          })()
                        ) : "未知"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">上次登录</span>
                      <span className="text-slate-700">
                        {(() => {
                          const dateStr = profile?.last_login || profile?.created_at;
                          if (!dateStr) return "本次登录";
                          const utcStr = (dateStr.includes('T') && !dateStr.endsWith('Z') && !dateStr.includes('+'))
                            ? dateStr + 'Z'
                            : dateStr;
                          return new Date(utcStr).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: false
                          }).replace(/\//g, '-');
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="llm-config" className="space-y-6">
          <Card className="border-2 border-slate-100 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle>AI 模型配置</CardTitle>
              <CardDescription>
                配置 LLM API，支持 OpenAI、DeepSeek 等兼容接口。所有AI功能将统一使用此配置。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {configError && (
                <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">
                  {configError}
                </div>
              )}

              {/* Existing Configs List */}
              {loadingConfigs ? (
                <div className="text-sm text-slate-500">加载中...</div>
              ) : llmConfigs.length > 0 ? (
                <div className="space-y-3">
                  {llmConfigs.map((config) => (
                    <div key={config.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-slate-900">
                            AI 模型配置
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            模型: {config.model_name} | API Key: {config.api_key_masked}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            URL: {config.api_base_url}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConfig(config.id)}
                            disabled={testingConfig}
                          >
                            <FlaskConical className="w-3 h-3 mr-1" />
                            测试
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditConfig(config)}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteConfig(config.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">
                  暂未配置任何 AI 模型，点击下方按钮添加配置。
                </div>
              )}

              {/* Test Result Dialog */}
              <AlertDialog open={!!testResult} onOpenChange={(open) => { if (!open) setTestResult(null) }}>
                <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl border-slate-100 p-6">
                  <AlertDialogHeader className="space-y-4">
                    <AlertDialogTitle className="flex items-center gap-3 text-xl font-display">
                      {testResult?.success ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-100 shadow-sm shrink-0">
                          <Check className="w-5 h-5 text-emerald-600" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center border border-red-100 shadow-sm shrink-0">
                          <FlaskConical className="w-5 h-5 text-red-600" strokeWidth={2.5} />
                        </div>
                      )}
                      <span className={testResult?.success ? "text-emerald-700 font-bold tracking-tight" : "text-red-700 font-bold tracking-tight"}>
                        {testResult?.success ? "连接成功" : "测试失败"}
                      </span>
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-slate-600 text-sm leading-relaxed text-left max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar break-all">
                        {testResult?.message}
                        {testResult?.latency_ms ? (
                          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
                            <span className="font-medium">响应延迟</span>
                            <span className={`px-2 py-0.5 rounded-md font-bold ${testResult.latency_ms < 500 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : testResult.latency_ms < 1500 ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                              {testResult.latency_ms}ms
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="sm:justify-end mt-2 pt-2">
                    <AlertDialogAction className="bg-slate-900 border border-slate-800 text-white shadow hover:bg-slate-800 hover:text-slate-50 rounded-xl px-8 h-10 font-medium w-full sm:w-auto">
                      我知道了
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Create/Edit Form */}
              {(showCreateForm || editingConfig) && (
                <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
                  <h4 className="font-medium text-slate-900">
                    {editingConfig ? "编辑配置" : "新建配置"}
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>模型名称</Label>
                      <Input
                        value={formModelName}
                        onChange={(e) => setFormModelName(e.target.value)}
                        placeholder="例如: gpt-4, deepseek-chat"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>API Base URL</Label>
                      <Input
                        value={formApiUrl}
                        onChange={(e) => setFormApiUrl(e.target.value)}
                        placeholder="例如: https://api.openai.com/v1"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>API Key {editingConfig && "(留空保持原值)"}</Label>
                      <Input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder={editingConfig ? "留空则保持原 API Key" : "输入 API Key"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Temperature (0-2)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={formTemperature}
                        onChange={(e) => setFormTemperature(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        min="100"
                        max={MAX_LLM_OUTPUT_TOKENS}
                        value={formMaxTokens}
                        onChange={(e) => setFormMaxTokens(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>超时时间 (秒)</Label>
                      <Input
                        type="number"
                        min="5"
                        max="120"
                        value={formTimeout}
                        onChange={(e) => setFormTimeout(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleTestConfig()}
                      disabled={testingConfig || !formApiUrl || (!formApiKey && !editingConfig) || !formModelName}
                    >
                      {testingConfig ? "测试中..." : "测试连接"}
                    </Button>
                    <Button
                      onClick={editingConfig ? handleUpdateConfig : handleCreateConfig}
                      disabled={savingConfig}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {savingConfig ? "保存中..." : (editingConfig ? "更新配置" : "创建配置")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingConfig(null)
                        resetForm()
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* Add New Button */}
              {!showCreateForm && !editingConfig && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button
                    onClick={() => {
                      resetForm()
                      setShowCreateForm(true)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加配置
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-2 border-slate-100 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle>密码与安全</CardTitle>
              <CardDescription>定期修改密码以保障您的账户安全。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* 隐藏的用户名输入框，用于协助浏览器正确关联凭据，防止填入搜索栏 */}
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  style={{ display: 'none' }}
                  aria-hidden="true"
                  defaultValue={profile?.user_id?.toString()}
                />

                <div className="space-y-2">
                  <Label htmlFor="current-password">当前密码</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="输入当前使用的密码"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">新密码</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="输入至少 6 位的新密码"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">确认新密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码以确认"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {changingPassword ? "更新中..." : "更新密码"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-50 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-red-700">危险区域</CardTitle>
              <CardDescription>
                一旦注销账号，您的所有学习记录、AI 记忆和配置都将被永久删除且无法恢复。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-100">
                <div>
                  <h4 className="font-bold text-red-900">注销此账号</h4>
                  <p className="text-xs text-red-700 mt-1">此操作不可撤销，请谨慎操作。</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteAccountDialog(true)}
                >
                  注销账号
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deleteLLMDialog.open}
        onOpenChange={(open) => setDeleteLLMDialog({ open, config: null })}
        onConfirm={() => deleteLLMDialog.config && handleDeleteConfig(deleteLLMDialog.config.id)}
        title="删除AI模型配置"
        description={deleteLLMDialog.config
          ? `确定要删除「${getRoleName(deleteLLMDialog.config.model_role)}」的配置吗？\n模型: ${deleteLLMDialog.config.model_name}\n\n此操作不可撤销。`
          : "确定要删除此配置吗？"
        }
        confirmText="删除"
        variant="destructive"
      />

      <ConfirmDialog
        open={deleteAccountDialog}
        onOpenChange={setDeleteAccountDialog}
        onConfirm={handleDeleteAccount}
        title="注销账号"
        description="确定要注销您的账号吗？此操作将永久删除您的所有个人资料、学习记录和配置，且无法恢复。"
        confirmText={deletingAccount ? "处理中..." : "确定注销"}
        variant="destructive"
      />
    </div>
  )
}
