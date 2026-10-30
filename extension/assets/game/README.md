# SPAM UI icons

These interface sprites and elemental watermarks were extracted from the user's installed SPAM game (UI observed as version 1.26.5). They are used by the independent card inspector and remain the property of SPAM's rights holders. They are not MIT-licensed project artwork. No card illustrations or game assemblies are included.

To reproduce from a local installation, install UnityPy and run `python tools/extract_game_icons.py --game-path "F:/SteamLibrary/steamapps/common/SPAM"`. The script selects named Sprite assets and exports transparent PNGs at no more than 128 px for icons and 640 px for watermarks. Larger element sprites are used in the header; TextMeshPro sprites are used inline; `card_multiplicator` supplies the actual critical multiplier symbol.
