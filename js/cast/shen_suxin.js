// 沈素心：巷口女郎中。Qwen 3.0 Pro 生态扩展角色；独立样貌与处境。
'use strict';

defineCharacter(ecologyCharacter({
  "id": "shen_suxin",
  "name": "沈素心",
  "faction": "ren",
  "sex": "f",
  "title": "巷口女郎中",
  "age": 37,
  "art": "a 37-year-old Chinese woman physician, broad practical face, simple ash-blue cross-collar work robe, pulse cushion and woven medicine basket, practical tied hair",
  "problem": "矿工的咳血不肯停，药铺却只许成盒卖药。她想拆零配药，缺一笔周转钱。",
  "pressure": "药铺掌柜指她用了禁药，逼她交出病人名册。",
  "success": "她在旧井边重新开诊，把欠账写在自己的药箱底。",
  "failure": "她的药箱被封，矿工只得再去排高价药队。",
  "item": "herb_blood",
  "start_day": 9,
  "cost": 50,
  "clique": "law",
  "healer": { "heals": ["injured", "poisoned"], "fee": 30 }
}));
