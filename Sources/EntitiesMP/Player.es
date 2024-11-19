401
%{

#include "StdH.h"
#include "GameMP/SEColors.h"

#include <Engine/Build.h>
#include <Engine/Network/Network.h>
#include <locale.h>

#include "ModelsMP/Player/SeriousSam/Player.h"
#include "ModelsMP/Player/SeriousSam/Body.h"
#include "ModelsMP/Player/SeriousSam/Head.h"

#include "EntitiesMP/PlayerMarker.h"
#include "EntitiesMP/PlayerWeapons.h"
#include "EntitiesMP/PlayerAnimator.h"
#include "EntitiesMP/PlayerView.h"
#include "EntitiesMP/MovingBrush.h"
#include "EntitiesMP/Switch.h"
#include "EntitiesMP/MessageHolder.h"
#include "EntitiesMP/Camera.h"
#include "EntitiesMP/WorldLink.h"
#include "EntitiesMP/HealthItem.h"
#include "EntitiesMP/ArmorItem.h"
#include "EntitiesMP/WeaponItem.h"
#include "EntitiesMP/AmmoItem.h"
#include "EntitiesMP/PowerUpItem.h"
#include "EntitiesMP/MessageItem.h"
#include "EntitiesMP/AmmoPack.h"
#include "EntitiesMP/KeyItem.h"
#include "EntitiesMP/MusicHolder.h"
#include "EntitiesMP/EnemyBase.h"
#include "EntitiesMP/PlayerActionMarker.h"
#include "EntitiesMP/BasicEffects.h"
#include "EntitiesMP/BackgroundViewer.h"
#include "EntitiesMP/WorldSettingsController.h"
#include "EntitiesMP/ScrollHolder.h"
#include "EntitiesMP/TextFXHolder.h"
#include "EntitiesMP/SeriousBomb.h"
#include "EntitiesMP/CreditsHolder.h"
#include "EntitiesMP/HudPicHolder.h"

// [Cecil] New functionality
#include "EntitiesMP/Light.h"           // Flashlight
#include "EntitiesMP/Cecil/Physics.h"   // Source physics simulation
#include "EntitiesMP/Cecil/Effects.h"   // Effects
#include "EntitiesMP/Cecil/Weapons.h"   // Weapon flags
#include "EntitiesMP/Common/UI/UI.h"    // UI elements
#include "HL2Models/ItemHandler.h"      // Item attachments
#include "EntitiesMP/Mod/PhysObject.h"  // Physics object spawning
#include "EntitiesMP/Mod/RollerMine.h"  // Roller mine spawning
#include "EntitiesMP/Mod/Radio.h"       // Radio spawning
#include "EntitiesMP/Mod/Enemies/ScientistSKA.h" // Interact with the science team

#define FL_PLACE CPlacement3D(FLOAT3D(-32000.0f, -512.0f, -32000.0f), ANGLE3D(0.0f, 0.0f, 0.0f))

// [Cecil] Weapon Zoom
extern FLOAT _afWeaponZoom[];

// [Cecil] New message system
#define CT_CAPTIONS 10
#define CAPTIONS_WIDTH hl2_fCaptionsWidth
#define TM_CAPTION      5.0f
#define TM_CAPTION_ANIM 0.2f
extern CDrawPort *_pdp;

// [Cecil] HAX Menu
static CTextureObject _toHAXMenu;
static CTextureObject _toMenuPointer;
#define HAXF_GOD    (1<<0)
#define HAXF_NOCLIP (1<<1)

// [Cecil] Physical state
enum EPlayerPhysics {
  PPH_NORMAL, // Collide with the world normally
  PPH_NOCLIP, // Ignore world collision
  PPH_DEAD,   // Corpse
  PPH_INIT,   // Initializing/rebirth
};

// [Cecil] Current viewer player
extern CEntity *_penViewPlayer = NULL;

extern void JumpFromBouncer(CEntity *penToBounce, CEntity *penBouncer);
// from game
#define GRV_SHOWEXTRAS  (1L<<0)   // add extra stuff like console, weapon, pause

// [Cecil] Physics object radius
#define PHYS_SPHERE_RADIUS 0.5f

// [Cecil] TEMP
extern INDEX ode_iCollisionGrid;
extern void Particles_CollisionGridCells(const FLOATaabbox3D &box);
%}

// [Cecil] New base class
uses "EntitiesMP/Mod/Base/PlayerEntity";

enum PlayerViewType {
  0 PVT_PLAYEREYES      "",
  1 PVT_PLAYERAUTOVIEW  "",
  2 PVT_SCENECAMERA     "",
  3 PVT_3RDPERSONVIEW   "",
};

enum PlayerState {
  0 PST_STAND     "",
  1 PST_CROUCH    "",
  2 PST_SWIM      "",
  3 PST_DIVE      "",
  4 PST_FALL      "",
};

// [Cecil] Suit sound type
enum ESuitSound {
  0 ESS_NONE  "<none>",
  1 ESS_AMMO  "Ammunition depleted",
  2 ESS_HEAT  "Heat damage detected",
  3 ESS_SHOCK "Electrical damage detected",
  4 ESS_ARMOR "Armor compromised",
  5 ESS_DEATH "User death imminent",
  6 ESS_MEDIC "Seek medical attention",
  7 ESS_CRIT  "Vital signs critical",
  8 ESS_MAJOR "Major fracture detected",
  9 ESS_MINOR "Minor fracture detected",
};

// event for starting cinematic camera sequence
event ECameraStart {
  CEntityPointer penCamera,   // the camera
};

// event for ending cinematic camera sequence
event ECameraStop {
  CEntityPointer penCamera,   // the camera
};

// sent when needs to rebirth
event ERebirth {
};

// sent when player was disconnected from game
event EDisconnected {
};

// starts automatic player actions
event EAutoAction {
  CEntityPointer penFirstMarker,
};

%{
extern void DrawHUD(CPlayer *penPlayerCurrent, CDrawPort *pdpCurrent, BOOL bSnooping, const CPlayer *penPlayerOwner);
extern void InitHUD(void);
extern void EndHUD(void);

static CTimerValue _tvProbingLast;

// used to render certain entities only for certain players (like picked items, etc.)
extern ULONG _ulPlayerRenderingMask = 0;

// temporary BOOL used to discard calculating of 3rd view when calculating absolute view placement
BOOL _bDiscard3rdView=FALSE;

#define NAME name

const FLOAT _fBlowUpAmmount = 70.0f;

// computer message adding flags
#define CMF_READ       (1L<<0)
#define CMF_ANALYZE    (1L<<1)

struct MarkerDistance {
public:
  FLOAT md_fMinD;
  CPlayerMarker *md_ppm;
  void Clear(void);
};

// export current player projection
CAnyProjection3D prPlayerProjection;


int qsort_CompareMarkerDistance(const void *pv0, const void *pv1) {
  MarkerDistance &md0 = *(MarkerDistance*)pv0;
  MarkerDistance &md1 = *(MarkerDistance*)pv1;
  if(      md0.md_fMinD<md1.md_fMinD) return +1;
  else if( md0.md_fMinD>md1.md_fMinD) return -1;
  else                                return  0;
};

static inline FLOAT IntensityAtDistance( FLOAT fFallOff, FLOAT fHotSpot, FLOAT fDistance) {
  // intensity is zero if further than fall-off range
  if (fDistance > fFallOff) return 0.0f;
  // intensity is maximum if closer than hot-spot range
  if (fDistance < fHotSpot) return 1.0f;
  // interpolate if between fall-off and hot-spot range
  return (fFallOff-fDistance)/(fFallOff-fHotSpot);
};

static CTString MakeEmptyString(INDEX ctLen, char ch=' ') {
  char ach[2];
  ach[0] = ch;
  ach[1] = 0;
  CTString strSpaces;
  for (INDEX i=0; i<ctLen; i++) {
    strSpaces+=ach;
  }
  return strSpaces;
};

// take a two line string and align into one line of minimum given length
static INDEX _ctAlignWidth = 20;
static CTString AlignString(const CTString &strOrg)
{
  // split into two lines
  CTString strL = strOrg;
  strL.OnlyFirstLine();
  CTString strR = strOrg;
  strR.RemovePrefix(strL);
  strR.DeleteChar(0);
  
  // get their lengths
  INDEX iLenL = strL.LengthNaked();
  INDEX iLenR = strR.LengthNaked();

  // find number of spaces to insert
  INDEX ctSpaces = _ctAlignWidth-(iLenL+iLenR);
  if (ctSpaces<1) {
    ctSpaces=1;
  }

  // make aligned string
  return strL+MakeEmptyString(ctSpaces)+strR;
}

static CTString CenterString(const CTString &str)
{
  INDEX ctSpaces = (_ctAlignWidth-str.LengthNaked())/2;
  if (ctSpaces<0) {
    ctSpaces=0;
  }
  return MakeEmptyString(ctSpaces)+str;
}

static CTString PadStringRight(const CTString &str, INDEX iLen) {
  INDEX ctSpaces = iLen-str.LengthNaked();
  if (ctSpaces < 0) {
    ctSpaces = 0;
  }
  return str+MakeEmptyString(ctSpaces);
};

static CTString PadStringLeft(const CTString &str, INDEX iLen) {
  INDEX ctSpaces = iLen-str.LengthNaked();
  if (ctSpaces < 0) {
    ctSpaces = 0;
  }
  return MakeEmptyString(ctSpaces)+str;
};

static void KillAllEnemies(CEntity *penKiller) {
  // for each entity in the world
  {FOREACHINDYNAMICCONTAINER(penKiller->GetWorld()->wo_cenEntities, CEntity, iten) {
    CEntity *pen = iten;
    if (IsDerivedFromClass(pen, "Enemy Base") && !IsOfClass(pen, "Devil")) {
      CEnemyBase *penEnemy = (CEnemyBase *)pen;
      if (penEnemy->m_penEnemy==NULL) {
        continue;
      }
      penKiller->InflictDirectDamage(pen, penKiller, DMT_BULLET, 
        penEnemy->GetHealth()+1, pen->GetPlacement().pl_PositionVector, FLOAT3D(0,1,0));
    }
  }}
};


#define HEADING_MAX 45.0f
#define PITCH_MAX   90.0f
#define BANKING_MAX 45.0f

// Player flags
#define PLF_INITIALIZED           (1UL<<0)   // set when player entity is ready to function
#define PLF_VIEWROTATIONCHANGED   (1UL<<1)   // for adjusting view rotation separately from legs
#define PLF_JUMPALLOWED           (1UL<<2)   // if jumping is allowed
#define PLF_SYNCWEAPON            (1UL<<3)   // weapon model needs to be synchronized before rendering
#define PLF_AUTOMOVEMENTS         (1UL<<4)   // complete automatic control of movements
#define PLF_DONTRENDER            (1UL<<5)   // don't render view (used at end of level)
#define PLF_CHANGINGLEVEL         (1UL<<6)   // mark that we next are to appear at start of new level
#define PLF_APPLIEDACTION         (1UL<<7)   // used to detect when player is not connected
#define PLF_NOTCONNECTED          (1UL<<8)   // set if the player is not connected
#define PLF_LEVELSTARTED          (1UL<<9)   // marks that level start time was recorded
#define PLF_ISZOOMING             (1UL<<10)  // marks that player is zoomed in with the sniper
#define PLF_RESPAWNINPLACE        (1UL<<11)  // don't move to marker when respawning (for current death only)

// Defines representing flags used to fill player buttoned actions
#define PLACT_FIRE            (1L<<0)
#define PLACT_RELOAD          (1L<<1)
#define PLACT_WEAPON_NEXT     (1L<<2)
#define PLACT_WEAPON_PREV     (1L<<3)
#define PLACT_WEAPON_FLIP     (1L<<4)
#define PLACT_USE             (1L<<5)
#define PLACT_COMPUTER        (1L<<6)
#define PLACT_3RD_PERSON_VIEW (1L<<7)
#define PLACT_CENTER_VIEW     (1L<<8)
#define PLACT_USE_HELD        (1L<<9)
// [Cecil] Different zoom
#define PLACT_ZOOM       (1L<<10)
#define PLACT_SNIPER_USE (1L<<11)
// [Cecil] Removed FIREBOMB because it doesn't exist anymore
#define PLACT_FLASHLIGHT (1L<<12)
#define PLACT_ALTFIRE    (1L<<13)
#define PLACT_MENU       (1L<<14)
#define PLACT_SELECT_WEAPON_SHIFT (15)
#define PLACT_SELECT_WEAPON_MASK  (0x1FL<<PLACT_SELECT_WEAPON_SHIFT)
                                     
#define MAX_WEAPONS 30

#define PICKEDREPORT_TIME (2.0f) // how long (picked-up) message stays on screen

struct PlayerControls {
  FLOAT3D aRotation;
  FLOAT3D aViewRotation;
  FLOAT3D vTranslation;

  BOOL bMoveForward;
  BOOL bMoveBackward;
  BOOL bMoveLeft;
  BOOL bMoveRight;
  BOOL bMoveUp;
  BOOL bMoveDown;

  BOOL bTurnLeft;
  BOOL bTurnRight;
  BOOL bTurnUp;
  BOOL bTurnDown;
  BOOL bTurnBankingLeft;
  BOOL bTurnBankingRight;
  BOOL bCenterView;

  BOOL bLookLeft;
  BOOL bLookRight;
  BOOL bLookUp;
  BOOL bLookDown;
  BOOL bLookBankingLeft;
  BOOL bLookBankingRight;

  BOOL bSelectWeapon[MAX_WEAPONS+1];
  BOOL bWeaponNext;
  BOOL bWeaponPrev;
  BOOL bWeaponFlip;
  
  BOOL bWalk;
  BOOL bStrafe;
  BOOL bFire;
  BOOL bReload;
  BOOL bUse;
  BOOL bComputer;
  BOOL bUseOrComputer;
  BOOL bUseOrComputerLast;  // for internal use
  BOOL b3rdPersonView;

  BOOL bSniperZoomIn;
  BOOL bSniperZoomOut;

  // [Cecil]
  BOOL bAltFire;
  BOOL bFlashlight;
  BOOL bZoom;
  BOOL bMenu;
};

static struct PlayerControls pctlCurrent;

// cheats
static INDEX cht_iGoToMarker = -1;
static INDEX cht_bKillAll    = FALSE;
static INDEX cht_bGiveAll    = FALSE;
static INDEX cht_bOpen       = FALSE;
static INDEX cht_bAllMessages= FALSE;
static INDEX cht_bRefresh    = FALSE;
extern INDEX cht_bGod        = FALSE;
extern INDEX cht_bFly        = FALSE;
extern INDEX cht_bGhost      = FALSE;
extern INDEX cht_bInvisible  = FALSE;
extern FLOAT cht_fTranslationMultiplier = 1.0f;
extern INDEX cht_bEnable     = 0;

// [Cecil] Own cheats
extern INDEX cht_bRevive = FALSE;
extern FLOAT cht_fDamageMul = 1.0f;

// [Cecil] TEMP: Change materials
static INDEX hl2_bCheckMaterials = FALSE;
extern CBrushPolygon *_pbpoMaterial = NULL;



// interface control
static INDEX hud_bShowAll	    = TRUE; // used internaly in menu/console
extern INDEX hud_bShowWeapon  = TRUE;
extern INDEX hud_bShowMessages = TRUE;
extern INDEX hud_bShowInfo    = TRUE;
extern INDEX hud_bShowLatency = FALSE;
extern INDEX hud_iShowPlayers = -1;   // auto
extern INDEX hud_iSortPlayers = -1;   // auto
extern FLOAT hud_fOpacity     = 0.9f;
extern FLOAT hud_fScaling     = 1.0f;
extern FLOAT hud_tmWeaponsOnScreen = 3.0f;
extern FLOAT hud_tmLatencySnapshot = 1.0f;
extern INDEX hud_bShowMatchInfo = TRUE;

// [Cecil] UI Customization
static FLOAT hl2_fCaptionsWidth = 384.0f;
static INDEX hl2_iHUDPreset = 0;
extern INDEX hl2_bReduceGravityGunFlash;

static void ResetColors(void) {
  INDEX colMain = hl2_colUIMain;
  INDEX colEmpty = hl2_colUIEmpty;
  INDEX colBorder = hl2_colUIBorder;
  hl2_colUIMain   = 0xFFFF008F;
  hl2_colUIEmpty  = 0xFF000000;
  hl2_colUIBorder = 0x0000003F;

  /*CPrintF("hl2_colUIMain   | %X -> %X\n", colMain, hl2_colUIMain);
  CPrintF("hl2_colUIEmpty  | %X -> %X\n", colEmpty, hl2_colUIEmpty);
  CPrintF("hl2_colUIBorder | %X -> %X\n", colBorder, hl2_colUIBorder);*/
};

extern FLOAT plr_fBreathingStrength = 0.0f;
extern FLOAT plr_tmSnoopingTime;
extern INDEX cht_bKillFinalBoss = FALSE;
INDEX cht_bDebugFinalBoss = FALSE;
INDEX cht_bDumpFinalBossData = FALSE;
INDEX cht_bDebugFinalBossAnimations = FALSE;
INDEX cht_bDumpPlayerShading = FALSE;

// misc
static FLOAT plr_fAcceleration = 85.0f; //70.0f;
static FLOAT plr_fDeceleration = 50.0f; //40.0f;
// [Cecil] Replaced by one variable
//static FLOAT plr_fSpeedForward  = 10.0f;
//static FLOAT plr_fSpeedBackward = 10.0f;
//static FLOAT plr_fSpeedSide     = 10.0f;
// [Cecil] 2021-06-19: Made extern for bot mod
extern FLOAT plr_fMoveSpeed = 10.0f;
extern FLOAT plr_fSpeedUp = 11.0f;
static FLOAT plr_fViewHeightStand  = 1.9f;
static FLOAT plr_fViewHeightCrouch = 1.25f; //0.7f;
static FLOAT plr_fViewHeightSwim   = 0.4f;
static FLOAT plr_fViewHeightDive   = 0.0f;
extern FLOAT plr_fViewDampFactor        = 0.4f;
extern FLOAT plr_fViewDampLimitGroundUp = 0.1f;
extern FLOAT plr_fViewDampLimitGroundDn = 0.4f;
extern FLOAT plr_fViewDampLimitWater    = 0.1f;
static FLOAT plr_fFrontClipDistance = 0.25f;
static FLOAT plr_fFOV = 90.0f;
static FLOAT net_tmLatencyAvg;
extern INDEX plr_bRenderPicked = FALSE;
extern INDEX plr_bRenderPickedParticles = FALSE;
extern INDEX plr_bOnlySam = FALSE;
extern INDEX ent_bReportBrokenChains = FALSE;
extern FLOAT ent_tmMentalIn   = 0.5f;
extern FLOAT ent_tmMentalOut  = 0.75f;
extern FLOAT ent_tmMentalFade = 0.5f;

extern FLOAT gfx_fEnvParticlesDensity = 1.0f;
extern FLOAT gfx_fEnvParticlesRange = 1.0f;

// prediction control vars
extern FLOAT cli_fPredictPlayersRange = 0.0f;
extern FLOAT cli_fPredictItemsRange = 3.0f;
extern FLOAT cli_tmPredictFoe = 10.0f;
extern FLOAT cli_tmPredictAlly = 10.0f;
extern FLOAT cli_tmPredictEnemy  = 10.0f;

static FLOAT plr_fSwimSoundDelay = 0.8f;
static FLOAT plr_fDiveSoundDelay = 1.6f;
static FLOAT plr_fWalkSoundDelay = 0.5f;
static FLOAT plr_fRunSoundDelay  = 0.3f;

static FLOAT ctl_tmComputerDoubleClick = 0.5f; // double click delay for calling computer
static FLOAT _tmLastUseOrCompPressed = -10.0f;  // for computer doubleclick

// speeds for button rotation
static FLOAT ctl_fButtonRotationSpeedH = 300.0f;
static FLOAT ctl_fButtonRotationSpeedP = 150.0f;
static FLOAT ctl_fButtonRotationSpeedB = 150.0f;
// modifier for axis strafing
static FLOAT ctl_fAxisStrafingModifier = 1.0f;

// !=NULL if some player wants to call computer
DECL_DLL extern class CPlayer *cmp_ppenPlayer = NULL;
// !=NULL for rendering computer on secondary display in dualhead
DECL_DLL extern class CPlayer *cmp_ppenDHPlayer = NULL;
// set to update current message in background mode (for dualhead)
DECL_DLL extern BOOL cmp_bUpdateInBackground = FALSE;
// set for initial calling computer without rendering game
DECL_DLL extern BOOL cmp_bInitialStart = FALSE;

// game sets this for player hud and statistics and hiscore sound playing
DECL_DLL extern INDEX plr_iHiScore = 0.0f;

// these define address and size of player controls structure
DECL_DLL extern void *ctl_pvPlayerControls = &pctlCurrent;
DECL_DLL extern const SLONG ctl_slPlayerControlsSize = sizeof(pctlCurrent);

// called to compose action packet from current controls
DECL_DLL void ctl_ComposeActionPacket(const CPlayerCharacter &pc, CPlayerAction &paAction, BOOL bPreScan)
{
  // allow double axis controls
  paAction.pa_aRotation += paAction.pa_aViewRotation;

  CPlayerSettings *pps = (CPlayerSettings *)pc.pc_aubAppearance;
//  CPrintF("compose: prescan %d, x:%g\n", bPreScan, paAction.pa_aRotation(1));
  // if strafing
  if (pctlCurrent.bStrafe) {
    // move rotation left/right into translation left/right
    paAction.pa_vTranslation(1) = -paAction.pa_aRotation(1)*ctl_fAxisStrafingModifier;
    paAction.pa_aRotation(1) = 0;
  }
  // if centering view
  if (pctlCurrent.bCenterView) {
    // don't allow moving view up/down
    paAction.pa_aRotation(2) = 0;
  }

  // multiply axis actions with speed
  paAction.pa_vTranslation(1) *= plr_fMoveSpeed; //plr_fSpeedSide;
  paAction.pa_vTranslation(2) *= plr_fSpeedUp;

  if (paAction.pa_vTranslation(3) < 0) {
    paAction.pa_vTranslation(3) *= plr_fMoveSpeed; //plr_fSpeedForward;
  } else {
    paAction.pa_vTranslation(3) *= plr_fMoveSpeed; //plr_fSpeedBackward;
  }

  // find local player, if any
  CPlayer *penThis = NULL;
  INDEX ctPlayers = CEntity::GetMaxPlayers();
  for (INDEX iPlayer = 0; iPlayer<ctPlayers; iPlayer++) {
    CPlayer *pen=(CPlayer *)CEntity::GetPlayerEntity(iPlayer);
    if (pen!=NULL && pen->en_pcCharacter==pc) {
      penThis = pen;
      break;
    }
  }
  // do nothing if not found
  if (penThis == NULL) {
    return;
  }

  // [Cecil] Move the mouse around in the menu instead of the player view
  const BOOL bMenuActive = penThis->m_bHAXMenu;

  if (bMenuActive) {
    // Update mouse render position each render frame
    if (bPreScan) {
      FLOAT2D vMouseMovement(
        +_pInput->GetAxisValue(MOUSE_X_AXIS) * 3.0f,
        -_pInput->GetAxisValue(MOUSE_Y_AXIS) * 3.0f
      );

      // For moving a mouse using a controller or something
      vMouseMovement(1) += paAction.pa_aViewRotation(1);
      vMouseMovement(2) += paAction.pa_aViewRotation(2);

      // Update rendering position
      penThis->m_vMouseRender += vMouseMovement;

      penThis->m_vMouseRender(1) = Clamp(penThis->m_vMouseRender(1), 0.0f, penThis->m_vViewWindow(1));
      penThis->m_vMouseRender(2) = Clamp(penThis->m_vMouseRender(2), 0.0f, penThis->m_vViewWindow(2));
    }

    // Discard view rotation
    paAction.pa_aRotation = paAction.pa_aViewRotation = ANGLE3D(0, 0, 0);
  }

  // accumulate local rotation
  penThis->m_aLocalRotation     += paAction.pa_aRotation;
  penThis->m_aLocalViewRotation += paAction.pa_aViewRotation;
  penThis->m_vLocalTranslation  += paAction.pa_vTranslation;

  // if prescanning
  if (bPreScan) {
    // no button checking
    return;
  }

  // add button movement/rotation/look actions to the axis actions
  if (pctlCurrent.bMoveForward  ) paAction.pa_vTranslation(3) -= plr_fMoveSpeed; //plr_fSpeedForward;
  if (pctlCurrent.bMoveBackward ) paAction.pa_vTranslation(3) += plr_fMoveSpeed; //plr_fSpeedBackward;
  if (pctlCurrent.bMoveLeft  || pctlCurrent.bStrafe&&pctlCurrent.bTurnLeft) paAction.pa_vTranslation(1) -= plr_fMoveSpeed; //plr_fSpeedSide;
  if (pctlCurrent.bMoveRight || pctlCurrent.bStrafe&&pctlCurrent.bTurnRight) paAction.pa_vTranslation(1) += plr_fMoveSpeed; //plr_fSpeedSide;
  if (pctlCurrent.bMoveUp       ) paAction.pa_vTranslation(2) += plr_fSpeedUp;
  if (pctlCurrent.bMoveDown     ) paAction.pa_vTranslation(2) -= plr_fSpeedUp;

  const FLOAT fQuantum = _pTimer->TickQuantum;
  if (pctlCurrent.bTurnLeft  && !pctlCurrent.bStrafe) penThis->m_aLocalRotation(1) += ctl_fButtonRotationSpeedH*fQuantum;
  if (pctlCurrent.bTurnRight && !pctlCurrent.bStrafe) penThis->m_aLocalRotation(1) -= ctl_fButtonRotationSpeedH*fQuantum;
  if (pctlCurrent.bTurnUp           ) penThis->m_aLocalRotation(2) += ctl_fButtonRotationSpeedP*fQuantum;
  if (pctlCurrent.bTurnDown         ) penThis->m_aLocalRotation(2) -= ctl_fButtonRotationSpeedP*fQuantum;
  if (pctlCurrent.bTurnBankingLeft  ) penThis->m_aLocalRotation(3) += ctl_fButtonRotationSpeedB*fQuantum;
  if (pctlCurrent.bTurnBankingRight ) penThis->m_aLocalRotation(3) -= ctl_fButtonRotationSpeedB*fQuantum;

  if (pctlCurrent.bLookLeft         ) penThis->m_aLocalViewRotation(1) += ctl_fButtonRotationSpeedH*fQuantum;
  if (pctlCurrent.bLookRight        ) penThis->m_aLocalViewRotation(1) -= ctl_fButtonRotationSpeedH*fQuantum;
  if (pctlCurrent.bLookUp           ) penThis->m_aLocalViewRotation(2) += ctl_fButtonRotationSpeedP*fQuantum;
  if (pctlCurrent.bLookDown         ) penThis->m_aLocalViewRotation(2) -= ctl_fButtonRotationSpeedP*fQuantum;
  if (pctlCurrent.bLookBankingLeft  ) penThis->m_aLocalViewRotation(3) += ctl_fButtonRotationSpeedB*fQuantum;
  if (pctlCurrent.bLookBankingRight ) penThis->m_aLocalViewRotation(3) -= ctl_fButtonRotationSpeedB*fQuantum;

  // [Cecil] Pass mouse position to set instead of the desired view rotation
  const BOOL bMenuButton = pctlCurrent.bMenu;

  if (bMenuActive && bMenuButton) {
    paAction.pa_aRotation(1) = penThis->m_vMouseRender(1) / penThis->m_vViewWindow(1) * 640.0f;
    paAction.pa_aRotation(2) = penThis->m_vMouseRender(2) / penThis->m_vViewWindow(2) * 480.0f;
    paAction.pa_aRotation(3) = 0;

    paAction.pa_aViewRotation = ANGLE3D(0, 0, 0);

  // use current accumulated rotation
  } else {
    paAction.pa_aRotation     = penThis->m_aLocalRotation;
    paAction.pa_aViewRotation = penThis->m_aLocalViewRotation;
  }

  //paAction.pa_vTranslation  = penThis->m_vLocalTranslation;

  // if walking
  if (pctlCurrent.bWalk) {
    // make forward/backward and sidestep speeds slower
    paAction.pa_vTranslation(3) /= 2.0f;
    paAction.pa_vTranslation(1) /= 2.0f;
  }
  
  // reset all button actions
  paAction.pa_ulButtons = 0;

  // set weapon selection bits
  for (INDEX i = 1; i<MAX_WEAPONS; i++) {
    if (pctlCurrent.bSelectWeapon[i]) {
      paAction.pa_ulButtons = i<<PLACT_SELECT_WEAPON_SHIFT;
      break;
    }
  }

  // [Cecil] Check if server before pressing the button
  if (_pNetwork->IsServer() || GetSP()->sp_iHL2Flags & HL2F_ADMINMENU)
  {
    // When the menu is already active
    if (bMenuActive) {
      // Set the full mask for the mouse click
      if (_pInput->GetButtonState(KID_MOUSE1)) {
        paAction.pa_ulButtons = PLACT_SELECT_WEAPON_MASK;

      // Otherwise check number keys directly and send them as menu buttons
      } else {
        for (INDEX i = 0; i < 10; i++) {
          if (_pInput->GetButtonState(KID_1 + i)) {
            paAction.pa_ulButtons = (i + 1) << PLACT_SELECT_WEAPON_SHIFT;
            break;
          }
        }
      }
    }

    // Request to open the menu
    if (bMenuButton) {
      paAction.pa_ulButtons |= PLACT_MENU;
    }
  }

  // set button pressed flags
  if (pctlCurrent.bWeaponNext) paAction.pa_ulButtons |= PLACT_WEAPON_NEXT;
  if (pctlCurrent.bWeaponPrev) paAction.pa_ulButtons |= PLACT_WEAPON_PREV;
  if (pctlCurrent.bWeaponFlip) paAction.pa_ulButtons |= PLACT_WEAPON_FLIP;
  if (pctlCurrent.bFire)       paAction.pa_ulButtons |= PLACT_FIRE;
  if (pctlCurrent.bAltFire)    paAction.pa_ulButtons |= PLACT_ALTFIRE;
  if (pctlCurrent.bReload)     paAction.pa_ulButtons |= PLACT_RELOAD;
  if (pctlCurrent.bUse)        paAction.pa_ulButtons |= PLACT_USE|PLACT_USE_HELD|PLACT_SNIPER_USE;
  if (pctlCurrent.bComputer)      paAction.pa_ulButtons |= PLACT_COMPUTER;
  if (pctlCurrent.b3rdPersonView) paAction.pa_ulButtons |= PLACT_3RD_PERSON_VIEW;
  if (pctlCurrent.bCenterView)    paAction.pa_ulButtons |= PLACT_CENTER_VIEW;
  // is 'use' being held?
  if (pctlCurrent.bUseOrComputer) paAction.pa_ulButtons |= PLACT_USE_HELD|PLACT_SNIPER_USE;
  //if (pctlCurrent.bSniperZoomIn)  paAction.pa_ulButtons |= PLACT_SNIPER_ZOOMIN;
  //if (pctlCurrent.bSniperZoomOut) paAction.pa_ulButtons |= PLACT_SNIPER_ZOOMOUT;

  // [Cecil]
  if (pctlCurrent.bFlashlight) {
    paAction.pa_ulButtons |= PLACT_FLASHLIGHT;
  }
  if (pctlCurrent.bZoom) {
    paAction.pa_ulButtons |= PLACT_ZOOM;
  }

  // if userorcomp just pressed
  if (pctlCurrent.bUseOrComputer && !pctlCurrent.bUseOrComputerLast) {
    // if double-click is off
    if (ctl_tmComputerDoubleClick == 0 || (pps->ps_ulFlags&PSF_COMPSINGLECLICK)) {
      // press both
      paAction.pa_ulButtons |= PLACT_USE|PLACT_COMPUTER;
    // if double-click is on
    } else {
      // if double click
      if (_pTimer->GetRealTimeTick() <= _tmLastUseOrCompPressed + ctl_tmComputerDoubleClick) {
        // computer pressed
        paAction.pa_ulButtons |= PLACT_COMPUTER;
      // if single click
      } else {
        // use pressed
        paAction.pa_ulButtons |= PLACT_USE;
      }
    }
    _tmLastUseOrCompPressed = _pTimer->GetRealTimeTick();
  }
  // remember old userorcomp pressed state
  pctlCurrent.bUseOrComputerLast = pctlCurrent.bUseOrComputer;
};

void CPlayer_Precache(void)
{
  CDLLEntityClass *pdec = &CPlayer_DLLClass;

  // precache view
  extern void CPlayerView_Precache(void);
  CPlayerView_Precache();

  // precache all player sounds
  pdec->PrecacheSound(SOUND_WATER_ENTER);
  pdec->PrecacheSound(SOUND_WATER_LEAVE);
  pdec->PrecacheSound(SOUND_DIVEIN);
  pdec->PrecacheSound(SOUND_DIVEOUT);
  pdec->PrecacheSound(SOUND_WATERAMBIENT);
  pdec->PrecacheSound(SOUND_WATERBUBBLES);
  pdec->PrecacheSound(SOUND_INFO);
  pdec->PrecacheSound(SOUND_SNIPER_ZOOM);
  pdec->PrecacheSound(SOUND_SNIPER_QZOOM);
  pdec->PrecacheSound(SOUND_SILENCE);
  pdec->PrecacheSound(SOUND_POWERUP_BEEP);
  pdec->PrecacheSound(SOUND_BLOWUP);

  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_TELEPORT);

  pdec->PrecacheModel(MODEL_FLESH);
  pdec->PrecacheModel(MODEL_FLESH_APPLE);
  pdec->PrecacheModel(MODEL_FLESH_BANANA);
  pdec->PrecacheModel(MODEL_FLESH_BURGER);
  pdec->PrecacheTexture(TEXTURE_FLESH_RED);
  pdec->PrecacheTexture(TEXTURE_FLESH_GREEN);
  pdec->PrecacheTexture(TEXTURE_FLESH_APPLE); 
  pdec->PrecacheTexture(TEXTURE_FLESH_BANANA);
  pdec->PrecacheTexture(TEXTURE_FLESH_BURGER);
  pdec->PrecacheTexture(TEXTURE_FLESH_LOLLY); 
  pdec->PrecacheTexture(TEXTURE_FLESH_ORANGE); 

  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BLOODSPILL);
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BLOODSTAIN);
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BLOODSTAINGROW);
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BLOODEXPLODE);

  // [Cecil] Wound sounds
  pdec->PrecacheSound(SOUND_DROWN1);
  pdec->PrecacheSound(SOUND_DROWN2);
  pdec->PrecacheSound(SOUND_DROWN3);
  pdec->PrecacheSound(SOUND_BURNPAIN1);
  pdec->PrecacheSound(SOUND_BURNPAIN2);
  pdec->PrecacheSound(SOUND_BURNPAIN3);
  pdec->PrecacheSound(SOUND_FALLPAIN1);
  pdec->PrecacheSound(SOUND_FALLPAIN2);
  pdec->PrecacheSound(SOUND_PAIN1);
  pdec->PrecacheSound(SOUND_PAIN2);
  pdec->PrecacheSound(SOUND_PAIN3);

  // [Cecil] Swimming sounds
  pdec->PrecacheSound(SOUND_WADE1);
  pdec->PrecacheSound(SOUND_WADE2);
  pdec->PrecacheSound(SOUND_WADE3);
  pdec->PrecacheSound(SOUND_WADE4);
  pdec->PrecacheSound(SOUND_WADE5);
  pdec->PrecacheSound(SOUND_WADE6);
  pdec->PrecacheSound(SOUND_WADE7);
  pdec->PrecacheSound(SOUND_WADE8);

  pdec->PrecacheSound(SOUND_FLATLINE);
  pdec->PrecacheSound(SOUND_APPLY);
  pdec->PrecacheSound(SOUND_DENY);

  // [Cecil] Material sounds
  for (INDEX iMaterialSound = SOUND_SLOSH1; iMaterialSound < SOUND_SILENCE; iMaterialSound++) {
    pdec->PrecacheSound(iMaterialSound);
  }

  // [Cecil] Flashlight
  pdec->PrecacheModel(MODEL_FLASHLIGHT);
  pdec->PrecacheTexture(TEXTURE_POINT_LIGHT);
  pdec->PrecacheTexture(TEXTURE_AMBIENT_LIGHT);
  pdec->PrecacheSound(SOUND_FLASHLIGHT);

  // [Cecil] Pickup sounds
  pdec->PrecacheSound(SOUND_MEDSHOT);
  pdec->PrecacheSound(SOUND_MEDKIT);
  pdec->PrecacheSound(SOUND_SUITBATTERY);
  pdec->PrecacheSound(SOUND_SUITCHARGE);
  pdec->PrecacheSound(SOUND_SUITBELL);
  pdec->PrecacheSound(SOUND_SUITMUSIC);

  // [Cecil] Suit sounds
  pdec->PrecacheSound(SOUND_SUIT_AMMO);
  pdec->PrecacheSound(SOUND_SUIT_HEAT);
  pdec->PrecacheSound(SOUND_SUIT_SHOCK);
  pdec->PrecacheSound(SOUND_SUIT_ARMOR);
  pdec->PrecacheSound(SOUND_SUIT_DEATH);
  pdec->PrecacheSound(SOUND_SUIT_MEDIC);
  pdec->PrecacheSound(SOUND_SUIT_CRITICAL);
  pdec->PrecacheSound(SOUND_SUIT_MAJOR);
  pdec->PrecacheSound(SOUND_SUIT_MINOR);

  // [Cecil] Roller Mine
  pdec->PrecacheClass(CLASS_ROLLERMINE);
  // [Cecil] Radio
  pdec->PrecacheClass(CLASS_RADIO);

  // [Cecil] Precache items
  extern void CItem_Precache(void);
  extern void CAmmoItem_Precache(void);
  extern void CAmmoPack_Precache(void);
  extern void CArmorItem_Precache(void);
  extern void CHealthItem_Precache(void);
  extern void CPowerUpItem_Precache(void);
  extern void CWeaponItem_Precache(void);
  CItem_Precache();
  CAmmoItem_Precache();
  CAmmoPack_Precache();
  CArmorItem_Precache();
  CHealthItem_Precache();
  CPowerUpItem_Precache();
  CWeaponItem_Precache();
};

void CPlayer_OnInitClass(void)
{
  // clear current player controls
  memset(&pctlCurrent, 0, sizeof(pctlCurrent));
  // declare player control variables
  _pShell->DeclareSymbol("user INDEX ctl_bMoveForward;",  &pctlCurrent.bMoveForward);
  _pShell->DeclareSymbol("user INDEX ctl_bMoveBackward;", &pctlCurrent.bMoveBackward);
  _pShell->DeclareSymbol("user INDEX ctl_bMoveLeft;",     &pctlCurrent.bMoveLeft);
  _pShell->DeclareSymbol("user INDEX ctl_bMoveRight;",    &pctlCurrent.bMoveRight);
  _pShell->DeclareSymbol("user INDEX ctl_bMoveUp;",       &pctlCurrent.bMoveUp);
  _pShell->DeclareSymbol("user INDEX ctl_bMoveDown;",     &pctlCurrent.bMoveDown);
  _pShell->DeclareSymbol("user INDEX ctl_bTurnLeft;",         &pctlCurrent.bTurnLeft);
  _pShell->DeclareSymbol("user INDEX ctl_bTurnRight;",        &pctlCurrent.bTurnRight);
  _pShell->DeclareSymbol("user INDEX ctl_bTurnUp;",           &pctlCurrent.bTurnUp);
  _pShell->DeclareSymbol("user INDEX ctl_bTurnDown;",         &pctlCurrent.bTurnDown);
  _pShell->DeclareSymbol("user INDEX ctl_bTurnBankingLeft;",  &pctlCurrent.bTurnBankingLeft);
  _pShell->DeclareSymbol("user INDEX ctl_bTurnBankingRight;", &pctlCurrent.bTurnBankingRight);
  _pShell->DeclareSymbol("user INDEX ctl_bCenterView;",       &pctlCurrent.bCenterView);
  _pShell->DeclareSymbol("user INDEX ctl_bLookLeft;",         &pctlCurrent.bLookLeft);
  _pShell->DeclareSymbol("user INDEX ctl_bLookRight;",        &pctlCurrent.bLookRight);
  _pShell->DeclareSymbol("user INDEX ctl_bLookUp;",           &pctlCurrent.bLookUp);
  _pShell->DeclareSymbol("user INDEX ctl_bLookDown;",         &pctlCurrent.bLookDown);
  _pShell->DeclareSymbol("user INDEX ctl_bLookBankingLeft;",  &pctlCurrent.bLookBankingLeft);
  _pShell->DeclareSymbol("user INDEX ctl_bLookBankingRight;", &pctlCurrent.bLookBankingRight );
  _pShell->DeclareSymbol("user INDEX ctl_bWalk;",           &pctlCurrent.bWalk);
  _pShell->DeclareSymbol("user INDEX ctl_bStrafe;",         &pctlCurrent.bStrafe);
  _pShell->DeclareSymbol("user INDEX ctl_bFire;",           &pctlCurrent.bFire);
  _pShell->DeclareSymbol("user INDEX ctl_bAltFire;",        &pctlCurrent.bAltFire); // [Cecil] Alt Fire
  _pShell->DeclareSymbol("user INDEX ctl_bReload;",         &pctlCurrent.bReload);
  _pShell->DeclareSymbol("user INDEX ctl_bUse;",            &pctlCurrent.bUse);
  _pShell->DeclareSymbol("user INDEX ctl_bComputer;",       &pctlCurrent.bComputer);
  _pShell->DeclareSymbol("user INDEX ctl_bUseOrComputer;",  &pctlCurrent.bUseOrComputer);
  _pShell->DeclareSymbol("user INDEX ctl_b3rdPersonView;",  &pctlCurrent.b3rdPersonView);
  _pShell->DeclareSymbol("user INDEX ctl_bWeaponNext;",         &pctlCurrent.bWeaponNext);
  _pShell->DeclareSymbol("user INDEX ctl_bWeaponPrev;",         &pctlCurrent.bWeaponPrev);
  _pShell->DeclareSymbol("user INDEX ctl_bWeaponFlip;",         &pctlCurrent.bWeaponFlip);
  _pShell->DeclareSymbol("user INDEX ctl_bSelectWeapon[30+1];", &pctlCurrent.bSelectWeapon);
  _pShell->DeclareSymbol("persistent user FLOAT ctl_tmComputerDoubleClick;", &ctl_tmComputerDoubleClick);
  _pShell->DeclareSymbol("persistent user FLOAT ctl_fButtonRotationSpeedH;", &ctl_fButtonRotationSpeedH);
  _pShell->DeclareSymbol("persistent user FLOAT ctl_fButtonRotationSpeedP;", &ctl_fButtonRotationSpeedP);
  _pShell->DeclareSymbol("persistent user FLOAT ctl_fButtonRotationSpeedB;", &ctl_fButtonRotationSpeedB);
  _pShell->DeclareSymbol("persistent user FLOAT ctl_fAxisStrafingModifier;", &ctl_fAxisStrafingModifier);
  
  // new
  //_pShell->DeclareSymbol("user INDEX ctl_bSniperZoomIn;",  &pctlCurrent.bSniperZoomIn);
  //_pShell->DeclareSymbol("user INDEX ctl_bSniperZoomOut;", &pctlCurrent.bSniperZoomOut);
  _pShell->DeclareSymbol("user INDEX ctl_bFlashlight;", &pctlCurrent.bFlashlight); // [Cecil] Flashlight
  _pShell->DeclareSymbol("user INDEX ctl_bZoom;",       &pctlCurrent.bZoom); // [Cecil] Suit Zoom
  _pShell->DeclareSymbol("user INDEX ctl_bMenu;",       &pctlCurrent.bMenu); // [Cecil] Menu Activation

  _pShell->DeclareSymbol("user FLOAT plr_fSwimSoundDelay;", &plr_fSwimSoundDelay);
  _pShell->DeclareSymbol("user FLOAT plr_fDiveSoundDelay;", &plr_fDiveSoundDelay);
  _pShell->DeclareSymbol("user FLOAT plr_fWalkSoundDelay;", &plr_fWalkSoundDelay);
  _pShell->DeclareSymbol("user FLOAT plr_fRunSoundDelay;",  &plr_fRunSoundDelay);

  _pShell->DeclareSymbol("persistent user FLOAT cli_fPredictPlayersRange;",&cli_fPredictPlayersRange);
  _pShell->DeclareSymbol("persistent user FLOAT cli_fPredictItemsRange;",  &cli_fPredictItemsRange  );
  _pShell->DeclareSymbol("persistent user FLOAT cli_tmPredictFoe;",        &cli_tmPredictFoe        );
  _pShell->DeclareSymbol("persistent user FLOAT cli_tmPredictAlly;",       &cli_tmPredictAlly       );
  _pShell->DeclareSymbol("persistent user FLOAT cli_tmPredictEnemy;",      &cli_tmPredictEnemy      );

  _pShell->DeclareSymbol("     INDEX hud_bShowAll;",     &hud_bShowAll);
  _pShell->DeclareSymbol("user INDEX hud_bShowInfo;",    &hud_bShowInfo);
  _pShell->DeclareSymbol("user const FLOAT net_tmLatencyAvg;", &net_tmLatencyAvg);
  _pShell->DeclareSymbol("persistent user INDEX hud_bShowLatency;", &hud_bShowLatency);
  _pShell->DeclareSymbol("persistent user INDEX hud_iShowPlayers;", &hud_iShowPlayers);
  _pShell->DeclareSymbol("persistent user INDEX hud_iSortPlayers;", &hud_iSortPlayers);
  _pShell->DeclareSymbol("persistent user INDEX hud_bShowWeapon;",  &hud_bShowWeapon);
  _pShell->DeclareSymbol("persistent user INDEX hud_bShowMessages;",&hud_bShowMessages);
  _pShell->DeclareSymbol("persistent user FLOAT hud_fScaling;",     &hud_fScaling);
  _pShell->DeclareSymbol("persistent user FLOAT hud_fOpacity;",     &hud_fOpacity);
  _pShell->DeclareSymbol("persistent user FLOAT hud_tmWeaponsOnScreen;",  &hud_tmWeaponsOnScreen);
  _pShell->DeclareSymbol("persistent user FLOAT hud_tmLatencySnapshot;",  &hud_tmLatencySnapshot);
  _pShell->DeclareSymbol("persistent user FLOAT plr_fBreathingStrength;", &plr_fBreathingStrength);
  _pShell->DeclareSymbol("INDEX cht_bKillFinalBoss;",  &cht_bKillFinalBoss);
  _pShell->DeclareSymbol("INDEX cht_bDebugFinalBoss;", &cht_bDebugFinalBoss);
  _pShell->DeclareSymbol("INDEX cht_bDumpFinalBossData;", &cht_bDumpFinalBossData);
  _pShell->DeclareSymbol("INDEX cht_bDebugFinalBossAnimations;", &cht_bDebugFinalBossAnimations);
  _pShell->DeclareSymbol("INDEX cht_bDumpPlayerShading;", &cht_bDumpPlayerShading);
  _pShell->DeclareSymbol("persistent user INDEX hud_bShowMatchInfo;", &hud_bShowMatchInfo);

  // [Cecil] UI Customization
  _pShell->DeclareSymbol("persistent user INDEX hl2_colUIMain;", &hl2_colUIMain);
  _pShell->DeclareSymbol("persistent user INDEX hl2_colUIEmpty;", &hl2_colUIEmpty);
  _pShell->DeclareSymbol("persistent user INDEX hl2_colUIBorder;", &hl2_colUIBorder);
  _pShell->DeclareSymbol("persistent user FLOAT hl2_fCaptionsWidth;", &hl2_fCaptionsWidth);
  _pShell->DeclareSymbol("user void hl2_ResetColors(void);", &ResetColors);
  _pShell->DeclareSymbol("persistent user INDEX hl2_iHUDPreset;", &hl2_iHUDPreset);

  // cheats
  _pShell->DeclareSymbol("user INDEX cht_bGod;",       &cht_bGod);
  _pShell->DeclareSymbol("user INDEX cht_bFly;",       &cht_bFly);
  _pShell->DeclareSymbol("user INDEX cht_bGhost;",     &cht_bGhost);
  _pShell->DeclareSymbol("user INDEX cht_bInvisible;", &cht_bInvisible);
  _pShell->DeclareSymbol("user INDEX cht_bGiveAll;",   &cht_bGiveAll);
  _pShell->DeclareSymbol("user INDEX cht_bKillAll;",   &cht_bKillAll);
  _pShell->DeclareSymbol("user INDEX cht_bOpen;",      &cht_bOpen);
  _pShell->DeclareSymbol("user INDEX cht_bAllMessages;", &cht_bAllMessages);
  _pShell->DeclareSymbol("user FLOAT cht_fTranslationMultiplier ;", &cht_fTranslationMultiplier);
  _pShell->DeclareSymbol("user INDEX cht_bRefresh;", &cht_bRefresh);
  // this one is masqueraded cheat enable variable
  _pShell->DeclareSymbol("INDEX cht_bEnable;", &cht_bEnable);

  // [Cecil] Own cheats
  _pShell->DeclareSymbol("user INDEX cht_bRevive;", &cht_bRevive);
  _pShell->DeclareSymbol("user FLOAT cht_fDamageMul;", &cht_fDamageMul);

  // [Cecil] TEMP: Change Materials
  _pShell->DeclareSymbol("user INDEX _bMaterialCheck;", &hl2_bCheckMaterials);
  _pShell->DeclareSymbol("user void SetMaterial(INDEX, INDEX);", &SetMaterial);
  _pShell->DeclareSymbol("user void RemoveMaterial(INDEX);", &RemoveMaterial);
  _pShell->DeclareSymbol("user void ResaveMaterials(void);", &SaveMaterials);
  _pShell->DeclareSymbol("user void SwitchMaterialConfig(INDEX);", &SwitchMaterialConfig);
  _pShell->DeclareSymbol("user void MaterialsHelp(void);", &MaterialsHelp);

  // this cheat is always enabled
  _pShell->DeclareSymbol("user INDEX cht_iGoToMarker;", &cht_iGoToMarker);

  // player speed and view parameters, not declared except in internal build
  #if 0
    _pShell->DeclareSymbol("user FLOAT plr_fViewHeightStand;", &plr_fViewHeightStand);
    _pShell->DeclareSymbol("user FLOAT plr_fViewHeightCrouch;",&plr_fViewHeightCrouch);
    _pShell->DeclareSymbol("user FLOAT plr_fViewHeightSwim;",  &plr_fViewHeightSwim);
    _pShell->DeclareSymbol("user FLOAT plr_fViewHeightDive;",  &plr_fViewHeightDive);
    _pShell->DeclareSymbol("user FLOAT plr_fViewDampFactor;",         &plr_fViewDampFactor);
    _pShell->DeclareSymbol("user FLOAT plr_fViewDampLimitGroundUp;",  &plr_fViewDampLimitGroundUp);
    _pShell->DeclareSymbol("user FLOAT plr_fViewDampLimitGroundDn;",  &plr_fViewDampLimitGroundDn);
    _pShell->DeclareSymbol("user FLOAT plr_fViewDampLimitWater;",     &plr_fViewDampLimitWater);
    _pShell->DeclareSymbol("user FLOAT plr_fAcceleration;",  &plr_fAcceleration);
    _pShell->DeclareSymbol("user FLOAT plr_fDeceleration;",  &plr_fDeceleration);
    //_pShell->DeclareSymbol("user FLOAT plr_fSpeedForward;",  &plr_fSpeedForward);
    //_pShell->DeclareSymbol("user FLOAT plr_fSpeedBackward;", &plr_fSpeedBackward);
    //_pShell->DeclareSymbol("user FLOAT plr_fSpeedSide;",     &plr_fSpeedSide);
    _pShell->DeclareSymbol("user FLOAT plr_fSpeedUp;",       &plr_fSpeedUp);
  #endif

  _pShell->DeclareSymbol("persistent user FLOAT plr_fFOV;", &plr_fFOV);
  _pShell->DeclareSymbol("persistent user FLOAT plr_fFrontClipDistance;", &plr_fFrontClipDistance);
  _pShell->DeclareSymbol("persistent user INDEX plr_bRenderPicked;", &plr_bRenderPicked);
  _pShell->DeclareSymbol("persistent user INDEX plr_bRenderPickedParticles;", &plr_bRenderPickedParticles);
  _pShell->DeclareSymbol("persistent user INDEX plr_bOnlySam;", &plr_bOnlySam);
  _pShell->DeclareSymbol("persistent user INDEX ent_bReportBrokenChains;", &ent_bReportBrokenChains);
  _pShell->DeclareSymbol("persistent user FLOAT ent_tmMentalIn  ;", &ent_tmMentalIn  );
  _pShell->DeclareSymbol("persistent user FLOAT ent_tmMentalOut ;", &ent_tmMentalOut );
  _pShell->DeclareSymbol("persistent user FLOAT ent_tmMentalFade;", &ent_tmMentalFade);
  _pShell->DeclareSymbol("persistent user FLOAT gfx_fEnvParticlesDensity;", &gfx_fEnvParticlesDensity);
  _pShell->DeclareSymbol("persistent user FLOAT gfx_fEnvParticlesRange;", &gfx_fEnvParticlesRange);

  // player appearance interface
  _pShell->DeclareSymbol("INDEX SetPlayerAppearance(INDEX, INDEX, INDEX, INDEX);", &SetPlayerAppearance);

  // call player weapons persistant variable initialization
  extern void CPlayerWeapons_Init(void);
  CPlayerWeapons_Init();

  // initialize HUD
  InitHUD();

  // [Cecil] Load HAX menu textures
  try {
    _toHAXMenu.SetData_t(CTFILENAME("Textures\\Interface\\HAXMenu.tex"));
    _toMenuPointer.SetData_t(CTFILENAME("TexturesMP\\General\\Pointer.tex"));

    ((CTextureData *)_toHAXMenu.GetData())->Force(TEX_CONSTANT);
    ((CTextureData *)_toMenuPointer.GetData())->Force(TEX_CONSTANT);

  } catch (char *strError) {
    FatalError(strError);
  }

  // precache
  CPlayer_Precache();
}

// clean up
void CPlayer_OnEndClass(void) {
  EndHUD();
};

CTString GetDifficultyString(void) {
  if (GetSP()->sp_bMental) { return TRANS("Mental"); }

  switch (GetSP()->sp_gdGameDifficulty) {
    case CSessionProperties::GD_TOURIST: return TRANS("Tourist");
    case CSessionProperties::GD_EASY:    return TRANS("Easy");
    default:
    case CSessionProperties::GD_NORMAL:  return TRANS("Normal");
    case CSessionProperties::GD_HARD:    return TRANS("Hard");
    case CSessionProperties::GD_EXTREME: return TRANS("Serious");
  }
};
// armor & health constants getters

FLOAT MaxArmor(void) {
  if (GetSP()->sp_gdGameDifficulty<=CSessionProperties::GD_EASY) {
    return 300;
  } else {
    return 200;
  }
};

FLOAT TopArmor(void) {
  if (GetSP()->sp_gdGameDifficulty<=CSessionProperties::GD_EASY) {
    return 200;
  } else {
    return 100;
  }
};

FLOAT MaxHealth(void) {
  if (GetSP()->sp_gdGameDifficulty<=CSessionProperties::GD_EASY) {
    return 300;
  } else {
    return 200;
  }
};

FLOAT TopHealth(void) {
  if (GetSP()->sp_gdGameDifficulty<=CSessionProperties::GD_EASY) {
    return 200;
  } else {
    return 100;
  }
};

// info structure
static EntityInfo eiPlayerGround = {
  EIBT_FLESH, 80.0f,
  0.0f, 1.7f, 0.0f,     // source (eyes)
  0.0f, 1.0f, 0.0f,     // target (body)
};
static EntityInfo eiPlayerCrouch = {
  EIBT_FLESH, 80.0f,
  0.0f, 1.2f, 0.0f,     // source (eyes)
  0.0f, 0.7f, 0.0f,     // target (body)
};
static EntityInfo eiPlayerSwim = {
  EIBT_FLESH, 40.0f,
  0.0f, 0.0f, 0.0f,     // source (eyes)
  0.0f, 0.0f, 0.0f,     // target (body)
};


// animation light specific
#define LIGHT_ANIM_FIRE 0 // [Cecil] Replaced all animations with this single one
#define LIGHT_ANIM_NONE 1

const char *NameForState(PlayerState pst) {
  switch(pst) {
    case PST_STAND: return "stand";
    case PST_CROUCH: return "crouch";
    case PST_FALL: return "fall";
    case PST_SWIM: return "swim";
    case PST_DIVE: return "dive";
    default: return "???";
  }
};

// print explanation on how a player died
void PrintPlayerDeathMessage(CPlayer *ppl, const EDeath &eDeath) {
  CTString strMyName;
  // [Cecil] Reset tag
  strMyName.PrintF("%s^r", ppl->GetPlayerName());

  CEntity *penKiller = eDeath.eLastDamage.penInflictor;
  // if killed by a valid entity
  if (penKiller != NULL) {
    // if killed by a player
    if (IS_PLAYER(penKiller)) {
      // if not self
      if (penKiller != ppl) {
        CTString strKillerName;
        // [Cecil] Reset tag
        strKillerName.PrintF("%s^r", ((CPlayer*)penKiller)->GetPlayerName());

        // [Cecil] Replaced if-else with switch-case
        switch (eDeath.eLastDamage.dmtType) {
          case DMT_TELEPORT:
            CPrintF(TRANS("%s telefragged %s\n"), strKillerName, strMyName);
            break;

          case DMT_CLOSERANGE:
            CPrintF(TRANS("%s cut %s into pieces\n"), strKillerName, strMyName);
            break;

          case DMT_CHAINSAW:
            CPrintF(TRANS("%s cut %s into pieces\n"), strKillerName, strMyName);
            break;

          // [Cecil] DMT_RIFLE
          case DMT_BULLET: case DMT_RIFLE:
            CPrintF(TRANS("%s poured lead into %s\n"), strKillerName, strMyName);
            break;

          case DMT_PROJECTILE: case DMT_EXPLOSION:
            CPrintF(TRANS("%s blew %s away\n"), strKillerName, strMyName);
            break;

          case DMT_CANNONBALL:
            CPrintF(TRANS("%s smashed %s with a cannon\n"), strKillerName, strMyName);
            break;

          case DMT_CANNONBALL_EXPLOSION:
            CPrintF(TRANS("%s nuked %s\n"), strKillerName, strMyName);
            break;

          case DMT_ACID:
            CPrintF(TRANS("%s dissolved %s\n"), strKillerName, strMyName);
            break;

          default:
            CPrintF(TRANS("%s killed %s\n"), strKillerName, strMyName);
        }

      } else {
        // make message from damage type
        switch(eDeath.eLastDamage.dmtType) {
          case DMT_DROWNING:
            CPrintF(TRANS("%s drowned\n"), strMyName);
            break;

          case DMT_BURNING:
            CPrintF(TRANS("%s burst into flames\n"), strMyName);
            break;

          case DMT_SPIKESTAB:
            CPrintF(TRANS("%s fell into a spike-hole\n"), strMyName);
            break;

          case DMT_FREEZING:
            CPrintF(TRANS("%s has frozen\n"), strMyName);
            break;

          case DMT_PROJECTILE:
          case DMT_EXPLOSION:
            CPrintF(TRANS("%s blew themselves away\n"), strMyName);
            break;

          case DMT_ACID:
            CPrintF(TRANS("%s has dissolved\n"), strMyName);
            break;

          default:
            CPrintF(TRANS("%s has committed suicide\n"), strMyName);
        }
      }
    // if killed by an enemy
    } else if (IsDerivedFromClass(penKiller, "Enemy Base")) {
      // check for telefrag first
      if (eDeath.eLastDamage.dmtType == DMT_TELEPORT) {
        CPrintF(TRANS("%s was telefragged\n"), strMyName);
        return;
      }

      // describe how this enemy killed player
      CPrintF("%s\n", (const char*)((CEnemyBase*)penKiller)->GetPlayerKillDescription(strMyName, eDeath));

    // if killed by some other entity
    } else {
      // make message from damage type
      switch (eDeath.eLastDamage.dmtType) {
        case DMT_SPIKESTAB: CPrintF(TRANS("%s was pierced\n"), strMyName); break;
        case DMT_BRUSH:     CPrintF(TRANS("%s was squashed\n"), strMyName); break;
        case DMT_ABYSS:     CPrintF(TRANS("%s went over the edge\n"), strMyName); break;
        case DMT_IMPACT:    CPrintF(TRANS("%s swashed\n"), strMyName); break;
        case DMT_HEAT:      CPrintF(TRANS("%s stood in the sun for too long\n"), strMyName); break;
        default:            CPrintF(TRANS("%s passed away\n"), strMyName);
      }
    }
  // if no entity pointer (shouldn't happen)
  } else {
    CPrintF(TRANS("%s is missing in action\n"), strMyName);
  }
}
%}

class export CPlayer : CCecilPlayerEntity {
name      "Player";
thumbnail "";
features  "ImplementsOnInitClass", "ImplementsOnEndClass", "CanBePredictable";

properties:
  1 CTString m_strName "Name" = "<unnamed player>",
  2 COLOR m_ulLastButtons = 0x0,              // buttons last pressed
  3 FLOAT m_fArmor = 0.0f,                    // armor
  4 CTString m_strGroup = "",                 // group name for world change
  5 INDEX m_ulKeys = 0,                       // mask for all picked-up keys
  6 FLOAT m_fMaxHealth = 1,                 // default health supply player can have
  7 INDEX m_ulFlags = 0,                      // various flags
  
 16 CEntityPointer m_penWeapons,              // player weapons
 17 CEntityPointer m_penAnimator,             // player animator
 18 CEntityPointer m_penView,                 // player view
 19 CEntityPointer m_pen3rdPersonView,        // player 3rd person view
 20 INDEX m_iViewState=PVT_PLAYEREYES,        // view state
 21 INDEX m_iLastViewState=PVT_PLAYEREYES,    // last view state

 26 CAnimObject m_aoLightAnimation,           // light animation object
 27 FLOAT m_fDamageAmmount = 0.0f,            // how much was last wound
 28 FLOAT m_tmWoundedTime  = 0.0f,            // when was last wound
 29 FLOAT m_tmScreamTime   = 0.0f,            // when was last wound sound played

 34 enum PlayerState m_pstState = PST_STAND,  // current player state
 35 FLOAT m_fFallTime = 0.0f,                 // time passed when falling
 36 FLOAT m_fSwimTime = 0.0f,                 // time when started swimming
 45 FLOAT m_tmOutOfWater = 0.0f,              // time when got out of water last time
 37 FLOAT m_tmMoveSound = 0.0f,           // last time move sound was played
 38 BOOL  m_bMoveSoundLeft = TRUE,        // left or right walk channel is current
 39 FLOAT m_tmNextAmbientOnce = 0.0f,     // next time to play local ambient sound
 43 FLOAT m_tmMouthSoundLast = 0.0f,      // time last played some repeating mouth sound

 40 CEntityPointer m_penCamera,           // camera for current cinematic sequence, or null

// [Cecil] New message system
 //41 CTString m_strCenterMessage = "",     // center message
 //42 FLOAT m_tmCenterMessageEnd = 0.0f,    // last time to show centered message

 48 BOOL m_bPendingMessage = FALSE,   // message sound pending to be played
 47 FLOAT m_tmMessagePlay = 0.0f,     // when to play the message sound
 49 FLOAT m_tmAnalyseEnd = 0.0f,      // last time to show analysation
 50 BOOL m_bComputerInvoked = FALSE,  // set if computer was invoked at least once
 57 FLOAT m_tmAnimateInbox = -100.0f,      // show animation of inbox icon animation
 
 44 CEntityPointer m_penMainMusicHolder,

 51 FLOAT m_tmLastDamage = -1.0f,
 52 FLOAT m_fMaxDamageAmmount = 0.0f,
 53 FLOAT3D m_vDamage = FLOAT3D(0,0,0),
 54 FLOAT m_tmSpraySpawned = -1.0f,
 55 FLOAT m_fSprayDamage = 0.0f,
 56 CEntityPointer m_penSpray,

 70 CSoundObject m_soMouth, // breating, yelling etc.
 71 CSoundObject m_soFootL, // walking etc.
 72 CSoundObject m_soFootR,
 73 CSoundObject m_soBody, // splashing etc.
 74 CSoundObject m_soLocalAmbientLoop, // local ambient that only this player hears
 75 CSoundObject m_soLocalAmbientOnce, // local ambient that only this player hears
 76 CSoundObject m_soMessage,  // message sounds
 78 CSoundObject m_soSpeech,   // for quotes
 79 CSoundObject m_soSniperZoom, // for sniper zoom sound

 81 INDEX m_iMana    = 0,        // current score worth for killed player
 94 FLOAT m_fManaFraction = 0.0f,// fractional part of mana, for slow increase with time
 84 INDEX m_iHighScore = 0,      // internal hiscore for demo playing
 85 INDEX m_iBeatenHighScore = 0,    // hiscore that was beaten
 89 FLOAT m_tmLatency = 0.0f,               // player-server latency (in seconds)
 // for latency averaging
 88 FLOAT m_tmLatencyLastAvg = 0.0f, 
 87 FLOAT m_tmLatencyAvgSum = 0.0f, 
 86 INDEX m_ctLatencyAvg = 0, 

 96 BOOL  m_bEndOfLevel = FALSE,
 97 BOOL  m_bEndOfGame  = FALSE,
 98 INDEX m_iMayRespawn = 0,     // must get to 2 to be able to respawn
 99 FLOAT m_tmSpawned = 0.0f,   // when player was spawned
 100 FLOAT3D m_vDied = FLOAT3D(0,0,0),  // where player died (for respawn in-place)
 101 FLOAT3D m_aDied = FLOAT3D(0,0,0),

 // statistics
 103 FLOAT m_tmEstTime  = 0.0f,   // time estimated for this level
 105 INDEX m_iTimeScore = 0,
 106 INDEX m_iStartTime = 0,      // game start time (ansi c time_t type)
 107 INDEX m_iEndTime   = 0,      // game end time (ansi c time_t type)
 108 FLOAT m_tmLevelStarted = 0.0f,  // game time when level started
 93 CTString m_strLevelStats = "",  // detailed statistics for each level

 // auto action vars
 110 CEntityPointer m_penActionMarker,  // current marker for auto actions
 111 FLOAT m_fAutoSpeed = 0.0f, // speed to go towards the marker
 112 INDEX m_iAutoOrgWeapon = 0, // original weapon for autoactions
 113 FLOAT3D m_vAutoSpeed = FLOAT3D(0,0,0),
 114 FLOAT m_tmSpiritStart = 0.0f,
 115 FLOAT m_tmFadeStart = 0.0f,

 // 'picked up' display vars
 120 FLOAT m_tmLastPicked = -10000.0f,  // when something was last picked up
 121 CTString m_strPickedName = "",     // name of item picked
 122 FLOAT m_fPickedAmmount = 0.0f,     // total picked ammount
 123 FLOAT m_fPickedMana = 0.0f,        // total picked mana

 // shaker values
 130 INDEX m_iLastHealth = 0,
 131 INDEX m_iLastArmor  = 0,
 132 INDEX m_iLastAmmo   = 0,
 135 FLOAT m_tmHealthChanged = -100,
 136 FLOAT m_tmArmorChanged  = -100,
 137 FLOAT m_tmAmmoChanged   = -100,
 
 138 FLOAT m_tmMinigunAutoFireStart = -1.0f,

 150 FLOAT3D m_vLastStain  = FLOAT3D(0,0,0), // where last stain was left
   
 // for mouse lag elimination via prescanning
 151 ANGLE3D m_aLastRotation = FLOAT3D(0,0,0),
 152 ANGLE3D m_aLastViewRotation = FLOAT3D(0,0,0),
 153 FLOAT3D m_vLastTranslation = FLOAT3D(0,0,0),
 154 ANGLE3D m_aLocalRotation = FLOAT3D(0,0,0),
 155 ANGLE3D m_aLocalViewRotation = FLOAT3D(0,0,0),
 156 FLOAT3D m_vLocalTranslation = FLOAT3D(0,0,0),

 // powerups (DO NOT CHANGE ORDER!) - needed by HUD.cpp
 160 FLOAT m_tmInvisibility    = 0.0f, 
 161 FLOAT m_tmInvulnerability = 0.0f, 
 162 FLOAT m_tmSeriousDamage   = 0.0f, 
 163 FLOAT m_tmSeriousSpeed    = 0.0f, 
 166 FLOAT m_tmInvisibilityMax    = 30.0f,
 167 FLOAT m_tmInvulnerabilityMax = 30.0f,
 168 FLOAT m_tmSeriousDamageMax   = 40.0f,
 169 FLOAT m_tmSeriousSpeedMax    = 20.0f,

 180 FLOAT m_tmChainShakeEnd = 0.0f, // used to determine when to stop shaking due to chainsaw damage
 181 FLOAT m_fChainShakeStrength = 1.0f, // strength of shaking
 182 FLOAT m_fChainShakeFreqMod = 1.0f,  // shaking frequency modifier
 183 FLOAT m_fChainsawShakeDX = 0.0f, 
 184 FLOAT m_fChainsawShakeDY = 0.0f,

 190 INDEX m_iSeriousBombCount = 0,      // ammount of serious bombs player owns
 191 INDEX m_iLastSeriousBombCount = 0,  // ammount of serious bombs player had before firing
 192 FLOAT m_tmSeriousBombFired = -10.0f,  // when the bomb was last fired

// [Cecil]
 200 INDEX m_iLastAlt = 0,
 201 FLOAT m_tmAltChanged = -9,
 202 FLOAT m_tmWeaponChange = -100.0f,
 203 CSoundObject m_soHUD,
 204 CSoundObject m_soAmmo,
 205 CSoundObject m_soArmor,
 206 CSoundObject m_soHealth,
 207 CSoundObject m_soSuit,
 208 CSoundObject m_soSuitMusic,
 209 CSoundObject m_soOther,

 210 INDEX m_iLastSurface = 0,
 211 INDEX m_iLastSurfaceSound = -1,

 220 FLOAT m_fSpeedLimit = 0.0f,
 221 FLOAT m_tmAirTime = 0.0f,
 222 BOOL m_bFakeJump = FALSE,

 225 FLOAT m_fViewHeight = 0.0f,
 226 ANGLE3D m_aRecoilShake = ANGLE3D(0.0f, 0.0f, 0.0f),
 227 ANGLE3D m_aLastRecoilShake = ANGLE3D(0.0f, 0.0f, 0.0f),
 228 FLOAT m_fRecoilPower = 0.0f,
 229 FLOAT m_fLastRecoilPower = 0.0f,

 230 ANGLE3D m_aWeaponShake = ANGLE3D(0.0f, 0.0f, 0.0f),
 231 ANGLE3D m_aLastWeaponShake = ANGLE3D(0.0f, 0.0f, 0.0f),

 232 ANGLE3D m_aCameraShake = ANGLE3D(0.0f, 0.0f, 0.0f),
 233 ANGLE3D m_aLastCameraShake = ANGLE3D(0.0f, 0.0f, 0.0f),

 240 BOOL m_bSuitZoom = FALSE,
 241 FLOAT m_fZoomFOV = 90.0f,
 242 FLOAT m_fLastZoomFOV = 90.0f,
 243 BOOL m_bHEVSuit = TRUE,

 250 CEntityPointer m_penFlashlight,
 251 CEntityPointer m_penFLAmbient,
 252 BOOL m_bFlashlight = FALSE,
 253 CSoundObject m_soFlashlight,

// [Cecil] Don't use 255 - reserved for m_penPrediction

 260 CSoundObject m_soWeaponFire1,
 261 CSoundObject m_soWeaponFire2,
 262 CSoundObject m_soWeaponReload,
 263 CSoundObject m_soWeaponAlt,
 264 CSoundObject m_soWeaponEmpty,

 270 INDEX m_iLastDamage = 0,
 271 INDEX m_iHAXFlags = 0,

 280 BOOL m_bHAXMenu = FALSE,
 281 FLOAT3D m_vMousePos = FLOAT3D(0, 0, 0), // Actual mouse position for interactions
 282 FLOAT3D m_vMousePosLast = FLOAT3D(0, 0, 0), // Last position for non-local interpolation

{
  ShellLaunchData ShellLaunchData_array;  // array of data describing flying empty shells
  INDEX m_iFirstEmptySLD;                         // index of last added empty shell

  BulletSprayLaunchData BulletSprayLaunchData_array;  // array of data describing flying bullet sprays
  INDEX m_iFirstEmptyBSLD;                            // index of last added bullet spray

  GoreSprayLaunchData GoreSprayLaunchData_array;   // array of data describing gore sprays
  INDEX m_iFirstEmptyGSLD;                         // index of last added gore spray

  ULONG ulButtonsNow;  ULONG ulButtonsBefore;
  ULONG ulNewButtons;
  ULONG ulReleasedButtons;

  BOOL  bUseButtonHeld;

  // listener
  CSoundListener sliSound;
  // light
  CLightSource m_lsLightSource;

  TIME m_tmPredict;  // time to predict the entity to

  // all messages in the inbox
  CDynamicStackArray<CCompMessageID> m_acmiMessages;
  INDEX m_ctUnreadMessages;

  // statistics
  PlayerStats m_psLevelStats;
  PlayerStats m_psLevelTotal;
  PlayerStats m_psGameStats;
  PlayerStats m_psGameTotal;

  CModelObject m_moRender; // model object to render - this one can be customized

  // [Cecil] Mouse position for rendering and view window size
  FLOAT2D m_vMouseRender;
  FLOAT2D m_vViewWindow;

  // [Cecil] A list of captions on the screen
  CStaticArray<CTString> m_astrCaptions;
  CStaticArray<FLOAT> m_atmCaptionsIn;
  CStaticArray<FLOAT> m_atmCaptionsOut;

  // [Cecil] Physics object
  SPhysObject m_obj;

  // [Cecil] Alternative to en_pbpoStandOn that can mimic brush polygons
  SCollisionPolygon m_cpoStandOn;
}

components:
  1 class CLASS_PLAYER_WEAPONS  "Classes\\PlayerWeapons.ecl",
  2 class CLASS_PLAYER_ANIMATOR "Classes\\PlayerAnimator.ecl",
  3 class CLASS_PLAYER_VIEW     "Classes\\PlayerView.ecl",
  4 class CLASS_BASIC_EFFECT    "Classes\\BasicEffect.ecl",
  5 class CLASS_BLOOD_SPRAY     "Classes\\BloodSpray.ecl",

// [Cecil] Classes
 10 class CLASS_LIGHT      "Classes\\Light.ecl",
 11 class CLASS_ROLLERMINE "Classes\\RollerMine.ecl",
 12 class CLASS_RADIO      "Classes\\Radio.ecl",

 50 sound SOUND_WATER_ENTER "Sounds\\Player\\WaterEnter.wav",
 51 sound SOUND_WATER_LEAVE "Sounds\\Player\\WaterLeave.wav",
 52 sound SOUND_DIVEIN      "Sounds\\Player\\DiveIn.wav",
 53 sound SOUND_DIVEOUT     "Sounds\\Player\\DiveOut.wav",
 55 sound SOUND_BLOWUP      "SoundsMP\\Player\\BlowUp.wav",

// [Cecil] Wound Sounds
100 sound SOUND_DROWN1    "Sounds\\Player\\Drown1.wav",
101 sound SOUND_DROWN2    "Sounds\\Player\\Drown2.wav",
102 sound SOUND_DROWN3    "Sounds\\Player\\Drown3.wav",
103 sound SOUND_BURNPAIN1 "Sounds\\Player\\BurnPain1.wav",
104 sound SOUND_BURNPAIN2 "Sounds\\Player\\BurnPain2.wav",
105 sound SOUND_BURNPAIN3 "Sounds\\Player\\BurnPain3.wav",
106 sound SOUND_FALLPAIN1 "Sounds\\Player\\FallPain1.wav",
107 sound SOUND_FALLPAIN2 "Sounds\\Player\\FallPain2.wav",
108 sound SOUND_PAIN1     "Sounds\\Player\\Pain1.wav",
109 sound SOUND_PAIN2     "Sounds\\Player\\Pain2.wav",
110 sound SOUND_PAIN3     "Sounds\\Player\\Pain3.wav",

// [Cecil] Swimming sounds
120 sound SOUND_WADE1 "Sounds\\Steps\\wade1.wav",
121 sound SOUND_WADE2 "Sounds\\Steps\\wade2.wav",
122 sound SOUND_WADE3 "Sounds\\Steps\\wade3.wav",
123 sound SOUND_WADE4 "Sounds\\Steps\\wade4.wav",
124 sound SOUND_WADE5 "Sounds\\Steps\\wade5.wav",
125 sound SOUND_WADE6 "Sounds\\Steps\\wade6.wav",
126 sound SOUND_WADE7 "Sounds\\Steps\\wade7.wav",
127 sound SOUND_WADE8 "Sounds\\Steps\\wade8.wav",

130 sound SOUND_FLATLINE "Sounds\\Player\\Flatline.wav",
131 sound SOUND_APPLY "Sounds\\Player\\Apply.wav",
132 sound SOUND_DENY  "Sounds\\Player\\Deny.wav",

201 sound SOUND_SNIPER_ZOOM  "ModelsMP\\Weapons\\Sniper\\Sounds\\Zoom.wav",
202 sound SOUND_SNIPER_QZOOM "Sounds\\Weapons\\Zoom.wav",
203 sound SOUND_INFO         "Sounds\\Player\\Info.wav",
204 sound SOUND_WATERAMBIENT "Sounds\\Player\\Underwater.wav",
205 sound SOUND_WATERBUBBLES "Sounds\\Player\\Bubbles.wav",
206 sound SOUND_POWERUP_BEEP "SoundsMP\\Player\\PowerUpBeep.wav",

// [Cecil] Step sounds for precaching
250 sound SOUND_SLOSH1 "Sounds\\Steps\\slosh1.wav",
251 sound SOUND_SLOSH2 "Sounds\\Steps\\slosh2.wav",
252 sound SOUND_SLOSH3 "Sounds\\Steps\\slosh3.wav",
253 sound SOUND_SLOSH4 "Sounds\\Steps\\slosh4.wav",

254 sound SOUND_SAND1 "Sounds\\Steps\\sand1.wav",
255 sound SOUND_SAND2 "Sounds\\Steps\\sand2.wav",
256 sound SOUND_SAND3 "Sounds\\Steps\\sand3.wav",
257 sound SOUND_SAND4 "Sounds\\Steps\\sand4.wav",

258 sound SOUND_GRASS1 "Sounds\\Steps\\grass1.wav",
259 sound SOUND_GRASS2 "Sounds\\Steps\\grass2.wav",
260 sound SOUND_GRASS3 "Sounds\\Steps\\grass3.wav",
261 sound SOUND_GRASS4 "Sounds\\Steps\\grass4.wav",

262 sound SOUND_WOOD1 "Sounds\\Steps\\wood1.wav",
263 sound SOUND_WOOD2 "Sounds\\Steps\\wood2.wav",
264 sound SOUND_WOOD3 "Sounds\\Steps\\wood3.wav",
265 sound SOUND_WOOD4 "Sounds\\Steps\\wood4.wav",

266 sound SOUND_METAL1 "Sounds\\Steps\\metal1.wav",
267 sound SOUND_METAL2 "Sounds\\Steps\\metal2.wav",
268 sound SOUND_METAL3 "Sounds\\Steps\\metal3.wav",
269 sound SOUND_METAL4 "Sounds\\Steps\\metal4.wav",

270 sound SOUND_METALGRATE1 "Sounds\\Steps\\metalgrate1.wav",
271 sound SOUND_METALGRATE2 "Sounds\\Steps\\metalgrate2.wav",
272 sound SOUND_METALGRATE3 "Sounds\\Steps\\metalgrate3.wav",
273 sound SOUND_METALGRATE4 "Sounds\\Steps\\metalgrate4.wav",

274 sound SOUND_CHAINLINK1 "Sounds\\Steps\\chainlink1.wav",
275 sound SOUND_CHAINLINK2 "Sounds\\Steps\\chainlink2.wav",
276 sound SOUND_CHAINLINK3 "Sounds\\Steps\\chainlink3.wav",
277 sound SOUND_CHAINLINK4 "Sounds\\Steps\\chainlink4.wav",

278 sound SOUND_TILE1 "Sounds\\Steps\\tile1.wav",
279 sound SOUND_TILE2 "Sounds\\Steps\\tile2.wav",
280 sound SOUND_TILE3 "Sounds\\Steps\\tile3.wav",
281 sound SOUND_TILE4 "Sounds\\Steps\\tile4.wav",

282 sound SOUND_CONCRETE1 "Sounds\\Steps\\concrete1.wav",
283 sound SOUND_CONCRETE2 "Sounds\\Steps\\concrete2.wav",
284 sound SOUND_CONCRETE3 "Sounds\\Steps\\concrete3.wav",
285 sound SOUND_CONCRETE4 "Sounds\\Steps\\concrete4.wav",

286 sound SOUND_GLASS1 "Sounds\\Steps\\glass1.wav",
287 sound SOUND_GLASS2 "Sounds\\Steps\\glass2.wav",
288 sound SOUND_GLASS3 "Sounds\\Steps\\glass3.wav",
289 sound SOUND_GLASS4 "Sounds\\Steps\\glass4.wav",

290 sound SOUND_PLASTIC1 "Sounds\\Impact\\plastic_soft1.wav",
291 sound SOUND_PLASTIC2 "Sounds\\Impact\\plastic_soft2.wav",
292 sound SOUND_PLASTIC3 "Sounds\\Impact\\plastic_soft3.wav",
293 sound SOUND_PLASTIC4 "Sounds\\Impact\\plastic_soft4.wav",

294 sound SOUND_WEAPON1 "Sounds\\Steps\\weapon1.wav",
295 sound SOUND_WEAPON2 "Sounds\\Steps\\weapon2.wav",

// [Cecil] Impact sounds for precaching
296 sound SOUND_PHYS_CONCRETE1 "Sounds\\Physics\\concrete\\concrete_impact_hard1.wav",
297 sound SOUND_PHYS_CONCRETE2 "Sounds\\Physics\\concrete\\concrete_impact_hard2.wav",
298 sound SOUND_PHYS_CONCRETE3 "Sounds\\Physics\\concrete\\concrete_impact_hard3.wav",
299 sound SOUND_PHYS_CONCRETE4 "Sounds\\Physics\\concrete\\concrete_impact_soft1.wav",
300 sound SOUND_PHYS_CONCRETE5 "Sounds\\Physics\\concrete\\concrete_impact_soft2.wav",
301 sound SOUND_PHYS_CONCRETE6 "Sounds\\Physics\\concrete\\concrete_impact_soft3.wav",

302 sound SOUND_PHYS_GLASS1 "Sounds\\Physics\\glass\\glass_sheet_impact_hard1.wav",
303 sound SOUND_PHYS_GLASS2 "Sounds\\Physics\\glass\\glass_sheet_impact_hard2.wav",
304 sound SOUND_PHYS_GLASS3 "Sounds\\Physics\\glass\\glass_sheet_impact_hard3.wav",
305 sound SOUND_PHYS_GLASS4 "Sounds\\Physics\\glass\\glass_sheet_impact_soft1.wav",
306 sound SOUND_PHYS_GLASS5 "Sounds\\Physics\\glass\\glass_sheet_impact_soft2.wav",
307 sound SOUND_PHYS_GLASS6 "Sounds\\Physics\\glass\\glass_sheet_impact_soft3.wav",

308 sound SOUND_PHYS_METAL1 "Sounds\\Physics\\metal\\metal_chainlink_impact_hard1.wav",
309 sound SOUND_PHYS_METAL2 "Sounds\\Physics\\metal\\metal_chainlink_impact_hard2.wav",
310 sound SOUND_PHYS_METAL3 "Sounds\\Physics\\metal\\metal_chainlink_impact_hard3.wav",
311 sound SOUND_PHYS_METAL4 "Sounds\\Physics\\metal\\metal_chainlink_impact_soft1.wav",
312 sound SOUND_PHYS_METAL5 "Sounds\\Physics\\metal\\metal_chainlink_impact_soft2.wav",
313 sound SOUND_PHYS_METAL6 "Sounds\\Physics\\metal\\metal_chainlink_impact_soft3.wav",
314 sound SOUND_PHYS_METAL7 "Sounds\\Physics\\metal\\metal_grate_impact_hard1.wav",
315 sound SOUND_PHYS_METAL8 "Sounds\\Physics\\metal\\metal_grate_impact_hard2.wav",
316 sound SOUND_PHYS_METAL9 "Sounds\\Physics\\metal\\metal_grate_impact_hard3.wav",
317 sound SOUND_PHYS_METAL10 "Sounds\\Physics\\metal\\metal_grate_impact_soft1.wav",
318 sound SOUND_PHYS_METAL11 "Sounds\\Physics\\metal\\metal_grate_impact_soft2.wav",
319 sound SOUND_PHYS_METAL12 "Sounds\\Physics\\metal\\metal_grate_impact_soft3.wav",
320 sound SOUND_PHYS_METAL13 "Sounds\\Physics\\metal\\metal_solid_impact_hard1.wav",
321 sound SOUND_PHYS_METAL14 "Sounds\\Physics\\metal\\metal_solid_impact_hard2.wav",
322 sound SOUND_PHYS_METAL15 "Sounds\\Physics\\metal\\metal_solid_impact_hard3.wav",
323 sound SOUND_PHYS_METAL16 "Sounds\\Physics\\metal\\metal_solid_impact_soft1.wav",
324 sound SOUND_PHYS_METAL17 "Sounds\\Physics\\metal\\metal_solid_impact_soft2.wav",
325 sound SOUND_PHYS_METAL18 "Sounds\\Physics\\metal\\metal_solid_impact_soft3.wav",
326 sound SOUND_PHYS_METAL19 "Sounds\\Physics\\metal\\weapon_impact_hard1.wav",
327 sound SOUND_PHYS_METAL20 "Sounds\\Physics\\metal\\weapon_impact_hard2.wav",
328 sound SOUND_PHYS_METAL21 "Sounds\\Physics\\metal\\weapon_impact_hard3.wav",
329 sound SOUND_PHYS_METAL22 "Sounds\\Physics\\metal\\weapon_impact_soft1.wav",
330 sound SOUND_PHYS_METAL23 "Sounds\\Physics\\metal\\weapon_impact_soft2.wav",
331 sound SOUND_PHYS_METAL24 "Sounds\\Physics\\metal\\weapon_impact_soft3.wav",

332 sound SOUND_PHYS_PLASTIC1 "Sounds\\Physics\\plastic\\plastic_box_impact_hard1.wav",
333 sound SOUND_PHYS_PLASTIC2 "Sounds\\Physics\\plastic\\plastic_box_impact_hard2.wav",
334 sound SOUND_PHYS_PLASTIC3 "Sounds\\Physics\\plastic\\plastic_box_impact_hard3.wav",
335 sound SOUND_PHYS_PLASTIC4 "Sounds\\Physics\\plastic\\plastic_box_impact_hard4.wav",
336 sound SOUND_PHYS_PLASTIC5 "Sounds\\Physics\\plastic\\plastic_box_impact_soft1.wav",
337 sound SOUND_PHYS_PLASTIC6 "Sounds\\Physics\\plastic\\plastic_box_impact_soft2.wav",
338 sound SOUND_PHYS_PLASTIC7 "Sounds\\Physics\\plastic\\plastic_box_impact_soft3.wav",
339 sound SOUND_PHYS_PLASTIC8 "Sounds\\Physics\\plastic\\plastic_box_impact_soft4.wav",

340 sound SOUND_PHYS_WOOD1 "Sounds\\Physics\\wood\\wood_box_impact_hard1.wav",
341 sound SOUND_PHYS_WOOD2 "Sounds\\Physics\\wood\\wood_box_impact_hard2.wav",
342 sound SOUND_PHYS_WOOD3 "Sounds\\Physics\\wood\\wood_box_impact_hard3.wav",
343 sound SOUND_PHYS_WOOD4 "Sounds\\Physics\\wood\\wood_plank_impact_soft1.wav",

344 sound SOUND_SILENCE "Sounds\\Misc\\Silence.wav",

// [Cecil] Flashlight
500 model MODEL_FLASHLIGHT        "Models\\Editor\\LightSource.mdl",
501 texture TEXTURE_POINT_LIGHT   "Models\\Editor\\PointLight.tex",
502 texture TEXTURE_AMBIENT_LIGHT "Models\\Editor\\AmbientLight.tex",
503 sound SOUND_FLASHLIGHT        "Sounds\\Player\\Flashlight.wav",

// [Cecil] Pickup sounds
510 sound SOUND_MEDSHOT     "Sounds\\Items\\Medshot.wav",
511 sound SOUND_MEDKIT      "Sounds\\Items\\SmallMedkit.wav",
512 sound SOUND_SUITBATTERY "Sounds\\Items\\SuitBattery.wav",
513 sound SOUND_SUITCHARGE  "Sounds\\Items\\SuitChargeDone.wav",
514 sound SOUND_SUITBELL    "Sounds\\Items\\SuitBell.wav",
515 sound SOUND_SUITMUSIC   "Sounds\\Items\\SuitMusic.ogg",

// [Cecil] Suit sounds
550 sound SOUND_SUIT_AMMO     "Sounds\\Player\\Suit\\Ammo.wav",
551 sound SOUND_SUIT_HEAT     "Sounds\\Player\\Suit\\Heat.wav",
552 sound SOUND_SUIT_SHOCK    "Sounds\\Player\\Suit\\Shock.wav",
553 sound SOUND_SUIT_ARMOR    "Sounds\\Player\\Suit\\NoArmor.wav",
554 sound SOUND_SUIT_DEATH    "Sounds\\Player\\Suit\\NearDeath.wav",
555 sound SOUND_SUIT_MEDIC    "Sounds\\Player\\Suit\\SeekMedic.wav",
556 sound SOUND_SUIT_CRITICAL "Sounds\\Player\\Suit\\WoundCritical.wav",
557 sound SOUND_SUIT_MAJOR    "Sounds\\Player\\Suit\\WoundMajor.wav",
558 sound SOUND_SUIT_MINOR    "Sounds\\Player\\Suit\\WoundMinor.wav",

// ************** FLESH PARTS **************
210 model   MODEL_FLESH          "Models\\Effects\\Debris\\Flesh\\Flesh.mdl",
211 model   MODEL_FLESH_APPLE    "Models\\Effects\\Debris\\Fruits\\Apple.mdl",
212 model   MODEL_FLESH_BANANA   "Models\\Effects\\Debris\\Fruits\\Banana.mdl",
213 model   MODEL_FLESH_BURGER   "Models\\Effects\\Debris\\Fruits\\CheeseBurger.mdl",
214 model   MODEL_FLESH_LOLLY    "Models\\Effects\\Debris\\Fruits\\LollyPop.mdl",
215 model   MODEL_FLESH_ORANGE   "Models\\Effects\\Debris\\Fruits\\Orange.mdl",

220 texture TEXTURE_FLESH_RED    "Models\\Effects\\Debris\\Flesh\\FleshRed.tex",
221 texture TEXTURE_FLESH_GREEN  "Models\\Effects\\Debris\\Flesh\\FleshGreen.tex",
222 texture TEXTURE_FLESH_APPLE  "Models\\Effects\\Debris\\Fruits\\Apple.tex",       
223 texture TEXTURE_FLESH_BANANA "Models\\Effects\\Debris\\Fruits\\Banana.tex",      
224 texture TEXTURE_FLESH_BURGER "Models\\Effects\\Debris\\Fruits\\CheeseBurger.tex",
225 texture TEXTURE_FLESH_LOLLY  "Models\\Effects\\Debris\\Fruits\\LollyPop.tex",
226 texture TEXTURE_FLESH_ORANGE "Models\\Effects\\Debris\\Fruits\\Orange.tex",

functions:
  // [Cecil] On destruction
  virtual void OnEnd(void) {
    PhysObj().Clear(TRUE);
    CCecilPlayerEntity::OnEnd();
  };

  // [Cecil] Get physics object
  odeObject &PhysObj(void) {
    return *m_obj.pObj;
  };

  // [Cecil] Check if physics object is usable
  BOOL PhysicsUsable(void) {
    return ODE_IsStarted() && PhysObj().IsCreated();
  };

  // [Cecil] Create the ODE object
  void CreateObject(void) {
    // Delete last object
    PhysObj().Clear(TRUE);

    if (!ODE_IsStarted()) { return; }

    FLOATaabbox3D box;
    GetBoundingBox(box);
    FLOAT3D vSize = box.Size();

    // Begin creating a new object
    CPlacement3D plSphere(FLOAT3D(0, vSize(2), 0), ANGLE3D(0, 0, 0));
    plSphere.RelativeToAbsoluteSmooth(GetPlacement());

    PhysObj().BeginShape(plSphere, 1.0f, OBJF_BODY);
    PhysObj().SetSphere(PHYS_SPHERE_RADIUS);
    PhysObj().EndShape();

    PhysObj().SetGravity(FALSE);
    PhysObj().SetMaxRotationSpeed(0);
    PhysObj().SetAutoDisable(FALSE);
  };

  // [Cecil] Move physics object
  void MovePhysicsObject(void) {
    if (!PhysicsUsable()) {
      return;
    }

    // Follow the player when alive
    if (GetFlags() & ENF_ALIVE) {
      FLOAT3D vSource = PhysObj().GetPosition();
      FLOAT3D vTarget;

      FLOATaabbox3D box;
      GetBoundingBox(box);
      FLOAT3D vSize = box.Size();

      // Hide physics object in the middle if there's nothing to stand on
      if (!m_cpoStandOn.bHit) {
        vSize(2) *= 0.5f;
      }

      vTarget = GetPlacement().pl_PositionVector + FLOAT3D(0, vSize(2), 0) * GetRotationMatrix();

      const FLOAT3D vDiff = (vTarget - vSource);

      // Teleport to the position immediately, if it's too far away
      if (vDiff.Length() > 1.5f) {
        PhysObj().SetCurrentTranslation(FLOAT3D(0, 0, 0));
        PhysObj().SetPosition(vTarget);

      // Start moving at half the speed
      } else {
        PhysObj().SetCurrentTranslation(vDiff / _pTimer->TickQuantum / 2);
      }

    // Teleport it away when dead
    } else {
      PhysObj().SetCurrentTranslation(FLOAT3D(0, 0, 0));
      PhysObj().SetPosition(FLOAT3D(50000, 50000 + en_ulID, 50000));
    }
  };

  // [Cecil] Swim sound
  INDEX SwimSound(void) {
    INDEX iRnd = IRnd()%7 + 1;

    // Don't repeat the same sound
    if (m_iLastSurfaceSound != -1 && iRnd >= m_iLastSurfaceSound) {
      iRnd++;
    }
    m_iLastSurfaceSound = iRnd;

    return SOUND_WADE1 + iRnd-1;
  };

  // [Cecil] New message system
  void PrintCaptions(CDrawPort *pdp) {
    FLOAT fScalingX = 1.0f;
    FLOAT fScalingY = 1.0f;
    GetScaling(fScalingX, fScalingY);

    const FLOAT fTextScale = fScalingY;

    pdp->SetFont(_pfdDisplayFont);
    pdp->SetTextScaling(fTextScale);
    pdp->SetTextAspect(1.0f);

    INDEX ctCaptions = 0;

    const FLOAT tmNow = _pTimer->GetLerpedCurrentTick();
    const FLOAT fFontHeight = _pfdDisplayFont->GetHeight();
    FLOAT fBorderFade = 0.0f;

    // [Cecil] TEMP: Prediction
    CPlayer *penThis = (CPlayer*)GetPredictionTail(); //this;
    /*if (penThis->IsPredicted()) {
      penThis = (CPlayer*)penThis->GetPredictor();
    }*/

    // word-wrapped captions and its lines
    CStaticArray<CTString> astrCaptions;
    CStaticArray<INDEX> aiLines;
    astrCaptions.CopyArray(penThis->m_astrCaptions);
    aiLines.New(CT_CAPTIONS+1);

    // apply word wrap for captions
    for (INDEX iWrap = 0; iWrap <= CT_CAPTIONS; iWrap++) {
      if (astrCaptions[iWrap] != "") {
        aiLines[iWrap] = WordWrap(_pdp, astrCaptions[iWrap], CAPTIONS_WIDTH - 12.0f);
      } else {
        aiLines[iWrap] = 1;
      }
    }

    // count active captions and adjust border fading
    for (INDEX iCount = 0; iCount <= CT_CAPTIONS; iCount++) {
      const BOOL bLast = (iCount == 0);

      if (astrCaptions[iCount] == "") {
        continue;
      }

      FLOAT tmIn = penThis->m_atmCaptionsIn[iCount];
      FLOAT tmOut = penThis->m_atmCaptionsOut[iCount] + TM_CAPTION_ANIM * !bLast;

      FLOAT fFadeIn = Clamp((tmNow - tmIn)/TM_CAPTION_ANIM, 0.0f, 1.0f);
      FLOAT fFadeOut = Clamp((tmNow - tmOut)/TM_CAPTION_ANIM, 0.0f, 1.0f);

      fBorderFade += (fFadeIn - fFadeOut) * aiLines[iCount];
      ctCaptions++;
    }

    // no captions to render
    if (ctCaptions <= 0) {
      return;
    }

    // captions border
    FLOAT fBorderFixed = ClampDn(fBorderFade, (FLOAT)aiLines[CT_CAPTIONS]);
    FLOAT fBorderShift = Clamp(fBorderFade, 0.0f, 1.0f);
    FLOAT fHeight = fFontHeight * (fBorderFixed + 1);

    UBYTE ubBorderAlpha = UI_BORDER & 0xFF;
    COLOR colBorder = (UI_BORDER & 0xFFFFFF00) | UBYTE(fBorderShift * ubBorderAlpha);

    FLOAT fBorderW = CAPTIONS_WIDTH - 8.0f;
    FLOAT fBorderH = fHeight - 8.0f;
    HUD_DrawBorder(320-fBorderW / 2.0f, 416 - fBorderH, fBorderW, fBorderH, colBorder, SAF_BOTTOM|SAF_CENTER);

    // print out the captions
    FLOAT fLastFade = CT_CAPTIONS;

    for (INDEX i = CT_CAPTIONS; i >= 0; i--) {
      const BOOL bNew = (i == CT_CAPTIONS);
      CTString strCaption = astrCaptions[i];

      // skip empty captions
      if (strCaption == "") {
        continue;
      }

      FLOAT tmIn = penThis->m_atmCaptionsIn[i];
      FLOAT tmOut = penThis->m_atmCaptionsOut[i] + TM_CAPTION_ANIM * bNew;

      FLOAT fFadeIn = Clamp((tmNow - tmIn)/TM_CAPTION_ANIM, 0.0f, 1.0f);
      FLOAT fFadeOut = Clamp((tmNow - tmOut)/TM_CAPTION_ANIM, 0.0f, 1.0f);

      // fade alpha
      UBYTE ubAlpha = UBYTE((fFadeIn - fFadeOut)*255);

      // fixed animation for the last one
      if (!i) {
        tmIn = penThis->m_atmCaptionsOut[i];
        fLastFade += Clamp((tmNow - tmIn)/TM_CAPTION_ANIM, 0.0f, 1.0f);
      }

      HUD_DrawText(320-CAPTIONS_WIDTH / 2.0f + 8, 412 - fFontHeight*(CT_CAPTIONS - fLastFade + aiLines[i]) + fTextScale, strCaption, C_WHITE|ubAlpha, -1, SAF_BOTTOM|SAF_CENTER);
      fLastFade -= fFadeIn * aiLines[i];
    }
  };

  // [Cecil] Add new caption
  void AddCaption(CTString strMessage, FLOAT tmLength, BOOL bSpamSafe) {
    // update time if same caption
    if (bSpamSafe && m_astrCaptions[CT_CAPTIONS].Matches(strMessage)) {
      m_atmCaptionsOut[CT_CAPTIONS] = Max(m_atmCaptionsOut[CT_CAPTIONS], _pTimer->CurrentTick() + tmLength);
      return;
    }

    // disappearing caption
    m_astrCaptions[0] = m_astrCaptions[1];
    m_atmCaptionsIn[0] = -100.0f;
    m_atmCaptionsOut[0] = _pTimer->CurrentTick();

    // push every caption up
    for (INDEX i = 1; i < CT_CAPTIONS; i++) {
      m_astrCaptions[i] = m_astrCaptions[i+1];
      m_atmCaptionsIn[i] = m_atmCaptionsIn[i+1];
      // limit fade out time
      m_atmCaptionsOut[i] = Min(m_atmCaptionsOut[i+1], _pTimer->CurrentTick() + 3.0f);
    }

    // write into the last caption
    m_astrCaptions[CT_CAPTIONS] = strMessage;
    m_atmCaptionsIn[CT_CAPTIONS] = _pTimer->CurrentTick();
    // fading out time shouldn't be sooner than the previous caption
    m_atmCaptionsOut[CT_CAPTIONS] = Max(m_atmCaptionsOut[CT_CAPTIONS-1], _pTimer->CurrentTick() + tmLength);
  };

  // [Cecil] Menu button area
  FLOATaabbox2D MenuButton(INDEX iButton) {
    static const FLOAT2D vSize = FLOAT2D(192, 32);

    FLOAT2D vOffset = FLOAT2D((iButton % 2) ? 32 : -(vSize(1) + 32), 40 * floorf(iButton / 2));
    FLOAT2D vPos = FLOAT2D(320 + vOffset(1), 192 + vOffset(2));

    return FLOATaabbox2D(vPos, vPos + vSize);
  };

  // [Cecil] HAX menu actions
  void MenuActions(void) {
    // Can't use the menu when dead
    m_bHAXMenu = ((GetFlags() & ENF_ALIVE) && (ulButtonsNow & PLACT_MENU));

    if (!m_bHAXMenu) {
      return;
    }

    // Stop firing
    ((CPlayerWeapons &)*m_penWeapons).SendEvent(EReleaseWeapon());

    INDEX iSelected = -1;

    for (INDEX iButton = 0; iButton < 10; iButton++) {
      FLOATaabbox2D boxButton = MenuButton(iButton);
      FLOAT2D vMouse(m_vMousePos(1), m_vMousePos(2));

      if (boxButton >= vMouse) {
        iSelected = iButton;
      }
    }

    // Remember menu buttons
    const ULONG ulMenuButtons = (ulReleasedButtons & PLACT_SELECT_WEAPON_MASK);
    const BOOL bMenuClick = (ulMenuButtons == PLACT_SELECT_WEAPON_MASK);

    // Prevent other button actions
    ulButtonsNow = 0;
    ulButtonsBefore = m_ulLastButtons;
    ulNewButtons = 0;
    ulReleasedButtons = (~ulButtonsNow) & ulButtonsBefore;

    // No button press detected
    if (ulMenuButtons == 0) {
      return;
    }

    // Determine selected button if it wasn't a mouse click
    if (!bMenuClick) {
      iSelected = (ulMenuButtons >> PLACT_SELECT_WEAPON_SHIFT) - 1;
    }

    switch (iSelected) {
      // God mode
      case 0: {
        CTString strOn = "on";

        if (m_iHAXFlags & HAXF_GOD) {
          m_iHAXFlags &= ~HAXF_GOD;
          strOn = "off";
        } else {
          m_iHAXFlags |= HAXF_GOD;
        }

        if (_pNetwork->IsPlayerLocal(this)) {
          CPrintF("^cffffff god %s\n", strOn);
        }
      } break;

      // Noclip
      case 1: {
        CTString strOn = "on";

        if (m_iHAXFlags & HAXF_NOCLIP) {
          m_iHAXFlags &= ~HAXF_NOCLIP;
          strOn = "off";
        } else {
          m_iHAXFlags |= HAXF_NOCLIP;
        }

        if (_pNetwork->IsPlayerLocal(this)) {
          CPrintF("^cffffff noclip %s\n", strOn);
        }
      } break;

      // Give all weapons
      case 2: {
        GetPlayerWeapons()->m_iAvailableWeapons = 16383;

        // Fill the ammo
        for (INDEX iAmmo = 0; iAmmo < 11; iAmmo++) {
          (&GetPlayerWeapons()->m_iUSP)[iAmmo] = (&GetPlayerWeapons()->m_iUSP_Max)[iAmmo];
        }

        // Give HEV suit
        m_bHEVSuit = TRUE;

        if (_pNetwork->IsPlayerLocal(this)) {
          CPrintF("^cffffff gave all weapons\n");
        }
      } break;

      // Kill player
      case 3: {
        SetHealth(0.0f);
        SendEvent(EDeath());
      } break;

      // Spawn rollermine
      case 4: {
        FLOAT3D vPos = GetPlayerWeapons()->m_vRayHit - en_vGravityDir;
        CEntity *pen = CreateEntity(CPlacement3D(vPos, ANGLE3D(0, 0, 0)), CLASS_ROLLERMINE);
        ((CRollerMine *)pen)->m_fPhysHealth = 200.0f;
        ((CRollerMine *)pen)->m_bPhysEnvDamage = FALSE;
        pen->Initialize();

        if (_pNetwork->IsPlayerLocal(this)) {
          CPrintF("^cffffff created rollermine at %.0f, %.0f, %.0f\n", vPos(1), vPos(2), vPos(3));
        }
      } break;

      // Ignite entity
      case 5: {
        CEntity *penIgnite = GetPlayerWeapons()->m_penRayHit;
        if (penIgnite != NULL && penIgnite->GetRenderType() == RT_MODEL) {
          SpawnFlame(this, penIgnite, penIgnite->GetPlacement().pl_PositionVector);
          SpawnFlame(this, penIgnite, penIgnite->GetPlacement().pl_PositionVector);

          if (_pNetwork->IsPlayerLocal(this)) {
            CPrintF("^cffffff ignited '%s'\n", penIgnite->GetName());
          }
        }
      } break;

      // Spawn radio
      case 6: {
        FLOAT3D vPos = GetPlayerWeapons()->m_vRayHit - en_vGravityDir * 0.1f;
        ANGLE3D aAngle = GetViewPlacement(CPlacement3D(FLOAT3D(0, 0, 0), ANGLE3D(180, 0, 0)), FLOAT3D(-1, 0, 0), 1.0f).pl_OrientationAngle;

        CEntity *pen = CreateEntity(CPlacement3D(vPos, aAngle), CLASS_RADIO);
        ((CRadio *)pen)->m_fPhysHealth = 1000.0f;
        ((CRadio *)pen)->m_bPhysEnvDamage = FALSE;
        pen->Initialize();

        if (_pNetwork->IsPlayerLocal(this)) {
          CPrintF("^cffffff created radio at %.0f, %.0f, %.0f\n", vPos(1), vPos(2), vPos(3));
        }
      } break;

      // Spawn wood pallet
      case 7: {
        // Create pallet model for the physics object
        static const CTString strPalletModel = "@@@__HL2_WOOD_PALLET_MODEL__@@@";
        CEntity *penModel = _pNetwork->GetEntityWithName(strPalletModel, 0);

        if (penModel == NULL) {
          penModel = GetWorld()->CreateEntity_t(CPlacement3D(FLOAT3D(-32000, 1024, -32000), ANGLE3D(0, 0, 0)), CTString("Classes\\ModelHolder2.ecl"));
          ((CModelHolder2 *)penModel)->m_strName = strPalletModel;
          ((CModelHolder2 *)penModel)->m_fnModel = CTString("Models\\Misc\\WoodPallet.mdl");
          ((CModelHolder2 *)penModel)->m_fnTexture = CTString("Models\\Misc\\WoodPallet.tex");
          ((CModelHolder2 *)penModel)->m_stClusterShadows = ST_NONE;
          // Divide model size to align it with object's size
          ((CModelHolder2 *)penModel)->m_fStretchX = 1.0f / 2.0f;
          ((CModelHolder2 *)penModel)->m_fStretchY = 1.0f / 0.25f;
          ((CModelHolder2 *)penModel)->m_fStretchZ = 1.0f / 2.3f;
          penModel->Initialize();
        }

        FLOAT3D vPos = GetPlayerWeapons()->m_vRayHit - en_vGravityDir * 0.3f;
        ANGLE3D aAngle = GetViewPlacement(CPlacement3D(FLOAT3D(0, 0, 0), ANGLE3D(180, 0, 0)), FLOAT3D(-1, 0, 0), 1.0f).pl_OrientationAngle;

        CEntity *pen = GetWorld()->CreateEntity_t(CPlacement3D(vPos, aAngle), CTString("Classes\\PhysObject.ecl"));
        ((CPhysObject *)pen)->m_penModel = penModel;
        ((CPhysObject *)pen)->m_fSize1 = 2.0f;
        ((CPhysObject *)pen)->m_fSize2 = 0.25f;
        ((CPhysObject *)pen)->m_fSize3 = 2.3f;
        ((CPhysObject *)pen)->m_eSurfaceType = SURFACE_WOOD;
        ((CPhysObject *)pen)->m_fPhysHealth = 200.0f;
        ((CPhysObject *)pen)->m_bPhysEnvDamage = FALSE;
        pen->Initialize();

        if (_pNetwork->IsPlayerLocal(this)) {
          CPrintF("^cffffff created wood pallet at %.0f, %.0f, %.0f\n", vPos(1), vPos(2), vPos(3));
        }
      } break;

      // [Cecil] FIXME: If physics are toggled for some entity held by the gravity gun, the entity might change its
      // physics & collision flags, which will make the gravity gun overwrite them with incorrect ones on release
      // [Cecil] TEMP: Because of this the gravity gun is forced to drop the object for now
      case 8: {
        GetPlayerWeapons()->StopHolding(FALSE);
        _penGlobalController->SendEvent(EStart());
      } break;

      case 9: {
        GetPlayerWeapons()->StopHolding(FALSE);
        _penGlobalController->SendEvent(EStop());
      } break;
    }
  };

  // [Cecil] Render HAX menu
  void RenderMenu(CDrawPort *pdp) {
    FLOAT fScalingX = 1.0f;
    FLOAT fScalingY = 1.0f;
    GetScaling(fScalingX, fScalingY);

    const FLOAT fTextScale = fScalingY;

    pdp->SetFont(_pfdDisplayFont);
    pdp->SetTextScaling(fTextScale * 0.8f);
    pdp->SetTextAspect(1.0f);

    for (INDEX iButton = 0; iButton < 10; iButton++) {
      FLOATaabbox2D boxButton = MenuButton(iButton);
      const FLOAT2D vPos = boxButton.Min();
      const FLOAT2D vSize = boxButton.Size();

      FLOAT2D vMouse(m_vMousePos(1), m_vMousePos(2));
      const BOOL bMouse = (boxButton >= vMouse);

      pdp->Fill(vPos(1) * fScalingX, vPos(2) * fScalingY, vSize(1) * fScalingX, vSize(2) * fScalingY, (bMouse ? hl2_colUIMain : hl2_colUIBorder));

      CTString strButton = "???";

      switch (iButton) {
        case 0: strButton = "god"; break;
        case 1: strButton = "noclip"; break;
        case 2: strButton = "impulse 101"; break;
        case 3: strButton = "kill"; break;
        case 4: strButton = "npc_create rollermine"; break;
        case 5: strButton = "ent_fire !picker ignite"; break;
        case 6: strButton = "ent_create prop_physics_override"; break;
        case 7: strButton = "prop_physics_create wood_pallet001a.mdl"; break;
        case 8: strButton = "Start ODE"; break;
        case 9: strButton = "End ODE"; break;
      }

      // add button number (0.72)
      INDEX iPrintNumber = (iButton + 1) % 10;
      pdp->PutTextCXY(CTString(0, "[%d] %s", iPrintNumber, strButton), (vPos(1)+vSize(1)/2.0f) * fScalingX, (vPos(2)+vSize(2)/2.0f) * fScalingY, 0xFFFFFFFF);
    }

    FLOAT fScale = Min(FLOAT(pdp->GetWidth()), 1024.0f) / 1024.0f;
    FLOAT2D vHAXPos = FLOAT2D(pdp->GetWidth() / 2.0f, 64.0f);
    FLOAT2D vHAXSize = FLOAT2D(512.0f, 128.0f) * fScale * 0.9f;

    pdp->Fill(vHAXPos(1)-vHAXSize(1), vHAXPos(2), vHAXSize(1)*2.0f, vHAXSize(2), hl2_colUIBorder);

    pdp->InitTexture(&_toHAXMenu);
    pdp->AddTexture(vHAXPos(1)-vHAXSize(1), vHAXPos(2), vHAXPos(1)+vHAXSize(1), vHAXPos(2)+vHAXSize(2), hl2_colUIMain|0xFF);
    pdp->FlushRenderingQueue();

    // Mouse pointer
    pdp->InitTexture(&_toMenuPointer);
    const PIX pixMouseW = _toMenuPointer.GetWidth();
    const PIX pixMouseH = _toMenuPointer.GetHeight();

    PIX pixMouseX, pixMouseY;
    CPlayer *pen = (CPlayer *)GetPredictionTail();

    // Use pre-scanned render position of local players
    if (_pNetwork->IsPlayerLocal(pen)) {
      pixMouseX = pen->m_vMouseRender(1) - 1;
      pixMouseY = pen->m_vMouseRender(2) - 1;

    // Use interpolated position of remote players (for demos/observing)
    } else {
      pixMouseX = (Lerp(m_vMousePosLast(1), m_vMousePos(1), _pTimer->GetLerpFactor()) / 640.0f * m_vViewWindow(1)) - 1;
      pixMouseY = (Lerp(m_vMousePosLast(2), m_vMousePos(2), _pTimer->GetLerpFactor()) / 480.0f * m_vViewWindow(2)) - 1;
    }

    pdp->AddTexture(pixMouseX, pixMouseY, pixMouseX + pixMouseW, pixMouseY + pixMouseH, 0xFFFFFFFF);
    pdp->FlushRenderingQueue();
  };

  // [Cecil] Increase acceleration
  void IncreaseAcceleration(BOOL bVertical) {
    FLOAT3D v = en_vCurrentTranslationAbsolute * GetRotationMatrix();
    FLOAT fSpeed = Sqrt(v(1)*v(1) + v(3)*v(3));
    FLOAT fVertSpeed = ClampUp(v(2) * _pTimer->TickQuantum, 0.0f);
    FLOAT fMovingSpeed = (fSpeed / plr_fMoveSpeed);

    if (fSpeed > 0.0f) {
      if (bVertical) {
        m_fSpeedLimit = Clamp(m_fSpeedLimit - fVertSpeed, 0.0f, Min(fMovingSpeed, 10.0f));
      } else {
        m_fSpeedLimit = Clamp(m_fSpeedLimit + 0.25f, 0.0f, Min(fMovingSpeed, 10.0f));
      }
    } else {
      m_fSpeedLimit = 0.0f;
    }
  };

  // [Cecil] Set movement speed
  void PlayerMove(const FLOAT3D &vDir) {
    SetDesiredTranslation(vDir);
  };

  // [Cecil] Set rotation speed
  void PlayerRotate(const ANGLE3D &aRot) {
    SetDesiredRotation(aRot);
  };

  // [Cecil] Set physics flags depending on the state
  void SetPhysics(ULONG eState, BOOL bPhysics, BOOL bCollision) {
    ULONG ulPhysics = 0;
    ULONG ulCollision = 0;

    switch (eState) {
      case PPH_DEAD:
        ulPhysics = EPF_MODEL_CORPSE;
        ulCollision = ECF_CORPSE;
        break;

      case PPH_NOCLIP:
        // Don't be affected by gravity and ignore basic collisions
        ulPhysics = (GetPhysicsFlags() & ~(EPF_TRANSLATEDBYGRAVITY | EPF_ORIENTEDBYGRAVITY));
        ulCollision = (GetCollisionFlags() & ~((ECBI_BRUSH | ECBI_MODEL) << ECB_TEST));
        break;

      case PPH_NORMAL:
        // Be affected by gravity and allow basic collisions
        ulPhysics = (GetPhysicsFlags() | (EPF_TRANSLATEDBYGRAVITY | EPF_ORIENTEDBYGRAVITY));
        ulCollision = (GetCollisionFlags() | ((ECBI_BRUSH | ECBI_MODEL) << ECB_TEST));
        break;

      default:
        // Initialize the player
        ulPhysics = (EPF_MODEL_WALKING | EPF_HASLUNGS | EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL);
        ulCollision = (ECF_MODEL | ((ECBI_PLAYER) << ECB_IS));
        break;
    }

    if (bPhysics) {
      SetPhysicsFlags(ulPhysics);
    }

    if (bCollision) {
      SetCollisionFlags(ulCollision);
    }
  };

  // [Cecil] Teleport player somewhere
  void PlacePlayer(const CPlacement3D &pl, BOOL bTelefrag) {
    if (PhysicsUsable()) {
      PhysObj().SetPosition(pl.pl_PositionVector);

      FLOATmatrix3D mRot;
      MakeRotationMatrix(mRot, pl.pl_OrientationAngle);
      PhysObj().SetMatrix(mRot);
    }

    CPlacement3D plFrom = GetPlacement();
    Teleport(pl, bTelefrag);
    AfterTeleport(plFrom, CPlacement3D(FLOAT3D(0, 0, 0), ANGLE3D(0, 0, 0)));
  };

  void PlacePlayer(const CPlacement3D &pl) {
    PlacePlayer(pl, TRUE);
  };

  // [Cecil] Extra adjustments after teleporting
  void AfterTeleport(const CPlacement3D &plFrom, const CPlacement3D &plSpeed) {
    // Reset collision polygon
    m_cpoStandOn.Reset();

    // Update crosshair position to avoid twitching
    GetPlayerWeapons()->UpdateTargetingInfo();
  };

  // [Cecil] Get absolute view placement
  CPlacement3D GetViewPlacement(CPlacement3D plOffset, const FLOAT3D &vLimitAngle, FLOAT fLerp) {
    CPlacement3D pl;
    pl.Lerp(en_plLastViewpoint, en_plViewpoint, fLerp);

    for (INDEX i = 1; i <= 3; i++) {
      FLOAT fAngle = vLimitAngle(i);

      if (fAngle >= 0.0f) {
        pl.pl_OrientationAngle(i) = Clamp(NormalizeAngle(pl.pl_OrientationAngle(i)), -fAngle, fAngle);
      }
    }

    plOffset.RelativeToAbsoluteSmooth(pl);
    plOffset.RelativeToAbsoluteSmooth(GetLerpedPlacement());

    return plOffset;
  };

  // [Cecil] Play suit sounds
  void SuitSound(ESuitSound eSound) {
    // No suit, some sound is playing, or dead
    if (!m_bHEVSuit || m_soSuit.IsPlaying() || GetHealth() <= 0.0f) {
      return;
    }

    INDEX iSound = SOUND_SILENCE;

    switch (eSound) {
      case ESS_AMMO:  iSound = SOUND_SUIT_AMMO; break;
      case ESS_HEAT:  iSound = SOUND_SUIT_HEAT; break;
      case ESS_SHOCK: iSound = SOUND_SUIT_SHOCK; break;
      case ESS_ARMOR: iSound = SOUND_SUIT_ARMOR; break;
      case ESS_DEATH: iSound = SOUND_SUIT_DEATH; break;
      case ESS_MEDIC: iSound = SOUND_SUIT_MEDIC; break;
      case ESS_CRIT:  iSound = SOUND_SUIT_CRITICAL; break;
      case ESS_MAJOR: iSound = SOUND_SUIT_MAJOR; break;
      case ESS_MINOR: iSound = SOUND_SUIT_MINOR; break;
    }

    if (_penViewPlayer == this) {
      PlaySound(m_soSuit, iSound, SOF_3D);
    }
  };

  // [Cecil] Reset zoom
  void ResetSuitZoom(void) {
    m_bSuitZoom = FALSE;
    m_fZoomFOV = 90.0f;
    m_fLastZoomFOV = 90.0f;
  };

  void AddBouble(FLOAT3D vPos, FLOAT3D vSpeedRelative) {
    ShellLaunchData &sld = m_asldData[m_iFirstEmptySLD];
    sld.sld_vPos = vPos;
    const FLOATmatrix3D &m = GetRotationMatrix();
    FLOAT3D vUp( m(1,2), m(2,2), m(3,2));
    sld.sld_vUp = vUp;
    sld.sld_vSpeed = vSpeedRelative*m;
    sld.sld_tmLaunch = _pTimer->CurrentTick();
    sld.sld_estType = ESL_BUBBLE;
    // move to next shell position
    m_iFirstEmptySLD = (m_iFirstEmptySLD+1) % MAX_FLYING_SHELLS;
  };

  void ClearShellLaunchData(void) {
    // clear flying shells data array
    m_iFirstEmptySLD = 0;
    for (INDEX iShell = 0; iShell < MAX_FLYING_SHELLS; iShell++) {
      m_asldData[iShell].sld_tmLaunch = -100.0f;
    }
  };

  void AddBulletSpray(FLOAT3D vPos, EffectParticlesType eptType, FLOAT3D vStretch) {
    // [Cecil] No spray
    if (eptType == EPT_NONE) {
      return;
    }

    BulletSprayLaunchData &bsld = m_absldData[m_iFirstEmptyBSLD];
    bsld.bsld_vPos = vPos;
    bsld.bsld_vG = en_vGravityDir;
    bsld.bsld_eptType = eptType;
    bsld.bsld_iRndBase = FRnd()*123456;
    bsld.bsld_tmLaunch = _pTimer->CurrentTick();
    bsld.bsld_vStretch = vStretch;
    // move to bullet spray position
    m_iFirstEmptyBSLD = (m_iFirstEmptyBSLD+1) % MAX_BULLET_SPRAYS;
  };

  void ClearBulletSprayLaunchData(void) {
    m_iFirstEmptyBSLD = 0;

    for (INDEX iBulletSpray = 0; iBulletSpray < MAX_BULLET_SPRAYS; iBulletSpray++) {
      m_absldData[iBulletSpray].bsld_tmLaunch = -100.0f;
    }
  };

  void AddGoreSpray( FLOAT3D vPos, FLOAT3D v3rdPos, SprayParticlesType sptType, FLOAT3D vSpilDirection,
    FLOATaabbox3D boxHitted, FLOAT fDamagePower, COLOR colParticles)
  {
    GoreSprayLaunchData &gsld = m_agsldData[m_iFirstEmptyGSLD];
    gsld.gsld_vPos = vPos;
    gsld.gsld_v3rdPos = v3rdPos;
    gsld.gsld_vG = en_vGravityDir;
    gsld.gsld_fGA = en_fGravityA;
    gsld.gsld_sptType = sptType;
    gsld.gsld_boxHitted = boxHitted;
    gsld.gsld_vSpilDirection = vSpilDirection;
    gsld.gsld_fDamagePower=fDamagePower;
    gsld.gsld_tmLaunch = _pTimer->CurrentTick();
    gsld.gsld_colParticles = colParticles;
    // move to bullet spray position
    m_iFirstEmptyGSLD = (m_iFirstEmptyGSLD+1) % MAX_GORE_SPRAYS;
  }

  void ClearGoreSprayLaunchData( void)
  {
    m_iFirstEmptyGSLD = 0;
    for( INDEX iGoreSpray=0; iGoreSpray<MAX_GORE_SPRAYS; iGoreSpray++)
    {
      m_agsldData[iGoreSpray].gsld_tmLaunch = -100.0f;
    }
  }

  void CPlayer(void)  {
    // clear flying shells data array
    bUseButtonHeld = FALSE;
    ClearShellLaunchData();
    ClearBulletSprayLaunchData();
    ClearGoreSprayLaunchData();
    m_tmPredict = 0;

    // [Cecil] Reset menu variables
    m_vMouseRender = FLOAT2D(0, 0);
    m_vViewWindow = FLOAT2D(0, 0);

    // [Cecil] New message system
    m_astrCaptions.New(CT_CAPTIONS+1);
    m_atmCaptionsIn.New(CT_CAPTIONS+1);
    m_atmCaptionsOut.New(CT_CAPTIONS+1);

    // [Cecil] Reset
    for (INDEX i = 0; i <= CT_CAPTIONS; i++) {
      m_astrCaptions[i] = "";
      m_atmCaptionsIn[i] = -100.0f;
      m_atmCaptionsOut[i] = -100.0f;
    }

    // [Cecil] Set physics object owner
    PhysObj().SetOwner(this);

    // [Cecil] Reset polygon
    m_cpoStandOn.Reset();
  };

  // [Cecil] Initialize entity
  void OnInitialize(const CEntityEvent &eeInput) {
    CCecilPlayerEntity::OnInitialize(eeInput);

    // Reset polygon
    m_cpoStandOn.Reset();
  };

  // [Cecil] Immediately react to certain events
  BOOL HandleEvent(const CEntityEvent &ee) {
    switch (ee.ee_slEvent) {
      // Teleport held object with the player
      case EVENTCODE_ETeleport: {
        CEntity *penObject = GetPlayerWeapons()->m_syncHolding.GetSyncedEntity();

        if (penObject != NULL && !IS_PLAYER(penObject)) {
          CPlacement3D plView = en_plViewpoint;
          plView.RelativeToAbsolute(GetPlacement());

          // [Cecil] TODO: Remember proper offset during object holding, so it could be reused here
          CPlacement3D plOffset(FLOAT3D(0, 0, -4), ANGLE3D(0, 0, 0));
          plOffset.RelativeToAbsolute(plView);

          penObject->Teleport(plOffset, FALSE);
        }
      } return TRUE;

      // Gravity Gun actions
      case EVENTCODE_EGravityGunStart: return TRUE;
      case EVENTCODE_EGravityGunStop: return TRUE;

      case EVENTCODE_EGravityGunPush: {
        const EGravityGunPush &ePush = (const EGravityGunPush &)ee;
        GravityGunPush(this, ePush.vDir, ePush.vHit);
      } return TRUE;
    }

    return CCecilPlayerEntity::HandleEvent(ee);
  };

  class CPlayerWeapons *GetPlayerWeapons(void) {
    ASSERT(m_penWeapons != NULL);
    return (CPlayerWeapons *)&*m_penWeapons;
  };

  class CPlayerAnimator *GetPlayerAnimator(void) {
    ASSERT(m_penAnimator != NULL);
    return (CPlayerAnimator *)&*m_penAnimator;
  };

  CPlayerSettings *GetSettings(void)
  {
    return (CPlayerSettings *)en_pcCharacter.pc_aubAppearance;
  }

  export void Copy(CEntity &enOther, ULONG ulFlags)
  {
    CCecilPlayerEntity::Copy(enOther, ulFlags);
    CPlayer *penOther = (CPlayer *)(&enOther);
    m_moRender.Copy(penOther->m_moRender);
    m_psLevelStats = penOther->m_psLevelStats;
    m_psLevelTotal = penOther->m_psLevelTotal;
    m_psGameStats  = penOther->m_psGameStats ;
    m_psGameTotal  = penOther->m_psGameTotal ;

    // if creating predictor
    if (ulFlags&COPY_PREDICTOR)
    {
      // copy positions of launched empty shells
      memcpy( m_asldData, penOther->m_asldData, sizeof( m_asldData));
      m_iFirstEmptySLD = penOther->m_iFirstEmptySLD;
      // all messages in the inbox
      m_acmiMessages.Clear();
      m_ctUnreadMessages = 0;
      //m_lsLightSource;
      SetupLightSource(); //? is this ok !!!!

      // [Cecil] Copy polygon
      m_cpoStandOn = penOther->m_cpoStandOn;

    // if normal copying
    } else {
      // copy messages
      m_acmiMessages = penOther->m_acmiMessages;
      m_ctUnreadMessages = penOther->m_ctUnreadMessages;

      // [Cecil] Reset polygon
      m_cpoStandOn.Reset();
    }
  }

  // update smoothed (average latency)
  void UpdateLatency(FLOAT tmLatencyNow)
  {
    TIME tmNow = _pTimer->GetHighPrecisionTimer().GetSeconds();

    // if not enough time passed
    if (tmNow<m_tmLatencyLastAvg+hud_tmLatencySnapshot) {
      // just sum
      m_tmLatencyAvgSum += tmLatencyNow;
      m_ctLatencyAvg++;

    // if enough time passed
    } else {
      // calculate average
      m_tmLatency = m_tmLatencyAvgSum/m_ctLatencyAvg;
      // reset counters
      m_tmLatencyAvgSum = 0.0f;
      m_ctLatencyAvg = 0;
      m_tmLatencyLastAvg = tmNow;
    }

    if (_pNetwork->IsPlayerLocal(this)) {
      en_tmPing = m_tmLatency;
      net_tmLatencyAvg = en_tmPing;
    }
  }

  // check character data for invalid values
  void ValidateCharacter(void) {
    // if in single player or flyover
    if (GetSP()->sp_bSinglePlayer) {
      // always use default model
      CPlayerSettings *pps = (CPlayerSettings *)en_pcCharacter.pc_aubAppearance;
      memset(pps->ps_achModelFile, 0, sizeof(pps->ps_achModelFile));
    }
  };

  // parse gender from your name
  void ParseGender(CTString &strName) {
    strName.RemovePrefix("#male#") ||
    strName.RemovePrefix("#female#");
  };

  void CheckHighScore(void) {
    // if not playing a demo
    if (!_pNetwork->IsPlayingDemo()) {
      // update our local high score with the external
      if (plr_iHiScore>m_iHighScore) {
        m_iHighScore = plr_iHiScore;
      }
    }

    // if current score is better than highscore
    if (m_psGameStats.ps_iScore > m_iHighScore) {
      // if it is a highscore greater than the last one beaten
      if (m_iHighScore > m_iBeatenHighScore) {
        // remember that it was beaten
        m_iBeatenHighScore = m_iHighScore;
      }
    }
  };

  CTString GetPredictName(void) const
  {
    if (IsPredicted()) {
      return "PREDICTED";
    } else if (IsPredictor()) {
      return "predictor";
    } else if (GetFlags()&ENF_WILLBEPREDICTED){
      return "WILLBEPREDICTED";
    } else {
      return "no prediction";
    }
  }
  /* Write to stream. */
  void Write_t( CTStream *ostr) // throw char *
  {
    CCecilPlayerEntity::Write_t(ostr);
    // save array of messages
    ostr->WriteID_t("MSGS");
    INDEX ctMsg = m_acmiMessages.Count();
    (*ostr)<<ctMsg;
    for(INDEX iMsg=0; iMsg<ctMsg; iMsg++) {
      m_acmiMessages[iMsg].Write_t(*ostr);
    }
    ostr->Write_t(&m_psLevelStats, sizeof(m_psLevelStats));
    ostr->Write_t(&m_psLevelTotal, sizeof(m_psLevelTotal));
    ostr->Write_t(&m_psGameStats , sizeof(m_psGameStats ));
    ostr->Write_t(&m_psGameTotal , sizeof(m_psGameTotal ));

    // [Cecil] Write collision polygon
    m_cpoStandOn.Write_t(this, ostr);
  }

  /* Read from stream. */
  void Read_t( CTStream *istr) {
    CCecilPlayerEntity::Read_t(istr);
    // clear flying shells data array
    ClearShellLaunchData();
    ClearBulletSprayLaunchData();
    ClearGoreSprayLaunchData();
    // load array of messages
    istr->ExpectID_t("MSGS");
    INDEX ctMsg;
    (*istr)>>ctMsg;
    m_acmiMessages.Clear();
    m_ctUnreadMessages = 0;
    if (ctMsg > 0) {
      m_acmiMessages.Push(ctMsg);
      for (INDEX iMsg = 0; iMsg<ctMsg; iMsg++) {
        m_acmiMessages[iMsg].Read_t(*istr);
        if (!m_acmiMessages[iMsg].cmi_bRead) {
          m_ctUnreadMessages++;
        }
      }
    }

    istr->Read_t(&m_psLevelStats, sizeof(m_psLevelStats));
    istr->Read_t(&m_psLevelTotal, sizeof(m_psLevelTotal));
    istr->Read_t(&m_psGameStats , sizeof(m_psGameStats ));
    istr->Read_t(&m_psGameTotal , sizeof(m_psGameTotal ));

    // [Cecil] Read collision polygon
    m_cpoStandOn.Read_t(this, istr);

    // set your real appearance if possible
    ValidateCharacter();
    CTString strDummy;
    SetPlayerAppearance(&m_moRender, &en_pcCharacter, strDummy, FALSE);
    ParseGender(strDummy);
    m_ulFlags |= PLF_SYNCWEAPON;
    // setup light source
    SetupLightSource();
  };

  /* Get static light source information. */
  CLightSource *GetLightSource(void) {
    if (!IsPredictor()) {
      return &m_lsLightSource;
    } else {
      return NULL;
    }
  };

  // called by other entities to set time prediction parameter
  void SetPredictionTime(TIME tmAdvance)   // give time interval in advance to set
  {
    m_tmPredict = _pTimer->CurrentTick()+tmAdvance;
  };

  // called by engine to get the upper time limit 
  TIME GetPredictionTime(void)   // return moment in time up to which to predict this entity
  {
    return m_tmPredict;
  };

  // get maximum allowed range for predicting this entity
  FLOAT GetPredictionRange(void) {
    return cli_fPredictPlayersRange;
  };

  // add to prediction any entities that this entity depends on
  void AddDependentsToPrediction(void) {
    m_penWeapons->AddToPrediction();
    m_penAnimator->AddToPrediction();
    m_penView->AddToPrediction();
    m_pen3rdPersonView->AddToPrediction();
  };

  // get in-game time for statistics
  TIME GetStatsInGameTimeLevel(void) {
    if (m_bEndOfLevel) {
      return m_psLevelStats.ps_tmTime;
    } else {
      return _pNetwork->GetGameTime()-m_tmLevelStarted;
    }
  };

  TIME GetStatsInGameTimeGame(void) {
    if (m_bEndOfLevel) {
      return m_psGameStats.ps_tmTime;
    } else {
      return m_psGameStats.ps_tmTime + (_pNetwork->GetGameTime()-m_tmLevelStarted);
    }
  };

  FLOAT GetStatsRealWorldTime(void) {
    time_t timeNow;
    if (m_bEndOfLevel) { 
      timeNow = m_iEndTime; 
    } else {
      time(&timeNow);
    }
    return (FLOAT)difftime(timeNow, m_iStartTime);
  };

  CTString GetStatsRealWorldStarted(void) {
    struct tm *newtime;
    time_t tmStart = m_iStartTime;
    newtime = localtime(&tmStart);

    setlocale(LC_ALL, "");
    CTString strTimeline;
    char achTimeLine[256]; 
    strftime( achTimeLine, sizeof(achTimeLine)-1, "%a %x %H:%M", newtime);
    strTimeline = achTimeLine;
    setlocale(LC_ALL, "C");
    return strTimeline;
  };

  // fill in player statistics
  export void GetStats(CTString &strStats, const CompStatType csType, INDEX ctCharsPerRow) {
    // get proper type of stats
    if (csType == CST_SHORT) {
      GetShortStats(strStats);
    } else {
      ASSERT(csType == CST_DETAIL);

      strStats = "\n";
      _ctAlignWidth = Min(ctCharsPerRow, INDEX(60));

      if (GetSP()->sp_bCooperative) {
        if (GetSP()->sp_bSinglePlayer) {
          GetDetailStatsSP(strStats, 0);
        } else {
          GetDetailStatsCoop(strStats);
        }
      } else {
        GetDetailStatsDM(strStats);
      }
    }
  };

  // get short one-line statistics - used for savegame descriptions and similar
  void GetShortStats(CTString &strStats) {
    strStats.PrintF(TRANS("%s %s Score: %d Kills: %d/%d"), 
                    GetDifficultyString(), TimeToString(GetStatsInGameTimeLevel()), 
                    m_psLevelStats.ps_iScore, m_psLevelStats.ps_iKills, m_psLevelTotal.ps_iKills);
  };

  // get detailed statistics for deathmatch game
  void GetDetailStatsDM(CTString &strStats) {
    extern INDEX SetAllPlayersStats( INDEX iSortKey);
    extern CPlayer *_apenPlayers[NET_MAXGAMEPLAYERS];
    // determine type of game
    const BOOL bFragMatch = GetSP()->sp_bUseFrags;

    // fill players table
    const INDEX ctPlayers = SetAllPlayersStats(bFragMatch?5:3); // sort by frags or by score

    // get time elapsed since the game start
    strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%s", TRANS("TIME"), TimeToString(_pNetwork->GetGameTime())));
    strStats+="\n";

    // find maximum frags/score that one player has
    INDEX iMaxFrags = LowerLimit(INDEX(0));
    INDEX iMaxScore = LowerLimit(INDEX(0));

    {for(INDEX iPlayer = 0; iPlayer < ctPlayers; iPlayer++) {
      CPlayer *penPlayer = _apenPlayers[iPlayer];
      iMaxFrags = Max(iMaxFrags, penPlayer->m_psLevelStats.ps_iKills);
      iMaxScore = Max(iMaxScore, penPlayer->m_psLevelStats.ps_iScore);
    }}

    // print game limits
    const CSessionProperties &sp = *GetSP();
    if (sp.sp_iTimeLimit>0) {
      FLOAT fTimeLeft = ClampDn(sp.sp_iTimeLimit*60.0f - _pNetwork->GetGameTime(), 0.0f);
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%s", TRANS("TIME LEFT"), TimeToString(fTimeLeft)));
      strStats+="\n";
    }
    if (bFragMatch && sp.sp_iFragLimit>0) {
      INDEX iFragsLeft = ClampDn(sp.sp_iFragLimit-iMaxFrags, INDEX(0));
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%d", TRANS("FRAGS LEFT"), iFragsLeft));
      strStats+="\n";
    }
    if (!bFragMatch && sp.sp_iScoreLimit>0) {
      INDEX iScoreLeft = ClampDn(sp.sp_iScoreLimit-iMaxScore, INDEX(0));
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%d", TRANS("SCORE LEFT"), iScoreLeft));
      strStats+="\n";
    }
    strStats += "\n";

    CTString strRank = TRANS("NO.");
    CTString strFrag = bFragMatch ? TRANS("FRAGS"):TRANS("SCORE");
    CTString strPing = TRANS("PING");
    CTString strName = TRANS("PLAYER");
    INDEX ctRankChars = Max(strRank.Length(), INDEX(3)) ;
    INDEX ctFragChars = Max(strFrag.Length(), INDEX(7)) ;
    INDEX ctPingChars = Max(strPing.Length(), INDEX(5)) ;
    INDEX ctNameChars = Max(strName.Length(), INDEX(20));

    // header
    strStats += "^cFFFFFF";
    strStats += PadStringRight(strRank, ctRankChars)+" ";
    strStats += PadStringLeft (strFrag, ctFragChars)+" ";
    strStats += PadStringLeft (strPing, ctPingChars)+" ";
    strStats += PadStringRight(strName, ctNameChars)+" ";
    strStats += "^r";
    strStats += "\n\n";

    {for(INDEX iPlayer = 0; iPlayer < ctPlayers; iPlayer++) {
      CTString strLine;
      CPlayer *penPlayer = _apenPlayers[iPlayer];
      INDEX iPing = ceil(penPlayer->en_tmPing*1000.0f);
      INDEX iScore = bFragMatch ? penPlayer->m_psLevelStats.ps_iKills : penPlayer->m_psLevelStats.ps_iScore;
      CTString strName = penPlayer->GetPlayerName();

      strStats += PadStringRight(CTString(0, "%d", iPlayer+1), ctRankChars)+" ";
      strStats += PadStringLeft (CTString(0, "%d", iScore),    ctFragChars)+" ";
      strStats += PadStringLeft (CTString(0, "%d", iPing),     ctPingChars)+" ";
      strStats += PadStringRight(strName,                      ctNameChars)+" ";
      strStats += "\n";
    }}
  }

  // get singleplayer statistics
  void GetDetailStatsCoop(CTString &strStats)
  {
    // first put in your full stats
    strStats += "^b"+CenterString(TRANS("YOUR STATS"))+"^r\n";
    strStats+="\n";
    GetDetailStatsSP(strStats, 1);

    // get stats from all players
    extern INDEX SetAllPlayersStats( INDEX iSortKey);
    extern CPlayer *_apenPlayers[NET_MAXGAMEPLAYERS];
    const INDEX ctPlayers = SetAllPlayersStats(3); // sort by score

    // for each player
    PlayerStats psSquadLevel = PlayerStats();
    PlayerStats psSquadGame  = PlayerStats();
    {for( INDEX iPlayer=0; iPlayer<ctPlayers; iPlayer++) {
      CPlayer *penPlayer = _apenPlayers[iPlayer];
      // add values to squad stats
      ASSERT( penPlayer!=NULL);
      PlayerStats psLevel = penPlayer->m_psLevelStats;
      PlayerStats psGame  = penPlayer->m_psGameStats;
      psSquadLevel.ps_iScore   += psLevel.ps_iScore;
      psSquadLevel.ps_iKills   += psLevel.ps_iKills;
      psSquadLevel.ps_iDeaths  += psLevel.ps_iDeaths;
      psSquadLevel.ps_iSecrets += psLevel.ps_iSecrets;
      psSquadGame.ps_iScore    += psGame.ps_iScore;
      psSquadGame.ps_iKills    += psGame.ps_iKills;
      psSquadGame.ps_iDeaths   += psGame.ps_iDeaths;
      psSquadGame.ps_iSecrets  += psGame.ps_iSecrets;
    }}

    // add squad stats
    strStats+="\n";
    strStats += "^b"+CenterString(TRANS("SQUAD TOTAL"))+"^r\n";
    strStats+="\n";
    strStats+=CTString(0, "^cFFFFFF%s^r", TranslateConst(en_pwoWorld->GetName(), 0));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("SCORE"), psSquadLevel.ps_iScore));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("DEATHS"), psSquadLevel.ps_iDeaths));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("KILLS"), psSquadLevel.ps_iKills, m_psLevelTotal.ps_iKills));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("SECRETS"), psSquadLevel.ps_iSecrets, m_psLevelTotal.ps_iSecrets));
    strStats+="\n";
    strStats+="\n";
    strStats+=CTString("^cFFFFFF")+TRANS("TOTAL")+"^r\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("SCORE"), psSquadGame.ps_iScore));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("DEATHS"), psSquadGame.ps_iDeaths));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("KILLS"), psSquadGame.ps_iKills, m_psGameTotal.ps_iKills));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("SECRETS"), psSquadGame.ps_iSecrets, m_psGameTotal.ps_iSecrets));
    strStats+="\n";
    strStats+="\n";


    strStats+="\n";
    strStats += "^b"+CenterString(TRANS("OTHER PLAYERS"))+"^r\n";
    strStats+="\n";

    // for each player
    {for(INDEX iPlayer=0; iPlayer<ctPlayers; iPlayer++) {
      CPlayer *penPlayer = _apenPlayers[iPlayer];
      // if this one
      if (penPlayer==this) {
        // skip it
        continue;
      }
      // add his stats short
      strStats+="^cFFFFFF"+CenterString(penPlayer->GetPlayerName())+"^r\n\n";
      penPlayer->GetDetailStatsSP(strStats, 2);
      strStats+="\n";
    }}
  }

  // get singleplayer statistics
  void GetDetailStatsSP(CTString &strStats, INDEX iCoopType)
  {
    if (iCoopType<=1) {
      if (m_bEndOfGame) {
        if (GetSP()->sp_gdGameDifficulty==CSessionProperties::GD_EXTREME) {
          strStats+=TRANS("^f4SERIOUS GAME FINISHED,\nMENTAL MODE IS NOW ENABLED!^F\n\n");
        } else if (GetSP()->sp_bMental) {
          strStats+=TRANS("^f4YOU HAVE MASTERED THE GAME!^F\n\n");
        }
      }
    }

    if (iCoopType<=1) {
      // report total score info
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%d", TRANS("TOTAL SCORE"), m_psGameStats.ps_iScore));
      strStats+="\n";
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%s", TRANS("DIFFICULTY"), GetDifficultyString()));
      strStats+="\n";
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%s", TRANS("STARTED"), GetStatsRealWorldStarted()));
      strStats+="\n";
      strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%s", TRANS("PLAYING TIME"), TimeToString(GetStatsRealWorldTime())));
      strStats+="\n";

      if (m_psGameStats.ps_iScore <= plr_iHiScore) {
        strStats+=AlignString(CTString(0, "^cFFFFFF%s:^r\n%d", TRANS("HI-SCORE"), plr_iHiScore));
      } else {
        strStats+=TRANS("YOU BEAT THE HI-SCORE!");
      }
      strStats+="\n\n";
    }

    // report this level statistics
    strStats += CTString(0, "^cFFFFFF%s^r", TranslateConst(en_pwoWorld->GetName(), 0));
    strStats += "\n";

    if (iCoopType <= 1) {
      if (m_bEndOfLevel) {
        strStats+=AlignString(CTString(0, "  %s:\n%s", TRANS("ESTIMATED TIME"), TimeToString(m_tmEstTime)));
        strStats+="\n";
        strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("TIME BONUS"), m_iTimeScore));
        strStats+="\n";
        strStats+="\n";
      }
    }

    strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("SCORE"), m_psLevelStats.ps_iScore));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("KILLS"), m_psLevelStats.ps_iKills, m_psLevelTotal.ps_iKills));
    strStats+="\n";
    if (iCoopType>=1) {
      strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("DEATHS"), m_psLevelStats.ps_iDeaths, m_psLevelTotal.ps_iDeaths));
      strStats+="\n";
    }
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("SECRETS"), m_psLevelStats.ps_iSecrets, m_psLevelTotal.ps_iSecrets));
    strStats+="\n";
    if (iCoopType<=1) {
      strStats+=AlignString(CTString(0, "  %s:\n%s", TRANS("TIME"), TimeToString(GetStatsInGameTimeLevel())));
      strStats+="\n";
    }
    strStats+="\n";

    // report total game statistics
    strStats+=CTString("^cFFFFFF")+TRANS("TOTAL")+"^r";
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("SCORE"), m_psGameStats.ps_iScore));
    strStats+="\n";
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("KILLS"), m_psGameStats.ps_iKills, m_psGameTotal.ps_iKills));
    strStats+="\n";
    if (iCoopType>=1) {
      strStats+=AlignString(CTString(0, "  %s:\n%d", TRANS("DEATHS"), m_psGameStats.ps_iDeaths, m_psGameTotal.ps_iDeaths));
      strStats+="\n";
    }
    strStats+=AlignString(CTString(0, "  %s:\n%d/%d", TRANS("SECRETS"), m_psGameStats.ps_iSecrets, m_psGameTotal.ps_iSecrets));
    strStats+="\n";
    if (iCoopType<=1) {
      strStats+=AlignString(CTString(0, "  %s:\n%s", TRANS("GAME TIME"), TimeToString(GetStatsInGameTimeGame())));
      strStats+="\n";
    }
    strStats+="\n";
    
    // set per level outputs
    if (iCoopType<1) {
      if (m_strLevelStats != "") {
        strStats += CTString("^cFFFFFF")+TRANS("Per level statistics") +"^r\n\n" + m_strLevelStats;
      }
    }
  }

  // provide info for GameSpy enumeration
  void GetGameSpyPlayerInfo( INDEX iPlayer, CTString &strOut) 
  {
    CTString strKey;
    strKey.PrintF("\\player_%d\\%s", iPlayer, (const char*)GetPlayerName());
	  strOut+=strKey;
    if (GetSP()->sp_bUseFrags) {
      strKey.PrintF("\\frags_%d\\%d", iPlayer, m_psLevelStats.ps_iKills);
	    strOut+=strKey;
    } else {
      strKey.PrintF("\\frags_%d\\%d", iPlayer, m_psLevelStats.ps_iScore);
	    strOut+=strKey;
    }
    strKey.PrintF("\\ping_%d\\%d", iPlayer, INDEX(ceil(en_tmPing*1000.0f)));
    strOut+=strKey;
  };

  // check if message is in inbox
  BOOL HasMessage( const CTFileName &fnmMessage)
  {
    ULONG ulHash = fnmMessage.GetHash();
    INDEX ctMsg = m_acmiMessages.Count();
    for(INDEX iMsg=0; iMsg<ctMsg; iMsg++) {
      if (m_acmiMessages[iMsg].cmi_ulHash      == ulHash &&
          m_acmiMessages[iMsg].cmi_fnmFileName == fnmMessage) {
        return TRUE;
      }
    }
    return FALSE;
  }

  // receive a computer message and put it in inbox if not already there
  void ReceiveComputerMessage(const CTFileName &fnmMessage, ULONG ulFlags)
  {
    // if already received
    if (HasMessage(fnmMessage)) {
      // do nothing
      return;
    }
    // add it to array
    CCompMessageID &cmi = m_acmiMessages.Push();
    cmi.NewMessage(fnmMessage);
    cmi.cmi_bRead = ulFlags&CMF_READ;
    if (!(ulFlags&CMF_READ)) {
      m_ctUnreadMessages++;
      cmp_bUpdateInBackground = TRUE;
    }
    if (!(ulFlags&CMF_READ) && (ulFlags&CMF_ANALYZE)) {
      m_tmAnalyseEnd = _pTimer->CurrentTick()+2.0f;
      m_soMessage.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
      PlaySound(m_soMessage, SOUND_INFO, SOF_3D|SOF_VOLUMETRIC|SOF_LOCAL);
    }
  }

  void SayVoiceMessage(const CTFileName &fnmMessage)
  {
    if (GetSettings()->ps_ulFlags&PSF_NOQUOTES) {
      return;
    }
    SetSpeakMouthPitch();
    PlaySound( m_soSpeech, fnmMessage, SOF_3D|SOF_VOLUMETRIC);
  }

  // receive all messages in one directory - cheat
  void CheatAllMessagesDir(const CTString &strDir, ULONG ulFlags) {
    // list the directory
    CDynamicStackArray<CTFileName> afnmDir;
    MakeDirList(afnmDir, strDir, "*.txt", DLI_RECURSIVE);

    // for each file in the directory
    for (INDEX i=0; i<afnmDir.Count(); i++) {
      CTFileName fnm = afnmDir[i];
      // add the message
      ReceiveComputerMessage(fnm, ulFlags);
    }
  };

  // receive all messages - cheat
  void CheatAllMessages(void) {
    CheatAllMessagesDir("Data\\Messages\\weapons\\", 0);
    CheatAllMessagesDir("Data\\Messages\\enemies\\", 0);
    CheatAllMessagesDir("DataMP\\Messages\\enemies\\", 0);
    CheatAllMessagesDir("DataMP\\Messages\\information\\", 0);
    CheatAllMessagesDir("DataMP\\Messages\\statistics\\", 0);
    CheatAllMessagesDir("DataMP\\Messages\\weapons\\", 0);
    CheatAllMessagesDir("DataMP\\Messages\\background\\", 0);
  };

  // mark that an item was picked
  void ItemPicked(const CTString &strName, FLOAT fAmmount) {
    // if nothing picked too long
    if (_pTimer->CurrentTick() > m_tmLastPicked + PICKEDREPORT_TIME) {
      // kill the name
      m_strPickedName = "";
      // reset picked mana
      m_fPickedMana = 0;
    }

    // if different than last picked
    if (m_strPickedName != strName) {
      // remember name
      m_strPickedName = strName;
      // reset picked ammount
      m_fPickedAmmount = 0;
    }

    // [Cecil] Set the amount instead of increasing
    m_fPickedAmmount = fAmmount;
    m_tmLastPicked = _pTimer->CurrentTick();

    // [Cecil] New message system
    CTString strPicked = m_strPickedName;

    if (m_fPickedAmmount != 0) {
      strPicked.PrintF("%s +%d", m_strPickedName, int(m_fPickedAmmount));
    }
    AddCaption("^caaaaaa^i" + strPicked.Undecorated(), PICKEDREPORT_TIME, FALSE);

    if (!GetSP()->sp_bCooperative && !GetSP()->sp_bUseFrags && m_fPickedMana >= 1) {
      CTString strValue;
      strValue.PrintF("%s +%d", TRANS("Value"), INDEX(m_fPickedMana));
      AddCaption("^caaaaaa^i" + strValue.Undecorated(), PICKEDREPORT_TIME, FALSE);
    }
  };

  // Setup light source
  void SetupLightSource(void) {
    // setup light source
    CLightSource lsNew;
    lsNew.ls_ulFlags = LSF_NONPERSISTENT|LSF_DYNAMIC;
    lsNew.ls_rHotSpot = 1.0f;
    lsNew.ls_colColor = C_WHITE;
    lsNew.ls_rFallOff = 2.5f;
    lsNew.ls_plftLensFlare = NULL;
    lsNew.ls_ubPolygonalMask = 0;
    lsNew.ls_paoLightAnimation = &m_aoLightAnimation;

    m_lsLightSource.ls_penEntity = this;
    m_lsLightSource.SetLightSource(lsNew);
  };

  // play light animation
  void PlayLightAnim(INDEX iAnim, ULONG ulFlags) {
    if (m_aoLightAnimation.GetData()!=NULL) {
      m_aoLightAnimation.PlayAnim(iAnim, ulFlags);
    }
  };

  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    if(cht_bDumpPlayerShading) {
      ANGLE3D a3dHPB;
      DirectionVectorToAngles(-vLightDirection, a3dHPB);
      UBYTE ubAR, ubAG, ubAB;
      UBYTE ubCR, ubCG, ubCB;
      ColorToRGB(colAmbient, ubAR, ubAG, ubAB);
      ColorToRGB(colLight, ubCR, ubCG, ubCB);
      CPrintF("Ambient: %d,%d,%d, Color: %d,%d,%d, Direction HPB (%g,%g,%g)\n",
        ubAR, ubAG, ubAB, ubCR, ubCG, ubCB, a3dHPB(1), a3dHPB(2), a3dHPB(3));
    }

    // make models at least a bit bright in deathmatch
    if (!GetSP()->sp_bCooperative) {
      UBYTE ubH, ubS, ubV;
      ColorToHSV(colAmbient, ubH, ubS, ubV);
      if (ubV<22) {
        ubV = 22;
        colAmbient = HSVToColor(ubH, ubS, ubV);
      }      
    }

    return CCecilPlayerEntity::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
  };

  // get a different model object for rendering
  CModelObject *GetModelForRendering(void) {
    // if not yet initialized
    if (!(m_ulFlags & PLF_INITIALIZED)) { 
      // return base model
      return GetModelObject();
    }

    // lerp player viewpoint
    CPlacement3D plView;
    plView.Lerp(en_plLastViewpoint, en_plViewpoint, _pTimer->GetLerpFactor());
    // body and head attachment animation
    ((CPlayerAnimator&)*m_penAnimator).BodyAndHeadOrientation(plView);
    ((CPlayerAnimator&)*m_penAnimator).OnPreRender();
    // synchronize your appearance with the default model
    m_moRender.Synchronize(*GetModelObject());
    if (m_ulFlags&PLF_SYNCWEAPON) {
      m_ulFlags &= ~PLF_SYNCWEAPON;
      GetPlayerAnimator()->SyncWeapon();
    }

    FLOAT tmNow = _pTimer->GetLerpedCurrentTick();

    FLOAT fFading = 1.0f;
    if (m_tmFadeStart!=0) {
      FLOAT fFactor = (tmNow-m_tmFadeStart)/5.0f;
      fFactor = Clamp(fFactor, 0.0f, 1.0f);
      fFading*=fFactor;
    }

    // if invunerable after spawning
    FLOAT tmSpawnInvulnerability = GetSP()->sp_tmSpawnInvulnerability;
    if (tmSpawnInvulnerability>0 && tmNow-m_tmSpawned<tmSpawnInvulnerability) {
      // blink fast
      FLOAT fDelta = tmNow-m_tmSpawned;
      fFading *= 0.75f+0.25f*Sin(fDelta/0.5f*360);
    }

    COLOR colAlpha = m_moRender.mo_colBlendColor;
    colAlpha = (colAlpha&0xffffff00) + (COLOR(fFading*0xff)&0xff);
    m_moRender.mo_colBlendColor = colAlpha;

    // if not connected
    if (m_ulFlags&PLF_NOTCONNECTED) {
      // pulse slowly
      fFading *= 0.25f+0.25f*Sin(tmNow/2.0f*360);
    // if invisible
    } else if (m_tmInvisibility>tmNow) {
      FLOAT fIntensity = 0.0f;

      if (m_tmInvisibility - tmNow < 3.0f) {
        fIntensity = 0.5f-0.5f*cos((m_tmInvisibility-tmNow)*(6.0f*3.1415927f/3.0f));
      }

      if (_ulPlayerRenderingMask == 1<<GetMyPlayerIndex()) {
        colAlpha = (colAlpha&0xffffff00)|(INDEX)(INVISIBILITY_ALPHA_LOCAL+(FLOAT)(254-INVISIBILITY_ALPHA_LOCAL)*fIntensity);
      } else if (TRUE) {
        if (m_tmInvisibility - tmNow < 1.28f) {
          colAlpha = (colAlpha&0xffffff00)|(INDEX)(INVISIBILITY_ALPHA_REMOTE+(FLOAT)(254-INVISIBILITY_ALPHA_REMOTE)*fIntensity);
        } else if (TRUE) {
          colAlpha = (colAlpha&0xffffff00)|INVISIBILITY_ALPHA_REMOTE;
        }
      }
      m_moRender.mo_colBlendColor = colAlpha;
    }

    // use the appearance for rendering
    return &m_moRender;
  }

  // wrapper for action marker getting
  class CPlayerActionMarker *GetActionMarker(void) {
    return (CPlayerActionMarker *)&*m_penActionMarker;
  }

  // find main music holder if not remembered
  void FindMusicHolder(void)
  {
    if (m_penMainMusicHolder==NULL) {
      m_penMainMusicHolder = _pNetwork->GetEntityWithName("MusicHolder", 0);
    }
  }

  // update per-level stats
  void UpdateLevelStats(void)
  {
    // clear stats for this level
    m_psLevelStats = PlayerStats();

    // get music holder
    if (m_penMainMusicHolder==NULL) {
      return;
    }
    CMusicHolder &mh = (CMusicHolder&)*m_penMainMusicHolder;

    // assure proper count enemies in current world
    if (mh.m_ctEnemiesInWorld==0) {
      mh.CountEnemies();
    }
    // set totals for level and increment for game
    m_psLevelTotal.ps_iKills = mh.m_ctEnemiesInWorld;
    m_psGameTotal.ps_iKills += mh.m_ctEnemiesInWorld;
    m_psLevelTotal.ps_iSecrets = mh.m_ctSecretsInWorld;
    m_psGameTotal.ps_iSecrets += mh.m_ctSecretsInWorld;
  }

  // check if there is fuss
  BOOL IsFuss(void)
  {
    // if no music holder
    if (m_penMainMusicHolder==NULL) {
      // no fuss
      return FALSE;
    }
    // if no enemies - no fuss
    return ((CMusicHolder*)&*m_penMainMusicHolder)->m_cenFussMakers.Count()>0;
  }

  void SetDefaultMouthPitch(void)
  {
    m_soMouth.Set3DParameters(50.0f, 10.0f, 1.0f, 1.0f);
  }
  void SetRandomMouthPitch(FLOAT fMin, FLOAT fMax)
  {
    m_soMouth.Set3DParameters(50.0f, 10.0f, 1.0f, Lerp(fMin, fMax, FRnd()));
  }
  void SetSpeakMouthPitch(void)
  {
    m_soSpeech.Set3DParameters(50.0f, 10.0f, 2.0f, 1.0f);
  }

  // added: also shake view because of chainsaw firing
  void ApplyShaking(CPlacement3D &plViewer)
  {
    // chainsaw shaking
    FLOAT fT = _pTimer->GetLerpedCurrentTick();
    if (fT < m_tmChainShakeEnd) {
      m_fChainsawShakeDX = 0.03f*m_fChainShakeStrength*SinFast(fT*m_fChainShakeFreqMod*3300.0f);
      m_fChainsawShakeDY = 0.03f*m_fChainShakeStrength*SinFast(fT*m_fChainShakeFreqMod*2900.0f);
      
      plViewer.pl_PositionVector(1) += m_fChainsawShakeDX;
      plViewer.pl_PositionVector(3) += m_fChainsawShakeDY;
    }

    CWorldSettingsController *pwsc = GetWSC(this);
    if (pwsc == NULL || pwsc->m_tmShakeStarted < 0) {
      return;
    }

    TIME tm = _pTimer->GetLerpedCurrentTick()-pwsc->m_tmShakeStarted;
    if (tm < 0) {
      return;
    }

    FLOAT fDistance = (plViewer.pl_PositionVector-pwsc->m_vShakePos).Length();
    FLOAT fIntensity = IntensityAtDistance(pwsc->m_fShakeFalloff, 0, fDistance);
    FLOAT fShakeY, fShakeB, fShakeZ;

    if (!pwsc->m_bShakeFadeIn) {
      fShakeY = SinFast(tm*pwsc->m_tmShakeFrequencyY*360.0f)*
        exp(-tm*(pwsc->m_fShakeFade))*
        fIntensity*pwsc->m_fShakeIntensityY;
      fShakeB = SinFast(tm*pwsc->m_tmShakeFrequencyB*360.0f)*
        exp(-tm*(pwsc->m_fShakeFade))*
        fIntensity*pwsc->m_fShakeIntensityB;
      fShakeZ = SinFast(tm*pwsc->m_tmShakeFrequencyZ*360.0f)*
        exp(-tm*(pwsc->m_fShakeFade))*
        fIntensity*pwsc->m_fShakeIntensityZ;
    } else {
      FLOAT ootm = 1.0f/tm;
      fShakeY = SinFast(tm*pwsc->m_tmShakeFrequencyY*360.0f)*
        exp((tm-2)*ootm*(pwsc->m_fShakeFade))*
        fIntensity*pwsc->m_fShakeIntensityY;
      fShakeB = SinFast(tm*pwsc->m_tmShakeFrequencyB*360.0f)*
        exp((tm-2)*ootm*(pwsc->m_fShakeFade))*
        fIntensity*pwsc->m_fShakeIntensityB;
      fShakeZ = SinFast(tm*pwsc->m_tmShakeFrequencyZ*360.0f)*
        exp((tm-2)*ootm*(pwsc->m_fShakeFade))*
        fIntensity*pwsc->m_fShakeIntensityZ;
    }
    plViewer.pl_PositionVector(2) += fShakeY;
    plViewer.pl_PositionVector(3) += fShakeZ;
    plViewer.pl_OrientationAngle(3) += fShakeB;
  };

  COLOR GetWorldGlaring(void) {
    CWorldSettingsController *pwsc = GetWSC(this);
    if (pwsc == NULL || pwsc->m_tmGlaringStarted < 0) {
      return 0;
    }

    TIME tm = _pTimer->GetLerpedCurrentTick();
    FLOAT fRatio = CalculateRatio(tm, pwsc->m_tmGlaringStarted, pwsc->m_tmGlaringEnded,
      pwsc->m_fGlaringFadeInRatio,  pwsc->m_fGlaringFadeOutRatio);
    COLOR colResult = (pwsc->m_colGlade&0xFFFFFF00)|(UBYTE(fRatio*255.0f));
    return colResult;
  };

  void RenderScroll(CDrawPort *pdp) {
    CWorldSettingsController *pwsc = GetWSC(this);

    if (pwsc != NULL && pwsc->m_penScrollHolder != NULL) {
      CScrollHolder &sch = (CScrollHolder &)*pwsc->m_penScrollHolder;
      sch.Credits_Render(&sch, pdp);
    }
  };

  void RenderCredits(CDrawPort *pdp) {
    CWorldSettingsController *pwsc = GetWSC(this);

    if (pwsc != NULL && pwsc->m_penCreditsHolder != NULL) {
      CCreditsHolder &cch = (CCreditsHolder &)*pwsc->m_penCreditsHolder;
      cch.Credits_Render(&cch, pdp);
    }
  };
  
  void RenderTextFX(CDrawPort *pdp) {
    CWorldSettingsController *pwsc = GetWSC(this);

    if (pwsc != NULL && pwsc->m_penTextFXHolder != NULL) {
      CTextFXHolder &tfx = (CTextFXHolder &)*pwsc->m_penTextFXHolder;
      tfx.TextFX_Render(&tfx, pdp);
    }
  };

  void RenderHudPicFX(CDrawPort *pdp) {
    CWorldSettingsController *pwsc = GetWSC(this);

    if (pwsc != NULL && pwsc->m_penHudPicFXHolder != NULL) {
      CHudPicHolder &hpfx = (CHudPicHolder &)*pwsc->m_penHudPicFXHolder;
      hpfx.HudPic_Render(&hpfx, pdp);
    }
  };

/************************************************************
 *                    RENDER GAME VIEW                      *
 ************************************************************/

  // setup viewing parameters for viewing from player or camera
  void SetupView(CDrawPort *pdp, CAnyProjection3D &apr, CEntity *&penViewer, 
    CPlacement3D &plViewer, COLOR &colBlend, BOOL bCamera)
  {
    // read the exact placement of the view for this tick
    GetLerpedAbsoluteViewPlacement(plViewer);
    ASSERT(IsValidFloat(plViewer.pl_OrientationAngle(1))&&IsValidFloat(plViewer.pl_OrientationAngle(2))&&IsValidFloat(plViewer.pl_OrientationAngle(3)) );
    // get current entity that the player views from
    penViewer = GetViewEntity();

    INDEX iViewState = m_iViewState;
    
    if (m_penCamera != NULL && bCamera) {
      iViewState = PVT_SCENECAMERA;
      plViewer = m_penCamera->GetLerpedPlacement();
      penViewer = m_penCamera;
    }

    // init projection parameters
    CPerspectiveProjection3D prPerspectiveProjection;
    plr_fFOV = Clamp(plr_fFOV, 1.0f, 160.0f);

    ANGLE aFOV = plr_fFOV;

    // [Cecil] Limit custom FOV in Deathmatch
    if (!GetSP()->sp_bCooperative) {
      aFOV = Clamp(aFOV, 60.0f, 110.0f);
    }

    // [Cecil] Adjust FOV for vanilla game
    if (!_bClassicsPatch) {
      // Get aspect ratio of the current resolution
      FLOAT fAspectRatio = FLOAT(pdp->GetWidth()) / FLOAT(pdp->GetHeight());

      // 4:3 resolution = 1.0 ratio; 16:9 = 1.333 etc.
      FLOAT fSquareRatio = fAspectRatio * (3.0f / 4.0f);

      // Take current FOV angle and apply square ratio to it
      FLOAT fVerticalAngle = Tan(aFOV * 0.5f) * fSquareRatio;

      // 90 FOV on 16:9 resolution will become 106.26...
      aFOV = 2.0f * ATan(fVerticalAngle);

    // Change main FOV using Classics Patch commands and reset them instead
    } else {
      static CSymbolPtr pfFOV("sam_fCustomFOV");
      static CSymbolPtr pfThirdFOV("sam_fThirdPersonFOV");

      if (pfFOV.Exists() && pfFOV.GetFloat() != -1.0f) {
        plr_fFOV = pfFOV.GetFloat();
        pfFOV.GetFloat() = -1.0f;
      }

      if (pfThirdFOV.Exists() && pfThirdFOV.GetFloat() != -1.0f) {
        plr_fFOV = pfThirdFOV.GetFloat();
        pfThirdFOV.GetFloat() = -1.0f;
      }
    }

    CPlayerWeapons &penWeapons = (CPlayerWeapons&)*m_penWeapons;

    // [Cecil] Apply zoom
    if (penWeapons.m_iSniping <= 0) {
      aFOV *= (Lerp(m_fLastZoomFOV, m_fZoomFOV, _pTimer->GetLerpFactor()) / 90.0f);
    }

    // sniper zoom
    if (penWeapons.m_iCurrentWeapon == WEAPON_G3SG1) {
      aFOV *= (Lerp(penWeapons.m_fSniperFOVlast, penWeapons.m_fSniperFOV, _pTimer->GetLerpFactor()) / 90.0f);
    }

    // [Cecil] Limit overall FOV
    aFOV = Clamp(aFOV, 1.0f, 179.0f);

    ApplyShaking(plViewer);

    colBlend = 0;
    if (iViewState == PVT_SCENECAMERA) {
      CCamera *pcm = (CCamera*)&*m_penCamera;
      prPerspectiveProjection.FOVL() = 
        Lerp(pcm->m_fLastFOV, pcm->m_fFOV, _pTimer->GetLerpFactor());
      if (pcm->m_tmDelta>0.001f) {
        FLOAT fFactor = (_pTimer->GetLerpedCurrentTick()-pcm->m_tmAtMarker)/pcm->m_tmDelta;
        fFactor = Clamp( fFactor, 0.0f, 1.0f);
        colBlend = LerpColor( pcm->m_colFade0, pcm->m_colFade1, fFactor);

      } else {
        colBlend = pcm->m_colFade0;
      }

    } else {
      prPerspectiveProjection.FOVL() = aFOV;
    }

    prPerspectiveProjection.ScreenBBoxL() = FLOATaabbox2D(
      FLOAT2D(0.0f, 0.0f),
      FLOAT2D((FLOAT)pdp->GetWidth(), (FLOAT)pdp->GetHeight())
    );

    // determine front clip plane
    plr_fFrontClipDistance = Clamp( plr_fFrontClipDistance, 0.05f, 0.50f);
    FLOAT fFCD = plr_fFrontClipDistance;

    // adjust front clip plane if swimming
    if (m_pstState == PST_SWIM && iViewState == PVT_PLAYEREYES) { fFCD *= 0.6666f; }
    prPerspectiveProjection.FrontClipDistanceL() = fFCD;
    prPerspectiveProjection.AspectRatioL() = 1.0f;

    // set up viewer position
    apr = prPerspectiveProjection;
    apr->ViewerPlacementL() = plViewer;
    apr->ObjectPlacementL() = CPlacement3D(FLOAT3D(0,0,0), ANGLE3D(0,0,0));
    prPlayerProjection = apr;
    prPlayerProjection->Prepare();
  }

  // listen from a given viewer
  void ListenFromEntity(CEntity *penListener, const CPlacement3D &plSound) {
    FLOATmatrix3D mRotation;
    MakeRotationMatrixFast(mRotation, plSound.pl_OrientationAngle);
    sliSound.sli_vPosition = plSound.pl_PositionVector;
    sliSound.sli_mRotation = mRotation;
    sliSound.sli_fVolume = 1.0f;
    sliSound.sli_vSpeed = en_vCurrentTranslationAbsolute;
    sliSound.sli_penEntity = penListener;
    if (m_pstState == PST_DIVE) {
      sliSound.sli_fFilter = 20.0f;
    } else {
      sliSound.sli_fFilter = 0.0f;
    }

    INDEX iEnv = 0;

    CBrushSector *pbsc = penListener->GetSectorFromPoint(plSound.pl_PositionVector);

    // for each sector around listener
    if (pbsc!=NULL) {
      iEnv = pbsc->GetEnvironmentType();
    }

    // get the environment
    CEnvironmentType &et = GetWorld()->wo_aetEnvironmentTypes[iEnv];
    sliSound.sli_iEnvironmentType = et.et_iType;
    sliSound.sli_fEnvironmentSize = et.et_fSize;
    _pSound->Listen(sliSound);
  }

  // render dummy view (not connected yet)
  void RenderDummyView(CDrawPort *pdp) {
    // clear screen
    pdp->Fill( C_BLACK|CT_OPAQUE);
    
    // if not single player
    if (!GetSP()->sp_bSinglePlayer) {
      // print a message
      PIX pixDPWidth  = pdp->GetWidth();
      PIX pixDPHeight = pdp->GetHeight();
      FLOAT fScale = (FLOAT)pixDPWidth/640.0f;
      pdp->SetFont(_pfdDisplayFont);
      pdp->SetTextScaling( fScale);
      pdp->SetTextAspect( 1.0f);
      CTString strMsg;
      strMsg.PrintF(TRANS("%s connected"), GetPlayerName());
      pdp->PutTextCXY(strMsg, pixDPWidth*0.5f, pixDPHeight*0.5f, SE_COL_BLUE_NEUTRAL_LT|CT_OPAQUE);
    }
  };

  // render view from player
  void RenderPlayerView(CDrawPort *pdp, BOOL bShowExtras) {
    // [Cecil] Viewing from this player entity
    _penViewPlayer = this;

    CAnyProjection3D apr;
    CEntity *penViewer;
    CPlacement3D plViewer;
    COLOR colBlend;

    // for each eye
    for (INDEX iEye = STEREO_LEFT; iEye <= (Stereo_IsEnabled() ? STEREO_RIGHT : STEREO_LEFT); iEye++) {
      // setup view settings
      SetupView(pdp, apr, penViewer, plViewer, colBlend, FALSE);

      // setup stereo rendering
      Stereo_SetBuffer(iEye);
      Stereo_AdjustProjection(*apr, iEye, 1);

      // render the view
      ASSERT(IsValidFloat(plViewer.pl_OrientationAngle(1))&&IsValidFloat(plViewer.pl_OrientationAngle(2))&&IsValidFloat(plViewer.pl_OrientationAngle(3)));
      _ulPlayerRenderingMask = 1<<GetMyPlayerIndex();
      RenderView(*en_pwoWorld, *penViewer, apr, *pdp);
      _ulPlayerRenderingMask = 0;

      if (iEye == STEREO_LEFT) {
        // listen from here
        ListenFromEntity(this, plViewer);
      }

      RenderScroll(pdp);
      RenderTextFX(pdp);
      RenderCredits(pdp);
      RenderHudPicFX(pdp);

      if (hud_bShowAll && bShowExtras) {
        // let the player entity render its interface
        CPlacement3D plLight(_vViewerLightDirection, ANGLE3D(0,0,0));
        plLight.AbsoluteToRelative(plViewer);
        RenderHUD( *(CPerspectiveProjection3D *)(CProjection3D *)apr, pdp, 
          plLight.pl_PositionVector, _colViewerLight, _colViewerAmbient, 
          penViewer == this && (GetFlags()&ENF_ALIVE), iEye);
      }

      // [Cecil] Render menu
      if (m_bHAXMenu) {
        SetGlobalUI(pdp);
        RenderMenu(pdp);
      }
    }
    Stereo_SetBuffer(STEREO_BOTH);

    // [Cecil] New message system
    SetGlobalUI(pdp);
    PrintCaptions(pdp);

    // determine and cache main drawport, size and relative scale
    /*PIX pixDPWidth  = pdp->GetWidth();
    PIX pixDPHeight = pdp->GetHeight();
    FLOAT fScale = (FLOAT)pixDPWidth/640.0f;

    // print center message
    if (_pTimer->CurrentTick() < m_tmCenterMessageEnd) {
      pdp->SetFont( _pfdDisplayFont);
      pdp->SetTextScaling( fScale);
      pdp->SetTextAspect( 1.0f);
      pdp->PutTextCXY(m_strCenterMessage, pixDPWidth*0.5f, pixDPHeight*0.85f, C_WHITE|0xDD);

    // print picked item
    } else if (_pTimer->CurrentTick() < m_tmLastPicked + PICKEDREPORT_TIME) {
      pdp->SetFont( _pfdDisplayFont);
      pdp->SetTextScaling( fScale);
      pdp->SetTextAspect( 1.0f);
      CTString strPicked;
      if (m_fPickedAmmount==0) {
        strPicked = m_strPickedName;
      } else {
        strPicked.PrintF("%s +%d", m_strPickedName, int(m_fPickedAmmount));
      }
      pdp->PutTextCXY( strPicked, pixDPWidth*0.5f, pixDPHeight*0.82f, C_WHITE|0xDD);
      if (!GetSP()->sp_bCooperative && !GetSP()->sp_bUseFrags && m_fPickedMana>=1) {
        CTString strValue;
        strValue.PrintF("%s +%d", TRANS("Value"), INDEX(m_fPickedMana));
        pdp->PutTextCXY( strValue, pixDPWidth*0.5f, pixDPHeight*0.85f, C_WHITE|0xDD);
      }
    }*/

    // [Cecil] Not needed
    /*if (_pTimer->CurrentTick() < m_tmAnalyseEnd) {
      pdp->SetFont( _pfdDisplayFont);
      pdp->SetTextScaling( fScale);
      pdp->SetTextAspect( 1.0f);
      UBYTE ubA = int(sin(_pTimer->CurrentTick()*10.0f)*127+128);
      pdp->PutTextCXY(TRANS("Analyzing..."), pixDPWidth*0.5f, pixDPHeight*0.2f, SE_COL_BLUE_NEUTRAL_LT|ubA);
    }*/
  }

  // render view from camera
  void RenderCameraView(CDrawPort *pdp, BOOL bListen) {
    CDrawPort dpCamera;
    CDrawPort *pdpCamera = pdp;
    if (m_penCamera!=NULL && ((CCamera&)*m_penCamera).m_bWideScreen) {
      pdp->MakeWideScreen(&dpCamera);
      pdpCamera = &dpCamera;
    }

    pdp->Unlock();
    pdpCamera->Lock();

    CAnyProjection3D apr;
    CEntity *penViewer;
    CPlacement3D plViewer;
    COLOR colBlend;

    // for each eye
    for (INDEX iEye = STEREO_LEFT; iEye <= (Stereo_IsEnabled()?STEREO_RIGHT:STEREO_LEFT); iEye++) {
      // setup view settings
      SetupView(pdpCamera, apr, penViewer, plViewer, colBlend, TRUE);

      // setup stereo rendering
      Stereo_SetBuffer(iEye);
      Stereo_AdjustProjection(*apr, iEye, 1);

      // render the view
      ASSERT(IsValidFloat(plViewer.pl_OrientationAngle(1))&&IsValidFloat(plViewer.pl_OrientationAngle(2))&&IsValidFloat(plViewer.pl_OrientationAngle(3)));
      _ulPlayerRenderingMask = 1<<GetMyPlayerIndex();
      RenderView(*en_pwoWorld, *penViewer, apr, *pdpCamera);
      _ulPlayerRenderingMask = 0;

      // listen from there if needed
      if (bListen && iEye==STEREO_LEFT) {
        ListenFromEntity(penViewer, plViewer);
      }
    }
    Stereo_SetBuffer(STEREO_BOTH);

    RenderScroll(pdpCamera);
    RenderTextFX(pdpCamera);
    RenderCredits(pdpCamera);
    RenderHudPicFX(pdpCamera);

    // add world glaring
    {
      COLOR colGlare = GetWorldGlaring();
      UBYTE ubR, ubG, ubB, ubA;
      ColorToRGBA(colGlare, ubR, ubG, ubB, ubA);
      if (ubA!=0) {
        pdpCamera->dp_ulBlendingRA += ULONG(ubR)*ULONG(ubA);
        pdpCamera->dp_ulBlendingGA += ULONG(ubG)*ULONG(ubA);
        pdpCamera->dp_ulBlendingBA += ULONG(ubB)*ULONG(ubA);
        pdpCamera->dp_ulBlendingA  += ULONG(ubA);
      }
      // do all queued screen blendings
      pdpCamera->BlendScreen();
    }

    pdpCamera->Unlock();
    pdp->Lock();

    // camera fading
    if ((colBlend&CT_AMASK)!=0) {
      pdp->Fill(colBlend);
    }

    // [Cecil] New message system
    SetGlobalUI(pdp);
    PrintCaptions(pdp);

    // print center message
    /*if (_pTimer->CurrentTick()<m_tmCenterMessageEnd) {
      PIX pixDPWidth  = pdp->GetWidth();
      PIX pixDPHeight = pdp->GetHeight();
      FLOAT fScale = (FLOAT)pixDPWidth/640.0f;
      pdp->SetFont( _pfdDisplayFont);
      pdp->SetTextScaling( fScale);
      pdp->SetTextAspect( 1.0f);
      pdp->PutTextCXY( m_strCenterMessage, pixDPWidth*0.5f, pixDPHeight*0.85f, C_WHITE|0xDD);
    }*/
  };

  void RenderGameView(CDrawPort *pdp, void *pvUserData) {
    BOOL bShowExtras = (ULONG(pvUserData)&GRV_SHOWEXTRAS);

    // [Cecil] Reset mouse position if window size is reset
    const FLOAT2D vCurrentViewWindow(pdp->GetWidth(), pdp->GetHeight());

    if (m_vViewWindow != vCurrentViewWindow) {
      m_vMouseRender = vCurrentViewWindow * 0.5f;
    }

    // [Cecil] Remember current view window size
    m_vViewWindow = vCurrentViewWindow;

    pdp->Unlock();

    // if not yet initialized
    if (!(m_ulFlags&PLF_INITIALIZED) || (m_ulFlags&PLF_DONTRENDER)) {
      // render dummy view on the right drawport
      CDrawPort dpView(pdp, TRUE);
      if (dpView.Lock()) {
        RenderDummyView(&dpView);
        dpView.Unlock();
      }
      pdp->Lock();
      return; 
    }

    // if rendering real game view (not thumbnail, or similar)
    if (pvUserData!=0) {
      // if rendered a game view recently
      CTimerValue tvNow = _pTimer->GetHighPrecisionTimer();
      if ((tvNow-_tvProbingLast).GetSeconds()<0.1) {
        // allow probing
        _pGfx->gl_bAllowProbing = TRUE;
      }
      _tvProbingLast = tvNow;
    }

    //CPrintF("%s: render\n", GetPredictName());

    // check for dualhead
    BOOL bDualHead = 
      pdp->IsDualHead() && 
      GetSP()->sp_gmGameMode!=CSessionProperties::GM_FLYOVER &&
      m_penActionMarker==NULL;

    // if dualhead, or no camera active
    if (bDualHead || m_penCamera == NULL) {
      // make left player view
      CDrawPort dpView(pdp, TRUE);
      if (dpView.Lock()) {
        // draw it
        RenderPlayerView(&dpView, bShowExtras);
        dpView.Unlock();
      }
    }

    // if camera active
    if (m_penCamera != NULL) {
      // make left or right camera view
      CDrawPort dpView(pdp, m_penActionMarker != NULL);
      if (dpView.Lock()) {
        // draw it, listen if not dualhead
        RenderCameraView(&dpView, !bDualHead);
        dpView.Unlock();
      }
    // if camera is not active
    } else {
      // if dualhead
      if (bDualHead) {
        // render computer on secondary display
        cmp_ppenDHPlayer = this;
      }
    }
    // all done - lock back the original drawport
    pdp->Lock();
  };




/************************************************************
 *                   PRE/DO/POST MOVING                     *
 ************************************************************/

  // premoving for soft player up-down movement
  void PreMoving(void) {
    ((CPlayerAnimator&)*m_penAnimator).StoreLast();

    CCecilPlayerEntity::PreMoving();
  };

  // do moving
  void DoMoving(void) {
    CCecilPlayerEntity::DoMoving();
    ((CPlayerAnimator&)*m_penAnimator).AnimateBanking();

    if (m_penView != NULL) {
      ((CPlayerView&)*m_penView).DoMoving();
    }

    if (m_pen3rdPersonView != NULL) {
      ((CPlayerView&)*m_pen3rdPersonView).DoMoving();
    }
  };

  // postmoving for soft player up-down movement
  void PostMoving(void) {
    CCecilPlayerEntity::PostMoving();
    // never allow a player to be removed from the list of movers
    en_ulFlags &= ~ENF_INRENDERING;

    ((CPlayerAnimator&)*m_penAnimator).AnimateSoftEyes();

    // slowly increase mana with time, faster if player is not moving; (only if alive)
    if (GetFlags() & ENF_ALIVE) {
      m_fManaFraction += ClampDn(1.0f - en_vCurrentTranslationAbsolute.Length() / 20.0f, 0.0f) * 20.0f * _pTimer->TickQuantum;
      INDEX iNewMana = m_fManaFraction;
      m_iMana += iNewMana;
      m_fManaFraction -= iNewMana;
    }

    // if in tourist mode
    if (GetSP()->sp_gdGameDifficulty==CSessionProperties::GD_TOURIST && GetFlags()&ENF_ALIVE) {
      // slowly increase health with time
      FLOAT fHealth = GetHealth();
      FLOAT fTopHealth = TopHealth();
      if (fHealth<fTopHealth) {
        SetHealth(ClampUp(fHealth+_pTimer->TickQuantum, fTopHealth));  // one unit per second
      }
    }

    // update ray hit for weapon target
    GetPlayerWeapons()->UpdateTargetingInfo();

    if (m_pen3rdPersonView != NULL) {
      ((CPlayerView&)*m_pen3rdPersonView).PostMoving();
    }

    if (m_penView != NULL) {
      ((CPlayerView&)*m_penView).PostMoving();
    }

    // if didn't have any action in this tick
    if (!(m_ulFlags & PLF_APPLIEDACTION)) {
      // means we are not connected
      SetUnconnected();
    }

    // clear action indicator
    m_ulFlags &= ~PLF_APPLIEDACTION;
  };

  // set player parameters for unconnected state (between the server loads and player reconnects)
  void SetUnconnected(void) {
    if (m_ulFlags&PLF_NOTCONNECTED) {
      return;
    }
    m_ulFlags |= PLF_NOTCONNECTED;

    // reset to a dummy state
    ForceFullStop();
    SetPhysics(PPH_NOCLIP, TRUE, TRUE); // [Cecil]
    en_plLastViewpoint.pl_OrientationAngle = en_plViewpoint.pl_OrientationAngle = ANGLE3D(0,0,0);

    StartModelAnim(PLAYER_ANIM_STAND, 0);
    GetPlayerAnimator()->BodyAnimationTemplate(
      BODY_ANIM_NORMALWALK, BODY_ANIM_COLT_STAND, BODY_ANIM_SHOTGUN_STAND, BODY_ANIM_MINIGUN_STAND, 
      AOF_LOOPING|AOF_NORESTART);
  };

  // set player parameters for connected state
  void SetConnected(void) {
    if (!(m_ulFlags&PLF_NOTCONNECTED)) {
      return;
    }
    m_ulFlags &= ~PLF_NOTCONNECTED;

    SetPhysics(PPH_NORMAL, TRUE, TRUE); // [Cecil]
  };

  // check if player is connected or not
  BOOL IsConnected(void) const {
    return !(m_ulFlags&PLF_NOTCONNECTED);
  };

  // create a checksum value for sync-check
  void ChecksumForSync(ULONG &ulCRC, INDEX iExtensiveSyncCheck) {
    CCecilPlayerEntity::ChecksumForSync(ulCRC, iExtensiveSyncCheck);
    CRC_AddLONG(ulCRC, m_psLevelStats.ps_iScore);
    CRC_AddLONG(ulCRC, m_iMana);

    if (iExtensiveSyncCheck > 0) {
      CRC_AddFLOAT(ulCRC, m_fManaFraction);

      // [Cecil] Collision polygon
      CRC_AddBYTE(ulCRC, m_cpoStandOn.eType);
      CRC_AddBYTE(ulCRC, m_cpoStandOn.bHit);

      if (m_cpoStandOn.eType == SCollisionPolygon::POL_BRUSH) {
        if (m_cpoStandOn.pbpoHit != NULL) {
          CRC_AddLONG(ulCRC, m_cpoStandOn.pbpoHit->bpo_iInWorld);
        }
      } else if (m_cpoStandOn.eType != SCollisionPolygon::POL_INVALID) {
        CRC_AddBlock(ulCRC, (UBYTE *)&m_cpoStandOn.avPolygon, sizeof(m_cpoStandOn.avPolygon));
      }

      if (m_cpoStandOn.bHit) {
        CRC_AddBlock(ulCRC, (UBYTE *)&m_cpoStandOn.vCollision, sizeof(m_cpoStandOn.vCollision));
        CRC_AddBlock(ulCRC, (UBYTE *)&m_cpoStandOn.plPolygon, sizeof(m_cpoStandOn.plPolygon));
        CRC_AddBYTE(ulCRC, m_cpoStandOn.ubSurface);
        CRC_AddBYTE(ulCRC, m_cpoStandOn.bStairs);
      }
    }

    CRC_AddFLOAT(ulCRC, m_fArmor);
  };

  // dump sync data to text file
  void DumpSync_t(CTStream &strm, INDEX iExtensiveSyncCheck)  // throw char *
  {
    CCecilPlayerEntity::DumpSync_t(strm, iExtensiveSyncCheck);
    strm.FPrintF_t("Score: %d\n", m_psLevelStats.ps_iScore);
    strm.FPrintF_t("m_iMana:  %d\n", m_iMana);
    strm.FPrintF_t("m_fManaFraction: %g(%08x)\n", m_fManaFraction, (ULONG&)m_fManaFraction);
    strm.FPrintF_t("m_fArmor: %g(%08x)\n", m_fArmor, (ULONG&)m_fArmor);

    // [Cecil] Collision polygon
    strm.FPrintF_t("--- Collision polygon (m_cpoStandOn) ---\n");
    strm.FPrintF_t("Type:  %d\n", m_cpoStandOn.eType);
    strm.FPrintF_t("Hit?:  %d\n", m_cpoStandOn.bHit);

    if (m_cpoStandOn.eType == SCollisionPolygon::POL_BRUSH) {
      if (m_cpoStandOn.pbpoHit != NULL) {
        strm.FPrintF_t("Brush polygon:  %d\n", m_cpoStandOn.pbpoHit->bpo_iInWorld);
      }
    } else if (m_cpoStandOn.eType != SCollisionPolygon::POL_INVALID) {
      strm.FPrintF_t("avPolygon[0]:  %g, %g, %g\n",
        m_cpoStandOn.avPolygon[0](1), m_cpoStandOn.avPolygon[0](2), m_cpoStandOn.avPolygon[0](3));
      strm.FPrintF_t("avPolygon[1]:  %g, %g, %g\n",
        m_cpoStandOn.avPolygon[1](1), m_cpoStandOn.avPolygon[1](2), m_cpoStandOn.avPolygon[1](3));
      strm.FPrintF_t("avPolygon[2]:  %g, %g, %g\n",
        m_cpoStandOn.avPolygon[2](1), m_cpoStandOn.avPolygon[2](2), m_cpoStandOn.avPolygon[2](3));
    }

    if (m_cpoStandOn.bHit) {
      strm.FPrintF_t("Collision:  %g, %g, %g\n",
        m_cpoStandOn.vCollision(1), m_cpoStandOn.vCollision(2), m_cpoStandOn.vCollision(3));
      strm.FPrintF_t("Polygon:  %g, %g, %g, dist: %g\n",
        m_cpoStandOn.plPolygon(1), m_cpoStandOn.plPolygon(2), m_cpoStandOn.plPolygon(3), m_cpoStandOn.plPolygon.Distance());

      strm.FPrintF_t("Surface:  %d\n", m_cpoStandOn.ubSurface);
      strm.FPrintF_t("Stairs?:  %d\n", m_cpoStandOn.bStairs);
    }
  };

/************************************************************
 *         DAMAGE OVERRIDE (PLAYER HAS ARMOR)               *
 ************************************************************/


  // leave stain
  virtual void LeaveStain(BOOL bGrow) {
    ESpawnEffect ese;
    FLOAT3D vPoint;
    FLOATplane3D vPlaneNormal;
    FLOAT fDistanceToEdge;
    // get your size
    FLOATaabbox3D box;
    GetBoundingBox(box);
  
    // on plane
    if (GetNearestPolygon(vPoint, vPlaneNormal, fDistanceToEdge)) {
      // if near to polygon and away from last stain point
      if( (vPoint-GetPlacement().pl_PositionVector).Length()<0.5f
        && (m_vLastStain-vPoint).Length()>1.0f ) {
        m_vLastStain = vPoint;
        FLOAT fStretch = box.Size().Length();
        ese.colMuliplier = C_WHITE|CT_OPAQUE;
        // stain
        if (bGrow) {
          ese.betType    = BET_BLOODSTAINGROW;
          ese.vStretch   = FLOAT3D( fStretch*1.5f, fStretch*1.5f, 1.0f);
        } else {
          ese.betType    = BET_BLOODSTAIN;
          ese.vStretch   = FLOAT3D( fStretch*0.75f, fStretch*0.75f, 1.0f);
        }
        ese.vNormal    = FLOAT3D( vPlaneNormal);
        ese.vDirection = FLOAT3D( 0, 0, 0);
        FLOAT3D vPos = vPoint+ese.vNormal/50.0f*(FRnd()+0.5f);
        CEntityPointer penEffect = CreateEntity( CPlacement3D(vPos, ANGLE3D(0,0,0)), CLASS_BASIC_EFFECT);
        penEffect->Initialize(ese);
      }
    }
  };


  void DamageImpact(enum DamageType dmtType,
                  FLOAT fDamageAmmount, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection)
  {
    // if exploded
    if (GetRenderType()!=RT_MODEL) {
      // do nothing
      return;
    }

    if (dmtType == DMT_ABYSS || dmtType == DMT_SPIKESTAB) {
      return;
    }

    fDamageAmmount = Clamp(fDamageAmmount, 0.0f, 5000.0f);

    FLOAT fKickDamage = fDamageAmmount;
    if ((dmtType == DMT_EXPLOSION) || (dmtType == DMT_IMPACT) || (dmtType == DMT_CANNONBALL_EXPLOSION)) {
      fKickDamage *= 1.5;
    }

    if (dmtType == DMT_DROWNING || dmtType == DMT_CLOSERANGE) {
      fKickDamage /= 10;
    }

    if (dmtType == DMT_CHAINSAW) {
      fKickDamage /= 10;
    }

    // get passed time since last damage
    TIME tmNow = _pTimer->CurrentTick();
    TIME tmDelta = tmNow-m_tmLastDamage;
    m_tmLastDamage = tmNow;

    // fade damage out
    if (tmDelta >= _pTimer->TickQuantum*3) {
      m_vDamage = FLOAT3D(0,0,0);
    }

    // add new damage
    FLOAT3D vDirectionFixed;

    if (vDirection.ManhattanNorm() > 0.5f) {
      vDirectionFixed = vDirection;
    } else {
      vDirectionFixed = -en_vGravityDir;
    }

    FLOAT3D vDamageOld = m_vDamage;
    m_vDamage += vDirectionFixed * fKickDamage;
    
    FLOAT fOldLen = vDamageOld.Length();
    FLOAT fNewLen = m_vDamage.Length();
    FLOAT fOldRootLen = Sqrt(fOldLen);
    FLOAT fNewRootLen = Sqrt(fNewLen);

    FLOAT fMassFactor = 200.0f/((EntityInfo*)GetEntityInfo())->fMass;
    
    if(!(en_ulFlags & ENF_ALIVE)) {
      fMassFactor /= 3;
    }

    switch (dmtType) {
      case DMT_CLOSERANGE:
      case DMT_CHAINSAW:
      case DMT_DROWNING:
      case DMT_IMPACT:
      case DMT_BRUSH:
      case DMT_BURNING:
        // do nothing
        break;

      default: {
        if (fOldLen != 0.0f)
        {
          // cancel last push
          GiveImpulseTranslationAbsolute( -vDamageOld/fOldRootLen*fMassFactor);
        }

        // push it back
        GiveImpulseTranslationAbsolute( m_vDamage/fNewRootLen*fMassFactor);
      }
    }

    if (m_fMaxDamageAmmount < fDamageAmmount) {
      m_fMaxDamageAmmount = fDamageAmmount;
    }

    // if it has no spray, or if this damage overflows it
    if ((m_tmSpraySpawned<=_pTimer->CurrentTick()-_pTimer->TickQuantum*8 || 
      m_fSprayDamage+fDamageAmmount>50.0f)) {

      // spawn blood spray
      CPlacement3D plSpray = CPlacement3D( vHitPoint, ANGLE3D(0, 0, 0));
      m_penSpray = CreateEntity( plSpray, CLASS_BLOOD_SPRAY);
      m_penSpray->SetParent( this);
      ESpawnSpray eSpawnSpray;
      eSpawnSpray.colBurnColor=C_WHITE|CT_OPAQUE;
      
      if (m_fMaxDamageAmmount > 10.0f) {
        eSpawnSpray.fDamagePower = 3.0f;
      } else if(m_fSprayDamage + fDamageAmmount > 50.0f) {
        eSpawnSpray.fDamagePower = 2.0f;
      } else {
        eSpawnSpray.fDamagePower = 1.0f;
      }

      eSpawnSpray.sptType = SPT_BLOOD;
      eSpawnSpray.fSizeMultiplier = 1.0f;

      // setup direction of spray
      FLOAT3D vHitPointRelative = vHitPoint - GetPlacement().pl_PositionVector;
      FLOAT3D vReflectingNormal;
      GetNormalComponent(vHitPointRelative, en_vGravityDir, vReflectingNormal);
      vReflectingNormal.Normalize();
      
      vReflectingNormal(1)/=5.0f;
    
      FLOAT3D vProjectedComponent = vReflectingNormal*(vDirection%vReflectingNormal);
      FLOAT3D vSpilDirection = vDirection - vProjectedComponent*2.0f - en_vGravityDir*0.5f;

      eSpawnSpray.vDirection = vSpilDirection;
      eSpawnSpray.penOwner = this;
    
      // initialize spray
      m_penSpray->Initialize(eSpawnSpray);
      m_tmSpraySpawned = _pTimer->CurrentTick();
      m_fSprayDamage = 0.0f;
      m_fMaxDamageAmmount = 0.0f;
    }
    m_fSprayDamage += fDamageAmmount;
  }


  /* Receive damage */
  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType,
                     FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection)
  {
    // don't harm yourself with knife or with rocket in easy/tourist mode
    if (penInflictor == this && (dmtType == DMT_CLOSERANGE || dmtType == DMT_CHAINSAW ||
      ((dmtType == DMT_EXPLOSION || dmtType == DMT_CANNONBALL_EXPLOSION || dmtType == DMT_PROJECTILE) &&
          GetSP()->sp_gdGameDifficulty <= CSessionProperties::GD_EASY)) ) {
      return;
    }

    // if not connected
    if (m_ulFlags & PLF_NOTCONNECTED) {
      // noone can harm you
      return;
    }

    // god mode -> no one can harm you
    if (cht_bGod && CheatsEnabled()) {
      return;
    }

    // [Cecil] God mode
    if (m_iHAXFlags & HAXF_GOD) {
      return;
    }

    // [Cecil] Lower player damage
    if (dmtType == DMT_EXPLOSION && !GetSP()->sp_bUseFrags) {
      if (penInflictor == this || IS_PLAYER(penInflictor)) {
        fDamage /= 5.0f;
      }
    }

    // if invulnerable, nothing can harm you except telefrag or abyss
    const TIME tmDelta = m_tmInvulnerability - _pTimer->CurrentTick();
    if (tmDelta > 0 && dmtType != DMT_ABYSS && dmtType != DMT_TELEPORT) { return; }

    // if invunerable after spawning
    FLOAT tmSpawnInvulnerability = GetSP()->sp_tmSpawnInvulnerability;
    if (tmSpawnInvulnerability>0 && _pTimer->CurrentTick()-m_tmSpawned<tmSpawnInvulnerability) {
      // ignore damage
      return;
    }

    // check for friendly fire
    if (!GetSP()->sp_bFriendlyFire && GetSP()->sp_bCooperative) {
      if (IS_PLAYER(penInflictor) && penInflictor != this) {
        return;
      }
    }

    // ignore heat damage if dead
    if (dmtType == DMT_HEAT && !(GetFlags()&ENF_ALIVE)) {
      return;
    }

    // adjust for difficulty
    FLOAT fDifficultyDamage = GetSP()->sp_fDamageStrength;
    if (fDifficultyDamage <= 1.0f || penInflictor != this) {
      fDamage *= fDifficultyDamage;
    }

    // ignore zero damages
    if (fDamage <= 0) {
      return;
    }

    // [Cecil] Suit sounds
    ESuitSound eSuit = ESS_NONE;
    switch (dmtType) {
      case DMT_EXPLOSION: case DMT_IMPACT: case DMT_CLOSERANGE:
        if (fDamage >= 70.0f) {
          eSuit = ESS_CRIT;
        } else if (fDamage >= 30.0f) {
          eSuit = ESS_MAJOR;
        } else if (fDamage >= 10.0f) {
          eSuit = ESS_MINOR;
        }
        break;
    }

    FLOAT fSubHealth, fSubArmor;
    if (dmtType == DMT_DROWNING) {
      // drowning
      fSubHealth = fDamage;
    } else {
      // [Cecil] Armor check
      BOOL bArmor = (m_fArmor > 0.0f);

      // damage and armor
      fSubArmor  = fDamage*2.0f/3.0f;   // 2/3 on armor damage
      fSubHealth = fDamage - fSubArmor; // 1/3 on health damage
      m_fArmor -= fSubArmor; // decrease armor

      // armor below zero -> add difference to health damage
      if (m_fArmor < 0.0f) {
        fSubHealth -= m_fArmor;
        m_fArmor = 0.0f;

        // [Cecil] No armor
        if (bArmor) {
          eSuit = ESS_ARMOR;
        }
      }
    }

    // if any damage
    if (fSubHealth > 0) { 
      // if camera is active
      if (m_penCamera != NULL) {
        // if the camera has onbreak
        CEntity *penOnBreak = ((CCamera&)*m_penCamera).m_penOnBreak;
        if (penOnBreak != NULL) {
          // trigger it
          SendToTarget(penOnBreak, EET_TRIGGER, this);
        // if it doesn't
        } else {
          // just deactivate camera
          m_penCamera = NULL; 
        }
      }
    }

    // if the player is doing autoactions
    if (m_penActionMarker != NULL) {
      // ignore all damage
      return;
    }

    DamageImpact(dmtType, fSubHealth, vHitPoint, vDirection);

    // receive damage
    CCecilPlayerEntity::ReceiveDamage(penInflictor, dmtType, fSubHealth, vHitPoint, vDirection);

    // red screen and hit translation
    if (fDamage > 1.0f) {
      if (GetFlags() & ENF_ALIVE) {
        m_fDamageAmmount += fDamage;
        m_tmWoundedTime = _pTimer->CurrentTick();

        // [Cecil] Too much damage
        if (m_fDamageAmmount >= 5.0f) {
          switch (dmtType) {
            case DMT_HEAT:
              eSuit = ESS_HEAT;
              break;

            case DMT_CLOSERANGE:
              // [Cecil] TEMP: Electrical damage
              if (IsOfClass(penInflictor, "Fish")) {
                eSuit = ESS_SHOCK;
              }
              break;
          }
        }
      }
    }

    // [Cecil] Near death
    if (GetHealth() <= 10.0f) {
      eSuit = ESS_DEATH;
    }

    // [Cecil] Play suit sound
    if (eSuit != ESS_NONE) {
      SuitSound(eSuit);
    }

    // yell (this hurts)
    ESound eSound;
    eSound.EsndtSound = SNDT_PLAYER;
    eSound.penTarget  = this;
    SendEventInRange(eSound, FLOATaabbox3D(GetPlacement().pl_PositionVector, 10.0f));

    // play hurting sound if not dead
    if (GetFlags() & ENF_ALIVE) {
      // determine corresponding sound
      INDEX iSound = -1;

      // [Cecil] Override for other types
      if (m_pstState == PST_DIVE) {
        iSound = SOUND_DROWN1 + IRnd()%3;
      } else {
        switch (dmtType) {
          case DMT_DROWNING:
            iSound = SOUND_DROWN1 + IRnd()%3;

            m_tmMouthSoundLast = _pTimer->CurrentTick();
            PlaySound(m_soLocalAmbientOnce, SOUND_WATERBUBBLES, SOF_3D|SOF_VOLUMETRIC|SOF_LOCAL);
            m_soLocalAmbientOnce.Set3DParameters(25.0f, 5.0f, 2.0f, Lerp(0.5f, 1.5f, FRnd()) );
            SpawnBubbles(10+INDEX(FRnd()*10));
            break;

          case DMT_IMPACT:
            if (fDamage >= 10.0f) {
              iSound = SOUND_FALLPAIN1 + IRnd()%3;
              m_aCameraShake(3) = (IRnd()%2 ? -20.0f : 20.0f);
              // cap the impact damage
              fDamage = ClampUp(fDamage, 10.0f);

            } else if (fDamage >= 1.0f) {
              iSound = SOUND_PAIN1 + IRnd()%3;
              m_aCameraShake(3) = (IRnd()%2 ? -5.0f : 5.0f);
              // no damage
              fDamage = 0.0f;
            }
            break;

          case DMT_HEAT:
          case DMT_BURNING:
            iSound = SOUND_BURNPAIN1 + IRnd()%3;
            break;

          default: {
            if (fDamage > 1.0f) {
              iSound = SOUND_PAIN1 + IRnd()%3;
            }
          }
        }
      }

      // give some pause inbetween screaming
      TIME tmNow = _pTimer->CurrentTick();
      if (tmNow - m_tmScreamTime > 0.5f && iSound != -1) {
        SetRandomMouthPitch(0.9f, 1.1f);
        m_tmScreamTime = tmNow;
        PlaySound(m_soMouth, iSound, SOF_3D);
      }
    }
  };

  // should this player blow up (spawn debris)
  BOOL ShouldBlowUp(void) 
  {
    // blow up if
    return
      // allowed
      GetSP()->sp_bGibs && 
      // dead and
      (GetHealth()<=0) && 
      // has received large enough damage lately and
      (m_vDamage.Length() > _fBlowUpAmmount) &&
      // is not blown up already
      GetRenderType()==RT_MODEL;
  };

  // spawn body parts
  void BlowUp(void) {
    FLOAT3D vNormalizedDamage = m_vDamage-m_vDamage*(_fBlowUpAmmount/m_vDamage.Length());
    vNormalizedDamage /= Sqrt(vNormalizedDamage.Length());
    vNormalizedDamage *= 0.75f;

    FLOAT3D vBodySpeed = en_vCurrentTranslationAbsolute - en_vGravityDir * (en_vGravityDir % en_vCurrentTranslationAbsolute);
    const FLOAT fBlowUpSize = 2.0f;

    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    // determine debris texture (color)
    ULONG ulFleshTexture = TEXTURE_FLESH_GREEN;
    ULONG ulFleshModel   = MODEL_FLESH;
    if( iBloodType==2) { ulFleshTexture = TEXTURE_FLESH_RED; }
    // spawn debris
    Debris_Begin( EIBT_FLESH, DPT_BLOODTRAIL, BET_BLOODSTAIN, fBlowUpSize, vNormalizedDamage, vBodySpeed, 1.0f, 0.0f);
    for( INDEX iDebris=0; iDebris<4; iDebris++) {
      // flowerpower mode?
      if( iBloodType==3) {
        switch( IRnd()%5) {
        case 1:  { ulFleshModel = MODEL_FLESH_APPLE;   ulFleshTexture = TEXTURE_FLESH_APPLE;   break; }
        case 2:  { ulFleshModel = MODEL_FLESH_BANANA;  ulFleshTexture = TEXTURE_FLESH_BANANA;  break; }
        case 3:  { ulFleshModel = MODEL_FLESH_BURGER;  ulFleshTexture = TEXTURE_FLESH_BURGER;  break; }
        case 4:  { ulFleshModel = MODEL_FLESH_LOLLY;   ulFleshTexture = TEXTURE_FLESH_LOLLY;   break; }
        default: { ulFleshModel = MODEL_FLESH_ORANGE;  ulFleshTexture = TEXTURE_FLESH_ORANGE;  break; }
        }
      }
      Debris_Spawn( this, this, ulFleshModel, ulFleshTexture, 0, 0, 0, IRnd()%4, 0.5f,
                    FLOAT3D(FRnd()*0.6f+0.2f, FRnd()*0.6f+0.2f, FRnd()*0.6f+0.2f));
    }

    // leave a stain beneath
    LeaveStain(FALSE);

    PlaySound(m_soBody, SOUND_BLOWUP, SOF_3D);

    // hide yourself (must do this after spawning debris)
    SwitchToEditorModel();
    
    FLOAT fSpeedOrg = en_vCurrentTranslationAbsolute.Length();
    const FLOAT fSpeedMax = 30.0f;
    if (fSpeedOrg > fSpeedMax) {
      en_vCurrentTranslationAbsolute *= fSpeedMax/fSpeedOrg;
    }
  };

/************************************************************
 *                 OVERRIDEN FUNCTIONS                      *
 ************************************************************/
  /* Entity info */
  void *GetEntityInfo(void) {
    switch (m_pstState) {
      case PST_STAND: case PST_FALL:
        return &eiPlayerGround;
        break;
      case PST_CROUCH:
        return &eiPlayerCrouch;
        break;
      case PST_SWIM: case PST_DIVE:
        return &eiPlayerSwim;
        break;
    }
    return &eiPlayerGround;
  };

  /* Receive item */
  BOOL ReceiveItem(const CEntityEvent &ee) {
    // *********** HEALTH ***********
    if (ee.ee_slEvent == EVENTCODE_EHealth) {
      // determine old and new health values
      FLOAT fHealthOld = GetHealth();
      FLOAT fHealthNew = fHealthOld + ((EHealth&)ee).fHealth;
      if (((EHealth&)ee).bOverTopHealth) {
        fHealthNew = ClampUp( fHealthNew, MaxHealth());
      } else {
        fHealthNew = ClampUp( fHealthNew, TopHealth());
      }

      // if value can be changed
      if (ceil(fHealthNew) > ceil(fHealthOld)) {
        // receive it
        SetHealth(fHealthNew);
        ItemPicked(TRANS("Health"), ((EHealth&)ee).fHealth);
        m_iMana += (INDEX)(((EHealth&)ee).fHealth);
        m_fPickedMana += ((EHealth&)ee).fHealth;

        // [Cecil]
        FLOAT fValue = ((EHealth&)ee).fHealth;
        PlaySound(m_soHealth, (fValue >= 25.0f) ? SOUND_MEDKIT : SOUND_MEDSHOT, SOF_3D|SOF_VOLUMETRIC);
        return TRUE;
      }
    } 

    // *********** ARMOR ***********
    else if (ee.ee_slEvent == EVENTCODE_EArmor) {
      // determine old and new health values
      FLOAT fArmorOld = m_fArmor;
      FLOAT fArmorNew = fArmorOld + ((EArmor&)ee).fArmor;
      if( ((EArmor&)ee).bOverTopArmor) {
        fArmorNew = ClampUp( fArmorNew, MaxArmor());
      } else {
        fArmorNew = ClampUp( fArmorNew, TopArmor());
      }
      // if value can be changed
      if( ceil(fArmorNew) > ceil(fArmorOld)) {
        // receive it
        m_fArmor = fArmorNew;
        ItemPicked(TRANS("Suit Charge"), ((EArmor&)ee).fArmor);
        m_iMana += (INDEX)(((EArmor&)ee).fArmor);
        m_fPickedMana += ((EArmor&)ee).fArmor;

        // [Cecil]
        FLOAT fValue = ((EArmor&)ee).fArmor;
        INDEX iArmorSound = SOUND_SUITBATTERY;

        if (fValue > 150) {
          iArmorSound = SOUND_SUITBELL;

          // Give suit and play its music
          if (!m_bHEVSuit) {
            m_bHEVSuit = TRUE;

            static CSymbolPtr pfMusicVolume("snd_fMusicVolume");

            if (pfMusicVolume.GetFloat() > 0.0f && _penViewPlayer == this) {
              PlaySound(m_soSuitMusic, SOUND_SUITMUSIC, SOF_3D|SOF_VOLUMETRIC|SOF_MUSIC|SOF_LOCAL);
            }
          }

        } else if (fValue > 50) {
          iArmorSound = SOUND_SUITCHARGE;
        }

        PlaySound(m_soArmor, iArmorSound, SOF_3D|SOF_VOLUMETRIC);
        return TRUE;
      }
    }

    // *********** MESSAGE ***********
    else if (ee.ee_slEvent == EVENTCODE_EMessageItem) {
      EMessageItem &eMI = (EMessageItem &)ee;
      ReceiveComputerMessage(eMI.fnmMessage, CMF_ANALYZE);
      ItemPicked(TRANS("Ancient papyrus"), 0);
      return TRUE;
    }

    // *********** WEAPON ***********
    else if (ee.ee_slEvent == EVENTCODE_EWeaponItem) {
      return ((CPlayerWeapons&)*m_penWeapons).ReceiveWeapon(ee);
    }

    // *********** AMMO ***********
    else if (ee.ee_slEvent == EVENTCODE_EAmmoItem) {
      return ((CPlayerWeapons&)*m_penWeapons).ReceiveAmmo(ee);
    }

    else if (ee.ee_slEvent == EVENTCODE_EAmmoPackItem) {
      return ((CPlayerWeapons&)*m_penWeapons).ReceivePackAmmo(ee);
    }

    // *********** KEYS ***********
    else if (ee.ee_slEvent == EVENTCODE_EKey) {
      // don't pick up key if in auto action mode
      if (m_penActionMarker!=NULL) {
        return FALSE;
      }
      // make key mask
      ULONG ulKey = 1<<INDEX(((EKey&)ee).kitType);
      EKey &eKey = (EKey&)ee;
      if(eKey.kitType == KIT_HAWKWINGS01DUMMY || eKey.kitType == KIT_HAWKWINGS02DUMMY
        || eKey.kitType == KIT_TABLESDUMMY || eKey.kitType ==KIT_JAGUARGOLDDUMMY)
      {
        ulKey = 0;
      }
      // if key is already in inventory
      if (m_ulKeys&ulKey) {
        // ignore it
        return FALSE;
      // if key is not in inventory
      } else {
        // pick it up
        m_ulKeys |= ulKey;
        CTString strKey = GetKeyName(((EKey&)ee).kitType);
        ItemPicked(strKey, 0);
        // if in cooperative
        if (GetSP()->sp_bCooperative && !GetSP()->sp_bSinglePlayer) {
          CPrintF(TRANS("^cFFFFFF%s - %s^r\n"), GetPlayerName(), strKey);
        }
        return TRUE;
      }
    }

    // *********** POWERUPS ***********
    else if (ee.ee_slEvent == EVENTCODE_EPowerUp) {
      const FLOAT tmNow = _pTimer->CurrentTick();
      switch( ((EPowerUp&)ee).puitType) {
      case PUIT_INVISIB :  m_tmInvisibility    = tmNow + m_tmInvisibilityMax;
        ItemPicked(TRANS("^cABE3FFInvisibility"), 0);
        return TRUE;
      case PUIT_INVULNER:  m_tmInvulnerability = tmNow + m_tmInvulnerabilityMax;
        ItemPicked(TRANS("^c00B440Invulnerability"), 0);
        return TRUE;
      case PUIT_DAMAGE  :  m_tmSeriousDamage   = tmNow + m_tmSeriousDamageMax;
        ItemPicked(TRANS("^cFF0000Serious Damage!"), 0);
        return TRUE;
      case PUIT_SPEED   :  m_tmSeriousSpeed    = tmNow + m_tmSeriousSpeedMax;
        ItemPicked(TRANS("^cFF9400Serious Speed"), 0);
        return TRUE;
      case PUIT_BOMB    :
        m_iSeriousBombCount++;
        ItemPicked(TRANS("^cFF0000Serious Bomb!"), 0);
        //ItemPicked(TRANS("^cFF0000S^cFFFF00e^cFF0000r^cFFFF00i^cFF0000o^cFFFF00u^cFF0000s ^cFF0000B^cFFFF00o^cFF0000m^cFFFF00b!"), 0);
        // send computer message
        if (GetSP()->sp_bCooperative) {
          EComputerMessage eMsg;
          eMsg.fnmMessage = CTFILENAME("DataMP\\Messages\\Weapons\\seriousbomb.txt");
          this->SendEvent(eMsg);
        }
        return TRUE;              
      }
    }

    // nothing picked
    return FALSE;
  };



  // Change Player view
  void ChangePlayerView()
  {
    // change from eyes to 3rd person
    if (m_iViewState == PVT_PLAYEREYES) {
      // spawn 3rd person view camera
      ASSERT(m_pen3rdPersonView == NULL);
      if (m_pen3rdPersonView == NULL) {
        m_pen3rdPersonView = CreateEntity(GetPlacement(), CLASS_PLAYER_VIEW);
        EViewInit eInit;
        eInit.penOwner = this;
        eInit.penCamera = NULL;
        eInit.vtView = VT_3RDPERSONVIEW;
        eInit.bDeathFixed = FALSE;
        m_pen3rdPersonView ->Initialize(eInit);
      }
      
      m_iViewState = PVT_3RDPERSONVIEW;

    // change from 3rd person to eyes
    } else if (m_iViewState == PVT_3RDPERSONVIEW) {
      m_iViewState = PVT_PLAYEREYES;

      // kill 3rd person view
      if (m_pen3rdPersonView != NULL) {
        ((CPlayerView&)*m_pen3rdPersonView).SendEvent(EEnd());
        m_pen3rdPersonView = NULL;
      }
    }
  };

  // if computer is pressed
  void ComputerPressed(void) {
    // call computer if not holding sniper
    //if (GetPlayerWeapons()->m_iCurrentWeapon!=WEAPON_SNIPER){
      if (cmp_ppenPlayer == NULL && _pNetwork->IsPlayerLocal(this)) {
        cmp_ppenPlayer = this;
      }
      m_bComputerInvoked = TRUE;
      // clear analyses message
      m_tmAnalyseEnd = 0;
      m_bPendingMessage = FALSE;
      m_tmMessagePlay = 0;
    //}
  };

  // if use is pressed
  void UsePressed(BOOL bOrComputer) {
    // cast ray from weapon
    CPlayerWeapons *penWeapons = GetPlayerWeapons();
    CEntity *pen = penWeapons->m_penRayHit;
    BOOL bSomethingToUse = FALSE;

    // [Cecil] Use sound
    INDEX iUseSound = SOUND_DENY;

    // if hit
    if (pen != NULL) {
      // check switch/messageholder relaying by moving brush
      if (IsOfClass( pen, "Moving Brush")) {
        if (((CMovingBrush&)*pen).m_penSwitch!=NULL) {
          pen = ((CMovingBrush&)*pen).m_penSwitch;
        }
      }

      // if switch and near enough
      if (IsOfClass(pen, "Switch") && penWeapons->m_fRayHitDistance < 2.0f) {
        CSwitch &enSwitch = (CSwitch&)*pen;
        // if switch is useable
        if (enSwitch.m_bUseable) {
          // send it a trigger event
          SendToTarget(pen, EET_TRIGGER, this);
          bSomethingToUse = TRUE;

          // [Cecil]
          iUseSound = SOUND_APPLY;
        }
      }

      // [Cecil] Radio on/off
      if (IsOfClassID(pen, CRadio_ClassID) && penWeapons->m_fRayHitDistance < 3.0f) {
        pen->SendEvent(ETrigger());
        iUseSound = SOUND_APPLY;
      }

      // [Cecil] Talk to scientists
      if (IsOfClassID(pen, CScientistSKA_ClassID) && penWeapons->m_fRayHitDistance < 3.0f) {
        ((CScientistSKA &)*pen).OnInteract(this);
        iUseSound = SOUND_APPLY;
      }

      // if analyzable
      if (IsOfClass( pen, "MessageHolder") 
        && penWeapons->m_fRayHitDistance<((CMessageHolder*)&*pen)->m_fDistance
        && ((CMessageHolder*)&*pen)->m_bActive) {
        const CTFileName &fnmMessage = ((CMessageHolder*)&*pen)->m_fnmMessage;
        // if player doesn't have that message in database
        if (!HasMessage(fnmMessage)) {
          // add the message
          ReceiveComputerMessage(fnmMessage, CMF_ANALYZE);
          bSomethingToUse = TRUE;
        }
      }
    }
    // if nothing usable under cursor, and may call computer
    if (!bSomethingToUse && bOrComputer) {
      // call computer
      ComputerPressed();
    }

    // [Cecil] Play the use sound
    m_soHUD.Set3DParameters(10.0f, 4.0f, 1.0f, 1.0f);
    PlaySound(m_soHUD, iUseSound, SOF_3D|SOF_VOLUMETRIC);

    // [Cecil] Not needed for now
    /*else if (!bSomethingToUse) {
      CPlayerWeapons *penWeapon = GetPlayerWeapons();
     
      // penWeapon->m_iWantedWeapon==WEAPON_SNIPER) =>
      // make sure that weapon transition is not in progress
      if (penWeapon->m_iCurrentWeapon==WEAPON_SNIPER && 
          penWeapon->m_iWantedWeapon==WEAPON_SNIPER) {
        if (m_ulFlags & PLF_ISZOOMING) {
          m_ulFlags &= ~PLF_ISZOOMING;
          penWeapon->m_bSniping = FALSE;
          penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV = penWeapon->m_fSniperMaxFOV;      
          PlaySound(m_soSniperZoom, SOUND_SILENCE, SOF_3D);

        } else {
          penWeapon->m_bSniping = TRUE;
          m_ulFlags |= PLF_ISZOOMING;
          penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV = penWeapon->m_fMinimumZoomFOV;
          PlaySound(m_soSniperZoom, SOUND_SNIPER_ZOOM, SOF_3D|SOF_LOOP);
        }
      }
    }*/
  };
  
/************************************************************
 *                      PLAYER ACTIONS                      *
 ************************************************************/
  void SetGameEnd(void)
  {
    _pNetwork->SetGameFinished();
    // start console for first player possible
    for(INDEX iPlayer=0; iPlayer<GetMaxPlayers(); iPlayer++) {
      CEntity *pen = GetPlayerEntity(iPlayer);
      if (pen!=NULL) {
        if (cmp_ppenPlayer==NULL && _pNetwork->IsPlayerLocal(pen)) {
          cmp_ppenPlayer = (CPlayer*)pen;
        }
      }
    }
  }
  // check if game should be finished
  void CheckGameEnd(void) {
    BOOL bFinished = FALSE;

    // if time limit is out
    INDEX iTimeLimit = GetSP()->sp_iTimeLimit;
    if (iTimeLimit>0 && _pTimer->CurrentTick() >= iTimeLimit*60.0f) {
      bFinished = TRUE;
    }

    // [Cecil] Gamemode-specific
    INDEX iMode = GetSP()->sp_iHLGamemode;
    BOOL bGamemode = FALSE;
    if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
      switch (iMode) {
        case HLGM_ARMSRACE:
          if (!GetSP()->sp_bCooperative && !GetSP()->sp_bSinglePlayer) {
            bFinished = (m_psLevelStats.ps_iKills >= CT_ARMSRACE_LEVELS);
          }
          bGamemode = TRUE;
          break;
      }
    }

    if (!bGamemode) {
      // if frag limit is out
      INDEX iFragLimit = GetSP()->sp_iFragLimit;
      if (iFragLimit > 0 && m_psLevelStats.ps_iKills >= iFragLimit) {
        bFinished = TRUE;
      }

      // if score limit is out
      INDEX iScoreLimit = GetSP()->sp_iScoreLimit;
      if (iScoreLimit > 0 && m_psLevelStats.ps_iScore >= iScoreLimit) {
        bFinished = TRUE;
      }
    }

    if (bFinished) {
      SetGameEnd();
    }
  };

  // Preapply the action packet for local mouselag elimination
  void PreapplyAction(const CPlayerAction &paAction) {};

  // Called to apply player action to player entity each tick.
  void ApplyAction(const CPlayerAction &paOriginal, FLOAT tmLatency)
  {
    if (!(m_ulFlags&PLF_INITIALIZED)) {
      return;
    }
    
    // if was not connected
    if (m_ulFlags & PLF_NOTCONNECTED) {
      // set connected state
      SetConnected();
    }

    // mark that the player is connected
    m_ulFlags |= PLF_APPLIEDACTION;

    // make a copy of action for adjustments
    CPlayerAction paAction = paOriginal;

    // [Cecil] Update mouse position instead of the view
    if (m_bHAXMenu) {
      m_vMousePosLast = m_vMousePos;
      m_vMousePos = paAction.pa_aRotation;

      paAction.pa_aRotation = m_aLastRotation;
      paAction.pa_aViewRotation = m_aLastViewRotation;
    }

    // calculate delta from last received actions
    ANGLE3D aDeltaRotation     = paAction.pa_aRotation    -m_aLastRotation;
    ANGLE3D aDeltaViewRotation = paAction.pa_aViewRotation-m_aLastViewRotation;
    
    if (m_ulFlags & PLF_ISZOOMING) {
      FLOAT fRotationDamping = ((CPlayerWeapons &)*m_penWeapons).m_fSniperFOV/((CPlayerWeapons &)*m_penWeapons).m_fSniperMaxFOV;
      aDeltaRotation *= fRotationDamping;
      aDeltaViewRotation *= fRotationDamping;
    }

    // [Cecil] Update suit zoom
    INDEX &iZoomLevel = GetPlayerWeapons()->m_iSniping;

    if (iZoomLevel == 0) {
      m_fLastZoomFOV = m_fZoomFOV;

      /*if (m_bSuitZoom) {
        m_fZoomFOV -= (m_fZoomFOV - 50.0f) / 2.0f + 0.5f;
      } else {
        m_fZoomFOV += (90.0f - m_fZoomFOV) / 2.0f + 0.5f;
      }
      m_fZoomFOV = Clamp(m_fZoomFOV, 50.0f, 90.0f);*/

      if (m_bSuitZoom) {
        m_fZoomFOV = ClampDn(m_fZoomFOV - 5.0f, 50.0f);
      } else {
        m_fZoomFOV = ClampUp(m_fZoomFOV + 5.0f, 90.0f);
      }
      
      FLOAT fRotationDamping = m_fZoomFOV/90.0f;
      aDeltaRotation *= fRotationDamping;
      aDeltaViewRotation *= fRotationDamping;

    // Weapon zoom
    } else if (iZoomLevel < 0) {
      m_bSuitZoom = FALSE;
      m_fLastZoomFOV = m_fZoomFOV;

      FLOAT fWeaponZoom = _afWeaponZoom[(Abs(iZoomLevel)-1) * 2];

      if (iZoomLevel < -1) {
        m_fZoomFOV -= (m_fZoomFOV - fWeaponZoom) / 2.0f + 0.5f;
        m_fZoomFOV = ClampDn(m_fZoomFOV, fWeaponZoom);
      } else {
        m_fZoomFOV += (90.0f - m_fZoomFOV) / 2.0f + 0.5f;
        m_fZoomFOV = ClampUp(m_fZoomFOV, 90.0f);
      }

      // Reset the zoom
      if (iZoomLevel == -1 && m_fZoomFOV >= 90.0f) {
        iZoomLevel = 0;
      }

      FLOAT fRotationDamping = m_fZoomFOV/90.0f;
      aDeltaRotation *= fRotationDamping;
      aDeltaViewRotation *= fRotationDamping;

    } else {
      ResetSuitZoom();
    }

    //FLOAT3D vDeltaTranslation  = paAction.pa_vTranslation -m_vLastTranslation;
    m_aLastRotation     = paAction.pa_aRotation;
    m_aLastViewRotation = paAction.pa_aViewRotation;
    paAction.pa_aRotation     = aDeltaRotation;
    paAction.pa_aViewRotation = aDeltaViewRotation;

    // adjust rotations per tick
    paAction.pa_aRotation /= _pTimer->TickQuantum;
    paAction.pa_aViewRotation /= _pTimer->TickQuantum;

    // adjust prediction for remote players only
    CEntity *penMe = this;
    if (IsPredictor()) {
      penMe = penMe->GetPredicted();
    }
    SetPredictable(!_pNetwork->IsPlayerLocal(penMe));

    // check for end of game
    if (!IsPredictor()) {
      CheckGameEnd();
    }

    // limit speeds against abusing
    paAction.pa_vTranslation(1) = Clamp(paAction.pa_vTranslation(1), -plr_fMoveSpeed, plr_fMoveSpeed);
    paAction.pa_vTranslation(2) = Clamp(paAction.pa_vTranslation(2), -plr_fSpeedUp,   plr_fSpeedUp);
    paAction.pa_vTranslation(3) = Clamp(paAction.pa_vTranslation(3), -plr_fMoveSpeed, plr_fMoveSpeed);

    // if speeds are like walking
    /*if (Abs(paAction.pa_vTranslation(3))< plr_fSpeedForward / 1.99f
     && Abs(paAction.pa_vTranslation(1))< plr_fSpeedSide / 1.99f) {
      // don't allow falling
      en_fStepDnHeight = 1.5f;

    // if speeds are like running
    } else {
      // allow falling
      en_fStepDnHeight = -1;
    }*/

    // [Cecil] Allow falling all the time
    en_fStepDnHeight = -1;

    // [Cecil] Increase step height in the air
    en_fStepUpHeight = (en_penReference != NULL ? 1.5f : 1.0f);

    // [Cecil] NOTE: This causes recoil jitter while predicting
    //if (!IsPredictor())
    {
      for (INDEX iDir = 1; iDir <= 3; iDir++) {
        // [Cecil] Recoil effect
        m_aLastRecoilShake(iDir) = m_aRecoilShake(iDir);

        if (Abs(m_aRecoilShake(iDir)) > 0.05f) {
          m_aRecoilShake(iDir) /= 1.1f;
        } else {
          m_aRecoilShake(iDir) = 0.0f;
        }

        // [Cecil] Camera shake effect
        m_aLastCameraShake(iDir) = m_aCameraShake(iDir);

        if (Abs(m_aCameraShake(iDir)) > 0.05f) {
          m_aCameraShake(iDir) /= 1.1f;
        } else {
          m_aCameraShake(iDir) = 0.0f;
        }
      }

      // [Cecil] Recoil power
      m_fLastRecoilPower = m_fRecoilPower;

      if (Abs(m_fRecoilPower) > 0.01f) {
        m_fRecoilPower /= 1.1f;
      } else {
        m_fRecoilPower = 0.0f;
      }

      // [Cecil] Weapon shake
      m_aLastWeaponShake = m_aWeaponShake;

      FLOAT2D vShakeSpeed(0.0f, 0.0f);

      // [Cecil] Don't move while zoomed in
      if (GetPlayerWeapons()->m_iSniping == 0) {
        // Deviate horizontal angle and set desired vertical angle
        vShakeSpeed(1) = -paAction.pa_aRotation(1) * 0.025f;
        vShakeSpeed(2) = en_plViewpoint.pl_OrientationAngle(2) * 0.02f;
      }

      // Determine delta to the normalized target angle horizontally
      const FLOAT fDeltaX = Clamp(NormalizeAngle(-m_aWeaponShake(1)) / 3.0f, -15.0f, 15.0f);

      // Move angle towards the target angle
      if (Abs(m_aWeaponShake(1) + vShakeSpeed(1)) > 0.01f) {
        vShakeSpeed(1) += fDeltaX;
      } else {
        vShakeSpeed(1) = 0.0f;
      }

      // Determine delta to the desired target angle vertically
      const FLOAT fDeltaY = NormalizeAngle(vShakeSpeed(2) - m_aWeaponShake(2)) / 3.0f;

      // Move angle towards the target angle
      if (Abs(fDeltaY) > 0.0f) {
        vShakeSpeed(2) += fDeltaY;
      } else {
        vShakeSpeed(2) = 0.0f;
      }

      // [Cecil] Clamp the speed
      m_aWeaponShake(1) += Clamp(vShakeSpeed(1), -30.0f, 30.0f);
      m_aWeaponShake(2) += Clamp(vShakeSpeed(2), -30.0f, 30.0f);

      // [Cecil] Expired captions
      for (INDEX iCaption = 0; iCaption <= CT_CAPTIONS; iCaption++) {
        // reset caption if time ran out
        if (m_atmCaptionsOut[iCaption] < _pTimer->CurrentTick() - TM_CAPTION_ANIM*2.0f) {
          m_astrCaptions[iCaption] = "";
          m_atmCaptionsIn[iCaption] = -100.0f;
          m_atmCaptionsOut[iCaption] = -100.0f;
        }
      }
    }

    // limit diagonal speed against abusing
    FLOAT3D &v = paAction.pa_vTranslation;
    FLOAT fDiag = Sqrt(v(1)*v(1)+v(3)*v(3));

    if (fDiag > 0.01f) {
      FLOAT fDiagLimited = Min(fDiag, plr_fMoveSpeed);
      FLOAT fFactor = fDiagLimited/fDiag;
      v(1) *= fFactor;
      v(3) *= fFactor;
    }

    ulButtonsNow = paAction.pa_ulButtons;
    ulButtonsBefore = m_ulLastButtons;
    ulNewButtons = ulButtonsNow&~ulButtonsBefore;
    ulReleasedButtons = (~ulButtonsNow)&(ulButtonsBefore);

    m_ulLastButtons = ulButtonsNow;         // remember last buttons
    en_plLastViewpoint = en_plViewpoint;    // remember last view point for lerping

    // sniper zooming
    CPlayerWeapons *penWeapon = GetPlayerWeapons();

    // [Cecil] Not needed for now
    /*if (penWeapon->m_iCurrentWeapon == WEAPON_SNIPER) {
      if (bUseButtonHeld && m_ulFlags&PLF_ISZOOMING) {
        penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV;
        penWeapon->m_fSniperFOV -= penWeapon->m_fSnipingZoomSpeed;

        if (penWeapon->m_fSniperFOV < penWeapon->m_fSniperMinFOV) {
          penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV = penWeapon->m_fSniperMinFOV;
          PlaySound(m_soSniperZoom, SOUND_SILENCE, SOF_3D);
        }
      }

      if (ulReleasedButtons&PLACT_USE_HELD) {
         penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV;
         PlaySound(m_soSniperZoom, SOUND_SILENCE, SOF_3D);
      }
    }*/

    // [Cecil] Update last sniper FOV
    penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV;
    
    // if alive
    if (GetFlags() & ENF_ALIVE) {
      // if not in auto-action mode
      if (m_penActionMarker == NULL) {
        // apply actions
        AliveActions(paAction);
      // if in auto-action mode
      } else {
        // do automatic actions
        AutoActions(paAction);
      }
    // if not alive rotate camera view and rebirth on fire
    } else {
      DeathActions(paAction);
    }

    if (Abs(_pTimer->CurrentTick()-m_tmAnalyseEnd) < _pTimer->TickQuantum*2) {
      m_tmAnalyseEnd = 0;
      m_bPendingMessage = TRUE;
      m_tmMessagePlay = 0;
    }

    if (m_bPendingMessage && !IsFuss()) {
      m_bPendingMessage = FALSE;
      m_tmMessagePlay = _pTimer->CurrentTick()+1.0f;
      m_tmAnimateInbox = _pTimer->CurrentTick();
    }

    if (Abs(_pTimer->CurrentTick()-m_tmMessagePlay) < _pTimer->TickQuantum*2) {
      m_bPendingMessage = FALSE;
      m_tmAnalyseEnd = 0;

      // [Cecil] NOTE: Can probably be removed
      /*if (!m_bComputerInvoked && GetSP()->sp_bSinglePlayer) {
        PrintCenterMessage(this, this, 
          TRANS("Press USE to read the message!"), 5.0f, MSS_NONE);
      }*/
    }

    // wanna cheat a bit?
    if (CheatsEnabled()) {
      Cheats();
    }

    // [Cecil] Noclip mode
    BOOL bHAX = (m_iHAXFlags & HAXF_NOCLIP);
    BOOL bNeedNoclip = (GetPhysicsFlags() & EPF_TRANSLATEDBYGRAVITY) || (GetCollisionFlags() & ((ECBI_BRUSH|ECBI_MODEL)<<ECB_TEST));

    if (bHAX && bNeedNoclip) {
      SetPhysics(PPH_NOCLIP, TRUE, TRUE); // [Cecil]
      en_plViewpoint.pl_OrientationAngle = ANGLE3D(0, 0, 0);
      m_pstState = PST_FALL;
      en_pbpoStandOn = NULL;
      m_cpoStandOn.Reset(); // [Cecil]
      en_penReference = NULL;
      m_fFallTime = 1.0f;

    } else if (!bHAX && !bNeedNoclip) {
      SetPhysics(PPH_NORMAL, TRUE, TRUE); // [Cecil]
      en_plViewpoint.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    }

    // [Cecil] TEMP: Change materials
    if (hl2_bCheckMaterials) {
      _pbpoMaterial = GetPlayerWeapons()->GetMaterial();

      if (_pbpoMaterial == NULL) {
        CPrintF(" No material!\n");

      } else {
        CPrintF("\n  --------------------\n");
        for (INDEX iTex = 0; iTex < 3; iTex++) {
          // get the texture
          CBrushPolygonTexture &bpt = _pbpoMaterial->bpo_abptTextures[iTex];
          CTFileName fnTex = bpt.bpt_toTexture.GetName();

          CPrintF(" Layer %d: '%s'\n", iTex, fnTex);
        }

        INDEX iSurfaceIndex = _pbpoMaterial->bpo_bppProperties.bpp_ubSurfaceType;
        CPrintF("\n Material: %s (%d);", GetWorld()->wo_astSurfaceTypes[iSurfaceIndex].st_strName, iSurfaceIndex);

        // get the flags
        BOOL bCheckFlags[5];
        bCheckFlags[0] = _pbpoMaterial->bpo_ulFlags & BPOF_PORTAL;
        bCheckFlags[1] = _pbpoMaterial->bpo_ulFlags & BPOF_TRANSPARENT;
        bCheckFlags[2] = _pbpoMaterial->bpo_ulFlags & BPOF_TRANSLUCENT;
        bCheckFlags[3] = _pbpoMaterial->bpo_ulFlags & BPOF_INVISIBLE;
        bCheckFlags[4] = _pbpoMaterial->bpo_ulFlags & BPOF_SHOOTTHRU;
        
        CTString strFlagNames[5];
        strFlagNames[0] = "Portal";
        strFlagNames[1] = "Trparent";
        strFlagNames[2] = "Trlucent";
        strFlagNames[3] = "Invis";
        strFlagNames[4] = "ShootThru";

        // check them
        CTString strFlags = "";
        for (INDEX iFlag = 0; iFlag < 5; iFlag++) {
          if (!bCheckFlags[iFlag]) {
            continue;
          }

          if (strFlags != "") {
            strFlags += ", ";
          }
          strFlags += strFlagNames[iFlag];
        }

        CPrintF(" Flags: %s\n", (strFlags == "") ? "<none>" : strFlags);
      }

      hl2_bCheckMaterials = FALSE;
    }

    // if teleporting to marker (this cheat is enabled in all versions)
    if (cht_iGoToMarker > 0 && (GetFlags()&ENF_ALIVE)) {
      // rebirth player, and it will teleport
      m_iLastViewState = m_iViewState;
      SendEvent(ERebirth());
    }

    // keep latency for eventual printout
    UpdateLatency(tmLatency);

    // check if highscore has changed
    CheckHighScore();

    if (!IsPredictor()) {
      // [Cecil] Move picked objects around
      GetPlayerWeapons()->HoldingObject();

      // [Cecil] Move physics object
      MovePhysicsObject();
    }
  };


  // Called when player is disconnected
  void Disconnect(void) {
    // remember name
    m_strName = GetPlayerName();
    // clear the character, so we don't get re-connected to same entity
    en_pcCharacter = CPlayerCharacter();
    // make main loop exit
    SendEvent(EDisconnected());
  };

  // Called when player character is changed
  void CharacterChanged(const CPlayerCharacter &pcNew) {
    // remember original character
    CPlayerCharacter pcOrg = en_pcCharacter;

    // set the new character
    en_pcCharacter = pcNew;
    ValidateCharacter();

    // if the name has changed
    if (pcOrg.GetName()!=pcNew.GetName()) {
      // report that
      CPrintF(TRANS("%s is now known as %s\n"), 
        pcOrg.GetNameForPrinting(), pcNew.GetNameForPrinting());
    }

    // if the team has changed
    if (pcOrg.GetTeam()!=pcNew.GetTeam()) {
      // report that
      CPrintF(TRANS("%s switched to team %s\n"), 
        pcNew.GetNameForPrinting(), pcNew.GetTeamForPrinting());
    }

    // if appearance changed
    CPlayerSettings *ppsOrg = (CPlayerSettings *)pcOrg.pc_aubAppearance;
    CPlayerSettings *ppsNew = (CPlayerSettings *)pcNew.pc_aubAppearance;
    if (memcmp(ppsOrg->ps_achModelFile, ppsNew->ps_achModelFile, sizeof(ppsOrg->ps_achModelFile))!=0) {
      // update your real appearance if possible
      CTString strNewLook;
      BOOL bSuccess = SetPlayerAppearance(&m_moRender, &en_pcCharacter, strNewLook, /*bPreview=*/FALSE);
      // if succeeded
      if (bSuccess) {
        ParseGender(strNewLook);
        // report that
        CPrintF(TRANS("%s now appears as %s\n"), 
          pcNew.GetNameForPrinting(), strNewLook);
      // if failed
      } else {
        // report that
        CPrintF(TRANS("Cannot change appearance for %s: setting '%s' is unavailable\n"), 
          pcNew.GetNameForPrinting(), (const char*)ppsNew->GetModelFilename());
      }
      // attach weapon to new appearance
      GetPlayerAnimator()->SyncWeapon();
    }

    BOOL b3RDPersonOld = ppsOrg->ps_ulFlags&PSF_PREFER3RDPERSON;
    BOOL b3RDPersonNew = ppsNew->ps_ulFlags&PSF_PREFER3RDPERSON;
    if ((b3RDPersonOld && !b3RDPersonNew && m_iViewState==PVT_3RDPERSONVIEW)
      ||(b3RDPersonNew && !b3RDPersonOld && m_iViewState==PVT_PLAYEREYES) ) {
      ChangePlayerView();
    }
  };

  // Alive actions
  void AliveActions(const CPlayerAction &pa) {
    CPlayerAction paAction = pa;

    // if camera is active
    if (m_penCamera != NULL) {
      // ignore keyboard/mouse/joystick commands
      paAction.pa_vTranslation  = FLOAT3D(0.0f, 0.0f, 0.0f);
      paAction.pa_aRotation = ANGLE3D(0.0f, 0.0f, 0.0f);
      paAction.pa_aViewRotation = ANGLE3D(0.0f, 0.0f, 0.0f);

      // stop the camera
      if (ulNewButtons&(PLACT_FIRE|PLACT_USE)) {
        m_penCamera = NULL;
      }
    } else {
      ButtonsActions(paAction);
    }

    // do the actions
    ActiveActions(paAction);

    // if less than few seconds elapsed since last damage
    FLOAT tmSinceWounding = _pTimer->CurrentTick() - m_tmWoundedTime;

    if (tmSinceWounding < 4.0f) {
      // decrease damage ammount
      m_fDamageAmmount *= 1.0f - tmSinceWounding/4.0f;
    } else {
      // reset damage ammount
      m_fDamageAmmount = 0.0f;
    }
  }

  // Auto-actions
  void AutoActions(const CPlayerAction &pa) 
  {
    // if fire, use or computer is pressed
    if (ulNewButtons&(PLACT_FIRE|PLACT_USE|PLACT_COMPUTER)) {
      if (m_penCamera!=NULL) {
        CEntity *penOnBreak = ((CCamera&)*m_penCamera).m_penOnBreak;
        if (penOnBreak!=NULL) {
          SendToTarget(penOnBreak, EET_TRIGGER, this);
        }
      }
    }

    CPlayerAction paAction = pa;
    // ignore keyboard/mouse/joystick commands
    paAction.pa_vTranslation  = FLOAT3D(0,0,0);
    paAction.pa_aRotation     = ANGLE3D(0,0,0);
    paAction.pa_aViewRotation = ANGLE3D(0,0,0);

    // if moving towards the marker is enabled
    if (m_fAutoSpeed>0) {
      FLOAT3D vDelta = 
        m_penActionMarker->GetPlacement().pl_PositionVector-
        GetPlacement().pl_PositionVector;
      FLOAT fDistance = vDelta.Length();
      if (fDistance>0.1f) {
        vDelta/=fDistance;
        ANGLE aDH = GetRelativeHeading(vDelta);

        // if should hit the marker exactly
        FLOAT fSpeed = m_fAutoSpeed;
        if (GetActionMarker()->m_paaAction==PAA_RUNANDSTOP) {
          // adjust speed
          fSpeed = Min(fSpeed, fDistance/_pTimer->TickQuantum);
        }
        // adjust rotation
        if (Abs(aDH)>5.0f) {
          if (fSpeed>m_fAutoSpeed-0.1f) {
            aDH = Clamp(aDH, -30.0f, 30.0f);
          }
          paAction.pa_aRotation = ANGLE3D(aDH/_pTimer->TickQuantum,0,0);
        }
        // set forward speed
        paAction.pa_vTranslation = FLOAT3D(0,0,-fSpeed);
      }
    } else {
      paAction.pa_vTranslation = m_vAutoSpeed;
    }

    CPlayerActionMarker *ppam = GetActionMarker();
    ASSERT(ppam != NULL);

    if (ppam->m_paaAction == PAA_LOGO_FIRE_MINIGUN || ppam->m_paaAction == PAA_LOGO_FIRE_INTROSE) {
      if (m_tmMinigunAutoFireStart != -1) {
        FLOAT tmDelta = _pTimer->CurrentTick()-m_tmMinigunAutoFireStart;
        FLOAT aDH = 0.0f;
        FLOAT aDP = 0.0f;

        if (tmDelta >= 0.0f && tmDelta <= 0.75f) {
          aDH = 0.0f;

        } else if (tmDelta >= 0.75f) {
          FLOAT fDT = tmDelta-0.75f;
          aDH = 1.0f*cos(fDT + PI/2.0f);
          aDP = 0.5f*cos(fDT);
        }

        if (ppam->m_paaAction == PAA_LOGO_FIRE_INTROSE) {
          FLOAT fRatio = CalculateRatio(tmDelta, 0.25f, 5, 0.1f, 0.1f);
          aDP = 2.0f*sin(tmDelta*200.0f)*fRatio;

          if (tmDelta > 2.5f) {
            aDP+=(tmDelta-2.5f)*4.0f;
          }
        }

        paAction.pa_aRotation = ANGLE3D(aDH/_pTimer->TickQuantum, aDP/_pTimer->TickQuantum,0);
      }
    }

    // do the actions
    if (!(m_ulFlags&PLF_AUTOMOVEMENTS)) {
      ActiveActions(paAction);
    }
  }

  void GetLerpedWeaponPosition(FLOAT3D vRel, CPlacement3D &pl) {
    pl = CPlacement3D(vRel, ANGLE3D(0, 0, 0));
    CPlacement3D plView;
    _bDiscard3rdView = GetViewEntity() != this;
    GetLerpedAbsoluteViewPlacement(plView);
    pl.RelativeToAbsolute(plView);
  }

  void SpawnBubbles( INDEX ctBubbles)
  {
    for (INDEX iBouble = 0; iBouble < ctBubbles; iBouble++) {
      FLOAT3D vRndRel = FLOAT3D( (FRnd()-0.5f)*0.25f, -0.25f, -0.5f+FRnd()/10.0f);
      ANGLE3D aDummy = ANGLE3D(0,0,0);
      CPlacement3D plMouth = CPlacement3D( vRndRel, aDummy);

      plMouth.RelativeToAbsolute(en_plViewpoint);
      plMouth.RelativeToAbsolute(GetPlacement());
      FLOAT3D vRndSpd = FLOAT3D((FRnd()-0.5f)*0.25f, (FRnd()-0.5f)*0.25f, (FRnd()-0.5f)*0.25f);
      AddBouble(plMouth.pl_PositionVector, vRndSpd);
    }
  }

  void ActiveActions(const CPlayerAction &paAction) {
    // translation
    FLOAT3D vTranslation = paAction.pa_vTranslation;

    // turbo speed cheat
    if (cht_fTranslationMultiplier && CheatsEnabled()) { 
      vTranslation *= cht_fTranslationMultiplier;
    }

    // enable faster moving (but not higher jumping!) if having SerousSpeed powerup
    const TIME tmDelta = m_tmSeriousSpeed - _pTimer->CurrentTick();

    if (tmDelta > 0 && m_fAutoSpeed == 0.0f) { 
      vTranslation(1) *= 2.0f;
      vTranslation(3) *= 2.0f;
    }
    
    en_fAcceleration = plr_fAcceleration;
    en_fDeceleration = plr_fDeceleration;

    // [Cecil] Allow moving mid-air if haven't jumped from a bouncer
    if (!m_bFakeJump) {
      en_tmMaxJumpControl = -1.0f;
      en_fJumpControlMultiplier = 0.2f;
    }

    // [Cecil] New multipliers
    FLOAT fHorMul = GetSP()->sp_fSpeedMultiplier;
    vTranslation(1) *= fHorMul;
    vTranslation(3) *= fHorMul;
    vTranslation(2) *= GetSP()->sp_fJumpMultiplier;

    // [Cecil] Increase speed with noclip
    if (m_iHAXFlags & HAXF_NOCLIP) {
      vTranslation *= 2.0f;
    }

    CContentType &ctUp = GetWorld()->wo_actContentTypes[en_iUpContent];
    CContentType &ctDn = GetWorld()->wo_actContentTypes[en_iDnContent];
    PlayerState pstWanted = PST_STAND;
    BOOL bUpSwimable = (ctUp.ct_ulFlags & CTF_SWIMABLE) && en_fImmersionFactor <= 0.99f;
    BOOL bDnSwimable = (ctDn.ct_ulFlags & CTF_SWIMABLE) && en_fImmersionFactor >= 0.5f;

    // if considerably inside swimable content
    if (bUpSwimable || bDnSwimable) {
      // allow jumping
      m_ulFlags |= PLF_JUMPALLOWED;

      // if totaly inside
      if (en_fImmersionFactor >= 0.99f || bUpSwimable) {
        // want to dive
        pstWanted = PST_DIVE;
      // if only partially inside
      } else {
        // want to swim
        pstWanted = PST_SWIM;
      }
    // if not in swimable content
    } else {
      // if has reference
      if (en_penReference != NULL) {
        // reset fall timer
        m_fFallTime = 0.0f;

        // [Cecil] Allow jumping after landing
        /*if (vTranslation(2) < 0.1f) {
          m_ulFlags |= PLF_JUMPALLOWED;
        }*/

        // [Cecil] Reset fake jump
        m_bFakeJump = FALSE;

      // if no reference
      } else {
        // increase fall time
        m_fFallTime += _pTimer->TickQuantum;
      }

      // [Cecil] Auto-jump
      /*if (GetSP()->sp_iHL2Flags & HL2F_AUTOBHOP) {
        m_ulFlags |= PLF_JUMPALLOWED;
      }*/

      // if not wanting to jump
      if (vTranslation(2) < 0.1f || GetSP()->sp_iHL2Flags & HL2F_AUTOBHOP) {
        // allow jumping
        m_ulFlags |= PLF_JUMPALLOWED;
      }

      // if falling
      if (m_fFallTime >= 0.5f) {
        // wants to fall
        pstWanted = PST_FALL;
      // if not falling
      } else {
        // if holding down and really not in air
        if (vTranslation(2) < -0.01f) {
          // wants to crouch
          pstWanted = PST_CROUCH;
        // if not holding down
        } else {
          // wants to stand
          pstWanted = PST_STAND;
        }
      }
    }

    // [Cecil] For collision check
    CEntity *penDummy;

    // flying mode - rotate whole player
    if (!(GetPhysicsFlags() & EPF_TRANSLATEDBYGRAVITY)) {
      PlayerRotate(paAction.pa_aRotation);
      StartModelAnim(PLAYER_ANIM_STAND, AOF_LOOPING|AOF_NORESTART);
      PlayerMove(vTranslation);

    // normal mode
    } else {
      PlayerState pstOld = m_pstState; 

      // if different state needed
      if (pstWanted != m_pstState) {
        // check state wanted
        switch (pstWanted) {
          // if wanting to stand
          case PST_STAND: {
            // if can stand here
            if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_STAND)) {
              //en_plViewpoint.pl_PositionVector(2) = plr_fViewHeightStand;

              if (m_pstState == PST_CROUCH) {
                ((CPlayerAnimator&)*m_penAnimator).Rise();
              } else {
                ((CPlayerAnimator&)*m_penAnimator).Stand();
              }
              m_pstState = PST_STAND;
            }
          } break;
          // if wanting to crouch
          case PST_CROUCH: {
            // if can crouch here
            if (Abs(m_fViewHeight-plr_fViewHeightCrouch) < 0.5f && ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_CROUCH)) {
              m_pstState = PST_CROUCH;
              //en_plViewpoint.pl_PositionVector(2) = plr_fViewHeightCrouch;
              ((CPlayerAnimator&)*m_penAnimator).Crouch();
            }
          } break;
          // if wanting to swim
          case PST_SWIM: {
            // if can swim here
            if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_SWIMSMALL)) {
              ChangeCollisionBoxIndexWhenPossible(PLAYER_COLLISION_BOX_SWIM);
              m_pstState = PST_SWIM;
              //en_plViewpoint.pl_PositionVector(2) = plr_fViewHeightSwim;
              ((CPlayerAnimator&)*m_penAnimator).Swim();                   
              m_fSwimTime = _pTimer->CurrentTick();
            }
          } break;
          // if wanting to dive
          case PST_DIVE: {
            // if can dive here
            if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_SWIMSMALL)) {
              ChangeCollisionBoxIndexWhenPossible(PLAYER_COLLISION_BOX_SWIM);
              m_pstState = PST_DIVE;
              //en_plViewpoint.pl_PositionVector(2) = plr_fViewHeightDive;
              ((CPlayerAnimator&)*m_penAnimator).Swim();
            }
          } break;
          // if wanting to fall
          case PST_FALL: {
            // if can fall here
            if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_STAND)) {
              m_pstState = PST_FALL;
              //en_plViewpoint.pl_PositionVector(2) = plr_fViewHeightStand;
              ((CPlayerAnimator&)*m_penAnimator).Fall();
            }
          } break;
        }
      }

      // if state changed
      if (m_pstState != pstOld) {
        // check water entering/leaving
        BOOL bWasInWater = (pstOld==PST_SWIM||pstOld==PST_DIVE);
        BOOL bIsInWater = (m_pstState==PST_SWIM||m_pstState==PST_DIVE);
        // if entered water
        if (bIsInWater && !bWasInWater) {
          PlaySound(m_soBody, SOUND_WATER_ENTER, SOF_3D);
        // if left water
        } else if (!bIsInWater && bWasInWater) {
          PlaySound(m_soBody, SOUND_WATER_LEAVE, SOF_3D);
          m_tmOutOfWater = _pTimer->CurrentTick();

        // if in water
        } else if (bIsInWater) {
          // if dived in
          if (pstOld == PST_SWIM && m_pstState == PST_DIVE) {
            m_soFootL.Set3DParameters(20.0f, 2.0f, 1.0f, 1.0f);
            PlaySound(m_soFootL, SOUND_DIVEIN, SOF_3D);
            m_bMoveSoundLeft = TRUE;
            m_tmMoveSound = _pTimer->CurrentTick();

          // if dived out
          } else if (m_pstState == PST_SWIM && pstOld == PST_DIVE) {
            m_soFootL.Set3DParameters(20.0f, 2.0f, 1.0f, 1.0f);
            PlaySound(m_soFootL, SOUND_DIVEOUT, SOF_3D);
            m_bMoveSoundLeft = TRUE;
            m_tmMoveSound = _pTimer->CurrentTick();
          }
        }

        // if just fell to ground
        if (pstOld == PST_FALL && (m_pstState == PST_STAND || m_pstState == PST_CROUCH)) {
          if (m_cpoStandOn.bHit) {
            m_iLastSurface = m_cpoStandOn.ubSurface;

            m_soFootL.Set3DParameters(20.0f, 2.0f, 1.5f, 1.0f);
            PlaySound(m_soFootL, SurfaceStepSound(this), SOF_3D);
          }
        }

        // change ambience sounds
        if (m_pstState == PST_DIVE) {
          m_soLocalAmbientLoop.Set3DParameters(50.0f, 10.0f, 0.25f, 1.0f);
          PlaySound(m_soLocalAmbientLoop, SOUND_WATERAMBIENT, SOF_LOOP|SOF_3D|SOF_VOLUMETRIC|SOF_LOCAL);

        } else if (pstOld == PST_DIVE) {
          m_soLocalAmbientLoop.Stop();
        }
      }

      // if just jumped
      if (en_tmJumped + _pTimer->TickQuantum >= _pTimer->CurrentTick()
       && en_tmJumped <= _pTimer->CurrentTick() && en_penReference == NULL
       // [Cecil] Don't play any jumping sounds mid-air
       && m_fFallTime <= 0.5f)
      {
        // play jump sound
        m_soFootL.Set3DParameters(20.0f, 2.0f, 3.0f, 1.0f);
        PlaySound(m_soFootL, SurfaceStepSound(this), SOF_3D);

        // [Cecil] Increase acceleration
        if (GetSP()->sp_iHL2Flags & HL2F_BHOP) {
          if (m_pstState == PST_STAND || m_pstState == PST_FALL) {
            IncreaseAcceleration(FALSE);
          }
        }

        // disallow jumping
        m_ulFlags &= ~PLF_JUMPALLOWED;
      }

      // set density
      if (m_pstState == PST_SWIM || pstWanted == PST_SWIM
       || (pstWanted == PST_DIVE && m_pstState != pstWanted)) {
        en_fDensity = 500.0f;  // lower density than water
      } else {
        en_fDensity = 1000.0f; // same density as water
      }

      if (_pTimer->CurrentTick() >= m_tmNextAmbientOnce) {
        if (m_pstState == PST_DIVE) {
          PlaySound(m_soLocalAmbientOnce, SOUND_WATERBUBBLES, SOF_3D|SOF_VOLUMETRIC|SOF_LOCAL);
          m_soLocalAmbientOnce.Set3DParameters(25.0f, 5.0f, 2.0f, Lerp(0.5f, 1.5f, FRnd()));
          SpawnBubbles(5 + INDEX(FRnd()*5));
        }
        m_tmNextAmbientOnce = _pTimer->CurrentTick() + 5.0f+FRnd();
      }

      // [Cecil] Reset speed limit in water
      if (GetSP()->sp_iHL2Flags & HL2F_BHOP && m_pstState != PST_STAND && m_pstState != PST_FALL) {
        m_fSpeedLimit = 0.0f;
      }

      // [Cecil] Smooth view change
      switch (pstWanted) {
        case PST_STAND: case PST_FALL:
          if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_STAND)) {
            m_fViewHeight = Clamp(m_fViewHeight*1.1f + 0.1f, 0.0f, plr_fViewHeightStand);
          }
          break;

        case PST_CROUCH:
          if (!CheckForCollisionNow(PLAYER_COLLISION_BOX_CROUCH, &penDummy)) {
            m_fViewHeight -= plr_fViewHeightCrouch;
            m_fViewHeight = ClampDn(m_fViewHeight / 1.5f, 0.01f) + plr_fViewHeightCrouch-0.01f;

            vTranslation(2) = 0.0f;
          }
          break;

        case PST_SWIM:
          if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_SWIMSMALL)) {
            m_fViewHeight -= plr_fViewHeightSwim;
            m_fViewHeight = ClampDn(m_fViewHeight / 1.25f, 0.01f) + plr_fViewHeightSwim-0.01f;
          }
          break;

        case PST_DIVE:
          if (ChangeCollisionBoxIndexNow(PLAYER_COLLISION_BOX_SWIMSMALL)) {
            m_fViewHeight -= plr_fViewHeightDive;
            m_fViewHeight = ClampDn(m_fViewHeight / 1.25f, 0.01f) + plr_fViewHeightDive-0.01f;
          }
          break;
      }
      en_plViewpoint.pl_PositionVector(2) = m_fViewHeight;

      // if crouching
      if (m_pstState == PST_CROUCH) {
        // go slower
        vTranslation /= 2.5f;
        // don't go down
        vTranslation(2) = 0.0f;
      }

      // if diving
      if (m_pstState == PST_DIVE) {
        // translate up/down with view pitch
        FLOATmatrix3D mPitch;
        MakeRotationMatrixFast(mPitch, FLOAT3D(0, en_plViewpoint.pl_OrientationAngle(2), 0));
        FLOAT fZ = vTranslation(3);
        vTranslation(3) = 0.0f;
        vTranslation += FLOAT3D(0,0,fZ)*mPitch;

      // if swimming
      } else if (m_pstState == PST_SWIM) {
        // translate down with view pitch if large
        FLOATmatrix3D mPitch;
        FLOAT fPitch = en_plViewpoint.pl_OrientationAngle(2);

        if (fPitch > -30.0f) {
          fPitch = 0;
        }

        MakeRotationMatrixFast(mPitch, FLOAT3D(0,fPitch,0));
        FLOAT fZ = vTranslation(3);
        vTranslation(3) = 0.0f;
        vTranslation += FLOAT3D(0, 0, fZ)*mPitch;
      }

      // if swimming or diving
      if (m_pstState == PST_SWIM || m_pstState == PST_DIVE) {
        // up/down is slower than on ground
        vTranslation(2) *= 0.5f;
      }

      // if just started swimming
      if (m_pstState == PST_SWIM && _pTimer->CurrentTick() < m_fSwimTime + 0.5f
       || _pTimer->CurrentTick() < m_tmOutOfWater + 0.5f) {
        // no up/down change
        vTranslation(2) = 0;
      }

      // disable consecutive jumps
      if (!(m_ulFlags&PLF_JUMPALLOWED) && vTranslation(2) > 0) {
        vTranslation(2) = 0.0f;
      }

      // [Cecil] Moved from below
      FLOATmatrix3D mViewRot;
      MakeRotationMatrixFast(mViewRot, ANGLE3D(0.0f, 0.0f, 0.0f));

      // [Cecil] Source Movement Simulation
      if (GetSP()->sp_iHL2Flags & HL2F_BHOP) {
        if (m_cpoStandOn.bHit && !(GetPhysicsFlags() & EPF_ONSTEEPSLOPE)) {
          if (m_tmAirTime < _pTimer->CurrentTick() - ONE_TICK) {
            m_fSpeedLimit = 0.0f;
          }
        } else {
          m_tmAirTime = _pTimer->CurrentTick();
        }

        vTranslation(1) *= (1.0f + m_fSpeedLimit);
        vTranslation(3) *= (1.0f + m_fSpeedLimit);

        //CPrintF("%.2f\n", m_fSpeedLimit);
      }

      PlayerMove(vTranslation);

      // set pitch and banking from the normal rotation into the view rotation
      en_plViewpoint.Rotate_HPB(ANGLE3D(
        (ANGLE)((FLOAT)paAction.pa_aRotation(1)*_pTimer->TickQuantum),
        (ANGLE)((FLOAT)paAction.pa_aRotation(2)*_pTimer->TickQuantum),
        (ANGLE)((FLOAT)paAction.pa_aRotation(3)*_pTimer->TickQuantum)));
      // pitch and banking boundaries
      RoundViewAngle(en_plViewpoint.pl_OrientationAngle(2), PITCH_MAX);
      RoundViewAngle(en_plViewpoint.pl_OrientationAngle(3), BANKING_MAX);

      // translation rotate player for heading
      if (vTranslation.Length() > 0.1f) {
        PlayerRotate(ANGLE3D(en_plViewpoint.pl_OrientationAngle(1)/_pTimer->TickQuantum, 0.0f, 0.0f));

        if (m_ulFlags & PLF_VIEWROTATIONCHANGED) {
          m_ulFlags &= ~PLF_VIEWROTATIONCHANGED;
          //FLOATmatrix3D mViewRot;
          MakeRotationMatrixFast(mViewRot, ANGLE3D(en_plViewpoint.pl_OrientationAngle(1), 0.0f, 0.0f));

          FLOAT3D vTransRel = vTranslation*mViewRot;
          PlayerMove(vTransRel);
        }
        en_plViewpoint.pl_OrientationAngle(1) = 0.0f;

      // rotate head, body and legs
      } else {
        m_ulFlags |= PLF_VIEWROTATIONCHANGED;
        PlayerRotate(ANGLE3D(0.0f, 0.0f, 0.0f));

        ANGLE aDiff = en_plViewpoint.pl_OrientationAngle(1) - HEADING_MAX;
        if (aDiff > 0.0f) {
          PlayerRotate(ANGLE3D(aDiff/_pTimer->TickQuantum, 0.0f, 0.0f));
        }

        aDiff = en_plViewpoint.pl_OrientationAngle(1) + HEADING_MAX;
        if (aDiff < 0.0f) {
          PlayerRotate(ANGLE3D(aDiff/_pTimer->TickQuantum, 0.0f, 0.0f));
        }

        RoundViewAngle(en_plViewpoint.pl_OrientationAngle(1), HEADING_MAX);
      }

      // play moving sounds
      FLOAT fWantSpeed = en_vDesiredTranslationRelative.Length() / GetSP()->sp_fSpeedMultiplier;
      FLOAT fGoesSpeed = en_vCurrentTranslationAbsolute.Length() / GetSP()->sp_fSpeedMultiplier;

      BOOL bOnGround = (m_pstState == PST_STAND) || (m_pstState == PST_CROUCH);

      // [Cecil] Changed from 5 to 7; ignore walking speed
      BOOL bRunning = bOnGround && fWantSpeed > 7.0f && fGoesSpeed > 7.0f;
      BOOL bWalking = bOnGround && !bRunning; // && fWantSpeed > 2.0f && fGoesSpeed > 2.0f;

      BOOL bSwimming = (m_pstState == PST_SWIM) && fWantSpeed > 2.0f && fGoesSpeed > 2.0f;
      BOOL bDiving = (m_pstState == PST_DIVE) && fWantSpeed > 2.0f && fGoesSpeed > 2.0f;

      TIME tmNow = _pTimer->CurrentTick();

      // [Cecil] Surface type
      if (m_cpoStandOn.bHit) {
        m_iLastSurface = m_cpoStandOn.ubSurface;

      // No ground
      } else {
        bOnGround = FALSE;
        bRunning = FALSE;
        bWalking = FALSE;
      }

      // [Cecil] Water surface
      if ((ctDn.ct_ulFlags & CTF_SWIMABLE) && en_fImmersionFactor >= 0.1f) {
        m_iLastSurface = SURFACE_WATER;
      }

      if (bRunning) {
        if (tmNow > m_tmMoveSound + plr_fRunSoundDelay) {
          m_tmMoveSound = tmNow;

          m_soFootL.Set3DParameters(20.0f, 2.0f, 1.5f, 1.0f);
          PlaySound(m_soFootL, SurfaceStepSound(this), SOF_3D);
        }

      // [Cecil] No walking sounds
      /*} else if (bWalking) {
        if (tmNow > m_tmMoveSound + plr_fWalkSoundDelay) {
          m_tmMoveSound = tmNow;

          m_soFootL.Set3DParameters(20.0f, 2.0f, 1.5f, 1.0f);
          PlaySound(m_soFootL, SurfaceStepSound(this), SOF_3D);
        }*/

      } else if (bDiving) {
        if (tmNow > m_tmMoveSound + plr_fDiveSoundDelay) {
          m_tmMoveSound = tmNow;

          m_soFootL.Set3DParameters(20.0f, 2.0f, 1.5f, 1.0f);
          PlaySound(m_soFootL, SwimSound(), SOF_3D);
        }

      } else if (bSwimming) {
        if (tmNow > m_tmMoveSound + plr_fSwimSoundDelay) {
          m_tmMoveSound = tmNow;

          m_soFootL.Set3DParameters(20.0f, 2.0f, 1.5f, 1.0f);
          PlaySound(m_soFootL, SwimSound(), SOF_3D);
        }
      }
    
      // if player is almost out of air
      /*TIME tmBreathDelay = tmNow-en_tmLastBreathed;
      if (en_tmMaxHoldBreath - tmBreathDelay < 20.0f) {
        // play drowning sound once in a while
        if (m_tmMouthSoundLast + 2.0f < tmNow) {
          m_tmMouthSoundLast = tmNow;
          SetRandomMouthPitch(0.9f, 1.1f);
          PlaySound(m_soMouth, SOUND_DROWN1 + IRnd()%3, SOF_3D);
        }
      }*/

      // animate player
      ((CPlayerAnimator&)*m_penAnimator).AnimatePlayer();
    }

    // [Cecil] Flashlight
    if (m_penFlashlight != NULL) {
      FLOAT3D vFLDiff = (m_penFlashlight->GetPlacement().pl_PositionVector - FL_PLACE.pl_PositionVector);

      if (m_bFlashlight) {
        FLOAT3D vView = GetPlacement().pl_PositionVector + en_plViewpoint.pl_PositionVector * GetRotationMatrix();
        FLOAT3D vTarget = GetPlayerWeapons()->m_vRayHit;
        const FLOAT fRayDist = GetPlayerWeapons()->m_fRayHitDistance;
        const FLOAT fDist = ClampDn(fRayDist * 0.9f, 0.0f);

        // limited target position
        FLOAT3D vDir = (vTarget-vView).Normalize();
        vTarget = vView + vDir * Min(fDist, 32.0f);
        FLOAT fRatio = Clamp(fRayDist, 1.0f, 32.0f);

        CLightSource lsFlashlight;
        lsFlashlight.ls_colColor = LerpColor(0x9F9F9FFF, 0x101010FF, fRatio/32.0f);
        lsFlashlight.ls_rFallOff = fRatio * 0.5f;
        lsFlashlight.ls_rHotSpot = fRatio * (0.3f - 0.2 * (fRatio/32.0f));
        lsFlashlight.ls_ulFlags = 0;
        ((CLight&)*m_penFlashlight).m_lsLightSource.SetLightSourceWithNoDiscarding(lsFlashlight);

        m_penFlashlight->Teleport(CPlacement3D(vTarget, ANGLE3D(0.0f, 0.0f, 0.0f)), FALSE);
        m_penFLAmbient->Teleport(CPlacement3D(vView, ANGLE3D(0.0f, 0.0f, 0.0f)), FALSE);

      } else if (vFLDiff.Length() > 1.0f) {
        m_penFlashlight->Teleport(FL_PLACE, FALSE);
        m_penFLAmbient->Teleport(FL_PLACE, FALSE);
      }
    } else {
      // [Cecil] Create new flashlight
      m_penFlashlight = CreateEntity(FL_PLACE, CLASS_LIGHT);
      m_penFlashlight->Initialize();

      m_penFLAmbient = CreateEntity(FL_PLACE, CLASS_LIGHT);
      m_penFLAmbient->Initialize();

      CLightSource lsAmbient;
      lsAmbient.ls_colColor = 0x0F0F0FFF;
      lsAmbient.ls_rFallOff = 16.0f;
      lsAmbient.ls_rHotSpot = 3.0f;
      lsAmbient.ls_ulFlags = 0;
      ((CLight&)*m_penFLAmbient).m_lsLightSource.SetLightSourceWithNoDiscarding(lsAmbient);
    }

    // [Cecil] Separate gravity gun control
    if (GetPlayerWeapons()->m_iCurrentWeapon == WEAPON_GRAVITYGUN) {
      GetPlayerWeapons()->ControlGGFlare();
    }
  };

  // Round view angle
  void RoundViewAngle(ANGLE &aViewAngle, ANGLE aRound) {
    if (aViewAngle > aRound) {
      aViewAngle = aRound;
    }

    if (aViewAngle < -aRound) {
      aViewAngle = -aRound;
    }
  };

  // Death actions
  void DeathActions(CPlayerAction &paAction) {
    // [Cecil] Set without the camera
    // set heading, pitch and banking from the normal rotation into the camera view rotation
    /*if (m_penView != NULL) {
      ASSERT(IsPredicted() &&  m_penView->IsPredicted() ||  IsPredictor() &&  m_penView->IsPredictor()
         || !IsPredicted() && !m_penView->IsPredicted() && !IsPredictor() && !m_penView->IsPredictor());*/

      en_plViewpoint.pl_PositionVector = FLOAT3D(0, 1, 0);
      en_plViewpoint.pl_OrientationAngle += (ANGLE3D(
        (ANGLE)((FLOAT)paAction.pa_aRotation(1)*_pTimer->TickQuantum),
        (ANGLE)((FLOAT)paAction.pa_aRotation(2)*_pTimer->TickQuantum),
        (ANGLE)((FLOAT)paAction.pa_aRotation(3)*_pTimer->TickQuantum)));
    //}

    // [Cecil] Reset the recoil
    m_aRecoilShake = ANGLE3D(0.0f, 0.0f, 0.0f);
    m_aLastRecoilShake = ANGLE3D(0.0f, 0.0f, 0.0f);
    m_fRecoilPower = 0.0f;
    m_fLastRecoilPower = 0.0f;

    // [Cecil] HAX menu actions
    MenuActions();

    // if death is finished and fire just released again and this is not a predictor
    if (m_iMayRespawn==2 && (ulReleasedButtons&PLACT_FIRE) && !IsPredictor()) {
      // if singleplayer
      if (GetSP()->sp_bSinglePlayer) {
        // [Cecil] Revive
        if (CheatsEnabled() && cht_bRevive) {
          if (m_ulLastButtons&PLACT_RELOAD) {
            m_ulFlags &= ~PLF_RESPAWNINPLACE;
          }

          SendEvent(EEnd());
        } else {
          // load quick savegame
          _pShell->Execute("gam_bQuickLoad=1;");
        }
      // if deathmatch or similar
      } else if (!GetSP()->sp_bCooperative) {
        // rebirth
        SendEvent(EEnd());
      // if cooperative
      } else {
        // if holding down reload button
        if (m_ulLastButtons&PLACT_RELOAD) {
          // forbid respawning in-place
          m_ulFlags &= ~PLF_RESPAWNINPLACE;
        }
        // if playing on credits
        if (GetSP()->sp_ctCredits != 0) {
          // if playing on infinite credits or some credits left
          if (GetSP()->sp_ctCredits == -1 || GetSP()->sp_ctCreditsLeft != 0) {
            // decrement credits
            if (GetSP()->sp_ctCredits != -1) {
              ((CSessionProperties*)GetSP())->sp_ctCreditsLeft--;
            }

            // initiate respawn
            CPrintF(TRANS("%s is riding the gun again\n"), GetPlayerName());
            SendEvent(EEnd());

            // report number of credits left
            if (GetSP()->sp_ctCredits > 0) {
              if (GetSP()->sp_ctCreditsLeft == 0) {
                CPrintF(TRANS("  no more credits left!\n"));
              } else {
                CPrintF(TRANS("  %d credits left\n"), GetSP()->sp_ctCreditsLeft);
              }
            }
          // if no more credits left
          } else {
            // report that you cannot respawn
            CPrintF(TRANS("%s rests in peace - out of credits\n"), GetPlayerName());
          }
        }
      }
    }
    // check fire released once after death
    if (m_iMayRespawn == 1 && !(ulButtonsNow&PLACT_FIRE)) {
      m_iMayRespawn = 2;
    }
  };

  // Buttons actions
  void ButtonsActions(CPlayerAction &paAction) {
    // [Cecil] HAX menu actions
    MenuActions();

    // if selecting a new weapon select it
    if ((ulNewButtons & PLACT_SELECT_WEAPON_MASK) != 0) {
      ESelectWeapon eSelect;
      eSelect.iWeapon = (ulNewButtons&PLACT_SELECT_WEAPON_MASK)>>PLACT_SELECT_WEAPON_SHIFT;
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);
    }

    // next weapon zooms out when in sniping mode
    if (ulNewButtons & PLACT_WEAPON_NEXT) {
      // [Cecil] Not needed for now
      /*if (((CPlayerWeapons&)*m_penWeapons).m_bSniping) {
        ApplySniperZoom(0);
      } else */if (TRUE) {
        ESelectWeapon eSelect;
        eSelect.iWeapon = -1;
        ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);
      }
    }
    
    // previous weapon zooms in when in sniping mode
    if (ulNewButtons & PLACT_WEAPON_PREV) {
      // [Cecil] Not needed for now
      /*if (((CPlayerWeapons&)*m_penWeapons).m_bSniping) {
        ApplySniperZoom(1);
      } else */if (TRUE) {
        ESelectWeapon eSelect;
        eSelect.iWeapon = -2;
        ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);
      }
    }

    if (ulNewButtons & PLACT_WEAPON_FLIP) {
      ESelectWeapon eSelect;
      eSelect.iWeapon = -3;
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);
    }

    // if fire is pressed
    if (ulNewButtons & PLACT_FIRE) {
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(EFireWeapon());
    }
    // if fire is released
    if (ulReleasedButtons & PLACT_FIRE) {
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReleaseWeapon());
    }

    // if alt fire is pressed
    if (ulNewButtons & PLACT_ALTFIRE) {
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(EAltFireWeapon());
    }
    // if alt fire is released
    if (ulReleasedButtons & PLACT_ALTFIRE) {
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReleaseWeapon());
    }

    // if reload is pressed
    if (ulReleasedButtons & PLACT_RELOAD) {
      ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReloadWeapon());
    }

    // [Cecil] No flashlight or suit zoom without the suit
    if (!m_bHEVSuit) {
      m_bFlashlight = FALSE;
      m_bSuitZoom = FALSE;

    } else {
      // [Cecil] Flashlight
      if (ulNewButtons & PLACT_FLASHLIGHT) {
        m_bFlashlight = !m_bFlashlight;
        PlaySound(m_soFlashlight, SOUND_FLASHLIGHT, SOF_3D|SOF_VOLUMETRIC);
      }

      // [Cecil] Use suit zoom if not scoping in
      if (ulReleasedButtons & PLACT_ZOOM) {
        m_bSuitZoom = FALSE;
      } else if ((ulNewButtons & PLACT_ZOOM) && GetPlayerWeapons()->m_iSniping == 0) {
        m_bSuitZoom = TRUE;
      }
    }

    // if use is pressed
    if (ulNewButtons & PLACT_USE) {
      // [Cecil] Not needed for now
      /*if (((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon == WEAPON_SNIPER) {
        UsePressed(FALSE);
      } else {*/
        UsePressed(ulNewButtons & PLACT_COMPUTER);
      //}
    // if USE is not detected due to doubleclick and player is holding sniper
    } else if (ulNewButtons & PLACT_SNIPER_USE && ((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon == WEAPON_CROSSBOW) {
      UsePressed(FALSE);
    // if computer is pressed
    } else if (ulNewButtons & PLACT_COMPUTER) {
      ComputerPressed();
    }
    
    // if use is being held
    if (ulNewButtons & PLACT_USE_HELD) {
      bUseButtonHeld = TRUE;
    }

    // if use is released
    if (ulReleasedButtons & PLACT_USE_HELD) {
      bUseButtonHeld = FALSE;  
    }

    // if sniper zoomin is pressed
    /*if (ulNewButtons & PLACT_SNIPER_ZOOMIN) {
      ApplySniperZoom(1);
    }

    // if sniper zoomout is pressed
    if (ulNewButtons & PLACT_SNIPER_ZOOMOUT) {
      ApplySniperZoom(0);
    }*/

    // if 3rd person view is pressed
    if (ulNewButtons & PLACT_3RD_PERSON_VIEW) {
      ChangePlayerView();
    }

    // apply center view
    if (ulButtonsNow & PLACT_CENTER_VIEW) {
      // center view with speed of 45 degrees per 1/20 seconds
      paAction.pa_aRotation(2) += Clamp(-en_plViewpoint.pl_OrientationAngle(2) / _pTimer->TickQuantum, -900.0f, +900.0f);
    }
  };

  void ApplySniperZoom(BOOL bZoomIn) {
    // [Cecil] Not needed for now
    return;

    // do nothing if not holding sniper and if not in sniping mode
    if (((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon != WEAPON_CROSSBOW
     || ((CPlayerWeapons&)*m_penWeapons).m_iSniping == 0) {
      return;
    }

    BOOL bZoomChanged;

    if (((CPlayerWeapons&)*m_penWeapons).SniperZoomDiscrete(bZoomIn, bZoomChanged)) {
      if (bZoomChanged) { 
        PlaySound(m_soSniperZoom, SOUND_SNIPER_QZOOM, SOF_3D); 
      }
      m_ulFlags|=PLF_ISZOOMING;

    } else {
      m_ulFlags&=~PLF_ISZOOMING;
      PlaySound(m_soSniperZoom, SOUND_SILENCE, SOF_3D);
    }
  };

  // [Cecil] New zoom applying
  void ApplyCSSWeaponZoom(BOOL bZoomIn) {
    CPlayerWeapons &penWeapons = (CPlayerWeapons&)*m_penWeapons;

    BOOL bZoomChanged;

    if (penWeapons.m_iSniping <= 0) {
      m_ulFlags |= PLF_ISZOOMING;
    }

    if (penWeapons.CSS_SniperZoomDiscrete(bZoomIn, bZoomChanged, TRUE)) {
      if (bZoomChanged) { 
        PlaySound(m_soSniperZoom, SOUND_SNIPER_QZOOM, SOF_3D); 
      }
      m_ulFlags |= PLF_ISZOOMING;

    } else {
      m_ulFlags &= ~PLF_ISZOOMING;
      PlaySound(m_soSniperZoom, SOUND_SNIPER_QZOOM, SOF_3D);
    }
  };

  void ApplyWeaponZoom(BOOL bZoomIn) {
    CPlayerWeapons &penWeapons = (CPlayerWeapons&)*m_penWeapons;

    if (bZoomIn) {
      penWeapons.m_iSniping = -2;
      m_ulFlags |= PLF_ISZOOMING;

    } else {
      penWeapons.m_iSniping = -1;
      m_ulFlags &= ~PLF_ISZOOMING;
    }
  };

  // check if cheats can be active
  BOOL CheatsEnabled(void)
  {
    return (GetSP()->sp_ctMaxPlayers==1||GetSP()->sp_bQuickTest) && m_penActionMarker==NULL && !_SE_DEMO;
  }

  // Cheats
  void Cheats(void)
  {
    BOOL bFlyOn = cht_bFly || cht_bGhost;
    // fly mode
    BOOL bIsFlying = !(GetPhysicsFlags() & EPF_TRANSLATEDBYGRAVITY);
    if (bFlyOn && !bIsFlying) {
      SetPhysics(PPH_NOCLIP, TRUE, FALSE); // [Cecil]
      en_plViewpoint.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    } else if (!bFlyOn && bIsFlying) {
      SetPhysics(PPH_NORMAL, TRUE, FALSE); // [Cecil]
      en_plViewpoint.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    }

    // ghost mode
    BOOL bIsGhost = !(GetCollisionFlags() & ((ECBI_BRUSH|ECBI_MODEL)<<ECB_TEST));
    if (cht_bGhost && !bIsGhost) {
      SetPhysics(PPH_NOCLIP, FALSE, TRUE); // [Cecil]
    } else if (!cht_bGhost && bIsGhost) {
      SetPhysics(PPH_NORMAL, FALSE, TRUE); // [Cecil]
    }

    // invisible mode
    const TIME tmDelta = m_tmInvisibility - _pTimer->CurrentTick();
    if (cht_bInvisible || tmDelta>0) {
      SetFlags(GetFlags() | ENF_INVISIBLE);
    } else {
      SetFlags(GetFlags() & ~ENF_INVISIBLE);
    }

    // cheat
    if (cht_bGiveAll) {
      cht_bGiveAll = FALSE;
      ((CPlayerWeapons&)*m_penWeapons).CheatGiveAll();
    }

    if (cht_bKillAll) {
      cht_bKillAll = FALSE;
      KillAllEnemies(this);
    }

    if (cht_bOpen) {
      cht_bOpen = FALSE;
      ((CPlayerWeapons&)*m_penWeapons).CheatOpen();
    }
    
    if (cht_bAllMessages) {
      cht_bAllMessages = FALSE;
      CheatAllMessages();
    }
    
    if (cht_bRefresh) {
      cht_bRefresh = FALSE;
      SetHealth(TopHealth());
    }
  };


/************************************************************
 *                 END OF PLAYER ACTIONS                    *
 ************************************************************/


  // Get current placement that the player views from in absolute space.
  void GetLerpedAbsoluteViewPlacement(CPlacement3D &plView) {
    if (!(m_ulFlags&PLF_INITIALIZED)) {
      plView = GetPlacement();
      _bDiscard3rdView = FALSE;
      return;
    }

    BOOL bSharpTurning = 
      (GetSettings()->ps_ulFlags&PSF_SHARPTURNING) &&
      _pNetwork->IsPlayerLocal((CPlayer*)GetPredictionTail());

    // lerp player viewpoint
    FLOAT fLerpFactor = _pTimer->GetLerpFactor();
    plView.Lerp(en_plLastViewpoint, en_plViewpoint, fLerpFactor);

    // moving banking and soft eyes
    ((CPlayerAnimator&)*m_penAnimator).ChangeView(plView);
    // body and head attachment animation
    ((CPlayerAnimator&)*m_penAnimator).BodyAndHeadOrientation(plView);

    // return player eyes view
    if (m_iViewState == PVT_PLAYEREYES || _bDiscard3rdView) {
      CPlacement3D plPosLerped = GetLerpedPlacement();
      if (bSharpTurning) {
        // get your prediction tail
        CPlayer *pen = (CPlayer*)GetPredictionTail();

        // add local rotation
        if (m_ulFlags & PLF_ISZOOMING) {
          FLOAT fRotationDamping = ((CPlayerWeapons &)*m_penWeapons).m_fSniperFOV / ((CPlayerWeapons &)*m_penWeapons).m_fSniperMaxFOV;
          plView.pl_OrientationAngle = pen->en_plViewpoint.pl_OrientationAngle + (pen->m_aLocalRotation - pen->m_aLastRotation)*fRotationDamping;
        } else {
          plView.pl_OrientationAngle = pen->en_plViewpoint.pl_OrientationAngle + (pen->m_aLocalRotation - pen->m_aLastRotation);
        }

        // [Cecil] Add recoil shake
        if (!(GetSettings()->ps_ulFlags & PSF_NOBOBBING)) {
          ANGLE3D aLastRecoil = m_aLastRecoilShake * m_fLastRecoilPower;
          ANGLE3D aRecoil = m_aRecoilShake * m_fRecoilPower;
          plView.pl_OrientationAngle(1) += Lerp(aLastRecoil(1), aRecoil(1), fLerpFactor);
          plView.pl_OrientationAngle(2) += Lerp(aLastRecoil(2), aRecoil(2), fLerpFactor);
          plView.pl_OrientationAngle(3) += Lerp(aLastRecoil(3), aRecoil(3), fLerpFactor);
        }

        // make sure it doesn't go out of limits
        RoundViewAngle(plView.pl_OrientationAngle(2), PITCH_MAX);
        RoundViewAngle(plView.pl_OrientationAngle(3), BANKING_MAX);

        // compensate for rotations that happen to the player without his/hers will
        // (rotating brushes, weird gravities...)
        // (these need to be lerped)
        ANGLE3D aCurr = pen->GetPlacement().pl_OrientationAngle;
        ANGLE3D aLast = pen->en_plLastPlacement.pl_OrientationAngle;
        ANGLE3D aDesired = pen->en_aDesiredRotationRelative*_pTimer->TickQuantum;
        FLOATmatrix3D mCurr;      MakeRotationMatrixFast(mCurr, aCurr);
        FLOATmatrix3D mLast;      MakeRotationMatrixFast(mLast, aLast);
        FLOATmatrix3D mDesired;   MakeRotationMatrixFast(mDesired, aDesired);
        mDesired = en_mRotation*(mDesired*!en_mRotation);
        FLOATmatrix3D mForced = !mDesired*mCurr*!mLast; // = aCurr-aLast-aDesired;
        ANGLE3D aForced; DecomposeRotationMatrixNoSnap(aForced, mForced);

        if (aForced.MaxNorm() < 1E-2) {
          aForced = ANGLE3D(0, 0, 0);
        }

        FLOATquat3D qForced; qForced.FromEuler(aForced);
        FLOATquat3D qZero;   qZero.FromEuler(ANGLE3D(0, 0, 0));
        FLOATquat3D qLerped = Slerp(fLerpFactor, qZero, qForced);
        FLOATmatrix3D m;
        qLerped.ToMatrix(m);
        m = m*mDesired*mLast;
        DecomposeRotationMatrixNoSnap(plPosLerped.pl_OrientationAngle, m);
      }

      plView.RelativeToAbsoluteSmooth(plPosLerped);

    // 3rd person view
    } else if (m_iViewState == PVT_3RDPERSONVIEW) {
      plView = m_pen3rdPersonView->GetLerpedPlacement();

    // camera view for player auto actions
    } else if (m_iViewState == PVT_PLAYERAUTOVIEW) {
      plView = m_penView->GetLerpedPlacement();

    // camera view for stored sequences
    } else {
      ASSERTALWAYS("Unknown player view");
    }

    _bDiscard3rdView=FALSE;
  };

  // Get current entity that the player views from.
  CEntity *GetViewEntity(void) {
    // player eyes
    if (m_iViewState == PVT_PLAYEREYES) {
      return this;
    // 3rd person view
    } else if (m_iViewState == PVT_3RDPERSONVIEW) {
      if (m_ulFlags & PLF_ISZOOMING) {
        return this;
      }
      if (((CPlayerView&)*m_pen3rdPersonView).m_fDistance > 2.0f) {
        return m_pen3rdPersonView;
      } else {
        return this;
      }
    // camera
    } else if (m_iViewState == PVT_PLAYERAUTOVIEW) {
      if (((CPlayerView&)*m_penView).m_fDistance > 2.0f) {
        return m_penView;
      } else {
        return this;
      }
    // invalid view
    } else {
      ASSERTALWAYS("Unknown player view");
      return NULL;
    }
  };

  void RenderChainsawParticles(BOOL bThird) {
    FLOAT fStretch = 1.0f;
    if (bThird) {
      fStretch = 0.4f;
    }

    // render chainsaw cutting brush particles
    FLOAT tmNow = _pTimer->GetLerpedCurrentTick();

    for (INDEX iSpray = 0; iSpray < MAX_BULLET_SPRAYS; iSpray++) {
      BulletSprayLaunchData &bsld = m_absldData[iSpray];
      FLOAT fLife = 1.25f;

      if (tmNow > (bsld.bsld_tmLaunch + fLife)) {
        continue;
      }

      Particles_BulletSpray(bsld.bsld_iRndBase, bsld.bsld_vPos, bsld.bsld_vG,
        bsld.bsld_eptType, bsld.bsld_tmLaunch, bsld.bsld_vStretch*fStretch, 1.0f);
    }

    // render chainsaw cutting model particles
    for (INDEX iGore = 0; iGore < MAX_GORE_SPRAYS; iGore++) {
      GoreSprayLaunchData &gsld = m_agsldData[iGore];
      FLOAT fLife = 2.0f;

      if (tmNow > (gsld.gsld_tmLaunch+fLife)) {
        continue;
      }

      FLOAT3D vPos = gsld.gsld_vPos;

      if (bThird) {
        vPos = gsld.gsld_v3rdPos;
      }

      Particles_BloodSpray(gsld.gsld_sptType, vPos, gsld.gsld_vG, gsld.gsld_fGA,
        gsld.gsld_boxHitted, gsld.gsld_vSpilDirection,
        gsld.gsld_tmLaunch, gsld.gsld_fDamagePower*fStretch, gsld.gsld_colParticles);
    }
  }

  // Draw player interface on screen.
  void RenderHUD( CPerspectiveProjection3D &prProjection, CDrawPort *pdp,
                  FLOAT3D vViewerLightDirection, COLOR colViewerLight, COLOR colViewerAmbient,
                  BOOL bRenderWeapon, INDEX iEye)
  {
    CPlacement3D plViewOld = prProjection.ViewerPlacementR();
    BOOL bSniping = ((CPlayerWeapons&)*m_penWeapons).m_iSniping > 0;
    // render weapon models if needed
    // do not render weapon if sniping
    BOOL bRenderModels = _pShell->GetINDEX("gfx_bRenderModels");

    // [Cecil] Change flares separately
    ((CPlayerWeapons&)*m_penWeapons).ControlFlareAttachment();

    if (hud_bShowWeapon && bRenderModels && !bSniping) {
      // render weapons only if view is from player eyes
      ((CPlayerWeapons&)*m_penWeapons).RenderWeaponModel(prProjection, pdp, vViewerLightDirection,
                                                         colViewerLight, colViewerAmbient, bRenderWeapon, iEye);
    }

    // if is first person
    if (m_iViewState == PVT_PLAYEREYES) {
      prProjection.ViewerPlacementL() = plViewOld;
      prProjection.Prepare();
      CAnyProjection3D apr;
      apr = prProjection;
      Stereo_AdjustProjection(*apr, iEye, 1);
      Particle_PrepareSystem(pdp, apr);
      Particle_PrepareEntity(2.0f, FALSE, FALSE, this);
      RenderChainsawParticles(FALSE);
      Particle_EndSystem();
    }

    // render crosshair if sniper zoom not active
    CPlacement3D plView;

    if (m_iViewState == PVT_PLAYEREYES) {
      // player view
      plView = en_plViewpoint;
      plView.RelativeToAbsolute(GetPlacement());
    } else if (m_iViewState == PVT_3RDPERSONVIEW) {
      // camera view
      plView = ((CPlayerView&)*m_pen3rdPersonView).GetPlacement();
    }

    if (!bSniping) {
      ((CPlayerWeapons&)*m_penWeapons).RenderCrosshair(prProjection, pdp, plView);
    }

    // get your prediction tail
    CPlayer *pen = (CPlayer*)GetPredictionTail();
    // do screen blending
    ULONG ulR = 255, ulG = 0, ulB = 0; // red for wounding
    ULONG ulA = pen->m_fDamageAmmount*5.0f;
    
    // if less than few seconds elapsed since last damage
    FLOAT tmSinceWounding = _pTimer->CurrentTick() - pen->m_tmWoundedTime;
    if (tmSinceWounding < 4.0f) {
      // decrease damage ammount
      if (tmSinceWounding < 0.001f) { ulA = (ulA+64)/2; }
    }

    // [Cecil] Red screen when dead
    if (!(GetFlags() & ENF_ALIVE)) {
      ulA = 127;
    }

    // add rest of blend ammount
    ulA = ClampUp(ulA, (ULONG)224);

    if (m_iViewState == PVT_PLAYEREYES) {
      pdp->dp_ulBlendingRA += ulR*ulA;
      pdp->dp_ulBlendingGA += ulG*ulA;
      pdp->dp_ulBlendingBA += ulB*ulA;
      pdp->dp_ulBlendingA  += ulA;

      // [Cecil] Gravity Gun launch glare
      const TIME tmGGFlare = (_pTimer->GetLerpedCurrentTick() - GetPlayerWeapons()->m_tmGGLaunch);

      if (!hl2_bReduceGravityGunFlash && GetPlayerWeapons()->m_iCurrentWeapon == WEAPON_GRAVITYGUN && tmGGFlare <= 0.5f) {
        const ULONG ulFlareA = NormFloatToByte(Clamp(0.5f - tmGGFlare * 4.0f, 0.0f, 0.5f));

        pdp->dp_ulBlendingRA += 0xFF * ulFlareA;
        pdp->dp_ulBlendingGA += 0xFF * ulFlareA;
        pdp->dp_ulBlendingBA += 0xFF * ulFlareA;
        pdp->dp_ulBlendingA  += ulFlareA;
      }
    }

    // add world glaring
    {
      COLOR colGlare = GetWorldGlaring();
      UBYTE ubR, ubG, ubB, ubA;
      ColorToRGBA(colGlare, ubR, ubG, ubB, ubA);

      if (ubA != 0) {
        pdp->dp_ulBlendingRA += ULONG(ubR)*ULONG(ubA);
        pdp->dp_ulBlendingGA += ULONG(ubG)*ULONG(ubA);
        pdp->dp_ulBlendingBA += ULONG(ubB)*ULONG(ubA);
        pdp->dp_ulBlendingA  += ULONG(ubA);
      }
    }

    // do all queued screen blendings
    pdp->BlendScreen();

    // render status info line (if needed)
    if (hud_bShowInfo) { 
      // get player or its predictor
      BOOL bSnooping = FALSE;
      CPlayer *penHUDPlayer = this;
      CPlayer *penHUDOwner  = this;

      if (penHUDPlayer->IsPredicted()) {
        penHUDPlayer = (CPlayer *)penHUDPlayer->GetPredictor();
      }

      // check if snooping is needed
      CPlayerWeapons *pen = (CPlayerWeapons*)&*penHUDPlayer->m_penWeapons;
      TIME tmDelta = _pTimer->CurrentTick() - pen->m_tmSnoopingStarted;
      if (tmDelta < plr_tmSnoopingTime) {
        ASSERT(pen->m_penTargeting!=NULL);
        penHUDPlayer = (CPlayer*)&*pen->m_penTargeting;
        bSnooping = TRUE;
      }
      DrawHUD(penHUDPlayer, pdp, bSnooping, penHUDOwner);
    }
  };

/************************************************************
 *                  SPECIAL FUNCTIONS                       *
 ************************************************************/
  // try to find start marker for deathmatch (re)spawning
  CEntity *GetDeathmatchStartMarker(void)
  {
    // get number of markers
    CTString strPlayerStart = "Player Start - ";
    INDEX ctMarkers = _pNetwork->GetNumberOfEntitiesWithName(strPlayerStart);
    // if none
    if (ctMarkers==0) {
      // fail
      return NULL;
    }
    // if only one
    if (ctMarkers==1) {
      // get that one
      return _pNetwork->GetEntityWithName(strPlayerStart, 0);
    }
    // if at least two markers found...

    // create tables of markers and their distances from players
    CStaticArray<MarkerDistance> amdMarkers;
    amdMarkers.New(ctMarkers);
    // for each marker
    {for(INDEX iMarker=0; iMarker<ctMarkers; iMarker++) {
      amdMarkers[iMarker].md_ppm = (CPlayerMarker*)_pNetwork->GetEntityWithName(strPlayerStart, iMarker);
      if (amdMarkers[iMarker].md_ppm==NULL) {
        return NULL;  // (if there is any invalidity, fail completely)
      }
      // get min distance from any player
      FLOAT fMinD = UpperLimit(0.0f);
      for (INDEX iPlayer=0; iPlayer<CEntity::GetMaxPlayers(); iPlayer++) {
        CPlayer *ppl = (CPlayer *)CEntity::GetPlayerEntity(iPlayer);
        if (ppl==NULL) { 
          continue;
        }
        FLOAT fD = 
          (amdMarkers[iMarker].md_ppm->GetPlacement().pl_PositionVector-
           ppl->GetPlacement().pl_PositionVector).Length();
        if (fD<fMinD) {
          fMinD = fD;
        }
      }
      amdMarkers[iMarker].md_fMinD = fMinD;
    }}

    // now sort the list
    qsort(&amdMarkers[0], ctMarkers, sizeof(amdMarkers[0]), &qsort_CompareMarkerDistance);
    ASSERT(amdMarkers[0].md_fMinD>=amdMarkers[ctMarkers-1].md_fMinD);
    // choose marker among one of the 50% farthest
    INDEX ctFarMarkers = ctMarkers/2;
    ASSERT(ctFarMarkers>0);
    INDEX iStartMarker = IRnd()%ctFarMarkers;
    // find first next marker that was not used lately
    INDEX iMarker=iStartMarker;
    FOREVER{
      if (_pTimer->CurrentTick()>amdMarkers[iMarker].md_ppm->m_tmLastSpawned+1.0f) {
        break;
      }
      iMarker = (iMarker+1)%ctMarkers;
      if (iMarker==iStartMarker) {
        break;
      }
    }
    // return that
    return amdMarkers[iMarker].md_ppm;
  }

/************************************************************
 *                  INITIALIZE PLAYER                       *
 ************************************************************/

  void InitializePlayer() {
    // set viewpoint position inside the entity
    en_plViewpoint.pl_OrientationAngle = ANGLE3D(0.0f, 0.0f, 0.0f);
    en_plViewpoint.pl_PositionVector = FLOAT3D(0.0f, plr_fViewHeightStand, 0.0f);
    en_plLastViewpoint = en_plViewpoint;

    // clear properties
    m_ulFlags &= PLF_INITIALIZED|PLF_LEVELSTARTED|PLF_RESPAWNINPLACE;  // must not clear initialized flag
    m_fFallTime = 0.0f;
    m_pstState = PST_STAND;
    m_fDamageAmmount = 0.0f;
    m_tmWoundedTime  = 0.0f;
    m_tmInvisibility    = 0.0f;
    m_tmInvulnerability = 0.0f;
    m_tmSeriousDamage   = 0.0f;
    m_tmSeriousSpeed    = 0.0f;

    // [Cecil]
    m_fSpeedLimit = 0.0f;
    m_tmAirTime = 0.0f;
    m_bFakeJump = FALSE;
    m_fViewHeight = plr_fViewHeightStand;

    m_aRecoilShake = ANGLE3D(0.0f, 0.0f, 0.0f);
    m_aLastRecoilShake = ANGLE3D(0.0f, 0.0f, 0.0f);
    m_fRecoilPower = 0.0f;
    m_fLastRecoilPower = 0.0f;
    m_aCameraShake = ANGLE3D(0.0f, 0.0f, 0.0f);
    m_aLastCameraShake = ANGLE3D(0.0f, 0.0f, 0.0f);
    ResetSuitZoom();

    m_soMouth.Stop();

    if (m_soLocalAmbientLoop.IsPlaying()) {
      m_soLocalAmbientLoop.Stop();
    }

    m_soSuit.Stop();
    m_soSuitMusic.Stop();

    // initialize animator
    ((CPlayerAnimator&)*m_penAnimator).Initialize();
    // restart weapons if needed
    GetPlayerWeapons()->SendEvent(EStart());

    // [Cecil] Reset weapon animation
    GetPlayerWeapons()->PlayDefaultAnim();

    // initialise last positions for particles
    Particles_AfterBurner_Prepare(this);

    // set flags
    SetPhysics(PPH_INIT, TRUE, TRUE); // [Cecil]
    SetFlags(GetFlags()|ENF_ALIVE);

    // animation
    StartModelAnim(PLAYER_ANIM_STAND, AOF_LOOPING);
    TeleportPlayer(WLT_FIXED, FALSE);
  };


  FLOAT3D GetTeleportingOffset(void) {
    // find player index
    INDEX iPlayer = GetMyPlayerIndex();

    // create offset from marker
    const FLOAT fOffsetY = 0.1f;  // how much to offset up (as precaution not to spawn in floor)
    FLOAT3D vOffsetRel = FLOAT3D(0,fOffsetY,0);
    if (GetSP()->sp_bCooperative && !GetSP()->sp_bSinglePlayer) {
      INDEX iRow = iPlayer/4;
      INDEX iCol = iPlayer%4;
      vOffsetRel = FLOAT3D(-3.0f+iCol*2.0f, fOffsetY, -3.0f+iRow*2.0f);
    }

    return vOffsetRel;
  };

  void RemapLevelNames(INDEX &iLevel) {
	  switch(iLevel) {
      case 10: iLevel = 1; break;
      case 11: iLevel = 2; break;
	    case 12: iLevel = 3; break;
	    case 13: iLevel = 4; break;
	    case 14: iLevel = 5; break;
	    case 15: iLevel = 6; break;
	    case 21: iLevel = 7; break;
	    case 22: iLevel = 8; break;
	    case 23: iLevel = 9; break;
	    case 24: iLevel = 10; break;
	    case 31: iLevel = 11; break;
	    case 32: iLevel = 12; break;
	    case 33: iLevel = 13; break;
	    default: iLevel = -1; break;
	  }
  };
  
  // [Cecil] World change flag
  void TeleportPlayer(enum WorldLinkType EwltType, BOOL bWorldChange) {
    INDEX iLevel = -1;
    CTString strLevelName = GetWorld()->wo_fnmFileName.FileName();
    
    //strLevelName.ScanF("%02d_", &iLevel);
    INDEX u, v;
    u = v = -1;
    strLevelName.ScanF("%01d_%01d_", &u, &v);
    iLevel = u*10+v;
    
	  RemapLevelNames(iLevel);
            
    if (iLevel>0) {
      ((CSessionProperties*)GetSP())->sp_ulLevelsMask |= 1 << (iLevel-1);
    }

    // find player index
    INDEX iPlayer = GetMyPlayerIndex();
    // player placement
    CPlacement3D plSet = GetPlacement();
    // teleport in dummy space to avoid auto teleport frag
    PlacePlayer(CPlacement3D(FLOAT3D(32000.0f+100.0f*iPlayer, 32000.0f, 0), ANGLE3D(0, 0, 0)));
    // force yourself to standing state
    ForceCollisionBoxIndexChange(PLAYER_COLLISION_BOX_STAND);
    en_plViewpoint.pl_PositionVector(2) = plr_fViewHeightStand;

    // [Cecil]
    m_fViewHeight = plr_fViewHeightStand;

    ((CPlayerAnimator&)*m_penAnimator).m_bDisableAnimating = FALSE;
    ((CPlayerAnimator&)*m_penAnimator).Stand();
    m_pstState = PST_STAND;

    // create offset from marker
    FLOAT3D vOffsetRel = GetTeleportingOffset();

    // no player start initially
    BOOL bSetHealth = FALSE;      // for getting health from marker
    BOOL bAdjustHealth = FALSE;   // for getting adjusting health to 50-100 interval
    CEntity *pen = NULL;
    if (GetSP()->sp_bCooperative) {
      if (cht_iGoToMarker>=0) {
        // try to find fast go marker
        CTString strPlayerStart;
        strPlayerStart.PrintF("Player Start - %d", (INDEX)cht_iGoToMarker);
        pen = _pNetwork->GetEntityWithName(strPlayerStart, 0);
        pen->SendEvent(ETrigger());
        cht_iGoToMarker = -1;
        bSetHealth = TRUE;
        bAdjustHealth = FALSE;
      // if there is coop respawn marker
      } else if (m_penMainMusicHolder!=NULL && !(m_ulFlags&PLF_CHANGINGLEVEL)) {
        CMusicHolder *pmh = (CMusicHolder *)&*m_penMainMusicHolder;
        if (pmh->m_penRespawnMarker != NULL) {
          // get it
          pen = pmh->m_penRespawnMarker;
          bSetHealth = TRUE;
          bAdjustHealth = FALSE;
        }
      }

      // if quick start is enabled (in wed)
      if (pen==NULL && GetSP()->sp_bQuickTest && m_strGroup=="") {
        // try to find quick start marker
        CTString strPlayerStart;
        strPlayerStart.PrintF("Player Quick Start");
        pen = _pNetwork->GetEntityWithName(strPlayerStart, 0);
        bSetHealth = TRUE;
        bAdjustHealth = FALSE;
      }
      // if no start position yet
      if (pen==NULL) {
        // try to find normal start marker
        CTString strPlayerStart;
        strPlayerStart.PrintF("Player Start - %s", m_strGroup);
        pen = _pNetwork->GetEntityWithName(strPlayerStart, 0);
        if (m_strGroup=="") {
          bSetHealth = TRUE;
          bAdjustHealth = FALSE;
        } else {
          if (EwltType==WLT_FIXED) {
            bSetHealth = FALSE;
            bAdjustHealth = TRUE;
          } else {
            bSetHealth = FALSE;
            bAdjustHealth = FALSE;
          }
        }
      }
      // if no start position yet
      if (pen==NULL) {
        // try to find normal start marker without group anyway
        CTString strPlayerStart;
        strPlayerStart.PrintF("Player Start - ");
        pen = _pNetwork->GetEntityWithName(strPlayerStart, 0);
        bSetHealth = TRUE;
        bAdjustHealth = FALSE;
      }
    } else {
      bSetHealth = TRUE;
      bAdjustHealth = FALSE;
      // try to find start marker by random
      pen = GetDeathmatchStartMarker();
      if (pen!=NULL) {
        ((CPlayerMarker&)*pen).m_tmLastSpawned = _pTimer->CurrentTick();
      }
    }

    // if respawning in place
    if ((m_ulFlags&PLF_RESPAWNINPLACE) && pen != NULL && !((CPlayerMarker*)&*pen)->m_bNoRespawnInPlace) {
      m_ulFlags &= ~PLF_RESPAWNINPLACE;
      // set default params
      SetHealth(TopHealth());
      m_iMana  = GetSP()->sp_iInitialMana;
      m_fArmor = 0.0f;
      // teleport where you were when you were killed
      PlacePlayer(CPlacement3D(m_vDied, m_aDied));

    // if start marker is found
    } else if (pen != NULL) {
      // if there is no respawn marker yet
      if (m_penMainMusicHolder!=NULL) {
        CMusicHolder *pmh = (CMusicHolder *)&*m_penMainMusicHolder;
        if (pmh->m_penRespawnMarker == NULL) {
          // set it
          pmh->m_penRespawnMarker = pen;
        }
      }

      CPlayerMarker &CpmStart = (CPlayerMarker&)*pen;
      // set player characteristics
      if (bSetHealth) {
        SetHealth(CpmStart.m_fHealth/100.0f*TopHealth());
        m_iMana  = GetSP()->sp_iInitialMana;
        m_fArmor = CpmStart.m_fShield;

        // [Cecil] Set HEV suit
        m_bHEVSuit = CpmStart.m_bHEVSuit;

      } else if (bAdjustHealth) {
        FLOAT fHealth = GetHealth();
        FLOAT fTopHealth = TopHealth();

        if (fHealth < fTopHealth) {
          SetHealth(ClampUp(fHealth+fTopHealth/2.0f, fTopHealth));
        }
      }

      // if should start in computer
      if (CpmStart.m_bStartInComputer && GetSP()->sp_bSinglePlayer) {
        // mark that
        if (_pNetwork->IsPlayerLocal(this)) {
          cmp_ppenPlayer = this;
        }
        cmp_bInitialStart = TRUE;
      }

      // start with first message linked to the marker
      CMessageHolder *penMessage = (CMessageHolder *)&*CpmStart.m_penMessage;
      // while there are some messages to add
      while (penMessage!=NULL && IsOfClass(penMessage, "MessageHolder")) {
        const CTFileName &fnmMessage = penMessage->m_fnmMessage;
        // if player doesn't have that message in database
        if (!HasMessage(fnmMessage)) {
          // add the message
          ReceiveComputerMessage(fnmMessage, 0);
        }
        // go to next message holder in list
        penMessage = (CMessageHolder *)&*penMessage->m_penNext;
      }

      // set weapons
      if (!GetSP()->sp_bCooperative) {
        ((CPlayerWeapons&)*m_penWeapons).InitializeWeapons(CpmStart.m_iGiveWeapons, 0, 0,
          CpmStart.m_fMaxAmmoRatio, bWorldChange);
      } else {
        ((CPlayerWeapons&)*m_penWeapons).InitializeWeapons(CpmStart.m_iGiveWeapons, CpmStart.m_iTakeWeapons,
          GetSP()->sp_bInfiniteAmmo?0:CpmStart.m_iTakeAmmo, CpmStart.m_fMaxAmmoRatio, bWorldChange);
      }

      // start position relative to link
      if (EwltType == WLT_RELATIVE) {
        plSet.AbsoluteToRelative(_SwcWorldChange.plLink);   // relative to link position
        plSet.RelativeToAbsolute(CpmStart.GetPlacement());  // absolute to start marker position
        PlacePlayer(plSet);
      // fixed start position
      } else if (EwltType == WLT_FIXED) {
        CPlacement3D plNew = CpmStart.GetPlacement();
        vOffsetRel*=CpmStart.en_mRotation;
        plNew.pl_PositionVector += vOffsetRel;
        PlacePlayer(plNew);
      // error -> teleport to zero
      } else {
        ASSERTALWAYS("Unknown world link type");
        PlacePlayer(CPlacement3D(FLOAT3D(0, 0, 0)+vOffsetRel, ANGLE3D(0, 0, 0)));
      }
      // if there is a start trigger target
      if (CpmStart.m_penTarget != NULL) {
        SendToTarget(CpmStart.m_penTarget, EET_TRIGGER, this);
      }

    // default start position
    } else {
      // set player characteristics
      SetHealth(TopHealth());
      m_iMana = GetSP()->sp_iInitialMana;
      m_fArmor = 0.0f;

      // set weapons
      ((CPlayerWeapons&)*m_penWeapons).InitializeWeapons(0, 0, 0, 0, TRUE);
      // start position
      PlacePlayer(CPlacement3D(FLOAT3D(0, 0, 0)+vOffsetRel, ANGLE3D(0, 0, 0)));
    }
    // send teleport event to all entities in range
    SendEventInRange(ETeleport(), FLOATaabbox3D(GetPlacement().pl_PositionVector, 200.0f));
    // stop moving
    ForceFullStop();

    // remember maximum health
    m_fMaxHealth = TopHealth();

    // if in singleplayer mode
    if (GetSP()->sp_bSinglePlayer && GetSP()->sp_gmGameMode != CSessionProperties::GM_FLYOVER) {
      CWorldSettingsController *pwsc = GetWSC(this);
      if (pwsc != NULL && pwsc->m_bNoSaveGame) {
        NOTHING;
      } else {
        // [Cecil] Revive
        if (!cht_bRevive) {
          // save quick savegame
          _pShell->Execute("gam_bQuickSave=1;");
        }
      }
    }
    // remember level start time
    if (!(m_ulFlags&PLF_LEVELSTARTED)) {
      m_ulFlags |= PLF_LEVELSTARTED;
      m_tmLevelStarted = _pNetwork->GetGameTime();
    }
    // reset model appearance
    CTString strDummy;
    SetPlayerAppearance(GetModelObject(), NULL, strDummy, /*bPreview=*/FALSE);
    ValidateCharacter();
    SetPlayerAppearance(&m_moRender, &en_pcCharacter, strDummy, /*bPreview=*/FALSE);
    ParseGender(strDummy);
    GetPlayerAnimator()->SetWeapon();
    m_ulFlags |= PLF_SYNCWEAPON;

    // spawn teleport effect
    SpawnTeleport();
    // return from editor model (if was fragged into pieces)
    SwitchToModel();
    m_tmSpawned = _pTimer->CurrentTick();

    en_tmLastBreathed = _pTimer->CurrentTick()+0.1f;  // do not take breath when spawned in air
  };

  // note: set estimated time in advance
  void RecordEndOfLevelData(void)
  {
    // must not be called multiple times
    ASSERT(!m_bEndOfLevel);
    // clear analyses message
    m_tmAnalyseEnd = 0;
    m_bPendingMessage = FALSE;
    m_tmMessagePlay = 0;
    // mark end of level
    m_iMayRespawn = 0;
    m_bEndOfLevel = TRUE;
    // remember end time
    time_t tmEnd;
    time(&tmEnd);
    m_iEndTime = tmEnd;
    // add time score
    TIME tmLevelTime = _pTimer->CurrentTick()-m_tmLevelStarted;
    m_psLevelStats.ps_tmTime = tmLevelTime;
    m_psGameStats.ps_tmTime += tmLevelTime;
    FLOAT fTimeDelta = ClampDn(FLOAT(floor(m_tmEstTime)-floor(tmLevelTime)), 0.0f);
    m_iTimeScore = floor(fTimeDelta*100.0f);
    m_psLevelStats.ps_iScore+=m_iTimeScore;
    m_psGameStats.ps_iScore+=m_iTimeScore;

    // record stats for this level and add to global table
    CTString strStats;
    strStats.PrintF(TRANS("%s\n  Time:   %s\n  Score: %9d\n  Kills:   %03d/%03d\n  Secrets:   %02d/%02d\n"), 
        TranslateConst(en_pwoWorld->GetName(), 0), TimeToString(tmLevelTime), 
        m_psLevelStats.ps_iScore,
        m_psLevelStats.ps_iKills, m_psLevelTotal.ps_iKills,
        m_psLevelStats.ps_iSecrets, m_psLevelTotal.ps_iSecrets);
    m_strLevelStats += strStats;
  }

  // spawn teleport effect
  void SpawnTeleport(void)
  {
    // if in singleplayer
    if (GetSP()->sp_bSinglePlayer) {
      // no spawn effects
      return;
    }
    ESpawnEffect ese;
    ese.colMuliplier = C_WHITE|CT_OPAQUE;
    ese.betType = BET_TELEPORT;
    ese.vNormal = FLOAT3D(0,1,0);
    FLOATaabbox3D box;
    GetBoundingBox(box);
    FLOAT fEntitySize = box.Size().MaxNorm()*2;
    ese.vStretch = FLOAT3D(fEntitySize, fEntitySize, fEntitySize);
    CEntityPointer penEffect = CreateEntity(GetPlacement(), CLASS_BASIC_EFFECT);
    penEffect->Initialize(ese);
  }

  // render particles
  void RenderParticles(void) {
    FLOAT tmNow = _pTimer->GetLerpedCurrentTick();

    // [Cecil] TEMP: Render collision grid cells around the player
    if (ode_iCollisionGrid != 0 && _pNetwork->IsPlayerLocal(this)) {
      FLOAT3D vPlayer = GetLerpedPlacement().pl_PositionVector;

      if (ode_iCollisionGrid == 1) {
        vPlayer(2) = 0.5f; // At a consistent plane half a meter above 0
      } else {
        vPlayer(2) += 0.25f; // At the player's legs
      }

      Particles_CollisionGridCells(FLOATaabbox3D(vPlayer - FLOAT3D(128, 0, 128), vPlayer + FLOAT3D(128, 128, 128)));
    }

    // render empty shells
    Particles_EmptyShells( this, m_asldData);

    if (Particle_GetViewer() == this) {
      Particles_ViewerLocal(this);

    } else {
      // if is not first person
      RenderChainsawParticles(TRUE);

      // glowing powerups
      if (GetFlags()&ENF_ALIVE){
        if (m_tmSeriousDamage > tmNow && m_tmInvulnerability > tmNow) {
          Particles_ModelGlow(this, Max(m_tmSeriousDamage,m_tmInvulnerability),PT_STAR08, 0.15f, 2, 0.03f, 0xff00ff00);
        } else if (m_tmInvulnerability > tmNow) {
          Particles_ModelGlow(this, m_tmInvulnerability, PT_STAR05, 0.15f, 2, 0.03f, 0x3333ff00);
        } else if (m_tmSeriousDamage > tmNow) {
          Particles_ModelGlow(this, m_tmSeriousDamage, PT_STAR08, 0.15f, 2, 0.03f, 0xff777700);
        }

        if (m_tmSeriousSpeed>tmNow) {
          Particles_RunAfterBurner(this, m_tmSeriousSpeed, 0.3f, 0);
        }

        if (!GetSP()->sp_bCooperative) {
          CPlayerWeapons *wpn = GetPlayerWeapons();
          if (wpn->m_tmLastSniperFire == _pTimer->CurrentTick())
          {
            CAttachmentModelObject &amoBody = *GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO);
            FLOATmatrix3D m;
            MakeRotationMatrix(m, amoBody.amo_plRelative.pl_OrientationAngle);
            FLOAT3D vSource = wpn->m_vBulletSource + FLOAT3D(0.0f, 0.1f, -0.4f)*GetRotationMatrix()*m;
            Particles_SniperResidue(this, vSource , wpn->m_vBulletTarget);
          }
        }
      }
    }

    // [Cecil] Gravity Gun charge
    if (m_penWeapons != NULL) {
      CPlayerWeapons &enGG = *GetPlayerWeapons();
      const TIME tmGGFlare = (enGG.m_tmLaunchEffect - _pTimer->GetLerpedCurrentTick());

      if (enGG.m_iCurrentWeapon == WEAPON_GRAVITYGUN && tmGGFlare > 0.0f) {
        FLOAT3D vSource = GetLerpedPlacement().pl_PositionVector;

        // Third-person view
        if (Particle_GetViewer() != this) {
          FLOATmatrix3D mPlayerRot, mViewRot;
          MakeRotationMatrix(mPlayerRot, GetLerpedPlacement().pl_OrientationAngle);

          MakeRotationMatrix(mViewRot, Lerp(en_plLastViewpoint.pl_OrientationAngle, en_plViewpoint.pl_OrientationAngle, _pTimer->GetLerpFactor()));
          mViewRot = mPlayerRot * mViewRot;

          // Add body position
          CModelObject *pmo = GetModelForRendering();
          CAttachmentModelObject *pamo = pmo->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO);

          if (pamo != NULL) {
            CPlacement3D plAttach = GetAttachmentPlacement(pmo, *pamo);
            vSource += plAttach.pl_PositionVector * mPlayerRot;

            // Add item position
            pmo = &pamo->amo_moModelObject;
            pamo = pmo->GetAttachmentModel(BODY_ATTACHMENT_TOMMYGUN);

            if (pamo != NULL) {
              plAttach = GetAttachmentPlacement(pmo, *pamo);
              vSource += (plAttach.pl_PositionVector + FLOAT3D(0.0f, 0.3f, -0.4f)) * mViewRot;

              Particles_GravityGunCharge(vSource, enGG.m_vGGHitPos);
            }
          }
        }
      }

      // Hit particles
      Particles_BulletSpray(en_ulID, enGG.m_vGGHitPos, en_vGravityDir, EPT_BULLET_METAL, enGG.m_tmGGLaunch, -enGG.m_vGGHitDir, 2.0f);
    }

    // spirit particles
    if (m_tmSpiritStart != 0.0f) {
      Particles_Appearing(this, m_tmSpiritStart);
    }
  };

  void TeleportToAutoMarker(CPlayerActionMarker *ppam) {
    // if we are in coop
    if (GetSP()->sp_bCooperative && !GetSP()->sp_bSinglePlayer) {
      // for each player
      for(INDEX iPlayer=0; iPlayer<CEntity::GetMaxPlayers(); iPlayer++) {
        CPlayer *ppl = (CPlayer *)CEntity::GetPlayerEntity(iPlayer);
        if (ppl!=NULL) {
          // put it at marker
          CPlacement3D pl = ppam->GetPlacement();
          FLOAT3D vOffsetRel = ppl->GetTeleportingOffset();
          pl.pl_PositionVector += vOffsetRel*ppam->en_mRotation;
          ppl->PlacePlayer(pl, FALSE);
          // remember new respawn place
          ppl->m_vDied = pl.pl_PositionVector;
          ppl->m_aDied = pl.pl_OrientationAngle;
        }
      }

    // otherwise
    } else {
      // put yourself at marker
      CPlacement3D pl = ppam->GetPlacement();
      FLOAT3D vOffsetRel = GetTeleportingOffset();
      pl.pl_PositionVector += vOffsetRel*ppam->en_mRotation;
      PlacePlayer(pl, FALSE);
    }
  }

  // check whether this time we respawn in place or on marker
  void CheckDeathForRespawnInPlace(EDeath eDeath) {
    // if respawning in place is not allowed
    if (!GetSP()->sp_bRespawnInPlace) {
      // skip further checks
      return;
    }

    // if killed by a player or enemy
    CEntity *penKiller = eDeath.eLastDamage.penInflictor;
    if (IS_PLAYER(penKiller) || IsDerivedFromClass(penKiller, "Enemy Base")) {
      // mark for respawning in place
      m_ulFlags |= PLF_RESPAWNINPLACE;
      m_vDied = GetPlacement().pl_PositionVector;
      m_aDied = GetPlacement().pl_OrientationAngle;
    }
  }

procedures:
/************************************************************
 *                       WOUNDED                            *
 ************************************************************/
  Wounded(EDamage eDamage) {
    return;
  };


/************************************************************
 *                     WORLD CHANGE                         *
 ************************************************************/
  WorldChange() {
    // if in single player
    if (GetSP()->sp_bSinglePlayer) {
      // mark world as visited
      CTString strDummy("1");
      SaveStringVar(GetWorld()->wo_fnmFileName.NoExt()+".vis", strDummy);
    }

    // find music holder on new world
    FindMusicHolder();
    // store group name
    m_strGroup = _SwcWorldChange.strGroup;
    TeleportPlayer((WorldLinkType)_SwcWorldChange.iType, TRUE);
    // setup light source
    SetupLightSource();

    // make sure we discontinue zooming
    CPlayerWeapons *penWeapon = GetPlayerWeapons();
    penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV = penWeapon->m_fSniperMaxFOV;      
    penWeapon->m_iSniping = 0;
    penWeapon->m_iRestoreZoom = 0;
    m_ulFlags &= ~PLF_ISZOOMING;
	
    // update per-level stats
    UpdateLevelStats();
    m_ulFlags |= PLF_INITIALIZED;
    m_ulFlags &= ~PLF_CHANGINGLEVEL;
    return;
  };

  WorldChangeDead() {
    // forbid respawning in-place when changing levels while dead
    m_ulFlags &= ~PLF_RESPAWNINPLACE;

    // if in single player
    if (GetSP()->sp_bSinglePlayer) {
      // mark world as visited
      CTString strDummy("1");
      SaveStringVar(GetWorld()->wo_fnmFileName.NoExt()+".vis", strDummy);
    }

    // find music holder on new world
    FindMusicHolder();
    // store group name

    autocall Rebirth() EReturn;

    // setup light source
    SetupLightSource();

    // update per-level stats
    UpdateLevelStats();
    m_ulFlags |= PLF_INITIALIZED;
    m_ulFlags &= ~PLF_CHANGINGLEVEL;
    return;
  };

/************************************************************
 *                       D E A T H                          *
 ************************************************************/

  Death(EDeath eDeath) {
    // stop firing when dead
    ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReleaseWeapon());
    // [Cecil] Interrupt the weapon
    ((CPlayerWeapons&)*m_penWeapons).SendEvent(EInterrupt());
    
    // make sure sniper zoom is stopped 
    CPlayerWeapons *penWeapon = GetPlayerWeapons();
    m_ulFlags &= ~PLF_ISZOOMING;
    penWeapon->m_iSniping = 0;
    penWeapon->m_iRestoreZoom = 0;

    penWeapon->m_fSniperFOVlast = penWeapon->m_fSniperFOV = penWeapon->m_fSniperMaxFOV;
    
    // stop weapon sounds
    PlaySound(m_soSniperZoom, SOUND_SILENCE, SOF_3D);

    // [Cecil] Reset zoom
    ResetSuitZoom();

    // if in single player, or if this is a predictor entity
    //if (GetSP()->sp_bSinglePlayer || IsPredictor()) {
      // do not print anything
      //NOTHING;

    // [Cecil]
    if (IsPredictor()) {
      NOTHING;

    } else if (GetSP()->sp_bSinglePlayer) {
      if (CheatsEnabled() && cht_bRevive) {
        // if killed by a player or enemy
        CEntity *penKiller = eDeath.eLastDamage.penInflictor;
        if (IS_PLAYER(penKiller) || IsDerivedFromClass(penKiller, "Enemy Base")) {
          // mark for respawning in place
          m_ulFlags |= PLF_RESPAWNINPLACE;
          m_vDied = GetPlacement().pl_PositionVector;
          m_aDied = GetPlacement().pl_OrientationAngle;
        }
      }

    // if in cooperative, but not single player
    } else if (GetSP()->sp_bCooperative) {
      // just print death message, no score updating
      PrintPlayerDeathMessage(this, eDeath);
      // check whether this time we respawn in place or on marker
      CheckDeathForRespawnInPlace(eDeath);
      // increase number of deaths
      m_psLevelStats.ps_iDeaths += 1;
      m_psGameStats.ps_iDeaths += 1;
    // if not in cooperative, and not single player
    } else {
      // print death message
      PrintPlayerDeathMessage(this, eDeath);
      // get the killer pointer
      CEntity *penKiller = eDeath.eLastDamage.penInflictor;
      // initially, not killed by a player
      CPlayer *pplKillerPlayer = NULL;

      // [Cecil] Gamemode-specific
      INDEX iMode = GetSP()->sp_iHLGamemode;
      BOOL bModeActive = FALSE;
      if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
        switch (iMode) {
          case HLGM_ARMSRACE:
            bModeActive = TRUE;
            break;
        }
      }

      // if killed by some entity
      if (penKiller != NULL) {
        // if killed by player
        if (IS_PLAYER(penKiller)) {
          // if someone other then you
          if (penKiller != this) {
            pplKillerPlayer = (CPlayer*)penKiller;
            EReceiveScore eScore;
            eScore.iPoints = m_iMana;
            eDeath.eLastDamage.penInflictor->SendEvent(eScore);

            // [Cecil] Who was killed
            EKilledEnemy eKilled;
            eKilled.penKilled = this;
            eDeath.eLastDamage.penInflictor->SendEvent(eKilled);
          // if it was yourself
          } else {
            m_psLevelStats.ps_iScore -= m_iMana;
            m_psGameStats.ps_iScore -= m_iMana;

            // [Cecil]
            if (!bModeActive) {
              m_psLevelStats.ps_iKills -= 1;
              m_psGameStats.ps_iKills -= 1;
            }
          }
        // if killed by non-player
        } else {
          m_psLevelStats.ps_iScore -= m_iMana;
          m_psGameStats.ps_iScore -= m_iMana;

          // [Cecil]
          if (!bModeActive) {
            m_psLevelStats.ps_iKills -= 1;
            m_psGameStats.ps_iKills -= 1;
          }
        }
      // if killed by NULL (shouldn't happen, but anyway)
      } else {
        m_psLevelStats.ps_iScore -= m_iMana;
        m_psGameStats.ps_iScore -= m_iMana;

        // [Cecil]
        if (!bModeActive) {
          m_psLevelStats.ps_iKills -= 1;
          m_psGameStats.ps_iKills -= 1;
        }
      }

      // if playing scorematch
      if (!GetSP()->sp_bUseFrags) {
        // if killed by a player
        if (pplKillerPlayer != NULL) {
          // print how much that player gained
          CPrintF(TRANS("  %s: +%d points\n"), pplKillerPlayer->GetPlayerName(), m_iMana);
        // if it was a suicide, or an accident
        } else {
          // print how much you lost
          CPrintF(TRANS("  %s: -%d points\n"), GetPlayerName(), m_iMana);
        }
      }

      // increase number of deaths
      m_psLevelStats.ps_iDeaths += 1;
      m_psGameStats.ps_iDeaths += 1;
    }

    // store last view
    m_iLastViewState = m_iViewState;

    // mark player as death
    SetFlags(GetFlags()&~ENF_ALIVE);
    // stop player
    PlayerMove(FLOAT3D(0.0f, 0.0f, 0.0f));
    PlayerRotate(ANGLE3D(0.0f, 0.0f, 0.0f));

    // remove weapon from hand
    ((CPlayerAnimator&)*m_penAnimator).RemoveWeapon();
    // kill weapon animations
    GetPlayerWeapons()->SendEvent(EStop());

    // [Cecil] Stop holding objects
    GetPlayerWeapons()->ResetPicking();
    GetPlayerWeapons()->StopHolding(TRUE);

    // if in deathmatch
    if (!GetSP()->sp_bCooperative) {
      // drop current weapon as item so others can pick it
      GetPlayerWeapons()->DropWeapon();
    }

    // play death
    INDEX iAnim1;
    INDEX iAnim2;
    if (m_pstState == PST_SWIM || m_pstState == PST_DIVE) {
      iAnim1 = PLAYER_ANIM_DEATH_UNDERWATER;
      iAnim2 = BODY_ANIM_DEATH_UNDERWATER;
    } else if (eDeath.eLastDamage.dmtType==DMT_SPIKESTAB) {
      iAnim1 = PLAYER_ANIM_DEATH_SPIKES;
      iAnim2 = BODY_ANIM_DEATH_SPIKES;
    } else if (eDeath.eLastDamage.dmtType == DMT_ABYSS) {
      iAnim1 = PLAYER_ANIM_ABYSSFALL;
      iAnim2 = BODY_ANIM_ABYSSFALL;
    } else {
      FLOAT3D vFront;
      GetHeadingDirection(0, vFront);
      FLOAT fDamageDir = m_vDamage%vFront;
      if (fDamageDir<0) {
        if (Abs(fDamageDir)<10.0f) {
          iAnim1 = PLAYER_ANIM_DEATH_EASYFALLBACK;
          iAnim2 = BODY_ANIM_DEATH_EASYFALLBACK;
        } else {
          iAnim1 = PLAYER_ANIM_DEATH_BACK;
          iAnim2 = BODY_ANIM_DEATH_BACK;
        }
      } else {
        if (Abs(fDamageDir)<10.0f) {
          iAnim1 = PLAYER_ANIM_DEATH_EASYFALLFORWARD;
          iAnim2 = BODY_ANIM_DEATH_EASYFALLFORWARD;
        } else {
          iAnim1 = PLAYER_ANIM_DEATH_FORWARD;
          iAnim2 = BODY_ANIM_DEATH_FORWARD;
        }
      }
    }

    //en_plViewpoint.pl_OrientationAngle = ANGLE3D(0.0f, 0.0f, 0.0f);
    StartModelAnim(iAnim1, 0);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(iAnim2, 0);

    SetPhysics(PPH_DEAD, TRUE, TRUE); // [Cecil]

    // set density to float out of water
    en_fDensity = 400.0f;

    // play sound
    SetDefaultMouthPitch();
    PlaySound(m_soMouth, SOUND_FLATLINE, SOF_3D);

    // initialize death camera view
    ASSERT(m_penView == NULL);

    // [Cecil] Only for DMT_ABYSS
    m_iLastDamage = eDeath.eLastDamage.dmtType;
    if (m_penView == NULL && m_iLastDamage == DMT_ABYSS) {
      m_penView = CreateEntity(GetPlacement(), CLASS_PLAYER_VIEW);
      EViewInit eInit;
      eInit.penOwner = this;
      eInit.penCamera = NULL;
      eInit.vtView = VT_PLAYERDEATH;
      eInit.bDeathFixed = TRUE; //eDeath.eLastDamage.dmtType == DMT_ABYSS;
      m_penView->Initialize(eInit);
    }
                     
    if (ShouldBlowUp()) {
      BlowUp();
    } else {
      // leave a stain beneath
      LeaveStain(TRUE);
    }

    m_iMayRespawn = 0;
    // wait for anim of death
    wait (1.2f) {
      on (EBegin) : {
        // [Cecil] Only for DMT_ABYSS
        // set new view status
        if (m_iLastDamage == DMT_ABYSS) {
          m_iViewState = PVT_PLAYERAUTOVIEW;
        } else {
          m_iViewState = PVT_PLAYEREYES;
        }
        resume;
      }
      // when anim is finished
      on (ETimer) : {
        // allow respawning
        m_iMayRespawn = 1;
        resume;
      }
      // when damaged
      on (EDamage eDamage) : { 
        if (eDamage.dmtType == DMT_ABYSS) {
          if (m_penView != NULL) {
            ((CPlayerView*)&*m_penView)->m_bFixed = TRUE;
          }
        }
        // if should blow up now (and not already blown up)
        if (ShouldBlowUp()) {
          // do it
          BlowUp();
        }
        resume; 
      }
      on (EDeath) : { resume; }
      // if player pressed fire
      on (EEnd) : { 
        // NOTE: predictors must never respawn since player markers for respawning are not predicted
        // if this is not predictor
        if (!IsPredictor()) { 
          // stop waiting
          stop; 
        } 
      }
      // if autoaction is received
      on (EAutoAction eAutoAction) : {
        // if we are in coop
        if (GetSP()->sp_bCooperative && !GetSP()->sp_bSinglePlayer) {
          // if the marker is teleport marker
          if (eAutoAction.penFirstMarker!=NULL && 
            ((CPlayerActionMarker*)&*eAutoAction.penFirstMarker)->m_paaAction == PAA_TELEPORT) {
            // teleport there
            TeleportToAutoMarker((CPlayerActionMarker*)&*eAutoAction.penFirstMarker);
          }
        }
        // ignore the actions
        resume;
      }
      on (EDisconnected) : { pass; }
      on (EReceiveScore) : { pass; }
      on (EKilledEnemy) : { pass; }
      on (EPreLevelChange) : { pass; }
      on (EPostLevelChange) : { pass; }
      otherwise() : { resume; }
    }

    return ERebirth();
  };

  TheEnd() {
    // if not playing demo
    if (!_pNetwork->IsPlayingDemo()) {
      // record high score in single player only
      if (GetSP()->sp_bSinglePlayer) {
        _pShell->Execute("gam_iRecordHighScore=0;");
      }
    }
    // if current difficulty is serious
    if (GetSP()->sp_gdGameDifficulty==CSessionProperties::GD_EXTREME) {
      // activate the mental mode
      _pShell->Execute("sam_bMentalActivated=1;");
    }

    // stop firing when end
    ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReleaseWeapon());
    // [Cecil] Interrupt the weapon
    ((CPlayerWeapons&)*m_penWeapons).SendEvent(EInterrupt());

    // mark player as dead
    SetFlags(GetFlags()&~ENF_ALIVE);
    // stop player
    PlayerMove(FLOAT3D(0.0f, 0.0f, 0.0f));
    PlayerRotate(ANGLE3D(0.0f, 0.0f, 0.0f));

    // look straight
    StartModelAnim(PLAYER_ANIM_STAND, 0);
    ((CPlayerAnimator&)*m_penAnimator).BodyAnimationTemplate(
      BODY_ANIM_NORMALWALK, BODY_ANIM_COLT_STAND, BODY_ANIM_SHOTGUN_STAND, BODY_ANIM_MINIGUN_STAND, 
      AOF_LOOPING|AOF_NORESTART);

    en_plViewpoint.pl_OrientationAngle = ANGLE3D(0,0,0);

    // call computer
    m_bEndOfGame = TRUE;
    SetGameEnd();

    wait () {
      on (EBegin) : { resume; }
      on (EReceiveScore) : { pass; }
      on (EKilledEnemy) : { pass; }
      on (ECenterMessage) : { pass; }
      otherwise() : { resume; }
    }
  };

/************************************************************
 *                      R E B I R T H                       *
 ************************************************************/
  FirstInit() {
    // clear use button and zoom flag
    bUseButtonHeld = FALSE;
    
    // restore last view
    m_iViewState = m_iLastViewState;

    // stop and kill camera
    if (m_penView != NULL) {
      ((CPlayerView&)*m_penView).SendEvent(EEnd());
      m_penView = NULL;
    }

    // [Cecil] Create physics object
    CreateObject();

    FindMusicHolder();

    // update per-level stats
    UpdateLevelStats();

    // initialize player (from PlayerMarker)
    InitializePlayer();

    // add statistics message
    ReceiveComputerMessage(CTFILENAME("Data\\Messages\\Statistics\\Statistics.txt"), CMF_READ);

    if (GetSettings()->ps_ulFlags&PSF_PREFER3RDPERSON) {
      ChangePlayerView();
    }

    return;
  };

  Rebirth() {
    bUseButtonHeld = FALSE;

    // restore last view
    m_iViewState = m_iLastViewState;
    // clear ammunition
    if (!(m_ulFlags&PLF_RESPAWNINPLACE)) {
      GetPlayerWeapons()->ClearWeapons();
    }

    // stop and kill camera
    if (m_penView != NULL) {
      ((CPlayerView&)*m_penView).SendEvent(EEnd());
      m_penView = NULL;
    }

    // stop and kill flame
    CEntityPointer penFlame = GetChildOfClass("Flame");
    if (penFlame!=NULL)
    {
      // send the event to stop burning
      EStopFlaming esf;
      esf.m_bNow=TRUE;
      penFlame->SendEvent(esf);
    }

    if (m_penView != NULL) {
      ((CPlayerView&)*m_penView).SendEvent(EEnd());
      m_penView = NULL;
    }

    FindMusicHolder();

    // initialize player (from PlayerMarker)
    InitializePlayer();

    return EReturn();
  };


  // auto action - go to current marker
  AutoGoToMarker(EVoid)
  {
    ULONG ulFlags = AOF_LOOPING|AOF_NORESTART;

    INDEX iAnim = GetModelObject()->GetAnim();
    if (iAnim != PLAYER_ANIM_STAND) {
      ulFlags |= AOF_SMOOTHCHANGE;
    }

    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.m_bAttacking = FALSE;
    plan.BodyWalkAnimation();

    if (m_fAutoSpeed > plr_fMoveSpeed/2) {
      StartModelAnim(PLAYER_ANIM_RUN, ulFlags);
    } else {
      StartModelAnim(PLAYER_ANIM_NORMALWALK, ulFlags);
    }

    // while not at marker
    while (
      (m_penActionMarker->GetPlacement().pl_PositionVector-
       GetPlacement().pl_PositionVector).Length()>1.0f) {
      // wait a bit
      autowait(_pTimer->TickQuantum);
    }

    // return to auto-action loop
    return EReturn();
  }

  // auto action - go to current marker and stop there
  AutoGoToMarkerAndStop(EVoid)
  {
    ULONG ulFlags = AOF_LOOPING|AOF_NORESTART;

    INDEX iAnim = GetModelObject()->GetAnim();
    if (iAnim != PLAYER_ANIM_STAND) {
      ulFlags |= AOF_SMOOTHCHANGE;
    }

    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyWalkAnimation();
    if (m_fAutoSpeed > plr_fMoveSpeed/2) {
      StartModelAnim(PLAYER_ANIM_RUN, ulFlags);
    } else {
      StartModelAnim(PLAYER_ANIM_NORMALWALK, ulFlags);
    }

    // while not at marker
    while (
      (m_penActionMarker->GetPlacement().pl_PositionVector-
       GetPlacement().pl_PositionVector).Length()>m_fAutoSpeed*_pTimer->TickQuantum*2.00f) {
      // wait a bit
      autowait(_pTimer->TickQuantum);
    }
    // disable auto speed
    m_fAutoSpeed = 0.0f;

    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyStillAnimation();
    StartModelAnim(PLAYER_ANIM_STAND, AOF_LOOPING|AOF_NORESTART);

    // stop moving
    ForceFullStop();

    // return to auto-action loop
    return EReturn();
  }

  // auto action - use an item
  AutoUseItem(EVoid)
  {

    // start pulling the item
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyPullItemAnimation();
    //StartModelAnim(PLAYER_ANIM_STATUE_PULL, 0);

    autowait(0.2f);

    // item appears
    CPlayerActionMarker *ppam = GetActionMarker();
    if (IsOfClass(ppam->m_penItem, "KeyItem")) {
      CModelObject &moItem = ppam->m_penItem->GetModelObject()->GetAttachmentModel(0)->amo_moModelObject;
      GetPlayerAnimator()->SetItem(&moItem);
    }

    autowait(2.20f-0.2f);

    // the item is in place
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyRemoveItem();
    // if marker points to a trigger
    if (GetActionMarker()->m_penTrigger!=NULL) {
      // trigger it
      SendToTarget(GetActionMarker()->m_penTrigger, EET_TRIGGER, this);
    }

    // fake that player has passed through the door controller
    if (GetActionMarker()->m_penDoorController!=NULL) {
      EPass ePass;
      ePass.penOther = this;
      GetActionMarker()->m_penDoorController->SendEvent(ePass);
    }
    
    autowait(3.25f-2.20f);

    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyRemoveItem();

    // return to auto-action loop
    return EReturn();
  }

  // auto action - pick an item
  AutoPickItem(EVoid)
  {

    // start pulling the item
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyPickItemAnimation();
    StartModelAnim(PLAYER_ANIM_KEYLIFT, 0);

    autowait(1.2f);

    // if marker points to a trigger
    if (GetActionMarker()->m_penTrigger!=NULL) {
      // trigger it
      SendToTarget(GetActionMarker()->m_penTrigger, EET_TRIGGER, this);
    }

    // item appears
    CPlayerActionMarker *ppam = GetActionMarker();
    if (IsOfClass(ppam->m_penItem, "KeyItem")) {
      CModelObject &moItem = ppam->m_penItem->GetModelObject()->GetAttachmentModel(0)->amo_moModelObject;
      GetPlayerAnimator()->SetItem(&moItem);
      EPass ePass;
      ePass.penOther = this;
      ppam->m_penItem->SendEvent(ePass);
    }

    autowait(3.6f-1.2f+GetActionMarker()->m_tmWait);

    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.BodyRemoveItem();

    // return to auto-action loop
    return EReturn();
  }

  AutoFallDown(EVoid)
  {
    StartModelAnim(PLAYER_ANIM_BRIDGEFALLPOSE, 0);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_BRIDGEFALLPOSE, 0);

    autowait(GetActionMarker()->m_tmWait);

    // return to auto-action loop
    return EReturn();
  }

  AutoFallToAbys(EVoid)
  {
    StartModelAnim(PLAYER_ANIM_ABYSSFALL, AOF_LOOPING);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_ABYSSFALL, AOF_LOOPING);

    autowait(GetActionMarker()->m_tmWait);

    // return to auto-action loop
    return EReturn();
  }

  // auto action - look around
  AutoLookAround(EVoid)
  {
    StartModelAnim(PLAYER_ANIM_BACKPEDAL, 0);
    m_vAutoSpeed = FLOAT3D(0, 0, plr_fMoveSpeed/4 / 0.75f);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_NORMALWALK, 0);

    autowait(GetModelObject()->GetCurrentAnimLength()/2);

    m_vAutoSpeed = FLOAT3D(0,0,0);
 
    // start looking around
    StartModelAnim(PLAYER_ANIM_STAND, 0);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_LOOKAROUND, 0);
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;

    // wait given time
    autowait(moBody.GetCurrentAnimLength()+0.1f);

    // return to auto-action loop
    return EReturn();
  }

  AutoTeleport(EVoid)
  {
    // teleport there
    TeleportToAutoMarker(GetActionMarker());

    // return to auto-action loop
    return EReturn();
  }

  AutoAppear(EVoid)
  {
    // hide the model
    SwitchToEditorModel();

    // put it at marker
    PlacePlayer(GetActionMarker()->GetPlacement());
    // make it rotate in spawnpose
    SetPhysics(PPH_NOCLIP, TRUE, FALSE); // [Cecil]
    m_ulFlags|=PLF_AUTOMOVEMENTS;
    PlayerRotate(ANGLE3D(60,0,0));
    StartModelAnim(PLAYER_ANIM_SPAWNPOSE, AOF_LOOPING);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_SPAWNPOSE, AOF_LOOPING);

    // start stardust appearing
    m_tmSpiritStart = _pTimer->CurrentTick();
    // wait till it appears
    autowait(5);

    // start model appearing
    SwitchToModel();
    m_tmFadeStart = _pTimer->CurrentTick();
    // wait till it appears
    autowait(5);
    // fixate full opacity
    COLOR colAlpha = GetModelObject()->mo_colBlendColor;
    GetModelObject()->mo_colBlendColor = colAlpha|0xFF;

    // put it to normal state
    SetPhysics(PPH_NORMAL, TRUE, FALSE); // [Cecil]
    PlayerRotate(ANGLE3D(0,0,0));
    m_ulFlags&=~PLF_AUTOMOVEMENTS;

    // play animation to fall down
    StartModelAnim(PLAYER_ANIM_SPAWN_FALLDOWN, 0);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_SPAWN_FALLDOWN, 0);

    autowait(GetModelObject()->GetCurrentAnimLength());

    // play animation to get up
    StartModelAnim(PLAYER_ANIM_SPAWN_GETUP, AOF_SMOOTHCHANGE);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_SPAWN_GETUP, AOF_SMOOTHCHANGE);

    autowait(GetModelObject()->GetCurrentAnimLength());

    // return to auto-action loop
    return EReturn();
  }

  TravellingInBeam()
  {
    // put it at marker
    PlacePlayer(GetActionMarker()->GetPlacement());
    // make it rotate in spawnpose
    SetPhysics(PPH_NOCLIP, TRUE, FALSE); // [Cecil]
    m_ulFlags |= PLF_AUTOMOVEMENTS;

    PlayerRotate(ANGLE3D(60,0,0));
    PlayerMove(FLOAT3D(0, 20.0f, 0));

    StartModelAnim(PLAYER_ANIM_SPAWNPOSE, AOF_LOOPING);
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_SPAWNPOSE, AOF_LOOPING);
    // wait till it appears
    autowait(8.0f);
    // switch to model
    SwitchToEditorModel();
    // return to auto-action loop
    return EReturn();
  }
  
  LogoFireMinigun(EVoid) 
  {
    // put it at marker
    CPlacement3D pl = GetActionMarker()->GetPlacement();
    pl.pl_PositionVector += FLOAT3D(0, 0.01f, 0)*GetActionMarker()->en_mRotation;
    PlacePlayer(pl);
    en_plViewpoint.pl_OrientationAngle(1) = 20.0f;
    en_plLastViewpoint.pl_OrientationAngle = en_plViewpoint.pl_OrientationAngle;

    // stand in pose
    StartModelAnim(PLAYER_ANIM_INTRO, AOF_LOOPING);
    // remember time for rotating view start
    m_tmMinigunAutoFireStart = _pTimer->CurrentTick();
    // wait some time for fade in and to look from left to right with out firing
    //autowait(0.75f);
    ((CPlayerWeapons&)*m_penWeapons).SendEvent(EFireWeapon());
    autowait(2.5f);
    ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReleaseWeapon());

    // stop minigun shaking
    CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(BODY_ANIM_MINIGUN_STAND, 0);

    autowait(0.5f);

    // ---------- Apply shake
    CWorldSettingsController *pwsc = NULL;
    // obtain bcg viewer
    CBackgroundViewer *penBcgViewer = (CBackgroundViewer *) GetWorld()->GetBackgroundViewer();
    if (penBcgViewer != NULL) {
      pwsc = (CWorldSettingsController *) &*penBcgViewer->m_penWorldSettingsController;
      pwsc->m_tmShakeStarted = _pTimer->CurrentTick();
      pwsc->m_vShakePos = GetPlacement().pl_PositionVector;
      pwsc->m_fShakeFalloff = 250.0f;
      pwsc->m_fShakeFade = 3.0f;

      pwsc->m_fShakeIntensityZ = 0.1f*2.0f;
      pwsc->m_tmShakeFrequencyZ = 5.0f;
      pwsc->m_fShakeIntensityY = 0.0f;
      pwsc->m_fShakeIntensityB = 0.0f;

      pwsc->m_bShakeFadeIn = FALSE;
    }

    // stop rotating body
    m_tmMinigunAutoFireStart = -1;
    autowait(5.0f);
    autowait(5.0f);

    return EReturn();
  }

  AutoStoreWeapon(EVoid) 
  {
    // store current weapon slowly
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    // [Cecil] Replaced wait animation with default animation
    plan.BodyAnimationTemplate(BODY_ANIM_DEFAULT_ANIMATION,
      BODY_ANIM_COLT_REDRAWSLOW, BODY_ANIM_SHOTGUN_REDRAWSLOW, BODY_ANIM_MINIGUN_REDRAWSLOW, 0);
    autowait(plan.m_fBodyAnimTime);

    m_iAutoOrgWeapon = ((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon;  
    ((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon = WEAPON_NONE;
    ((CPlayerWeapons&)*m_penWeapons).m_iWantedWeapon = WEAPON_NONE;

    // sync apperances
    GetPlayerAnimator()->SyncWeapon();
    // remove weapon attachment
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.m_iWeaponLast = m_iAutoOrgWeapon;
    plan.RemoveWeapon();
    GetPlayerAnimator()->SyncWeapon();

    ((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon = (WeaponType) m_iAutoOrgWeapon;
    // [Cecil] Replaced wait animation with default animation
    plan.BodyAnimationTemplate(BODY_ANIM_DEFAULT_ANIMATION, BODY_ANIM_COLT_DEACTIVATETOWALK,
      BODY_ANIM_SHOTGUN_DEACTIVATETOWALK, BODY_ANIM_MINIGUN_DEACTIVATETOWALK, AOF_SMOOTHCHANGE);
    ((CPlayerWeapons&)*m_penWeapons).m_iCurrentWeapon = WEAPON_NONE;

    autowait(plan.m_fBodyAnimTime);

    // return to auto-action loop
    return EReturn();
  }

  // perform player auto actions
  DoAutoActions(EVoid)
  {
    // don't look up/down
    en_plViewpoint.pl_OrientationAngle = ANGLE3D(0,0,0);
    // disable playeranimator animating
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.m_bDisableAnimating = TRUE;

    // while there is some marker
    while (m_penActionMarker!=NULL && IsOfClass(m_penActionMarker, "PlayerActionMarker")) {

      // if should wait
      if (GetActionMarker()->m_paaAction==PAA_WAIT) {
        // play still anim
        CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
        // [Cecil] Replaced wait animation with default animation
        moBody.PlayAnim(BODY_ANIM_DEFAULT_ANIMATION, AOF_NORESTART|AOF_LOOPING);
        // wait given time
        autowait(GetActionMarker()->m_tmWait);
      } else if (GetActionMarker()->m_paaAction==PAA_STOPANDWAIT) {
        // play still anim
        StartModelAnim(PLAYER_ANIM_STAND, 0);
        CModelObject &moBody = GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
        // [Cecil] Replaced wait animation with default animation
        moBody.PlayAnim(BODY_ANIM_DEFAULT_ANIMATION, AOF_NORESTART|AOF_LOOPING);
        // wait given time
        autowait(GetActionMarker()->m_tmWait);

      // if should teleport here
      } else if (GetActionMarker()->m_paaAction==PAA_APPEARING) {
        autocall AutoAppear() EReturn;
      } else if (GetActionMarker()->m_paaAction==PAA_TRAVELING_IN_BEAM) {
        autocall TravellingInBeam() EReturn;
      } else if (GetActionMarker()->m_paaAction==PAA_INTROSE_SELECT_WEAPON) {
        // order playerweapons to select weapon
        ESelectWeapon eSelect;
        eSelect.iWeapon = 1;
        ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);
      } else if (GetActionMarker()->m_paaAction==PAA_LOGO_FIRE_INTROSE) {
        autocall LogoFireMinigun() EReturn;
      } else if (GetActionMarker()->m_paaAction==PAA_LOGO_FIRE_MINIGUN) {
        autocall LogoFireMinigun() EReturn;
      // if should appear here
      } else if (GetActionMarker()->m_paaAction==PAA_TELEPORT) {
        autocall AutoTeleport() EReturn;

      // if should wait for trigger
      } else if (GetActionMarker()->m_paaAction==PAA_WAITFOREVER) {
        // wait forever
        wait() {
          on (EBegin) : { resume; }
          otherwise() : { pass; }
        }
      // if should store weapon
      } else if (GetActionMarker()->m_paaAction==PAA_STOREWEAPON) {
        autocall AutoStoreWeapon() EReturn;
      
      // if should draw weapon
      } else if (GetActionMarker()->m_paaAction==PAA_DRAWWEAPON) {
        // order playerweapons to select best weapon
        ESelectWeapon eSelect;
        eSelect.iWeapon = -4;
        ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);

      // if should wait
      } else if (GetActionMarker()->m_paaAction==PAA_LOOKAROUND) {
        autocall AutoLookAround() EReturn;

      // if should use item
      } else if (GetActionMarker()->m_paaAction==PAA_USEITEM) {
        // use it
        autocall AutoUseItem() EReturn;

      // if should pick item
      } else if (GetActionMarker()->m_paaAction==PAA_PICKITEM) {
        // pick it
        autocall AutoPickItem() EReturn;

      // if falling from bridge
      } else if (GetActionMarker()->m_paaAction==PAA_FALLDOWN) {
        // fall
        autocall AutoFallDown() EReturn;

      // if releasing player
      } else if (GetActionMarker()->m_paaAction==PAA_RELEASEPLAYER) {
        if (m_penCamera!=NULL) {
          ((CCamera*)&*m_penCamera)->m_bStopMoving=TRUE;
        }
        m_penCamera = NULL;
        // if currently not having any weapon in hand
        if (GetPlayerWeapons()->m_iCurrentWeapon == WEAPON_NONE) {
          // order playerweapons to select best weapon
          ESelectWeapon eSelect;
          eSelect.iWeapon = -4;
          ((CPlayerWeapons&)*m_penWeapons).SendEvent(eSelect);
        }
        // sync weapon, just in case
        m_ulFlags |= PLF_SYNCWEAPON;
        m_tmSpiritStart = 0;

      // if start computer
      } else if (GetActionMarker()->m_paaAction==PAA_STARTCOMPUTER) {
        // mark that
        if (_pNetwork->IsPlayerLocal(this) && GetSP()->sp_bSinglePlayer) {
          cmp_ppenPlayer = this;
          cmp_bInitialStart = TRUE;
        }

      // if start introscroll
      } else if (GetActionMarker()->m_paaAction==PAA_STARTINTROSCROLL) {
        _pShell->Execute("sam_iStartCredits=1;");

      // if start credits
      } else if (GetActionMarker()->m_paaAction==PAA_STARTCREDITS) {
        _pShell->Execute("sam_iStartCredits=2;");

      // if stop scroller
      } else if (GetActionMarker()->m_paaAction==PAA_STOPSCROLLER) {
        _pShell->Execute("sam_iStartCredits=-1;");

      // if should run to the marker
      } else if (GetActionMarker()->m_paaAction==PAA_RUN) {
        // go to it
        m_fAutoSpeed = plr_fMoveSpeed * GetActionMarker()->m_fSpeed;
        autocall AutoGoToMarker() EReturn;

      // if should run to the marker and stop exactly there
      } else if (GetActionMarker()->m_paaAction==PAA_RUNANDSTOP) {
        // go to it
        m_fAutoSpeed = plr_fMoveSpeed * GetActionMarker()->m_fSpeed;
        autocall AutoGoToMarkerAndStop() EReturn;

      // if should record end-of-level stats
      } else if (GetActionMarker()->m_paaAction==PAA_RECORDSTATS) {

        if (GetSP()->sp_bSinglePlayer || GetSP()->sp_bPlayEntireGame) {
          // remeber estimated time
          m_tmEstTime = GetActionMarker()->m_tmWait;
          // record stats
          RecordEndOfLevelData();
        } else {
          SetGameEnd();
        }

      // if should show statistics to the player
      } else if (GetActionMarker()->m_paaAction == PAA_SHOWSTATS) {
        // call computer
        if (cmp_ppenPlayer==NULL && _pNetwork->IsPlayerLocal(this) && GetSP()->sp_bSinglePlayer) {
          m_bEndOfLevel = TRUE;
          cmp_ppenPlayer = this;
          m_ulFlags|=PLF_DONTRENDER;
          while(m_bEndOfLevel) {
            wait(_pTimer->TickQuantum) {
              on (ETimer) : { stop; }
              on (EReceiveScore) : { pass; }
              on (EKilledEnemy) : { pass; }
              on (ECenterMessage) : { pass; }
              on (EPostLevelChange) : { 
                m_ulFlags &= !PLF_DONTRENDER;
                m_bEndOfLevel = FALSE;
                pass; 
              }
              otherwise() : { resume; }
            }
          }
          m_ulFlags &= !PLF_DONTRENDER;
        }

      // if end of entire game
      } else if (GetActionMarker()->m_paaAction == PAA_ENDOFGAME) {
        // record stats
        jump TheEnd();

      } else if (GetActionMarker()->m_paaAction == PAA_NOGRAVITY) {
        SetPhysics(PPH_NOCLIP, TRUE, FALSE); // [Cecil]

        if (GetActionMarker()->GetParent() != NULL) {
          SetParent(GetActionMarker()->GetParent());
        }

      } else if (GetActionMarker()->m_paaAction == PAA_TURNONGRAVITY) {
        SetPhysics(PPH_NORMAL, TRUE, FALSE); // [Cecil]
        SetParent(NULL);

      } else if (TRUE) {
        ASSERT(FALSE);
      }

      // if marker points to a trigger
      if (GetActionMarker()->m_penTrigger != NULL &&
          GetActionMarker()->m_paaAction != PAA_PICKITEM) {
        // trigger it
        SendToTarget(GetActionMarker()->m_penTrigger, EET_TRIGGER, this);
      }

      // get next marker
      m_penActionMarker = GetActionMarker()->m_penTarget;
    }
    
    // disable auto speed
    m_fAutoSpeed = 0.0f;

    // must clear marker, in case it was invalid
    m_penActionMarker = NULL;

    // enable playeranimator animating
    CPlayerAnimator &plan = (CPlayerAnimator&)*m_penAnimator;
    plan.m_bDisableAnimating = FALSE;

    // return to main loop
    return EVoid();
  }
/************************************************************
 *                        M  A  I  N                        *
 ************************************************************/
  Main() {
    // remember start time
    time_t tmStart;
    time(&tmStart);
    m_iStartTime = tmStart;

    m_ctUnreadMessages = 0;
    SetFlags(GetFlags()|ENF_CROSSESLEVELS|ENF_NOTIFYLEVELCHANGE);
    InitAsEditorModel();

    // set default model for physics etc
    CTString strDummy;
    SetPlayerAppearance(GetModelObject(), NULL, strDummy, FALSE);
    // set your real appearance if possible
    ValidateCharacter();
    SetPlayerAppearance(&m_moRender, &en_pcCharacter, strDummy, FALSE);
    ParseGender(strDummy);

    // if unsuccessful
    if (GetModelObject()->GetData() == NULL) {
      // never proceed with initialization - player cannot work
      return;
    }

    //const FLOAT fSize = 2.1f/1.85f;
    //GetModelObject()->StretchModel(FLOAT3D(fSize, fSize, fSize));
    ModelChangeNotify();

    // wait a bit to allow other entities to start
    wait(0.2f) { // this is 4 ticks, it has to be at least more than musicchanger for enemy counting
      on (EBegin) : { resume; }
      on (ETimer) : { stop; }
      on (EDisconnected) : { 
        Destroy(); 
        return;
      }
    }

    // do not use predictor if not yet initialized
    if (IsPredictor()) { // !!!!####
      Destroy();
      return;
    }

    // appear
    SwitchToModel();
    m_ulFlags |= PLF_INITIALIZED;

    // set initial vars
    en_tmMaxHoldBreath = 60.0f;
    en_fDensity = 1000.0f; // same density as water - to be able to dive freely

    ModelChangeNotify();

    // spawn weapons
    m_penWeapons = CreateEntity(GetPlacement(), CLASS_PLAYER_WEAPONS);
    EWeaponsInit eInitWeapons;
    eInitWeapons.penOwner = this;
    m_penWeapons->Initialize(eInitWeapons);

    // spawn animator
    m_penAnimator = CreateEntity(GetPlacement(), CLASS_PLAYER_ANIMATOR);
    EAnimatorInit eInitAnimator;
    eInitAnimator.penPlayer = this;
    m_penAnimator->Initialize(eInitAnimator);

    // set sound default parameters
    m_soMouth.Set3DParameters(50.0f, 10.0f, 1.0f, 1.0f);
    m_soFootL.Set3DParameters(20.0f, 2.0f, 1.0f, 1.0f);
    m_soFootR.Set3DParameters(20.0f, 2.0f, 1.0f, 1.0f);
    m_soBody.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
    m_soMessage.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
    m_soSniperZoom.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);

    // [Cecil]
    m_soAmmo.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
    m_soArmor.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
    m_soHealth.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
    m_soFlashlight.Set3DParameters(20.0f, 3.0f, 1.0f, 1.0f);
    m_soSuit.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
    m_soSuitMusic.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);

    // setup light source
    SetupLightSource();

    // [Cecil] BasicEffects.ani -> HL2Fire.ani
    // set light animation if available
    try {
      m_aoLightAnimation.SetData_t(CTFILENAME("Animations\\HL2Fire.ani"));
    } catch (char *strError) {
      WarningMessage(TRANS("Cannot load Animations\\HL2Fire.ani: %s"), strError);
    }
    PlayLightAnim(LIGHT_ANIM_NONE, 0);

    wait() {
      on (EBegin) : { call FirstInit(); }
      on (ERebirth) : { call Rebirth(); }
      on (EDeath eDeath) : { call Death(eDeath); }
      on (EDamage eDamage) : { call Wounded(eDamage); }

      on (EPreLevelChange) : { 
        m_ulFlags &= ~PLF_INITIALIZED; 
        m_ulFlags |=  PLF_CHANGINGLEVEL;
        m_ulFlags &= ~PLF_LEVELSTARTED;

        // [Cecil] Destroy flashlight
        if (m_penFlashlight != NULL) {
          m_penFlashlight->Destroy();
          m_penFlashlight = NULL;
        }
        if (m_penFLAmbient != NULL) {
          m_penFLAmbient->Destroy();
          m_penFLAmbient = NULL;
        }
        resume;
      }

      on (EPostLevelChange) : {
        if (GetSP()->sp_bSinglePlayer || (GetFlags()&ENF_ALIVE)) {
          call WorldChange();
        } else {
          call WorldChangeDead();
        }
      }

      on (ETakingBreath eTakingBreath) : {
        // [Cecil] Not needed
        /*SetDefaultMouthPitch();

        if (eTakingBreath.fBreathDelay < 0.2f) {
          PlaySound(m_soMouth, SOUND_INHALE0, SOF_3D);

        } else if (eTakingBreath.fBreathDelay < 0.8f) {
          PlaySound(m_soMouth, SOUND_INHALE1, SOF_3D);

        } else {
          PlaySound(m_soMouth, SOUND_INHALE2, SOF_3D);
        }*/
        resume;
      }

      on (ECameraStart eStart) : {
        m_penCamera = eStart.penCamera;
        // stop player
        if (m_penActionMarker==NULL) {
          PlayerMove(FLOAT3D(0.0f, 0.0f, 0.0f));
          PlayerRotate(ANGLE3D(0.0f, 0.0f, 0.0f));
        }
        // stop firing
        ((CPlayerWeapons&)*m_penWeapons).SendEvent(EReleaseWeapon());
        resume;
      }

      on (ECameraStop eCameraStop) : {
        if (m_penCamera==eCameraStop.penCamera) {
          m_penCamera = NULL;
        }
        resume;
      }

      on (ECenterMessage eMsg) : {
        // [Cecil] New message system
        CTString strCaption = (eMsg.strMessage); //.Undecorated();
        strCaption.TrimSpacesLeft();
        strCaption.TrimSpacesRight();

        const BOOL bInfo = (eMsg.mssSound == MSS_INFO);

        // "action" message
        if (bInfo) {
          strCaption.PrintF("[%s^r]", strCaption);
        }

        // [Cecil] NOTE: Breaks if multiple color codes or maybe other codes (test "Operation New Year" mappack).
        // get first color code if available
        /*CTString strColor = StringWithColors(eMsg.strMessage);
        strColor.TrimSpacesLeft();

        // starts with the color code
        if (strColor.FindSubstr("^c") == 0) {
          // add the color code
          strColor.TrimRight(8);
          strCaption = strColor + strCaption;
        }

        // make "action" message italic
        if (bInfo) {
          strCaption.PrintF("^i%s", strCaption);
        }*/

        AddCaption(strCaption, eMsg.tmLength, TRUE);

        //m_strCenterMessage = eMsg.strMessage;
        //m_tmCenterMessageEnd = _pTimer->CurrentTick()+eMsg.tmLength;

        if (bInfo) {
          m_soMessage.Set3DParameters(25.0f, 5.0f, 1.0f, 1.0f);
          PlaySound(m_soMessage, SOUND_INFO, SOF_3D|SOF_VOLUMETRIC|SOF_LOCAL);
        }
        resume;
      }

      on (EComputerMessage eMsg) : {
        ReceiveComputerMessage(eMsg.fnmMessage, CMF_ANALYZE);
        resume;
      }

      on (EVoiceMessage eMsg) : {
        SayVoiceMessage(eMsg.fnmMessage);
        resume;
      }

      on (EAutoAction eAutoAction) : {
        // remember first marker
        m_penActionMarker = eAutoAction.penFirstMarker;
        // do the actions
        call DoAutoActions();
      }

      on (EReceiveScore eScore) : {
        m_psLevelStats.ps_iScore += eScore.iPoints;
        m_psGameStats.ps_iScore += eScore.iPoints;
        m_iMana  += eScore.iPoints*GetSP()->sp_fManaTransferFactor;
        CheckHighScore();
        resume;
      }

      on (EKilledEnemy eKilled) : {
        // [Cecil] Gamemode-specific
        INDEX iMode = GetSP()->sp_iHLGamemode;
        BOOL bModeActive = FALSE;
        if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
          switch (iMode) {
            case HLGM_ARMSRACE:
              GetPlayerWeapons()->ArmsRaceKill(eKilled.penKilled);
              bModeActive = TRUE;
              break;
          }
        }

        if (!bModeActive) {
          m_psLevelStats.ps_iKills += 1;
          m_psGameStats.ps_iKills += 1;
        }
        resume;
      }

      on (ESecretFound) : {
        m_psLevelStats.ps_iSecrets += 1;
        m_psGameStats.ps_iSecrets += 1;
        resume;
      }

      on (EWeaponChanged) : {
        // make sure we discontinue zooming (even if not changing from sniper)
        ((CPlayerWeapons&)*m_penWeapons).m_iSniping = 0;
        ((CPlayerWeapons&)*m_penWeapons).m_iRestoreZoom = 0;
        m_ulFlags &= ~PLF_ISZOOMING;
        PlaySound(m_soSniperZoom, SOUND_SILENCE, SOF_3D);
        resume;
      }

      // EEnd should not arrive here
      on (EEnd) : {
        ASSERT(FALSE);
        resume;
      }

      // if player is disconnected
      on (EDisconnected) : {
        // exit the loop
        stop;
      }

      // support for jumping using bouncers
      on (ETouch eTouch) : {
        if (IsOfClass(eTouch.penOther, "Bouncer")) {
          // [Cecil] Adjust mid-air control and mark as a fake jump
          en_tmMaxJumpControl = 1.0f;
          en_fJumpControlMultiplier = 0.75f;
          m_bFakeJump = TRUE;

          JumpFromBouncer(this, eTouch.penOther);
        }
        resume;
      }
    }

    // we get here if the player is disconnected from the server

    // if we have some keys
    if (!IsPredictor() && m_ulKeys!=0) {
      // find first live player
      CPlayer *penNextPlayer = NULL;
      for(INDEX iPlayer=0; iPlayer<GetMaxPlayers(); iPlayer++) {
        CPlayer *pen = (CPlayer*)&*GetPlayerEntity(iPlayer);
        if (pen!=NULL && pen!=this && (pen->GetFlags()&ENF_ALIVE) && !(pen->GetFlags()&ENF_DELETED) ) {
          penNextPlayer = pen;
        }
      }

      // if any found
      if (penNextPlayer!=NULL) {
        // transfer keys to that player
        CPrintF(TRANS("%s leaving, all keys transfered to %s\n"), 
          (const char*)m_strName, (const char*)penNextPlayer->GetPlayerName());
        penNextPlayer->m_ulKeys |= m_ulKeys;
      }
    }

    // spawn teleport effect
    SpawnTeleport();

    // [Cecil] Stop holding objects
    GetPlayerWeapons()->StopHolding(FALSE);

    // cease to exist
    m_penWeapons->Destroy();
    m_penAnimator->Destroy();

    if (m_penView != NULL) {
      m_penView->Destroy();
    }

    if (m_pen3rdPersonView != NULL) {
      m_pen3rdPersonView->Destroy();
    }

    // [Cecil] Flashlight
    if (m_penFlashlight != NULL) {
      m_penFlashlight->Destroy();
    }
    if (m_penFLAmbient != NULL) {
      m_penFLAmbient->Destroy();
    }

    // [Cecil] Not a viewer anymore
    if (_penViewPlayer == this) {
      _penViewPlayer = NULL;
    }

    Destroy();
    return;
  };
};
