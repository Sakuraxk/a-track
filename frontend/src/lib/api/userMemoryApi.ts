import { api } from "../api"

// Types
export interface UserPreference {
    id: string
    user_id: string
    preference_key: string
    preference_value: string
    confidence_score: number
    evidence_count: number
    last_observed_at: string
    created_at: string
    updated_at: string
}

export interface LearningPattern {
    id: string
    user_id: string
    pattern_type: string
    pattern_description: string
    pattern_data: Record<string, any>
    evidence_count: number
    confidence: number
    first_observed_at: string
    last_observed_at: string
    updated_at: string
}


export interface BehaviorMemory {
    id: string
    user_id: string
    behavior_type: string
    context: string | null
    event_metadata: Record<string, any>
    created_at: string
}

export interface PreferenceListResponse {
    preferences: UserPreference[]
    total: number
}

export interface PatternListResponse {
    patterns: LearningPattern[]
    total: number
}


export interface BehaviorListResponse {
    behaviors: BehaviorMemory[]
    total: number
}

// API Functions

/**
 * 获取用户偏好列表
 */
export async function getUserPreferences(params?: {
    min_confidence?: number
    limit?: number
}): Promise<PreferenceListResponse> {
    const response = await api.get<PreferenceListResponse>("/api/user-memory/preferences", {
        params
    })
    return response.data
}

/**
 * 获取用户学习模式
 */
export async function getUserPatterns(params?: {
    pattern_type?: string
    min_confidence?: number
    limit?: number
}): Promise<PatternListResponse> {
    const response = await api.get<PatternListResponse>("/api/user-memory/patterns", {
        params
    })
    return response.data
}

/**
 * 获取用户行为历史
 */
export async function getBehaviorHistory(params?: {
    limit?: number
    behavior_type?: string
}): Promise<BehaviorListResponse> {
    const response = await api.get<BehaviorListResponse>("/api/user-memory/behaviors", {
        params
    })
    return response.data
}




/**
 * 清除所有用户记忆数据
 */
export async function clearAllMemories(): Promise<{ message: string; deleted_counts: Record<string, number> }> {
    const response = await api.delete("/api/user-memory/clear")
    return response.data
}
