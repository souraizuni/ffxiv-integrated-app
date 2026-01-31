# 🚀 部署指南 - 合并到 Main 分支

由于权限限制，这里提供三种部署方法供你选择：

---

## 方法 1：自动部署脚本（推荐）✨

### 执行步骤

1. **赋予脚本执行权限**
```bash
chmod +x ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/deploy.sh
```

2. **运行部署脚本**
```bash
bash ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/deploy.sh
```

3. **访问输出的 PR 链接**
   - 脚本会自动创建分支、提交代码并推送
   - 然后输出创建 PR 的链接
   - 点击链接创建 Pull Request

4. **审查并合并**
   - 检查 PR 中的更改
   - 点击 "Merge pull request"
   - 自动部署将启动

---

## 方法 2：手动 Git 操作

### 步骤 1：克隆仓库
```bash
cd ~/projects
git clone https://github.com/souraizunimoltbot/ffxiv-integrated-app.git
cd ffxiv-integrated-app
```

### 步骤 2：创建新分支
```bash
git checkout -b feature/solver-settings-dialog
```

### 步骤 3：复制文件
```bash
# 复制主组件
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/solver-settings-dialog.tsx \
   ./components/

# 创建文档目录
mkdir -p ./docs/solver-optimization

# 复制文档
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/INTEGRATION_GUIDE.md \
   ./docs/solver-optimization/
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/SUMMARY.md \
   ./docs/solver-optimization/
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/README.md \
   ./docs/solver-optimization/
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/usage-example.tsx \
   ./docs/solver-optimization/
```

### 步骤 4：提交更改
```bash
git add .
git commit -m "feat: 添加求解器设置弹窗组件

✨ 新功能：
- 添加完整的求解器设置弹窗组件
- 实现 HQ 材料自动计算初期品质功能
- 支持食物药水选择和属性加成显示
- 支持制作者数值编辑和预设配置
- 完整的求解器选项配置
- 响应式设计和暗色模式支持

📚 文档：
- 详细的集成指南
- 完整的 API 文档
- 使用示例代码
- 技术实现文档

参考项目：ffxiv-best-craft
代码量：2,016 行
文档：15,000+ 字"
```

### 步骤 5：推送到 GitHub
```bash
git push -u origin feature/solver-settings-dialog
```

### 步骤 6：创建 Pull Request
1. 访问：https://github.com/souraizunimoltbot/ffxiv-integrated-app
2. 点击 "Compare & pull request" 按钮
3. 填写 PR 信息（参考提交信息）
4. 点击 "Create pull request"

### 步骤 7：合并到 Main
1. 审查 PR
2. 点击 "Merge pull request"
3. 确认合并
4. 自动部署启动

---

## 方法 3：直接推送到 Main（快速但不推荐）

⚠️ **警告**：直接推送到 main 会跳过审查流程

```bash
cd ~/projects
git clone https://github.com/souraizunimoltbot/ffxiv-integrated-app.git
cd ffxiv-integrated-app

# 复制文件（同方法 2）
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/solver-settings-dialog.tsx \
   ./components/

mkdir -p ./docs/solver-optimization
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/*.md \
   ./docs/solver-optimization/
cp ~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/usage-example.tsx \
   ./docs/solver-optimization/

# 提交并推送
git add .
git commit -m "feat: 添加求解器设置弹窗组件"
git push origin main
```

---

## 方法 4：使用 GitHub Web Interface

如果无法使用命令行，可以通过 Web 界面上传：

### 步骤 1：准备文件
文件位置：`~/.copilot/session-state/252d50dc-13e7-4f52-9c03-5ef63ed59ef1/files/`

### 步骤 2：创建分支
1. 访问：https://github.com/souraizunimoltbot/ffxiv-integrated-app
2. 点击分支下拉菜单
3. 输入：`feature/solver-settings-dialog`
4. 点击 "Create branch"

### 步骤 3：上传主组件
1. 在新分支中，导航到 `components` 目录
2. 点击 "Add file" > "Upload files"
3. 上传 `solver-settings-dialog.tsx`
4. 提交更改

### 步骤 4：上传文档
1. 创建 `docs/solver-optimization` 目录
2. 上传所有 `.md` 文件和 `usage-example.tsx`
3. 提交更改

### 步骤 5：创建 PR 并合并
（同方法 2 的步骤 6-7）

---

## 📋 文件清单

确保以下文件都已上传：

### 核心组件（必需）
- [x] `components/solver-settings-dialog.tsx` - 主组件

### 文档（可选但推荐）
- [x] `docs/solver-optimization/INTEGRATION_GUIDE.md` - 集成指南
- [x] `docs/solver-optimization/SUMMARY.md` - 技术文档
- [x] `docs/solver-optimization/README.md` - 快速导航
- [x] `docs/solver-optimization/usage-example.tsx` - 使用示例

---

## 🔍 部署后验证

### 1. 检查文件是否存在
访问：`https://github.com/souraizunimoltbot/ffxiv-integrated-app/blob/main/components/solver-settings-dialog.tsx`

### 2. 检查自动部署状态
1. 前往仓库的 "Actions" 标签页
2. 查看最新的工作流运行状态
3. 等待部署完成（通常 5-10 分钟）

### 3. 验证部署结果
访问部署的网站，测试求解器功能

---

## 🆘 遇到问题？

### 权限问题
确保你有仓库的写入权限：
```bash
git remote -v
git config user.name
git config user.email
```

### 推送失败
可能需要先拉取最新代码：
```bash
git pull origin main
git push origin feature/solver-settings-dialog
```

### 合并冲突
如果有冲突，手动解决后：
```bash
git add .
git commit -m "resolve conflicts"
git push
```

---

## 📞 需要帮助？

1. 查看 GitHub 仓库的 Actions 日志
2. 检查 Pull Request 的评论
3. 查看部署日志（如果是 Vercel/Netlify）

---

**选择方法 1（自动脚本）最简单！** 🚀

只需运行一个命令，脚本会帮你完成所有操作。
