#include "stdafx.h"
#include "Game.h"

extern FLOAT gam_afEnemyMovementSpeed[5];
extern FLOAT gam_afEnemyAttackSpeed[5];
extern FLOAT gam_afDamageStrength[5];
extern FLOAT gam_afAmmoQuantity[5];
extern FLOAT gam_fManaTransferFactor;
extern FLOAT gam_fExtraEnemyStrength          ;
extern FLOAT gam_fExtraEnemyStrengthPerPlayer ;
extern INDEX gam_iCredits;
extern FLOAT gam_tmSpawnInvulnerability;
extern INDEX gam_iScoreLimit;
extern INDEX gam_iFragLimit;
extern INDEX gam_iTimeLimit;
extern INDEX gam_ctMaxPlayers;
extern INDEX gam_bWaitAllPlayers;
extern INDEX gam_bAmmoStays       ;
extern INDEX gam_bHealthArmorStays;
extern INDEX gam_bAllowHealth     ;
extern INDEX gam_bAllowArmor      ;
extern INDEX gam_bInfiniteAmmo    ;
extern INDEX gam_bRespawnInPlace  ;
extern INDEX gam_bPlayEntireGame;
extern INDEX gam_bWeaponsStay;
extern INDEX gam_bFriendlyFire;
extern INDEX gam_iInitialMana;
extern INDEX gam_iQuickStartDifficulty;
extern INDEX gam_iQuickStartMode;
extern INDEX gam_bQuickStartMP;
extern INDEX gam_iStartDifficulty;
extern INDEX gam_iStartMode;
extern INDEX gam_iBlood;
extern INDEX gam_bGibs;
extern INDEX gam_bUseExtraEnemies;
extern CTString gam_strGameSpyExtras;

// [Cecil] New options
extern INDEX hl2_iGamemode;

extern FLOAT hl2_fAmmoMultiplier;
extern FLOAT hl2_fMagMultiplier;
extern FLOAT hl2_fGravityGunPower;
extern INDEX hl2_bInfiniteAlt;
extern INDEX hl2_iStartWeapons;

extern FLOAT hl2_fSpeedMultiplier;
extern FLOAT hl2_fJumpMultiplier;
extern INDEX hl2_bBunnyhopping;
extern INDEX hl2_bAutoBunnyhop;

extern INDEX hl2_iNewEnemies;
extern INDEX hl2_bEnemyDrops;
extern INDEX hl2_bUseMaterials;
extern INDEX hl2_iPhysicsIterations;
extern INDEX hl2_bAdminMenu;

static void SetGameModeParameters(CSessionProperties &sp) {
  sp.sp_gmGameMode = (CSessionProperties::GameMode) Clamp(INDEX(gam_iStartMode), -1L, 2L);

  switch (sp.sp_gmGameMode) {
  default:
    ASSERT(FALSE);
  case CSessionProperties::GM_COOPERATIVE:
    sp.sp_ulSpawnFlags |= SPF_SINGLEPLAYER|SPF_COOPERATIVE;
    break;
  case CSessionProperties::GM_FLYOVER:
    sp.sp_ulSpawnFlags |= SPF_FLYOVER|SPF_MASK_DIFFICULTY;
    break;
  case CSessionProperties::GM_SCOREMATCH:
  case CSessionProperties::GM_FRAGMATCH:
    sp.sp_ulSpawnFlags |= SPF_DEATHMATCH;
    break;
  }
};

static void SetDifficultyParameters(CSessionProperties &sp) {
  INDEX iDifficulty = gam_iStartDifficulty;

  if (iDifficulty == 4) {
    sp.sp_bMental = TRUE;
    iDifficulty = 2;
  } else {
    sp.sp_bMental = FALSE;
  }

  sp.sp_gdGameDifficulty = (CSessionProperties::GameDifficulty) Clamp(INDEX(iDifficulty), -1L, 3L);

  switch (sp.sp_gdGameDifficulty) {
    case CSessionProperties::GD_TOURIST:
      sp.sp_ulSpawnFlags = SPF_EASY;//SPF_TOURIST; !!!!
      sp.sp_fEnemyMovementSpeed = gam_afEnemyMovementSpeed [0];
      sp.sp_fEnemyAttackSpeed   = gam_afEnemyAttackSpeed   [0];
      sp.sp_fDamageStrength     = gam_afDamageStrength     [0];
      sp.sp_fAmmoQuantity       = gam_afAmmoQuantity       [0];
      break;
    case CSessionProperties::GD_EASY:
      sp.sp_ulSpawnFlags = SPF_EASY;
      sp.sp_fEnemyMovementSpeed = gam_afEnemyMovementSpeed [1];
      sp.sp_fEnemyAttackSpeed   = gam_afEnemyAttackSpeed   [1];
      sp.sp_fDamageStrength     = gam_afDamageStrength     [1];
      sp.sp_fAmmoQuantity       = gam_afAmmoQuantity       [1];
      break;
    default:
      ASSERT(FALSE);
    case CSessionProperties::GD_NORMAL:
      sp.sp_ulSpawnFlags = SPF_NORMAL;
      sp.sp_fEnemyMovementSpeed = gam_afEnemyMovementSpeed [2];
      sp.sp_fEnemyAttackSpeed   = gam_afEnemyAttackSpeed   [2];
      sp.sp_fDamageStrength     = gam_afDamageStrength     [2];
      sp.sp_fAmmoQuantity       = gam_afAmmoQuantity       [2];
      break;
    case CSessionProperties::GD_HARD:
      sp.sp_ulSpawnFlags = SPF_HARD;
      sp.sp_fEnemyMovementSpeed = gam_afEnemyMovementSpeed [3];
      sp.sp_fEnemyAttackSpeed   = gam_afEnemyAttackSpeed   [3];
      sp.sp_fDamageStrength     = gam_afDamageStrength     [3];
      sp.sp_fAmmoQuantity       = gam_afAmmoQuantity       [3];
      break;
    case CSessionProperties::GD_EXTREME:
      sp.sp_ulSpawnFlags = SPF_EXTREME;
      sp.sp_fEnemyMovementSpeed = gam_afEnemyMovementSpeed [4];
      sp.sp_fEnemyAttackSpeed   = gam_afEnemyAttackSpeed   [4];
      sp.sp_fDamageStrength     = gam_afDamageStrength     [4];
      sp.sp_fAmmoQuantity       = gam_afAmmoQuantity       [4];
      break;
  }

  // [Cecil] Own multipliers
  sp.sp_fAmmoQuantity *= ClampDn(hl2_fAmmoMultiplier, 0.01f);
  sp.sp_fMagMultiplier = ClampDn(hl2_fMagMultiplier, 0.01f);
};

// [Cecil] New parameters
static void HL2_Parameters(CSessionProperties &sp) {
  sp.sp_fSpeedMultiplier = hl2_fSpeedMultiplier;
  sp.sp_fJumpMultiplier = hl2_fJumpMultiplier;
  sp.sp_iStartWeapons = hl2_iStartWeapons;
  sp.sp_fGravityGunPower = hl2_fGravityGunPower;
  sp.sp_iPhysicsIterations = hl2_iPhysicsIterations;
  
  const BOOL bBetaEnemies = (hl2_iNewEnemies == 1);
  const BOOL bNewEnemies = (hl2_iNewEnemies == 2);

  // Flags
  sp.sp_iHL2Flags |= (hl2_bInfiniteAlt  ? HL2F_INFALT    : 0)
                   | (hl2_bBunnyhopping ? HL2F_BHOP      : 0)
                   | (hl2_bAutoBunnyhop ? HL2F_AUTOBHOP  : 0)
                   | (bBetaEnemies      ? HL2F_ENEMIES1  : 0)
                   | (bNewEnemies       ? HL2F_ENEMIES2  : 0)
                   | (hl2_bUseMaterials ? HL2F_MATERIALS : 0)
                   | (hl2_bEnemyDrops   ? HL2F_ENEMYDROP : 0)
                   | (hl2_bAdminMenu    ? HL2F_ADMINMENU : 0);

  // Gamemodes
  sp.sp_iHLGamemode = hl2_iGamemode;

  switch (hl2_iGamemode) {
    case HLGM_DISSOLVE:
      sp.sp_iHL2Flags |= HL2F_INFALT;
      break;

    case HLGM_BUNNYHUNT:
      sp.sp_fSpeedMultiplier = 1.5f;
      sp.sp_fJumpMultiplier = 1.5f;
      sp.sp_iHL2Flags |= HL2F_INFALT|HL2F_BHOP|HL2F_AUTOBHOP;
      break;
  }

  // disable enemy drops in gamemodes
  if (hl2_iGamemode != HLGM_NONE) {
    sp.sp_iHL2Flags &= ~HL2F_ENEMYDROP;
  }
};

// set properties for a single player session
void CGame::SetSinglePlayerSession(CSessionProperties &sp) {
  // clear
  sp.Clear();

  SetDifficultyParameters(sp);
  SetGameModeParameters(sp);

  // [Cecil] New options
  HL2_Parameters(sp);

  sp.sp_ulSpawnFlags &= ~SPF_COOPERATIVE;

  sp.sp_bEndOfGame = FALSE;

  sp.sp_ctMaxPlayers = 1;
  sp.sp_bWaitAllPlayers = FALSE;
  sp.sp_bQuickTest = FALSE;
  sp.sp_bCooperative = TRUE;
  sp.sp_bSinglePlayer = TRUE;
  sp.sp_bUseFrags = FALSE;

  sp.sp_iScoreLimit = 0;
  sp.sp_iFragLimit  = 0; 
  sp.sp_iTimeLimit  = 0; 

  sp.sp_ctCredits     = 0;
  sp.sp_ctCreditsLeft = 0;
  sp.sp_tmSpawnInvulnerability = 0;

  sp.sp_bTeamPlay = FALSE;
  sp.sp_bFriendlyFire = FALSE;
  sp.sp_bWeaponsStay = FALSE;
  sp.sp_bPlayEntireGame = TRUE;

  sp.sp_bAmmoStays        = FALSE;
  sp.sp_bHealthArmorStays = FALSE;
  sp.sp_bAllowHealth = TRUE;
  sp.sp_bAllowArmor = TRUE;
  sp.sp_bInfiniteAmmo = FALSE;
  sp.sp_bRespawnInPlace = FALSE;
  sp.sp_fExtraEnemyStrength          = 0;
  sp.sp_fExtraEnemyStrengthPerPlayer = 0;

  sp.sp_iBlood = Clamp( gam_iBlood, 0L, 3L);
  sp.sp_bGibs  = gam_bGibs;
};

// set properties for a quick start session
void CGame::SetQuickStartSession(CSessionProperties &sp) {
  gam_iStartDifficulty = gam_iQuickStartDifficulty;
  gam_iStartMode = gam_iQuickStartMode;

  // same as single player
  if (!gam_bQuickStartMP) {
    SetSinglePlayerSession(sp);
  } else {
    SetMultiPlayerSession(sp);
  }
  // quick start type
  sp.sp_bQuickTest = TRUE;
};

// set properties for a multiplayer session
void CGame::SetMultiPlayerSession(CSessionProperties &sp) {
  // clear
  sp.Clear();

  SetDifficultyParameters(sp);
  SetGameModeParameters(sp);

  // [Cecil] New options
  HL2_Parameters(sp);

  sp.sp_ulSpawnFlags &= ~SPF_SINGLEPLAYER;

  sp.sp_bEndOfGame = FALSE;

  sp.sp_bQuickTest = FALSE;
  sp.sp_bCooperative = sp.sp_gmGameMode==CSessionProperties::GM_COOPERATIVE;
  sp.sp_bSinglePlayer = FALSE;
  sp.sp_bPlayEntireGame = gam_bPlayEntireGame;
  sp.sp_bUseFrags = sp.sp_gmGameMode==CSessionProperties::GM_FRAGMATCH;
  sp.sp_bWeaponsStay = gam_bWeaponsStay;
  sp.sp_bFriendlyFire = gam_bFriendlyFire;
  sp.sp_ctMaxPlayers = gam_ctMaxPlayers;
  sp.sp_bWaitAllPlayers = gam_bWaitAllPlayers;

  sp.sp_bAmmoStays        = gam_bAmmoStays       ;
  sp.sp_bHealthArmorStays = gam_bHealthArmorStays;
  sp.sp_bAllowHealth      = gam_bAllowHealth     ;
  sp.sp_bAllowArmor       = gam_bAllowArmor      ;
  sp.sp_bInfiniteAmmo     = gam_bInfiniteAmmo    ;
  sp.sp_bRespawnInPlace   = gam_bRespawnInPlace  ;

  sp.sp_fManaTransferFactor = gam_fManaTransferFactor;
  sp.sp_fExtraEnemyStrength          = gam_fExtraEnemyStrength         ;
  sp.sp_fExtraEnemyStrengthPerPlayer = gam_fExtraEnemyStrengthPerPlayer;
  sp.sp_iInitialMana        = gam_iInitialMana;

  sp.sp_iBlood = Clamp( gam_iBlood, 0L, 3L);
  sp.sp_bGibs  = gam_bGibs;
  sp.sp_tmSpawnInvulnerability = gam_tmSpawnInvulnerability;

  sp.sp_bUseExtraEnemies = gam_bUseExtraEnemies;

  // set credits and limits
  if (sp.sp_bCooperative) {
    sp.sp_ctCredits     = gam_iCredits;
    sp.sp_ctCreditsLeft = gam_iCredits;
    sp.sp_iScoreLimit = 0;
    sp.sp_iFragLimit  = 0;
    sp.sp_iTimeLimit  = 0;
    sp.sp_bAllowHealth = TRUE;
    sp.sp_bAllowArmor  = TRUE;

  } else {
    sp.sp_ctCredits     = -1;
    sp.sp_ctCreditsLeft = -1;
    sp.sp_iScoreLimit = gam_iScoreLimit;
    sp.sp_iFragLimit  = gam_iFragLimit;
    sp.sp_iTimeLimit  = gam_iTimeLimit;
    sp.sp_bWeaponsStay = FALSE;
    sp.sp_bAmmoStays = FALSE;
    sp.sp_bHealthArmorStays = FALSE;
    if (sp.sp_bUseFrags) {
      sp.sp_iScoreLimit = 0;
    } else {
      sp.sp_iFragLimit = 0;
    }
  }
};

BOOL IsMenuEnabled(const CTString &strMenuName) {
  if (strMenuName == "Single Player") {
    return TRUE;
  } else if (strMenuName == "Network"      ) {
    return TRUE;
  } else if (strMenuName == "Split Screen" ) {
    return TRUE;
  } else if (strMenuName == "High Score"   ) {
    return TRUE;
  } else if (strMenuName == "Training"   ) {
    return FALSE;
  } else if (strMenuName == "Technology Test") {
    return TRUE;
  } else {
    return TRUE;
  }
};

CTString GetGameTypeName(INDEX iMode) {
  switch (iMode) {
    default:
      return "";
      break;
    case CSessionProperties::GM_COOPERATIVE:
      return TRANS("Cooperative");
      break;
    case CSessionProperties::GM_FLYOVER:
      return TRANS("Flyover");
      break;
    case CSessionProperties::GM_SCOREMATCH:
      return TRANS("Scorematch");
      break;
    case CSessionProperties::GM_FRAGMATCH:
      return TRANS("Fragmatch");
      break;
  }
};

CTString GetCurrentGameTypeName() {
  const CSessionProperties &sp = *GetSP();
  return GetGameTypeName(sp.sp_gmGameMode);
};

CTString GetGameSpyRulesInfo(void) {
  CTString strOut;
	CTString strKey;
  const CSessionProperties &sp = *GetSP();

  CTString strDifficulty;
  if (sp.sp_bMental) {
    strDifficulty = TRANS("Mental");
  } else {
    switch(sp.sp_gdGameDifficulty) {
    case CSessionProperties::GD_TOURIST:
      strDifficulty = TRANS("Tourist");
      break;
    case CSessionProperties::GD_EASY:
      strDifficulty = TRANS("Easy");
      break;
    default:
      ASSERT(FALSE);
    case CSessionProperties::GD_NORMAL:
      strDifficulty = TRANS("Normal");
      break;
    case CSessionProperties::GD_HARD:
      strDifficulty = TRANS("Hard");
      break;
    case CSessionProperties::GD_EXTREME:
      strDifficulty = TRANS("Serious");
      break;
    }
  }

	strKey.PrintF("\\difficulty\\%s", (const char*)strDifficulty);
	strOut += strKey;

  strKey.PrintF("\\friendlyfire\\%d", sp.sp_bFriendlyFire?0:1);
	strOut += strKey;
  
  strKey.PrintF("\\weaponsstay\\%d", sp.sp_bWeaponsStay?0:1);
	strOut += strKey;

  strKey.PrintF("\\ammostays\\%d", sp.sp_bAmmoStays                   ?0:1);	strOut+=strKey;
  strKey.PrintF("\\healthandarmorstays\\%d", sp.sp_bHealthArmorStays  ?0:1);	strOut+=strKey;
  strKey.PrintF("\\allowhealth\\%d", sp.sp_bAllowHealth               ?0:1);	strOut+=strKey;
  strKey.PrintF("\\allowarmor\\%d", sp.sp_bAllowArmor                 ?0:1);	strOut+=strKey;
  strKey.PrintF("\\infiniteammo\\%d", sp.sp_bInfiniteAmmo             ?0:1);	strOut+=strKey;
  strKey.PrintF("\\respawninplace\\%d", sp.sp_bRespawnInPlace         ?0:1);	strOut+=strKey;

  if (sp.sp_bCooperative) {
    if (sp.sp_ctCredits<0) {
      strKey.PrintF("\\credits\\infinite");
  	  strOut+=strKey;
    } else if (sp.sp_ctCredits>0) {
      strKey.PrintF("\\credits\\%d", sp.sp_ctCredits);
  	  strOut+=strKey;
      strKey.PrintF("\\credits_left\\%d", sp.sp_ctCreditsLeft);
  	  strOut+=strKey;
    }
  } else {
    if (sp.sp_bUseFrags && sp.sp_iFragLimit>0) {
      strKey.PrintF("\\fraglimit\\%d", sp.sp_iFragLimit);
  	  strOut+=strKey;
    }
    if (!sp.sp_bUseFrags && sp.sp_iScoreLimit>0) {
      strKey.PrintF("\\fraglimit\\%d", sp.sp_iScoreLimit);
  	  strOut+=strKey;
    }
    if (sp.sp_iTimeLimit>0) {
      strKey.PrintF("\\timelimit\\%d", sp.sp_iTimeLimit);
  	  strOut+=strKey;
    }
  }

  strOut+=gam_strGameSpyExtras;
  return strOut;
};

ULONG GetSpawnFlagsForGameType(INDEX iGameType) {
  switch(iGameType) {
    default:
      ASSERT(FALSE);
    case CSessionProperties::GM_COOPERATIVE:  return SPF_COOPERATIVE;
    case CSessionProperties::GM_SCOREMATCH:   return SPF_DEATHMATCH;
    case CSessionProperties::GM_FRAGMATCH:    return SPF_DEATHMATCH;
  }
};

