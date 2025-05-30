#!/bin/bash

# 禁用BuildKit
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

# 推荐用环境变量传递账号密码，避免明文
ALIYUN_USERNAME="柏雨龙帅"
ALIYUN_PASSWORD="19980720b"


# 开启错误检测
set -e

# 函数：错误处理
error_handler() {
    echo "错误: 命令执行失败，部署中止"
    exit 1
}

# 设置错误捕获
trap 'error_handler' ERR

# 获取当前年月日时分秒
TIMESTAMP=$(date +%Y%m%d%H%M%S)
echo "开始构建，标签: $TIMESTAMP"

echo "安装依赖..."
npm install 

npm run build

# 构建Docker镜像，强制使用缓存
echo "构建Docker镜像..."
docker buildx build --platform linux/amd64 --load --pull=false --no-cache=false -t bhs-ai:$TIMESTAMP . || error_handler

# 打标签
docker login --username $ALIYUN_USERNAME --password $ALIYUN_PASSWORD registry.cn-shanghai.aliyuncs.com
echo "打标签..."
docker tag bhs-ai:$TIMESTAMP registry.cn-shanghai.aliyuncs.com/bhstech/bhs-ai:$TIMESTAMP || error_handler

# 推送到阿里云镜像仓库
echo "推送到阿里云镜像仓库..."
docker push registry.cn-shanghai.aliyuncs.com/bhstech/bhs-ai:$TIMESTAMP || error_handler

# 保存镜像标签到文件
echo "保存镜像标签..."
echo $TIMESTAMP > ./latest-image-tag.txt
echo "镜像标签已保存到 latest-image-tag.txt 文件"

# Git操作：添加标签文件、提交并推送到远程仓库
echo "提交Git更新..."
git add . || true
git commit -m "更新镜像标签: $TIMESTAMP" || true
git push || true  # Git操作失败不应该影响部署

echo "Git更新已推送"

# 服务器从阿里云拉取容器
# docker pull registry.cn-shanghai.aliyuncs.com/bhstech/bhs-ai:[镜像版本号]

# 服务器上运行
# docker run -d -p 3000:3000 --name bhs-ai --network nest-app-network registry.cn-shanghai.aliyuncs.com/bhstech/bhs-ai:$TIMESTAMP

echo "===== 构建完成 ====="
echo "已构建镜像: bhs-ai:$TIMESTAMP" 
echo "阿里云镜像: registry.cn-shanghai.aliyuncs.com/bhstech/bhs-ai:$TIMESTAMP" 