406
%{
#include "StdH.h"

#include "ModelsMP/Player/SeriousSam/Player.h"
#include "ModelsMP/Player/SeriousSam/Body.h"
#include "ModelsMP/Player/SeriousSam/Head.h"

#include "ModelsMP/Weapons/Flamer/FlamerItem.h"
#include "ModelsMP/Weapons/Flamer/Body.h"
#include "Models/Weapons/Laser/LaserItem.h"
#include "Models/Weapons/Cannon/Cannon.h"

// [Cecil] Half-Life 2 Weapons
#include "HL2Models/ItemHandler.h"
#include "EntitiesMP/Cecil/Weapons.h"
%}

uses "EntitiesMP/Player";
uses "EntitiesMP/PlayerWeapons";

// input parameter for animator
event EAnimatorInit {
  CEntityPointer penPlayer,            // player owns it
};

%{
// animator action
enum AnimatorAction {
  AA_JUMPDOWN = 0,
  AA_CROUCH,
  AA_RISE,
  AA_PULLWEAPON,
  AA_ATTACK,
};

// fire flare specific
#define FLARE_NONE 0
#define FLARE_REMOVE 1
#define FLARE_ADD 2

extern FLOAT plr_fBreathingStrength;
extern FLOAT plr_fViewDampFactor;
extern FLOAT plr_fViewDampLimitGroundUp;
extern FLOAT plr_fViewDampLimitGroundDn;
extern FLOAT plr_fViewDampLimitWater;

void CPlayerAnimator_Precache(ULONG ulAvailable)
{
  CDLLEntityClass *pdec = &CPlayerAnimator_DLLClass;

  pdec->PrecacheTexture(TEX_REFL_BWRIPLES01      );
  pdec->PrecacheTexture(TEX_REFL_BWRIPLES02      );
  pdec->PrecacheTexture(TEX_REFL_LIGHTMETAL01    );
  pdec->PrecacheTexture(TEX_REFL_LIGHTBLUEMETAL01);
  pdec->PrecacheTexture(TEX_REFL_DARKMETAL       );
  pdec->PrecacheTexture(TEX_REFL_PURPLE01        );
  pdec->PrecacheTexture(TEX_SPEC_WEAK            );
  pdec->PrecacheTexture(TEX_SPEC_MEDIUM          );
  pdec->PrecacheTexture(TEX_SPEC_STRONG          );
  pdec->PrecacheModel(MODEL_FLARE02);
  pdec->PrecacheTexture(TEXTURE_FLARE02);
  pdec->PrecacheModel(MODEL_GOLDAMON);
  pdec->PrecacheTexture(TEXTURE_GOLDAMON);
  pdec->PrecacheTexture(TEX_REFL_GOLD01);
  pdec->PrecacheClass(CLASS_REMINDER);

  // precache shells that drop when firing
  extern void CPlayerWeaponsEffects_Precache(void);
  CPlayerWeaponsEffects_Precache();

  pdec->PrecacheModel(MODEL_FLAMER);
  pdec->PrecacheModel(MODEL_FL_BODY);
  pdec->PrecacheModel(MODEL_FL_RESERVOIR);
  pdec->PrecacheModel(MODEL_FL_FLAME);
  pdec->PrecacheTexture(TEXTURE_FL_BODY);  
  pdec->PrecacheTexture(TEXTURE_FL_FLAME);  

  pdec->PrecacheModel(MODEL_LASER);
  pdec->PrecacheModel(MODEL_LS_BODY);
  pdec->PrecacheModel(MODEL_LS_BARREL);
  pdec->PrecacheTexture(TEXTURE_LS_BODY);  
  pdec->PrecacheTexture(TEXTURE_LS_BARREL);  

  pdec->PrecacheModel(MODEL_CANNON);
  pdec->PrecacheModel(MODEL_CN_BODY);
  pdec->PrecacheTexture(TEXTURE_CANNON);

  // [Cecil]
  pdec->PrecacheModel(MODEL_HANDLER);
  pdec->PrecacheModel(MODEL_CROWBAR);
  pdec->PrecacheTexture(TEXTURE_CROWBAR);
  pdec->PrecacheModel(MODEL_PISTOL);
  pdec->PrecacheTexture(TEXTURE_PISTOL);
  pdec->PrecacheModel(MODEL_357);
  pdec->PrecacheTexture(TEXTURE_357);
  pdec->PrecacheModel(MODEL_SMG1);
  pdec->PrecacheTexture(TEXTURE_SMG1);
  pdec->PrecacheModel(MODEL_SHOTGUN);
  pdec->PrecacheTexture(TEXTURE_SHOTGUN);
  pdec->PrecacheModel(MODEL_AR2);
  pdec->PrecacheTexture(TEXTURE_AR2);
  pdec->PrecacheModel(MODEL_GRENADE);
  pdec->PrecacheTexture(TEXTURE_GRENADE);
  pdec->PrecacheModel(MODEL_RPG);
  pdec->PrecacheTexture(TEXTURE_RPG);
  pdec->PrecacheModel(MODEL_CROSSBOW);
  pdec->PrecacheTexture(TEXTURE_CROSSBOW);
  pdec->PrecacheModel(MODEL_GRAVITYGUN);
  pdec->PrecacheTexture(TEXTURE_GRAVITYGUN);
  pdec->PrecacheModel(MODEL_G3SG1);
  pdec->PrecacheTexture(TEXTURE_G3SG1);

  pdec->PrecacheTexture(TEXTURE_AR2_FLARE);
  pdec->PrecacheModel(MODEL_FLARE01);
  pdec->PrecacheTexture(TEXTURE_GG_FLARE);
}
%}

class export CPlayerAnimator: CRationalEntity {
name      "Player Animator";
thumbnail "";
features "CanBePredictable";

properties:
  1 CEntityPointer m_penPlayer,               // player which owns it

  5 BOOL m_bReference=FALSE,                  // player has reference (floor)
  7 INDEX m_iContent = 0,                     // content type index
  8 BOOL m_bWaitJumpAnim = FALSE,             // wait legs anim (for jump end)
  9 BOOL m_bCrouch = FALSE,                   // player crouch state
 10 BOOL m_iCrouchDownWait = FALSE,           // wait for crouch down
 11 BOOL m_iRiseUpWait = FALSE,               // wait for rise up
 12 BOOL m_bChangeWeapon = FALSE,             // wait for weapon change
 13 BOOL m_bSwim = FALSE,                     // player in water
 14 INDEX m_iFlare = FLARE_REMOVE,            // 0-none, 1-remove, 2-add
 15 INDEX m_iSecondFlare = FLARE_REMOVE,      // 0-none, 1-remove, 2-add
 16 BOOL m_bAttacking = FALSE,                // currently firing weapon/swinging knife
 19 FLOAT m_tmAttackingDue = -1.0f,           // when firing animation is due
 17 FLOAT m_tmFlareAdded = -1.0f,             // for better flare add/remove
 18 BOOL m_bDisableAnimating = FALSE,

// player soft eyes on Y axis
 20 FLOAT3D m_vLastPlayerPosition = FLOAT3D(0,0,0), // last player position for eyes movement
 21 FLOAT m_fEyesYLastOffset = 0.0f,                // eyes offset from player position
 22 FLOAT m_fEyesYOffset = 0.0f,
 23 FLOAT m_fEyesYSpeed = 0.0f, // eyes speed
 27 FLOAT m_fWeaponYLastOffset = 0.0f, // eyes offset from player position
 28 FLOAT m_fWeaponYOffset = 0.0f,
 29 FLOAT m_fWeaponYSpeed = 0.0f, // eyes speed

// player banking when moving
 30 BOOL m_bMoving = FALSE,
 31 FLOAT m_fMoveLastBanking = 0.0f,
 32 FLOAT m_fMoveBanking = 0.0f,
 33 BOOL m_iMovingSide = 0,
 34 BOOL m_bSidestepBankingLeft = FALSE,
 35 BOOL m_bSidestepBankingRight = FALSE,
 36 FLOAT m_fSidestepLastBanking = 0.0f,
 37 FLOAT m_fSidestepBanking = 0.0f,
 38 INDEX m_iWeaponLast = -1,
 39 FLOAT m_fBodyAnimTime = -1.0f,

 // [Cecil]
 50 FLOAT m_fWeaponAnim = 0.0f,
 51 FLOAT m_fWeaponAnimLast = 0.0f,
 52 BOOL m_bWeaponMove = FALSE,

{
  CModelObject *pmoModel;
}

components:
  1 class   CLASS_REMINDER              "Classes\\Reminder.ecl",

 // [Cecil]
  5 model   MODEL_HANDLER      "Models\\Items\\ItemHandler.mdl",
 10 model   MODEL_CROWBAR      "Models\\Items\\Crowbar.mdl",
 11 texture TEXTURE_CROWBAR    "Models\\Items\\Crowbar.tex",
 12 model   MODEL_PISTOL       "Models\\Items\\Pistol.mdl",
 13 texture TEXTURE_PISTOL     "Models\\Items\\Pistol.tex",
 14 model   MODEL_357          "Models\\Items\\357.mdl",
 15 texture TEXTURE_357        "Models\\Items\\357.tex",
 16 model   MODEL_SMG1         "Models\\Items\\SMG1Player.mdl",
 17 texture TEXTURE_SMG1       "Models\\Items\\SMG1.tex",
 18 model   MODEL_SHOTGUN      "Models\\Items\\Shotgun.mdl",
 19 texture TEXTURE_SHOTGUN    "Models\\Items\\Shotgun.tex",
 20 model   MODEL_AR2          "Models\\Items\\AR2Player.mdl",
 21 texture TEXTURE_AR2        "Models\\Items\\AR2.tex",
 22 model   MODEL_GRENADE      "Models\\Items\\GrenadePlayer.mdl",
 23 texture TEXTURE_GRENADE    "Models\\Items\\Grenade.tex",
 24 model   MODEL_RPG          "Models\\Items\\RPG.mdl",
 25 texture TEXTURE_RPG        "Models\\Items\\RPG.tex",
 26 model   MODEL_CROSSBOW     "Models\\Items\\Crossbow.mdl",
 27 texture TEXTURE_CROSSBOW   "Models\\Items\\Crossbow.tex",
 28 model   MODEL_GRAVITYGUN   "Models\\Items\\GravityGun.mdl",
 29 texture TEXTURE_GRAVITYGUN "Models\\Items\\GravityGun.tex",
 30 model   MODEL_G3SG1        "Models\\Items\\G3SG1.mdl",
 31 texture TEXTURE_G3SG1      "Models\\Items\\G3SG1.tex",

// ************** DOUBLE SHOTGUN **************
/*50 model   MODEL_DOUBLESHOTGUN         "Models\\Weapons\\DoubleShotgun\\DoubleShotgunItem.mdl",
 51 model   MODEL_DS_HANDLE             "Models\\Weapons\\DoubleShotgun\\Dshotgunhandle.mdl",
 52 model   MODEL_DS_BARRELS            "Models\\Weapons\\DoubleShotgun\\Dshotgunbarrels.mdl",
 54 model   MODEL_DS_SWITCH             "Models\\Weapons\\DoubleShotgun\\Switch.mdl",
 56 texture TEXTURE_DS_HANDLE           "Models\\Weapons\\DoubleShotgun\\Handle.tex",
 57 texture TEXTURE_DS_BARRELS          "Models\\Weapons\\DoubleShotgun\\Barrels.tex",
 58 texture TEXTURE_DS_SWITCH           "Models\\Weapons\\DoubleShotgun\\Switch.tex",*/

// ************** FLAMER **************
130 model   MODEL_FLAMER                "ModelsMP\\Weapons\\Flamer\\FlamerItem.mdl",
131 model   MODEL_FL_BODY               "ModelsMP\\Weapons\\Flamer\\Body.mdl",
132 model   MODEL_FL_RESERVOIR          "ModelsMP\\Weapons\\Flamer\\FuelReservoir.mdl",
133 model   MODEL_FL_FLAME              "ModelsMP\\Weapons\\Flamer\\Flame.mdl",
134 texture TEXTURE_FL_BODY             "ModelsMP\\Weapons\\Flamer\\Body.tex",
135 texture TEXTURE_FL_FLAME            "ModelsMP\\Effects\\Flame\\Flame.tex",
136 texture TEXTURE_FL_FUELRESERVOIR    "ModelsMP\\Weapons\\Flamer\\FuelReservoir.tex",

// ************** LASER **************
140 model   MODEL_LASER                 "Models\\Weapons\\Laser\\LaserItem.mdl",
141 model   MODEL_LS_BODY               "Models\\Weapons\\Laser\\Body.mdl",
142 model   MODEL_LS_BARREL             "Models\\Weapons\\Laser\\Barrel.mdl",
143 texture TEXTURE_LS_BODY             "Models\\Weapons\\Laser\\Body.tex",
144 texture TEXTURE_LS_BARREL           "Models\\Weapons\\Laser\\Barrel.tex",

// ************** CHAINSAW **************
150 model   MODEL_CHAINSAW              "ModelsMP\\Weapons\\Chainsaw\\ChainsawForPlayer.mdl",
151 model   MODEL_CS_BODY               "ModelsMP\\Weapons\\Chainsaw\\BodyForPlayer.mdl",
152 model   MODEL_CS_BLADE              "ModelsMP\\Weapons\\Chainsaw\\Blade.mdl",
153 model   MODEL_CS_TEETH              "ModelsMP\\Weapons\\Chainsaw\\Teeth.mdl",
154 texture TEXTURE_CS_BODY             "ModelsMP\\Weapons\\Chainsaw\\Body.tex",
155 texture TEXTURE_CS_BLADE            "ModelsMP\\Weapons\\Chainsaw\\Blade.tex",
156 texture TEXTURE_CS_TEETH            "ModelsMP\\Weapons\\Chainsaw\\Teeth.tex",

// ************** CANNON **************
170 model   MODEL_CANNON                "Models\\Weapons\\Cannon\\Cannon.mdl",
171 model   MODEL_CN_BODY               "Models\\Weapons\\Cannon\\Body.mdl",
173 texture TEXTURE_CANNON              "Models\\Weapons\\Cannon\\Body.tex",

// ************** AMON STATUE **************
180 model   MODEL_GOLDAMON                "Models\\Ages\\Egypt\\Gods\\Amon\\AmonGold.mdl",
181 texture TEXTURE_GOLDAMON              "Models\\Ages\\Egypt\\Gods\\Amon\\AmonGold.tex",

// ************** REFLECTIONS **************
200 texture TEX_REFL_BWRIPLES01         "Models\\ReflectionTextures\\BWRiples01.tex",
201 texture TEX_REFL_BWRIPLES02         "Models\\ReflectionTextures\\BWRiples02.tex",
202 texture TEX_REFL_LIGHTMETAL01       "Models\\ReflectionTextures\\LightMetal01.tex",
203 texture TEX_REFL_LIGHTBLUEMETAL01   "Models\\ReflectionTextures\\LightBlueMetal01.tex",
204 texture TEX_REFL_DARKMETAL          "Models\\ReflectionTextures\\DarkMetal.tex",
205 texture TEX_REFL_PURPLE01           "Models\\ReflectionTextures\\Purple01.tex",
206 texture TEX_REFL_GOLD01               "Models\\ReflectionTextures\\Gold01.tex",

// ************** SPECULAR **************
210 texture TEX_SPEC_WEAK               "Models\\SpecularTextures\\Weak.tex",
211 texture TEX_SPEC_MEDIUM             "Models\\SpecularTextures\\Medium.tex",
212 texture TEX_SPEC_STRONG             "Models\\SpecularTextures\\Strong.tex",

// ************** FLARES **************
250 model   MODEL_FLARE02   "Models\\Effects\\Weapons\\Flare02\\Flare.mdl",
251 texture TEXTURE_FLARE02 "Models\\Effects\\Weapons\\Flare02\\Flare.tex",
// [Cecil]
252 texture TEXTURE_AR2_FLARE "Models\\Weapons\\PulseRifle\\Flare3D.tex",
253 model   MODEL_FLARE01     "Models\\Effects\\Weapons\\Flare01\\Flare.mdl",
254 texture TEXTURE_GG_FLARE  "Models\\Weapons\\GravityGun\\Flare.tex",


functions:
  
  /* Read from stream. */
  void Read_t(CTStream *istr) // throw char *
  { 
    CRationalEntity::Read_t(istr);
  };

  void Precache(void) {
    INDEX iAvailableWeapons = ((CPlayerWeapons&)*(((CPlayer&)*m_penPlayer).m_penWeapons)).m_iAvailableWeapons;
    CPlayerAnimator_Precache(iAvailableWeapons);
  };
  
  CPlayer *GetPlayer(void) {
    return ((CPlayer*)&*m_penPlayer);
  };

  CModelObject *GetBody(void) {
    CAttachmentModelObject *pamoBody = GetPlayer()->GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO);
    if (pamoBody==NULL) {
      return NULL;
    }
    return &pamoBody->amo_moModelObject;
  };

  CModelObject *GetBodyRen(void) {
    CAttachmentModelObject *pamoBody = GetPlayer()->m_moRender.GetAttachmentModel(PLAYER_ATTACHMENT_TORSO);
    if (pamoBody == NULL) {
      return NULL;
    }
    return &pamoBody->amo_moModelObject;
  };

  // Set components
  void SetComponents(CModelObject *mo, ULONG ulIDModel, ULONG ulIDTexture,
                     ULONG ulIDReflectionTexture, ULONG ulIDSpecularTexture, ULONG ulIDBumpTexture) {
    // model data
    mo->SetData(GetModelDataForComponent(ulIDModel));
    // texture data
    mo->mo_toTexture.SetData(GetTextureDataForComponent(ulIDTexture));
    // reflection texture data
    if (ulIDReflectionTexture>0) {
      mo->mo_toReflection.SetData(GetTextureDataForComponent(ulIDReflectionTexture));
    } else {
      mo->mo_toReflection.SetData(NULL);
    }
    // specular texture data
    if (ulIDSpecularTexture>0) {
      mo->mo_toSpecular.SetData(GetTextureDataForComponent(ulIDSpecularTexture));
    } else {
      mo->mo_toSpecular.SetData(NULL);
    }
    // bump texture data
    if (ulIDBumpTexture>0) {
      mo->mo_toBump.SetData(GetTextureDataForComponent(ulIDBumpTexture));
    } else {
      mo->mo_toBump.SetData(NULL);
    }
    ModelChangeNotify();
  };

  // Add attachment model
  void AddAttachmentModel(CModelObject *mo, INDEX iAttachment, ULONG ulIDModel, ULONG ulIDTexture,
                          ULONG ulIDReflectionTexture, ULONG ulIDSpecularTexture, ULONG ulIDBumpTexture) {
    SetComponents(&mo->AddAttachmentModel(iAttachment)->amo_moModelObject, ulIDModel, 
                  ulIDTexture, ulIDReflectionTexture, ulIDSpecularTexture, ulIDBumpTexture);
  };

  // Add weapon attachment
  void AddWeaponAttachment(INDEX iAttachment, ULONG ulIDModel, ULONG ulIDTexture,
                           ULONG ulIDReflectionTexture, ULONG ulIDSpecularTexture, ULONG ulIDBumpTexture) {
    AddAttachmentModel(pmoModel, iAttachment, ulIDModel, ulIDTexture,
                       ulIDReflectionTexture, ulIDSpecularTexture, ulIDBumpTexture);
  };

  // set active attachment (model)
  void SetAttachment(INDEX iAttachment) {
    pmoModel = &(pmoModel->GetAttachmentModel(iAttachment)->amo_moModelObject);
  };

  // synchronize any possible weapon attachment(s) with default appearance
  void SyncWeapon(void) {
    CModelObject *pmoBodyRen = GetBodyRen();
    CModelObject *pmoBodyDef = GetBody();
    // for each weapon attachment
    for (INDEX iWeapon = BODY_ATTACHMENT_COLT_RIGHT; iWeapon<=BODY_ATTACHMENT_ITEM; iWeapon++) {
      CAttachmentModelObject *pamoWeapDef = pmoBodyDef->GetAttachmentModel(iWeapon);
      CAttachmentModelObject *pamoWeapRen = pmoBodyRen->GetAttachmentModel(iWeapon);
      // if it doesn't exist in either
      if (pamoWeapRen==NULL && pamoWeapDef==NULL) {
        // just skip it
        NOTHING;

      // if exists only in rendering model
      } else if (pamoWeapRen!=NULL && pamoWeapDef==NULL) {
        // remove it from rendering
        delete pamoWeapRen;

      // if exists only in default
      } else if (pamoWeapRen==NULL && pamoWeapDef!=NULL) {
        // add it to rendering
        pamoWeapRen = pmoBodyRen->AddAttachmentModel(iWeapon);
        pamoWeapRen->amo_plRelative = pamoWeapDef->amo_plRelative;
        pamoWeapRen->amo_moModelObject.Copy(pamoWeapDef->amo_moModelObject);

      // if exists in both
      } else {
        // just synchronize
        pamoWeapRen->amo_plRelative = pamoWeapDef->amo_plRelative;
        pamoWeapRen->amo_moModelObject.Synchronize(pamoWeapDef->amo_moModelObject);
      }
    }
  }

  // set weapon
  void SetWeapon(void) {
    INDEX iWeapon = ((CPlayerWeapons&)*(((CPlayer&)*m_penPlayer).m_penWeapons)).m_iCurrentWeapon;
    m_iWeaponLast = iWeapon;
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pmoModel = &(pl.GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject);
    switch (iWeapon) {
      case WEAPON_NONE:
        break;

      // *********** KNIFE ***********
      case WEAPON_CROWBAR:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_CROWBAR, MODEL_CROWBAR, TEXTURE_CROWBAR, TEX_REFL_BWRIPLES02, TEX_SPEC_WEAK, 0);
        break;

      // *********** COLT ***********
      case WEAPON_PISTOL:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_USP, MODEL_PISTOL, TEXTURE_PISTOL, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_USP);
        AddWeaponAttachment(0, MODEL_FLARE02, TEXTURE_FLARE02, 0, 0, 0);
        break;

      // *********** DOUBLE COLT ***********
      case WEAPON_357:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_357, MODEL_357, TEXTURE_357, TEX_REFL_LIGHTBLUEMETAL01, TEX_SPEC_MEDIUM, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_357);
        AddWeaponAttachment(0, MODEL_FLARE02, TEXTURE_FLARE02, 0, 0, 0);
        break;

      // *********** SINGLE SHOTGUN ***********
      case WEAPON_SPAS:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_SPAS, MODEL_SHOTGUN, TEXTURE_SHOTGUN, TEX_REFL_DARKMETAL, TEX_SPEC_WEAK, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_SPAS);
        AddWeaponAttachment(0, MODEL_FLARE02, TEXTURE_FLARE02, 0, 0, 0);
        break;

      // *********** TOMMYGUN ***********
      case WEAPON_SMG1:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_SMG1, MODEL_SMG1, TEXTURE_SMG1, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_SMG1);
        AddWeaponAttachment(0, MODEL_FLARE02, TEXTURE_FLARE02, 0, 0, 0);
        break;

      // *********** SNIPER ***********
      case WEAPON_CROSSBOW:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_CROSSBOW, MODEL_CROSSBOW, TEXTURE_CROSSBOW, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;

      case WEAPON_G3SG1:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_G3SG1, MODEL_G3SG1, TEXTURE_G3SG1, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_G3SG1);
        AddWeaponAttachment(0, MODEL_FLARE02, TEXTURE_FLARE02, 0, 0, 0);
        break;

      // *********** MINIGUN ***********
      case WEAPON_AR2:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_AR2, MODEL_AR2, TEXTURE_AR2, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_AR2);
        AddWeaponAttachment(0, MODEL_FLARE02, TEXTURE_AR2_FLARE, 0, 0, 0);
        break;

      // *********** ROCKET LAUNCHER ***********
      case WEAPON_RPG:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_RPG, MODEL_RPG, TEXTURE_RPG, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;

      // *********** GRENADE LAUNCHER ***********
      case WEAPON_GRENADE:
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_GRENADE, MODEL_GRENADE, TEXTURE_GRENADE, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;

      // *********** FLAMER ***********
      case WEAPON_FLAMER:
        AddWeaponAttachment(BODY_ATTACHMENT_FLAMER, MODEL_FLAMER, TEXTURE_FL_BODY, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_FLAMER);
        AddWeaponAttachment(FLAMERITEM_ATTACHMENT_BODY, MODEL_FL_BODY, TEXTURE_FL_BODY, TEX_REFL_BWRIPLES02, TEX_SPEC_MEDIUM, 0);
        AddWeaponAttachment(FLAMERITEM_ATTACHMENT_FUEL, MODEL_FL_RESERVOIR, TEXTURE_FL_FUELRESERVOIR, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddWeaponAttachment(FLAMERITEM_ATTACHMENT_FLAME, MODEL_FL_FLAME, TEXTURE_FL_FLAME, 0, 0, 0);
        break;

      // *********** CHAINSAW ***********
      case WEAPON_GRAVITYGUN: {
        AddWeaponAttachment(BODY_ATTACHMENT_TOMMYGUN, MODEL_HANDLER, TEXTURE_CROWBAR, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_TOMMYGUN);
        AddWeaponAttachment(ITEMHANDLER_ATTACHMENT_GRAVITYGUN, MODEL_GRAVITYGUN, TEXTURE_GRAVITYGUN, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);

        SetAttachment(ITEMHANDLER_ATTACHMENT_GRAVITYGUN);
        AddWeaponAttachment(0, MODEL_FLARE01, TEXTURE_GG_FLARE, 0, 0, 0);
        break; }

      // *********** LASER ***********
      case WEAPON_LASER:
        AddWeaponAttachment(BODY_ATTACHMENT_LASER, MODEL_LASER, TEXTURE_LS_BODY, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_LASER);
        AddWeaponAttachment(LASERITEM_ATTACHMENT_BODY, MODEL_LS_BODY, TEXTURE_LS_BODY, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddWeaponAttachment(LASERITEM_ATTACHMENT_LEFTUP,    MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddWeaponAttachment(LASERITEM_ATTACHMENT_LEFTDOWN,  MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddWeaponAttachment(LASERITEM_ATTACHMENT_RIGHTUP,   MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        AddWeaponAttachment(LASERITEM_ATTACHMENT_RIGHTDOWN, MODEL_LS_BARREL, TEXTURE_LS_BARREL, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;

      // *********** CANNON ***********
      case WEAPON_IRONCANNON:
        AddWeaponAttachment(BODY_ATTACHMENT_CANNON, MODEL_CANNON, TEXTURE_CANNON, 0, 0, 0);
        SetAttachment(BODY_ATTACHMENT_CANNON);
        AddWeaponAttachment(CANNON_ATTACHMENT_BODY, MODEL_CN_BODY, TEXTURE_CANNON, TEX_REFL_LIGHTMETAL01, TEX_SPEC_MEDIUM, 0);
        break;

      default:
        ASSERTALWAYS("Unknown weapon.");
    }
    // sync apperances
    SyncWeapon();
  };

  // set item
  void SetItem(CModelObject *pmo) {
    pmoModel = &(GetPlayer()->GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject);
    AddWeaponAttachment(BODY_ATTACHMENT_ITEM, MODEL_GOLDAMON,
                        TEXTURE_GOLDAMON, TEX_REFL_GOLD01, TEX_SPEC_MEDIUM, 0);
    if (pmo!=NULL) {
      CPlayer &pl = (CPlayer&)*m_penPlayer;
      CAttachmentModelObject *pamo = pl.GetModelObject()->GetAttachmentModelList(PLAYER_ATTACHMENT_TORSO, BODY_ATTACHMENT_ITEM, -1);
      pmoModel = &(pamo->amo_moModelObject);
      pmoModel->Copy(*pmo);
      pmoModel->StretchModel(FLOAT3D(1,1,1));
      pamo->amo_plRelative = CPlacement3D(FLOAT3D(0,0,0), ANGLE3D(0,0,0));
    }
    // sync apperances
    SyncWeapon();
  }

  // set player body animation
  void SetBodyAnimation(INDEX iAnimation, ULONG ulFlags) {
    // skip anim on weapon change or on firing
    if (m_bChangeWeapon || m_bAttacking) {
      return;
    }

    // play body anim
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    CModelObject &moBody = pl.GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject;
    moBody.PlayAnim(iAnimation, ulFlags);
    m_fBodyAnimTime = moBody.GetAnimLength(iAnimation); // anim length
  };


/************************************************************
 *                      INITIALIZE                          *
 ************************************************************/
  void Initialize(void) {
    // set internal properties
    m_bReference = TRUE;
    m_bWaitJumpAnim = FALSE;
    m_bCrouch = FALSE;
    m_iCrouchDownWait = 0;
    m_iRiseUpWait = 0;
    m_bChangeWeapon = FALSE;
    m_bSwim = FALSE;
    m_bAttacking = FALSE;

    // clear eyes offsets
    m_fEyesYLastOffset = 0.0f;
    m_fEyesYOffset = 0.0f;
    m_fEyesYSpeed = 0.0f;
    m_fWeaponYLastOffset = 0.0f;
    m_fWeaponYOffset = 0.0f;
    m_fWeaponYSpeed = 0.0f;
    
    // clear moving banking
    m_bMoving = FALSE;
    m_fMoveLastBanking = 0.0f;
    m_fMoveBanking = 0.0f;
    m_iMovingSide = 0;
    m_bSidestepBankingLeft = FALSE;
    m_bSidestepBankingRight = FALSE;
    m_fSidestepLastBanking = 0.0f;
    m_fSidestepBanking = 0.0f;

    // [Cecil]
    m_fWeaponAnim = 0.0f;
    m_fWeaponAnimLast = 0.0f;
    m_bWeaponMove = FALSE;

    // weapon
    SetWeapon();
    SetBodyAnimation(BODY_ANIM_COLT_STAND, AOF_LOOPING|AOF_NORESTART);
  };

/************************************************************
 *                ANIMATE BANKING AND SOFT EYES             *
 ************************************************************/
  // store for lerping
  void StoreLast(void) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    m_vLastPlayerPosition = pl.GetPlacement().pl_PositionVector;  // store last player position
    m_fEyesYLastOffset = m_fEyesYOffset;                          // store last eyes offset
    m_fWeaponYLastOffset = m_fWeaponYOffset;
    m_fMoveLastBanking = m_fMoveBanking;                          // store last banking for lerping
    m_fSidestepLastBanking = m_fSidestepBanking;

    // [Cecil]
    m_fWeaponAnimLast = m_fWeaponAnim;
  };

  // animate banking
  void AnimateBanking(void) {
    // moving -> change banking
    if (m_bMoving) {
      // move banking left
      if (m_iMovingSide == 0) {
        m_fMoveBanking += 0.35f;
        if (m_fMoveBanking > 1.0f) { 
          m_fMoveBanking = 1.0f;
          m_iMovingSide = 1;
        }
      // move banking right
      } else {
        m_fMoveBanking -= 0.35f;
        if (m_fMoveBanking < -1.0f) {
          m_fMoveBanking = -1.0f;
          m_iMovingSide = 0;
        }
      }
      const FLOAT fBankingSpeed = 0.4f;

      // sidestep banking left
      if (m_bSidestepBankingLeft) {
        m_fSidestepBanking += fBankingSpeed;
        if (m_fSidestepBanking > 1.0f) { m_fSidestepBanking = 1.0f; }
      }
      // sidestep banking right
      if (m_bSidestepBankingRight) {
        m_fSidestepBanking -= fBankingSpeed;
        if (m_fSidestepBanking < -1.0f) { m_fSidestepBanking = -1.0f; }
      }

    // restore banking
    } else {
      // move banking
      if (m_fMoveBanking > 0.0f) {
        m_fMoveBanking -= 0.1f;
        if (m_fMoveBanking < 0.0f) { m_fMoveBanking = 0.0f; }
      } else if (m_fMoveBanking < 0.0f) {
        m_fMoveBanking += 0.1f;
        if (m_fMoveBanking > 0.0f) { m_fMoveBanking = 0.0f; }
      }

      // sidestep banking
      if (m_fSidestepBanking > 0.0f) {
        m_fSidestepBanking -= 0.4f;
        if (m_fSidestepBanking < 0.0f) { m_fSidestepBanking = 0.0f; }
      } else if (m_fSidestepBanking < 0.0f) {
        m_fSidestepBanking += 0.4f;
        if (m_fSidestepBanking > 0.0f) { m_fSidestepBanking = 0.0f; }
      }
    }

    // [Cecil] Own animation
    if (m_bWeaponMove) {
      m_fWeaponAnim = Clamp(m_fWeaponAnim + 0.1f, 0.0f, 1.0f);

    } else if (Abs(m_fWeaponAnim) > 0.01f) {
      m_fWeaponAnim /= 1.25f;
    } else {
      m_fWeaponAnim = 0.0f;
    }

    if (GetPlayer()->GetSettings()->ps_ulFlags&PSF_NOBOBBING) {
      m_fSidestepBanking = m_fMoveBanking = 0.0f;

      // [Cecil]
      m_fWeaponAnim = 0.0f;
    }
  };

  // animate soft eyes
  void AnimateSoftEyes(void) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    // find eyes offset and speed (differential formula realized in numerical mathematics)
    FLOAT fRelY = (pl.GetPlacement().pl_PositionVector-m_vLastPlayerPosition) %
                  FLOAT3D(pl.en_mRotation(1, 2), pl.en_mRotation(2, 2), pl.en_mRotation(3, 2));

    // if just jumped
    if (pl.en_tmJumped > _pTimer->CurrentTick()-0.5f) {
      fRelY = ClampUp(fRelY, 0.0f);
    }

    m_fEyesYOffset -= fRelY;
    m_fWeaponYOffset -= ClampUp(fRelY, 0.0f);

    plr_fViewDampFactor      = Clamp(plr_fViewDampFactor      ,0.0f,1.0f);
    plr_fViewDampLimitGroundUp = Clamp(plr_fViewDampLimitGroundUp ,0.0f,2.0f);
    plr_fViewDampLimitGroundDn = Clamp(plr_fViewDampLimitGroundDn ,0.0f,2.0f);
    plr_fViewDampLimitWater  = Clamp(plr_fViewDampLimitWater  ,0.0f,2.0f);

    m_fEyesYSpeed = (m_fEyesYSpeed - m_fEyesYOffset*plr_fViewDampFactor) * (1.0f-plr_fViewDampFactor);
    m_fEyesYOffset += m_fEyesYSpeed;
    
    m_fWeaponYSpeed = (m_fWeaponYSpeed - m_fWeaponYOffset*plr_fViewDampFactor) * (1.0f-plr_fViewDampFactor);
    m_fWeaponYOffset += m_fWeaponYSpeed;

    if (m_bSwim) {
      m_fEyesYOffset = Clamp(m_fEyesYOffset, -plr_fViewDampLimitWater,  +plr_fViewDampLimitWater);
      m_fWeaponYOffset = Clamp(m_fWeaponYOffset, -plr_fViewDampLimitWater,  +plr_fViewDampLimitWater);
    } else {
      m_fEyesYOffset = Clamp(m_fEyesYOffset, -plr_fViewDampLimitGroundDn,  +plr_fViewDampLimitGroundUp);
      m_fWeaponYOffset = Clamp(m_fWeaponYOffset, -plr_fViewDampLimitGroundDn,  +plr_fViewDampLimitGroundUp);
    }
  };

  // change view
  void ChangeView(CPlacement3D &pl) {
    TIME tmNow = _pTimer->GetLerpedCurrentTick();
    FLOAT fFactor = _pTimer->GetLerpFactor();

    // [Cecil] Don't animate if dead
    if (!(GetPlayer()->GetFlags() & ENF_ALIVE)) {
      return;
    }

    if (!(GetPlayer()->GetSettings()->ps_ulFlags&PSF_NOBOBBING)) {
      // banking
      FLOAT fBanking = Lerp(m_fMoveLastBanking, m_fMoveBanking, fFactor);
      fBanking = fBanking * fBanking * Sgn(fBanking) * 0.25f;
      fBanking += Lerp(m_fSidestepLastBanking, m_fSidestepBanking, fFactor);
      fBanking = Clamp(fBanking, -5.0f, 5.0f);
      pl.pl_OrientationAngle(3) += fBanking;

      // [Cecil] Recoil shake
      ANGLE3D aLastRecoil = GetPlayer()->m_aLastRecoilShake * GetPlayer()->m_fLastRecoilPower;
      ANGLE3D aRecoil = GetPlayer()->m_aRecoilShake * GetPlayer()->m_fRecoilPower;
      pl.pl_OrientationAngle(1) += Lerp(aLastRecoil(1), aRecoil(1), fFactor);
      pl.pl_OrientationAngle(2) += Lerp(aLastRecoil(2), aRecoil(2), fFactor);
      pl.pl_OrientationAngle(3) += Lerp(aLastRecoil(3), aRecoil(3), fFactor);
    }

    // [Cecil] Camera shake
    ANGLE3D aLastCamera = GetPlayer()->m_aLastCameraShake;
    ANGLE3D aCamera = GetPlayer()->m_aCameraShake;
    pl.pl_OrientationAngle(1) += Lerp(aLastCamera(1), aCamera(1), fFactor);
    pl.pl_OrientationAngle(2) += Lerp(aLastCamera(2), aCamera(2), fFactor);
    pl.pl_OrientationAngle(3) += Lerp(aLastCamera(3), aCamera(3), fFactor);

    // [Cecil] Not needed for now
    // swimming
    /*if (m_bSwim) {
      pl.pl_OrientationAngle(1) += sin(tmNow*0.9)*2.0f;
      pl.pl_OrientationAngle(2) += sin(tmNow*1.7)*2.0f;
      pl.pl_OrientationAngle(3) += sin(tmNow*2.5)*2.0f;
    }*/

    // eyes up/down for jumping and breathing
    FLOAT fEyesOffsetY = Lerp(m_fEyesYLastOffset, m_fEyesYOffset, fFactor);
    fEyesOffsetY+= sin(tmNow*1.5)*0.05f * plr_fBreathingStrength;
    fEyesOffsetY = Clamp(fEyesOffsetY, -1.0f, 1.0f);
    pl.pl_PositionVector(2) += fEyesOffsetY;
  }



/************************************************************
 *                     ANIMATE PLAYER                       *
 ************************************************************/
  // body and head animation
  void BodyAndHeadOrientation(CPlacement3D &plView) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    CAttachmentModelObject *pamoBody = pl.GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO);
    ANGLE3D a = plView.pl_OrientationAngle;

    if (!(pl.GetFlags()&ENF_ALIVE)) {
      a = ANGLE3D(0,0,0);
    }

    pamoBody->amo_plRelative.pl_OrientationAngle = a;
    pamoBody->amo_plRelative.pl_OrientationAngle(3) *= 4.0f;
    
    CAttachmentModelObject *pamoHead = (pamoBody->amo_moModelObject).GetAttachmentModel(BODY_ATTACHMENT_HEAD);
    pamoHead->amo_plRelative.pl_OrientationAngle = a;
    pamoHead->amo_plRelative.pl_OrientationAngle(1) = 0.0f;
    pamoHead->amo_plRelative.pl_OrientationAngle(2) = 0.0f;
    pamoHead->amo_plRelative.pl_OrientationAngle(3) *= 4.0f;

    // forbid players from cheating by kissing their @$$
    const FLOAT fMaxBanking = 5.0f;
    pamoBody->amo_plRelative.pl_OrientationAngle(3) = Clamp(pamoBody->amo_plRelative.pl_OrientationAngle(3), -fMaxBanking, fMaxBanking);
    pamoHead->amo_plRelative.pl_OrientationAngle(3) = Clamp(pamoHead->amo_plRelative.pl_OrientationAngle(3), -fMaxBanking, fMaxBanking);
  };

  // animate player
  void AnimatePlayer(void) {
    if (m_bDisableAnimating) {
      return;
    }

    CPlayer &pl = (CPlayer&)*m_penPlayer;

    FLOAT3D vDesired = pl.en_vDesiredTranslationRelative;
    FLOAT3D vCurrent = pl.en_vCurrentTranslationAbsolute * !pl.en_mRotation;
    ANGLE3D aDesired = pl.en_aDesiredRotationRelative;
    ANGLE3D aCurrent = pl.en_aCurrentRotationAbsolute;

    // [Cecil] Weapon animation
    FLOAT3D vDesiredHor = FLOAT3D(vDesired(1), 0.0f, vDesired(3));
    FLOAT3D vCurrentHor = FLOAT3D(vCurrent(1), 0.0f, vCurrent(3));
    m_bWeaponMove = (vDesiredHor.Length() > 1.0f && vCurrentHor.Length() > 1.0f) && !m_bSwim && !m_bCrouch;

    // swimming
    if (m_bSwim) {
      INDEX iAnim = (vDesired.Length() > 1.0f && vCurrent.Length() > 1.0f) ? PLAYER_ANIM_SWIM : PLAYER_ANIM_SWIMIDLE;
      pl.StartModelAnim(iAnim, AOF_LOOPING|AOF_NORESTART);
      BodyStillAnimation();

    // stand
    } else {
      // has reference (floor)
      if (m_bReference) {
        // jump
        if (pl.en_tmJumped + _pTimer->TickQuantum >= _pTimer->CurrentTick() && pl.en_tmJumped <= _pTimer->CurrentTick()) {
          m_bReference = FALSE;
          pl.StartModelAnim(PLAYER_ANIM_JUMPSTART, AOF_NORESTART);
          BodyStillAnimation();

        // not in jump anim and in stand mode change
        } else if (!m_bWaitJumpAnim && m_iCrouchDownWait == 0 && m_iRiseUpWait == 0) {
          // standing
          if (!m_bCrouch) {
            // running anim
            if (vDesired.Length() > 5.0f && vCurrent.Length() > 5.0f) {
              pl.StartModelAnim((vCurrent(3) < 0) ? PLAYER_ANIM_RUN : PLAYER_ANIM_BACKPEDALRUN, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // walking anim
            } else if (vDesired.Length() > 2.0f && vCurrent.Length() > 2.0f) {
              pl.StartModelAnim((vCurrent(3) < 0) ? PLAYER_ANIM_NORMALWALK : PLAYER_ANIM_BACKPEDAL, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // left rotation anim
            } else if (aDesired(1) > 0.5f) {
              pl.StartModelAnim(PLAYER_ANIM_TURNLEFT, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // right rotation anim
            } else if (aDesired(1) < -0.5f) {
              pl.StartModelAnim(PLAYER_ANIM_TURNRIGHT, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // standing anim
            } else {
              pl.StartModelAnim(PLAYER_ANIM_STAND, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();
            }
          // crouch
          } else {
            // walking anim
            if (vDesired.Length() > 2.0f && vCurrent.Length() > 2.0f) {
              pl.StartModelAnim((vCurrent(3) < 0) ? PLAYER_ANIM_CROUCH_WALK : PLAYER_ANIM_CROUCH_WALKBACK, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // left rotation anim
            } else if (aDesired(1) > 0.5f) {
              pl.StartModelAnim(PLAYER_ANIM_CROUCH_TURNLEFT, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // right rotation anim
            } else if (aDesired(1) < -0.5f) {
              pl.StartModelAnim(PLAYER_ANIM_CROUCH_TURNRIGHT, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();

            // standing anim
            } else {
              pl.StartModelAnim(PLAYER_ANIM_CROUCH_IDLE, AOF_LOOPING|AOF_NORESTART);
              BodyStillAnimation();
            }
          }
        }

      // no reference (in air)
      } else {                           
        // touched reference
        if (pl.en_penReference != NULL) {
          m_bReference = TRUE;
          pl.StartModelAnim(PLAYER_ANIM_JUMPEND, AOF_NORESTART);
          BodyStillAnimation();
          SpawnReminder(this, pl.GetModelObject()->GetAnimLength(PLAYER_ANIM_JUMPEND), (INDEX)AA_JUMPDOWN);
          m_bWaitJumpAnim = TRUE;
        }
      }
    }

    // moving view change
    // translating -> change banking
    if (m_bReference != NULL && vDesired.Length() > 1.0f && vCurrent.Length() > 1.0f) {
      m_bMoving = TRUE;
      // sidestep banking
      FLOAT vSidestepSpeedDesired = vDesired(1);
      FLOAT vSidestepSpeedCurrent = vCurrent(1);

      // right
      if (vSidestepSpeedDesired > 1.0f && vSidestepSpeedCurrent > 1.0f) {
        m_bSidestepBankingRight = TRUE;
        m_bSidestepBankingLeft = FALSE;
      // left
      } else if (vSidestepSpeedDesired < -1.0f && vSidestepSpeedCurrent < -1.0f) {
        m_bSidestepBankingLeft = TRUE;
        m_bSidestepBankingRight = FALSE;
      // none
      } else {
        m_bSidestepBankingLeft = FALSE;
        m_bSidestepBankingRight = FALSE;
      }
    // in air (space) or not moving
    } else {
      m_bMoving = FALSE;
      m_bSidestepBankingLeft = FALSE;
      m_bSidestepBankingRight = FALSE;
    }
  };

  // crouch
  void Crouch(void) {
    if (m_bDisableAnimating) {
      return;
    }
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.StartModelAnim(PLAYER_ANIM_CROUCH, AOF_NORESTART);
    SpawnReminder(this, pl.GetModelObject()->GetAnimLength(PLAYER_ANIM_CROUCH), (INDEX) AA_CROUCH);
    m_iCrouchDownWait++;
    m_bCrouch = TRUE;
  };

  // rise
  void Rise(void) {
    if (m_bDisableAnimating) {
      return;
    }
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.StartModelAnim(PLAYER_ANIM_RISE, AOF_NORESTART);
    SpawnReminder(this, pl.GetModelObject()->GetAnimLength(PLAYER_ANIM_RISE), (INDEX) AA_RISE);
    m_iRiseUpWait++;
    m_bCrouch = FALSE;
  };

  // fall
  void Fall(void) {
    if (m_bDisableAnimating) {
      return;
    }
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.StartModelAnim(PLAYER_ANIM_JUMPSTART, AOF_NORESTART);
    if (_pNetwork->ga_ulDemoMinorVersion>6) { m_bCrouch = FALSE; }
    m_bReference = FALSE;
  };

  // swim
  void Swim(void) {
    if (m_bDisableAnimating) {
      return;
    }
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.StartModelAnim(PLAYER_ANIM_SWIM, AOF_LOOPING|AOF_NORESTART);
    if (_pNetwork->ga_ulDemoMinorVersion>2) { m_bCrouch = FALSE; }
    m_bSwim = TRUE;
  };

  // stand
  void Stand(void) {
    if (m_bDisableAnimating) {
      return;
    }
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pl.StartModelAnim(PLAYER_ANIM_STAND, AOF_LOOPING|AOF_NORESTART);
    if (_pNetwork->ga_ulDemoMinorVersion>2) { m_bCrouch = FALSE; }
    m_bSwim = FALSE;
  };

  // fire/attack
  void FireAnimation(INDEX iAnim, ULONG ulFlags) {
    if (m_bSwim) {
      INDEX iWeapon = ((CPlayerWeapons&)*(((CPlayer&)*m_penPlayer).m_penWeapons)).m_iCurrentWeapon;
      switch (iWeapon) {
        case WEAPON_NONE:
        case WEAPON_CROWBAR: case WEAPON_PISTOL: case WEAPON_357:
        case WEAPON_GRENADE:
          iAnim += BODY_ANIM_COLT_SWIM_STAND-BODY_ANIM_COLT_STAND;
          break;
        case WEAPON_SPAS: case WEAPON_G3SG1: case WEAPON_SMG1:
        case WEAPON_CROSSBOW: case WEAPON_LASER: case WEAPON_FLAMER:
        case WEAPON_AR2: case WEAPON_RPG: case WEAPON_GRAVITYGUN:
          iAnim += BODY_ANIM_SHOTGUN_SWIM_STAND-BODY_ANIM_SHOTGUN_STAND;
          break;
        case WEAPON_IRONCANNON:
          iAnim += BODY_ANIM_MINIGUN_SWIM_STAND-BODY_ANIM_MINIGUN_STAND;
          break;
      }
    }
    m_bAttacking = FALSE;
    m_bChangeWeapon = FALSE;
    SetBodyAnimation(iAnim, ulFlags);

    if (!(ulFlags & AOF_LOOPING)) {
      SpawnReminder(this, m_fBodyAnimTime, (INDEX)AA_ATTACK);
      m_tmAttackingDue = _pTimer->CurrentTick() + m_fBodyAnimTime;
    }
    m_bAttacking = TRUE;
  };

  void FireAnimationOff(void) {
    m_bAttacking = FALSE;
  };
  
/************************************************************
 *                  CHANGE BODY ANIMATION                   *
 ************************************************************/
  // body animation template
  void BodyAnimationTemplate(INDEX iNone, INDEX iColt, INDEX iShotgun, INDEX iMinigun, ULONG ulFlags) {
    INDEX iWeapon = ((CPlayerWeapons&)*(((CPlayer&)*m_penPlayer).m_penWeapons)).m_iCurrentWeapon;
    switch (iWeapon) {
      case WEAPON_NONE:
        SetBodyAnimation(iNone, ulFlags);
        break;
      case WEAPON_CROWBAR: case WEAPON_PISTOL: case WEAPON_357:
      case WEAPON_GRENADE:
        if (m_bSwim) { iColt += BODY_ANIM_COLT_SWIM_STAND-BODY_ANIM_COLT_STAND; }
        SetBodyAnimation(iColt, ulFlags);
        break;
      case WEAPON_SPAS: case WEAPON_G3SG1: case WEAPON_SMG1:
      case WEAPON_CROSSBOW: case WEAPON_LASER: case WEAPON_FLAMER:
      case WEAPON_AR2: case WEAPON_RPG: case WEAPON_GRAVITYGUN:
        if (m_bSwim) { iShotgun += BODY_ANIM_SHOTGUN_SWIM_STAND-BODY_ANIM_SHOTGUN_STAND; }
        SetBodyAnimation(iShotgun, ulFlags);
        break;
      case WEAPON_IRONCANNON:
        if (m_bSwim) { iMinigun+=BODY_ANIM_MINIGUN_SWIM_STAND-BODY_ANIM_MINIGUN_STAND; }
        SetBodyAnimation(iMinigun, ulFlags);
        break;
      default: ASSERTALWAYS("Player Animator - Unknown weapon");
    }
  };

  // walk
  void BodyWalkAnimation() {
    BodyAnimationTemplate(BODY_ANIM_NORMALWALK, 
      BODY_ANIM_COLT_STAND, BODY_ANIM_SHOTGUN_STAND, BODY_ANIM_MINIGUN_STAND, 
      AOF_LOOPING|AOF_NORESTART);
  };

  // stand
  void BodyStillAnimation() {
    // [Cecil] Replaced wait animation with default animation
    BodyAnimationTemplate(BODY_ANIM_DEFAULT_ANIMATION, 
      BODY_ANIM_COLT_STAND, BODY_ANIM_SHOTGUN_STAND, BODY_ANIM_MINIGUN_STAND, 
      AOF_LOOPING|AOF_NORESTART);
  };

  // push weapon
  void BodyPushAnimation() {
    m_bAttacking = FALSE;
    m_bChangeWeapon = FALSE;

    // [Cecil] Replaced wait animation with default animation
    BodyAnimationTemplate(BODY_ANIM_DEFAULT_ANIMATION, 
      BODY_ANIM_COLT_REDRAW, BODY_ANIM_SHOTGUN_REDRAW, BODY_ANIM_MINIGUN_REDRAW, 0);

    m_bChangeWeapon = TRUE;
  };

  // remove weapon attachment
  void RemoveWeapon(void) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pmoModel = &(pl.GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject);
    switch (m_iWeaponLast) {
      case WEAPON_NONE:
        break;

      case WEAPON_CROWBAR:
      case WEAPON_PISTOL:
      case WEAPON_357:
      case WEAPON_SPAS:
      case WEAPON_SMG1:
      case WEAPON_CROSSBOW:
      case WEAPON_AR2:
      case WEAPON_RPG:
      case WEAPON_GRENADE:
      case WEAPON_GRAVITYGUN:
      case WEAPON_G3SG1:
        pmoModel->RemoveAttachmentModel(BODY_ATTACHMENT_TOMMYGUN);
        break;

      case WEAPON_FLAMER:
        pmoModel->RemoveAttachmentModel(BODY_ATTACHMENT_FLAMER);
        break;
      case WEAPON_LASER:
        pmoModel->RemoveAttachmentModel(BODY_ATTACHMENT_LASER);
        break;
      case WEAPON_IRONCANNON:
        pmoModel->RemoveAttachmentModel(BODY_ATTACHMENT_CANNON);
        break;

      default:
        ASSERT(FALSE);
    }
    // sync apperances
    SyncWeapon();
  };

  // pull weapon
  void BodyPullAnimation() {
    // reset the weapon
    RemoveWeapon();
    SetWeapon();

    // pull weapon
    m_bChangeWeapon = FALSE;

    // [Cecil] Attack has ended
    m_bAttacking = FALSE;

    // [Cecil] Replaced wait animation with default animation
    BodyAnimationTemplate(BODY_ANIM_DEFAULT_ANIMATION, BODY_ANIM_COLT_DRAW, BODY_ANIM_SHOTGUN_DRAW, BODY_ANIM_MINIGUN_DRAW, 0);
    INDEX iWeapon = ((CPlayerWeapons&)*(((CPlayer&)*m_penPlayer).m_penWeapons)).m_iCurrentWeapon;

    if (iWeapon != WEAPON_NONE) {
      m_bChangeWeapon = TRUE;
      SpawnReminder(this, m_fBodyAnimTime, (INDEX) AA_PULLWEAPON);
    }
    // sync apperances
    SyncWeapon();
  };

  // pull item
  void BodyPullItemAnimation() {
    // remove old weapon
    RemoveWeapon();

    // pull item
    m_bChangeWeapon = FALSE;
    SetBodyAnimation(BODY_ANIM_STATUE_PULL, 0);

    m_bChangeWeapon = TRUE;
    SpawnReminder(this, m_fBodyAnimTime, (INDEX) AA_PULLWEAPON);

    // sync apperances
    SyncWeapon();
  };

  // pick item
  void BodyPickItemAnimation() {
    // remove old weapon
    RemoveWeapon();

    // pick item
    m_bChangeWeapon = FALSE;
    SetBodyAnimation(BODY_ANIM_KEYLIFT, 0);

    m_bChangeWeapon = TRUE;
    SpawnReminder(this, m_fBodyAnimTime, (INDEX) AA_PULLWEAPON);

    // sync apperances
    SyncWeapon();
  };

  // remove item
  void BodyRemoveItem() {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    pmoModel = &(pl.GetModelObject()->GetAttachmentModel(PLAYER_ATTACHMENT_TORSO)->amo_moModelObject);
    pmoModel->RemoveAttachmentModel(BODY_ATTACHMENT_ITEM);
    // sync apperances
    SyncWeapon();
  };


/************************************************************
 *                      FIRE FLARE                          *
 ************************************************************/
  void OnPreRender(void) {
    ControlFlareAttachment();

    // [Cecil] Gravity Gun flare
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    CPlayerWeapons *pen = pl.GetPlayerWeapons();
    CAttachmentModelObject *pamo = pl.GetModelObject()->GetAttachmentModelList(
                                   PLAYER_ATTACHMENT_TORSO, BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_GRAVITYGUN, 0, -1);

    if (pamo != NULL) {
      if (pen->m_penHolding != NULL) {
        CModelObject &mo = pamo->amo_moModelObject;
        mo.StretchModel(FLOAT3D(0.5f, 0.5f, 0.5f));
      } else {
        CModelObject &mo = pamo->amo_moModelObject;
        mo.StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
      }
    }
  };

  // show flare
  void ShowFlare(INDEX iAttachWeapon, INDEX iAttachObject, INDEX iAttachFlare) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    CAttachmentModelObject *pamo = pl.GetModelObject()->GetAttachmentModelList(
      PLAYER_ATTACHMENT_TORSO, iAttachWeapon, iAttachObject, iAttachFlare, -1);
    if (pamo!=NULL) {
      pamo->amo_plRelative.pl_OrientationAngle(3) = (rand()*360.0f)/RAND_MAX;
      CModelObject &mo = pamo->amo_moModelObject;
      mo.StretchModel(FLOAT3D(1, 1, 1));
    }
  };

  // hide flare
  void HideFlare(INDEX iAttachWeapon, INDEX iAttachObject, INDEX iAttachFlare) {
    CPlayer &pl = (CPlayer&)*m_penPlayer;
    CAttachmentModelObject *pamo = pl.GetModelObject()->GetAttachmentModelList(
      PLAYER_ATTACHMENT_TORSO, iAttachWeapon, iAttachObject, iAttachFlare, -1);
    if (pamo!=NULL) {
      CModelObject &mo = pamo->amo_moModelObject;
      mo.StretchModel(FLOAT3D(0, 0, 0));
    }
  };

  // flare attachment
  void ControlFlareAttachment(void) {
    // get your prediction tail
    CPlayerAnimator *pen = (CPlayerAnimator *)GetPredictionTail();
    INDEX iWeapon = ((CPlayerWeapons&)*(((CPlayer&)*pen->m_penPlayer).m_penWeapons)).m_iCurrentWeapon;

    // add flare
    if (pen->m_iFlare == FLARE_ADD) {
      pen->m_iFlare = FLARE_REMOVE;
      pen->m_tmFlareAdded = _pTimer->CurrentTick();

      switch(iWeapon) {
        case WEAPON_PISTOL:
          ShowFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_USP, 0);
          break;
        case WEAPON_357:
          ShowFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_357, 0);
          break;
        case WEAPON_SPAS:
          ShowFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_SPAS, 0);
          break;
        case WEAPON_SMG1:
          ShowFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_SMG1, 0);
          break;
        case WEAPON_G3SG1:
          ShowFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_G3SG1, 0);
          break;
        case WEAPON_AR2:
          ShowFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_AR2, 0);
          break;
      }

    // remove
    } else if (m_iFlare == FLARE_REMOVE && _pTimer->CurrentTick() > pen->m_tmFlareAdded + _pTimer->TickQuantum) {
      switch(iWeapon) {
        case WEAPON_PISTOL:
          HideFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_USP, 0);
          break;
        case WEAPON_357:
          HideFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_357, 0);
          break;
        case WEAPON_SPAS:
          HideFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_SPAS, 0);
          break;
        case WEAPON_SMG1:
          HideFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_SMG1, 0);
          break;
        case WEAPON_G3SG1:
          HideFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_G3SG1, 0);
          break;
        case WEAPON_AR2:
          HideFlare(BODY_ATTACHMENT_TOMMYGUN, ITEMHANDLER_ATTACHMENT_AR2, 0);
          break;
      }
    }
  };



/************************************************************
 *                      PROCEDURES                          *
 ************************************************************/
procedures:
  ReminderAction(EReminder er) {
    switch (er.iValue) {
      case AA_JUMPDOWN: m_bWaitJumpAnim = FALSE; break;
      case AA_CROUCH: m_iCrouchDownWait--; ASSERT(m_iCrouchDownWait >= 0); break;
      case AA_RISE: m_iRiseUpWait--; ASSERT(m_iRiseUpWait >= 0); break;
      case AA_PULLWEAPON: m_bChangeWeapon = FALSE; break;
      case AA_ATTACK: if (m_tmAttackingDue <= _pTimer->CurrentTick()) { m_bAttacking = FALSE; } break;

      default: ASSERTALWAYS("Animator - unknown reminder action.");
    }
    return EBegin();
  };

  Main(EAnimatorInit eInit) {
    // remember the initial parameters
    ASSERT(eInit.penPlayer!=NULL);
    m_penPlayer = eInit.penPlayer;

    // declare yourself as a void
    InitAsVoid();
    SetFlags(GetFlags()|ENF_CROSSESLEVELS);
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    wait() {
      on (EBegin) : { resume; }
      on (EReminder er) : { call ReminderAction(er); }
      on (EEnd) : { stop; }
    }

    // cease to exist
    Destroy();

    return;
  };
};

