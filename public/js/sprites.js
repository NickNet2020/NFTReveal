// ═══════════════════════════════════════════════════════════════════
//  SPRITES.JS - Detailed Character Sprites (Clash of Clans Style)
//  Larger, more detailed sprites with rich shading and outlines
//  Each char maps to a color in the palette. '.' = transparent.
// ═══════════════════════════════════════════════════════════════════

const Sprites = (() => {

  // ─── Sprite Cache ────────────────────────────────────────────
  const cache = {};

  // ─── Render sprite data to an offscreen canvas ───────────────
  function renderSprite(data, palette, scale = 3) {
    const key = JSON.stringify({ data, palette, scale });
    if (cache[key]) return cache[key];

    const h = data.length;
    const w = data[0].length;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = data[y][x];
        if (ch === '.' || !palette[ch]) continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    cache[key] = canvas;
    return canvas;
  }

  // ─── Colorize a sprite (replace team color) ──────────────────
  function renderColorized(data, palette, teamColor, scale = 3) {
    const key = JSON.stringify({ data, palette, teamColor, scale });
    if (cache[key]) return cache[key];

    const modPalette = { ...palette, 'T': teamColor };
    return renderSprite(data, modPalette, scale);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PLAYER CHARACTER (20x26) - Armored Lord
  // ═══════════════════════════════════════════════════════════════
  const PLAYER_PALETTE = {
    'o': '#1a1a2e', // outline
    'h': '#f0c8a0', // skin
    'H': '#d4a574', // skin shadow
    'j': '#b8956a', // skin dark
    'e': '#2c1810', // eyes
    'w': '#ffffff', // eye whites
    'b': '#5a4030', // hair
    'B': '#3a2718', // hair shadow
    'T': '#e74c3c', // team color (replaced)
    't': '#c0392b', // team dark
    'u': '#a93226', // team darkest
    'a': '#c0c0c0', // armor light
    'A': '#9a9a9a', // armor
    'n': '#747474', // armor dark
    'N': '#555555', // armor darkest
    'g': '#f1c40f', // gold
    'G': '#d4a017', // gold dark
    'p': '#7a5230', // leather
    'P': '#5a3420', // leather dark
    's': '#d8d8d8', // sword blade
    'S': '#f0f0f0', // sword shine
    'c': '#e08040', // cape
    'C': '#c06030', // cape dark
  };

  const PLAYER_DATA = [
    '.......oBBBBo.........',
    '......oBBBBBBo........',
    '.....oBBBBBBBBo.......',
    '.....obbbbbbbbo.......',
    '.....ohhhhhhHHo.......',
    '.....ohweehwHHo.......',
    '.....ohhHhhjjo........',
    '......oHhhhjo.........',
    '.....ogGTTTGgo........',
    '....oTTTTTTTTTo.......',
    '...oTTTaAAaTTToc......',
    '...oTTAAnNAATTocc.....',
    '...otTAAnNAATtocc.....',
    '...otTaAAaaTttoCc.....',
    '....otTTTTTtto.Cc.....',
    '....otTgGgTto.........',
    '.....opPpPpo..........',
    '....opP..Ppo..........',
    '....opP..Ppo..........',
    '....opP..Ppo..........',
    '....opp..ppo..........',
    '....oNp..pNo..........',
  ];

  // ─── PLAYER WITH CROWN (for high level) ─────────────────────
  const PLAYER_CROWN_DATA = [
    '....og.gg.go..........',
    '....oggggggo..........',
    '....ogfggfgo..........',
    '.......oBBBBo.........',
    '......oBBBBBBo........',
    '.....oBBBBBBBBo.......',
    '.....obbbbbbbbo.......',
    '.....ohhhhhhHHo.......',
    '.....ohweehwHHo.......',
    '.....ohhHhhjjo........',
    '......oHhhhjo.........',
    '.....ogGTTTGgo........',
    '....oTTTTTTTTTo.......',
    '...oTTTaAAaTTToc......',
    '...oTTAAnNAATTocc.....',
    '...otTAAnNAATtocc.....',
    '...otTaAAaaTttoCc.....',
    '....otTTTTTtto.Cc.....',
    '....otTgGgTto.........',
    '.....opPpPpo..........',
    '....opP..Ppo..........',
    '....opP..Ppo..........',
    '....opp..ppo..........',
    '....oNp..pNo..........',
  ];

  const PLAYER_CROWN_PALETTE = { ...PLAYER_PALETTE, 'f': '#e74c3c' };

  // ═══════════════════════════════════════════════════════════════
  //  FOOT SOLDIER (16x20) - Armored Infantry
  // ═══════════════════════════════════════════════════════════════
  const SOLDIER_PALETTE = {
    'o': '#1a1a2e', // outline
    'h': '#f0c8a0', // skin
    'H': '#d4a574', // skin shadow
    'e': '#2c1810', // eyes
    'w': '#ffffff', // eye whites
    'a': '#b0b0b0', // armor light
    'A': '#8b8b8b', // armor
    'n': '#6b6b6b', // armor dark
    'N': '#505050', // armor darkest
    'T': '#e74c3c', // team (replaced)
    't': '#c0392b', // team dark
    's': '#c0c0c0', // sword
    'S': '#e0e0e0', // sword bright
    'g': '#f1c40f', // gold accent
    'G': '#d4a017', // gold dark
    'p': '#6b4423', // boots
    'P': '#4a2f13', // boots dark
    'l': '#606060', // helmet
    'L': '#484848', // helmet dark
    'v': '#7a7a7a', // helmet visor
  };

  const SOLDIER_DATA = [
    '......ollo..........',
    '.....olLLLlo........',
    '.....olvvvlo........',
    '.....olLLLlo........',
    '.....ohhhhho........',
    '.....ohweho.........',
    '......ohhho.........',
    '.....ogaaago.S......',
    '....oTaAAAATo.S.....',
    '....oTAnNnATo.s.....',
    '....oTAnNnATTo......',
    '....otAAnAAto.......',
    '.....otTTTto........',
    '.....ogGgGo.........',
    '.....ophPpo.........',
    '.....opP.Ppo........',
    '.....opP.Ppo........',
    '.....opp.ppo........',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  HORSE KNIGHT (22x20) - Mounted Warrior
  // ═══════════════════════════════════════════════════════════════
  const HORSE_PALETTE = {
    'o': '#1a1a2e', // outline
    'h': '#f0c8a0', // rider skin
    'e': '#2c1810', // eyes
    'a': '#b0b0b0', // armor
    'A': '#8b8b8b', // armor shadow
    'n': '#6b6b6b', // armor dark
    'T': '#e74c3c', // team
    't': '#c0392b', // team dark
    'g': '#f1c40f', // gold
    'l': '#606060', // helmet
    'L': '#484848', // helmet dark
    'R': '#9b6930', // horse body
    'r': '#7a5020', // horse shadow
    'D': '#5a3810', // horse dark
    'M': '#3a2a0a', // mane
    'm': '#2a1a00', // mane dark
    'w': '#ffffff', // eye white
    'b': '#2c1810', // horse eye
    's': '#c0c0c0', // lance
    'S': '#e0e0e0', // lance tip
    'i': '#d8b070', // horse light
    'p': '#6b4423', // leather
  };

  const HORSE_DATA = [
    '.......ollo...........S.......',
    '......olAAlo..........S.......',
    '......ohAhho..........s.......',
    '......ohehho.........s........',
    '.......ohhho........s.........',
    '......ogTTTgo......s..........',
    '.....oTTTaATTo....s...........',
    '....oTTTTTTTTo...s............',
    '...omMDD..........s...........',
    '..oMmDRRRRrbo.....................',
    '..oMRRRRRRRRwo...................',
    '..oMRRiRRiRRRRro................',
    '...oDRRRRRRRRRro................',
    '...oDRrRRRRrRDo.................',
    '...oDR.oDR.oRDo.................',
    '...oDD.oDD.oDDo.................',
    '...oD..oD...oDo.................',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  WIZARD (18x24) - Mystical Spellcaster
  // ═══════════════════════════════════════════════════════════════
  const WIZARD_PALETTE = {
    'o': '#1a1a2e', // outline
    'h': '#f0c8a0', // skin
    'H': '#d4a574', // skin shadow
    'e': '#2c1810', // eyes
    'T': '#e74c3c', // team robe
    't': '#c0392b', // robe dark
    'u': '#a93226', // robe darkest
    'r': '#9b59b6', // purple accent
    'R': '#8e44ad', // purple dark
    'q': '#7d3c98', // purple darkest
    'g': '#f1c40f', // gold
    'G': '#d4a017', // gold dark
    'w': '#ffffff', // beard
    'W': '#dddddd', // beard shadow
    'v': '#bbbbbb', // beard dark
    's': '#8b5e3c', // staff
    'S': '#6b4423', // staff dark
    'O': '#3498db', // orb glow
    'Q': '#2980b9', // orb dark
    'p': '#6b4423', // boots
    'P': '#4a2f13', // boots dark
    '*': '#00e5ff', // magic sparkle
    '+': '#76ff03', // sparkle 2
  };

  const WIZARD_DATA = [
    '......o*rro...........',
    '.......orro...........',
    '......orRRro..........',
    '.....orRRRRro.........',
    '....orRRRRRRo.........',
    '....orwwhhwRo.........',
    '....owhheehwo.........',
    '.....owwwwwo..........',
    '....owWvvWwwo.........',
    '....ogGTTTGgo..os.....',
    '...oTTTTTTTTTo.oso....',
    '...oTTTrRrTTTo.osO....',
    '...otTTrRrTTto.oOQo...',
    '...otTTTTTTtto.osO....',
    '....ouTTTTuto..oso....',
    '.....ouTTTuo...os.....',
    '......ouTuo...........',
    '......opPpo...........',
    '.....opP.Ppo..........',
    '......opp.po..........',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  DRAGON (28x22) - Fearsome Flying Beast
  // ═══════════════════════════════════════════════════════════════
  const DRAGON_PALETTE = {
    'o': '#1a1a2e', // outline
    'T': '#e74c3c', // team main body
    't': '#c0392b', // body shadow
    'd': '#922b21', // body darkest
    'x': '#7b241c', // underbelly dark
    'b': '#e8b84d', // belly/underbody
    'B': '#d4a030', // belly shadow
    'w': '#f5d76e', // wing membrane
    'W': '#e8c840', // wing dark
    'v': '#d4b030', // wing darkest
    'e': '#f1c40f', // eye
    'E': '#ff6600', // eye pupil
    'h': '#c0c0c0', // horn
    'H': '#909090', // horn dark
    'c': '#444444', // claws
    'f': '#ff4400', // fire
    'F': '#ff8800', // fire bright
    'n': '#ffcc00', // nostril fire
    's': '#e86060', // scales highlight
    'S': '#d04040', // scales
  };

  const DRAGON_DATA = [
    '..oho...................oho...............',
    '..oHToo...............ooTHo..............',
    '...oTTTo....owWwo....oTTTo...............',
    '...oTTTTo..owWWWwo..oTTTTo...............',
    '..oTTsTeEoowWWWWWooeTsTTTo...............',
    '..oTTTTTTowWWWWWWwoTTTTTTo...............',
    '...oTTTTTTowWvWwoTTTTTTTo................',
    '....oTTsTTTTowwoTTTTsTTTo................',
    '....otTTTTTTTTTTTTTTTTto.................',
    '.....otTTbBBBBBBBbTTto...................',
    '.....odTTbBBBBBBBbTTdo...................',
    '......odTTbBBBBbTTdo.....................',
    '.......odTTbBBbTTdo......................',
    '........odTTbbTTdo.......................',
    '.......oc.odTTdo.co......................',
    '.......oc..oddo..co......................',
    '.......oc........co......................',
    '........oc......co.......................',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  DOOM CASTLE (30x30) - Gothic Dark Fortress
  // ═══════════════════════════════════════════════════════════════
  const CASTLE_PALETTE = {
    'o': '#1a1a2e', // outline
    'w': '#6b6b7b', // wall stone
    'W': '#555565', // wall dark
    'D': '#404050', // wall darkest
    'd': '#333340', // interior dark
    'r': '#aa3030', // red banner
    'R': '#882020', // banner dark
    'g': '#f1c40f', // gold trim
    'G': '#d4a017', // gold dark
    'T': '#e74c3c', // team (flag)
    't': '#c0392b', // team dark
    'n': '#222230', // window dark
    'b': '#2a2a38', // base dark
    'f': '#ff4400', // fire/torch
    'F': '#ff8800', // fire bright
    's': '#ff3333', // skull red
    'S': '#cc2222', // skull dark red
    'k': '#dddddd', // skull bone
    'K': '#bbbbbb', // skull shadow
    'p': '#8888aa', // portcullis
    'P': '#666688', // portcullis dark
    'h': '#7b7b8b', // highlight stone
    'c': '#444455', // crenellation
  };

  const CASTLE_DATA = [
    '..oTo.........ofo.........oTo..',
    '..oTo........oFfo.........oTo..',
    '..oco.........oo..........oco..',
    '.ocwco.......owwo.......ocwco..',
    '.owwwo......owwwwo......owwwo..',
    '.owwwo......owwwwo......owwwo..',
    '.owwwo..ocococococo...owwwo....',
    '.owwwo.ohwwwwwwwwwho..owwwo....',
    '.owwwo.owwwwwwwwwwwo..owwwo....',
    '.owwwo.owwnwwwwnwwo..owwwo....',
    '.owwwo.owwnwwwwnwwo..owwwo....',
    '.owwwo.owwwwwwwwwwwo..owwwo....',
    '.owwwo.owwwwwwwwwwwo..owwwo....',
    '.owwwo.owwokKKkoowwo..owwwo....',
    '.owwwo.owwokKKkoowwo..owwwo....',
    '.owwwo.owwwwwwwwwwwo..owwwo....',
    '.owwwo.owwnwwwwnwwo..owwwo....',
    '.owwwo.owwnwwwwnwwo..owwwo....',
    '.owwwo.owwwwwwwwwwwo..owwwo....',
    '.owwwo.owwwwppwwwwwo..owwwo....',
    '.owwwo.owwwpPPpwwwwo..owwwo....',
    '.owwwo.owwwpPPpwwwwo..owwwo....',
    '.owwwo.owwwpPPpwwwwo..owwwo....',
    '.obbbboobbbbbbbbbbboo.obbbb....',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  DOOM SKULL (16x16) - Map marker for doom castle
  // ═══════════════════════════════════════════════════════════════
  const DOOM_SKULL_PALETTE = {
    'o': '#1a0000', // outline
    'w': '#ffffff', // bone
    'W': '#dddddd', // bone shadow
    'b': '#110000', // eye socket
    'r': '#ff0000', // red glow
    'R': '#cc0000', // dark red
    'g': '#888888', // teeth shadow
    'n': '#ffaaaa', // nose
  };

  const DOOM_SKULL_DATA = [
    '....ooooooo.....',
    '..oowwwwwwwoo...',
    '.oowWWWWWWWwoo..',
    '.owWWWWWWWWWwo..',
    'owWWbWWWWbWWwo..',
    'owWWbbWWbbWWwo..',
    'owWWWWWWWWWWwo..',
    '.owWWnWWnWWwo...',
    '.oowWWWWWWwoo...',
    '..oowgwgwgoo....',
    '...oowwwwoo.....',
    '....oogbgoo.....',
    '.....ooooo......',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  GOLD COIN (10x10) - Detailed with depth
  // ═══════════════════════════════════════════════════════════════
  const COIN_PALETTE = {
    'o': '#8b6914', // outline
    'g': '#f1c40f', // gold
    'G': '#d4a017', // gold dark
    'b': '#b8860b', // gold darkest
    's': '#ffe566', // shine
    'S': '#fff4a0', // bright shine
  };

  const COIN_FRAMES = [
    [ // Frame 0 (full)
      '...ogggo...',
      '..ogssgGo..',
      '.ogsssgGGo.',
      '.ogssgGGGo.',
      '.oggGGGGGo.',
      '.ogGGGGGbo.',
      '..ogGGGbo..',
      '...obbbo...',
    ],
    [ // Frame 1 (narrower)
      '....oggo...',
      '...ogsGo...',
      '..ogssgGo..',
      '..ogsgGGo..',
      '..ogGGGGo..',
      '..ogGGGbo..',
      '...ogGbo...',
      '....obbo...',
    ],
    [ // Frame 2 (thin)
      '....ogo....',
      '....oso....',
      '....oso....',
      '....oGo....',
      '....oGo....',
      '....oGo....',
      '....obo....',
      '....obo....',
    ],
  ];

  // ═══════════════════════════════════════════════════════════════
  //  HOUSE (18x16) - Detailed Thatched Cottage
  // ═══════════════════════════════════════════════════════════════
  const HOUSE_PALETTE = {
    'o': '#1a1a2e', // outline
    'r': '#c0392b', // roof
    'R': '#962d22', // roof dark
    'q': '#7a2018', // roof darkest
    'w': '#d2b48c', // wall
    'W': '#b8956a', // wall dark
    'x': '#9a7a55', // wall darkest
    'd': '#6b4423', // door
    'D': '#4a2f13', // door dark
    'n': '#2c1810', // window dark
    'N': '#1a0f0a', // window darkest
    'g': '#f1c40f', // chimney glow
    'c': '#8b8b8b', // chimney
    'C': '#6b6b6b', // chimney dark
    'b': '#555555', // base
    's': '#aaaaaa', // smoke
    'T': '#e74c3c', // team flag
    'l': '#ffcc44', // window light
  };

  const HOUSE_DATA = [
    '....s..occ..............',
    '.......oCCo.....oTo.....',
    '....orroCCoorrrrro......',
    '...orRRrrrrrRRrrrro.....',
    '..orRRRrrrrrRRRrrrro....',
    '.orRRRRrrrrrRRRRrrrro...',
    'oqqRRRRrrrrrRRRRRqqro...',
    '.owWwwwwnlwnlwwwWwo.....',
    '.owWwwwwnlwnlwwwWwo.....',
    '.owWwwwwwwwwwwwwwWwo.....',
    '.owWwwwwnlwnlwwwWwo.....',
    '.owWwwwwnlwnlwwwWwo.....',
    '.owWwwwdddddddwwWwo.....',
    '.owWwwwdDDDDDdwwWwo.....',
    '.obbbbbbbbbbbbbbbbbo....',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  GOLD MINE (18x14) - Detailed Mine Entrance
  // ═══════════════════════════════════════════════════════════════
  const GOLDMINE_PALETTE = {
    'o': '#1a1a2e', // outline
    'w': '#8b7355', // wood
    'W': '#6b5335', // wood dark
    'x': '#4a3820', // wood darkest
    'd': '#333333', // mine dark
    'D': '#1a1a1a', // mine darkest
    'g': '#f1c40f', // gold ore
    'G': '#d4a017', // gold dark
    'r': '#7a6050', // rock
    'R': '#5a4838', // rock dark
    'b': '#444444', // base
    'T': '#e74c3c', // team
    's': '#aaaaaa', // support beam
    'O': '#ffe566', // ore sparkle
    'c': '#8b8b8b', // chain/rail
    'q': '#6b4423', // dirt
  };

  const GOLDMINE_DATA = [
    '........osso............',
    '.......osWWso...........',
    '......osWddWso..........',
    '.....osWddddWso.........',
    '....owwwwwwwwwwwo.......',
    '....owrrqgOqgrRwo.......',
    '....owRrqgGqgrRwo.......',
    '....owRrrrrrrrRwo.......',
    '....owrrqgOqgrRwo.......',
    '....owRrqgGqgrRwo.......',
    '....oWWWWWWWWWWWWo......',
    '....obbbbbbbbbbbbbo.....',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  TREE SPRITES (3 variants) - Lush and detailed
  // ═══════════════════════════════════════════════════════════════
  const TREE_PALETTE = {
    'o': '#0a3a0a', // outline
    'l': '#2ecc71', // leaves bright
    'L': '#27ae60', // leaves
    'M': '#1e8449', // leaves mid
    'D': '#145a32', // leaves dark
    'E': '#0e4025', // leaves darkest
    't': '#8b6914', // trunk
    'T': '#6b4914', // trunk dark
    'U': '#4a3010', // trunk darkest
    's': '#45d98c', // leaf highlight
  };

  const TREE_VARIANTS = [
    [ // Pine tree
      '.......ol.........',
      '......olsl........',
      '.....ollsll.......',
      '....olllslll......',
      '...oLlllsllLl.....',
      '..oMLlllllLLMo....',
      '.oMMLlllllLMMo....',
      'oEMLllllllLMMEo...',
      '.oEMLllllLMEo.....',
      '..oEMlllMEo.......',
      '...oEMLMEo........',
      '.....otTo.........',
      '.....oTUo.........',
      '.....oTUo.........',
    ],
    [ // Round tree - lush canopy
      '.....olllllo......',
      '...ollslslllo.....',
      '..ollslllslllo....',
      '.olllllllllllo....',
      'ollLlllllllLlo....',
      'oLLLllllllLLlo....',
      '.oMLlllllLMo......',
      '..oMLlllMo........',
      '...oEMEo..........',
      '.....otTo.........',
      '.....oTUo.........',
      '.....oTUo.........',
    ],
    [ // Bushy tree - wide canopy
      '....ollllllo......',
      '...olsllslllo.....',
      '..olsllllslllo....',
      '.ollllllllllllo...',
      'olllLllllLlllo....',
      'ollLLlllllLllo....',
      '.oMLLllllLLMo.....',
      '..oEMLLLLMEo......',
      '.....otTo.........',
      '.....oTUo.........',
      '.....oTUo.........',
      '.....oTUo.........',
    ],
  ];

  // ═══════════════════════════════════════════════════════════════
  //  ROCK SPRITES (3 variants) - Mossy boulders
  // ═══════════════════════════════════════════════════════════════
  const ROCK_PALETTE = {
    'o': '#3a4040', // outline
    'r': '#a0aab0', // rock light
    'R': '#8090a0', // rock
    'M': '#6b7b8b', // rock mid
    'd': '#566670', // rock dark
    'D': '#444e55', // rock darkest
    's': '#c0ccd4', // highlight
    'm': '#5a8050', // moss
  };

  const ROCK_VARIANTS = [
    [
      '....orrro....',
      '...orsRRro...',
      '..orssRRRro..',
      '..orRRRRMro..',
      '..omRRMMDro..',
      '...odDDDdo...',
    ],
    [
      '...orr.......',
      '..orsRr.orro.',
      '.orsRRrrRRro.',
      '.orRRRRRRMro.',
      '..orMDDDMro..',
      '...odddddo...',
    ],
    [
      '.....orrro...',
      '....orsRRro..',
      '...orsRRRro..',
      '..orRRRMDro..',
      '..omMDDDdo...',
      '...odddo.....',
    ],
  ];

  // ═══════════════════════════════════════════════════════════════
  //  FIRE EFFECT (for dragons)
  // ═══════════════════════════════════════════════════════════════
  const FIRE_PALETTE = {
    'f': '#ff4400',
    'F': '#ff8800',
    'y': '#ffcc00',
    'Y': '#ffee44',
    'r': '#cc2200',
    'w': '#ffffff',
  };

  const FIRE_FRAMES = [
    [
      '..Yy.',
      '.yFYy',
      '.FfF.',
      'FffFr',
      'rffrr',
    ],
    [
      '.Y...',
      'yFY..',
      '.Ffy.',
      'rFfF.',
      'rrffr',
    ],
  ];

  // ═══════════════════════════════════════════════════════════════
  //  MAGIC ORB (wizard projectile) - Glowing orb
  // ═══════════════════════════════════════════════════════════════
  const MAGIC_PALETTE = {
    'o': '#6b3fa0', // outline
    'p': '#9b59b6', // purple
    'P': '#8e44ad', // purple dark
    'b': '#3498db', // blue
    'B': '#2980b9', // blue dark
    's': '#e8d8f8', // shine
    '*': '#ffffff', // sparkle
  };

  const MAGIC_DATA = [
    '.oPo.',
    'osBPo',
    'osbBo',
    'oBBBo',
    '.oPo.',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  SKULL (death marker) - More detailed
  // ═══════════════════════════════════════════════════════════════
  const SKULL_PALETTE = {
    'o': '#333333',
    'w': '#ffffff',
    'W': '#dddddd',
    'b': '#222222',
    'g': '#888888',
    'n': '#aaaaaa',
  };

  const SKULL_DATA = [
    '..owwwwo..',
    '.owWWWWwo.',
    'owWbWWbWwo',
    'owWWWWWWwo',
    '.owWgWgwo.',
    '..owWWwo..',
    '..ogbgbo..',
  ];

  // ─── Pre-render and return API ──────────────────────────────
  return {
    renderSprite,
    renderColorized,
    PLAYER_PALETTE, PLAYER_DATA,
    PLAYER_CROWN_DATA, PLAYER_CROWN_PALETTE,
    SOLDIER_PALETTE, SOLDIER_DATA,
    HORSE_PALETTE, HORSE_DATA,
    WIZARD_PALETTE, WIZARD_DATA,
    DRAGON_PALETTE, DRAGON_DATA,
    CASTLE_PALETTE, CASTLE_DATA,
    DOOM_SKULL_PALETTE, DOOM_SKULL_DATA,
    COIN_PALETTE, COIN_FRAMES,
    HOUSE_PALETTE, HOUSE_DATA,
    GOLDMINE_PALETTE, GOLDMINE_DATA,
    TREE_PALETTE, TREE_VARIANTS,
    ROCK_PALETTE, ROCK_VARIANTS,
    FIRE_PALETTE, FIRE_FRAMES,
    MAGIC_PALETTE, MAGIC_DATA,
    SKULL_PALETTE, SKULL_DATA,
  };
})();
