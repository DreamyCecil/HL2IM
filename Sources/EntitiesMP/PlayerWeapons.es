402
%{
#include "StdH.h"
#include "GameMP/SEColors.h"
  
#include <Engine/Build.h>

// [Cecil] Half-Life 2 Weapons
#include "EntitiesMP/Cecil/Weapons.h"
#include "EntitiesMP/Cecil/Effects.h"
#include "HL2Models/PistolAnims.h"
#include "HL2Models/ShotgunAnims.h"
#include "HL2Models/SMG1Anims.h"
#include "HL2Models/357Anims.h"
#include "HL2Models/AR2Anims.h"
#include "HL2Models/CrowbarAnims.h"
#include "HL2Models/GrenadeAnims.h"
#include "HL2Models/RPGAnims.h"
#include "HL2Models/CrossbowAnims.h"
#include "HL2Models/GravityGunAnims.h"
// [Cecil] TEMP: G3SG1
#include "HL2Models/CSS_SniperAnims.h"

// [Cecil] Boss counter
#include "EntitiesMP/AirElemental.h"
// [Cecil] Flying enemies' offset
#include "EntitiesMP/EnemyFly.h"

#include "EntitiesMP/Player.h"
#include "EntitiesMP/Bullet.h"
#include "Models/Weapons/Laser/Laser.h"
#include "Models/Weapons/Laser/Barrel.h"
#include "Models/Weapons/Cannon/Cannon.h"
#include "Models/Weapons/Cannon/Body.h"
#include "ModelsMP/Weapons/Flamer/Flamer.h"
#include "ModelsMP/Weapons/Flamer/Body.h"
#include "ModelsMP/Weapons/Flamer/FuelReservoir.h"
#include "ModelsMP/Weapons/Flamer/Flame.h"

// Mission Pack player body instead of the old one
#include "ModelsMP/Player/SeriousSam/Body.h"
#include "ModelsMP/Player/SeriousSam/Player.h"

#include "EntitiesMP/Switch.h"
#include "EntitiesMP/PlayerView.h"
#include "EntitiesMP/PlayerAnimator.h"
#include "EntitiesMP/MovingBrush.h"
#include "EntitiesMP/MessageHolder.h"
#include "EntitiesMP/EnemyBase.h"
extern INDEX hud_bShowWeapon;

// [Cecil] Crosshair bars
#include "EntitiesMP/Common/UI/UI.h"
extern INDEX hl2_colUIMain;
extern INDEX hl2_colUIEmpty;
extern INDEX hl2_bCrosshairColoring;

#include "EntitiesMP/Cecil/Physics.h"

// [Cecil] For class IDs
#include "EntitiesMP/Mod/PhysBase.h"
#include "EntitiesMP/Mod/Radio.h"
#include "EntitiesMP/Mod/RollerMine.h"
#include "EntitiesMP/RollingStone.h"

// [Cecil] Current viewer player
extern CEntity *_penViewPlayer;

extern const INDEX _aiWeaponsRemap[19] = {
   0, 1, 10, 2, 3, 6, 7, 4, 13, 5, 9, 8, 11, 12, 14, 15, 16, 17, 18,
};

// [Cecil] New ammo system
extern const INDEX _aiMaxAmmo[11];
extern const INDEX _aiMaxMag[8];
extern const INDEX _aiTakeAmmo[11];
extern const INDEX _aiTakeWeaponAmmo[15];

// [Cecil] Damage Multiplier
extern FLOAT cht_fDamageMul;

// [Cecil] Weapon Sounds
#define SND_FIRE_1 0
#define SND_FIRE_2 1
#define SND_RELOAD 2
#define SND_ALT    3
#define SND_EMPTY  4

#define EMPTY_MAG (GetMagCount(m_iCurrentWeapon) <= 0)
#define HAS_AMMO(Weapon) (GetAmmo(Weapon) > 0 || GetMagCount(Weapon) > 0 || GetAltAmmoCount(Weapon) > 0)
%}

uses "EntitiesMP/Player";
uses "EntitiesMP/PlayerWeaponsEffects";
uses "EntitiesMP/Projectile";
uses "EntitiesMP/Bullet";
uses "EntitiesMP/BasicEffects";
uses "EntitiesMP/WeaponItem";
uses "EntitiesMP/AmmoItem";
uses "EntitiesMP/AmmoPack";
uses "EntitiesMP/ModelHolder2";
uses "EntitiesMP/CannonBall";

// input parameter for weapons
event EWeaponsInit {
  CEntityPointer penOwner,        // who owns it
};

// select weapon
event ESelectWeapon {
  INDEX iWeapon,          // weapon to select
};

// fire weapon
event EFireWeapon {};
// [Cecil] Alt fire weapon
event EAltFireWeapon {};
// [Cecil] Interrupt whatever the weapon is doing
event EInterrupt {};

// release weapon
event EReleaseWeapon {};
// reload weapon
event EReloadWeapon {};
// weapon changed - used to notify other entities
event EWeaponChanged {};

// [Cecil] Renamed but not reordered
// weapons (do not change order! - needed by HUD.cpp)
enum WeaponType {
  0 WEAPON_NONE          "", // don't consider this in WEAPONS_ALLAVAILABLEMASK
  1 WEAPON_CROWBAR       "",
  2 WEAPON_PISTOL        "",
  3 WEAPON_357           "",
  4 WEAPON_SPAS          "",
  5 WEAPON_G3SG1         "",
  6 WEAPON_SMG1          "",
  7 WEAPON_AR2           "",
  8 WEAPON_RPG           "",
  9 WEAPON_GRENADE       "",
 10 WEAPON_GRAVITYGUN    "",
 11 WEAPON_FLAMER        "",
 12 WEAPON_LASER         "",
 13 WEAPON_CROSSBOW      "",
 14 WEAPON_IRONCANNON    "",
 15 WEAPON_LAST          "",
}; // see 'WEAPONS_ALLAVAILABLEMASK' -> (11111111111111 == 0x3FFF)

%{
// AVAILABLE WEAPON MASK
#define WEAPONS_ALLAVAILABLEMASK 0x3FFF
#define MAX_WEAPONS 30

// MiniGun specific
#define MINIGUN_STATIC      0
#define MINIGUN_FIRE        1
#define MINIGUN_SPINUP      2
#define MINIGUN_SPINDOWN    3

#define MINIGUN_SPINUPTIME      0.5f
#define MINIGUN_SPINDNTIME      3.0f
#define MINIGUN_SPINUPSOUND     0.5f
#define MINIGUN_SPINDNSOUND     1.5f
#define MINIGUN_FULLSPEED       500.0f
#define MINIGUN_SPINUPACC       (MINIGUN_FULLSPEED/MINIGUN_SPINUPTIME)
#define MINIGUN_SPINDNACC       (MINIGUN_FULLSPEED/MINIGUN_SPINDNTIME)
#define MINIGUN_TICKTIME        (_pTimer->TickQuantum)

// chainsaw specific
#define CHAINSAW_UPDATETIME     0.05f

// fire flare specific
#define FLARE_REMOVE 1
#define FLARE_ADD 2

// animation light specific
#define LIGHT_ANIM_FIRE 0 // [Cecil] Replaced all animations with this single one
#define LIGHT_ANIM_NONE 1

// mana for ammo adjustment (multiplier)
#define MANA_AMMO (0.1f)

// position of weapon model -- weapon 0 is never used
static FLOAT wpn_fH[MAX_WEAPONS+1];
static FLOAT wpn_fP[MAX_WEAPONS+1];
static FLOAT wpn_fB[MAX_WEAPONS+1];
static FLOAT wpn_fX[MAX_WEAPONS+1];
static FLOAT wpn_fY[MAX_WEAPONS+1];
static FLOAT wpn_fZ[MAX_WEAPONS+1];
static FLOAT wpn_fFOV[MAX_WEAPONS+1];
static FLOAT wpn_fClip[MAX_WEAPONS+1];
static FLOAT wpn_fFX[MAX_WEAPONS+1];  // firing source
static FLOAT wpn_fFY[MAX_WEAPONS+1];
static INDEX wpn_iCurrent;
extern FLOAT hud_tmWeaponsOnScreen;

// bullet positions
static FLOAT afSingleShotgunPellets[] =
{     -0.3f,+0.1f,    +0.0f,+0.1f,   +0.3f,+0.1f,
  -0.4f,-0.1f,  -0.1f,-0.1f,  +0.1f,-0.1f,  +0.4f,-0.1f
};
static FLOAT afDoubleShotgunPellets[] =
{
      -0.3f,+0.15f, +0.0f,+0.15f, +0.3f,+0.15f,
  -0.4f,+0.05f, -0.1f,+0.05f, +0.1f,+0.05f, +0.4f,+0.05f,
      -0.3f,-0.05f, +0.0f,-0.05f, +0.3f,-0.05f,
  -0.4f,-0.15f, -0.1f,-0.15f, +0.1f,-0.15f, +0.4f,-0.15f
};

// sniper discrete zoom values - 4 (1x,2x,4x,6x)
// synchronize this with sniper properties (properties 233-237)
static INDEX iSniperDiscreteZoomLevels = 4;
static FLOAT afSniperZoom[] =
{
      90.0f,1.0f, 53.1f, 2.0f, 28.0f,4.0f, 14.2f,6.0f, 
       //7.2f,8.0f, 3.56f,10.0f ,1.8f,12.0f
};

// [Cecil] Sniper Zoom Levels
static INDEX _iCSSSniperZoomLevels = 2;
static FLOAT _afCSSSniperZoom[] = {
  /*53.1f, 2.0f,
  28.0f, 4.0f,*/
  40.5f, 3.0f,
  14.2f, 6.0f,
};

// [Cecil] Weapon Zoom
extern FLOAT _afWeaponZoom[] = {
  90.0f, 1.0f,
  //40.5f, 3.0f,
  28.0f, 4.0f,
};

// crosshair console variables
static INDEX hud_bCrosshairFixed    = FALSE;
// [Cecil] Replaced hud_bCrosshairColoring and set it to FALSE by default
static INDEX hl2_bCrosshairColoring = FALSE;
static FLOAT hud_fCrosshairScale    = 1.0f;
static FLOAT hud_fCrosshairOpacity  = 1.0f;
static FLOAT hud_fCrosshairRatio    = 0.5f;  // max distance size ratio
// misc HUD vars
static INDEX hud_bShowPlayerName = TRUE;
static INDEX hud_bShowCoords     = FALSE;
static FLOAT plr_tmSnoopingDelay = 1.0f; // seconds 
extern FLOAT plr_tmSnoopingTime  = 1.0f; // seconds 

// some static vars
static INDEX _iLastCrosshairType = -1;
static CTextureObject _toCrosshair;

// [Cecil] Crosshair bars
static CTextureObject _toBarEmpty;
static CTextureObject _toBarFull;

// must do this to keep dependency catcher happy
CTFileName fn1 = CTFILENAME("Textures\\Interface\\Crosshair.tex");
CTFileName fn2 = CTFILENAME("Textures\\Interface\\BarEmpty.tex");
CTFileName fn3 = CTFILENAME("Textures\\Interface\\BarFull.tex");

void CPlayerWeapons_Precache(ULONG ulAvailable)
{
  CDLLEntityClass *pdec = &CPlayerWeapons_DLLClass;

  // precache general stuff always
  pdec->PrecacheTexture(TEX_REFL_BWRIPLES01);
  pdec->PrecacheTexture(TEX_REFL_BWRIPLES02);
  pdec->PrecacheTexture(TEX_REFL_LIGHTMETAL01);
  pdec->PrecacheTexture(TEX_REFL_LIGHTBLUEMETAL01);
  pdec->PrecacheTexture(TEX_REFL_DARKMETAL);
  pdec->PrecacheTexture(TEX_REFL_PURPLE01);
  pdec->PrecacheTexture(TEX_SPEC_WEAK);
  pdec->PrecacheTexture(TEX_SPEC_MEDIUM);
  pdec->PrecacheTexture(TEX_SPEC_STRONG);
  pdec->PrecacheTexture(TEXTURE_HAND);
  pdec->PrecacheTexture(TEXTURE_FLARE01);
  pdec->PrecacheModel(MODEL_FLARE01);
  pdec->PrecacheClass(CLASS_BULLET);
  pdec->PrecacheSound(SOUND_SILENCE);

  // [Cecil] Half-Life 2
  pdec->PrecacheTexture(TEXTURE_HL2_HAND);
  pdec->PrecacheModel(MODEL_FLARE3D);
  pdec->PrecacheTexture(TEXTURE_FLARE3D);

  // [Cecil] Impact Sounds
  for (INDEX iSound = SOUND_SAND_IMPACT1; iSound < SOUND_SILENCE; iSound++) {
    pdec->PrecacheSound(iSound);
  }

  // [Cecil] Other Sounds
  pdec->PrecacheSound(SOUND_SELECT_WEAPON);
  pdec->PrecacheSound(SOUND_WARNING);
  pdec->PrecacheSound(SOUND_AMMO);

  // precache other weapons if available
  pdec->PrecacheModel(MODEL_CROWBAR_HANDLER);
  pdec->PrecacheModel(MODEL_CROWBAR);
  pdec->PrecacheModel(MODEL_CROWBAR_HAND);
  pdec->PrecacheTexture(TEXTURE_CROWBAR);
  pdec->PrecacheSound(SOUND_CROWBAR_SWING);
  pdec->PrecacheSound(SOUND_CROWBAR_IMPACT1);
  pdec->PrecacheSound(SOUND_CROWBAR_IMPACT2);

  pdec->PrecacheModel(MODEL_PISTOL_HANDLER);
  pdec->PrecacheModel(MODEL_PISTOL);
  pdec->PrecacheModel(MODEL_PISTOL_HAND);
  pdec->PrecacheModel(MODEL_PISTOL_LIGHTS);
  pdec->PrecacheTexture(TEXTURE_PISTOL);
  pdec->PrecacheTexture(TEXTURE_PISTOL_LIGHTS);
  pdec->PrecacheSound(SOUND_PISTOL_FIRE);
  pdec->PrecacheSound(SOUND_PISTOL_RELOAD);
  pdec->PrecacheSound(SOUND_PISTOL_EMPTY);

  pdec->PrecacheModel(MODEL_357_HANDLER);
  pdec->PrecacheModel(MODEL_357);
  pdec->PrecacheModel(MODEL_357_HAND);
  pdec->PrecacheTexture(TEXTURE_357);
  pdec->PrecacheSound(SOUND_357_FIRE);
  pdec->PrecacheSound(SOUND_357_RELOAD);

  pdec->PrecacheModel(MODEL_SPAS_HANDLER);
  pdec->PrecacheModel(MODEL_SPAS);
  pdec->PrecacheModel(MODEL_SPAS_HAND);
  pdec->PrecacheModel(MODEL_SPAS_SHELL);
  pdec->PrecacheTexture(TEXTURE_SPAS);
  pdec->PrecacheTexture(TEXTURE_SPAS_SHELL);
  pdec->PrecacheSound(SOUND_SPAS_ALTFIRE);
  pdec->PrecacheSound(SOUND_SPAS_FIRE1);
  pdec->PrecacheSound(SOUND_SPAS_FIRE2);
  pdec->PrecacheSound(SOUND_SPAS_PUMP);
  pdec->PrecacheSound(SOUND_SPAS_RELOAD1);
  pdec->PrecacheSound(SOUND_SPAS_RELOAD2);
  pdec->PrecacheSound(SOUND_SPAS_RELOAD3);
  pdec->PrecacheSound(SOUND_SPAS_EMPTY);

  pdec->PrecacheModel(MODEL_SMG1_HANDLER);
  pdec->PrecacheModel(MODEL_SMG1);
  pdec->PrecacheModel(MODEL_SMG1_HAND);
  pdec->PrecacheModel(MODEL_SMG1_SIGHT);
  pdec->PrecacheModel(MODEL_SMG1_MAG);
  pdec->PrecacheTexture(TEXTURE_SMG1);
  pdec->PrecacheTexture(TEXTURE_SMG1_SIGHT);
  pdec->PrecacheTexture(TEXTURE_SMG1_MAG);
  pdec->PrecacheSound(SOUND_SMG1_FIRE);
  pdec->PrecacheSound(SOUND_SMG1_RELOAD);
  pdec->PrecacheSound(SOUND_SMG1_ALTFIRE);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_SMG1_GRENADE);

  pdec->PrecacheModel(MODEL_CSS_SNIPER_HANDLER);
  pdec->PrecacheModel(MODEL_CSS_SNIPER);
  pdec->PrecacheModel(MODEL_CSS_SNIPER_HAND);
  pdec->PrecacheTexture(TEXTURE_CSS_SNIPER);
  pdec->PrecacheTexture(TEXTURE_CSS_SNIPER_HAND);
  pdec->PrecacheSound(SOUND_CSS_SNIPER_FIRE);
  pdec->PrecacheSound(SOUND_CSS_SNIPER_RELOAD);

  pdec->PrecacheModel(MODEL_CROSSBOW_HANDLER);
  pdec->PrecacheModel(MODEL_CROSSBOW);
  pdec->PrecacheModel(MODEL_CROSSBOW_HAND);
  pdec->PrecacheTexture(TEXTURE_CROSSBOW);
  pdec->PrecacheSound(SOUND_CROSSBOW_FIRE);
  pdec->PrecacheSound(SOUND_CROSSBOW_LOAD1);
  pdec->PrecacheSound(SOUND_CROSSBOW_LOAD2);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_CROSSBOW_ROD);

  pdec->PrecacheModel(MODEL_AR2);
  pdec->PrecacheModel(MODEL_AR2_HAND);
  pdec->PrecacheModel(MODEL_AR2_CORE);
  pdec->PrecacheModel(MODEL_AR2_GLOW);
  pdec->PrecacheTexture(TEXTURE_AR2);
  pdec->PrecacheTexture(TEXTURE_AR2_CORE);
  pdec->PrecacheTexture(TEXTURE_AR2_GLOW);
  pdec->PrecacheSound(SOUND_AR2_FIRE);
  pdec->PrecacheSound(SOUND_AR2_RELOAD);
  pdec->PrecacheSound(SOUND_AR2_ALTFIRE);
  pdec->PrecacheSound(SOUND_AR2_CHARGE);
  pdec->PrecacheSound(SOUND_AR2_EMPTY);
  pdec->PrecacheTexture(TEXTURE_AR2_FLARE);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_ENERGY_BALL);

  pdec->PrecacheModel(MODEL_RPG_HANDLER);
  pdec->PrecacheModel(MODEL_RPG_HAND);
  pdec->PrecacheModel(MODEL_RPG);
  pdec->PrecacheTexture(TEXTURE_RPG);
  pdec->PrecacheSound(SOUND_RPG_FIRE);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_ROCKET);

  pdec->PrecacheModel(MODEL_GRENADE_HANDLER); 
  pdec->PrecacheModel(MODEL_GRENADE_HAND); 
  pdec->PrecacheModel(MODEL_GRENADE);
  pdec->PrecacheTexture(TEXTURE_GRENADE);
  pdec->PrecacheSound(SOUND_GRENADE_TICK);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_GRENADE);

  pdec->PrecacheModel(MODEL_GRAVITYGUN);
  pdec->PrecacheModel(MODEL_GG_HAND);
  pdec->PrecacheModel(MODEL_GG_CORE);
  pdec->PrecacheModel(MODEL_GG_CHARGE);
  pdec->PrecacheModel(MODEL_GG_LAUNCH);
  pdec->PrecacheModel(MODEL_GG_COREGLOW);
  pdec->PrecacheModel(MODEL_GG_BASEGLOW);
  pdec->PrecacheTexture(TEXTURE_GRAVITYGUN);
  pdec->PrecacheTexture(TEXTURE_GG_CORE);
  pdec->PrecacheTexture(TEXTURE_GG_CHARGE);
  pdec->PrecacheTexture(TEXTURE_GG_FLARE);
  pdec->PrecacheTexture(TEXTURE_GG_GLOW);
  pdec->PrecacheSound(SOUND_GG_CLOSE);
  pdec->PrecacheSound(SOUND_GG_OPEN);
  pdec->PrecacheSound(SOUND_GG_PICKUP);
  pdec->PrecacheSound(SOUND_GG_DROP);
  pdec->PrecacheSound(SOUND_GG_HOLD);
  pdec->PrecacheSound(SOUND_GG_DRYFIRE);
  pdec->PrecacheSound(SOUND_GG_TOOHEAVY);
  pdec->PrecacheSound(SOUND_GG_LAUNCH1);
  pdec->PrecacheSound(SOUND_GG_LAUNCH2);
  pdec->PrecacheSound(SOUND_GG_LAUNCH3);
  pdec->PrecacheSound(SOUND_GG_LAUNCH4);

  pdec->PrecacheModel(MODEL_FLAMER);
  pdec->PrecacheModel(MODEL_FL_BODY);
  pdec->PrecacheModel(MODEL_FL_RESERVOIR);
  pdec->PrecacheModel(MODEL_FL_FLAME);
  pdec->PrecacheTexture(TEXTURE_FL_BODY);  
  pdec->PrecacheTexture(TEXTURE_FL_FLAME);  
  pdec->PrecacheTexture(TEXTURE_FL_FUELRESERVOIR);  
  pdec->PrecacheSound(SOUND_FL_FIRE);
  pdec->PrecacheSound(SOUND_FL_START);
  pdec->PrecacheSound(SOUND_FL_STOP);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_FLAME);

  pdec->PrecacheModel(MODEL_LASER);
  pdec->PrecacheModel(MODEL_LS_BODY);
  pdec->PrecacheModel(MODEL_LS_BARREL);
  pdec->PrecacheTexture(TEXTURE_LS_BODY);  
  pdec->PrecacheTexture(TEXTURE_LS_BARREL);  
  pdec->PrecacheSound(SOUND_LASER_FIRE);
  pdec->PrecacheClass(CLASS_PROJECTILE, PRT_LASER_RAY);

  pdec->PrecacheModel(MODEL_CANNON);
  pdec->PrecacheModel(MODEL_CN_BODY);
  pdec->PrecacheTexture(TEXTURE_CANNON);
  pdec->PrecacheSound(SOUND_CANNON);
  pdec->PrecacheSound(SOUND_CANNON_PREPARE);
  pdec->PrecacheClass(CLASS_CANNONBALL);

  // precache animator too
  extern void CPlayerAnimator_Precache(ULONG ulAvailable);
  CPlayerAnimator_Precache(ulAvailable);
}

void CPlayerWeapons_Init(void) {
  // declare weapon position controls
  _pShell->DeclareSymbol("user INDEX wpn_iCurrent;", &wpn_iCurrent);

  #include "Common/WeaponPositions.h"
  
  // declare crosshair and its coordinates
  _pShell->DeclareSymbol("persistent user INDEX hud_bCrosshairFixed;",    &hud_bCrosshairFixed);
  _pShell->DeclareSymbol("persistent user FLOAT hud_fCrosshairScale;",    &hud_fCrosshairScale);
  _pShell->DeclareSymbol("persistent user FLOAT hud_fCrosshairRatio;",    &hud_fCrosshairRatio);
  _pShell->DeclareSymbol("persistent user FLOAT hud_fCrosshairOpacity;",  &hud_fCrosshairOpacity);

  // [Cecil] hud_bCrosshairColoring -> hl2_bCrosshairColoring
  _pShell->DeclareSymbol("persistent user INDEX hl2_bCrosshairColoring;", &hl2_bCrosshairColoring);
                                  
  _pShell->DeclareSymbol("persistent user INDEX hud_bShowPlayerName;", &hud_bShowPlayerName);
  _pShell->DeclareSymbol("persistent user INDEX hud_bShowCoords;",     &hud_bShowCoords);

  _pShell->DeclareSymbol("persistent user FLOAT plr_tmSnoopingTime;",  &plr_tmSnoopingTime);
  _pShell->DeclareSymbol("persistent user FLOAT plr_tmSnoopingDelay;", &plr_tmSnoopingDelay);

  // precache base weapons
  CPlayerWeapons_Precache(0x03);
}

// extra weapon positions for shells dropout
static FLOAT afSingleShotgunShellPos[3] = { 0.2f, 0.0f, -0.31f};
static FLOAT afDoubleShotgunShellPos[3] = { 0.0f, 0.0f, -0.5f};
static FLOAT afTommygunShellPos[3] = { 0.2f, 0.0f, -0.31f};
static FLOAT afMinigunShellPos[3] = { 0.2f, 0.0f, -0.31f};
static FLOAT afMinigunShellPos3rdView[3] = { 0.2f, 0.2f, -0.31f};
static FLOAT afSniperShellPos[3] = { 0.2f, 0.0f, -0.15f};

static FLOAT afRightColtPipe[3] = { 0.07f, -0.05f, -0.26f};
static FLOAT afSingleShotgunPipe[3] = { 0.2f, 0.0f, -1.25f};
static FLOAT afDoubleShotgunPipe[3] = { 0.2f, 0.0f, -1.25f};
static FLOAT afTommygunPipe[3] = { -0.06f, 0.1f, -0.6f};
static FLOAT afMinigunPipe[3] = { -0.06f, 0.0f, -0.6f};
static FLOAT afMinigunPipe3rdView[3] = { 0.25f, 0.3f, -2.5f};
%}

class export CPlayerWeapons : CRationalEntity {
name      "Player Weapons";
thumbnail "";
features "CanBePredictable";

properties:
  1 CEntityPointer m_penPlayer,       // player which owns it
  2 BOOL m_bFireWeapon = FALSE,       // weapon is firing
  4 enum WeaponType m_iCurrentWeapon  = WEAPON_NONE, // currently active weapon (internal)
  5 enum WeaponType m_iWantedWeapon   = WEAPON_NONE, // wanted weapon (internal)
  6 enum WeaponType m_iPreviousWeapon = WEAPON_NONE, // previous active weapon (internal)
 11 INDEX m_iAvailableWeapons = 0x00,   // available weapons
 12 BOOL  m_bChangeWeapon = FALSE,      // change current weapon
 13 BOOL  m_bReloadWeapon = FALSE,      // reload weapon
 14 BOOL  m_bMirrorFire   = FALSE,      // fire with mirror model
 15 INDEX m_iAnim         = 0,          // temporary anim variable
 16 FLOAT m_fAnimWaitTime = 0.0f,       // animation wait time
 17 FLOAT m_tmRangeSoundSpawned = 0.0f, // for not spawning range sounds too often
 23 BOOL  m_bSniperZoom = FALSE,        // zoom sniper
 24 FLOAT m_fSniperFOV      = 90.0f,    // sniper FOV
 28 FLOAT m_fSniperFOVlast  = 90.0f,    // sniper FOV for lerping

 18 CTString m_strLastTarget   = "",      // string for last target
 19 FLOAT m_tmTargetingStarted = -99.0f,  // when targeting started
 20 FLOAT m_tmLastTarget       = -99.0f,  // when last target was seen
 21 FLOAT m_tmSnoopingStarted  = -99.0f,  // is player spying another player
 22 CEntityPointer m_penTargeting,        // who is the target
 
 25 CModelObject m_moWeapon,               // current weapon model
 26 CModelObject m_moWeaponSecond,         // current weapon second (additional) model
 27 FLOAT m_tmWeaponChangeRequired = 0.0f, // time when weapon change was required

 30 CEntityPointer m_penRayHit,         // entity hit by ray
 31 FLOAT m_fRayHitDistance = 100.0f,   // distance from hit point
 32 FLOAT m_fEnemyHealth    = 0.0f,     // normalized health of enemy in target (for coloring of crosshair)
 33 FLOAT3D m_vRayHit     = FLOAT3D(0,0,0), // coordinates where ray hit
 34 FLOAT3D m_vRayHitLast = FLOAT3D(0,0,0), // for lerping
 35 FLOAT3D m_vBulletSource = FLOAT3D(0,0,0), // bullet launch position remembered here
 36 FLOAT3D m_vBulletTarget = FLOAT3D(0,0,0), // bullet hit (if hit) position remembered here

// lerped bullets fire
230 FLOAT3D m_iLastBulletPosition = FLOAT3D(32000.0f, 32000.0f, 32000.0f),
// sniper
233 FLOAT m_fSniperMaxFOV = 90.0f,
234 FLOAT m_fSniperMinFOV = 14.2f,
235 FLOAT m_fSnipingZoomSpeed = 2.0f,
236 INDEX m_iSniping = 0, // [Cecil] New zoom system (< than 0 - smooth zoom, > than 0 - CSS-like zoom)
237 INDEX m_iRestoreZoom = 0, // [Cecil] m_fMinimumZoomFOV repurposed to zoom restoration
238 FLOAT m_tmLastSniperFire = 0.0f,
// flamer
240 CEntityPointer m_penFlame,
// laser
245 INDEX m_iLaserBarrel = 0,
// fire flare
251 INDEX m_iFlare = FLARE_REMOVE,       // 0-none, 1-remove, 2-add
252 INDEX m_iSecondFlare = FLARE_REMOVE, // 0-none, 1-remove, 2-add
// cannon
260 FLOAT m_fWeaponDrawPowerOld = 0,
261 FLOAT m_fWeaponDrawPower = 0,
262 FLOAT m_tmDrawStartTime = 0.0f,

270 FLOAT m_tmFlamerStart=1e6,
271 FLOAT m_tmFlamerStop=1e9,
272 FLOAT m_tmLastChainsawSpray = 0.0f,

// [Cecil]
300 BOOL m_bAltFireWeapon = FALSE,
301 BOOL m_bAmmo = FALSE,
302 BOOL m_bInterrupt = FALSE,
303 INDEX m_iNewShots = 0,

305 INDEX m_iCrowbarHit = 0,
306 INDEX m_iCrowbarSurface = 0,
307 enum SprayParticlesType m_sptCrowbarParticles = SPT_NONE,
308 BOOL m_bCrowbarKill = FALSE,

310 CEntityPointer m_penMissle,

320 INDEX m_iArmsRaceLevel = 0,

330 CEntityPointer m_penHolding, // Purely for keeping a reference to held object in m_syncHolding
331 BOOL m_bPickable = FALSE,
332 BOOL m_bLastPick = FALSE,
333 BOOL m_bCanPickObjects = FALSE,
334 BOOL m_bPullObject = FALSE,
335 FLOAT m_tmLaunchEffect = -100.0f,
336 FLOAT3D m_vGGFlare = FLOAT3D(1, 1, 1),
337 FLOAT3D m_vLastGGFlare = FLOAT3D(1, 1, 1),
338 FLOAT3D m_vGGHitPos = FLOAT3D(0, 0, 0),
339 FLOAT3D m_vGGHitDir = FLOAT3D(0, 1, 0),

// New ammo system
350 INDEX m_iUSP  = 0,
351 INDEX m_i357  = 0,
352 INDEX m_iSMG1 = 0,
353 INDEX m_iAR2  = 0,
354 INDEX m_iSPAS = 0,
355 INDEX m_iCrossbow = 0,
356 INDEX m_iGrenades = 0,
357 INDEX m_iRPG      = 0,
358 INDEX m_iCSSSniper = 0,
359 INDEX m_iSMG1_Grenades   = 0,
360 INDEX m_iAR2_EnergyBalls = 0,

370 INDEX m_iUSP_Max  = 0,
371 INDEX m_i357_Max  = 0,
372 INDEX m_iSMG1_Max = 0,
373 INDEX m_iAR2_Max  = 0,
374 INDEX m_iSPAS_Max = 0,
375 INDEX m_iCrossbow_Max = 0,
376 INDEX m_iGrenades_Max = 0,
377 INDEX m_iRPG_Max      = 0,
378 INDEX m_iCSSSniper_Max = 0,
379 INDEX m_iSMG1_Grenades_Max   = 0,
380 INDEX m_iAR2_EnergyBalls_Max = 0,

390 INDEX m_iUSP_Mag  = 0,
391 INDEX m_i357_Mag  = 0,
392 INDEX m_iSMG1_Mag = 0,
393 INDEX m_iAR2_Mag  = 0,
394 INDEX m_iSPAS_Mag = 0,
395 INDEX m_iCrossbow_Mag = 0,
396 INDEX m_iRPG_Mag      = 0,
397 INDEX m_iCSSSniper_Mag = 0,

400 INDEX m_iUSP_MagMax  = 0,
401 INDEX m_i357_MagMax  = 0,
402 INDEX m_iSMG1_MagMax = 0,
403 INDEX m_iAR2_MagMax  = 0,
404 INDEX m_iSPAS_MagMax = 0,
405 INDEX m_iCrossbow_MagMax = 0,
406 INDEX m_iRPG_MagMax      = 0,
407 INDEX m_iCSSSniper_MagMax = 0,

{
  CEntity *penBullet;
  CPlacement3D plBullet;
  FLOAT3D vBulletDestination;

  // [Cecil] Object held by the gravity gun
  CSyncedEntityPtr m_syncHolding;

  // [Cecil] Flare tick
  FLOAT m_tmFlareTick;

  // [Cecil] Hit Polygon
  CBrushPolygon *m_pbpoRayHit;

  // [Cecil] Flags of an object to restore
  ULONG m_ulObjectFlags;
  ANGLE3D m_aObjectAngle;

  // [Cecil] Play warning sound when ammo is low
  BOOL m_bAmmoWarning;

  // [Cecil] Special weapon particles
  FLOAT m_tmParticles;

  // [Cecil] When Gravity Gun launch happened (for rendering)
  FLOAT m_tmGGLaunch;
}

components:
  1 class   CLASS_PROJECTILE        "Classes\\Projectile.ecl",
  2 class   CLASS_BULLET            "Classes\\Bullet.ecl",
  3 class   CLASS_WEAPONEFFECT      "Classes\\PlayerWeaponsEffects.ecl",
  4 class   CLASS_PIPEBOMB          "Classes\\Pipebomb.ecl",
  5 class   CLASS_GHOSTBUSTERRAY    "Classes\\GhostBusterRay.ecl",
  6 class   CLASS_CANNONBALL        "Classes\\CannonBall.ecl",
  7 class   CLASS_WEAPONITEM        "Classes\\WeaponItem.ecl",
  8 class   CLASS_BASIC_EFFECT      "Classes\\BasicEffect.ecl",

// ************** HAND **************
 50 texture TEXTURE_HAND      "Models\\Weapons\\Hand.tex",
 51 texture TEXTURE_HL2_HAND  "Models\\Weapons\\HL2_Hand.tex",
 52 model   MODEL_FLARE3D     "Models\\Effects\\Weapons\\Flare02\\Flare.mdl",
 53 texture TEXTURE_FLARE3D   "Models\\Effects\\Weapons\\Flare02\\Flare.tex",
 54 texture TEXTURE_AR2_FLARE "Models\\Weapons\\PulseRifle\\Flare.tex",

// ************** KNIFE **************
100 model   MODEL_CROWBAR_HANDLER "Models\\Weapons\\Crowbar\\CrowbarHandler.mdl",
101 model   MODEL_CROWBAR         "Models\\Weapons\\Crowbar\\Crowbar.mdl",
102 model   MODEL_CROWBAR_HAND    "Models\\Weapons\\Crowbar\\Hand.mdl",
103 texture TEXTURE_CROWBAR       "Models\\Weapons\\Crowbar\\Crowbar.tex",
104 sound   SOUND_CROWBAR_SWING   "Models\\Weapons\\Crowbar\\Sounds\\Swing.wav",
 
// ************** HK USP **************
150 model   MODEL_PISTOL_HANDLER  "Models\\Weapons\\HK_USP\\PistolHandler.mdl",
151 model   MODEL_PISTOL          "Models\\Weapons\\HK_USP\\Pistol.mdl",
152 model   MODEL_PISTOL_HAND     "Models\\Weapons\\HK_USP\\Hand.mdl",
153 model   MODEL_PISTOL_LIGHTS   "Models\\Weapons\\HK_USP\\Lights.mdl",
154 texture TEXTURE_PISTOL        "Models\\Weapons\\HK_USP\\Pistol.tex",
155 texture TEXTURE_PISTOL_LIGHTS "Models\\Weapons\\HK_USP\\Lights.tex",
156 sound   SOUND_PISTOL_FIRE     "Models\\Weapons\\HK_USP\\Sounds\\Fire.wav",
157 sound   SOUND_PISTOL_RELOAD   "Models\\Weapons\\HK_USP\\Sounds\\Reload.wav",
158 sound   SOUND_PISTOL_EMPTY    "Models\\Weapons\\HK_USP\\Sounds\\Empty.wav",

// ************** SPAS-12 ************
200 model   MODEL_SPAS_HANDLER "Models\\Weapons\\SPAS12\\ShotgunHandler.mdl",
201 model   MODEL_SPAS         "Models\\Weapons\\SPAS12\\Shotgun.mdl",
202 model   MODEL_SPAS_HAND    "Models\\Weapons\\SPAS12\\Hand.mdl",
203 model   MODEL_SPAS_SHELL   "Models\\Weapons\\SPAS12\\Shell.mdl",
204 texture TEXTURE_SPAS       "Models\\Weapons\\SPAS12\\Shotgun.tex",
205 texture TEXTURE_SPAS_SHELL "Models\\Weapons\\SPAS12\\Shell.tex",
206 sound   SOUND_SPAS_ALTFIRE "Models\\Weapons\\SPAS12\\Sounds\\AltFire.wav",
207 sound   SOUND_SPAS_FIRE1   "Models\\Weapons\\SPAS12\\Sounds\\Fire1.wav",
208 sound   SOUND_SPAS_FIRE2   "Models\\Weapons\\SPAS12\\Sounds\\Fire2.wav",
209 sound   SOUND_SPAS_PUMP    "Models\\Weapons\\SPAS12\\Sounds\\Pump.wav",
210 sound   SOUND_SPAS_RELOAD1 "Models\\Weapons\\SPAS12\\Sounds\\Reload1.wav",
211 sound   SOUND_SPAS_RELOAD2 "Models\\Weapons\\SPAS12\\Sounds\\Reload2.wav",
212 sound   SOUND_SPAS_RELOAD3 "Models\\Weapons\\SPAS12\\Sounds\\Reload3.wav",
213 sound   SOUND_SPAS_EMPTY   "Models\\Weapons\\SPAS12\\Sounds\\Empty.wav",

// ************** SMG MP7 **************
250 model   MODEL_SMG1_HANDLER "Models\\Weapons\\MP7\\SMG1Handler.mdl",
251 model   MODEL_SMG1         "Models\\Weapons\\MP7\\SMG1.mdl",
252 model   MODEL_SMG1_HAND    "Models\\Weapons\\MP7\\Hand.mdl",
253 model   MODEL_SMG1_SIGHT   "Models\\Weapons\\MP7\\Sight.mdl",
254 model   MODEL_SMG1_MAG     "Models\\Weapons\\MP7\\Mag.mdl",
255 texture TEXTURE_SMG1       "Models\\Weapons\\MP7\\SMG1.tex",
256 texture TEXTURE_SMG1_SIGHT "Models\\Weapons\\MP7\\Sight.tex",
257 texture TEXTURE_SMG1_MAG   "Models\\Weapons\\MP7\\Mag.tex",
258 sound   SOUND_SMG1_FIRE     "Models\\Weapons\\MP7\\Sounds\\Fire.wav",
259 sound   SOUND_SMG1_RELOAD   "Models\\Weapons\\MP7\\Sounds\\Reload.wav",
260 sound   SOUND_SMG1_ALTFIRE  "Models\\Weapons\\MP7\\Sounds\\AltFire.wav",

// ************** .357 MAGNUM **************
301 model   MODEL_357_HANDLER "Models\\Weapons\\357_Magnum\\357Handler.mdl",
302 model   MODEL_357         "Models\\Weapons\\357_Magnum\\357.mdl",
303 model   MODEL_357_HAND    "Models\\Weapons\\357_Magnum\\Hand.mdl",
304 texture TEXTURE_357       "Models\\Weapons\\357_Magnum\\357.tex",
305 sound   SOUND_357_FIRE    "Models\\Weapons\\357_Magnum\\Sounds\\Fire.wav",
306 sound   SOUND_357_RELOAD  "Models\\Weapons\\357_Magnum\\Sounds\\Reload.wav",

// ************** PULSE RIFLE **************
350 model   MODEL_AR2         "Models\\Weapons\\PulseRifle\\AR2.mdl",
351 model   MODEL_AR2_HAND    "Models\\Weapons\\PulseRifle\\Hand.mdl",
352 model   MODEL_AR2_CORE    "Models\\Weapons\\PulseRifle\\Core.mdl",
353 model   MODEL_AR2_GLOW    "Models\\Weapons\\PulseRifle\\Glow.mdl",
354 texture TEXTURE_AR2       "Models\\Weapons\\PulseRifle\\AR2.tex",
355 texture TEXTURE_AR2_CORE  "Models\\Weapons\\PulseRifle\\Core.tex",
356 texture TEXTURE_AR2_GLOW  "Models\\Weapons\\PulseRifle\\Glow.tex",
357 sound   SOUND_AR2_FIRE     "Models\\Weapons\\PulseRifle\\Sounds\\Fire.wav",
358 sound   SOUND_AR2_RELOAD   "Models\\Weapons\\PulseRifle\\Sounds\\Reload.wav",
359 sound   SOUND_AR2_ALTFIRE  "Models\\Weapons\\PulseRifle\\Sounds\\AltFire.wav",
360 sound   SOUND_AR2_CHARGE   "Models\\Weapons\\PulseRifle\\Sounds\\Charge.wav",
361 sound   SOUND_AR2_EMPTY    "Models\\Weapons\\PulseRifle\\Sounds\\Empty.wav",

// ************** RPG **************
400 model   MODEL_RPG_HANDLER "Models\\Weapons\\RPG\\RPGHandler.mdl",
401 model   MODEL_RPG_HAND    "Models\\Weapons\\RPG\\Hand.mdl",
402 model   MODEL_RPG         "Models\\Weapons\\RPG\\RPG.mdl",
403 texture TEXTURE_RPG       "Models\\Weapons\\RPG\\RPG.tex",
404 sound   SOUND_RPG_FIRE    "Models\\Weapons\\RPG\\Sounds\\Fire.wav",

// ************** GRENADE **************
420 model   MODEL_GRENADE_HANDLER "Models\\Weapons\\Grenade\\GrenadeHandler.mdl",
421 model   MODEL_GRENADE_HAND    "Models\\Weapons\\Grenade\\Hand.mdl",
422 model   MODEL_GRENADE         "Models\\Weapons\\Grenade\\Grenade.mdl",
423 texture TEXTURE_GRENADE       "Models\\Weapons\\Grenade\\Grenade.tex",
424 sound   SOUND_GRENADE_TICK    "Models\\Weapons\\Grenade\\Sounds\\Tick.wav",

// ************** SNIPER **************
440 model   MODEL_CSS_SNIPER_HANDLER "Models\\Weapons\\CSS_G3SG1\\SniperHandler.mdl",
441 model   MODEL_CSS_SNIPER         "Models\\Weapons\\CSS_G3SG1\\Sniper.mdl",
442 model   MODEL_CSS_SNIPER_HAND    "Models\\Weapons\\CSS_G3SG1\\Hand.mdl",
443 texture TEXTURE_CSS_SNIPER       "Models\\Weapons\\CSS_G3SG1\\Sniper.tex",
444 texture TEXTURE_CSS_SNIPER_HAND  "Models\\Weapons\\CSS_G3SG1\\Hand.tex",
445 sound   SOUND_CSS_SNIPER_FIRE    "Models\\Weapons\\CSS_G3SG1\\Sounds\\Fire.wav",
446 sound   SOUND_CSS_SNIPER_RELOAD  "Models\\Weapons\\CSS_G3SG1\\Sounds\\Reload.wav",

460 model   MODEL_CROSSBOW_HANDLER "Models\\Weapons\\Crossbow\\CrossbowHandler.mdl",
461 model   MODEL_CROSSBOW         "Models\\Weapons\\Crossbow\\Crossbow.mdl",
462 model   MODEL_CROSSBOW_HAND    "Models\\Weapons\\Crossbow\\Hand.mdl",
463 texture TEXTURE_CROSSBOW       "Models\\Weapons\\Crossbow\\Crossbow.tex",
464 sound   SOUND_CROSSBOW_FIRE    "Models\\Weapons\\Crossbow\\Sounds\\Fire.wav",
465 sound   SOUND_CROSSBOW_LOAD1   "Models\\Weapons\\Crossbow\\Sounds\\Load1.wav",
466 sound   SOUND_CROSSBOW_LOAD2   "Models\\Weapons\\Crossbow\\Sounds\\Load2.wav",

// ************** FLAMER **************
500 model   MODEL_FLAMER                "ModelsMP\\Weapons\\Flamer\\Flamer.mdl",
501 model   MODEL_FL_BODY               "ModelsMP\\Weapons\\Flamer\\Body.mdl",
502 model   MODEL_FL_RESERVOIR          "ModelsMP\\Weapons\\Flamer\\FuelReservoir.mdl",
503 model   MODEL_FL_FLAME              "ModelsMP\\Weapons\\Flamer\\Flame.mdl",
504 texture TEXTURE_FL_BODY             "ModelsMP\\Weapons\\Flamer\\Body.tex",
505 texture TEXTURE_FL_FLAME            "ModelsMP\\Effects\\Flame\\Flame.tex",
506 sound   SOUND_FL_FIRE               "ModelsMP\\Weapons\\Flamer\\Sounds\\Fire.wav",
507 sound   SOUND_FL_START              "ModelsMP\\Weapons\\Flamer\\Sounds\\Start.wav",
508 sound   SOUND_FL_STOP               "ModelsMP\\Weapons\\Flamer\\Sounds\\Stop.wav",
509 texture TEXTURE_FL_FUELRESERVOIR    "ModelsMP\\Weapons\\Flamer\\FuelReservoir.tex",

// ************** LASER **************
520 model   MODEL_LASER                 "Models\\Weapons\\Laser\\Laser.mdl",
521 model   MODEL_LS_BODY               "Models\\Weapons\\Laser\\Body.mdl",
522 model   MODEL_LS_BARREL             "Models\\Weapons\\Laser\\Barrel.mdl",
524 texture TEXTURE_LS_BODY             "Models\\Weapons\\Laser\\Body.tex",
525 texture TEXTURE_LS_BARREL           "Models\\Weapons\\Laser\\Barrel.tex",
526 sound   SOUND_LASER_FIRE            "Models\\Weapons\\Laser\\Sounds\\_Fire.wav",

// ************** CHAINSAW **************
550 model   MODEL_GRAVITYGUN   "Models\\Weapons\\GravityGun\\GravityGun.mdl",
551 model   MODEL_GG_HAND      "Models\\Weapons\\GravityGun\\Hand.mdl",
552 model   MODEL_GG_CORE      "Models\\Weapons\\GravityGun\\CoreEffect.mdl",
553 model   MODEL_GG_CHARGE    "Models\\Weapons\\GravityGun\\ChargeEffect.mdl",
554 model   MODEL_GG_LAUNCH    "Models\\Weapons\\GravityGun\\LaunchEffect.mdl",
555 model   MODEL_GG_COREGLOW  "Models\\Weapons\\GravityGun\\GlowProngs.mdl",
556 model   MODEL_GG_BASEGLOW  "Models\\Weapons\\GravityGun\\GlowBase.mdl",
557 texture TEXTURE_GRAVITYGUN "Models\\Weapons\\GravityGun\\GravityGun.tex",
558 texture TEXTURE_GG_CORE    "Models\\Weapons\\GravityGun\\CoreEffect.tex",
559 texture TEXTURE_GG_CHARGE  "Models\\Weapons\\GravityGun\\Charge.tex",
560 texture TEXTURE_GG_FLARE   "Models\\Weapons\\GravityGun\\Flare.tex",
561 texture TEXTURE_GG_GLOW    "Models\\Weapons\\GravityGun\\Glow.tex",
562 sound   SOUND_GG_CLOSE     "Models\\Weapons\\GravityGun\\Sounds\\Close.wav",
563 sound   SOUND_GG_OPEN      "Models\\Weapons\\GravityGun\\Sounds\\Open.wav",
564 sound   SOUND_GG_PICKUP    "Models\\Weapons\\GravityGun\\Sounds\\Pickup.wav",
565 sound   SOUND_GG_DROP      "Models\\Weapons\\GravityGun\\Sounds\\Drop.wav",
566 sound   SOUND_GG_HOLD      "Models\\Weapons\\GravityGun\\Sounds\\Hold.wav",
567 sound   SOUND_GG_DRYFIRE   "Models\\Weapons\\GravityGun\\Sounds\\DryFire.wav",
568 sound   SOUND_GG_TOOHEAVY  "Models\\Weapons\\GravityGun\\Sounds\\TooHeavy.wav",
569 sound   SOUND_GG_LAUNCH1   "Models\\Weapons\\GravityGun\\Sounds\\Launch1.wav",
570 sound   SOUND_GG_LAUNCH2   "Models\\Weapons\\GravityGun\\Sounds\\Launch2.wav",
571 sound   SOUND_GG_LAUNCH3   "Models\\Weapons\\GravityGun\\Sounds\\Launch3.wav",
572 sound   SOUND_GG_LAUNCH4   "Models\\Weapons\\GravityGun\\Sounds\\Launch4.wav",

// ************** CANNON **************
600 model   MODEL_CANNON                "Models\\Weapons\\Cannon\\Cannon.mdl",
601 model   MODEL_CN_BODY               "Models\\Weapons\\Cannon\\Body.mdl",
602 texture TEXTURE_CANNON              "Models\\Weapons\\Cannon\\Body.tex",
603 sound   SOUND_CANNON                "Models\\Weapons\\Cannon\\Sounds\\Fire.wav",
604 sound   SOUND_CANNON_PREPARE        "Models\\Weapons\\Cannon\\Sounds\\Prepare.wav",

// ************** REFLECTIONS **************
620 texture TEX_REFL_BWRIPLES01         "Models\\ReflectionTextures\\BWRiples01.tex",
621 texture TEX_REFL_BWRIPLES02         "Models\\ReflectionTextures\\BWRiples02.tex",
622 texture TEX_REFL_LIGHTMETAL01       "Models\\ReflectionTextures\\LightMetal01.tex",
623 texture TEX_REFL_LIGHTBLUEMETAL01   "Models\\ReflectionTextures\\LightBlueMetal01.tex",
624 texture TEX_REFL_DARKMETAL          "Models\\ReflectionTextures\\DarkMetal.tex",
625 texture TEX_REFL_PURPLE01           "Models\\ReflectionTextures\\Purple01.tex",

// ************** SPECULAR **************
630 texture TEX_SPEC_WEAK               "Models\\SpecularTextures\\Weak.tex",
631 texture TEX_SPEC_MEDIUM             "Models\\SpecularTextures\\Medium.tex",
632 texture TEX_SPEC_STRONG             "Models\\SpecularTextures\\Strong.tex",

// ************** FLARES **************
640 model   MODEL_FLARE01   "Models\\Effects\\Weapons\\Flare01\\Flare.mdl",
641 texture TEXTURE_FLARE01 "Models\\Effects\\Weapons\\Flare01\\Flare.tex",

// [Cecil] Impact Sounds
700 sound SOUND_SAND_IMPACT1 "Sounds\\Impact\\sand1.wav",
701 sound SOUND_SAND_IMPACT2 "Sounds\\Impact\\sand2.wav",
702 sound SOUND_SAND_IMPACT3 "Sounds\\Impact\\sand3.wav",
703 sound SOUND_SAND_IMPACT4 "Sounds\\Impact\\sand4.wav",

704 sound SOUND_WOOD_IMPACT1 "Sounds\\Impact\\wood1.wav",
705 sound SOUND_WOOD_IMPACT2 "Sounds\\Impact\\wood2.wav",
706 sound SOUND_WOOD_IMPACT3 "Sounds\\Impact\\wood3.wav",
707 sound SOUND_WOOD_IMPACT4 "Sounds\\Impact\\wood4.wav",
708 sound SOUND_WOOD_IMPACT5 "Sounds\\Impact\\wood5.wav",

709 sound SOUND_METAL_IMPACT1 "Sounds\\Impact\\metal1.wav",
710 sound SOUND_METAL_IMPACT2 "Sounds\\Impact\\metal2.wav",
711 sound SOUND_METAL_IMPACT3 "Sounds\\Impact\\metal3.wav",
712 sound SOUND_METAL_IMPACT4 "Sounds\\Impact\\metal4.wav",

713 sound SOUND_CHAINLINK_IMPACT1 "Sounds\\Steps\\chainlink1.wav",
714 sound SOUND_CHAINLINK_IMPACT2 "Sounds\\Steps\\chainlink2.wav",
715 sound SOUND_CHAINLINK_IMPACT3 "Sounds\\Steps\\chainlink3.wav",
716 sound SOUND_CHAINLINK_IMPACT4 "Sounds\\Steps\\chainlink4.wav",

717 sound SOUND_CONCRETE_IMPACT1 "Sounds\\Impact\\concrete1.wav",
718 sound SOUND_CONCRETE_IMPACT2 "Sounds\\Impact\\concrete2.wav",
719 sound SOUND_CONCRETE_IMPACT3 "Sounds\\Impact\\concrete3.wav",
720 sound SOUND_CONCRETE_IMPACT4 "Sounds\\Impact\\concrete4.wav",

721 sound SOUND_PLASTICHARD_IMPACT1 "Sounds\\Impact\\plastic_hard1.wav",
722 sound SOUND_PLASTICHARD_IMPACT2 "Sounds\\Impact\\plastic_hard2.wav",
723 sound SOUND_PLASTICHARD_IMPACT3 "Sounds\\Impact\\plastic_hard3.wav",
724 sound SOUND_PLASTICHARD_IMPACT4 "Sounds\\Impact\\plastic_hard4.wav",

725 sound SOUND_PLASTICSOFT_IMPACT1 "Sounds\\Impact\\plastic_soft1.wav",
726 sound SOUND_PLASTICSOFT_IMPACT2 "Sounds\\Impact\\plastic_soft2.wav",
727 sound SOUND_PLASTICSOFT_IMPACT3 "Sounds\\Impact\\plastic_soft3.wav",
728 sound SOUND_PLASTICSOFT_IMPACT4 "Sounds\\Impact\\plastic_soft4.wav",

729 sound SOUND_TILE_IMPACT1 "Sounds\\Impact\\tile1.wav",
730 sound SOUND_TILE_IMPACT2 "Sounds\\Impact\\tile2.wav",
731 sound SOUND_TILE_IMPACT3 "Sounds\\Impact\\tile3.wav",
732 sound SOUND_TILE_IMPACT4 "Sounds\\Impact\\tile4.wav",

733 sound SOUND_GLASS_IMPACT1 "Sounds\\Impact\\glass1.wav",
734 sound SOUND_GLASS_IMPACT2 "Sounds\\Impact\\glass2.wav",
735 sound SOUND_GLASS_IMPACT3 "Sounds\\Impact\\glass3.wav",
736 sound SOUND_GLASS_IMPACT4 "Sounds\\Impact\\glass4.wav",

737 sound SOUND_WATER_IMPACT1 "Sounds\\Impact\\water_bullet1.wav",
738 sound SOUND_WATER_IMPACT2 "Sounds\\Impact\\water_bullet2.wav",
739 sound SOUND_WATER_IMPACT3 "Sounds\\Impact\\water_bullet3.wav",

740 sound SOUND_CROWBAR_IMPACT1 "Models\\Weapons\\Crowbar\\Sounds\\Impact1.wav",
741 sound SOUND_CROWBAR_IMPACT2 "Models\\Weapons\\Crowbar\\Sounds\\Impact2.wav",

742 sound SOUND_SILENCE "Sounds\\Misc\\Silence.wav",

// [Cecil] Other Sounds
750 sound SOUND_SELECT_WEAPON "Sounds\\Weapons\\WeaponSelect.wav",
751 sound SOUND_WARNING       "Sounds\\Player\\Warning.wav",
752 sound SOUND_AMMO          "Sounds\\Items\\AmmoPickup.wav",

functions:
  // [Cecil] Constructor
  void CPlayerWeapons(void) {
    m_syncHolding.SetOwner(this);
    m_tmFlareTick = 0.0f;
    m_pbpoRayHit = NULL;
    m_ulObjectFlags = 0;
    m_aObjectAngle = ANGLE3D(0.0f, 0.0f, 0.0f);
    m_bAmmoWarning = FALSE;
    m_tmParticles = -100.0f;
    m_tmGGLaunch = -100.0f;
  };

  // [Cecil] Reset Max Ammo
  void ResetMaxAmmo(void) {
    BOOL bAmmo = GetSP()->sp_bInfiniteAmmo;
    BOOL bAlt = (GetSP()->sp_iHL2Flags & HL2F_INFALT);
    FLOAT fModifier = GetSP()->sp_fAmmoQuantity;

    for (INDEX iAmmo = 0; iAmmo < 11; iAmmo++) {
      (&m_iUSP_Max)[iAmmo] = ceil(_aiMaxAmmo[iAmmo] * fModifier);

      // Fill the ammo
      if (bAmmo && iAmmo < 9) {
        (&m_iUSP)[iAmmo] = (&m_iUSP_Max)[iAmmo];
      }
      // Fill the alt ammo
      if (bAlt && iAmmo >= 9) {
        (&m_iUSP)[iAmmo] = (&m_iUSP_Max)[iAmmo];
      }
    }

    // Max mag ammo
    for (INDEX iMag = 0; iMag < 8; iMag++) {
      (&m_iUSP_MagMax)[iMag] = _aiMaxMag[iMag];
      (&m_iUSP_MagMax)[iMag] = ceil(FLOAT(_aiMaxMag[iMag]) * GetSP()->sp_fMagMultiplier);
    }
  };

  // [Cecil] Reset Mags
  void ResetMags(void) {
    for (INDEX iMag = 0; iMag < 8; iMag++) {
      (&m_iUSP_Mag)[iMag] = (&m_iUSP_MagMax)[iMag];
    }
  };

  void ResetMags(ULONG ulNewWeapons) {
    for (INDEX iWeapon = WEAPON_NONE; iWeapon < WEAPON_LAST; iWeapon++) {
      // weapon flag doesn't exist
      if (!WeaponExists(ulNewWeapons, iWeapon)) {
        continue;
      }

      INDEX *piMag = GetMag(iWeapon);
      INDEX *piMaxMag = GetMaxMag(iWeapon);

      // check for a mag in this weapon
      if (piMag == NULL || piMaxMag == NULL) {
        continue;
      }

      // reset the mag
      *piMag = *piMaxMag;
    }
  };

  // [Cecil] Empty Mag
  BOOL EmptyMag(const INDEX &iLimit) {
    return (*GetMagPointer() <= iLimit);
  };

  // [Cecil] Can Reload
  BOOL CanReload(BOOL bEmpty) {
    if (bEmpty) {
      return (*GetMagPointer() <= 0 && *GetAmmo() > 0);
    }
    return (*GetMagPointer() < *GetMaxMagPointer() && *GetAmmo() > 0);
  };

  // [Cecil] Weapon Mag
  INDEX *GetMagPointer(void) {
    switch (m_iCurrentWeapon) {
      case WEAPON_PISTOL:   return &m_iUSP_Mag;
      case WEAPON_357:      return &m_i357_Mag;
      case WEAPON_SMG1:     return &m_iSMG1_Mag;
      case WEAPON_AR2:      return &m_iAR2_Mag;
      case WEAPON_SPAS:     return &m_iSPAS_Mag;
      case WEAPON_CROSSBOW: return &m_iCrossbow_Mag;
      case WEAPON_RPG:      return &m_iRPG_Mag;
      case WEAPON_G3SG1:    return &m_iCSSSniper_Mag;
    }

    return NULL;
  };
  INDEX *GetMag(INDEX iWeapon) {
    switch (iWeapon) {
      case WEAPON_PISTOL:   return &m_iUSP_Mag;
      case WEAPON_357:      return &m_i357_Mag;
      case WEAPON_SMG1:     return &m_iSMG1_Mag;
      case WEAPON_AR2:      return &m_iAR2_Mag;
      case WEAPON_SPAS:     return &m_iSPAS_Mag;
      case WEAPON_CROSSBOW: return &m_iCrossbow_Mag;
      case WEAPON_RPG:      return &m_iRPG_Mag;
      case WEAPON_G3SG1:    return &m_iCSSSniper_Mag;
    }

    return NULL;
  };
  INDEX GetMagCount(INDEX iWeapon) {
    switch (iWeapon) {
      case WEAPON_PISTOL:   return m_iUSP_Mag;
      case WEAPON_357:      return m_i357_Mag;
      case WEAPON_SMG1:     return m_iSMG1_Mag;
      case WEAPON_AR2:      return m_iAR2_Mag;
      case WEAPON_SPAS:     return m_iSPAS_Mag;
      case WEAPON_CROSSBOW: return m_iCrossbow_Mag;
      case WEAPON_RPG:      return m_iRPG_Mag;
      case WEAPON_G3SG1:    return m_iCSSSniper_Mag;
    }

    return 0;
  };

  INDEX *GetMaxMagPointer(void) {
    switch (m_iCurrentWeapon) {
      case WEAPON_PISTOL:   return &m_iUSP_MagMax;
      case WEAPON_357:      return &m_i357_MagMax;
      case WEAPON_SMG1:     return &m_iSMG1_MagMax;
      case WEAPON_AR2:      return &m_iAR2_MagMax;
      case WEAPON_SPAS:     return &m_iSPAS_MagMax;
      case WEAPON_CROSSBOW: return &m_iCrossbow_MagMax;
      case WEAPON_RPG:      return &m_iRPG_MagMax;
      case WEAPON_G3SG1:    return &m_iCSSSniper_MagMax;
    }

    return NULL;
  };
  INDEX *GetMaxMag(INDEX iWeapon) {
    switch (iWeapon) {
      case WEAPON_PISTOL:   return &m_iUSP_MagMax;
      case WEAPON_357:      return &m_i357_MagMax;
      case WEAPON_SMG1:     return &m_iSMG1_MagMax;
      case WEAPON_AR2:      return &m_iAR2_MagMax;
      case WEAPON_SPAS:     return &m_iSPAS_MagMax;
      case WEAPON_CROSSBOW: return &m_iCrossbow_MagMax;
      case WEAPON_RPG:      return &m_iRPG_MagMax;
      case WEAPON_G3SG1:    return &m_iCSSSniper_MagMax;
    }

    return NULL;
  };
  INDEX GetMaxMagCount(INDEX iWeapon) {
    switch (iWeapon) {
      case WEAPON_PISTOL:   return m_iUSP_MagMax;
      case WEAPON_357:      return m_i357_MagMax;
      case WEAPON_SMG1:     return m_iSMG1_MagMax;
      case WEAPON_AR2:      return m_iAR2_MagMax;
      case WEAPON_SPAS:     return m_iSPAS_MagMax;
      case WEAPON_CROSSBOW: return m_iCrossbow_MagMax;
      case WEAPON_RPG:      return m_iRPG_MagMax;
      case WEAPON_G3SG1:    return m_iCSSSniper_MagMax;
    }

    return 0;
  };

  // [Cecil] Reload Mag
  void ReloadMag(void) {
    INDEX *piMag = GetMagPointer();
    INDEX *piAmmo = GetAmmo();
    INDEX iReload = ClampUp(*GetMaxMagPointer() - *piMag, *piAmmo);

    if (GetSP()->sp_bInfiniteAmmo) {
      *piMag = *GetMaxMagPointer();

    } else {
      DecAmmo(iReload, FALSE);
      *piMag += iReload;
    }
  };

  // [Cecil] Moved from before the class definition.
  //         Decrement ammo taking infinite ammo options in account
  void DecAmmo(INDEX iDec, BOOL bAlt) {
    INDEX *ctAmmo = GetAmmo();

    if (bAlt) {
      ctAmmo = GetAltAmmo(m_iCurrentWeapon);

      if (!(GetSP()->sp_iHL2Flags & HL2F_INFALT)) {
        *ctAmmo -= iDec;
      }

    } else {
      if (!GetSP()->sp_bInfiniteAmmo) {
        *ctAmmo -= iDec;
      }
    }
  };

  // [Cecil] Decrement mag
  void DecMag(INDEX *ctMag, INDEX iDec) {
    *ctMag -= iDec;

    // Ammo depleted
    if (*ctMag <= 0 && *GetAmmo() <= 0) {
      GetPlayer()->SuitSound(ESS_AMMO);
    }
  };

  // [Cecil] Turn sniping off
  void SnipingOff(void) {
    m_fSniperFOV = m_fSniperFOVlast = m_fSniperMaxFOV;
    m_iSniping = 0;
    m_penPlayer->SendEvent(EWeaponChanged());
  };

  // [Cecil] Moved from FireSingleShotgun()
  void DropShotgunShell(void) {
    CPlacement3D plShell;
    CalcWeaponPosition(FLOAT3D(afSingleShotgunShellPos[0], afSingleShotgunShellPos[1], afSingleShotgunShellPos[2]), plShell, FALSE, TRUE);
    FLOATmatrix3D mRot;
    MakeRotationMatrixFast(mRot, plShell.pl_OrientationAngle);

    // [Cecil] Move the position
    plShell.pl_PositionVector += FLOAT3D(0.2f, -0.15f, -0.35f)*mRot;

    if (hud_bShowWeapon) {
      CPlayer *penPlayer = GetPlayer();
      ShellLaunchData &sld = penPlayer->m_asldData[penPlayer->m_iFirstEmptySLD];
      sld.sld_vPos = plShell.pl_PositionVector;
      FLOAT3D vSpeedRelative = FLOAT3D(FRnd()+2.0f, FRnd()+5.0f, -FRnd()-2.0f);
      sld.sld_vSpeed = vSpeedRelative*mRot;

      const FLOATmatrix3D &m = penPlayer->GetRotationMatrix();
      FLOAT3D vUp( m(1,2), m(2,2), m(3,2));
      sld.sld_vUp = vUp;
      sld.sld_tmLaunch = _pTimer->CurrentTick();
      sld.sld_estType = ESL_SHOTGUN;
      // move to next shell position
      penPlayer->m_iFirstEmptySLD = (penPlayer->m_iFirstEmptySLD+1) % MAX_FLYING_SHELLS;
    }
  };

  // [Cecil] Moved from FireTommygun()
  void DropSMGBullet(CPlacement3D &plShell, FLOATmatrix3D &mRot, FLOAT3D &vUp) {
    // [Cecil] Get the offset and then reset
    FLOAT3D vOffset = plShell.pl_PositionVector;
    plShell = CPlacement3D(FLOAT3D(0.0f, 0.0f, 0.0f), ANGLE3D(0.0f, 0.0f, 0.0f));

    CalcWeaponPosition(FLOAT3D(afTommygunShellPos[0], afTommygunShellPos[1], afTommygunShellPos[2]), plShell, FALSE, TRUE);
    MakeRotationMatrixFast(mRot, plShell.pl_OrientationAngle);

    // [Cecil] Move the position
    plShell.pl_PositionVector += vOffset*mRot;

    CPlayer &pl = *GetPlayer();
    ShellLaunchData &sld = pl.m_asldData[pl.m_iFirstEmptySLD];
    sld.sld_vPos = plShell.pl_PositionVector;
    FLOAT3D vSpeedRelative = FLOAT3D(FRnd()+2.0f, FRnd()+5.0f, -FRnd()-2.0f);

    const FLOATmatrix3D &m = pl.GetRotationMatrix();
    vUp = FLOAT3D(m(1,2), m(2,2), m(3,2));

    sld.sld_vUp = vUp;
    sld.sld_vSpeed = vSpeedRelative*mRot;
    sld.sld_tmLaunch = _pTimer->CurrentTick();
    sld.sld_estType = ESL_BULLET;  
    pl.m_iFirstEmptySLD = (pl.m_iFirstEmptySLD+1) % MAX_FLYING_SHELLS;
  };

  // [Cecil] Patch the weapon flags
  void PatchWeaponFlags(INDEX &iFlags) {
    ULONG ulAdd = 0;

    // Signle Shotgun -> MP7
    if (WeaponExists(iFlags, WEAPON_SPAS)) {
      iFlags &= ~WeaponFlag(WEAPON_SPAS);
      ulAdd |= WeaponFlag(WEAPON_SMG1);
    }

    // Double Shotgun -> MP7
    if (WeaponExists(iFlags, WEAPON_G3SG1)) {
      iFlags &= ~WeaponFlag(WEAPON_G3SG1);
      ulAdd |= WeaponFlag(WEAPON_SMG1);
    }

    // Tommygun -> SPAS-12
    if (WeaponExists(iFlags, WEAPON_SMG1)) {
      iFlags &= ~WeaponFlag(WEAPON_SMG1);
      ulAdd |= WeaponFlag(WEAPON_SPAS);
    }

    // Minigun -> SPAS-12
    if (WeaponExists(iFlags, WEAPON_AR2)) {
      iFlags &= ~WeaponFlag(WEAPON_AR2);
      ulAdd |= WeaponFlag(WEAPON_SPAS);
    }

    // Rocket Launcher -> Pulse Rifle
    if (WeaponExists(iFlags, WEAPON_RPG)) {
      iFlags &= ~WeaponFlag(WEAPON_RPG);
      ulAdd |= WeaponFlag(WEAPON_AR2);
    }

    // Flamer -> .357 Magnum
    if (WeaponExists(iFlags, WEAPON_FLAMER)) {
      iFlags &= ~WeaponFlag(WEAPON_FLAMER);
      ulAdd |= WeaponFlag(WEAPON_357);
    // Remove .357 Magnum
    } else {
      iFlags &= ~WeaponFlag(WEAPON_357);
    }

    // Laser -> Pulse Rifle
    if (WeaponExists(iFlags, WEAPON_LASER)) {
      iFlags &= ~WeaponFlag(WEAPON_LASER);
      ulAdd |= WeaponFlag(WEAPON_AR2);
    }

    // Cannon -> RPG
    if (WeaponExists(iFlags, WEAPON_IRONCANNON)) {
      iFlags &= ~WeaponFlag(WEAPON_IRONCANNON);
      ulAdd |= WeaponFlag(WEAPON_RPG);
    }

    // Add patched weapons
    iFlags |= ulAdd;
  };

  // [Cecil] PlaySound shortcut
  void WeaponSound(const INDEX &iChannel, const INDEX &iSound) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    PlaySound((&pl.m_soWeaponFire1)[iChannel], iSound, SOF_3D|SOF_VOLUMETRIC);
  };

  void WeaponSound(const INDEX &iChannel, const CTFileName &fnSound) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    PlaySound((&pl.m_soWeaponFire1)[iChannel], fnSound, SOF_3D|SOF_VOLUMETRIC);
  };

  // [Cecil] TEMP: Change Materials
  CBrushPolygon *GetMaterial(void) {
    return m_pbpoRayHit;
  };

  // [Cecil] Start Weapons
  INDEX StartWeapons(void) {
    INDEX iWeapons = GetSP()->sp_iStartWeapons;

    if (iWeapons == -1) {
      return WeaponFlag(WEAPON_CROWBAR) | WeaponFlag(WEAPON_PISTOL);
    }

    return ClampDn(iWeapons, (INDEX)0);
  };

  // [Cecil] Gamemode-specific weapons
  WeaponType GamemodeWeapon(INDEX iMode) {
    if (iMode <= HLGM_NONE || iMode >= HLGM_LAST) {
      return WEAPON_NONE;
    }

    BOOL bCoop = (GetSP()->sp_bCooperative || GetSP()->sp_bSinglePlayer);

    switch (iMode) {
      case HLGM_ARMSRACE: {
        INDEX iLevel = m_iArmsRaceLevel/3;

        if (bCoop) {
          iLevel = iLevel % (CT_ARMSRACE_LEVELS - 1);
        }

        switch (iLevel) {
          case 0: return WEAPON_SMG1;
          case 1: return WEAPON_AR2;
          case 2: return WEAPON_G3SG1;
          case 3: return WEAPON_SPAS;
          case 4: return WEAPON_CROSSBOW;
          case 5: return WEAPON_RPG;
          case 6: return WEAPON_357;
          case 7: return WEAPON_GRENADE;
          case 8: return WEAPON_PISTOL;
          case 9: return WEAPON_GRAVITYGUN;

          default: {
            return WEAPON_CROWBAR;
          }
        }
      } break;

      case HLGM_DISSOLVE: return WEAPON_AR2;
      case HLGM_BUNNYHUNT: return WEAPON_G3SG1;
      case HLGM_MINEKILL: return WEAPON_GRAVITYGUN;
      case HLGM_FLYROCKET: return WEAPON_RPG;
    }

    return WEAPON_NONE;
  };

  // [Cecil] Arms Race Mode
  void ArmsRaceKill(CEntity *penKilled) {
    BOOL bCoop = (GetSP()->sp_bCooperative || GetSP()->sp_bSinglePlayer);

    // enemies don't count
    if (!bCoop && !IS_PLAYER(penKilled)) {
      return;
    }

    // last level
    if (!bCoop) {
      if (m_iArmsRaceLevel / 3 >= CT_ARMSRACE_LEVELS) {
        // count as a kill
        GetPlayer()->m_psLevelStats.ps_iKills += 1;
        GetPlayer()->m_psGameStats.ps_iKills += 1;
        return;
      }
    }

    INDEX iOldWeapon = GamemodeWeapon(0);
    if (m_iCurrentWeapon == iOldWeapon) {
      m_iArmsRaceLevel++;
    }

    // upgrade
    if (m_iArmsRaceLevel % 3 == 0) {
      // count as a kill
      GetPlayer()->m_psLevelStats.ps_iKills += 1;
      GetPlayer()->m_psGameStats.ps_iKills += 1;

      // turn off the weapon
      SendEvent(EReleaseWeapon());
      SnipingOff();

      // switch to the new weapon
      INDEX iNewWeapon = GamemodeWeapon(0);
      m_iAvailableWeapons &= ~WeaponFlag(iOldWeapon);
      m_iAvailableWeapons |= WeaponFlag(iNewWeapon);
      SelectNewWeapon();
    }
  };

  // [Cecil] Check if a boss is active
  BOOL BossActive(void) {
    INDEX ct = 0;

    // count bosses
    FOREACHINDYNAMICCONTAINER(GetWorld()->wo_cenEntities, CEntity, iten) {
      CEntity *pen = iten;

      if (IsOfClassID(pen, CAirElemental_ClassID)) {
        CAirElemental *penAir = (CAirElemental*)&*pen;

        // check if boss is active
        if (penAir->m_bBossActive) {
          // count him
          ct++;
        }
      }
    }

    return (ct > 0);
  };

  // [Cecil] Pickable objects for the gravity gun
  void PickableObject(CEntity *pen) {
    // no object
    if (pen == NULL) {
      m_bPickable = FALSE;

      if (m_bLastPick != FALSE) {
        ProngsAnim(FALSE, TRUE);
        m_bLastPick = FALSE;
      }
      return;
    }

    // suitable objects
    m_bPickable = SuitableObject(pen, 1, FALSE);

    // select this object
    if (m_bLastPick != m_bPickable) {
      ProngsAnim(m_bPickable, TRUE);
      m_bLastPick = m_bPickable;
    }
  };

  // [Cecil] Prongs animation
  void ProngsAnim(BOOL bOpen, BOOL bAnim) {
    GetPlayer()->m_soWeaponAlt.Set3DParameters(50.0f, 5.0f, 1.0f, 1.0f);

    WeaponSound(SND_ALT, (bOpen ? SOUND_GG_OPEN : SOUND_GG_CLOSE));

    if (bAnim) {
      m_moWeapon.PlayAnim((bOpen ? GRAVITYGUN_ANIM_PRONGSOPEN : GRAVITYGUN_ANIM_PRONGSCLOSE), AOF_SMOOTHCHANGE);
    } else {
      m_moWeapon.PlayAnim((m_bPickable ? GRAVITYGUN_ANIM_IDLEOPEN : GRAVITYGUN_ANIM_IDLE), 0);
    }

    PlayDefaultAnim();
  };

  // [Cecil] Get held object (prediction-safe)
  const CSyncedEntityPtr &HeldObject(void) {
    CPlayerWeapons *pen = (CPlayerWeapons *)GetPredictionTail();
    return pen->m_syncHolding;
  };

  // [Cecil] Suitable objects for the gravity gun
  BOOL SuitableObject(CEntity *pen, INDEX iLaunch, BOOL bPickup) {
    // Nothing is suitable when dead
    if (!(GetPlayer()->GetFlags() & ENF_ALIVE)) {
      return FALSE;
    }

    // Check distance
    if (iLaunch >= 0) {
      FLOAT fDist = (iLaunch > 0 ? 12.0f : 32.0f);

      if (m_fRayHitDistance > fDist) {
        return FALSE;
      }
    }

    return GravityGunCanInteract(GetPlayer(), pen, bPickup);
  };

  // [Cecil] Hold picked object
  void HoldingObject(void) {
    CEntity *penHolding = HeldObject().GetSyncedEntity();

    // Not suitable anymore
    if (!SuitableObject(penHolding, -1, FALSE)) {
      StopHolding(TRUE);
      return;
    }

    // Play holding sound
    if (!GetPlayer()->m_soWeaponReload.IsPlaying()) {
      PlaySound(GetPlayer()->m_soWeaponReload, SOUND_GG_HOLD, SOF_3D|SOF_VOLUMETRIC|SOF_LOOP);
    }

    const CPlacement3D plPlayer = GetPlayer()->GetPlacement();

    // Player view
    FLOATmatrix3D mPlayer = GetPlayer()->GetRotationMatrix();
    CPlacement3D plPlayerView = GetPlayer()->en_plViewpoint;
    plPlayerView.pl_OrientationAngle(2) = Clamp(plPlayerView.pl_OrientationAngle(2), -70.0f, 70.0f);

    // Additional object offset
    FLOAT3D vObjectSize;
    {
      // Center the object
      FLOATaabbox3D boxSize;
      ECollisionShape eDummy;

      const BOOL bPhysical = IsEntityPhysical(penHolding);

      if (!GetCustomCollisionShape(penHolding, boxSize, eDummy)) {
        penHolding->GetBoundingBox(boxSize);
      }

      vObjectSize = boxSize.Size();

      const BOOL bHoldCenter = bPhysical || (IsDerivedFromClass(penHolding, "Enemy Fly") && ((CEnemyFly &)*penHolding).m_bInAir);

      if (!bHoldCenter) {
        plPlayerView.pl_PositionVector -= FLOAT3D(0.0f, vObjectSize(2) * 0.5f, 0.0f);
      }
    }

    // Add relative rotation and absolute speed
    plPlayerView.pl_OrientationAngle += GetPlayer()->GetDesiredRotation() * ONE_TICK;
    plPlayerView.RelativeToAbsolute(plPlayer);
    plPlayerView.pl_PositionVector += GetPlayer()->en_vCurrentTranslationAbsolute * ONE_TICK;

    // Place object in front of the view
    FLOAT3D vTargetDir;
    AnglesToDirectionVector(plPlayerView.pl_OrientationAngle, vTargetDir);

    // Adjust holding distance
    FLOAT fHoldDistance = vObjectSize.Length() * 0.5f + 1.5f;

    // [Cecil] TEMP: Take hit distance if it's closer to prevent objects from entering walls and such
    if (m_penRayHit != penHolding && m_fRayHitDistance < fHoldDistance) {
      fHoldDistance = m_fRayHitDistance;
    }

    plPlayerView.pl_PositionVector += vTargetDir * fHoldDistance;

    // Follow the holder
    CPlacement3D plObject(FLOAT3D(0, 0, 0), m_aObjectAngle);
    plObject.RelativeToAbsolute(plPlayerView);

    EGravityGunHold eHold;
    eHold.vPos = plObject.pl_PositionVector;
    eHold.aRot = plObject.pl_OrientationAngle;
    eHold.fDistance = fHoldDistance;

    // Disable gravity and apply immediate absolute movement speed
    eHold.ulFlags = m_ulObjectFlags;
    eHold.ulFlags &= ~(EPF_TRANSLATEDBYGRAVITY | EPF_ORIENTEDBYGRAVITY);
    eHold.ulFlags |= EPF_NOACCELERATION | EPF_ABSOLUTETRANSLATE;

    GravityGunHolding(this, (CMovableEntity *)penHolding, eHold);
  };

  // [Cecil] Start holding the object
  void StartHolding(CEntity *penObject) {
    if (penObject == NULL) {
      return;
    }

    EGravityGunStart eStart;
    eStart.penWeapons = this;
    penObject->SendEvent(eStart);
  };

  // [Cecil] Stop holding the object
  void StopHolding(BOOL bCloseProngs) {
    CEntity *penObject = m_syncHolding.GetSyncedEntity();

    if (penObject == NULL) {
      return;
    }

    EGravityGunStop eStop;
    eStop.ulFlags = m_ulObjectFlags;
    penObject->SendEvent(eStop);

    m_syncHolding.Unsync();
    m_penHolding = NULL;
    m_ulObjectFlags = 0;
    m_aObjectAngle = ANGLE3D(0.0f, 0.0f, 0.0f);

    // Stop holding sound
    GetPlayer()->m_soWeaponReload.Stop();

    // Close the prongs
    if (bCloseProngs) {
      ProngsAnim(FALSE, FALSE);
    }
  };

  // [Cecil] Reset object picking
  void ResetPicking(void) {
    m_bPickable = FALSE;
    m_bLastPick = FALSE;
    m_bCanPickObjects = FALSE;
    m_bPullObject = FALSE;
  };

  // [Cecil] Write new variables
  void Write_t(CTStream *ostr) {
    CRationalEntity::Write_t(ostr);

    WriteHeldObject(m_syncHolding, ostr);

    *ostr << m_ulObjectFlags;
    *ostr << m_aObjectAngle;
  };

  // [Cecil] Read new variables
  void Read_t(CTStream *istr) {
    CRationalEntity::Read_t(istr);

    ReadHeldObject(m_syncHolding, istr, this);

    *istr >> m_ulObjectFlags;
    *istr >> m_aObjectAngle;
  };

  // add to prediction any entities that this entity depends on
  void AddDependentsToPrediction(void) {
    m_penPlayer->AddToPrediction();
    m_penFlame->AddToPrediction();
  };

  void Precache(void) {
    CPlayerWeapons_Precache(m_iAvailableWeapons);
  };

  CPlayer *GetPlayer(void) {
    ASSERT(m_penPlayer!=NULL);
    return (CPlayer *)&*m_penPlayer;
  };

  CPlayerAnimator *GetAnimator(void) {
    ASSERT(m_penPlayer!=NULL);
    return ((CPlayerAnimator*)&*((CPlayer&)*m_penPlayer).m_penAnimator);
  };

  // [Cecil] Recoil effect
  void DoRecoil(ANGLE3D aAdd, FLOAT fPowerMul) {
    // increase recoil with each shot
    fPowerMul = Clamp(fPowerMul + m_iNewShots*2.0f, 0.0f, 100.0f);

    GetPlayer()->m_aRecoilShake = aAdd;
    GetPlayer()->m_fRecoilPower = ClampUp(GetPlayer()->m_fRecoilPower + aAdd.Length()/100.0f * fPowerMul, 1.0f);
  };

  // [Cecil] Added shot bullets reset
  BOOL HoldingFire(void) {
    BOOL bFire = m_bFireWeapon && !m_bChangeWeapon;
    if (!bFire) {
      m_iNewShots = 0;
    }
    return bFire;
  };

  BOOL HoldingAltFire(void) {
    BOOL bFire = m_bAltFireWeapon && !m_bChangeWeapon;
    if (!bFire) {
      m_iNewShots = 0;
    }
    return bFire;
  };

  // render weapon model(s)
  void RenderWeaponModel(CPerspectiveProjection3D &prProjection, CDrawPort *pdp,
                         FLOAT3D vViewerLightDirection, COLOR colViewerLight, COLOR colViewerAmbient,
                         BOOL bRender, INDEX iEye)
  {
    _mrpModelRenderPrefs.SetRenderType( RT_TEXTURE|RT_SHADING_PHONG);

    // [Cecil] Moved one level up in Player.es
    // flare attachment
    //ControlFlareAttachment();

    if( !bRender || m_iCurrentWeapon==WEAPON_NONE
     || GetPlayer()->GetSettings()->ps_ulFlags&PSF_HIDEWEAPON) { return; }

    // [Cecil] Non-predicted weapons
    CPlayerWeapons *pen = (CPlayerWeapons *)GetPredictionTail();

    // nuke and iron cannons have the same view settings
    INDEX iWeaponData = m_iCurrentWeapon;

    // [Cecil] Remember old FOV and view placement
    const FLOAT fOldFOV = ((CPerspectiveProjection3D &)prProjection).FOVL();
    const CPlacement3D plOldView = prProjection.ViewerPlacementL();

    // [Cecil] Get lerped view placement
    CPlacement3D plView;
    plView.Lerp(GetPlayer()->en_plLastViewpoint, GetPlayer()->en_plViewpoint, _pTimer->GetLerpFactor());
    plView.RelativeToAbsolute(m_penPlayer->GetLerpedPlacement());

    CPlacement3D plWeapon(FLOAT3D(wpn_fX[iWeaponData], wpn_fY[iWeaponData], wpn_fZ[iWeaponData]),
                          ANGLE3D(AngleDeg(wpn_fH[iWeaponData]), AngleDeg(wpn_fP[iWeaponData]), AngleDeg(wpn_fB[iWeaponData])));

    // [Cecil] Weapon shake (keep predicted values)
    CPlayer *penPlayer = GetPlayer();
    ANGLE aShakeH = Lerp(penPlayer->m_aLastWeaponShake(1), penPlayer->m_aWeaponShake(1), _pTimer->GetLerpFactor());
    ANGLE aShakeP = Lerp(penPlayer->m_aLastWeaponShake(2), penPlayer->m_aWeaponShake(2), _pTimer->GetLerpFactor());
    ANGLE aShakeB = Lerp(penPlayer->m_aLastWeaponShake(3), penPlayer->m_aWeaponShake(3), _pTimer->GetLerpFactor());

    // [Cecil] Don't apply shaking to classic weapons
    switch (m_iCurrentWeapon) {
      case WEAPON_FLAMER: case WEAPON_LASER: case WEAPON_IRONCANNON: break;

      default: {
        //plWeapon.pl_PositionVector(1) -= aShakeH / 40.0f;
        plWeapon.pl_PositionVector(1) += aShakeP / 80.0f;
        plWeapon.pl_PositionVector(2) += aShakeP / 50.0f;
        //plWeapon.pl_PositionVector(3) += aShakeB / 40.0f;

        // [Cecil] Rotate horizontally
        FLOAT2D vOffset = FLOAT2D(SinFast(aShakeH), -CosFast(aShakeH) + 1.0f) * 0.2f;
        plWeapon.pl_PositionVector(1) -= vOffset(1);
        plWeapon.pl_PositionVector(3) += vOffset(2);
      }
    }

    // [Cecil] Apply world shake to the weapon
    CPlacement3D plWorldShake = CPlacement3D(FLOAT3D(0.0f, 0.0f, 0.0f), ANGLE3D(0.0f, 0.0f, 0.0f));
    GetPlayer()->ApplyShaking(plWorldShake);

    plWorldShake.pl_PositionVector *= 0.1f;
    plWeapon.pl_PositionVector(2) -= plWorldShake.pl_PositionVector(2);
    plWeapon.pl_PositionVector(3) -= plWorldShake.pl_PositionVector(3);
    plWeapon.pl_OrientationAngle(3) -= plWorldShake.pl_OrientationAngle(3);

    // make sure that weapon will be bright enough
    UBYTE ubLR,ubLG,ubLB, ubAR,ubAG,ubAB;
    ColorToRGB( colViewerLight,   ubLR,ubLG,ubLB);
    ColorToRGB( colViewerAmbient, ubAR,ubAG,ubAB);
    // [Cecil] 32 -> 8
    INDEX iMinDL = Min(Min(ubLR, ubLG), ubLB)-8;
    INDEX iMinDA = Min(Min(ubAR, ubAG), ubAB)-8;

    // [Cecil] Increase minimum lighting if flashlight is active
    if (GetPlayer()->m_bFlashlight) {
      iMinDL = Min(Min(ubLR, ubLG), ubLB)-32;
      iMinDA = Min(Min(ubAR, ubAG), ubAB)-32;
    }

    if (iMinDL < 0) {
      ubLR = ClampUp(ubLR - iMinDL, (INDEX)255);
      ubLG = ClampUp(ubLG - iMinDL, (INDEX)255);
      ubLB = ClampUp(ubLB - iMinDL, (INDEX)255);
    }
    if (iMinDA < 0) {
      ubAR = ClampUp(ubAR - iMinDA, (INDEX)255);
      ubAG = ClampUp(ubAG - iMinDA, (INDEX)255);
      ubAB = ClampUp(ubAB - iMinDA, (INDEX)255);
    }
    const COLOR colLight   = RGBToColor(ubLR, ubLG, ubLB);
    const COLOR colAmbient = RGBToColor(ubAR, ubAG, ubAB);
    const FLOAT tmNow = _pTimer->GetLerpedCurrentTick();

    UBYTE ubBlend = INVISIBILITY_ALPHA_LOCAL;
    FLOAT tmInvisibility = ((CPlayer *)&*m_penPlayer)->m_tmInvisibility;
    //FLOAT tmSeriousDamage = ((CPlayer *)&*m_penPlayer)->m_tmSeriousDamage;
    //FLOAT tmInvulnerability = ((CPlayer *)&*m_penPlayer)->m_tmInvulnerability;
    if (tmInvisibility>tmNow) {
      FLOAT fIntensity=0.0f;      
      if ((tmInvisibility - tmNow) < 3.0f) {
        fIntensity = 0.5f-0.5f*cos((tmInvisibility-tmNow)*(6.0f*3.1415927f/3.0f));
        ubBlend =(INDEX)(INVISIBILITY_ALPHA_LOCAL+(FLOAT)(254-INVISIBILITY_ALPHA_LOCAL)*fIntensity);      
      }
    }

    // [Cecil] Model FOV
    const FLOAT fWeaponFOV = wpn_fFOV[iWeaponData] * (Lerp(GetPlayer()->m_fLastZoomFOV, GetPlayer()->m_fZoomFOV, _pTimer->GetLerpFactor()) / 90.0f);

    // prepare render model structure
    CRenderModel rmMain;
    prProjection.ViewerPlacementL() = plView;
    prProjection.FrontClipDistanceL() = wpn_fClip[iWeaponData];
    prProjection.DepthBufferNearL() = 0.0f;
    prProjection.DepthBufferFarL() = 0.1f;
    ((CPerspectiveProjection3D &)prProjection).FOVL() = AngleDeg(fWeaponFOV);

    CAnyProjection3D apr;
    apr = prProjection;
    Stereo_AdjustProjection(*apr, iEye, 0.1f);
    BeginModelRenderingView(apr, pdp);

    WeaponMovingOffset(plWeapon.pl_PositionVector);
    plWeapon.RelativeToAbsoluteSmooth(plView);
    rmMain.SetObjectPlacement(plWeapon);

    rmMain.rm_colLight   = colLight;  
    rmMain.rm_colAmbient = colAmbient;
    rmMain.rm_vLightDirection = vViewerLightDirection;
    rmMain.rm_ulFlags |= RMF_WEAPON; // TEMP: for Truform
    if (tmInvisibility>tmNow) {
      rmMain.rm_colBlend = (rmMain.rm_colBlend&0xffffff00)|ubBlend;
    }

    m_moWeapon.SetupModelRendering(rmMain);
    m_moWeapon.RenderModel(rmMain);

    // [Cecil] Particles for specific weapons
    Particle_PrepareSystem(pdp, apr);
    Particle_PrepareEntity(1, 0, 0, NULL);

    if (iWeaponData == WEAPON_GRAVITYGUN) {
      const TIME tmGGFlare = (m_tmLaunchEffect - _pTimer->GetLerpedCurrentTick());
      CAttachmentModelObject *pamoLaunch = m_moWeapon.GetAttachmentModel(6);

      if (pamoLaunch != NULL && tmGGFlare > 0.0f) {
        // Attachment position
        CPlacement3D plGGLaunch = GetAttachmentPlacement(&m_moWeapon, *pamoLaunch);
        plGGLaunch.RelativeToAbsoluteSmooth(plWeapon);

        // Hit point relative to the view
        CPlacement3D plHit(m_vGGHitPos, ANGLE3D(0, 0, 0));
        plHit.AbsoluteToRelativeSmooth(plOldView);

        // Adjust position relative to the weapon model based on the FOV difference between the weapon and the view
        const FLOAT fCorrectionFactor = Tan(fWeaponFOV * 0.5f) / Tan(fOldFOV * 0.5f);
        plHit.pl_PositionVector(3) /= fCorrectionFactor;

        // Hit point from the projection's perspective
        plHit.RelativeToAbsoluteSmooth(prProjection.ViewerPlacementL());

        Particles_GravityGunCharge(plGGLaunch.pl_PositionVector, plHit.pl_PositionVector);
      }

    // [Cecil] Special particles for the crossbow
    } else if (iWeaponData == WEAPON_CROSSBOW) {
      // Crossbow model exists
      if (m_moWeapon.GetAttachmentModel(0) != NULL) {
        const FLOAT tmParticles = pen->m_tmParticles;

        // Rod vertex position
        CModelObject *pmoCrossbow = &m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        const FLOAT3D vRod = GetVertexPosition(pmoCrossbow, 500);

        // Sparks placement
        ANGLE3D aSparks = ANGLE3D(WrapAngle(tmParticles * 3.0f), WrapAngle(tmParticles * 5.0f), WrapAngle(tmParticles * 7.0f));
        CPlacement3D plSparks = CPlacement3D(vRod + FLOAT3D(0.25f, -0.9f, -1.0f), aSparks);
        plSparks.RelativeToAbsolute(plWeapon);

        Particles_ExplosionSparksPlace(plSparks, tmParticles, FLOAT3D(1, 1, 1) * 0.02f, 0xFFFFFFFF);
      }
    }

    Particle_EndSystem(); // [Cecil]
    EndModelRenderingView();

    // restore FOV for Crosshair
    ((CPerspectiveProjection3D &)prProjection).FOVL() = fOldFOV;
  };


  // Weapon moving offset
  void WeaponMovingOffset(FLOAT3D &plPos) {
    CPlayerAnimator &plan = (CPlayerAnimator&)*((CPlayer&)*m_penPlayer).m_penAnimator;

    /*FLOAT fXOffset = Lerp(plan.m_fMoveLastBanking, plan.m_fMoveBanking, _pTimer->GetLerpFactor()) * -0.1f;
    FLOAT fYOffset = Lerp(plan.m_fWeaponYLastOffset, plan.m_fWeaponYOffset, _pTimer->GetLerpFactor()) * -0.15f;
    fYOffset += (fXOffset * fXOffset) * 10.0f;
    plPos(1) += fXOffset;
    plPos(2) += fYOffset;*/

    // [Cecil] Own animation
    FLOAT fAnim = Lerp(plan.m_fWeaponAnimLast, plan.m_fWeaponAnim, _pTimer->GetLerpFactor());
    FLOAT fTimer = fAnim;
    FLOAT fXOffset = SinFast(_pTimer->GetLerpedCurrentTick() * 400.0f)*fAnim * 0.04f;
    FLOAT fYOffset = Lerp(plan.m_fWeaponYLastOffset, plan.m_fWeaponYOffset, _pTimer->GetLerpFactor()) * 0.1f;
    fYOffset += SinFast(_pTimer->GetLerpedCurrentTick() * 800.0f)*fAnim * 0.01f;
    plPos(1) += fXOffset;
    plPos(2) += fYOffset;

    // apply cannon draw
    if (m_iCurrentWeapon == WEAPON_IRONCANNON) {
      FLOAT fLerpedMovement = Lerp(m_fWeaponDrawPowerOld, m_fWeaponDrawPower, _pTimer->GetLerpFactor());
      plPos(3) += fLerpedMovement;

      if (m_tmDrawStartTime != 0.0f) {
        FLOAT tmPassed = _pTimer->GetLerpedCurrentTick()-m_tmDrawStartTime;
        plPos(1) += Sin(tmPassed*360.0f*10)*0.0125f*tmPassed/2.0f;
        plPos(2) += Sin(tmPassed*270.0f*8)*0.01f*tmPassed/2.0f;
      }
    }
  };

  // check target for time prediction updating
  void CheckTargetPrediction(CEntity *penTarget)
  {
    // if target is not predictable
    if (!penTarget->IsPredictable()) {
      // do nothing
      return;
    }

    extern FLOAT cli_tmPredictFoe;
    extern FLOAT cli_tmPredictAlly;
    extern FLOAT cli_tmPredictEnemy;

    // get your and target's bases for prediction
    CEntity *penMe = GetPlayer();
    if (IsPredictor()) {
      penMe = penMe->GetPredicted();
    }
    CEntity *penYou = penTarget;
    if (penYou->IsPredictor()) {
      penYou = penYou->GetPredicted();
    }

    // if player
    if (IS_PLAYER(penYou)) {
      // if ally player 
      if (GetSP()->sp_bCooperative) {
        // if ally prediction is on and this player is local
        if (cli_tmPredictAlly>0 && _pNetwork->IsPlayerLocal(penMe)) {
          // predict the ally
          penYou->SetPredictionTime(cli_tmPredictAlly);
        }
      // if foe player
      } else {
        // if foe prediction is on
        if (cli_tmPredictFoe>0) {
          // if this player is local
          if (_pNetwork->IsPlayerLocal(penMe)) {
            // predict the foe
            penYou->SetPredictionTime(cli_tmPredictFoe);
          }
          // if the target is local
          if (_pNetwork->IsPlayerLocal(penYou)) {
            // predict self
            penMe->SetPredictionTime(cli_tmPredictFoe);
          }
        }
      }
    } else {
      // if enemy prediction is on an it is an enemy
      if( cli_tmPredictEnemy>0 && IsDerivedFromClass( penYou, "Enemy Base")) {
        // if this player is local
        if (_pNetwork->IsPlayerLocal(penMe)) {
          // set enemy prediction time
          penYou->SetPredictionTime(cli_tmPredictEnemy);
        }
      }
    }
  }

  // cast a ray from weapon
  void UpdateTargetingInfo(void) {
    // crosshair start position from weapon
    CPlacement3D plCrosshair;
    FLOAT fFX = wpn_fFX[m_iCurrentWeapon];  // get weapon firing position
    FLOAT fFY = wpn_fFY[m_iCurrentWeapon];
    if (GetPlayer()->m_iViewState == PVT_3RDPERSONVIEW) {
      fFX = fFY = 0;
    }
    CalcWeaponPosition(FLOAT3D(fFX, fFY, 0), plCrosshair, FALSE, TRUE);

    // [Cecil] Cast several rays for the gravity gun
    FLOAT3D vRayOrigin, vRayTarget, vRayHit;

    if (m_iCurrentWeapon == WEAPON_GRAVITYGUN) {
      CPlacement3D plRay[5];
      plRay[0] = plCrosshair;
      plRay[1] = CPlacement3D(plCrosshair.pl_PositionVector, plCrosshair.pl_OrientationAngle + ANGLE3D( 5.0f,  0.0f, 0.0f));
      plRay[2] = CPlacement3D(plCrosshair.pl_PositionVector, plCrosshair.pl_OrientationAngle + ANGLE3D(-5.0f,  0.0f, 0.0f));
      plRay[3] = CPlacement3D(plCrosshair.pl_PositionVector, plCrosshair.pl_OrientationAngle + ANGLE3D( 0.0f,  5.0f, 0.0f));
      plRay[4] = CPlacement3D(plCrosshair.pl_PositionVector, plCrosshair.pl_OrientationAngle + ANGLE3D( 0.0f, -5.0f, 0.0f));

      for (INDEX i = 0; i < 5; i++) {
        CCecilCastRay crRay(m_penPlayer, plRay[i]);
        crRay.cr_bHitTranslucentPortals = TRUE;
        crRay.cr_bPhysical = TRUE;
        crRay.cr_ttHitModels = CCecilCastRay::TT_CUSTOM;
        crRay.cr_fTestR = 0.5f;
        crRay.Cast(GetWorld());

        vRayOrigin = crRay.cr_vOrigin;
        vRayTarget = crRay.cr_vTarget;

        m_penRayHit = crRay.cr_penHit;
        vRayHit = crRay.cr_vHit;
        m_fRayHitDistance = crRay.cr_fHitDistance;

        // found a movable entity
        if (IsDerivedFromID(m_penRayHit, CMovableEntity_ClassID)) {
          break;
        }
      }

    } else {
      // cast ray
      CCecilCastRay crRay(m_penPlayer, plCrosshair);
      crRay.cr_bHitTranslucentPortals = FALSE;
      crRay.cr_bPhysical = FALSE;
      crRay.cr_ttHitModels = CCecilCastRay::TT_CUSTOM;
      crRay.Cast(GetWorld());

      vRayOrigin = crRay.cr_vOrigin;
      vRayTarget = crRay.cr_vTarget;

      // store required cast ray results
      m_penRayHit = crRay.cr_penHit;
      vRayHit = crRay.cr_vHit;
      m_fRayHitDistance = crRay.cr_fHitDistance;
    }
    
    m_vRayHitLast = m_vRayHit; // for lerping purposes
    m_vRayHit = vRayHit;
    m_fEnemyHealth = 0.0f;

    // [Cecil]
    CCastRay crRayPolygon(m_penPlayer, plCrosshair);
    crRayPolygon.cr_bHitPortals = TRUE;
    crRayPolygon.cr_bHitTranslucentPortals = TRUE;
    crRayPolygon.cr_bPhysical = FALSE;
    crRayPolygon.cr_ttHitModels = CCastRay::TT_NONE;
    GetWorld()->CastRay(crRayPolygon);
    m_pbpoRayHit = crRayPolygon.cr_pbpoBrushPolygon;

    // [Cecil] Check if the target is pickable
    if (m_iCurrentWeapon == WEAPON_GRAVITYGUN && m_bCanPickObjects && !HeldObject().IsSynced()) {
      if (m_moWeapon.GetAnim() != GRAVITYGUN_ANIM_FIRE && m_moWeapon.GetAnim() != GRAVITYGUN_ANIM_FIREOPEN) {
        PickableObject(m_penRayHit);
      }
    }

    // set some targeting properties (snooping and such...)
    TIME tmNow = _pTimer->CurrentTick();
    if (m_penRayHit != NULL) {
      CEntity *pen = m_penRayHit;

      // if alive 
      if (pen->GetFlags() & ENF_ALIVE) {
        // check the target for time prediction updating
        CheckTargetPrediction(pen);

        // if player
        if (IS_PLAYER(pen)) {
          // rememer when targeting begun  
          if( m_tmTargetingStarted==0) {
            m_penTargeting = pen;
            m_tmTargetingStarted = tmNow;
          }
          // keep player name, mana and health for eventual printout or coloring
          m_fEnemyHealth = ((CPlayer*)pen)->GetHealth() / ((CPlayer*)pen)->m_fMaxHealth;
          m_strLastTarget.PrintF( "%s", ((CPlayer*)pen)->GetPlayerName());
          if( GetSP()->sp_gmGameMode==CSessionProperties::GM_SCOREMATCH) {
            // add mana to player name
            CTString strMana="";
            strMana.PrintF( " (%d)", ((CPlayer*)pen)->m_iMana);
            m_strLastTarget += strMana;
          }
          if( hud_bShowPlayerName) { m_tmLastTarget = tmNow+1.5f; }
        }
        // not targeting player
        else {
          // reset targeting
          m_tmTargetingStarted = 0; 
        }
        // keep enemy health for eventual crosshair coloring
        if( IsDerivedFromClass( pen, "Enemy Base")) {
          m_fEnemyHealth = ((CEnemyBase*)pen)->GetHealth() / ((CEnemyBase*)pen)->m_fMaxHealth;
        }
         // cannot snoop while firing
        if( m_bFireWeapon) { m_tmTargetingStarted = 0; }
      }
      // if not alive
      else
      {
        // not targeting player
        m_tmTargetingStarted = 0; 

        // check switch relaying by moving brush
        if( IsOfClass( pen, "Moving Brush") && ((CMovingBrush&)*pen).m_penSwitch!=NULL) {
          pen = ((CMovingBrush&)*pen).m_penSwitch;
        }
        // if switch and near enough
        if( IsOfClass( pen, "Switch") && m_fRayHitDistance<2.0f) {
          CSwitch &enSwitch = (CSwitch&)*pen;
          // if switch is useable
          if( enSwitch.m_bUseable) {
            // show switch message
            if( enSwitch.m_strMessage!="") { m_strLastTarget = enSwitch.m_strMessage; }
            else { m_strLastTarget = TRANS("Use"); }
            m_tmLastTarget = tmNow+0.5f;
          }
        }
        // if analyzable
        if( IsOfClass( pen, "MessageHolder") 
         && m_fRayHitDistance < ((CMessageHolder*)&*pen)->m_fDistance
         && ((CMessageHolder*)&*pen)->m_bActive) {
          const CTFileName &fnmMessage = ((CMessageHolder*)&*pen)->m_fnmMessage;
          // if player doesn't have that message it database
          CPlayer &pl = (CPlayer&)*m_penPlayer;
          if( !pl.HasMessage(fnmMessage)) {
            // show analyse message
            m_strLastTarget = TRANS("Analyze");
            m_tmLastTarget  = tmNow+0.5f;
          }
        }
      }
    }
    // if didn't hit anything
    else {
      // not targeting player
      m_tmTargetingStarted = 0; 
      // remember position ahead
      FLOAT3D vDir = vRayTarget - vRayOrigin;
      vDir.Normalize();

      // [Cecil] Hit point is much further away
      m_vRayHit = vRayOrigin + vDir * 500.0f; //50.0f;
    }

    // determine snooping time
    TIME tmDelta = tmNow - m_tmTargetingStarted; 
    if( m_tmTargetingStarted>0 && plr_tmSnoopingDelay>0 && tmDelta>plr_tmSnoopingDelay) {
      m_tmSnoopingStarted = tmNow;
    }
  }



  // Render Crosshair
  void RenderCrosshair(CProjection3D &prProjection, CDrawPort *pdp, CPlacement3D &plViewSource) {
    INDEX iCrossHair = GetPlayer()->GetSettings()->ps_iCrossHairType+1;

    // adjust crosshair type
    if (iCrossHair <= 0) {
      iCrossHair = 0;
      _iLastCrosshairType = 0;
    }

    // create new crosshair texture (if needed)
    if (_iLastCrosshairType != iCrossHair) {
      _iLastCrosshairType = iCrossHair;

      try {
        // load new crosshair texture
        _toCrosshair.SetData_t(CTFILENAME("Textures\\Interface\\Crosshair.tex"));

        // [Cecil]
        _toBarEmpty.SetData_t(CTFILENAME("Textures\\Interface\\BarEmpty.tex"));
        _toBarFull.SetData_t(CTFILENAME("Textures\\Interface\\BarFull.tex"));

      } catch (char *strError) { 
        // didn't make it! - reset crosshair
        CPrintF( strError);
        iCrossHair = 0;
        return;
      }
    }

    COLOR colCrosshair = C_WHITE;
    TIME tmNow = _pTimer->CurrentTick();

    // if hit anything
    FLOAT3D vOnScreen;

    //const FLOAT3D vRayHit = Lerp( m_vRayHitLast, m_vRayHit, _pTimer->GetLerpFactor());
    const FLOAT3D vRayHit = m_vRayHit;  // lerping doesn't seem to work ???

    // if hit anything
    if (m_penRayHit != NULL) {
      CEntity *pen = m_penRayHit;

      // [Cecil] hud_bCrosshairColoring -> hl2_bCrosshairColoring
      // if required, show enemy health thru crosshair color
      if (hl2_bCrosshairColoring && m_fEnemyHealth > 0) {
        if (m_fEnemyHealth < 0.25f) {
          colCrosshair = C_RED;

        } else if (m_fEnemyHealth < 0.60f) {
          colCrosshair = C_YELLOW;

        } else {
          colCrosshair = C_GREEN;
        }
      }
    }

    // screen center
    vOnScreen(1) = (FLOAT)pdp->GetWidth() * 0.5f;
    vOnScreen(2) = (FLOAT)pdp->GetHeight() * 0.5f;

    const FLOAT fSize = 16;

    // draw crosshair
    const FLOAT fI0 = + (PIX)vOnScreen(1) - fSize;
    const FLOAT fI1 = + (PIX)vOnScreen(1) + fSize;
    const FLOAT fJ0 = - (PIX)vOnScreen(2) - fSize + pdp->GetHeight();
    const FLOAT fJ1 = - (PIX)vOnScreen(2) + fSize + pdp->GetHeight();

    pdp->InitTexture(&_toCrosshair);
    pdp->AddTexture(fI0-1, fJ0,   fI1-1, fJ1,   0x0000003F);
    pdp->AddTexture(fI0+1, fJ0,   fI1+1, fJ1,   0x0000003F);
    pdp->AddTexture(fI0,   fJ0-1, fI1,   fJ1-1, 0x0000003F);
    pdp->AddTexture(fI0,   fJ0+1, fI1,   fJ1+1, 0x0000003F);
    pdp->AddTexture(fI0,   fJ0,   fI1,   fJ1, colCrosshair|0xAA);
    pdp->FlushRenderingQueue();

    // [Cecil] Bar contents
    if (GetPlayer()->m_bHEVSuit) {
      const UBYTE ubAlpha = (hl2_colUIMain & 0xFF);

      FLOAT fCurHealth = (GetPlayer()->GetHealth() / 100.0f);
      FLOAT fCurAmmo = FLOAT(GetAmmo(m_iCurrentWeapon)) / FLOAT(GetMaxAmmo(m_iCurrentWeapon));
      if (GetMaxMagCount(m_iCurrentWeapon) > 1) {
        fCurAmmo = FLOAT(GetMagCount(m_iCurrentWeapon)) / FLOAT(GetMaxMagCount(m_iCurrentWeapon));
      }

      const FLOAT fHealthRatio = Clamp(fCurHealth * 0.725f + 0.15f, 0.0f, 1.0f);
      const FLOAT fAmmoRatio   = Clamp(fCurAmmo   * 0.725f + 0.15f, 0.0f, 1.0f);

      const BOOL bHealthWarning = (fCurHealth <= 0.3f);
      const BOOL bAmmoWarning = (fCurAmmo <= 0.3f);

      // [Cecil] Play warning sound
      CPlayerWeapons *pen = (CPlayerWeapons *)GetPredictionTail();

      if (pen->m_bAmmoWarning != bAmmoWarning) {
        if (bAmmoWarning && _penViewPlayer == m_penPlayer) {
          CPlayer &pl = (CPlayer &)*m_penPlayer;
          pl.m_soOther.Set3DParameters(10.0f, 4.0f, 1.0f, 1.0f);
          PlaySound(pl.m_soOther, SOUND_WARNING, SOF_3D|SOF_VOLUMETRIC);
        }

        pen->m_bAmmoWarning = bAmmoWarning;
      }

      // [Cecil] Bar positions
      FLOAT fBarRatio = 1.0f - fHealthRatio;
      COLOR colBar = (bHealthWarning ? UI_RED : _UI_COL) | ubAlpha;
      FLOAT fBarX1 =  (PIX)vOnScreen(1) - 48;
      FLOAT fBarX2 =  (PIX)vOnScreen(1) - 16;
      FLOAT fBarY1 = -(PIX)vOnScreen(2) - 32 + pdp->GetHeight();
      FLOAT fBarY2 = -(PIX)vOnScreen(2) - 32 + pdp->GetHeight() + 64.0f*fBarRatio;

      // [Cecil] Empty bars
      pdp->InitTexture(&_toBarEmpty);
      pdp->AddTexture(fBarX1, fBarY1, fBarX2, fBarY2, 0.0f, 0.0f, 1.0f, fBarRatio, colBar);

      fBarRatio = 1.0f - fAmmoRatio;
      colBar = (bAmmoWarning ? UI_RED : _UI_COL) | ubAlpha;
      fBarX1 =  (PIX)vOnScreen(1) + 48;
      fBarX2 =  (PIX)vOnScreen(1) + 16;
      fBarY2 = -(PIX)vOnScreen(2) - 32 + pdp->GetHeight() + 64.0f*fBarRatio;

      pdp->AddTexture(fBarX1, fBarY1, fBarX2, fBarY2, 0.0f, 0.0f, 1.0f, fBarRatio, colBar);
      pdp->FlushRenderingQueue();

      // [Cecil] Full bars
      fBarRatio = fHealthRatio;
      colBar = (bHealthWarning ? UI_RED : _UI_COL) | ubAlpha;
      fBarX1 =  (PIX)vOnScreen(1) - 48;
      fBarX2 =  (PIX)vOnScreen(1) - 16;
      fBarY1 = -(PIX)vOnScreen(2) + 32 + pdp->GetHeight() - 64.0f*fBarRatio;
      fBarY2 = -(PIX)vOnScreen(2) + 32 + pdp->GetHeight();

      pdp->InitTexture(&_toBarFull);
      pdp->AddTexture(fBarX1, fBarY1, fBarX2, fBarY2, 0.0f, 1.0f-fBarRatio, 1.0f, 1.0f, colBar);

      fBarRatio = fAmmoRatio;
      colBar = (bAmmoWarning ? UI_RED : _UI_COL) | ubAlpha;
      fBarX1 =  (PIX)vOnScreen(1) + 48;
      fBarX2 =  (PIX)vOnScreen(1) + 16;
      fBarY1 = -(PIX)vOnScreen(2) + 32 + pdp->GetHeight() - 64.0f*fBarRatio;

      pdp->AddTexture(fBarX1, fBarY1, fBarX2, fBarY2, 0.0f, 1.0f-fBarRatio, 1.0f, 1.0f, colBar);
      pdp->FlushRenderingQueue();
    }

    // if there is still time
    TIME tmDelta = m_tmLastTarget - tmNow;
    if (tmDelta > 0) {
      // printout current target info
      SLONG slDPWidth  = pdp->GetWidth();
      SLONG slDPHeight = pdp->GetHeight();
      FLOAT fScaling   = (FLOAT)slDPWidth/640.0f;
      // set font and scale
      pdp->SetFont( _pfdDisplayFont);
      pdp->SetTextScaling( fScaling);
      pdp->SetTextAspect( 1.0f);
      // do faded printout
      ULONG ulA = 255.0f * Clamp(2*tmDelta, 0.0f, 1.0f);
      pdp->PutTextC(m_strLastTarget, slDPWidth*0.5f, slDPHeight*0.75f, SE_COL_BLUE_NEUTRAL|ulA);
    }

    // printout crosshair world coordinates if needed
    if (hud_bShowCoords) { 
      CTString strCoords;
      SLONG slDPWidth  = pdp->GetWidth();
      SLONG slDPHeight = pdp->GetHeight();
      // set font and scale
      pdp->SetFont( _pfdDisplayFont);
      pdp->SetTextAspect( 1.0f);
      pdp->SetTextScaling( (FLOAT)slDPWidth/640.0f);
      // do printout only if coordinates are valid
      const FLOAT fMax = Max( Max( vRayHit(1), vRayHit(2)), vRayHit(3));
      const FLOAT fMin = Min( Min( vRayHit(1), vRayHit(2)), vRayHit(3));
      if( fMax<+100000 && fMin>-100000) {
        strCoords.PrintF( "%.0f,%.0f,%.0f", vRayHit(1), vRayHit(2), vRayHit(3));
        pdp->PutTextC( strCoords, slDPWidth*0.5f, slDPHeight*0.10f, C_WHITE|CT_OPAQUE);
      }
    }
  };



/************************************************************
 *                      FIRE FLARE                          *
 ************************************************************/
  // show flare
  CModelObject *ShowFlare(CModelObject &moWeapon, INDEX iAttachObject, INDEX iAttachFlare, FLOAT fSize) {
    CModelObject *pmo = &moWeapon;

    if (iAttachObject != -1) {
      pmo = &(moWeapon.GetAttachmentModel(iAttachObject)->amo_moModelObject);
    }

    CAttachmentModelObject *pamo = pmo->GetAttachmentModel(iAttachFlare);
    pamo->amo_plRelative.pl_OrientationAngle(3) = (rand()*360.0f)/RAND_MAX;
    pmo = &(pamo->amo_moModelObject);

    // [Cecil] Don't change if it's bigger than the needed size
    if (pmo->mo_Stretch(1) < fSize) {
      pmo->StretchModel(FLOAT3D(fSize, fSize, fSize));
    }

    // [Cecil] Fully visible
    pmo->mo_colBlendColor |= 0xFF;
    return pmo;
  };

  // hide flare
  void HideFlare(CModelObject &moWeapon, INDEX iAttachObject, INDEX iAttachFlare) {
    CModelObject *pmo = &moWeapon;

    if (iAttachObject != -1) {
      pmo = &(moWeapon.GetAttachmentModel(iAttachObject)->amo_moModelObject);
    }

    pmo = &(pmo->GetAttachmentModel(iAttachFlare)->amo_moModelObject);
    pmo->StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
  };

  // [Cecil] Increase the flare
  void IncreaseFlare(CModelObject &moWeapon, INDEX iAttachObject, INDEX iAttachFlare, FLOAT fMinSize, FLOAT fMaxSize, FLOAT fAdd) {
    CModelObject *pmo = ShowFlare(moWeapon, iAttachObject, iAttachFlare, fMinSize);

    FLOAT fMul = 1.0f+fAdd;

    if (pmo->mo_Stretch(1)*fMul > fMaxSize) {
      pmo->StretchModel(FLOAT3D(fMaxSize, fMaxSize, fMaxSize));
    } else {
      pmo->StretchModelRelative(FLOAT3D(fMul, fMul, fMul));
    }
  };

  // [Cecil] Decrease the flare
  void DecreaseFlare(CModelObject &moWeapon, INDEX iAttachObject, INDEX iAttachFlare, FLOAT fRatio) {
    CModelObject *pmo = &moWeapon;

    if (iAttachObject != -1) {
      pmo = &(moWeapon.GetAttachmentModel(iAttachObject)->amo_moModelObject);
    }

    pmo = &(pmo->GetAttachmentModel(iAttachFlare)->amo_moModelObject);

    UBYTE ubAlpha = pmo->mo_colBlendColor & 0xFF;
    pmo->mo_colBlendColor &= ~0xFF;
    pmo->mo_colBlendColor |= UBYTE(FLOAT(ubAlpha) * fRatio);

    if (ubAlpha > 7) {
      pmo->StretchModelRelative(FLOAT3D(1.0f, 1.0f, 1.0f) * ((1.0f-fRatio) * 0.9f + fRatio));
    } else {
      pmo->StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
    }
  };

  void SetFlare(INDEX iFlare, INDEX iAction) {
    // if not a prediction head
    if (!IsPredictionHead()) {
      // do nothing
      return;
    }

    // get your prediction tail
    CPlayerWeapons *pen = (CPlayerWeapons*)GetPredictionTail();
    if (iFlare == 0) {
      pen->m_iFlare = iAction;
      pen->GetPlayer()->GetPlayerAnimator()->m_iFlare = iAction;
    } else {
      pen->m_iSecondFlare = iAction;
      pen->GetPlayer()->GetPlayerAnimator()->m_iSecondFlare = iAction;
    }
  };

  // [Cecil] Gravity Gun flare attachment
  void ControlGGFlare(void) {
    m_vLastGGFlare = m_vGGFlare;

    if (m_bPullObject || HeldObject().IsSynced()) {
      m_vGGFlare(1) = ClampUp(m_vGGFlare(1) + 0.1f, 1.2f);

    } else {
      m_vGGFlare(1) = ClampDn(m_vGGFlare(1) - 0.1f, 0.8f);
    }

    m_vGGFlare(2) = ClampDn(m_vGGFlare(2) * 0.5f, 0.01f);
  };

  // [Cecil] Gravity Gun effects
  void ControlGGEffects(void) {
    CPlayerWeapons *pen = (CPlayerWeapons *)GetPredictionTail();

    // Hide holding effects
    if (!pen->HeldObject().IsSynced()) {
      for (INDEX iHide = 2; iHide <= 5; iHide++) {
        CModelObject *pmoEffect = &m_moWeapon.GetAttachmentModel(iHide)->amo_moModelObject;
        pmoEffect->StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
      }
      return;
    }

    // Show holding effects
    for (INDEX iShow = 2; iShow <= 5; iShow++) {
      CAttachmentModelObject *amoEffect = m_moWeapon.GetAttachmentModel(iShow);
      amoEffect->amo_moModelObject.StretchModel(FLOAT3D(1.0f, 1.0f, 1.0f));

      // Move charges
      if (iShow >= 4) {
        amoEffect->amo_plRelative.pl_OrientationAngle(3) = (rand() % 100)/10.0f;
      }
    }
  };

  // flare attachment
  void ControlFlareAttachment(void) {
    // [Cecil] Separate gravity gun control
    if (m_iCurrentWeapon == WEAPON_GRAVITYGUN) {
      FLOAT3D vFlare = Lerp(m_vLastGGFlare, m_vGGFlare, _pTimer->GetLerpFactor());

      CModelObject *pmo = &m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
      pmo->StretchModel(FLOAT3D(vFlare(1), vFlare(1), vFlare(1)));

      pmo = &m_moWeapon.GetAttachmentModel(10)->amo_moModelObject;
      pmo->StretchModel(FLOAT3D(vFlare(2), vFlare(2), vFlare(2)));

      const FLOAT fRatio = Clamp(vFlare(2) / 20.0f - 0.6f, 0.0f, 0.4f) * 2.5f;
      pmo->mo_colBlendColor = C_WHITE | NormFloatToByte(Lerp(1.0f, 0.2f, fRatio));

      ControlGGEffects();
      return;
    }

    // get your prediction tail
    CPlayerWeapons *pen = (CPlayerWeapons *)GetPredictionTail();

    // [Cecil] Update every other tick
    if (_pTimer->GetLerpedCurrentTick() <= m_tmFlareTick) {
      return;
    } else {
      m_tmFlareTick = _pTimer->GetLerpedCurrentTick()+0.025f;
    }

    // add flare
    if (pen->m_iFlare == FLARE_ADD) {
      pen->m_iFlare = FLARE_REMOVE;

      switch(m_iCurrentWeapon) {
        case WEAPON_PISTOL:
          ShowFlare(m_moWeapon, 1, 0, 1.0f);
          break;
        case WEAPON_357:
          ShowFlare(m_moWeapon, 1, 0, 1.5f);
          break;
        case WEAPON_SPAS:
          ShowFlare(m_moWeapon, 1, 0, 2.0f);
          break;
        case WEAPON_SMG1:
          ShowFlare(m_moWeapon, 1, 0, 1.0f);
          break;
        case WEAPON_AR2:
          IncreaseFlare(m_moWeapon, -1, 2, 0.5f, 1.5f, 0.25f);
          break;
        case WEAPON_G3SG1:
          ShowFlare(m_moWeapon, 1, 0, 1.0f);
          break;
      }
    // remove
    } else if (pen->m_iFlare == FLARE_REMOVE) {
      switch(m_iCurrentWeapon) {
        case WEAPON_PISTOL:
          HideFlare(m_moWeapon, 1, 0);
          break;
        case WEAPON_357:
          HideFlare(m_moWeapon, 1, 0);
          break;
        case WEAPON_SPAS:
          HideFlare(m_moWeapon, 1, 0);
          break;
        case WEAPON_SMG1:
          HideFlare(m_moWeapon, 1, 0);
          break;
        case WEAPON_AR2:
          DecreaseFlare(m_moWeapon, -1, 2, 0.8f);
          break;
        case WEAPON_G3SG1:
          HideFlare(m_moWeapon, 1, 0);
          break;
      }
    } else {
      ASSERT(FALSE);
    }
  };

  // play light animation
  void PlayLightAnim(INDEX iAnim, ULONG ulFlags) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;

    if (pl.m_aoLightAnimation.GetData() != NULL) {
      pl.m_aoLightAnimation.PlayAnim(iAnim, ulFlags);
    }
  };

  // Set weapon model for current weapon.
  void SetCurrentWeaponModel(void) {
    // WARNING !!! ---> Order of attachment must be the same with order in RenderWeaponModel()
    switch (m_iCurrentWeapon) {
      case WEAPON_NONE:
        break;

      case WEAPON_CROWBAR:
        SetComponents(this, m_moWeapon, MODEL_CROWBAR_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_CROWBAR_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_CROWBAR, TEXTURE_CROWBAR, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);

        AttachAnim(m_moWeapon, 0, 1, -1, CROWBAR_ANIM_IDLE, 0);
        break;

      case WEAPON_PISTOL: {
        SetComponents(this, m_moWeapon, MODEL_PISTOL_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_PISTOL_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_PISTOL, TEXTURE_PISTOL, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);
        CModelObject &mo = m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        AddAttachmentToModel(this, mo, 0, MODEL_FLARE01, TEXTURE_FLARE01, 0, 0, 0);
        AddAttachmentToModel(this, mo, 1, MODEL_PISTOL_LIGHTS, TEXTURE_PISTOL_LIGHTS, 0, 0, 0);

        HideFlare(m_moWeapon, 1, 0);
        AttachAnim(m_moWeapon, 0, 1, -1, (EMPTY_MAG ? PISTOL_ANIM_IDLEEMPTY : PISTOL_ANIM_IDLE), 0);
        break; }

      case WEAPON_357: {
        SetComponents(this, m_moWeapon, MODEL_357_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_357_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_357, TEXTURE_357, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);
        CModelObject &mo = m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        AddAttachmentToModel(this, mo, 0, MODEL_FLARE01, TEXTURE_FLARE01, 0, 0, 0);

        HideFlare(m_moWeapon, 1, 0);
        AttachAnim(m_moWeapon, 0, 1, -1, MAGNUM_ANIM_IDLE, 0);
        break; }

      case WEAPON_SPAS: {
        SetComponents(this, m_moWeapon, MODEL_SPAS_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_SPAS_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_SPAS, TEXTURE_SPAS, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, 2, MODEL_SPAS_SHELL, TEXTURE_SPAS_SHELL, 0, 0, 0);
        CModelObject &mo = m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        AddAttachmentToModel(this, mo, 0, MODEL_FLARE01, TEXTURE_FLARE01, 0, 0, 0);

        HideFlare(m_moWeapon, 1, 0);
        AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_IDLE, 0);
        break; }

      case WEAPON_SMG1: {
        SetComponents(this, m_moWeapon, MODEL_SMG1_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_SMG1_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_SMG1, TEXTURE_SMG1, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        CModelObject &mo = m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        AddAttachmentToModel(this, mo, 0, MODEL_FLARE01, TEXTURE_FLARE01, 0, 0, 0);
        AddAttachmentToModel(this, mo, 1, MODEL_SMG1_SIGHT, TEXTURE_SMG1_SIGHT, 0, 0, 0);
        AddAttachmentToModel(this, mo, 2, MODEL_SMG1_MAG, TEXTURE_SMG1_MAG, 0, 0, 0);

        HideFlare(m_moWeapon, 1, 0);
        AttachAnim(m_moWeapon, 0, 1, -1, SMG1_ANIM_IDLE, 0);
        break; }

      case WEAPON_CROSSBOW: {
        SetComponents(this, m_moWeapon, MODEL_CROSSBOW_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_CROSSBOW_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_CROSSBOW, TEXTURE_CROSSBOW, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        AttachAnim(m_moWeapon, 0, 1, -1, (!EMPTY_MAG ? CROSSBOW_ANIM_IDLE : CROSSBOW_ANIM_IDLEEMPTY), 0);
        break; }

      case WEAPON_G3SG1: {
        SetComponents(this, m_moWeapon, MODEL_CSS_SNIPER_HANDLER, TEXTURE_CSS_SNIPER_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_CSS_SNIPER_HAND, TEXTURE_CSS_SNIPER_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_CSS_SNIPER, TEXTURE_CSS_SNIPER, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        CModelObject &mo = m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        AddAttachmentToModel(this, mo, 0, MODEL_FLARE01, TEXTURE_FLARE01, 0, 0, 0);

        HideFlare(m_moWeapon, 1, 0);
        AttachAnim(m_moWeapon, 0, 1, -1, CSS_SNIPER_ANIM_IDLE, 0);
        break; }

      case WEAPON_AR2: {
        SetComponents(this, m_moWeapon, MODEL_AR2, TEXTURE_AR2, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_AR2_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_AR2_CORE, TEXTURE_AR2_CORE, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, 2, MODEL_FLARE01, TEXTURE_AR2_FLARE, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 3, MODEL_AR2_GLOW, TEXTURE_AR2_GLOW, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 4, MODEL_AR2_GLOW, TEXTURE_AR2_GLOW, 0, 0, 0);

        HideFlare(m_moWeapon, -1, 2);
        m_moWeapon.PlayAnim(AR2_ANIM_IDLE, 0);
        break; }

      case WEAPON_RPG:
        SetComponents(this, m_moWeapon, MODEL_RPG_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_RPG_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_RPG, TEXTURE_RPG, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        AttachAnim(m_moWeapon, 0, 1, -1, (!EMPTY_MAG || *GetAmmo() > 0) ? RPG_ANIM_IDLE : RPG_ANIM_DOWNIDLE, 0);
        break;

      case WEAPON_GRENADE: {
        SetComponents(this, m_moWeapon, MODEL_GRENADE_HANDLER, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_GRENADE_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 1, MODEL_GRENADE, TEXTURE_GRENADE, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);

        AttachAnim(m_moWeapon, 0, 1, -1, (*GetAmmo() > 0) ? GRENADE_ANIM_IDLE : GRENADE_ANIM_DEFAULT, 0);
        break; }

      case WEAPON_FLAMER:
        SetComponents(this, m_moWeapon, MODEL_FLAMER, TEXTURE_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, FLAMER_ATTACHMENT_BODY, MODEL_FL_BODY, TEXTURE_FL_BODY, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, FLAMER_ATTACHMENT_FUEL, MODEL_FL_RESERVOIR, TEXTURE_FL_FUELRESERVOIR, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, FLAMER_ATTACHMENT_FLAME, MODEL_FL_FLAME, TEXTURE_FL_FLAME, 0, 0, 0);
        break;

      case WEAPON_GRAVITYGUN: {
        SetComponents(this, m_moWeapon, MODEL_GRAVITYGUN, TEXTURE_GRAVITYGUN, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        // base
        AddAttachmentToModel(this, m_moWeapon, 0, MODEL_GG_HAND, TEXTURE_HL2_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 2, MODEL_GG_CORE, TEXTURE_GG_CORE, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 3, MODEL_GG_CORE, TEXTURE_GG_CORE, 0, 0, 0);

        // flares
        AddAttachmentToModel(this, m_moWeapon,  1, MODEL_FLARE01, TEXTURE_GG_FLARE, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 10, MODEL_FLARE01, TEXTURE_GG_CORE, 0, 0, 0);

        CModelObject *pmoFlare = &m_moWeapon.GetAttachmentModel(1)->amo_moModelObject;
        pmoFlare->StretchModel(FLOAT3D(0.8f, 0.8f, 0.8f));
        pmoFlare = &m_moWeapon.GetAttachmentModel(10)->amo_moModelObject;
        pmoFlare->StretchModel(FLOAT3D(0.01f, 0.01f, 0.01f));

        // charge effects
        AddAttachmentToModel(this, m_moWeapon, 4, MODEL_GG_CHARGE, TEXTURE_GG_CHARGE, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 5, MODEL_GG_CHARGE, TEXTURE_GG_CHARGE, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 6, MODEL_GG_LAUNCH, TEXTURE_GG_CHARGE, 0, 0, 0);

        // glow parts
        AddAttachmentToModel(this, m_moWeapon, 7, MODEL_GG_COREGLOW, TEXTURE_GG_GLOW, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 8, MODEL_GG_COREGLOW, TEXTURE_GG_GLOW, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, 9, MODEL_GG_BASEGLOW, TEXTURE_GG_GLOW, 0, 0, 0);

        // [Cecil] Hide unnecessary things
        for (INDEX iHide = 2; iHide <= 6; iHide++) {
          CModelObject *pmoEffect = &m_moWeapon.GetAttachmentModel(iHide)->amo_moModelObject;
          pmoEffect->StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
        }

        m_moWeapon.PlayAnim(GRAVITYGUN_ANIM_IDLE, 0);
        break; }

      case WEAPON_LASER:
        SetComponents(this, m_moWeapon, MODEL_LASER, TEXTURE_HAND, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, LASER_ATTACHMENT_BODY, MODEL_LS_BODY, TEXTURE_LS_BODY, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, LASER_ATTACHMENT_LEFTUP,    MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, LASER_ATTACHMENT_LEFTDOWN,  MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, LASER_ATTACHMENT_RIGHTUP,   MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddAttachmentToModel(this, m_moWeapon, LASER_ATTACHMENT_RIGHTDOWN, MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;

      case WEAPON_IRONCANNON:
        SetComponents(this, m_moWeapon, MODEL_CANNON, TEXTURE_CANNON, 0, 0, 0);
        AddAttachmentToModel(this, m_moWeapon, CANNON_ATTACHMENT_BODY, MODEL_CN_BODY, TEXTURE_CANNON, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;
    }
  };

  /*
   *  >>>---  SUPPORT (COMMON) FUNCTIONS  ---<<<
   */

  // calc weapon position for 3rd person view
  void CalcWeaponPosition3rdPersonView(FLOAT3D vPos, CPlacement3D &plPos, BOOL bResetZ) {
    plPos.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    // weapon handle
    if (!m_bMirrorFire) {
      plPos.pl_PositionVector = FLOAT3D( wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                         wpn_fZ[m_iCurrentWeapon]);
    } else {
      plPos.pl_PositionVector = FLOAT3D( -wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                          wpn_fZ[m_iCurrentWeapon]);
    }
    // weapon offset
    if (!m_bMirrorFire) {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    } else {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    }
    plPos.pl_PositionVector(1) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(2) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(3) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);

    if (bResetZ) {
      plPos.pl_PositionVector(3) = 0.0f;
    }

    // player view and absolute position
    CPlacement3D plView = ((CPlayer &)*m_penPlayer).en_plViewpoint;
    plView.pl_PositionVector(2) = 1.25118f;
    plPos.RelativeToAbsoluteSmooth(plView);
    plPos.RelativeToAbsoluteSmooth(m_penPlayer->GetPlacement());
  };

  // calc weapon position
  void CalcWeaponPosition(FLOAT3D vPos, CPlacement3D &plPos, BOOL bResetZ, BOOL bUseRecoil) {
    plPos.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    // weapon handle
    if (!m_bMirrorFire) {
      plPos.pl_PositionVector = FLOAT3D( wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                         wpn_fZ[m_iCurrentWeapon]);
      if (m_iSniping != 0) {
        plPos.pl_PositionVector = FLOAT3D(0.0f, 0.0f, 0.0f);
      }
    } else {
      plPos.pl_PositionVector = FLOAT3D( -wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                          wpn_fZ[m_iCurrentWeapon]);
    }

    // weapon offset
    if (!m_bMirrorFire) {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    } else {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    }

    plPos.pl_PositionVector(1) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(2) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(3) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);

    if (bResetZ) {
      plPos.pl_PositionVector(3) = 0.0f;
    }

    // player view and absolute position
    CPlacement3D plView = ((CPlayer &)*m_penPlayer).en_plViewpoint;
    plView.pl_PositionVector(2) += ((CPlayerAnimator&)*((CPlayer &)*m_penPlayer).m_penAnimator).m_fEyesYOffset;

    // [Cecil] Recoil shake
    if (bUseRecoil) {
      plView.pl_OrientationAngle += ((CPlayer &)*m_penPlayer).m_aRecoilShake * ((CPlayer &)*m_penPlayer).m_fRecoilPower;
    }

    plPos.RelativeToAbsoluteSmooth(plView);
    plPos.RelativeToAbsoluteSmooth(m_penPlayer->GetPlacement());
  };

  // calc lerped weapon position
  void CalcLerpedWeaponPosition(FLOAT3D vPos, CPlacement3D &plPos, BOOL bResetZ) {
    plPos.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    // weapon handle
    if (!m_bMirrorFire) {
      plPos.pl_PositionVector = FLOAT3D( wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                         wpn_fZ[m_iCurrentWeapon]);
      if (m_iSniping != 0) {
        plPos.pl_PositionVector = FLOAT3D(0.0f, 0.0f, 0.0f);
      }
    } else {
      plPos.pl_PositionVector = FLOAT3D( -wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                          wpn_fZ[m_iCurrentWeapon]);
    }
    // weapon offset
    if (!m_bMirrorFire) {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    } else {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    }
    plPos.pl_PositionVector(1) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(2) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(3) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);

    if (bResetZ) {
      plPos.pl_PositionVector(3) = 0.0f;
    }

    // player view and absolute position
    CPlacement3D plRes;
    GetPlayer()->GetLerpedWeaponPosition(plPos.pl_PositionVector, plRes);
    plPos = plRes;
  };

  // calc weapon position
  void CalcWeaponPositionImprecise (FLOAT3D vPos, CPlacement3D &plPos, BOOL bResetZ, FLOAT fImprecissionAngle) {
    plPos.pl_OrientationAngle = ANGLE3D((FRnd()-0.5f)*fImprecissionAngle, (FRnd()-0.5f)*fImprecissionAngle, 0);
    // weapon handle
    if (!m_bMirrorFire) {
      plPos.pl_PositionVector = FLOAT3D( wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                         wpn_fZ[m_iCurrentWeapon]);
      if (m_iSniping != 0) {
        plPos.pl_PositionVector = FLOAT3D(0.0f, 0.0f, 0.0f);
      }
    } else {
      plPos.pl_PositionVector = FLOAT3D( -wpn_fX[m_iCurrentWeapon], wpn_fY[m_iCurrentWeapon],
                                          wpn_fZ[m_iCurrentWeapon]);
    }
    // weapon offset
    if (!m_bMirrorFire) {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    } else {
      plPos.RelativeToAbsoluteSmooth(CPlacement3D(vPos, ANGLE3D(0, 0, 0)));
    }
    plPos.pl_PositionVector(1) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(2) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);
    plPos.pl_PositionVector(3) *= SinFast(wpn_fFOV[m_iCurrentWeapon]/2) / SinFast(90.0f/2);

    if (bResetZ) {
      plPos.pl_PositionVector(3) = 0.0f;
    }

    // player view and absolute position
    CPlacement3D plView = ((CPlayer &)*m_penPlayer).en_plViewpoint;
    plView.pl_PositionVector(2)+= ((CPlayerAnimator&)*((CPlayer &)*m_penPlayer).m_penAnimator).
      m_fEyesYOffset;
    plPos.RelativeToAbsoluteSmooth(plView);
    plPos.RelativeToAbsoluteSmooth(m_penPlayer->GetPlacement());
  };

  // setup 3D sound parameters
  void Setup3DSoundParameters(void) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;

    // initialize sound 3D parameters
    pl.m_soWeaponFire1.Set3DParameters(50.0f, 5.0f, 1.0f, 1.0f);
    pl.m_soWeaponFire2.Set3DParameters(50.0f, 5.0f, 1.0f, 1.0f);
    pl.m_soWeaponReload.Set3DParameters(30.0f, 3.0f, 1.0f, 1.0f);
    pl.m_soWeaponAlt.Set3DParameters(60.0f, 6.0f, 1.0f, 1.0f);
    pl.m_soWeaponEmpty.Set3DParameters(20.0f, 2.0f, 1.0f, 1.0f);
  };

  /*
   *  >>>---  FIRE FUNCTIONS  ---<<<
   */

  // cut in front of you with knife
  INDEX CutWithKnife(FLOAT fX, FLOAT fY, FLOAT fRange, FLOAT fWide, FLOAT fThickness, FLOAT fDamage, INDEX &iSurfaceReturn, SprayParticlesType &sptReturn, BOOL &bKilled) {
    // knife start position
    CPlacement3D plKnife;
    CalcWeaponPosition(FLOAT3D(fX, fY, 0), plKnife, TRUE, TRUE);

    // [Cecil] Model particles
    sptReturn = SPT_NONE;

    // create a set of rays to test
    const FLOAT3D &vBase = plKnife.pl_PositionVector;
    FLOATmatrix3D m;
    MakeRotationMatrixFast(m, plKnife.pl_OrientationAngle);
    FLOAT3D vRight = m.GetColumn(1)*fWide;
    FLOAT3D vUp    = m.GetColumn(2)*fWide;
    FLOAT3D vFront = -m.GetColumn(3)*fRange;

    FLOAT3D vDest[5];
    vDest[0] = vBase+vFront;
    vDest[1] = vBase+vFront+vUp;
    vDest[2] = vBase+vFront-vUp;
    vDest[3] = vBase+vFront+vRight;
    vDest[4] = vBase+vFront-vRight;

    CEntity *penClosest = NULL;
    FLOAT fDistance = UpperLimit(0.0f);
    FLOAT3D vHit;
    FLOAT3D vDir;

    // [Cecil] Hit entity (0 - none, 1 - model, 2 - polygon)
    INDEX iHitReturn = 0;

    // for each ray
    for (INDEX i = 0; i < 5; i++) {
      // cast a ray to find if any model
      CCecilCastRay crRay(m_penPlayer, vBase, vDest[i]);
      //crRay.cr_bHitTranslucentPortals = FALSE;
      // [Cecil] Hit "portal" surfaces
      crRay.cr_bHitPortals = TRUE;
      crRay.cr_bHitTranslucentPortals = TRUE;
      crRay.cr_bPhysical = TRUE;

      crRay.cr_fTestR = fThickness;
      crRay.cr_ttHitModels = CCecilCastRay::TT_CUSTOM;
      crRay.Cast(GetWorld());
      
      // if hit something
      if (crRay.cr_penHit != NULL && crRay.cr_fHitDistance < fDistance) {
        penClosest = crRay.cr_penHit;
        fDistance = crRay.cr_fHitDistance;
        vDir = vDest[i]-vBase;
        vHit = crRay.cr_vHit;
        
        // [Cecil] Only check brushes for the first one
        //if (i == 0)
        {
          // [Cecil] Spawn a bullet hole at the hit polygon
          if (i == 0 && crRay.cr_cpoPolygon.bHit) {
            const INDEX iSurfaceType = crRay.cr_cpoPolygon.ubSurface;
            const EffectParticlesType eptType = GetParticleEffectTypeForSurface(iSurfaceType);
            
            const FLOAT3D vNormal = crRay.cr_cpoPolygon.plPolygon;
            const FLOAT3D vReflected = vDir - vNormal * (2.0f*(vNormal % vDir));

            // [Cecil]
            iSurfaceReturn = iSurfaceType;
            iHitReturn = 2;

            // [Cecil] Bullet
            BOOL bPassable = FALSE;
            const BOOL bHitBrush = (crRay.cr_cpoPolygon.eType == SCollisionPolygon::POL_BRUSH);

            if (bHitBrush) {
              bPassable = crRay.cr_cpoPolygon.pbpoHit->bpo_ulFlags & (BPOF_PASSABLE | BPOF_SHOOTTHRU);
            }

            if (!bPassable && iSurfaceType != SURFACE_WATER) {
              FLOAT3D vHitDirection;
              AnglesToDirectionVector(plKnife.pl_OrientationAngle, vHitDirection);
              BulletHitType bhtType = (BulletHitType)GetBulletHitTypeForSurface(iSurfaceType);

              // [Cecil]
              SSpawnHitEffectArgs args;
              args.pen = this;
              args.bhtType = bhtType;
              args.bSound = FALSE;
              args.vHitNormal = vNormal;
              args.vHitPoint = crRay.cr_vHit;
              args.vHitDirection = vHitDirection;

              // [Cecil] Parent to non-brush entities immediately
              if (!bHitBrush) {
                args.penParent = crRay.cr_penHit;
              }

              SpawnHitTypeEffect(args);

            } else {
              ((CPlayer&)*m_penPlayer).AddBulletSpray(vBase+vFront, eptType, vReflected);
            }

          // model
          } else if (crRay.cr_penHit->GetRenderType() == RT_MODEL) {
            BOOL bRender = TRUE;
            FLOAT3D vSpillDir = -((CPlayer&)*m_penPlayer).en_vGravityDir * 0.5f;
            SprayParticlesType sptType = SPT_NONE;
            COLOR colParticles = C_WHITE|CT_OPAQUE;
            FLOAT fPower = 4.0f;

            if (IsOfClass(crRay.cr_penHit, "ModelHolder2")) {
              bRender = FALSE;
              CModelDestruction *penDestruction = ((CModelHolder2&)*crRay.cr_penHit).GetDestruction();

              if (penDestruction != NULL) {
                bRender = TRUE;
                sptType = penDestruction->m_sptType;

                // [Cecil]
                sptReturn = sptType;
              }

              CModelHolder2 *pmh2 = (CModelHolder2*)crRay.cr_penHit;
              colParticles = pmh2->m_colBurning;

            // [Cecil] Other entities
            } else {
              if (IsOfClassID(crRay.cr_penHit, CRollerMine_ClassID) || IsOfClassID(crRay.cr_penHit, CRadio_ClassID)) {
                sptReturn = SPT_ELECTRICITY_SPARKS_NO_BLOOD;
              } else if (IsOfClassID(crRay.cr_penHit, CRollingStone_ClassID)) {
                sptReturn = SPT_STONES;
              }
            }

            FLOATaabbox3D boxCutted = FLOATaabbox3D(FLOAT3D(0, 0, 0),FLOAT3D(1, 1, 1));

            if (bRender) {
              crRay.cr_penHit->en_pmoModelObject->GetCurrentFrameBBox(boxCutted);
              ((CPlayer&)*m_penPlayer).AddGoreSpray(vBase+vFront, vHit, sptType, vSpillDir, boxCutted, fPower, colParticles);
            }

            // [Cecil]
            if (IsDerivedFromClass(crRay.cr_penHit, "Enemy Base")) {
              sptReturn = ((CEnemyBase&)*crRay.cr_penHit).m_sptType;
            } else if (IS_PLAYER(crRay.cr_penHit)) {
              sptReturn = SPT_BLOOD;
            }

            // [Cecil] Treat model as a polygon if it has a material
            iSurfaceReturn = GetSurfaceForEntity(crRay.cr_penHit);
            iHitReturn = (iSurfaceReturn == -1 ? 1 : 2);
          }
        }

        // [Cecil] Check from above
        if (i == 0) {
          // don't search any more
          break;
        }
      }
    }

    // if any model hit
    if (penClosest != NULL) {
      // in deathmatches check for backstab
      if (!(GetSP()->sp_bCooperative) && IS_PLAYER(penClosest))
      {
        FLOAT3D vToTarget = penClosest->GetPlacement().pl_PositionVector - m_penPlayer->GetPlacement().pl_PositionVector;
        FLOAT3D vTargetHeading = FLOAT3D(0.0f, 0.0f, -1.0f)*penClosest->GetRotationMatrix();
        vToTarget.Normalize(); vTargetHeading.Normalize();

        if (vToTarget % vTargetHeading > 0.64279f) { //CosFast(50.0f)
          PrintCenterMessage(this, m_penPlayer, TRANS("Backstab!"), 4.0f, MSS_NONE);
          fDamage *= 4.0f;
        }
      }

      const FLOAT fDamageMul = GetSeriousDamageMultiplier(m_penPlayer);
      InflictDirectDamage(penClosest, m_penPlayer, DMT_CLOSERANGE, fDamage * fDamageMul, vHit, vDir);

      // [Cecil]
      if (IsDerivedFromClass(penClosest, "Enemy Base")) {
        CEnemyBase &enEnemy = (CEnemyBase&)*penClosest;

        sptReturn = enEnemy.m_sptType;
        bKilled = (enEnemy.GetHealth() <= 0.0f);

        iHitReturn = 1;
      }
    }

    return iHitReturn;
  };

  
  // cut in front of you with the chainsaw
  BOOL CutWithChainsaw(FLOAT fX, FLOAT fY, FLOAT fRange, FLOAT fWide, FLOAT fThickness, FLOAT fDamage) {
    // knife start position
    CPlacement3D plKnife;
    CalcWeaponPosition(FLOAT3D(fX, fY, 0), plKnife, TRUE, TRUE);

    // create a set of rays to test
    const FLOAT3D &vBase = plKnife.pl_PositionVector;
    FLOATmatrix3D m;
    MakeRotationMatrixFast(m, plKnife.pl_OrientationAngle);
    FLOAT3D vRight = m.GetColumn(1)*fWide;
    FLOAT3D vUp    = m.GetColumn(2)*fWide;
    FLOAT3D vFront = -m.GetColumn(3)*fRange;

    FLOAT3D vDest[3];
    vDest[0] = vBase+vFront;
    vDest[1] = vBase+vFront+vRight;
    vDest[2] = vBase+vFront-vRight;
    
    CEntity *penClosest = NULL;
    FLOAT fDistance = UpperLimit(0.0f);
    FLOAT3D vHit;
    FLOAT3D vDir;
    // for each ray
    for (INDEX i=0; i<3; i++) {
      // cast a ray to find if any model
      CCecilCastRay crRay( m_penPlayer, vBase, vDest[i]);
      crRay.cr_bHitTranslucentPortals = FALSE;
      crRay.cr_fTestR = fThickness;
      crRay.cr_ttHitModels = CCecilCastRay::TT_CUSTOM;
      crRay.Cast(GetWorld());

      // if hit something
      if (crRay.cr_penHit!=NULL)
      {
        penClosest = crRay.cr_penHit;
        fDistance = crRay.cr_fHitDistance;
        vDir = vDest[i]-vBase;
        vDir.Normalize();
        vHit = crRay.cr_vHit;

        if (i == 0) {
          // [Cecil] Using new collision polygon structure
          if (crRay.cr_penHit->GetRenderType() == RT_BRUSH && crRay.cr_cpoPolygon.bHit) {
            const INDEX iSurfaceType = crRay.cr_cpoPolygon.ubSurface;
            const EffectParticlesType eptType = GetParticleEffectTypeForSurface(iSurfaceType);

            const FLOAT3D vNormal = crRay.cr_cpoPolygon.plPolygon;
            const FLOAT3D vReflected = vDir-vNormal*(2.0f*(vNormal%vDir));
            ((CPlayer&)*m_penPlayer).AddBulletSpray( vBase+vFront, eptType, vReflected);

            // shake view
            ((CPlayer&)*m_penPlayer).m_fChainShakeStrength = 0.85f;
            ((CPlayer&)*m_penPlayer).m_fChainShakeFreqMod = 1.0f;
            ((CPlayer&)*m_penPlayer).m_tmChainShakeEnd = _pTimer->CurrentTick() + CHAINSAW_UPDATETIME*1.5f;

          } else if (crRay.cr_penHit->GetRenderType() == RT_MODEL) {
            BOOL bRender = TRUE;
            FLOAT3D vSpillDir = -((CPlayer&)*m_penPlayer).en_vGravityDir * 0.5f;
            SprayParticlesType sptType = SPT_BLOOD;
            COLOR colParticles=C_WHITE|CT_OPAQUE;
            if (!IsDerivedFromClass(crRay.cr_penHit, "Enemy Base")) {
              sptType=SPT_NONE;
            }
            FLOAT fPower = 4.0f;

            // [Cecil] + HL2 enemies
            if (IsOfClass(crRay.cr_penHit, "Boneman")
             || IsOfClass(crRay.cr_penHit, "Antlion")
             || IsOfClass(crRay.cr_penHit, "AntlionGuard")) {
              sptType = SPT_BONES;
              fPower = 6.0f;

            } else if (IsOfClass(crRay.cr_penHit, "Gizmo")
                    || IsOfClass(crRay.cr_penHit, "Beast")) {
              sptType = SPT_SLIME;
              fPower = 4.0f;

            } else if (IsOfClass(crRay.cr_penHit, "Woman")) {
              sptType = SPT_FEATHER;
              fPower = 3.0f;

            } else if (IsOfClass(crRay.cr_penHit, "Elemental")) {
              sptType = SPT_LAVA_STONES;
              fPower = 3.0f;

            } else if (IsOfClass(crRay.cr_penHit, "Walker")) {
              sptType = SPT_ELECTRICITY_SPARKS;
              fPower = 30.0f;

            } else if (IsOfClass(crRay.cr_penHit, "AirElemental")) {
              sptType = SPT_AIRSPOUTS;
              fPower = 6.0f;

            } else if (IsOfClass(crRay.cr_penHit, "CannonRotating")
                    || IsOfClass(crRay.cr_penHit, "CannonStatic")) {
              sptType = SPT_WOOD;
            }

            if (IsOfClass(crRay.cr_penHit, "ModelHolder2")) {
              bRender=FALSE;
              CModelDestruction *penDestruction = ((CModelHolder2&)*crRay.cr_penHit).GetDestruction();
              CModelHolder2 *pmh2=(CModelHolder2*)crRay.cr_penHit;
              colParticles=pmh2->m_colBurning;
              if (penDestruction != NULL) {
                bRender=TRUE;
                sptType= penDestruction->m_sptType;

                if (sptType == SPT_COLOREDSTONE) {
                  colParticles = MulColors(colParticles,penDestruction->m_colParticles);
                }
              }
            }
            FLOATaabbox3D boxCutted=FLOATaabbox3D(FLOAT3D(0,0,0),FLOAT3D(1,1,1));
            if(bRender && m_tmLastChainsawSpray+0.2f<_pTimer->CurrentTick())
            {
              crRay.cr_penHit->en_pmoModelObject->GetCurrentFrameBBox( boxCutted);
              ((CPlayer&)*m_penPlayer).AddGoreSpray( vBase+vFront, vHit, sptType,
                vSpillDir, boxCutted, fPower, colParticles);
              m_tmLastChainsawSpray = _pTimer->CurrentTick();
            }

            // shake view
            ((CPlayer&)*m_penPlayer).m_fChainShakeStrength = 1.1f;
            ((CPlayer&)*m_penPlayer).m_fChainShakeFreqMod = 1.0f;
            ((CPlayer&)*m_penPlayer).m_tmChainShakeEnd = _pTimer->CurrentTick() + CHAINSAW_UPDATETIME*1.5f;

          }
        }

        if(crRay.cr_penHit->GetRenderType()==RT_MODEL && crRay.cr_fHitDistance<=fDistance)
        {
          // if this is primary ray
          if (i==0)
          {
            // don't search any more
            break;
          }
        }
      } else {
        // because we're firing, add just a slight shake
        ((CPlayer&)*m_penPlayer).m_fChainShakeStrength = 0.1f;
        ((CPlayer&)*m_penPlayer).m_fChainShakeFreqMod = 1.0f;
        ((CPlayer&)*m_penPlayer).m_tmChainShakeEnd = _pTimer->CurrentTick() + CHAINSAW_UPDATETIME*1.5f;
      }
    }
    // if any model hit
    if (penClosest!=NULL) {
      InflictDirectDamage(penClosest, m_penPlayer, DMT_CHAINSAW, fDamage, vHit, vDir);
      return TRUE;
    }
    return FALSE;
  };

  // prepare Bullet
  void PrepareSniperBullet(FLOAT fDamage, FLOAT fImprecission) {
    // bullet start position
    CalcWeaponPositionImprecise(FLOAT3D(0, 0, 0), plBullet, TRUE, fImprecission);
    // create bullet
    penBullet = CreateEntity(plBullet, CLASS_BULLET);
    m_vBulletSource = plBullet.pl_PositionVector;
	// init bullet
    EBulletInit eInit;
    eInit.penOwner = m_penPlayer;
    eInit.fDamage = fDamage;
    penBullet->Initialize(eInit);
  };

  // prepare Bullet
  void PrepareBullet(FLOAT fDamage) {
    // bullet start position
    CalcWeaponPosition(FLOAT3D(0, 0, 0), plBullet, TRUE, TRUE);
    // create bullet
    penBullet = CreateEntity(plBullet, CLASS_BULLET);
    // init bullet
    EBulletInit eInit;
    eInit.penOwner = m_penPlayer;
    eInit.fDamage = fDamage;
    penBullet->Initialize(eInit);
  };

  // fire one bullet
  void FireSniperBullet(FLOAT fRange, FLOAT fDamage, FLOAT fImprecission) {
    // [Cecil] Damage Multiplier
    if (GetPlayer()->CheatsEnabled()) {
      fDamage *= cht_fDamageMul;
    }

    PrepareSniperBullet(fDamage, fImprecission);
    ((CBullet&)*penBullet).CalcTarget(fRange);
    ((CBullet&)*penBullet).m_fBulletSize = 0.1f;
    // launch bullet
    ((CBullet&)*penBullet).LaunchBullet(TRUE, FALSE, TRUE);
    
    if (((CBullet&)*penBullet).m_vHitPoint != FLOAT3D(0.0f, 0.0f, 0.0f)) {
      m_vBulletTarget = ((CBullet&)*penBullet).m_vHitPoint;
    } else if (TRUE) {
      m_vBulletTarget = m_vBulletSource + FLOAT3D(0.0f, 0.0f, -500.0f)*((CBullet&)*penBullet).GetRotationMatrix();
      
    }
    
	  // bullet no longer needed
	  ((CBullet&)*penBullet).DestroyBullet();
  };

  // fire one bullet
  void FireOneBullet(FLOAT fRange, FLOAT fDamage) {
    // [Cecil] Damage Multiplier
    if (GetPlayer()->CheatsEnabled()) {
      fDamage *= cht_fDamageMul;
    }

    PrepareBullet(fDamage);
    ((CBullet&)*penBullet).CalcTarget(fRange);
    ((CBullet&)*penBullet).m_fBulletSize = 0.1f;
    // launch bullet
    ((CBullet&)*penBullet).LaunchBullet(TRUE, FALSE, TRUE);
    ((CBullet&)*penBullet).DestroyBullet();
  };

  // fire bullets (x offset is used for double shotgun)
  void FireBullets(FLOAT fRange, FLOAT fDamage, INDEX iBullets, FLOAT *afPositions, FLOAT fStretch, FLOAT fJitter, INDEX dmtBullet) {
    // [Cecil] Damage Multiplier
    if (GetPlayer()->CheatsEnabled()) {
      fDamage *= cht_fDamageMul;
    }

    PrepareBullet(fDamage);

    CBullet &pen = (CBullet&)*penBullet;
    pen.CalcTarget(fRange);
    pen.m_fBulletSize = GetSP()->sp_bCooperative ? 0.1f : 0.3f;

    // [Cecil] Damage Type
    pen.m_EdtDamage = (DamageType)dmtBullet;

    // launch slugs
    INDEX iSlug;
    for (iSlug = 0; iSlug < iBullets; iSlug++) {
      // launch bullet
      pen.CalcJitterTargetFixed(
        afPositions[iSlug*2+0]*fRange*fStretch, afPositions[iSlug*2+1]*fRange*fStretch,
        fJitter*fRange*fStretch);
      pen.LaunchBullet(iSlug<2, FALSE, TRUE);
    }

    pen.DestroyBullet();
  };

  // fire one bullet for machine guns (tommygun and minigun)
  void FireMachineBullet(FLOAT fRange, FLOAT fDamage, FLOAT fJitter, FLOAT fBulletSize, INDEX dmtBullet, BOOL bRecoil) {
    // [Cecil] Damage Multiplier
    if (GetPlayer()->CheatsEnabled()) {
      fDamage *= cht_fDamageMul;
    }

    fJitter *= fRange;  // jitter relative to range
    PrepareBullet(fDamage);

    CBullet &pen = (CBullet&)*penBullet;
    pen.CalcTarget(fRange);
    pen.m_fBulletSize = fBulletSize;

    // [Cecil] Increase jitter with recoil
    pen.CalcJitterTarget(fJitter + (FLOAT(m_iNewShots)/20.0f)*bRecoil);

    // [Cecil] Damage Type
    pen.m_EdtDamage = (DamageType)dmtBullet;

    pen.LaunchBullet(TRUE, FALSE, TRUE);
    pen.DestroyBullet();

    // [Cecil] Increase recoil
    if (bRecoil) {
      m_iNewShots = ClampUp(INDEX(m_iNewShots+1), (INDEX)20);
    }
  };

  // fire grenade
  void FireGrenade(INDEX iPower) {
    // grenade start position
    CPlacement3D plGrenade;
    CalcWeaponPosition(
      FLOAT3D(wpn_fFX[WEAPON_GRENADE],wpn_fFY[WEAPON_GRENADE], 0), 
      plGrenade, TRUE, TRUE);
    // create grenade
    CEntityPointer penGrenade = CreateEntity(plGrenade, CLASS_PROJECTILE);
    // init and launch grenade
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_GRENADE;
    eLaunch.fSpeed = 20.0f+iPower*5.0f;
    penGrenade->Initialize(eLaunch);
  };

  // [Cecil] SMG1 Alt Fire
  void FireSMGGrenade(FLOAT fPower) {
    // grenade start position
    CPlacement3D plGrenade;
    CalcWeaponPosition(FLOAT3D(0.4f, -0.4f, 0.0f), plGrenade, TRUE, FALSE);

    // create grenade
    CEntityPointer penGrenade = CreateEntity(plGrenade, CLASS_PROJECTILE);
    // init and launch grenade
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_SMG1_GRENADE;
    eLaunch.fSpeed = fPower;
    penGrenade->Initialize(eLaunch);
  };

  // [Cecil] AR2 Alt Fire
  void FireEnergyBall(void) {
    // grenade start position
    CPlacement3D plBall;
    CalcWeaponPosition(FLOAT3D(0.3f, -0.3f, 0.0f), plBall, TRUE, FALSE);

    // create grenade
    CEntityPointer penBall = CreateEntity(plBall, CLASS_PROJECTILE);
    // init and launch grenade
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_ENERGY_BALL;
    eLaunch.fStretch = 1.0f;
    penBall->Initialize(eLaunch);
  };

  // [Cecil] Crossbow Rod Projectile
  void FireRod(void) {
    // rod start position
    CPlacement3D plRod;
    CalcWeaponPosition(FLOAT3D(0.2f, -0.2f, 0.0f), plRod, TRUE, FALSE);

    // create grenade
    CEntityPointer penRod = CreateEntity(plRod, CLASS_PROJECTILE);
    // init and launch grenade
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_CROSSBOW_ROD;
    eLaunch.fStretch = 1.0f;
    penRod->Initialize(eLaunch);
  };

  // fire rocket
  void FireRocket(void) {
    // rocket start position
    CPlacement3D plRocket;
    CalcWeaponPosition(FLOAT3D(0.3f, -0.3f, 0.0f), plRocket, TRUE, TRUE);

    // create rocket
    m_penMissle = CreateEntity(plRocket, CLASS_PROJECTILE);
    // init and launch rocket
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_ROCKET;
    m_penMissle->Initialize(eLaunch);
  };

  // flamer source
  void GetFlamerSourcePlacement(CPlacement3D &plSource, CPlacement3D &plInFrontOfPipe) {
    CalcLerpedWeaponPosition(
      FLOAT3D(wpn_fFX[WEAPON_FLAMER],wpn_fFY[WEAPON_FLAMER], -0.15f), 
      plSource, FALSE);
    plInFrontOfPipe=plSource;
    FLOAT3D vFront;
    AnglesToDirectionVector( plSource.pl_OrientationAngle, vFront);
    plInFrontOfPipe.pl_PositionVector=plSource.pl_PositionVector+vFront*1.0f;
  };

  // fire flame
  void FireFlame(void) {
    // flame start position
    CPlacement3D plFlame;

    CalcWeaponPosition(FLOAT3D(wpn_fFX[WEAPON_FLAMER],wpn_fFY[WEAPON_FLAMER], -0.15f), plFlame, TRUE, TRUE);

    // create flame
    CEntityPointer penFlame = CreateEntity(plFlame, CLASS_PROJECTILE);
    // init and launch flame
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_FLAME;
    penFlame->Initialize(eLaunch);
    // link last flame with this one (if not NULL or deleted)
    if (m_penFlame!=NULL && !(m_penFlame->GetFlags()&ENF_DELETED)) {
      ((CProjectile&)*m_penFlame).m_penParticles = penFlame;
    }
    // link to player weapons
    ((CProjectile&)*penFlame).m_penParticles = this;
    // store last flame
    m_penFlame = penFlame;
  };
  
  // fire laser ray
  void FireLaserRay(void) {
    // laser start position
    CPlacement3D plLaserRay;
    FLOAT fFX = wpn_fFX[WEAPON_LASER];  // get laser center position
    FLOAT fFY = wpn_fFY[WEAPON_LASER];
    FLOAT fLUX = 0.0f;
    FLOAT fRUX = 0.8f;
    FLOAT fLUY = 0.0f;
    FLOAT fRUY = 0.0f;
    FLOAT fLDX = -0.1f;
    FLOAT fRDX = 0.9f;
    FLOAT fLDY = -0.3f;
    FLOAT fRDY = -0.3f;
    if (((CPlayer *)&*m_penPlayer)->m_pstState==PST_CROUCH) {
      fLDY = -0.1f;
      fRDY = -0.1f;
    }

    switch(m_iLaserBarrel) {
      case 0:   // barrel lu (*o-oo)
        CalcWeaponPosition(FLOAT3D(fFX+fLUX, fFY+fLUY, 0), plLaserRay, TRUE, TRUE);
        break;
      case 1:   // barrel ld (oo-*o)
        CalcWeaponPosition(FLOAT3D(fFX+fLDX, fFY+fLDY, 0), plLaserRay, TRUE, TRUE);
        break;
      case 2:   // barrel ru (o*-oo)
        CalcWeaponPosition(FLOAT3D(fFX+fRUX, fFY+fRUY, 0), plLaserRay, TRUE, TRUE);
        break;
      case 3:   // barrel rd (oo-o*)
        CalcWeaponPosition(FLOAT3D(fFX+fRDX, fFY+fRDY, 0), plLaserRay, TRUE, TRUE);
        break;
    }
    // create laser projectile
    CEntityPointer penLaser = CreateEntity(plLaserRay, CLASS_PROJECTILE);
    // init and launch laser projectile
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.prtType = PRT_LASER_RAY;
    penLaser->Initialize(eLaunch);
  };

  // fire cannon ball
  void FireCannonBall(INDEX iPower) {
    // cannon ball start position
    CPlacement3D plBall;
    CalcWeaponPosition(
      FLOAT3D(wpn_fFX[WEAPON_IRONCANNON],wpn_fFY[WEAPON_IRONCANNON], 0), 
      plBall, TRUE, TRUE);
    // create cannon ball
    CEntityPointer penBall = CreateEntity(plBall, CLASS_CANNONBALL);
    // init and launch cannon ball
    ELaunchCannonBall eLaunch;
    eLaunch.penLauncher = m_penPlayer;
    eLaunch.fLaunchPower = 60.0f+iPower*4.0f; // ranges from 60-140 (since iPower can be max 20)
    eLaunch.fSize = 3.0f;
    eLaunch.cbtType = CBT_IRON;
    penBall->Initialize(eLaunch);
  };

  // weapon sound when firing
  void SpawnRangeSound( FLOAT fRange)
  {
    if( _pTimer->CurrentTick()>m_tmRangeSoundSpawned+0.5f) {
      m_tmRangeSoundSpawned = _pTimer->CurrentTick();
      ::SpawnRangeSound( m_penPlayer, m_penPlayer, SNDT_PLAYER, fRange);
    }
  };


  /*
   *  >>>---  WEAPON INTERFACE FUNCTIONS  ---<<<
   */
  // clear weapons
  void ClearWeapons(void) {
    m_iAvailableWeapons = StartWeapons();

    for (INDEX iAmmo = 0; iAmmo < 11; iAmmo++) {
      (&m_iUSP)[iAmmo] = 0;
    }
  };

  void ResetWeaponMovingOffset(void) {
    // reset weapon draw offset
    m_fWeaponDrawPowerOld = m_fWeaponDrawPower = m_tmDrawStartTime = 0;
  };

  // [Cecil] World change flag
  // initialize weapons
  void InitializeWeapons(INDEX iGiveWeapons, INDEX iTakeWeapons, INDEX iTakeAmmo, FLOAT fMaxAmmoRatio, BOOL bWorldChange) {
    // [Cecil] Moved from below
    ULONG ulOldWeapons = 0;
    ULONG ulNewWeapons = 0;
    ResetWeaponMovingOffset();

    // [Cecil] Patch the weapon flags
    PatchWeaponFlags(iGiveWeapons);
    PatchWeaponFlags(iTakeWeapons);

    // [Cecil] Gamemode is active
    INDEX iMode = GetSP()->sp_iHLGamemode;
    if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
      iGiveWeapons = 0;
      iTakeWeapons = 0;
      iTakeAmmo = 0;
      fMaxAmmoRatio = 1.0f;

      m_iAvailableWeapons = WeaponFlag(GamemodeWeapon(iMode))
                          | WeaponFlag(WEAPON_CROWBAR);

      switch (iMode) {
        case HLGM_ARMSRACE:
          m_iAvailableWeapons &= WEAPONS_ALLAVAILABLEMASK;
          // set all ammo
          ulNewWeapons = WEAPONS_ALLAVAILABLEMASK;
          break;

        default: {
          m_iAvailableWeapons &= WEAPONS_ALLAVAILABLEMASK;
          ulNewWeapons = m_iAvailableWeapons & ~ulOldWeapons;
        }
      }

      // reset all mags
      ResetMags();

    } else {
      // [Cecil] Take the starting weapons
      if (StartWeapons() >= 0) {
        if (!WeaponExists(StartWeapons(), WEAPON_CROWBAR)) {
          iGiveWeapons &= ~WeaponFlag(WEAPON_CROWBAR);
        }
        if (!WeaponExists(StartWeapons(), WEAPON_PISTOL)) {
          iGiveWeapons &= ~WeaponFlag(WEAPON_PISTOL);
        }
      }

      // remember old weapons
      ulOldWeapons = m_iAvailableWeapons;

      // [Cecil] Exclude default ones if just respawning
      if (!bWorldChange) {
        ulOldWeapons &= ~StartWeapons();
      }

      // give/take weapons
      m_iAvailableWeapons &= ~iTakeWeapons;
      m_iAvailableWeapons |= StartWeapons()|iGiveWeapons;
      m_iAvailableWeapons &= WEAPONS_ALLAVAILABLEMASK;

      // find which weapons are new
      ulNewWeapons = m_iAvailableWeapons;

      // [Cecil] All weapons are new in deathmatch
      if (!GetSP()->sp_bCooperative) {
        ulNewWeapons &= ~ulOldWeapons;
        
        // reset all mags
        ResetMags();

      } else {
        // reset certain mags
        ResetMags(ulNewWeapons);
      }
    }

    // [Cecil] Reset ammo
    ResetMaxAmmo();

    // for each new weapon
    for (INDEX iWeapon = WEAPON_CROWBAR; iWeapon < WEAPON_LAST; iWeapon++) {
      if (WeaponExists(ulNewWeapons, iWeapon)) {
        // add default amount of ammo
        AddDefaultAmmoForWeapon(iWeapon, fMaxAmmoRatio);
      }
    }

    // [Cecil] New ammo system
    // Take ammo
    for (INDEX iTake = 0; iTake < 11; iTake++) {
      INDEX iAmmoBit = _aiTakeAmmo[iTake];

      if (iAmmoBit == -1) {
        continue;
      }

      if (iTakeAmmo & iAmmoBit) {
        (&m_iUSP)[iTake] = 0;
      }
    }

    // Take mag
    for (INDEX iWeapMag = WEAPON_NONE; iWeapMag < WEAPON_LAST; iWeapMag++) {
      INDEX iMagBit = _aiTakeWeaponAmmo[iWeapMag-1];

      if (iMagBit == -1) {
        continue;
      }

      if (iTakeAmmo & iMagBit) {
        if (WeaponExists(iGiveWeapons, iWeapMag) || WeaponExists(m_iAvailableWeapons, iWeapMag)) {
          switch (iWeapMag) {
            case WEAPON_357:      m_i357_Mag = 0; break;
            case WEAPON_SMG1:     m_iSMG1_Mag = 0; break;
            case WEAPON_AR2:      m_iAR2_Mag = 0; break;
            case WEAPON_SPAS:     m_iSPAS_Mag = 0; break;
            case WEAPON_CROSSBOW: m_iCrossbow_Mag = 0; break;
            case WEAPON_RPG:      m_iRPG_Mag = 0; break;
          }
        }
      }
    }

    // precache eventual new weapons
    Precache();

    // select best weapon
    SelectNewWeapon();
    m_iCurrentWeapon = m_iWantedWeapon;
    wpn_iCurrent = m_iCurrentWeapon;
    m_bChangeWeapon = FALSE;

    // set weapon model for current weapon
    SetCurrentWeaponModel();
    PlayDefaultAnim();

    // readd weapon attachment
    ((CPlayerAnimator&)*((CPlayer&)*m_penPlayer).m_penAnimator).RemoveWeapon();
    ((CPlayerAnimator&)*((CPlayer&)*m_penPlayer).m_penAnimator).SetWeapon();
  };

  // get weapon ammo
  INDEX *GetAmmo(void) {
    switch (m_iCurrentWeapon) {
      case WEAPON_PISTOL:   return &m_iUSP;
      case WEAPON_357:      return &m_i357;
      case WEAPON_SPAS:     return &m_iSPAS;
      case WEAPON_SMG1:     return &m_iSMG1;
      case WEAPON_AR2:      return &m_iAR2;
      case WEAPON_RPG:      return &m_iRPG;
      case WEAPON_GRENADE:  return &m_iGrenades;
      case WEAPON_CROSSBOW: return &m_iCrossbow;
      case WEAPON_G3SG1:    return &m_iCSSSniper;
    }

    return NULL;
  };
  INDEX GetAmmo(INDEX iWeapon) {
    switch (iWeapon) {
      case WEAPON_PISTOL:   return m_iUSP;
      case WEAPON_357:      return m_i357;
      case WEAPON_SPAS:     return m_iSPAS;
      case WEAPON_SMG1:     return m_iSMG1;
      case WEAPON_AR2:      return m_iAR2;
      case WEAPON_RPG:      return m_iRPG;
      case WEAPON_GRENADE:  return m_iGrenades;
      case WEAPON_CROSSBOW: return m_iCrossbow;
      case WEAPON_G3SG1:    return m_iCSSSniper;
    }

    return 1;
  };

  // get weapon max ammo (capacity)
  INDEX *GetMaxAmmo(void) {
    switch (m_iCurrentWeapon) {
      case WEAPON_PISTOL:   return &m_iUSP_Max;
      case WEAPON_357:      return &m_i357_Max;
      case WEAPON_SPAS:     return &m_iSPAS_Max;
      case WEAPON_SMG1:     return &m_iSMG1_Max;
      case WEAPON_AR2:      return &m_iAR2_Max;
      case WEAPON_RPG:      return &m_iRPG_Max;
      case WEAPON_GRENADE:  return &m_iGrenades_Max;
      case WEAPON_CROSSBOW: return &m_iCrossbow_Max;
      case WEAPON_G3SG1:    return &m_iCSSSniper_Max;
    }

    return NULL;
  };
  INDEX GetMaxAmmo(INDEX iWeapon) {
    switch (iWeapon) {
      case WEAPON_PISTOL:   return m_iUSP_Max;
      case WEAPON_357:      return m_i357_Max;
      case WEAPON_SPAS:     return m_iSPAS_Max;
      case WEAPON_SMG1:     return m_iSMG1_Max;
      case WEAPON_AR2:      return m_iAR2_Max;
      case WEAPON_RPG:      return m_iRPG_Max;
      case WEAPON_GRENADE:  return m_iGrenades_Max;
      case WEAPON_CROSSBOW: return m_iCrossbow_Max;
      case WEAPON_G3SG1:    return m_iCSSSniper_Max;
    }

    return 1;
  };

  // [Cecil] Get alt weapon ammo
  INDEX *GetAltAmmo(const INDEX &iWeapon) {
    switch (iWeapon) {
      case WEAPON_SMG1: return &m_iSMG1_Grenades;
      case WEAPON_AR2:  return &m_iAR2_EnergyBalls;
    }

    return NULL;
  };
  INDEX GetAltAmmoCount(const INDEX &iWeapon) {
    INDEX *iAmmo = GetAltAmmo(iWeapon);
    if (iAmmo == NULL) {
      return 0;
    }
    return *iAmmo;
  };

  INDEX *GetMaxAltAmmo(const INDEX &iWeapon) {
    switch (iWeapon) {
      case WEAPON_SMG1: return &m_iSMG1_Grenades_Max;
      case WEAPON_AR2:  return &m_iAR2_EnergyBalls_Max;
    }

    return NULL;
  };

  void CheatOpen(void) {
    if (IsOfClass(m_penRayHit, "Moving Brush")) {
      m_penRayHit->SendEvent(ETrigger());
    }
  }

  // cheat give all
  void CheatGiveAll(void) {
    // all weapons
    m_iAvailableWeapons = WEAPONS_ALLAVAILABLEMASK;

    // [Cecil] Remove Double Shotgun
    if (m_iAvailableWeapons & 16) {
      m_iAvailableWeapons &= ~16;
      m_iAvailableWeapons |= 8;
    }

    for (INDEX iAmmo = 0; iAmmo < 11; iAmmo++) {
      (&m_iUSP)[iAmmo] = (&m_iUSP_Max)[iAmmo];
    }

    Precache();
  };

  // add a given amount of mana to the player
  void AddManaToPlayer(INDEX iMana) {
    ((CPlayer&)*m_penPlayer).m_iMana += iMana;
    ((CPlayer&)*m_penPlayer).m_fPickedMana += iMana;
  };

  /*
   *  >>>---  RECEIVE FUNCTIONS  ---<<<
   */

  // clamp ammounts of all ammunition to maximum values
  void ClampAllAmmo(void) {
    for (INDEX iAmmo = 0; iAmmo < 11; iAmmo++) {
      (&m_iUSP)[iAmmo] = ClampUp((&m_iUSP)[iAmmo], (&m_iUSP_Max)[iAmmo]);
    }
  };

  // add default ammount of ammunition when receiving a weapon
  BOOL AddDefaultAmmoForWeapon(INDEX iWeapon, FLOAT fMaxAmmoRatio) {
    FLOAT fMul = GetSP()->sp_fAmmoQuantity;

    // [Cecil] Remember last ammo
    INDEX aiLastAmmo[11];
    INDEX i;

    for (i = 0; i < 11; i++) {
      aiLastAmmo[i] = (&m_iUSP)[i];
    }

    switch (iWeapon) {
      // unlimited ammo
      case WEAPON_CROWBAR:
      case WEAPON_GRAVITYGUN:
        break;

      case WEAPON_PISTOL:
        m_iUSP += Max(_aiMaxMag[MAG_USP] * fMul, m_iUSP_Max * fMaxAmmoRatio);
        break;

      case WEAPON_SPAS:
        m_iSPAS += Max(_aiMaxMag[MAG_SPAS] * fMul, m_iSPAS_Max * fMaxAmmoRatio);
        break;

      case WEAPON_SMG1:
        m_iSMG1 += Max(_aiMaxMag[MAG_SMG1] * fMul, m_iSMG1_Max * fMaxAmmoRatio);
        break;

      case WEAPON_CROSSBOW:
        m_iCrossbow += Max(2.0f * fMul, m_iCrossbow_Max * fMaxAmmoRatio);

        // [Cecil] TEMP
        if (WeaponExists(m_iAvailableWeapons, WEAPON_G3SG1)) {
          m_iCSSSniper += Max(_aiMaxMag[MAG_G3SG1] * fMul, m_iCSSSniper_Max * fMaxAmmoRatio);
        }
        break;

      case WEAPON_G3SG1:
        m_iCSSSniper += Max(_aiMaxMag[MAG_G3SG1] * fMul, m_iCSSSniper_Max * fMaxAmmoRatio);
        break;

      case WEAPON_GRENADE:
        m_iGrenades += Max(1.0f * fMul, m_iGrenades_Max * fMaxAmmoRatio);
        break;

      case WEAPON_AR2:
      case WEAPON_LASER:
        m_iAR2 += Max(_aiMaxMag[MAG_AR2] * fMul, m_iAR2_Max * fMaxAmmoRatio);
        break;

      case WEAPON_RPG:
      case WEAPON_IRONCANNON:
        m_iRPG += Max(_aiMaxMag[MAG_RPG] * fMul, m_iRPG_Max * fMaxAmmoRatio);
        break;

      case WEAPON_FLAMER:
      case WEAPON_357:
        m_i357 += Max(_aiMaxMag[MAG_357] * fMul, m_i357_Max * fMaxAmmoRatio);
        break;
    }

    // make sure we don't have more ammo than maximum
    ClampAllAmmo();

    // [Cecil] Check if any ammo has been added
    for (i = 0; i < 11; i++) {
      if ((&m_iUSP)[i] != aiLastAmmo[i]) {
        return TRUE;
      }
    }

    // [Cecil] No new ammo added
    return FALSE;
  }

  // drop current weapon (in deathmatch)
  void DropWeapon(void) {
    // [Cecil] Gamemode-specific
    INDEX iMode = GetSP()->sp_iHLGamemode;
    switch (iMode) {
      case HLGM_ARMSRACE:
      case HLGM_DISSOLVE:
      case HLGM_BUNNYHUNT:
      case HLGM_MINEKILL:
      case HLGM_FLYROCKET:
        return;
    }

    // [Cecil] No weapon
    if (m_iCurrentWeapon == WEAPON_NONE) {
      return;
    }

    CEntityPointer penWeapon = CreateEntity(GetPlayer()->GetPlacement(), CLASS_WEAPONITEM);
    CWeaponItem *pwi = (CWeaponItem*)&*penWeapon;

    WeaponItemType wit = WIT_CROWBAR; // [Cecil]

    switch (m_iCurrentWeapon) {
      default:
        ASSERT(FALSE);
      case WEAPON_CROWBAR: wit = WIT_CROWBAR; break;
      case WEAPON_PISTOL: wit = WIT_USP; break;
      case WEAPON_357: wit = WIT_357; break;
      case WEAPON_SPAS: wit = WIT_SPAS; break;
      case WEAPON_SMG1: wit = WIT_SMG1; break;
      case WEAPON_AR2: wit = WIT_AR2; break;
      case WEAPON_RPG: wit = WIT_RPG; break;
      case WEAPON_GRENADE: wit = WIT_GRENADE; break;
      case WEAPON_CROSSBOW: wit = WIT_CROSSBOW; break;
      case WEAPON_GRAVITYGUN: wit = WIT_GRAVITYGUN; break;
      case WEAPON_G3SG1: wit = WIT_CROSSBOW; break;

      case WEAPON_FLAMER: wit = WIT_357; break;
      case WEAPON_LASER : wit = WIT_AR2; break;
      case WEAPON_IRONCANNON : wit = WIT_RPG; break;
    }

    pwi->m_EwitType = wit;
    pwi->m_bDropped = TRUE;
    pwi->CEntity::Initialize();
    
    const FLOATmatrix3D &m = GetPlayer()->GetRotationMatrix();
    FLOAT3D vSpeed = FLOAT3D(5.0f, 10.0f, -7.5f);
    pwi->GiveImpulseTranslationAbsolute(vSpeed*m);
  }

  // receive weapon
  BOOL ReceiveWeapon(const CEntityEvent &ee) {
    ASSERT(ee.ee_slEvent == EVENTCODE_EWeaponItem);
    
    EWeaponItem &Ewi = (EWeaponItem&)ee;
    INDEX wit = Ewi.iWeapon;

    // [Cecil] Corrected weapons
    switch (GetSP()->sp_iHLGamemode) {
      case HLGM_BUNNYHUNT: wit = WEAPON_G3SG1; break;
      case HLGM_MINEKILL: wit = WEAPON_GRAVITYGUN; break;
      case HLGM_FLYROCKET: wit = WEAPON_RPG; break;

      default: {
        switch (wit) {
          case WIT_CROWBAR: wit = WEAPON_CROWBAR; break;
          case WIT_GRAVITYGUN: wit = WEAPON_GRAVITYGUN; break;
          case WIT_USP: wit = WEAPON_PISTOL; break;
          case WIT_357: wit = WEAPON_357; break;
          case WIT_SPAS: wit = WEAPON_SPAS; break;
          case WIT_SMG1: wit = WEAPON_SMG1; break;
          case WIT_GRENADE: wit = WEAPON_GRENADE; break;
          case WIT_CROSSBOW: wit = WEAPON_CROSSBOW; break;
          case WIT_AR2: wit = WEAPON_AR2; break;
          case WIT_RPG: wit = WEAPON_RPG; break;
        }
      }
    }

    // must be -1 for default (still have to implement dropping weapons in deathmatch !!!!)
    ASSERT(Ewi.iAmmo == -1);

    ULONG ulOldWeapons = m_iAvailableWeapons;
    const ULONG ulWeaponFlag = (1 << (wit - 1));

    // [Cecil] Try to add ammunition and bail if nothing has been added (max ammo)
    if (!AddDefaultAmmoForWeapon(wit, 0)) {
      // Don't pickup this weapon if it already exists
      if (ulOldWeapons & ulWeaponFlag) {
        return FALSE;
      }
    }

    // add weapon
    m_iAvailableWeapons |= ulWeaponFlag;

    // precache eventual new weapons
    Precache();

    // [Cecil] Report picked grenades, just like other ammo
    if (wit == WEAPON_GRENADE) {
      GetPlayer()->ItemPicked(TRANS("Grenades"), 1);
    }

    // [Cecil] Reload weapons
    switch (m_iCurrentWeapon) {
      case WEAPON_GRENADE:
        if (m_iGrenades > 0 && GetCurrentAnim(m_moWeapon, 0) == GRENADE_ANIM_DEFAULT) {
          AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAW, 0);
        }
        break;

      default: {
        if (EMPTY_MAG) {
          SendEvent(EReloadWeapon());
        }
      }
    }

    // if this weapon should be auto selected
    BOOL bAutoSelect = FALSE;
    INDEX iSelectionSetting = GetPlayer()->GetSettings()->ps_iWeaponAutoSelect;

    if (iSelectionSetting == PS_WAS_ALL) {
      bAutoSelect = TRUE;
    } else if (iSelectionSetting == PS_WAS_ONLYNEW) {
      if (m_iAvailableWeapons&~ulOldWeapons) {
        bAutoSelect = TRUE;
      }
    } else if (iSelectionSetting == PS_WAS_BETTER) {
      if (FindRemapedPos(m_iCurrentWeapon) < FindRemapedPos((WeaponType)Ewi.iWeapon)) {
        bAutoSelect = TRUE;
      }
    }

    // [Cecil] Select anyway if holding nothing
    if (bAutoSelect || m_iCurrentWeapon == WEAPON_NONE) {
      // select it
      if (WeaponSelectOk((WeaponType)Ewi.iWeapon)) {
        SendEvent(EBegin());
      }
    }

    // [Cecil]
    PlaySound(GetPlayer()->m_soAmmo, SOUND_AMMO, SOF_3D|SOF_VOLUMETRIC);

    return TRUE;
  };

  // receive ammo
  BOOL ReceiveAmmo(const CEntityEvent &ee) {
    ASSERT(ee.ee_slEvent == EVENTCODE_EAmmoItem);
    
    EAmmoItem &Eai = (EAmmoItem&)ee;
    CPlayer &pl = (CPlayer&)*m_penPlayer;

    // add ammo
    switch (Eai.EaitType) {
      // [Cecil] Give two kinds of bullets for compatibility
      case AIT_BULLETS: {
        EAmmoItem eaiBullets;
        eaiBullets.EaitType = AIT_SMG1;
        eaiBullets.iQuantity = Eai.iQuantity;
        const BOOL bSMG1 = ReceiveAmmo(eaiBullets);

        eaiBullets.EaitType = AIT_USP;
        eaiBullets.iQuantity = ceil((FLOAT)Eai.iQuantity / 2.5f); // 45 / 18 = 2.5
        const BOOL bUSP = ReceiveAmmo(eaiBullets);

        if (!bSMG1 && !bUSP) {
          return FALSE;
        }
      } break;

      case AIT_SMG1: {
        // [Cecil] Give alt ammo while fighting an air elemental
        if (BossActive()) {
          EAmmoItem eaiAlt;
          eaiAlt.EaitType = AIT_MP7GRENADES;
          eaiAlt.iQuantity = 1;
          ReceiveAmmo(eaiAlt);
        }

        if (m_iSMG1 >= m_iSMG1_Max) {
          return FALSE;
        }
        m_iSMG1 += Eai.iQuantity;

        pl.ItemPicked(TRANS("Bullets"), Eai.iQuantity);
      } break;

      // [Cecil] USP bullets
      case AIT_USP: {
        if (m_iUSP >= m_iUSP_Max) {
          return FALSE;
        }
        m_iUSP += Eai.iQuantity;

        pl.ItemPicked(TRANS("USP Bullets"), Eai.iQuantity);
      } break;

      case AIT_SPAS: {
        if (m_iSPAS >= m_iSPAS_Max) {
          return FALSE;
        }
        m_iSPAS += Eai.iQuantity;

        pl.ItemPicked(TRANS("Shells"), Eai.iQuantity);
      } break;

      case AIT_GRENADES: { // Grenades
        // [Cecil] Give the weapon instead
        EWeaponItem eWeapon;
        eWeapon.iWeapon = WIT_GRENADE;
        return ReceiveWeapon(eWeapon);

        /*if (m_iGrenades >= m_iGrenades_Max) {
          return FALSE;
        }
        m_iGrenades += Eai.iQuantity;

        pl.ItemPicked(TRANS("Grenades"), Eai.iQuantity);*/
      } break;

      case AIT_AR2: {
        // [Cecil] Give alt ammo while fighting an air elemental
        if (BossActive()) {
          EAmmoItem eaiAlt;
          eaiAlt.EaitType = AIT_ENERGYBALLS;
          eaiAlt.iQuantity = 1;
          ReceiveAmmo(eaiAlt);
        }

        if (m_iAR2 >= m_iAR2_Max) {
          return FALSE;
        }
        m_iAR2 += Eai.iQuantity;

        pl.ItemPicked(TRANS("Cores"), Eai.iQuantity);
      } break;

      case AIT_357: {
        if (m_i357 >= m_i357_Max) {
          return FALSE;
        }
        m_i357 += Eai.iQuantity;

        pl.ItemPicked(TRANS("Rounds"), Eai.iQuantity);
      } break;

      case AIT_BOLTS: {
        // [Cecil] TEMP
        BOOL bPicked = FALSE;
        if (WeaponExists(m_iAvailableWeapons, WEAPON_G3SG1) && m_iCSSSniper < m_iCSSSniper_Max) {
          m_iCSSSniper += ceil(FLOAT(Eai.iQuantity) / 0.15f);
          bPicked = TRUE;
        }

        if (!bPicked && m_iCrossbow >= m_iCrossbow_Max) {
          return FALSE;
        }
        m_iCrossbow += Eai.iQuantity;

        pl.ItemPicked(TRANS("Crossbow Rods"), Eai.iQuantity);
      } break;

      case AIT_RPG: {
        if (m_iRPG >= m_iRPG_Max) {
          return FALSE;
        }
        m_iRPG += Eai.iQuantity;

        pl.ItemPicked(TRANS("Rockets"), Eai.iQuantity);
      } break;

      // [Cecil] MP7 grenades
      case AIT_MP7GRENADES: {
        if (m_iSMG1_Grenades >= m_iSMG1_Grenades_Max) {
          return FALSE;
        }

        if (m_iSMG1_Grenades < m_iSMG1_Grenades_Max) {
          m_iSMG1_Grenades += Eai.iQuantity;
        }

        pl.ItemPicked(TRANS("MP7 Grenades"), Eai.iQuantity);
      } break;

      // [Cecil] Energy balls
      case AIT_ENERGYBALLS: {
        if (m_iAR2_EnergyBalls >= m_iAR2_EnergyBalls_Max) {
          return FALSE;
        }

        if (m_iAR2_EnergyBalls < m_iAR2_EnergyBalls_Max) {
          m_iAR2_EnergyBalls += Eai.iQuantity;
        }

        pl.ItemPicked(TRANS("Energy Balls"), Eai.iQuantity);
      } break;

      case AIT_BACKPACK:
      case AIT_SERIOUSPACK:
        break;
    }

    // [Cecil]
    PlaySound(pl.m_soAmmo, SOUND_AMMO, SOF_3D|SOF_VOLUMETRIC);

    // [Cecil] Reload weapons
    switch (m_iCurrentWeapon) {
      case WEAPON_GRENADE:
        if (m_iGrenades > 0 && GetCurrentAnim(m_moWeapon, 0) == GRENADE_ANIM_DEFAULT) {
          AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAW, 0);
        }
        break;

      default: {
        if (EMPTY_MAG) {
          SendEvent(EReloadWeapon());
        }
      }
    }

    // make sure we don't have more ammo than maximum
    ClampAllAmmo();
    return TRUE;
  };

  // receive ammo
  BOOL ReceivePackAmmo(const CEntityEvent &ee) {
    // if infinite ammo is on
    if (GetSP()->sp_bInfiniteAmmo) {
      // pick all items anyway (items that exist in this mode are only those that
      // trigger something when picked - so they must be picked)
      return TRUE;
    }

    ASSERT(ee.ee_slEvent == EVENTCODE_EAmmoPackItem);
    EAmmoPackItem &eapi = (EAmmoPackItem &)ee;
    CPlayer &pl = (CPlayer&)*m_penPlayer;

    // [Cecil] Bullets
    FLOAT iNewCores = (eapi.iElectricity + eapi.iRockets);

    // [Cecil] TEMP
    BOOL bG3SG1 = (WeaponExists(m_iAvailableWeapons, WEAPON_G3SG1) && m_iCSSSniper < m_iCSSSniper_Max);

    if((eapi.iShells > 0        && m_iSPAS < m_iSPAS_Max) ||
       (eapi.iBullets > 0       && (m_iUSP < m_iUSP_Max || m_iSMG1 < m_iSMG1_Max)) ||
       (eapi.iGrenades > 0      && m_iGrenades < m_iGrenades_Max) ||
       (eapi.iNapalm > 0        && m_i357 < m_i357_Max) ||
       (iNewCores > 0           && m_iAR2 < m_iAR2_Max) ||
       (eapi.iIronBalls > 0     && m_iRPG < m_iRPG_Max) ||
       (eapi.iSniperBullets > 0 && (bG3SG1 || m_iCrossbow < m_iCrossbow_Max)))
    {
      // add ammo from back pack
      m_iUSP += ceil(FLOAT(eapi.iBullets) / 2.5f); // 45 / 18 = 2.5
      m_iSMG1 += eapi.iBullets;
      m_iSPAS += eapi.iShells;
      m_iGrenades += eapi.iGrenades;
      m_i357 += eapi.iNapalm;
      m_iAR2 += iNewCores;
      m_iRPG += eapi.iIronBalls;
      m_iCrossbow += eapi.iSniperBullets;
      m_iCSSSniper += ceil(FLOAT(eapi.iSniperBullets) / 0.15f);

      // [Cecil] Alt ammo for the boss
      BOOL bBullets = (eapi.iBullets > 0);
      BOOL bCores = (iNewCores > 0);

      if (bBullets || bCores) {
        if (BossActive()) {
          // Grenades
          if (bBullets) {
            EAmmoItem eaiAlt;
            eaiAlt.EaitType = AIT_MP7GRENADES;
            eaiAlt.iQuantity = 1;
            ReceiveAmmo(eaiAlt);
          }

          // Energy Balls
          if (bCores) {
            EAmmoItem eaiAlt;
            eaiAlt.EaitType = AIT_ENERGYBALLS;
            eaiAlt.iQuantity = 1;
            ReceiveAmmo(eaiAlt);
          }
        }
      }

      // [Cecil] Reload weapons
      switch (m_iCurrentWeapon) {
        case WEAPON_GRENADE:
          if (m_iGrenades > 0 && GetCurrentAnim(m_moWeapon, 0) == GRENADE_ANIM_DEFAULT) {
            AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAW, 0);
          }
          break;

        default: {
          if (EMPTY_MAG) {
            SendEvent(EReloadWeapon());
          }
        }
      }

      // make sure we don't have more ammo than maximum
      ClampAllAmmo();

      // preapare message string and count different types of ammo
      CTString strMessage;
      strMessage.PrintF(TRANS("Ammo crate"));
      pl.ItemPicked(strMessage, 0);
      
      // [Cecil]
      PlaySound(pl.m_soAmmo, SOUND_AMMO, SOF_3D|SOF_VOLUMETRIC);

      return TRUE;
    }
    return FALSE;
  };

  /*
   *  >>>---  WEAPON CHANGE FUNCTIONS  ---<<<
   */
  // get weapon from selected number
  WeaponType GetStrongerWeapon(INDEX iWeapon) {
    switch(iWeapon) {
      case 1: return WEAPON_CROWBAR;
      case 2: return WEAPON_PISTOL;
      case 3: return WEAPON_SMG1;
      case 4: return WEAPON_SPAS;
      case 5: return WEAPON_GRENADE;
      case 6: return WEAPON_FLAMER;
    }
    return WEAPON_NONE;
  };

  // get selected number for weapon
  INDEX GetSelectedWeapon(WeaponType eSelectedWeapon) {
    switch (eSelectedWeapon) {
      case WEAPON_CROWBAR: case WEAPON_GRAVITYGUN: return 1;
      case WEAPON_PISTOL: case WEAPON_357: return 2;
      case WEAPON_SMG1: case WEAPON_AR2: return 3;
      case WEAPON_SPAS: case WEAPON_CROSSBOW: case WEAPON_G3SG1: return 4;
      case WEAPON_GRENADE: case WEAPON_RPG: return 5;

      case WEAPON_FLAMER:
      case WEAPON_LASER:
      case WEAPON_IRONCANNON: return 6;
    }

    return 0;
  };

  // get secondary weapon from selected one
  WeaponType GetAltWeapon(WeaponType eWeapon) {
    switch (eWeapon) {
      case WEAPON_CROWBAR: return WEAPON_GRAVITYGUN;
      case WEAPON_GRAVITYGUN: return WEAPON_CROWBAR;

      case WEAPON_PISTOL: return WEAPON_357;
      case WEAPON_357: return WEAPON_PISTOL;

      case WEAPON_SMG1: return WEAPON_AR2;
      case WEAPON_AR2: return WEAPON_SMG1;

      case WEAPON_SPAS: return WEAPON_CROSSBOW;
      case WEAPON_CROSSBOW: return WEAPON_G3SG1;
      case WEAPON_G3SG1: return WEAPON_SPAS;

      case WEAPON_GRENADE: return WEAPON_RPG;
      case WEAPON_RPG: return WEAPON_GRENADE;

      case WEAPON_FLAMER: return WEAPON_LASER;
      case WEAPON_LASER: return WEAPON_IRONCANNON;
      case WEAPON_IRONCANNON: return WEAPON_FLAMER;
    }

    return WEAPON_NONE;
  };

  // select new weapon if possible
  BOOL WeaponSelectOk(WeaponType wtToTry) {
    // [Cecil] Always pick nothing
    if (wtToTry == WEAPON_NONE) {
      m_iWantedWeapon = WEAPON_NONE;
      m_bChangeWeapon = TRUE;
      return TRUE;
    }

    // if player has weapon and has enough ammo
    if ((1 << (INDEX(wtToTry) - 1)) & m_iAvailableWeapons && HAS_AMMO(wtToTry)) {
      // if different weapon
      if (wtToTry != m_iCurrentWeapon) {
        // initiate change
        m_iWantedWeapon = wtToTry;
        m_bChangeWeapon = TRUE;
      }
      // selection ok
      return TRUE;
    }

    return FALSE;
  };

  // select new weapon when no more ammo
  BOOL SelectNewWeapon(void) {
    // [Cecil] Gamemode weapons
    INDEX iMode = GetSP()->sp_iHLGamemode;
    if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
      return WeaponSelectOk(GamemodeWeapon(iMode))
          || WeaponSelectOk(WEAPON_CROWBAR)
          || WeaponSelectOk(WEAPON_NONE);
    }

    switch (m_iCurrentWeapon) {
      case WEAPON_NONE: case WEAPON_G3SG1: case WEAPON_FLAMER: case WEAPON_LASER: case WEAPON_IRONCANNON:
      case WEAPON_CROWBAR: case WEAPON_PISTOL: case WEAPON_357: 
      case WEAPON_SPAS: case WEAPON_CROSSBOW: case WEAPON_GRAVITYGUN:
      case WEAPON_SMG1: case WEAPON_AR2:
        return
          WeaponSelectOk(WEAPON_AR2) ||
          WeaponSelectOk(WEAPON_SMG1) ||
          WeaponSelectOk(WEAPON_SPAS) ||
          WeaponSelectOk(WEAPON_357) ||
          WeaponSelectOk(WEAPON_PISTOL) ||
          WeaponSelectOk(WEAPON_GRAVITYGUN) ||
          WeaponSelectOk(WEAPON_CROWBAR) ||
          WeaponSelectOk(WEAPON_NONE);

      case WEAPON_RPG:
      case WEAPON_GRENADE:
        return
          WeaponSelectOk(WEAPON_RPG) ||
          WeaponSelectOk(WEAPON_GRENADE) ||
          WeaponSelectOk(WEAPON_AR2) ||
          WeaponSelectOk(WEAPON_SMG1) ||
          WeaponSelectOk(WEAPON_SPAS) ||
          WeaponSelectOk(WEAPON_357) ||
          WeaponSelectOk(WEAPON_PISTOL) ||
          WeaponSelectOk(WEAPON_GRAVITYGUN) ||
          WeaponSelectOk(WEAPON_CROWBAR) ||
          WeaponSelectOk(WEAPON_NONE);
    }

    return WeaponSelectOk(WEAPON_NONE);
  };

  /*
   *  >>>---   DEFAULT ANIM   ---<<<
   */
  void PlayDefaultAnim(void) {
    // [Cecil] Reset object picking
    m_bCanPickObjects = FALSE;

    switch(m_iCurrentWeapon) {
      case WEAPON_NONE:
        break;

      case WEAPON_CROWBAR:
        AttachAnim(m_moWeapon, 0, 1, -1, CROWBAR_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_PISTOL:
        AttachAnim(m_moWeapon, 0, 1, -1, (EMPTY_MAG ? PISTOL_ANIM_IDLEEMPTY : PISTOL_ANIM_IDLE), AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_357:
        AttachAnim(m_moWeapon, 0, 1, -1, MAGNUM_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_SPAS:
        AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_SMG1:
        AttachAnim(m_moWeapon, 0, 1, -1, SMG1_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_CROSSBOW:
        AttachAnim(m_moWeapon, 0, 1, -1, (!EMPTY_MAG ? CROSSBOW_ANIM_IDLE : CROSSBOW_ANIM_IDLEEMPTY), AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_G3SG1:
        AttachAnim(m_moWeapon, 0, 1, -1, CSS_SNIPER_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_AR2:
        m_moWeapon.PlayAnim(AR2_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_RPG:
        AttachAnim(m_moWeapon, 0, 1, -1, (!EMPTY_MAG || *GetAmmo() > 0) ? RPG_ANIM_IDLE : RPG_ANIM_DOWNIDLE, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_GRENADE:
        AttachAnim(m_moWeapon, 0, 1, -1, (*GetAmmo() > 0) ? GRENADE_ANIM_IDLE : GRENADE_ANIM_DEFAULT, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_FLAMER:
        m_moWeapon.PlayAnim(FLAMER_ANIM_WAIT01, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_GRAVITYGUN:
        if (HeldObject().IsSynced()) {
          m_moWeapon.PlayAnim(GRAVITYGUN_ANIM_HOLD, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
          PlaySound(GetPlayer()->m_soWeaponReload, SOUND_GG_HOLD, SOF_3D|SOF_VOLUMETRIC|SOF_LOOP);
        } else {
          m_moWeapon.PlayAnim((m_bPickable ? GRAVITYGUN_ANIM_IDLEOPEN : GRAVITYGUN_ANIM_IDLE), AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        }

        // [Cecil] Can pick objects
        m_bCanPickObjects = TRUE;
        break;

      case WEAPON_LASER:
        m_moWeapon.PlayAnim(LASER_ANIM_WAIT01, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;

      case WEAPON_IRONCANNON:
        m_moWeapon.PlayAnim(CANNON_ANIM_WAIT01, AOF_LOOPING|AOF_NORESTART|AOF_SMOOTHCHANGE);
        break;
    }
  };

  // find the weapon position in the remap array
  WeaponType FindRemapedPos(WeaponType wt) {
    for (INDEX i = 0; i < 18; i++) {
      if (_aiWeaponsRemap[i] == wt) {
        return (WeaponType)i;
      }
    }
    ASSERT("Non-existant weapon in remap array!");
    return (WeaponType)0;
  };
  
  WeaponType FindWeaponInDirection(INDEX iDir) {
    INDEX wtOrg = FindRemapedPos(m_iWantedWeapon);
    INDEX wti = wtOrg;

    FOREVER {
      (INDEX&)wti += iDir;

      if (wti < 1) {
        wti = WEAPON_IRONCANNON;
      }
      if (wti > 14) {
        wti = WEAPON_CROWBAR;
      }

      if (wti == wtOrg) {
        break;
      }

      WeaponType wt = (WeaponType)_aiWeaponsRemap[wti];

      // [Cecil] Check ammo
      if ((1 << (wt - 1)) & m_iAvailableWeapons && HAS_AMMO(wt)) {
        return wt;
      }
    }
    return m_iWantedWeapon;
  }

  // select new weapon
  BOOL SelectWeaponChange(INDEX iSelect) {
    WeaponType EwtTemp;

    // [Cecil] No weapons
    if (m_iAvailableWeapons == 0) {
      return FALSE;
    }

    // if storing current weapon
    if (iSelect == 0) {
      m_bChangeWeapon = TRUE;
      m_iWantedWeapon = WEAPON_NONE;
      return TRUE;
    }

    // if restoring best weapon
    if (iSelect == -4) {
      return SelectNewWeapon();
    }

    // if flipping weapon
    if (iSelect == -3) {
      EwtTemp = GetAltWeapon(m_iWantedWeapon);

    // previous weapon
    } else if (iSelect == -2) {
      EwtTemp = FindWeaponInDirection(-1);

    // next weapon
    } else if (iSelect == -1) {
      EwtTemp = FindWeaponInDirection(+1);

    // if selecting directly
    } else {
      // flip current weapon
      if (iSelect == GetSelectedWeapon(m_iWantedWeapon)) {
        EwtTemp = GetAltWeapon(m_iWantedWeapon);

      // change to wanted weapon
      } else {
        EwtTemp = GetStrongerWeapon(iSelect);

        // if weapon don't exist or don't have ammo flip it
        if (!((1 << (EwtTemp - 1)) & m_iAvailableWeapons) || !HAS_AMMO(EwtTemp)) {
          EwtTemp = GetAltWeapon(EwtTemp);
        }
      }
    }

    // wanted weapon exist and has ammo
    BOOL bChange = ((1 << (EwtTemp - 1)) & m_iAvailableWeapons);

    if (bChange && HAS_AMMO(EwtTemp)) {
      m_iWantedWeapon = EwtTemp;
      m_bChangeWeapon = TRUE;
      return TRUE;
    }

    return FALSE;
  };

  BOOL SniperZoomDiscrete(INDEX iDirection, BOOL &bZoomChanged) {
    bZoomChanged = FALSE;

    // zoom in one zoom level
    if (iDirection > 0) {
      for (INDEX i = 0; i < iSniperDiscreteZoomLevels; i++) {
        if (afSniperZoom[i*2] < m_fSniperFOV) {
          m_fSniperFOV = afSniperZoom[i*2];
          m_fSniperFOVlast = m_fSniperFOV;
          bZoomChanged = TRUE;
          break;
        }
      }

    // zoom out one zoom level
    } else {
      for (INDEX i = iSniperDiscreteZoomLevels; i > 0; i--) {
        if (afSniperZoom[i*2] > m_fSniperFOV) {
          m_fSniperFOV = afSniperZoom[i*2];
          m_fSniperFOVlast = m_fSniperFOV; 
          bZoomChanged = TRUE;
          break;
        }
      }
    }

    if (m_fSniperFOV < 90.0f) { 
      m_iSniping = 1;
    } else {
      m_iSniping = 0;
    }

    return m_iSniping;
  };

  // [Cecil] CSS Sniper Zoom
  BOOL CSS_SniperZoomDiscrete(INDEX iDirection, BOOL &bZoomChanged, BOOL bLimitReset) {
    bZoomChanged = FALSE;

    // zoom in one zoom level
    if (iDirection > 0) {
      if (bLimitReset && m_iSniping >= _iCSSSniperZoomLevels) {
        m_iSniping = 0;
        m_fSniperFOV = 90.0f;
        m_fSniperFOVlast = m_fSniperFOV;
        bZoomChanged = TRUE;

      } else {
        m_fSniperFOV = _afCSSSniperZoom[m_iSniping*2];
        bZoomChanged = TRUE;
        m_iSniping++;
      }

    // zoom out one zoom level
    } else {
      if (bLimitReset && m_iSniping <= 1) {
        m_iSniping = 0;
        m_fSniperFOV = 90.0f;
        m_fSniperFOVlast = m_fSniperFOV;
        bZoomChanged = TRUE;

      } else {
        m_iSniping--;
        m_fSniperFOV = _afCSSSniperZoom[m_iSniping*2];
        bZoomChanged = TRUE;
      }
    }

    return m_iSniping;
  };

procedures:
  /*
   *  >>>---   WEAPON CHANGE PROCEDURE  ---<<<
   */
  ChangeWeapon() {
    // if really changing weapon, make sure sniping is off and notify owner of the change
    if (m_iCurrentWeapon != m_iWantedWeapon) {
      SnipingOff(); // [Cecil]
    }

    // weapon is changed
    m_bChangeWeapon = FALSE;

    // if this is not current weapon change it
    if (m_iCurrentWeapon != m_iWantedWeapon) {
      // store current weapon
      m_iPreviousWeapon = m_iCurrentWeapon;

      // [Cecil] Stop reload sound
      CPlayer &pl = (CPlayer&)*m_penPlayer;
      pl.m_soWeaponReload.Stop();

      // [Cecil] Reset time
      pl.m_iLastAmmo = -1;
      pl.m_tmWeaponChange = _pTimer->CurrentTick();

      // [Cecil] Can't pick objects
      ResetPicking();
      StopHolding(TRUE);

      // [Cecil] Not needed for now
      //autocall PutDown() EEnd;

      // set new weapon
      m_iCurrentWeapon = m_iWantedWeapon;

      // remember current weapon for console usage
      wpn_iCurrent = m_iCurrentWeapon;
      autocall BringUp() EEnd;
    }

    jump Idle();
  };

  // put weapon down
  PutDown() {
    // start weapon put down animation
    switch (m_iCurrentWeapon) {
      case WEAPON_NONE:
        break;
      // knife have different stands
      case WEAPON_CROWBAR: 
        m_iAnim = CROWBAR_ANIM_HOLSTER;
        break;
      case WEAPON_PISTOL:
        m_iAnim = (EMPTY_MAG ? PISTOL_ANIM_HOLSTEREMPTY : PISTOL_ANIM_HOLSTER);
        break;
      case WEAPON_357:
        m_iAnim = MAGNUM_ANIM_HOLSTER;
        break;
      case WEAPON_SPAS:
        m_iAnim = SHOTGUN_ANIM_HOLSTER;
        break;
      case WEAPON_SMG1:
        m_iAnim = SMG1_ANIM_IDLETOLOW;
        break;
      case WEAPON_CROSSBOW:
        m_iAnim = CROSSBOW_ANIM_IDLE;
        break;
      case WEAPON_G3SG1:
        m_iAnim = CSS_SNIPER_ANIM_IDLE;
        break;
      case WEAPON_AR2:
        m_iAnim = AR2_ANIM_HOLSTER;
        break;
      case WEAPON_RPG:
        m_iAnim = RPG_ANIM_UPTODOWN;
        break;
      case WEAPON_GRENADE:
        m_iAnim = GRENADE_ANIM_DRAWBACKLOW;
        break;
      case WEAPON_FLAMER:
        m_iAnim = FLAMER_ANIM_DEACTIVATE;
        break;
      case WEAPON_GRAVITYGUN: {
        m_iAnim = GRAVITYGUN_ANIM_HOLSTER;
        break; }
      case WEAPON_LASER:
        m_iAnim = LASER_ANIM_DEACTIVATE;
        break;
      case WEAPON_IRONCANNON:
        m_iAnim = CANNON_ANIM_DEACTIVATE;
        break;
    }
    // start animator
    CPlayerAnimator &plan = (CPlayerAnimator&)*((CPlayer&)*m_penPlayer).m_penAnimator;
    plan.BodyPushAnimation();

    if (m_iCurrentWeapon == WEAPON_NONE) {
      return EEnd();
    }

    // [Cecil] Half-Life 2 Animations
    BOOL bHalfLife = TRUE;

    switch (m_iCurrentWeapon) {
      case WEAPON_CROWBAR:
      case WEAPON_PISTOL:
      case WEAPON_357:
      case WEAPON_SMG1:
      case WEAPON_RPG:
      case WEAPON_GRENADE:
      case WEAPON_CROSSBOW:
      case WEAPON_G3SG1:
        AttachAnim(m_moWeapon, 0, 1, -1, m_iAnim, 0);
        break;

      case WEAPON_SPAS:
        AttachAnim(m_moWeapon, 0, 1, 2, m_iAnim, 0);
        break;

      default: bHalfLife = FALSE;
    }

    if (bHalfLife) {
      autowait(GetAnimSpeed(m_moWeapon, 0, m_iAnim));
      return EEnd();
    }

    m_moWeapon.PlayAnim(m_iAnim, 0);
    autowait(m_moWeapon.GetAnimLength(m_iAnim));
    return EEnd();
  };

  // bring up weapon
  BringUp() {
    // reset weapon draw offset
    ResetWeaponMovingOffset();
    // set weapon model for current weapon
    SetCurrentWeaponModel();

    // [Cecil] Weapon Select Sound
    if (_penViewPlayer == m_penPlayer) {
      CPlayer &pl = (CPlayer&)*m_penPlayer;
      pl.m_soHUD.Set3DParameters(10.0f, 4.0f, 0.5f, 1.0f);
      PlaySound(pl.m_soHUD, SOUND_SELECT_WEAPON, SOF_3D|SOF_VOLUMETRIC);
    }

    // start current weapon bring up animation
    switch (m_iCurrentWeapon) {
      case WEAPON_CROWBAR: 
        m_iAnim = CROWBAR_ANIM_DRAW;
        break;

      case WEAPON_PISTOL:
        m_iAnim = (EMPTY_MAG ? PISTOL_ANIM_DRAWEMPTY : PISTOL_ANIM_DRAW);
        SetFlare(0, FLARE_REMOVE);
        break;

      case WEAPON_357:
        m_iAnim = MAGNUM_ANIM_DRAW;
        SetFlare(0, FLARE_REMOVE);
        break;

      case WEAPON_SPAS:
        m_iAnim = SHOTGUN_ANIM_DRAW;
        SetFlare(0, FLARE_REMOVE);
        break;

      case WEAPON_SMG1:
        m_iAnim = SMG1_ANIM_DRAW;
        SetFlare(0, FLARE_REMOVE);
        break;

      case WEAPON_CROSSBOW:
        m_iAnim = CROSSBOW_ANIM_DRAW;
        break;

      case WEAPON_G3SG1:
        m_iAnim = CSS_SNIPER_ANIM_DRAW;
        SetFlare(0, FLARE_REMOVE);
        break;

      case WEAPON_AR2:
        m_iAnim = AR2_ANIM_DRAW;
        break;

      case WEAPON_RPG:
        m_iAnim = RPG_ANIM_DRAW;
        break;

      case WEAPON_GRENADE:
        if (*GetAmmo() > 0) {
          m_iAnim = GRENADE_ANIM_DRAW;
        } else {
          m_iAnim = GRENADE_ANIM_DEFAULT;
        }
        break;

      case WEAPON_FLAMER:
        m_iAnim = FLAMER_ANIM_ACTIVATE;
        break;

      case WEAPON_GRAVITYGUN:
        m_iAnim = GRAVITYGUN_ANIM_DRAW;
        break;

      case WEAPON_LASER:
        m_iAnim = LASER_ANIM_ACTIVATE;
        break;

      case WEAPON_IRONCANNON:
        m_iAnim = CANNON_ANIM_ACTIVATE;
        break;

      case WEAPON_NONE:
        break;
    }

    // start animator
    CPlayerAnimator &plan = (CPlayerAnimator&)*((CPlayer&)*m_penPlayer).m_penAnimator;
    plan.BodyPullAnimation();

    // [Cecil]
    if (m_iCurrentWeapon == WEAPON_NONE) {
      return EEnd();
    }

    // [Cecil] Half-Life 2 Animations
    BOOL bHalfLife = TRUE;

    switch (m_iCurrentWeapon) {
      case WEAPON_CROWBAR:
      case WEAPON_PISTOL:
      case WEAPON_357:
      case WEAPON_SMG1:
      case WEAPON_RPG:
      case WEAPON_GRENADE:
      case WEAPON_CROSSBOW:
      case WEAPON_G3SG1:
        AttachAnim(m_moWeapon, 0, 1, -1, m_iAnim, 0);
        break;

      case WEAPON_SPAS:
        AttachAnim(m_moWeapon, 0, 1, 2, m_iAnim, 0);
        break;

      default: bHalfLife = FALSE;
    }

    if (bHalfLife) {
      // [Cecil] Allow changing during the animation
      wait (GetAnimSpeed(m_moWeapon, 0, m_iAnim)) {
        on (EBegin) : { resume; }
        on (ETimer) : { stop; }

        on (ESelectWeapon eSelect) : {
          if (SelectWeaponChange(eSelect.iWeapon)) {
            jump ChangeWeapon();
          }
          resume;
        }
      }

      // [Cecil] Additional animation
      m_iAnim = -1;

      switch (m_iCurrentWeapon) {
        case WEAPON_RPG:
          if (EMPTY_MAG && *GetAmmo() <= 0) {
            m_iAnim = RPG_ANIM_UPTODOWN;
            AttachAnim(m_moWeapon, 0, 1, -1, m_iAnim, 0);
          }
          break;

        case WEAPON_GRENADE:
          if (*GetAmmo() > 0 && GetCurrentAnim(m_moWeapon, 0) == GRENADE_ANIM_DEFAULT) {
            m_iAnim = GRENADE_ANIM_DRAW;
            AttachAnim(m_moWeapon, 0, 1, -1, m_iAnim, 0);
          }
          break;
      }

      if (m_iAnim != -1) {
        wait (GetAnimSpeed(m_moWeapon, 0, m_iAnim)) {
          on (EBegin) : { resume; }
          on (ETimer) : { stop; }

          on (ESelectWeapon eSelect) : {
            if (SelectWeaponChange(eSelect.iWeapon)) {
              jump ChangeWeapon();
            }
            resume;
          }
        }
      }
      return EEnd();
    }

    m_moWeapon.PlayAnim(m_iAnim, 0);

    // [Cecil] Allow changing during the animation
    wait (m_moWeapon.GetAnimLength(m_iAnim)) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    return EEnd();
  };

  /*
   *  >>>---   FIRE WEAPON   ---<<<
   */
  Fire() {
    // [Cecil] No such weapon, shouldn't be selected
    if (!WeaponExists(m_iAvailableWeapons, m_iCurrentWeapon)) {
      SelectNewWeapon();
      autowait(ONE_TICK);
      jump Idle();
    }

    m_bFireWeapon = TRUE;

    // [Cecil] Reset shot bullets
    m_iNewShots = 0;

    // setup 3D sound parameters
    Setup3DSoundParameters();

    // start weapon firing animation for continuous firing
    if (m_iCurrentWeapon == WEAPON_FLAMER) {
      jump FlamerStart();

    } else if (m_iCurrentWeapon == WEAPON_LASER) {
      GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRESHORT, AOF_LOOPING);

    } else if ((m_iCurrentWeapon == WEAPON_IRONCANNON)) {
      jump CannonFireStart();
    }

    // clear last lerped bullet position
    m_iLastBulletPosition = FLOAT3D(32000.0f, 32000.0f, 32000.0f);

    // reset laser barrel (to start shooting always from left up barrel)
    m_iLaserBarrel = 0;

    while (HoldingFire()) {
      m_bInterrupt = FALSE;

      wait () {
        on (EBegin) : {
          // fire one shot
          switch (m_iCurrentWeapon) {
            case WEAPON_CROWBAR: call SwingCrowbar(); break;
            case WEAPON_PISTOL: call FireUSP(); break;
            case WEAPON_357: call Fire357(); break;
            case WEAPON_SPAS: call FireSPAS(); break;
            case WEAPON_SMG1: call FireSMG(); break;
            case WEAPON_AR2: call FireAR2(); break;
            case WEAPON_CROSSBOW: call FireCrossbow(); break;
            case WEAPON_G3SG1: call FireSniper(); break;
            case WEAPON_RPG: call FireRPG(); break;
            case WEAPON_GRENADE: call ThrowGrenade(); break;
            case WEAPON_LASER: call FireLaser(); break;
            case WEAPON_GRAVITYGUN: call FireGravityGun(); break;
            default: { call NoAction(); }
          }
          resume;
        }

        on (EStop) : {
          m_bInterrupt = TRUE;
          m_bFireWeapon = FALSE;
          stop;
        }

        on (EEnd) : { stop; }
      }

      if (m_bInterrupt) {
        autowait(ONE_TICK);
      }
    }

    // stop weapon firing animation for continuous firing
    switch (m_iCurrentWeapon) {
      case WEAPON_FLAMER: {
        jump FlamerStop();
      } break;

      case WEAPON_LASER: { 
        GetAnimator()->FireAnimationOff();
      } break;
    }

    jump Idle();
  };

  AltFire() {
    // [Cecil] No such weapon, shouldn't be selected
    if (!WeaponExists(m_iAvailableWeapons, m_iCurrentWeapon)) {
      SelectNewWeapon();
      autowait(ONE_TICK);
      jump Idle();
    }

    m_bAltFireWeapon = TRUE;

    // [Cecil] Reset shot bullets
    m_iNewShots = 0;

    // setup 3D sound parameters
    Setup3DSoundParameters();

    // clear last lerped bullet position
    m_iLastBulletPosition = FLOAT3D(32000.0f, 32000.0f, 32000.0f);

    // reset laser barrel (to start shooting always from left up barrel)
    m_iLaserBarrel = 0;

    while (HoldingAltFire()) {
      m_bInterrupt = FALSE;

      wait () {
        on (EBegin) : {
          // fire one shot
          switch (m_iCurrentWeapon) {
            case WEAPON_SPAS: call AltFireSPAS(); break;
            case WEAPON_SMG1: call AltFireSMG(); break;
            case WEAPON_AR2: call AltFireAR2(); break;
            case WEAPON_GRENADE: call TossGrenade(); break;
            case WEAPON_CROSSBOW: call ZoomCrossbow(); break;
            case WEAPON_G3SG1: call ZoomSniper(); break;
            case WEAPON_GRAVITYGUN: call AltFireGravityGun(); break;
            default: { call NoAction(); }
          }
          resume;
        }

        on (EStop) : {
          m_bInterrupt = TRUE;
          m_bAltFireWeapon = FALSE;
          stop;
        }

        on (EEnd) : { stop; }
      }

      if (m_bInterrupt) {
        autowait(ONE_TICK);
      }
    }

    jump Idle();
  };

  NoAction() {
    m_bFireWeapon = FALSE;
    m_bAltFireWeapon = FALSE;

    autowait(_pTimer->TickQuantum);
    return EEnd();
  };
    
  // ***************** SWING KNIFE *****************
  SwingCrowbar() {
    m_iCrowbarHit = 0;
    m_iCrowbarSurface = 0;
    m_sptCrowbarParticles = SPT_NONE;
    m_bCrowbarKill = FALSE;

    GetAnimator()->FireAnimation(BODY_ANIM_KNIFE_ATTACK, 0);

    m_iAnim = CROWBAR_ANIM_MISS1 + IRnd()%2;
    AttachAnim(m_moWeapon, 0, 1, -1, m_iAnim, 0);

    WeaponSound(SND_FIRE_1, SOUND_CROWBAR_SWING);

    m_iCrowbarHit = CutWithKnife(0, 0, 4.0f, 1.0f, 0.1f, 50.0f, m_iCrowbarSurface, m_sptCrowbarParticles, m_bCrowbarKill);

    // Kill animation
    if (m_bCrowbarKill) {
      AttachAnim(m_moWeapon, 0, 1, -1, CROWBAR_ANIM_HITKILL, 0);

    // Hit animation
    } else if (m_iCrowbarHit != 0) {
      m_iAnim = CROWBAR_ANIM_HIT1 + IRnd()%3;
      AttachAnim(m_moWeapon, 0, 1, -1, m_iAnim, 0);
    }

    autowait(ONE_TICK);

    switch (m_iCrowbarHit) {
      case 1: // Hit model
        WeaponSound(SND_ALT, SprayParticlesSound(this, m_sptCrowbarParticles));
        break;
      case 2: // Hit brush
        WeaponSound(SND_ALT, SurfaceImpactSound(this, m_iCrowbarSurface));
        break;
    }

    autowait(GetAnimSpeed(m_moWeapon, 0, CROWBAR_ANIM_HITKILL)-0.35f);

    if (m_iCrowbarHit == 0 || m_bCrowbarKill) {
      if (!m_bFireWeapon) {
        AttachAnim(m_moWeapon, 0, 1, -1, CROWBAR_ANIM_DRAW, 0);
      }
    }

    autowait(ONE_TICK);
    return EEnd();
  };
  
  // ***************** FIRE COLT *****************
  FireUSP() {
    if (EMPTY_MAG && !CanReload(TRUE)) {
      WeaponSound(SND_EMPTY, SOUND_PISTOL_EMPTY);
    }

    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_COLT_FIRERIGHT, 0);
        FireOneBullet(500.0f, 10.0f);

        DoRecoil(ANGLE3D(Lerp(-1.0f, 1.0f, FRnd()), 1.0f, 0.0f), 100.0f);
        SpawnRangeSound(40.0f);
        DecMag(GetMagPointer(), 1);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);

        WeaponSound(SND_FIRE_1, SOUND_PISTOL_FIRE);
        AttachAnim(m_moWeapon, 0, 1, -1, (EMPTY_MAG ? PISTOL_ANIM_FIREEMPTY : PISTOL_ANIM_FIRE), 0);

        // [Cecil] Drop the bullet
        if (hud_bShowWeapon) {
          CPlacement3D plShell(FLOAT3D(0.15f, -0.2f, -0.45f), ANGLE3D(0.0f, 0.0f, 0.0f));
          FLOATmatrix3D mRot;
          FLOAT3D vUp;

          DropSMGBullet(plShell, mRot, vUp);
        }

        wait (GetAnimSpeed(m_moWeapon, 0, PISTOL_ANIM_FIRE)) {
          on (EBegin) : { resume; }
          on (ETimer) : { stop; }
        
          on (EReleaseWeapon) : {
            m_bFireWeapon = FALSE;
            m_bAltFireWeapon = FALSE;

            // don't stop too early if it's the last bullet
            if (EMPTY_MAG) {
              resume;
            } else {
              stop;
            }
          }
        }

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadUSP();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  ReloadUSP() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    WeaponSound(SND_RELOAD, SOUND_PISTOL_RELOAD);
    AttachAnim(m_moWeapon, 0, 1, -1, PISTOL_ANIM_RELOAD, 0);

    wait (GetAnimSpeed(m_moWeapon, 0, PISTOL_ANIM_RELOAD)-0.35f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    ReloadMag();

    wait (0.3f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    AttachAnim(m_moWeapon, 0, 1, -1, PISTOL_ANIM_IDLE, AOF_SMOOTHCHANGE);
    autowait(ONE_TICK);

    return EEnd();
  };

  // ***************** FIRE DOUBLE COLT *****************
  Fire357() {
    if (EMPTY_MAG && !CanReload(TRUE)) {
      WeaponSound(SND_EMPTY, SOUND_SPAS_EMPTY);
    }

    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_COLT_FIRERIGHT, 0);
        FireOneBullet(500.0f, (!GetSP()->sp_bUseFrags ? 100.0f : 50.0f));

        DoRecoil(ANGLE3D(Lerp(-3.0f, 3.0f, FRnd()), 6.0f, 0.0f), 100.0f);
        SpawnRangeSound(40.0f);
        DecMag(GetMagPointer(), 1);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);

        WeaponSound(SND_FIRE_1, SOUND_357_FIRE);
        AttachAnim(m_moWeapon, 0, 1, -1, MAGNUM_ANIM_FIRE, 0);

        autowait(GetAnimSpeed(m_moWeapon, 0, MAGNUM_ANIM_FIRE)-0.1f);

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump Reload357();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  Reload357() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    AttachAnim(m_moWeapon, 0, 1, -1, MAGNUM_ANIM_RELOAD, 0);

    wait (0.9f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    WeaponSound(SND_RELOAD, SOUND_357_RELOAD);

    wait (GetAnimSpeed(m_moWeapon, 0, MAGNUM_ANIM_RELOAD) - 1.9f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    ReloadMag();

    wait (1.1f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    AttachAnim(m_moWeapon, 0, 1, -1, MAGNUM_ANIM_IDLE, AOF_SMOOTHCHANGE);
    return EEnd();
  };

  // ***************** FIRE SINGLESHOTGUN *****************
  FireSPAS() {
    if (EMPTY_MAG && !CanReload(TRUE)) {
      WeaponSound(SND_EMPTY, SOUND_SPAS_EMPTY);
    }

    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);
        FireBullets(500.0f, (!GetSP()->sp_bUseFrags ? 15.0f : 7.0f), 7, afSingleShotgunPellets, 0.1f, 0.03f, DMT_BULLET);

        DoRecoil(ANGLE3D(Lerp(-3.0f, 3.0f, FRnd()), 6.0f * SgnNZ(FRnd()-0.5f), 0.0f), 100.0f);
        SpawnRangeSound(60.0f);
        DecMag(GetMagPointer(), 1);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);
        AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_FIRE, 0);

        WeaponSound(SND_FIRE_1, SOUND_SPAS_FIRE1 + IRnd()%2);

        autowait(GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_FIRE));

        if (!EMPTY_MAG) {
          AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_PUMP, AOF_SMOOTHCHANGE);
          WeaponSound(SND_RELOAD, SOUND_SPAS_PUMP);

          autowait(0.25f);
          DropShotgunShell();
          autowait(GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_PUMP)-0.25f);
        }

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadSPAS();
    } else if (EMPTY_MAG) {
      m_bFireWeapon = FALSE;
      return EStop();
    }

    return EEnd();
  };

  AltFireSPAS() {
    while (HoldingAltFire()) {
      if (!EmptyMag(1)) {
        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);
        FireBullets(500.0f, (!GetSP()->sp_bUseFrags ? 15.0f : 7.0f), 14, afDoubleShotgunPellets, 0.15f, 0.03f, DMT_BULLET);

        DoRecoil(ANGLE3D(Lerp(-3.0f, 3.0f, FRnd()), 6.0f * SgnNZ(FRnd()-0.5f), 0.0f), 100.0f);
        SpawnRangeSound(60.0f);
        DecMag(GetMagPointer(), 2);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);
        AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_ALTFIRE, 0);

        WeaponSound(SND_FIRE_1, SOUND_SPAS_ALTFIRE);

        autowait(GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_ALTFIRE)-0.1f);

        if (!EMPTY_MAG) {
          AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_PUMP, AOF_SMOOTHCHANGE);

          CPlayer &pl = (CPlayer&)*m_penPlayer;
          WeaponSound(SND_RELOAD, SOUND_SPAS_PUMP);

          autowait(0.25f);
          DropShotgunShell();
          autowait(GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_PUMP)-0.25f);
        }

      } else {
        m_bFireWeapon = TRUE;
        m_bAltFireWeapon = FALSE;
        jump FireSPAS();
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadSPAS();
    } else if (EmptyMag(1)) {
      return EStop();
    }

    return EEnd();
  };

  ReloadSPAS() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    m_bAmmo = EMPTY_MAG;
    AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_RELOAD1, 0);

    wait (GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_RELOAD1)) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      // start firing
      on (EFireWeapon) : {
        m_bFireWeapon = (*GetMagPointer() > 0);

        if (m_bFireWeapon) {
          jump Fire();
        }
        resume;
      }

      on (EAltFireWeapon) : {
        m_bAltFireWeapon = (*GetMagPointer() > 1);

        if (m_bAltFireWeapon) {
          jump AltFire();
        }
        resume;
      }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    while (CanReload(FALSE))
    {
      wait (GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_RELOAD2)-0.4f) {
        // start reloading
        on (EBegin) : {
          if (m_bFireWeapon && *GetMagPointer() > 0) {
            jump Fire();
          }

          if (m_bAltFireWeapon && *GetMagPointer() > 1) {
            jump AltFire();
          }

          AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_RELOAD2, 0);
          resume;
        }

        // start firing
        on (EFireWeapon) : {
          m_bFireWeapon = TRUE;
          resume;
        }

        on (EAltFireWeapon) : {
          m_bAltFireWeapon = TRUE;
          resume;
        }

        on (EInterrupt) : {
          jump Idle();
          resume;
        }

        on (ESelectWeapon eSelect) : {
          if (SelectWeaponChange(eSelect.iWeapon)) {
            jump ChangeWeapon();
          }
          resume;
        }

        // reload once
        on (ETimer) : {
          WeaponSound(SND_RELOAD, SOUND_SPAS_RELOAD1 + IRnd()%3);

          INDEX *piAmmo = GetAmmo();
          INDEX iAmount = Min((INDEX)ceil(GetSP()->sp_fMagMultiplier), *piAmmo);
          iAmount = Min(*GetMaxMagPointer() - *GetMagPointer(), iAmount);

          DecAmmo(iAmount, FALSE);
          *GetMagPointer() += iAmount;
          stop;
        }
      }

      wait (0.3f) {
        on (EBegin) : { resume; }

        // start firing
        on (EFireWeapon) : {
          m_bFireWeapon = TRUE;
          resume;
        }

        on (EAltFireWeapon) : {
          m_bAltFireWeapon = TRUE;
          resume;
        }

        on (EInterrupt) : {
          jump Idle();
          resume;
        }

        on (ESelectWeapon eSelect) : {
          if (SelectWeaponChange(eSelect.iWeapon)) {
            jump ChangeWeapon();
          }
          resume;
        }

        // shoot if needed
        on (ETimer) : {
          if (m_bFireWeapon && *GetMagPointer() > 0) {
            jump Fire();
          }

          if (m_bAltFireWeapon && *GetMagPointer() > 1) {
            jump AltFire();
          }
          stop;
        }
      }
    }

    AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_RELOAD3, 0);
    autowait(GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_RELOAD3));

    if (m_bAmmo) {
      WeaponSound(SND_RELOAD, SOUND_SPAS_PUMP);
      AttachAnim(m_moWeapon, 0, 1, 2, SHOTGUN_ANIM_PUMP, AOF_SMOOTHCHANGE);

      autowait(0.25f);
      DropShotgunShell();
      autowait(GetAnimSpeed(m_moWeapon, 0, SHOTGUN_ANIM_PUMP)-0.25f);
    }

    return EEnd();
  };

  // ***************** FIRE TOMMYGUN *****************
  FireSMG() {
    if (EMPTY_MAG && !CanReload(TRUE)) {
      WeaponSound(SND_EMPTY, SOUND_PISTOL_EMPTY);
    }

    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRESHORT, 0);
        FireMachineBullet(500.0f, (!GetSP()->sp_bUseFrags ? 15.0f : 10.0f), 0.01f, 0.1f, DMT_BULLET, FALSE);
        DecMag(GetMagPointer(), 1);

        DoRecoil(ANGLE3D(Lerp(-5.0f, 5.0f, FRnd()), Lerp(-5.0f, 5.0f, FRnd()), 0.0f), 0.5f);
        SpawnRangeSound(50.0f);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);

        AttachAnim(m_moWeapon, 0, 1, -1, SMG1_ANIM_FIRE1, 0);
        WeaponSound(SND_FIRE_1, SOUND_SMG1_FIRE);

        if (hud_bShowWeapon) {
          CPlacement3D plShell(FLOAT3D(0.2f, -0.2f, -0.35f), ANGLE3D(0.0f, 0.0f, 0.0f));
          FLOATmatrix3D mRot;
          FLOAT3D vUp;

          DropSMGBullet(plShell, mRot, vUp);
        }

        autowait(ONE_TICK);
        autowait(ONE_TICK);

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadSMG();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  AltFireSMG() {
    if (*GetAltAmmo(m_iCurrentWeapon) > 0) {
      GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);
      WeaponSound(SND_ALT, SOUND_SMG1_ALTFIRE);
      AttachAnim(m_moWeapon, 0, 1, -1, SMG1_ANIM_ALTFIRE, 0);

      DoRecoil(ANGLE3D(0.0f, 8.0f, 0.0f), 100.0f);
      FireSMGGrenade(60.0f);
      DecAmmo(1, TRUE);

      autowait(GetAnimSpeed(m_moWeapon, 0, SMG1_ANIM_ALTFIRE));
    }

    m_bAltFireWeapon = FALSE;
    autowait(ONE_TICK);
    return EEnd();
  };

  ReloadSMG() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    WeaponSound(SND_RELOAD, SOUND_SMG1_RELOAD);
    AttachAnim(m_moWeapon, 0, 1, -1, SMG1_ANIM_RELOAD, 0);

    wait (GetAnimSpeed(m_moWeapon, 0, SMG1_ANIM_RELOAD) - 0.4f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    ReloadMag();
    
    wait (0.4f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    AttachAnim(m_moWeapon, 0, 1, -1, SMG1_ANIM_IDLE, AOF_SMOOTHCHANGE);

    autowait(ONE_TICK);
    autowait(ONE_TICK);

    return EEnd();
  };

  // ***************** FIRE MINIGUN *****************
  FireAR2() {
    // [Cecil] Dissolve gamemode
    if (GetSP()->sp_iHLGamemode == HLGM_DISSOLVE) {
      if (*GetAltAmmo(m_iCurrentWeapon) > 0) {
        WeaponSound(SND_ALT, SOUND_AR2_CHARGE);
        m_moWeapon.PlayAnim(AR2_ANIM_SHAKE, 0);

        autowait(m_moWeapon.GetAnimLength(AR2_ANIM_SHAKE)-0.5f);

        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);
        WeaponSound(SND_ALT, SOUND_AR2_ALTFIRE);
        m_moWeapon.PlayAnim(AR2_ANIM_FIRE2, 0);

        DoRecoil(ANGLE3D(0.0f, 8.0f, 0.0f), 100.0f);
        FireEnergyBall();
        DecAmmo(1, TRUE);

        autowait(m_moWeapon.GetAnimLength(AR2_ANIM_FIRE2));
      }

      m_bFireWeapon = FALSE;
      autowait(ONE_TICK);
      return EEnd();
    }

    if (EMPTY_MAG && !CanReload(TRUE)) {
      WeaponSound(SND_EMPTY, SOUND_AR2_EMPTY);
    }

    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRESHORT, 0);
        FireMachineBullet(500.0f, (!GetSP()->sp_bUseFrags ? 25.0f : 15.0f), 0.02f, 0.5f, DMT_RIFLE, FALSE);

        DoRecoil(ANGLE3D(Lerp(-10.0f, 10.0f, FRnd()), Lerp(-10.0f, 10.0f, FRnd()), 0.0f), 0.25f);
        SpawnRangeSound(50.0f);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);
        DecMag(GetMagPointer(), 1);

        m_moWeapon.PlayAnim(AR2_ANIM_FIRE1, 0);
        WeaponSound(SND_FIRE_1, SOUND_AR2_FIRE);

        autowait(ONE_TICK);
        autowait(ONE_TICK);

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadAR2();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  AltFireAR2() {
    if (*GetAltAmmo(m_iCurrentWeapon) > 0) {
      WeaponSound(SND_ALT, SOUND_AR2_CHARGE);
      m_moWeapon.PlayAnim(AR2_ANIM_SHAKE, 0);

      autowait(m_moWeapon.GetAnimLength(AR2_ANIM_SHAKE)-0.5f);

      GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);
      WeaponSound(SND_ALT, SOUND_AR2_ALTFIRE);
      m_moWeapon.PlayAnim(AR2_ANIM_FIRE2, 0);

      DoRecoil(ANGLE3D(0.0f, 8.0f, 0.0f), 100.0f);
      FireEnergyBall();
      DecAmmo(1, TRUE);

      autowait(m_moWeapon.GetAnimLength(AR2_ANIM_FIRE2));
    }

    m_bAltFireWeapon = FALSE;
    autowait(ONE_TICK);
    return EEnd();
  };

  ReloadAR2() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    m_moWeapon.PlayAnim(AR2_ANIM_RELOAD, 0);
    autowait(ONE_TICK);

    WeaponSound(SND_RELOAD, SOUND_AR2_RELOAD);

    wait (m_moWeapon.GetAnimLength(AR2_ANIM_RELOAD) - 0.45f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    ReloadMag();

    wait (0.4f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }
    return EEnd();
  };

  // G3SG1
  FireSniper() {
    if (EMPTY_MAG && !CanReload(TRUE)) {
      WeaponSound(SND_EMPTY, SOUND_AR2_EMPTY);
    }

    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);

        INDEX iDamageType = (GetSP()->sp_iHLGamemode == HLGM_BUNNYHUNT ? DMT_RIFLE : DMT_BULLET);
        if (m_iSniping > 0) {
          FireMachineBullet(1000.0f, (!GetSP()->sp_bUseFrags ? 100.0f : 75.0f), 0.0f, 0.1f, iDamageType, TRUE);
          DoRecoil(ANGLE3D(Lerp(-2.5f, 2.5f, FRnd()), 2.0f + FRnd()*2.0f, 0.0f), 2.0f);
        } else {
          FireMachineBullet(1000.0f, 75.0f, 0.2f, 0.1f, iDamageType, TRUE);
          DoRecoil(ANGLE3D(Lerp(-5.0f, 5.0f, FRnd()), 5.0f + FRnd()*2.0f, 0.0f), 5.0f);
        }
        DecMag(GetMagPointer(), 1);

        SpawnRangeSound(50.0f);
        SetFlare(0, FLARE_ADD);
        PlayLightAnim(LIGHT_ANIM_FIRE, 0);

        AttachAnim(m_moWeapon, 0, 1, -1, CSS_SNIPER_ANIM_FIRE, 0);

        WeaponSound(SND_FIRE_1, SOUND_CSS_SNIPER_FIRE);

        if (hud_bShowWeapon) {
          CPlacement3D plShell(FLOAT3D(0.2f, -0.2f, -0.35f), ANGLE3D(0.0f, 0.0f, 0.0f));
          FLOATmatrix3D mRot;
          FLOAT3D vUp;

          DropSMGBullet(plShell, mRot, vUp);
        }

        autowait(0.3f);

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadSniper();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  ZoomSniper() {
    GetPlayer()->ApplyCSSWeaponZoom(TRUE);

    m_bAltFireWeapon = FALSE;
    autowait(ONE_TICK);
    return EEnd();
  };

  ReloadSniper() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    WeaponSound(SND_RELOAD, SOUND_CSS_SNIPER_RELOAD);
    AttachAnim(m_moWeapon, 0, 1, -1, CSS_SNIPER_ANIM_RELOAD, 0);

    m_iRestoreZoom = m_iSniping;
    SnipingOff();

    wait (GetAnimSpeed(m_moWeapon, 0, CSS_SNIPER_ANIM_RELOAD)) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    if (m_iRestoreZoom != 0) {
      GetPlayer()->ApplyCSSWeaponZoom(TRUE);
    }
    ReloadMag();
    return EEnd();
  };

  // CROSSBOW
  FireCrossbow() {
    while (HoldingFire() && !m_bInterrupt) {
      if (!EMPTY_MAG) {
        GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);

        INDEX iDamageType = (GetSP()->sp_iHLGamemode == HLGM_BUNNYHUNT ? DMT_RIFLE : DMT_BULLET);
        //FireMachineBullet(1000.0f, (!GetSP()->sp_bUseFrags ? 100.0f : 75.0f), 0.0f, 0.1f, iDamageType, TRUE);
        FireRod();
        DoRecoil(ANGLE3D(Lerp(-1.5f, 1.5f, FRnd()), 8.0f + FRnd()*2.0f, 0.0f), 10.0f);

        DecMag(GetMagPointer(), 1);
        SpawnRangeSound(50.0f);

        AttachAnim(m_moWeapon, 0, 1, -1, CROSSBOW_ANIM_FIRE, 0);
        WeaponSound(SND_FIRE_1, SOUND_CROSSBOW_FIRE);

        autowait(0.3f);

      } else {
        m_bInterrupt = TRUE;
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadCrossbow();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  ZoomCrossbow() {
    GetPlayer()->ApplyWeaponZoom(m_iSniping != -2);

    m_bAltFireWeapon = FALSE;
    autowait(ONE_TICK);
    return EEnd();
  };

  ReloadCrossbow() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    AttachAnim(m_moWeapon, 0, 1, -1, CROSSBOW_ANIM_RELOAD, 0);

    // [Cecil] TEMP: Don't reset zoom
    /*if (m_iSniping < -1) {
      m_iRestoreZoom = m_iSniping;
      GetPlayer()->ApplyWeaponZoom(FALSE);
    }*/

    wait (0.65f) {
      on (EBegin) : { resume; }
      on (ETimer) : {
        WeaponSound(SND_RELOAD, SOUND_CROSSBOW_LOAD1 + IRnd()%2);
        stop;
      }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }

      // reset zoom
      on (EAltFireWeapon) : {
        // [Cecil] TEMP: Change zoom
        //m_iRestoreZoom = 0;
        GetPlayer()->ApplyWeaponZoom(m_iSniping != -2);
        resume;
      }
    }

    wait (0.35f) {
      on (EBegin) : { resume; }
      on (ETimer) : {
        ReloadMag();

        // spawn sparks
        m_tmParticles = _pTimer->CurrentTick();
        stop;
      }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }

      // reset zoom
      on (EAltFireWeapon) : {
        // [Cecil] TEMP: Change zoom
        //m_iRestoreZoom = 0;
        GetPlayer()->ApplyWeaponZoom(m_iSniping != -2);
        resume;
      }
    }

    wait (GetAnimSpeed(m_moWeapon, 0, CROSSBOW_ANIM_RELOAD) - 1.0f) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }

      // reset zoom
      on (EAltFireWeapon) : {
        m_iRestoreZoom = 0;
        resume;
      }
    }
    
    // [Cecil] TEMP: Don't restore zoom
    /*if (m_iRestoreZoom == -2) {
      GetPlayer()->ApplyWeaponZoom(TRUE);
    }
    m_iRestoreZoom = 0;*/

    return EEnd();
  };

  // GRAVITY GUN
  FireGravityGun() {
    GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);

    // if can launch something
    CEntity *penHolding = HeldObject().GetSyncedEntity();

    if (penHolding != NULL || SuitableObject(m_penRayHit, 1, FALSE)) {
      m_moWeapon.PlayAnim(GRAVITYGUN_ANIM_FIREOPEN, 0);
      WeaponSound(SND_FIRE_1, SOUND_GG_LAUNCH1 + IRnd() % 4);

      // determine the target object
      CEntity *penTarget = (penHolding != NULL ? penHolding : m_penRayHit);
      CMovableEntity *penObject = (CMovableEntity*)penTarget;

      // launch object
      CPlacement3D plView = GetPlayer()->en_plViewpoint;
      plView.RelativeToAbsolute(GetPlayer()->GetPlacement());

      const FLOAT3D vTargetDir = (m_vRayHit - plView.pl_PositionVector).Normalize();

      // object's mass
      FLOAT fMassFactor = 1.0f;
      if (penTarget->GetEntityInfo() != NULL) {
        fMassFactor = 100.0f / Clamp(((EntityInfo*)penTarget->GetEntityInfo())->fMass, 100.0f, 500.0f);
      }

      // launch certain objects
      if (!IsOfClass(penTarget, "Projectile") && penTarget->GetRenderType() == RT_MODEL) {
        EGravityGunPush ePush;
        ePush.vDir = vTargetDir / _pTimer->TickQuantum * fMassFactor * 3.0f * GetSP()->sp_fGravityGunPower;
        ePush.vHit = penObject->GetPlacement().pl_PositionVector;
        ePush.bLaunch = TRUE;
        penObject->SendEvent(ePush);
      }

      // damage certain objects
      if (!IsOfClass(penTarget, "RollingStone")) {
        // explosive damage for brushes
        if (IsOfClass(penTarget, "Moving Brush")) {
          InflictDirectDamage(penTarget, m_penPlayer, DMT_EXPLOSION, 20.0f, m_vRayHit, vTargetDir);

        } else if (IsDerivedFromID(penTarget, CPhysBase_ClassID)) {
          InflictDirectDamage(penTarget, m_penPlayer, DMT_IMPACT, 50.0f, m_vRayHit, vTargetDir);

        } else {
          InflictDirectDamage(penTarget, m_penPlayer, DMT_CLOSERANGE, 50.0f, m_vRayHit, vTargetDir);
        }
      }

      // Launch effect time and hit point
      m_tmGGLaunch = _pTimer->CurrentTick();
      m_tmLaunchEffect = m_tmGGLaunch + 0.15f;

      m_vGGHitPos = m_vRayHit;
      m_vGGHitDir = vTargetDir;

      // Increase flare
      CAttachmentModelObject *pamo = m_moWeapon.GetAttachmentModel(10);
      pamo->amo_plRelative.pl_OrientationAngle(3) = FRnd() * 360.0f;

      m_vGGFlare(2) = 10.0f;
      m_vLastGGFlare(2) = m_vGGFlare(2) / 0.5f;

      // Stop holding
      StopHolding(FALSE);

      DoRecoil(ANGLE3D(Lerp(-5.0f, 5.0f, FRnd()), 4.0f, 0.0f), 100.0f);

      autowait(m_moWeapon.GetAnimLength(GRAVITYGUN_ANIM_FIREOPEN)-0.3f);

    } else if (TRUE) {
      m_moWeapon.PlayAnim(GRAVITYGUN_ANIM_FIRE, 0);
      WeaponSound(SND_FIRE_1, SOUND_GG_DRYFIRE);

      autowait(m_moWeapon.GetAnimLength(GRAVITYGUN_ANIM_FIRE)-0.3f);
    }

    m_bFireWeapon = FALSE;
    return EEnd();
  };

  AltFireGravityGun() {
    // drop the object
    if (HeldObject().IsSynced()) {
      WeaponSound(SND_FIRE_1, SOUND_GG_DROP);
      m_moWeapon.PlayAnim((m_bPickable ? GRAVITYGUN_ANIM_IDLEOPEN : GRAVITYGUN_ANIM_PRONGSCLOSE), 0);
      StopHolding(FALSE);

      m_bAltFireWeapon = FALSE;
      autowait(0.2f);
      return EEnd();
    }

    // already pickable
    if (SuitableObject(m_penRayHit, 1, TRUE)) {
      WeaponSound(SND_FIRE_1, SOUND_GG_PICKUP);
      m_moWeapon.PlayAnim(GRAVITYGUN_ANIM_HOLD, 0);
      StartHolding(m_penRayHit);

      m_bAltFireWeapon = FALSE;
      autowait(ONE_TICK);
      return EEnd();
    }

    m_bPullObject = TRUE;
    WeaponSound(SND_FIRE_1, SOUND_GG_TOOHEAVY);
    
    while (HoldingAltFire()) {
      // pick up the object
      if (SuitableObject(m_penRayHit, 1, TRUE)) {
        WeaponSound(SND_FIRE_1, SOUND_GG_PICKUP);
        m_moWeapon.PlayAnim(GRAVITYGUN_ANIM_PRONGSOPEN, 0);
        StartHolding(m_penRayHit);
        m_bPullObject = FALSE;

        m_bAltFireWeapon = FALSE;
        return EEnd();

      // pull the object
      } else if (SuitableObject(m_penRayHit, 0, TRUE)) {
        CMovableEntity *pen = (CMovableEntity*)&*m_penRayHit;

        // move towards the player
        CPlacement3D plView = GetPlayer()->en_plViewpoint;
        plView.RelativeToAbsolute(GetPlayer()->GetPlacement());

        const FLOAT3D vToPlayer = (plView.pl_PositionVector - pen->GetPlacement().pl_PositionVector).Normalize();

        EGravityGunPush ePush;
        ePush.vDir = vToPlayer / _pTimer->TickQuantum / 20.0f * 3.0f;
        ePush.vHit = m_vRayHit;
        ePush.bLaunch = FALSE;
        pen->SendEvent(ePush);
      }

      autowait(ONE_TICK);
    }

    m_bPullObject = FALSE;
    return EEnd();
  };

  // ***************** FIRE ROCKETLAUNCHER *****************
  FireRPG() {
    m_bFireWeapon = FALSE;

    if (!EMPTY_MAG) {
      GetAnimator()->FireAnimation(BODY_ANIM_SHOTGUN_FIRELONG, 0);
      AttachAnim(m_moWeapon, 0, 1, -1, RPG_ANIM_FIRE, 0);
      WeaponSound(SND_FIRE_1, SOUND_RPG_FIRE);
      FireRocket();

      DoRecoil(ANGLE3D(Lerp(-2.0f, 2.0f, FRnd()), 3.0f, 0.0f), 100.0f);
      SpawnRangeSound(20.0f);
      DecMag(GetMagPointer(), 1);

      while (m_penMissle != NULL && !(m_penMissle->GetFlags() & ENF_DELETED)) {
        autowait(ONE_TICK);
      }

      if (EMPTY_MAG && *GetAmmo() <= 0) {
        AttachAnim(m_moWeapon, 0, 1, -1, RPG_ANIM_UPTODOWN, 0);
        autowait(GetAnimSpeed(m_moWeapon, 0, RPG_ANIM_UPTODOWN));
        AttachAnim(m_moWeapon, 0, 1, -1, RPG_ANIM_DOWNIDLE, 0);
      }
    }

    if (CanReload(TRUE)) {
      jump ReloadRPG();
    } else if (EMPTY_MAG) {
      return EStop();
    }

    return EEnd();
  };

  ReloadRPG() {
    if (!CanReload(FALSE)) {
      return EEnd();
    }

    if (*GetAmmo() > 0 && GetCurrentAnim(m_moWeapon, 0) == RPG_ANIM_DOWNIDLE) {
      AttachAnim(m_moWeapon, 0, 1, -1, RPG_ANIM_DOWNTOUP, 0);
      autowait(GetAnimSpeed(m_moWeapon, 0, RPG_ANIM_DOWNTOUP));
    }

    AttachAnim(m_moWeapon, 0, 1, -1, RPG_ANIM_RELOAD, 0);

    wait (GetAnimSpeed(m_moWeapon, 0, RPG_ANIM_RELOAD)) {
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }

      on (EInterrupt) : {
        jump Idle();
        resume;
      }

      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }
    }

    ReloadMag();
    return EEnd();
  };

  // ***************** FIRE GRENADELAUNCHER *****************
  ThrowGrenade() {
    if (*GetAmmo() <= 0) {
      return EStop();
    }

    AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAWBACKHIGH, 0);
    autowait(GetAnimSpeed(m_moWeapon, 0, GRENADE_ANIM_DRAWBACKHIGH));

    while (HoldingFire()) {
      wait (ONE_TICK) {
        on (EBegin) : { resume; }
        on (ETimer) : { stop; }

        on (ESelectWeapon eSelect) : {
          if (SelectWeaponChange(eSelect.iWeapon)) {
            jump ChangeWeapon();
          }
          resume;
        }
      }
    }
    
    if (*GetAmmo() > 0) {
      FireGrenade(8.0f);
      SpawnRangeSound(10.0f);
      DecAmmo(1, FALSE);

      GetAnimator()->FireAnimation(BODY_ANIM_KNIFE_ATTACK, 0);

      WeaponSound(SND_FIRE_1, SOUND_GRENADE_TICK);
      AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_THROW, 0);

      autowait(GetAnimSpeed(m_moWeapon, 0, GRENADE_ANIM_THROW));
    }

    if (*GetAmmo() > 0) {
      AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAW, 0);
      autowait(GetAnimSpeed(m_moWeapon, 0, GRENADE_ANIM_DRAW));
    }

    return EEnd();
  };
  
  TossGrenade() {
    if (*GetAmmo() <= 0) {
      return EStop();
    }

    AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAWBACKLOW, 0);
    autowait(GetAnimSpeed(m_moWeapon, 0, GRENADE_ANIM_DRAWBACKLOW));

    while (HoldingAltFire()) {
      wait (ONE_TICK) {
        on (EBegin) : { resume; }
        on (ETimer) : { stop; }

        on (ESelectWeapon eSelect) : {
          if (SelectWeaponChange(eSelect.iWeapon)) {
            jump ChangeWeapon();
          }
          resume;
        }
      }
    }
    
    if (*GetAmmo() > 0) {
      FireGrenade(1.0f);
      SpawnRangeSound(10.0f);
      DecAmmo(1, FALSE);

      GetAnimator()->FireAnimation(BODY_ANIM_KNIFE_ATTACK, 0);

      WeaponSound(SND_FIRE_1, SOUND_GRENADE_TICK);
      AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_ROLL, 0);

      autowait(GetAnimSpeed(m_moWeapon, 0, GRENADE_ANIM_ROLL));
    }

    if (*GetAmmo() > 0) {
      AttachAnim(m_moWeapon, 0, 1, -1, GRENADE_ANIM_DRAW, 0);
      autowait(GetAnimSpeed(m_moWeapon, 0, GRENADE_ANIM_DRAW));
    }

    return EEnd();
  };

  // ***************** FIRE FLAMER *****************
  FlamerStart() {
    m_tmFlamerStart = _pTimer->CurrentTick();
    m_tmFlamerStop = 1e9;
    
    m_moWeapon.PlayAnim(FLAMER_ANIM_FIRESTART, 0);
    autowait(m_moWeapon.GetAnimLength(FLAMER_ANIM_FIRESTART));
    // play fire sound
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.m_soWeaponFire1.Set3DParameters(50.0f, 5.0f, 2.0f, 0.31f);
    pl.m_soWeaponFire2.Set3DParameters(50.0f, 5.0f, 2.0f, 0.3f);

    PlaySound(pl.m_soWeaponFire1, SOUND_FL_FIRE, SOF_3D|SOF_LOOP|SOF_VOLUMETRIC);
    PlaySound(pl.m_soWeaponFire2, SOUND_FL_START, SOF_3D|SOF_VOLUMETRIC);

    FireFlame();
    autowait(ONE_TICK);
    jump FlamerFire();
  };

  FlamerFire() {
    // while holding fire
    while (HoldingFire()) {
      // fire
      FireFlame();
      SpawnRangeSound(30.0f);

      autowait(_pTimer->TickQuantum);
      autowait(_pTimer->TickQuantum);
    }

    jump FlamerStop();
  };

  FlamerStop() {
    m_tmFlamerStop=_pTimer->CurrentTick();
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    PlaySound(pl.m_soWeaponFire1, SOUND_FL_STOP, SOF_3D|SOF_VOLUMETRIC|SOF_SMOOTHCHANGE);
    FireFlame();
    // link last flame with nothing (if not NULL or deleted)
    if (m_penFlame != NULL && !(m_penFlame->GetFlags() & ENF_DELETED)) {
      ((CProjectile&)*m_penFlame).m_penParticles = NULL;
      m_penFlame = NULL;
    }

    m_moWeapon.PlayAnim(FLAMER_ANIM_FIREEND, 0);
    autowait(m_moWeapon.GetAnimLength(FLAMER_ANIM_FIREEND));

    jump Idle();
  };

  // ***************** FIRE LASER *****************
  FireLaser() {
    // fire one cell
    autowait(0.1f);
    m_moWeapon.PlayAnim(LASER_ANIM_FIRE, AOF_LOOPING|AOF_NORESTART);
    FireLaserRay();

    // sound
    SpawnRangeSound(20.0f);

    // activate barrel anim
    switch(m_iLaserBarrel) {
      case 0: { // barrel lu
        CModelObject *pmo = &(m_moWeapon.GetAttachmentModel(LASER_ATTACHMENT_LEFTUP)->amo_moModelObject);
        pmo->PlayAnim(BARREL_ANIM_FIRE, 0);
        WeaponSound(0, SOUND_LASER_FIRE);
        break; }

      case 3: { // barrel rd
        CModelObject *pmo = &(m_moWeapon.GetAttachmentModel(LASER_ATTACHMENT_RIGHTDOWN)->amo_moModelObject);
        pmo->PlayAnim(BARREL_ANIM_FIRE, 0);
        WeaponSound(1, SOUND_LASER_FIRE);
        break; }

      case 1: { // barrel ld
        CModelObject *pmo = &(m_moWeapon.GetAttachmentModel(LASER_ATTACHMENT_LEFTDOWN)->amo_moModelObject);
        pmo->PlayAnim(BARREL_ANIM_FIRE, 0);
        WeaponSound(2, SOUND_LASER_FIRE);
        break; }

      case 2: { // barrel ru
        CModelObject *pmo = &(m_moWeapon.GetAttachmentModel(LASER_ATTACHMENT_RIGHTUP)->amo_moModelObject);
        pmo->PlayAnim(BARREL_ANIM_FIRE, 0);
        WeaponSound(3, SOUND_LASER_FIRE);
        break; }
    }
    // next barrel
    m_iLaserBarrel = (m_iLaserBarrel+1)&3;

    return EEnd();
  };

  // ***************** FIRE CANNON *****************
  CannonFireStart() {
    m_tmDrawStartTime = _pTimer->CurrentTick();
    CPlayer &pl = (CPlayer&)*m_penPlayer;

    pl.m_soWeaponFire1.Set3DParameters(50.0f, 5.0f, 3.0f, 1.0f);
    WeaponSound(SND_FIRE_1, SOUND_CANNON_PREPARE);

    while (HoldingFire() && _pTimer->CurrentTick() - m_tmDrawStartTime < 1.0f) {
      autowait(_pTimer->TickQuantum);
    }

    // turn off the sound
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.m_soWeaponFire1.Set3DParameters(50.0f, 5.0f, 0.0f, 1.0f);
    
    // fire one ball
    INDEX iPower = INDEX((_pTimer->CurrentTick() - m_tmDrawStartTime) / _pTimer->TickQuantum);
    GetAnimator()->FireAnimation(BODY_ANIM_MINIGUN_FIRELONG, 0);

    m_tmDrawStartTime = 0.0f;

    FLOAT fRange, fFalloff;
    if (GetSP()->sp_bCooperative) {
      fRange = 100.0f;
      fFalloff = 25.0f;
    } else if (TRUE) {
      fRange = 150.0f;
      fFalloff = 30.0f;
    }

    pl.m_soWeaponAlt.Set3DParameters(fRange, fFalloff, 2.0f+iPower*0.05f, 1.0f);
    WeaponSound(SND_ALT, SOUND_CANNON);

    m_moWeapon.PlayAnim(CANNON_ANIM_FIRE, 0);
    FireCannonBall(iPower);

    SpawnRangeSound(30.0f);
    autowait(m_moWeapon.GetAnimLength(CANNON_ANIM_FIRE));

    ResetWeaponMovingOffset();
    jump Idle();
  };

  /*
   *  >>>---   RELOAD WEAPON   ---<<<
   */
  Reload() {
    m_bReloadWeapon = FALSE;

    // [Cecil]
    Setup3DSoundParameters();

    // reload
    if (m_iCurrentWeapon == WEAPON_PISTOL) {
      autocall ReloadUSP() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_357) {
      autocall Reload357() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_SPAS) {
      autocall ReloadSPAS() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_SMG1) {
      autocall ReloadSMG() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_AR2) {
      autocall ReloadAR2() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_RPG) {
      autocall ReloadRPG() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_CROSSBOW) {
      autocall ReloadCrossbow() EEnd;

    } else if (m_iCurrentWeapon == WEAPON_G3SG1) {
      autocall ReloadSniper() EEnd;
    }

    jump Idle();
  };

  /*
   *  >>>---   NO WEAPON ACTION   ---<<<
   */
  Idle() {
    wait () {
      on (EBegin) : {
        // play default anim
        PlayDefaultAnim();

        // weapon changed
        if (m_bChangeWeapon) {
          jump ChangeWeapon();
        }

        // fire pressed start firing
        if (m_bFireWeapon) {
          jump Fire();
        }

        // alt fire pressed start firing
        if (m_bAltFireWeapon) {
          jump AltFire();
        }

        // reload pressed
        if (m_bReloadWeapon) {
          jump Reload();
        }
        resume;
      }

      // select weapon
      on (ESelectWeapon eSelect) : {
        if (SelectWeaponChange(eSelect.iWeapon)) {
          jump ChangeWeapon();
        }
        resume;
      }

      // fire pressed
      on (EFireWeapon) : {
        jump Fire();
      }

      // alt fire pressed
      on (EAltFireWeapon) : {
        jump AltFire();
      }

      // reload pressed
      on (EReloadWeapon) : {
        jump Reload();
      }

      // [Cecil] Pass gravity gun actions
      on (EGravityGunGrab) : { pass; }
      on (EGravityGunDrop) : { pass; }
    }
  };

  // weapons wait here while player is dead, so that stupid animations wouldn't play
  Stopped() {
    // kill all possible sounds, animations, etc
    ResetWeaponMovingOffset();

    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.m_soWeaponFire1.Stop();
    pl.m_soWeaponFire2.Stop();
    pl.m_soWeaponReload.Stop();
    pl.m_soWeaponAlt.Stop();
    pl.m_soWeaponEmpty.Stop();
    PlayLightAnim(LIGHT_ANIM_NONE, 0);

    wait () {
      // after level change
      on (EPostLevelChange) : { return EBegin(); };
      on (EStart) : { return EBegin(); };
      otherwise() : { resume; };
    }
  };

  /*
   *  >>>---   M  A  I  N   ---<<<
   */
  Main(EWeaponsInit eInit) {
    // remember the initial parameters
    ASSERT(eInit.penOwner!=NULL);
    m_penPlayer = eInit.penOwner;

    // declare yourself as a void
    InitAsVoid();
    SetFlags(GetFlags()|ENF_CROSSESLEVELS|ENF_NOTIFYLEVELCHANGE);
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // [Cecil]
    ResetMaxAmmo();
    ResetMags();

    // set weapon model for current weapon
    SetCurrentWeaponModel();

    // play default anim
    PlayDefaultAnim();    

    wait () {
      on (EBegin) : { call Idle(); }

      // try to change weapon
      on (ESelectWeapon eSelect) : {
        SelectWeaponChange(eSelect.iWeapon);
        resume;
      };

      // stop everything before level change
      on (EPreLevelChange) : {
        m_bFireWeapon = FALSE;
        m_bAltFireWeapon = FALSE;
        call Stopped();
        resume;
      }

      // start firing
      on (EFireWeapon) : {
        m_bFireWeapon = TRUE;
        resume;
      }
      on (EAltFireWeapon) : {
        m_bAltFireWeapon = TRUE;
        resume;
      }

      // stop firing
      on (EReleaseWeapon) : {
        m_bFireWeapon = FALSE;
        m_bAltFireWeapon = FALSE;
        resume;
      }

      // reload wepon
      on (EReloadWeapon) : {
        m_bReloadWeapon = TRUE;
        resume;
      }

      // [Cecil] Start holding
      on (EGravityGunGrab eGrab) : {
        CEntity *penObject = eGrab.penObject;
        CSyncedEntityPtr *pSync = GetGravityGunSync(penObject);

        if (pSync == NULL) { resume; }

        m_penHolding = penObject;
        m_syncHolding.Sync(pSync);
        m_ulObjectFlags = eGrab.ulFlags;

        CPlacement3D plView = GetPlayer()->en_plViewpoint;
        plView.RelativeToAbsolute(GetPlayer()->GetPlacement());

        CPlacement3D plObject = penObject->GetPlacement();

        if (IsEntityPhysical(penObject)) {
          plObject.pl_PositionVector = ((CPhysBase *)penObject)->PhysObj().GetPosition();

          FLOATmatrix3D mRot = ((CPhysBase *)penObject)->PhysObj().GetMatrix();
          DecomposeRotationMatrixNoSnap(plObject.pl_OrientationAngle, mRot);
        }

        plObject.AbsoluteToRelative(plView);

        m_aObjectAngle = plObject.pl_OrientationAngle;
        resume;
      }

      // [Cecil] Stop holding
      on (EGravityGunDrop eDrop) : {
        StopHolding(eDrop.bCloseProngs);
        resume;
      }

      on (EStop) : { call Stopped(); }
      on (EEnd) : { stop; }
    }

    // cease to exist
    Destroy();
    return;
  };
};
