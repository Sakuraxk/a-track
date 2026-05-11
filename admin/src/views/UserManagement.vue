<template>
  <div>
    <!-- 筛选栏 -->
    <div class="filter-bar animate-in">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户姓名 / 邮箱 / 手机号"
        :prefix-icon="Search"
        clearable
        style="width: 280px;"
        @input="handleSearch"
      />
      <el-select v-model="filterSubject" placeholder="选修学科" clearable style="width: 160px;" @change="handleSearch">
        <el-option v-for="s in subjects" :key="s.key" :label="s.name" :value="s.name" />
      </el-select>
      <el-select v-model="filterLevel" placeholder="用户水平" clearable style="width: 120px;" @change="handleSearch">
        <el-option label="初级" value="初级" />
        <el-option label="中级" value="中级" />
        <el-option label="高级" value="高级" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="用户状态" clearable style="width: 120px;" @change="handleSearch">
        <el-option label="活跃" value="活跃" />
        <el-option label="不活跃" value="不活跃" />
        <el-option label="已流失" value="已流失" />
      </el-select>
      <div style="flex: 1;"></div>
      <el-button type="primary" :icon="Download" @click="handleExport">导出数据</el-button>
    </div>

    <!-- 数据表格 -->
    <div class="chart-card animate-in animate-in-delay-2" style="padding: 0;">
      <el-table :data="tableData" style="width: 100%;" stripe v-loading="loading" row-key="id">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="name" label="姓名" width="120" sortable>
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img :src="row.avatar" style="width:28px; height:28px; border-radius:50%;" />
              <span class="user-name-link" @click="$router.push(`/users/${row.id}`)">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" width="210" show-overflow-tooltip />
        <el-table-column prop="gender" label="性别" width="60" />
        <el-table-column prop="enrolledSubjects" label="选修学科" min-width="220">
          <template #default="{ row }">
            <el-tag v-for="s in row.enrolledSubjects" :key="s" size="small" color="rgba(0,184,255,0.1)" style="margin: 2px; border: 1px solid rgba(0,184,255,0.3); color: #00b8ff; font-weight: 500;" round>
              {{ s }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="levelLabel" label="水平" width="90" sortable />
        <el-table-column prop="totalStudyDurationFormatted" label="学习时长" width="120" sortable :sort-by="'totalStudyDuration'" />
        <el-table-column prop="correctRate" label="正确率" width="100" sortable>
          <template #default="{ row }">
            <span :style="{ color: row.correctRate >= 80 ? '#22c55e' : row.correctRate >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 600 }">
              {{ row.correctRate }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="aiInteractionCount" label="AI对话" width="100" sortable />
        <el-table-column prop="statusLabel" label="状态" width="100" sortable>
          <template #default="{ row }">
            <span class="status-tag" :class="row.status">{{ row.statusLabel }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastLogin" label="最后登录" width="130" sortable />
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/users/${row.id}`)">查看概览</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div style="padding: 12px 20px; display:flex; align-items:center; justify-content:space-between; border-top: 1px solid var(--border);">
        <span style="font-size: 13px; color: var(--text-secondary);">
          共 {{ filteredList.length }} 条记录
        </span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredList.length"
          layout="sizes, prev, pager, next, jumper"
          @size-change="handlePageChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Download } from '@element-plus/icons-vue'
import { userList, subjects } from '../mock/mockData.js'

const searchKeyword = ref('')
const filterSubject = ref('')
const filterLevel = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const filteredList = computed(() => {
  let list = [...userList]
  
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(u =>
      u.name?.includes(kw) || u.email?.includes(kw) || u.phone?.includes(kw)
    )
  }
  
  if (filterSubject.value) {
    list = list.filter(u => u.enrolledSubjects.includes(filterSubject.value))
  }
  
  if (filterLevel.value) {
    list = list.filter(u => u.levelLabel === filterLevel.value)
  }
  
  if (filterStatus.value) {
    list = list.filter(u => u.statusLabel === filterStatus.value)
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

function handlePageChange() {
  // reactive computation handles this
}

function handleExport() {
  ElMessageBox.confirm(
    '确认要导出当前筛选条件下的全部用户数据吗？',
    '数据导出确认',
    {
      confirmButtonText: '确认导出',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    ElMessage({
      type: 'success',
      message: '数据正在打包中，稍后将自动开始下载...',
    })
  }).catch(() => {})
}
</script>
