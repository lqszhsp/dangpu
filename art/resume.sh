#!/bin/bash
# 等中转恢复后续跑批量，直到一张不缺；每轮跑完做一次后期
source ~/.profile
cd /home/a/dangpu/game/art
for round in $(seq 1 40); do
  until c=$(curl --http1.1 -sS -m 240 -o /tmp/probe/ping.json -w "%{http_code}" "$GPT_IMAGE_BASE_URL/v1/images/generations" -H "Authorization: Bearer $GPT_IMAGE_API_KEY" -H "Content-Type: application/json" -d '{"model":"gpt-image-2.5-sunburst-adobe","prompt":"a red apple","size":"1024x1024","quality":"low"}'); [ "$c" = 200 ]; do
    echo "$(date +%T) relay $c $(head -c 90 /tmp/probe/ping.json)"; sleep 240; done
  echo "$(date +%T) round $round"
  python3 ~/.codex/skills/gpt-image/scripts/gpt_image.py batch manifest.json --jobs 6 > batch_round.log 2>&1
  tail -1 batch_round.log
  (cd .. && python3 tools/art/postprocess.py)
  left=$(python3 -c "import json,os; print(sum(not os.path.exists(j['out']) for j in json.load(open('manifest.json'))))")
  echo "missing $left"
  [ "$left" = 0 ] && break
  # 一轮下来一张没少：多半是审核拒绝之类的硬失败，停下来人工处理
  [ "$left" = "${prev:-x}" ] && { echo "stuck"; break; }
  prev=$left
done
