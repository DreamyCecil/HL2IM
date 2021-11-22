// [Cecil] New Options Flags
#define HL2F_INFALT    (1<<0) // Infinite Alt Ammo
#define HL2F_BHOP      (1<<1) // Bunnyhopping
#define HL2F_AUTOBHOP  (1<<2) // Automatically jump after landing
#define HL2F_ENEMIES1  (1<<3) // Enemy improvements
#define HL2F_ENEMIES2  (1<<4) // Enemy improvements with extras
#define HL2F_MATERIALS (1<<5) // Use texture materials or not
#define HL2F_REINITMAP (1<<6) // Reinitialize some entities for compatibility (FE maps)
#define HL2F_ENEMYDROP (1<<7) // Enemies drop their weapons
#define HL2F_ADMINMENU (1<<8) // Everyone is allowed to use the admin menu

#define HL2F_GM_MASK (HL2F_INFALT|HL2F_BHOP|HL2F_ENEMIES1|HL2F_ENEMIES2|HL2F_ENEMYDROP)

// [Cecil] New Gamemodes
enum EHL2Gamemode {
  HLGM_NONE = -1,

  HLGM_ARMSRACE,  // Every kill upgrades the weapon; kills with a crowbar will downgrade enemy's weapon
  HLGM_DISSOLVE,  // Only AR2 with infinite Energy Balls
  HLGM_BUNNYHUNT, // Auto-bunnyhopping with sniper rifles, 1.5x speed and jumping
  HLGM_MINEKILL,  // Only Gravity Gun with rollermines instead of weapon and ammo items

  HLGM_LAST,
};

// [Cecil] Arms race levels
#define CT_ARMSRACE_LEVELS 10

/*
 * Class responsible for describing game session
 */
class CSessionProperties {
public:
  enum GameMode {
    GM_FLYOVER = -1,
    GM_COOPERATIVE = 0,
    GM_SCOREMATCH,
    GM_FRAGMATCH,
  };

  enum GameDifficulty {
    GD_TOURIST = -1,
    GD_EASY = 0,
    GD_NORMAL,
    GD_HARD,
    GD_EXTREME,
  };

  INDEX sp_ctMaxPlayers;    // maximum number of players in game
  BOOL sp_bWaitAllPlayers;  // wait for all players to connect
  BOOL sp_bQuickTest;       // set when game is tested from wed
  BOOL sp_bCooperative;     // players are not intended to kill each other
  BOOL sp_bSinglePlayer;    // single player mode has some special rules
  BOOL sp_bUseFrags;        // set if frags matter instead of score

  enum GameMode sp_gmGameMode;    // general game rules

  enum GameDifficulty sp_gdGameDifficulty;
  ULONG sp_ulSpawnFlags;
  BOOL sp_bMental;            // set if mental mode engaged

  INDEX sp_iScoreLimit;       // stop game after a player/team reaches given score
  INDEX sp_iFragLimit;        // stop game after a player/team reaches given score
  INDEX sp_iTimeLimit;        // stop game after given number of minutes elapses

  BOOL sp_bTeamPlay;          // players are divided in teams
  BOOL sp_bFriendlyFire;      // can harm player of same team
  BOOL sp_bWeaponsStay;       // weapon items do not dissapear when picked-up
  BOOL sp_bAmmoStays;         // ammo items do not dissapear when picked-up
  BOOL sp_bHealthArmorStays;  // health/armor items do exist
  BOOL sp_bPlayEntireGame;    // don't finish after one level in coop
  BOOL sp_bAllowHealth;       // health items do exist
  BOOL sp_bAllowArmor;        // armor items do exist
  BOOL sp_bInfiniteAmmo;      // ammo is not consumed when firing
  BOOL sp_bRespawnInPlace;    // players respawn on the place where they were killed, not on markers (coop only)

  FLOAT sp_fEnemyMovementSpeed; // enemy speed multiplier
  FLOAT sp_fEnemyAttackSpeed;   // enemy speed multiplier
  FLOAT sp_fDamageStrength;     // multiplier when damaged
  FLOAT sp_fAmmoQuantity;       // multiplier when picking up ammo
  FLOAT sp_fManaTransferFactor; // multiplier for the killed player mana that is to be added to killer's mana
  INDEX sp_iInitialMana;        // life price (mana that each player'll have upon respawning)
  FLOAT sp_fExtraEnemyStrength;            // fixed adder for extra enemy power 
  FLOAT sp_fExtraEnemyStrengthPerPlayer;   // adder for extra enemy power per each player playing

  INDEX sp_ctCredits;           // number of credits for this game
  INDEX sp_ctCreditsLeft;       // number of credits left on this level
  FLOAT sp_tmSpawnInvulnerability;   // how many seconds players are invunerable after respawning

  INDEX sp_iBlood;         // blood/gibs type (0=none, 1=green, 2=red, 3=hippie)
  BOOL  sp_bGibs;          // enable/disable gibbing

  BOOL  sp_bEndOfGame;     // marked when dm game is finished (any of the limits reached)
  ULONG sp_ulLevelsMask;    // mask of visited levels so far
  BOOL  sp_bUseExtraEnemies;  // spawn extra multiplayer enemies

  // [Cecil] New options
  INDEX sp_iHLGamemode;
  FLOAT sp_fMagMultiplier;
  FLOAT sp_fSpeedMultiplier;
  FLOAT sp_fJumpMultiplier;
  INDEX sp_iHL2Flags;
  INDEX sp_iStartWeapons;
  FLOAT sp_fGravityGunPower;
};

// NOTE: never instantiate CSessionProperties, as its size is not fixed to the size defined in engine
// use CUniversalSessionProperties for instantiating an object
class CUniversalSessionProperties {
public:
  union {
    CSessionProperties usp_sp;
    UBYTE usp_aubDummy[NET_MAXSESSIONPROPERTIES];
  };

  // must have exact the size as allocated block in engine
  CUniversalSessionProperties() { 
    ASSERT(sizeof(CSessionProperties)<=NET_MAXSESSIONPROPERTIES); 
    ASSERT(sizeof(CUniversalSessionProperties)==NET_MAXSESSIONPROPERTIES); 
  }
  operator CSessionProperties&(void) { return usp_sp; }
};

