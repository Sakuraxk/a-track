<template>
  <div>
    <!-- 统计卡片 -->
    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :lg="6" style="margin-bottom: 24px;">
        <div class="stat-card primary animate-in animate-in-delay-1">
          <div class="stat-header">
            <span class="stat-title">帖子总数</span>
            <div class="stat-icon"><el-icon><Document /></el-icon></div>
          </div>
          <div class="stat-value">{{ communityPosts.length }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" style="margin-bottom: 24px;">
        <div class="stat-card success animate-in animate-in-delay-2">
          <div class="stat-header">
            <span class="stat-title">总点赞数</span>
            <div class="stat-icon"><el-icon><Star /></el-icon></div>
          </div>
          <div class="stat-value">{{ totalLikes }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" style="margin-bottom: 24px;">
        <div class="stat-card info animate-in animate-in-delay-3">
          <div class="stat-header">
            <span class="stat-title">总评论数</span>
            <div class="stat-icon"><el-icon><ChatDotSquare /></el-icon></div>
          </div>
          <div class="stat-value">{{ totalComments }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" style="margin-bottom: 24px;">
        <div class="stat-card danger animate-in animate-in-delay-4">
          <div class="stat-header">
            <span class="stat-title">被举报帖子</span>
            <div class="stat-icon"><el-icon><Warning /></el-icon></div>
          </div>
          <div class="stat-value">{{ reportedCount }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 筛选 -->
    <div class="filter-bar animate-in animate-in-delay-3">
      <el-input v-model="searchKeyword" placeholder="搜索帖子标题 / 作者" :prefix-icon="Search" clearable style="width: 260px;" @input="handleSearch" />
      <el-select v-model="filterTag" placeholder="标签筛选" clearable style="width: 140px;" @change="handleSearch">
        <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 120px;" @change="handleSearch">
        <el-option label="正常" value="normal" />
        <el-option label="被举报" value="reported" />
      </el-select>
    </div>

    <!-- 帖子列表 -->
    <div class="chart-card animate-in animate-in-delay-4" style="padding: 0;">
      <el-table :data="tableData" style="width: 100%;" stripe>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="font-weight: 500;">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="authorName" label="作者" width="100" />
        <el-table-column prop="tags" label="标签" width="180">
          <template #default="{ row }">
            <el-tag v-for="tag in row.tags" :key="tag" size="small" style="margin: 1px;" effect="plain" round>{{ tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="likesCount" label="👍 点赞" width="80" sortable />
        <el-table-column prop="commentsCount" label="💬 评论" width="80" sortable />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'normal' ? 'success' : 'danger'" size="small" effect="plain">
              {{ row.status === 'normal' ? '正常' : '被举报' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="发布时间" width="170" sortable />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small">查看</el-button>
            <el-button link type="warning" size="small" v-if="row.status === 'reported'">处理</el-button>
            <el-popconfirm title="确定删除该帖子？" @confirm="handleDelete(row)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div style="padding: 12px 20px; display:flex; align-items:center; justify-content:space-between; border-top: 1px solid var(--border);">
        <span style="font-size: 13px; color: var(--text-secondary);">共 {{ filteredList.length }} 条记录</span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="filteredList.length"
          layout="sizes, prev, pager, next"
          @size-change="handleSearch"
          @current-change="handleSearch"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { communityPosts } from '../mock/mockData.js'
import { ElMessage } from 'element-plus'

const searchKeyword = ref('')
const filterTag = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

const allTags = ['Python', '机器学习', '数学', '英语', '语文', 'MindSpore', '学习方法', '经验分享', '求助', '讨论']

const totalLikes = computed(() => communityPosts.reduce((a, p) => a + p.likesCount, 0))
const totalComments = computed(() => communityPosts.reduce((a, p) => a + p.commentsCount, 0))
const reportedCount = computed(() => communityPosts.filter(p => p.status === 'reported').length)

const filteredList = computed(() => {
  let list = [...communityPosts]
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(p => p.title.includes(kw) || p.authorName.includes(kw))
  }
  if (filterTag.value) {
    list = list.filter(p => p.tags.includes(filterTag.value))
  }
  if (filterStatus.value) {
    list = list.filter(p => p.status === filterStatus.value)
  }
  return list
})

const tableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

function handleSearch() {
  currentPage.value = 1
}

function handleDelete(row) {
  const idx = communityPosts.findIndex(p => p.id === row.id)
  if (idx >= 0) communityPosts.splice(idx, 1)
  ElMessage.success('帖子已删除')
}
</script>
