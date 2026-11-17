# 《魔门当铺》写实美术清单：每张图画什么。build_manifest.py 据此生成 gpt-image 批量清单
# 风格：真人写实 · 东方玄幻（见 ~/.codex/skills/gpt-image/reference/style-realistic-xianxia.md）

ITEM_PREFIX = ('Photorealistic product photograph of a Chinese xianxia artifact for a dark fantasy game inventory: {d}. '
               'Real aged materials and textures, dramatic studio lighting with warm key light and cold purple rim light, '
               'subtle magical glow where it fits. The single object is centered and fills most of the frame, seen at a slight three-quarter angle. '
               'Isolated object, transparent background, no ground, no text, no letters.')

PORTRAIT_PREFIX = ('Cinematic photorealistic film still from a high-budget Chinese xianxia costume drama. Exactly one person in the image, alone. A real human actor, full body standing, '
                   'facing the camera and looking straight into it, as if standing in front of a pawnshop counter and about to talk to the shopkeeper. {d}. '
                   'Moody low-key lighting: warm red lantern key light from the left, cold purple rim light, skin pores and fabric texture visible, 85mm lens. '
                   'Isolated subject with the whole body visible from head to feet, transparent background, no text.')

SCENE_PREFIX = ('Photorealistic wide film set photograph for a Chinese xianxia dark fantasy, {d}. Demonic sect, blood-red moon, red paper lanterns, '
                'drifting purple mist, cinematic color grading, high detail, no people, no text, no letters.')

MACHINE_PREFIX = ('Photorealistic prop photograph of xianxia workshop equipment: {d}. Real materials, dramatic lighting, three-quarter view, '
                  'whole object visible and centered. Isolated, transparent background, no text.')

ICON_PREFIX = ('Photorealistic small game icon: {d}. A single object with a bold, instantly readable silhouette, centered, strong rim light, '
               'high contrast so it reads at 24 pixels. Isolated, transparent background, no text.')

# 物品：英文画面描述（中文描述多讲用途，这里讲长相）
ITEMS = {
    'scrap_sword': 'a broken rusty sword blade snapped in half with a cracked hilt wrapped in rotten cloth, vertical',
    'iron_ore': 'a lump of dark meteoric iron ore with glinting dark-blue metallic veins',
    'iron_ingot': 'a dark blue-black forged iron ingot shaped like a boat-shaped Chinese ingot, faint cold sheen',
    'filter_sand': 'a small hemp sack of pale glittering spirit-filter sand, sand spilling from the mouth',
    'herb_seed': 'a small open paper packet of luminous green spirit herb seeds',
    'herb_dew': 'a bundle of slender silver-green spirit grass with dew drops glowing like pearls',
    'herb_blood': 'a large blood-red lingzhi mushroom with glossy lacquer-like cap and dark crimson veins',
    'yao_core': 'a demon core: a glowing amber orb the size of a walnut with a slit-pupil light inside, wisps of demonic aura',
    'beast_hide': 'a folded thick demon beast pelt with tiger-like black and orange stripes and faint glowing runes',
    'bones': 'a small pile of old yellowed human bones, a cracked jawbone on top',
    'gu_egg': 'one single speckled dark purple gu insect egg resting on a wisp of cobweb, only one egg',
    'gu_young': 'a young venomous gu worm, translucent pale purple centipede-like larva coiled on a black lacquer dish',
    'gu_gold': 'a golden silkworm gu: a fat glittering golden insect with metallic segments, menacing',
    'spirit_fruit': 'a luminous peach-like spirit fruit, pale pink skin glowing softly, with a green leaf',
    'yeast': 'a cake of Chinese wine yeast qu, rough grey-brown brick wrapped in rice straw',
    'spirit_wine': 'a tall glazed celadon wine jar sealed with red cloth and twine, fragrant mist rising, vertical',
    'spirit_crystal': 'a hexagonal violet spirit crystal shard glowing from within',
    'broken_bowl': 'a cracked old bronze monk alms bowl with dented rim',
    'pill_qi': 'a single round jade-green elixir pill on a small white porcelain dish, faint green qi steam rising',
    'pill_blood': 'a single dark crimson blood elixir pill with black veins on a black lacquer dish, red mist',
    'pill_found': 'a single golden foundation-building elixir pill engraved with cloud patterns, in an open red silk box',
    'pill_recipe': 'an old rolled alchemy recipe scroll tied with red cord, faded brush diagrams of furnaces visible',
    'jade_slip': 'a long rectangular translucent green jade slip inscribed with tiny glowing engravings',
    'sword_std': 'a standard demonic sect flying sword: straight double-edged steel blade with dark red tassel, black hilt, vertical, pointing down',
    'soul_banner': 'a soul-devouring war banner: black silk banner on a bone pole, ghostly faces swirling in the cloth, dark aura, vertical',
    'xian_sword': 'an immortal sect sword: white jade hilt, gleaming silver blade with pale blue light, cloud engravings, vertical',
    'xian_talisman': 'a pale yellow Taoist protection talisman with vermilion brush seal patterns glowing faint blue',
    'xian_robe': 'a folded white and azure immortal sect Taoist robe with cloud embroidery',
    'demon_charm': 'a black iron demon sect amulet with a blood-red rune, hanging on a red cord',
    'jade_pendant': 'an antique white jade pendant carved with a coiled dragon, red silk tassel',
    'bronze_mirror': 'an ancient Chinese bronze mirror with eight-petal lobed rim, verdigris patina, reflective face slightly turned',
    'scroll_manual': 'a torn ancient cultivation manual scroll, burnt edges, faded diagrams of meridians, vertical',
    'fire_disk': 'a bronze formation disk engraved with flame trigrams, small embers glowing in the grooves',
    'dan_fire': 'an octagonal red-copper alchemy formation disk with a small pill furnace engraved at its center, jade inlays at the eight corners, cinnabar flame runes glowing in the grooves, a small steady flame hovering above the furnace',
    'soul_bell': 'a black bronze soul-capturing bell with skull handle, pale ghost wisp curling from inside',
    'soul_wisp': 'a small wandering ghost wisp, pale blue-white flame with a faint sorrowful face, trapped in a small glass jar',
    'soul_grudge': 'a vengeful spirit: a dark red ghost flame with a screaming face, trapped in a cracked black jar',
    'soul_pearl': 'a soul refining pearl: a dark violet orb with swirling pale blue soul threads inside, on a bone claw stand',
    'corpse': 'a human-shaped bundle wrapped in an old straw mat tied with rope, bare feet sticking out at one end, vertical',
    'iron_corpse': 'an iron-skinned jiangshi corpse standing stiff, grey metallic skin, Qing-style robe, yellow talisman on forehead, vertical full body',
    'corpse_poison': 'a small black ceramic vial dripping green corpse poison, toxic vapor',
    'puppet_doll': 'a mechanical war puppet of dark iron and wood with a glowing violet soul-pearl heart, standing, vertical full body',
    'puppet_scroll': 'a scroll of mechanical puppet blueprints, intricate joint diagrams, held by a bronze clip',
    'mihun_seed': 'a pinch of iridescent purple flower seeds on a dark leaf',
    'mihun_flower': 'a bewitching purple-pink flower with luminous pollen drifting, hypnotic',
    'wangyou': 'a small folded paper packet of pale pink powder, a little spilled, sweet glowing dust',
    'vine_seed': 'one small hard seed the size of a fingertip: dry dark-red woody husk with tiny thorns, shaped faintly like a heart, with a couple of even smaller seeds beside it, not juicy, no leaves, no vine',
    'vine_fruit': 'a blood-red glistening fruit on a thorny vine, juice like blood',
    'broken_relic': 'a broken ancient magic weapon fragment: a cracked bronze halberd head covered in dust and faded runes, vertical',
    'waste_pill': 'a lumpy charred failed elixir pill, cracked and blackened, faint wisp of smoke',
    'spirit_sand': 'a crystal dish of glowing pure white spirit sand, fine and shining',
    'dan_guide': 'a tiny luminous golden pill-guide bead glowing like a firefly ember with a wisp of flame inside, resting on a small square of folded red paper, no cup, no bowl, no container',
    'beast_feed': 'compressed brown spirit beast feed cakes with glowing green flecks',
    'treasure_rat': 'a plump golden-furred treasure rat with ruby eyes holding a coin, cute but uncanny',
    'gold_bug': 'a metal-eating beetle with shimmering gold-bronze carapace, mandibles chewing a nail',
    'fu_paper': 'a stack of blank yellow talisman papers tied with string',
    'cinnabar': 'a small dish of bright vermilion cinnabar powder with a cinnabar stick',
    'fu_jingang': 'a golden vajra protection talisman with bold red seals, faint golden shield light',
    'fu_shehun': 'a black talisman with silver ghost-binding script, a wisp of soul trapped in the paper',
    'zhen_fu': 'a formation talisman with a red flame array diagram, glowing orange',
    'seal_xian': 'an orthodox sect seal talisman: white paper with an elegant blue official seal impression',
    'jade_bottle': 'a slender white jade vase bottle with a narrow neck, empty, elegant',
    'xuan_essence': 'a palm-sized refined black iron essence crystal, dense and heavy, deep blue inner glow',
    'god_blank': 'a divine weapon blank: an unfinished long blade forging blank of dark star-metal glowing with molten lines, vertical',
    'incense': 'a bundle of calming incense sticks in a small bronze censer, curling smoke',
    'lens1': 'a bronze-framed demon-revealing magnifying mirror lens',
    'lens2': 'a jade-chalcedony framed demon-revealing lens with glowing green edge',
    'lens3': 'a bone-white framed spirit lens showing ghostly skeleton reflection',
    'lens4': 'a heavenly eye pearl: a luminous pearl with an eye-like iris inside',
    'bone_flute': 'a flute carved from a demon beast bone with dark runes, vertical',
    'cult_corpse': 'the corpse of a cultivator in tattered dark purple Taoist robes lying with hands folded, pale face, faint green spirit glow, vertical',
    'live_soul': 'a freshly torn-out human soul: a pale blue humanoid ghost with an anguished face, bound by red talisman threads',
    'blood_essence': 'a crystal vial of glowing crimson heart-blood essence with a gold stopper',
    'soul_crystal': 'a cluster of dark violet crystals with ghostly faces trapped inside, cold blue glow',
    'corpse_king': 'a jiangshi corpse king in bronze-black armor and crown, long black nails, glowing red eyes, talisman on forehead, vertical full body, imposing',
    'blood_infant': 'a large crimson elixir pill with a curled infant silhouette visible inside, resting on a dark lotus, blood-red halo',
    'demon_blade': 'a soul-devouring demon sword: black serrated blade with crimson edge, pale blue soul wisps coiling around, gold demon-face guard, vertical',
    'intel': 'a folded secret letter sealed with blood-red wax bearing an eye sigil, tied with red cord',
    'water_murky': 'a clay bottle of murky greyish spring water, cloudy',
    'water_clear': 'a glass bottle of clear spirit spring water with faint glow',
    'water_pure': 'a crystal bottle of perfectly pure rootless spirit water glowing pale blue',
    'water_jade': 'a white jade bottle overflowing with luminous jade nectar, radiant',
    'book_refine': 'an old thread-bound book on weapon refining, cover with hammer and anvil emblem',
    'book_alchemy': 'an old thread-bound alchemy book, cover with a furnace emblem',
    'book_soul': 'a black thread-bound soul refining grimoire with a ghost-face clasp',
    'book_corpse': 'a corpse refining manual bound in grey leather with nail studs',
    'book_puppet': 'a mechanist book with brass corners and gear emblem',
    'book_plant': 'a botanical book of spirit herbs with pressed leaves sticking out',
    'book_brew': 'a book of wine recipes stained with wine, gourd emblem',
    'book_water': 'a book on purifying spirit water with a blue wave emblem',
    'book_forgery': 'a suspicious book of forgery techniques with a fox mask emblem',
    'book_erase': 'a book of brand-erasing techniques, cover partly scraped',
    'book_talisman': 'a talisman manual with yellow pages and red seal on cover',
    'book_beast': 'a beast taming book with claw marks on the cover',
}
# 尺寸格（宽×高）不在此列的按 1×1
TALL = {'scrap_sword', 'spirit_wine', 'scroll_manual', 'corpse', 'broken_relic', 'god_blank', 'bone_flute', 'cult_corpse',
        'sword_std', 'xian_sword', 'iron_corpse', 'puppet_doll', 'corpse_king', 'demon_blade', 'soul_banner'}

# 品相四档（以 mid 为底图，其余用 edit 生成）
TIERS = {
    'low': 'worn-out low-grade version: chipped, scratched, dull, dirty and cheap-looking',
    'high': 'high-grade fine version: polished, finely crafted, rich materials, slight spiritual glow',
    'top': 'supreme masterwork version: exquisite, flawless, radiant golden-white spiritual aura surrounding it, small floating light motes',
}
NO_TIER = {'water_murky', 'water_clear', 'water_pure', 'water_jade', 'gu_egg', 'gu_young', 'gu_gold', 'spirit_crystal', 'intel',
           'lens1', 'lens2', 'lens3', 'lens4'}

# 状态变体：[底图, 变体名, 改什么]
STATES = [
    ('jade_pendant', 'revealed', 'it is now obviously a cheap fake: dyed bone instead of jade, paint flaking, crude carving'),
    ('bronze_mirror', 'revealed', 'it is now obviously a cheap fake: cast scrap iron with painted-on green patina peeling off'),
    ('pill_found', 'revealed', 'it is now obviously a fake pill: gold leaf peeling off revealing a plain green pill underneath'),
    ('corpse', 'rotting', 'the bundle is now long spoiled: the straw mat is soaked through with dark brown-black damp stains, fuzzy patches of green-white mould, frayed and torn rope, the bare feet turned grey-green and mottled, the whole bundle sagging, three or four small black flies hovering around it'),
    ('spirit_crystal', 'charged', 'the crystal is fully charged: blazing bright violet light, crackling energy'),
    ('spirit_crystal', 'dim', 'the crystal is drained: dull grey, almost no glow, a few cracks'),
    ('intel', 'expired', 'the letter is now old and useless: yellowed, torn, water-stained, wax seal broken'),
    ('herb_seed', 'sprout', 'the seeds have sprouted: small glowing green sprouts growing from soil in the packet'),
    ('mihun_seed', 'sprout', 'the seeds have sprouted: small purple sprouts with tiny buds'),
    ('vine_seed', 'sprout', 'the seed has sprouted a thorny blood-red tendril'),
    ('treasure_rat', 'young', 'a small young baby version of the same rat, tiny and fluffy'),
    ('gold_bug', 'young', 'a small young larva version of the same beetle, soft pale gold'),
]

# 人物：pid → 画面描述。泛泛之辈的类型另生成 _f1、_f2 两张不同面孔
PORTRAITS = {
    'beggar': 'an old one-eyed beggar in filthy patched rags holding a chipped bronze alms bowl, long grey matted hair, secretly shrewd look, Chinese man in his seventies',
    'beggar_master': 'the same kind of old one-eyed man revealed as a former demonic sect elder: tall, terrifying presence, blood-red robes over rags, crimson qi aura, long white hair',
    'amu_disciple': 'a sixteen-year-old boy now an outer disciple of a demonic sect, black and dark red uniform, proud but nervous, sword at waist',
    'broker': 'a ghost market broker wearing a lacquered white demon mask, hooded black robe, long fingernails, abacus on belt',
    'landlord': 'a fat greedy middle-aged demonic sect steward with thin mustache, rich purple silk robes, gold rings, ledger in hand, sly smile',
    'steward_sun': 'a stern middle-aged female deputy steward with neatly pinned hair, plain dark official robes, ledger and brush, incorruptible look',
    'swindler': 'a thin charming failed scholar swindler in a worn blue scholar robe, folding fan, cunning eyes',
    'thug': 'a bald scarred street thug with tattoos on his arms, open vest, iron club on shoulder, missing tooth grin',
    'mo_enforcer': 'a demonic sect enforcement hall inspector in black armored robe with red trim, iron mask half covering the face, cold eyes, chain whip',
    'mo_disciple': 'a young male outer disciple of a blood-demon sect, black robe with blood-red trim, arrogant, sword on back',
    'mo_senior': 'a beautiful cold female inner disciple of a demonic sect, elaborate black and crimson robes, jade hairpins, haughty',
    'ren_cultivator': 'a down-and-out rogue cultivator, middle-aged man in faded grey robes, old injury scar, tired eyes, worn sword',
    'ren_merchant': 'a mortal traveling merchant in simple brown clothes and straw hat, carrying pack, shrewd friendly face',
    'ren_kid': 'a thin fourteen-year-old servant boy in patched coarse clothes, carrying a carrying pole, hopeful eyes',
    'xian_defector': 'a righteous sect swordsman in disguise, plain traveling cloak over white robes, bamboo hat, upright bearing, wrapped sword',
    'xian_spy': 'a masked female immortal sect agent, white veil over lower face, pale blue and white robes under a dark cloak, sharp eyes',
    'yao_fox': 'a fox demon woman in human form: real actress with realistic fox ears and amber slit-pupil eyes, white fox tail, red and white robes',
    'yao_tiger': 'a tiger demon man in human form: huge muscular actor with tiger-stripe prosthetic markings, amber eyes, fur mantle, wild hair',
    'yao_snake': 'a snake demon woman in human form: real actress with subtle green scales on cheeks and neck, vertical pupils, dark green robes',
    'noble': 'an arrogant young aristocrat of a demonic sect, chin raised, contemptuous half-lidded eyes, ornate dark purple and gold robes, jade crown, folding fan',
}
GENERIC = ['ren_cultivator', 'ren_merchant', 'ren_kid', 'xian_defector', 'xian_spy', 'mo_disciple', 'mo_senior', 'yao_fox', 'yao_tiger', 'yao_snake', 'noble']
FACE_NOTE = {1: 'cast a clearly different actor for the same role: noticeably older (around 35-45), rugged weathered face, stubble or short beard, a visible scar, different hairstyle and a different pose (hands at the sides or holding something)',
             2: 'cast a clearly different actor for the same role: if the role allows, the opposite sex; distinctly different face shape, age and hairstyle, different build, and a different pose'}

# 个别身份的替换面孔要与身份相符（性别、年龄、标志性服饰），不能套用通用说明
FACE_OVERRIDE = {
    'xian_spy_f1': 'cast a different actress for the same masked female agent: older (around 35), stern and cold, also wearing a white silk veil over the lower face, different hairstyle',
    'xian_spy_f2': 'cast a different young actress for the same masked female agent: sharp-eyed, wearing a black gauze veil over the lower face, different hairstyle and slimmer build',
    'ren_kid_f1': 'cast a different teenage boy actor (about 15) for the same servant role: thinner, shaved head with a cloth headband, freckles, different pose',
    'ren_kid_f2': 'cast a different teenage boy actor (about 13) for the same servant role: chubby round face, messy topknot, different pose',
    'noble_f2': 'cast an actress instead: an arrogant young noblewoman of the demonic sect, contemptuous half-lidded eyes, chin raised, ornate dark purple and gold robes, jade-and-gold hair ornaments, holding a round silk fan',
    # 妖修驻颜有术，看上去总是年轻；狐妖照小说里的样子画，勾人但不露骨
    'yao_fox_f1': 'cast a different young actress for the same fox demon: an adult woman who looks about 22, the bewitching alluring beauty of a fox spirit from xianxia novels, '
                  'flawless luminous porcelain skin, captivating upturned fox eyes with red eyeliner at the outer corners, a small beauty mark under one eye, red lips, '
                  'long flowing silver-white hair loosely tied with red silk ribbons, white fox ears, a fluffy white fox tail, graceful slender figure, '
                  'layered sheer red and white silk robes worn slightly off the shoulders, elegant and tasteful, not explicit, '
                  'a relaxed charming pose with one hand lightly raised near the collar',
    'yao_snake_f1': 'cast a different young actor for the same snake demon: an adult man who looks about 23, cold and strikingly beautiful with delicate refined features, '
                    'flawless pale cool skin with a few faint jade-green scales at the temples and down the side of the neck, pale gold vertical slit-pupil eyes, '
                    'long straight black hair half tied up with a jade pin, tall slender build, layered dark green silk robes with silver serpent embroidery, '
                    'hands folded calmly in front, a different pose',
    'yao_tiger_f1': 'cast a different young actor for the same tiger demon: an adult man who looks about 24, handsome with a strong jaw and smooth unlined skin, '
                    'faint tiger-stripe markings on the cheekbones and forearms, bright amber eyes, thick untamed dark hair with a few tawny streaks tied back loosely, '
                    'tall broad-shouldered athletic build, a tiger fur mantle over a dark open-collared tunic with leather bracers, '
                    'thumbs hooked in his belt, confident stance, a different pose',
}

MOODS = {
    'pleased': 'a satisfied pleased smile, relaxed eyes',
    'angry': 'furious: brows knitted, glaring, jaw clenched',
    'afraid': 'terrified: wide eyes, pale face, leaning back',
    'sly': 'scheming sly half-smile, narrowed calculating eyes',
    'wasted': 'gaunt and drug-addicted: hollow cheeks, dark eye circles, sweating, trembling, sickly pale skin',
    'thrall': 'mind-controlled thrall: eyes completely clouded milky white without pupils, blank slack face, black veins spreading over the face and neck, a faint dark mist around the head',
}

SCENES = {
    'shop_front': ('1536x1024', 'the view from behind a pawnshop counter looking out across a small dim Chinese pawnshop to its wide-open wooden lattice front door, '
                   'the street of a demonic sect servant quarter visible outside through the door with red lanterns and a blood moon; the dark wooden counter top '
                   'runs straight across the bottom fifth of the frame in the foreground with an abacus, a ledger and a brass scale on it; '
                   'shelves with curios at the far left and right edges; empty floor between the counter and the door'),
    'night_street': ('1536x1024', 'a narrow street of a demonic sect servant quarter at night, wooden houses, red lanterns, a closed pawnshop with half-lowered shutters, blood moon over black mountains'),
    'title_bg': ('1536x1024', 'grand vista of a demonic sect mountain with black pagodas lit by red lights, blood moon, a small pawnshop with a lantern at the foot of the mountain'),
    'ghost_market': ('1536x1024', 'a ghost market at night under paper lanterns, masked vendors stalls with strange goods, green ghost fires'),
    'loc_ruins': ('1536x1024', 'ruins of a destroyed ancient sect, broken stone halls and pillars, scattered weapons, faint protective array light'),
    'loc_battlefield': ('1536x1024', 'an ancient immortal-demon battlefield, scorched earth, broken swords stuck in the ground, ghost flames, smoke'),
    'loc_scrapyard': ('1536x1024', 'a weapon refinery scrapyard, mountains of broken swords and armor, furnace chimneys glowing'),
    'loc_graveyard': ('1536x1024', 'a mass grave hill at night, crooked gravestones, bones, will-o-wisps, crows, fog'),
    'loc_beastcave': ('1536x1024', 'outskirts of a demon beast cave, giant claw marks on rocks, glowing herbs, a huge eye glowing in the dark cave mouth'),
}

# 结局画面：以自家铺面为参考改图，仍是掌柜站惯了的柜台后视角——人不在了，铺子还在
ENDING_EDIT = 'Same pawnshop interior, same camera position behind the counter, same framing, same photorealistic style. No people anywhere. Only change this: {c}.'
ENDINGS = {
    'end_death': ('shop_front', 'it is cold grey dawn after the shopkeeper died in the night; a white paper mourning lantern now hangs at the open front door '
                  'and white paper spirit money drifts in from the empty street; on the counter the oil lamp has burnt out with one thin thread of smoke, '
                  'the abacus is knocked over with its beads scattered, the ledger lies open with the brush dropped across it, a dark robe hangs off a '
                  'toppled stool, a cracked jade token on the floor; the red lanterns outside are unlit; muted desaturated colors, quiet and desolate'),
    'end_death_poison': ('end_death', 'on the counter beside the burnt-out lamp add a tipped-over celadon teacup with a dried dark purple stain spreading from it, '
                         'an empty uncorked medicine bottle and a bundle of withered black herbs; a faint sickly purple-green mist hangs low over the counter'),
    # 买下铺契：铺子归你了，铺里什么也不剩
    'end_deed': ('shop_front', 'it is bright clear morning; every shelf at the left and right is completely bare and dusty, all curios gone, only pale outlines '
                 'where they used to stand; in the middle of the counter lies a single large property deed on red-bordered paper with a big vermilion seal, '
                 'next to it an open wooden money box that is completely empty and a single old copper coin; the abacus and scale are gone; '
                 'the front door is wide open to a sunny ordinary street; quiet, ironic, a little forlorn'),
}

MACHINES = {
    'm_furnace': 'a small iron refining furnace with bellows', 'm_forge': 'an artifact forging anvil table with hammers and an array plate',
    'm_danlu': 'a three-legged bronze alchemy cauldron furnace', 'm_pool': 'a stone spirit-water washing pool with filter channels',
    'm_spring': 'a small spirit spring well surrounded by rocks', 'm_herbbed': 'a raised wooden spirit herb garden bed',
    'm_gupot': 'a black clay gu insect breeding jar with lid', 'm_winejar': 'a large earthen spirit wine fermentation jar sealed with cloth',
    'm_soulfurnace': 'a soul-refining furnace of black iron with ghost faces on its sides', 'm_coffin': 'a corpse-refining black coffin with chains and talismans',
    'm_puppetbench': 'a puppet-making workbench with half-built iron limbs', 'm_yaopot': 'a demonic plant pot with thorny carnivorous vines',
    'm_dihuo': 'a large earth-fire forge built into rock with lava below', 'm_pen': 'a small wooden spirit beast pen with straw',
    'm_fudesk': 'a talisman drawing desk with brushes, cinnabar and yellow papers', 'm_forgery': 'a forger workbench with tools, paints, molds and a magnifier',
    'm_puppet': 'a wooden puppet vendor stall with a seated mechanical puppet clerk', 'm_array': 'a spirit-gathering array: an engraved stone disc with crystal pillars',
}
MACHINE_RUN = 'the same equipment now running at full power: glowing fire or swirling qi energy, sparks and light'

ICONS = {
    'ic_appraise': 'a bronze magnifying glass', 'ic_contraband': 'a forbidden white jade token with a blue cross mark', 'ic_day': 'a rising sun over a pagoda roof',
    'ic_deed': 'a rolled property deed scroll with a red seal', 'ic_gift': 'a red silk wrapped gift box', 'ic_heat': 'a single glaring demonic red eye set in an ornate ancient bronze frame, surrounded by flames, no modern objects',
    'ic_lace': 'a drop of purple poison falling from a spoon', 'ic_ledger': 'a thread-bound ledger book with an abacus', 'ic_mark': 'a glowing spirit brand mark on metal',
    'ic_merit': 'an ancient Chinese gold merit token: a rectangular gold plaque with cloud engravings and a red tassel, no stars', 'ic_night': 'a blood moon behind clouds', 'ic_power': 'a glowing violet spirit crystal', 'ic_rep_mo': 'a blood-red demon sect emblem',
    'ic_rep_ren': 'a bronze mortal coin with square hole', 'ic_rep_xian': 'a white jade immortal sect emblem with clouds', 'ic_rep_yao': 'an amber beast claw pendant',
    'ic_scavenge': 'a woven bamboo back basket with a hoe', 'ic_seal': 'an ancient Chinese white-jade seal stamp with a carved beast knob, its base dipped in blue ink, no crosses or symbols', 'ic_secret': 'a hooded eye in shadow', 'ic_spirit': 'a blue soul flame',
    'ic_stamina': 'a red beating heart with veins', 'ic_stolen': 'a black cloth bundle with a red tag', 'ic_stone': 'a faceted green spirit stone',
    'ic_war': 'crossed swords with a red banner', 'ic_dao': 'a meditating figure silhouette with rising qi swirl', 'ic_clique': 'two crossed command tokens with a blood seal',
}
