#!/usr/bin/env bash
# 给一局测试准备独立的游戏副本：只拷玩游戏要用的文件，测试玩家改了也碰不到真正的仓库
# 用法：tools/playtest/sandbox.sh <目标目录>
set -euo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"; DST="$1"
mkdir -p "$DST/game/assets" "$DST/game/tools"
cp "$SRC/index.html" "$DST/game/"
cp -r "$SRC/js" "$SRC/guide" "$DST/game/"
cp -r "$SRC/tools/lib" "$SRC/tools/play" "$DST/game/tools/"
cp "$SRC/assets/art.js" "$DST/game/assets/"
# 记下副本的指纹，测完对一遍，看有没有人动过游戏文件
(cd "$DST/game" && find . -type f | sort | xargs sha1sum) > "$DST/game.sha1"
