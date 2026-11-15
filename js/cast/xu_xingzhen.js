// 许行针：行脚女医修。Qwen 3.0 Pro 生态扩展角色；独立样貌与处境。
'use strict';

defineCharacter(ecologyCharacter({
  "id": "xu_xingzhen",
  "name": "许行针",
  "faction": "ren",
  "sex": "f",
  "title": "行脚女医修",
  "age": 49,
  "art": "a 49-year-old Chinese female travelling spiritual physician, lined mature face, faded protective shoulder cape over full-cover travelling robe, needle pouch and medicine gourd, dusty boots, no glamorous styling",
  "problem": "军伤的灵力瘀结拖了太久，她想买旧针材给走不动的人解脉。",
  "pressure": "军医署要她把伤兵写成装病，才能在关口通行。",
  "success": "伤兵领回通行凭证，她的针囊多出几道补线。",
  "failure": "装病的罪名贴在关口，她带着针绕远路去看他们。",
  "item": "herb_dew",
  "start_day": 60,
  "cost": 70,
  "clique": "law",
  "healer": { "heals": ["injured", "poisoned", "deviation"], "fee": 45 }
}));
