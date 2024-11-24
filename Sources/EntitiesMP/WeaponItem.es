802
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"

#include "EntitiesMP/PlayerWeapons.h"

// [Cecil] Half-Life 2 Weapons
#include "HL2Models/WeaponItemHandler.h"
#include "EntitiesMP/Cecil/Weapons.h"
%}

uses "EntitiesMP/Item";

// weapon type 
enum WeaponItemType {
  0 WIT_CROWBAR        "Crowbar", // [Cecil]
  1 WIT_USP            "HK USP",
  2 WIT_SMG1           "MP7 (Single Shotgun)",
  3 WIT_DOUBLESHOTGUN  "obsolete",
  4 WIT_SPAS           "SPAS-12",
  5 WIT_MINIGUN        "obsolete",
  6 WIT_ROCKETLAUNCHER "obsolete",
  7 WIT_GRENADE        "Grenade",
  8 WIT_CROSSBOW       "Crossbow",
  9 WIT_357            ".357 Magnum",
 10 WIT_AR2            "Pulse Rifle",
 11 WIT_GRAVITYGUN     "Gravity Gun",
 12 WIT_RPG            "RPG",
};

// event for sending through receive item
event EWeaponItem {
  INDEX iWeapon,   // weapon collected
  INDEX iAmmo,     // weapon ammo (used only for leaving weapons, -1 for deafult ammount)
  BOOL bDropped,    // for dropped weapons (can be picked even if weapons stay)
};

%{
extern void CPlayerWeapons_Precache(ULONG ulAvailable);

// [Cecil] Extracted from entity functions
void CWeaponItem_Precache(void) {
  CDLLEntityClass *pdec = &CWeaponItem_DLLClass;

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
};
%}

class CWeaponItem : CItem {
name      "Weapon Item";
thumbnail "Thumbnails\\WeaponItem.tbn";

properties:
  1 enum WeaponItemType m_EwitType "Type" 'Y' = WIT_USP, // weapon

components:
  0 class CLASS_BASE "Classes\\Item.ecl",
  1 model MODEL_ITEM "Models\\Items\\ItemHolder.mdl",

// [Cecil] New weapons
  5 model   MODEL_HANDLER      "Models\\Items\\WeaponItemHandler.mdl",
 10 model   MODEL_CROWBAR      "Models\\Items\\Crowbar.mdl",
 11 texture TEXTURE_CROWBAR    "Models\\Items\\Crowbar.tex",
 12 model   MODEL_PISTOL       "Models\\Items\\Pistol.mdl",
 13 texture TEXTURE_PISTOL     "Models\\Items\\Pistol.tex",
 14 model   MODEL_357          "Models\\Items\\357.mdl",
 15 texture TEXTURE_357        "Models\\Items\\357.tex",
 16 model   MODEL_SMG1         "Models\\Items\\SMG1.mdl",
 17 texture TEXTURE_SMG1       "Models\\Items\\SMG1.tex",
 18 model   MODEL_SHOTGUN      "Models\\Items\\Shotgun.mdl",
 19 texture TEXTURE_SHOTGUN    "Models\\Items\\Shotgun.tex",
 20 model   MODEL_AR2          "Models\\Items\\AR2.mdl",
 21 texture TEXTURE_AR2        "Models\\Items\\AR2.tex",
 22 model   MODEL_GRENADE      "Models\\Items\\Grenade.mdl",
 23 texture TEXTURE_GRENADE    "Models\\Items\\Grenade.tex",
 24 model   MODEL_RPG          "Models\\Items\\RPG.mdl",
 25 texture TEXTURE_RPG        "Models\\Items\\RPG.tex",
 26 model   MODEL_CROSSBOW     "Models\\Items\\Crossbow.mdl",
 27 texture TEXTURE_CROSSBOW   "Models\\Items\\Crossbow.tex",
 28 model   MODEL_GRAVITYGUN   "Models\\Items\\GravityGun.mdl",
 29 texture TEXTURE_GRAVITYGUN "Models\\Items\\GravityGun.tex",

// ************** REFLECTIONS **************
200 texture TEX_REFL_BWRIPLES01         "Models\\ReflectionTextures\\BWRiples01.tex",
201 texture TEX_REFL_BWRIPLES02         "Models\\ReflectionTextures\\BWRiples02.tex",
202 texture TEX_REFL_LIGHTMETAL01       "Models\\ReflectionTextures\\LightMetal01.tex",
203 texture TEX_REFL_LIGHTBLUEMETAL01   "Models\\ReflectionTextures\\LightBlueMetal01.tex",
204 texture TEX_REFL_DARKMETAL          "Models\\ReflectionTextures\\DarkMetal.tex",
205 texture TEX_REFL_PURPLE01           "Models\\ReflectionTextures\\Purple01.tex",

// ************** SPECULAR **************
210 texture TEX_SPEC_WEAK               "Models\\SpecularTextures\\Weak.tex",
211 texture TEX_SPEC_MEDIUM             "Models\\SpecularTextures\\Medium.tex",
212 texture TEX_SPEC_STRONG             "Models\\SpecularTextures\\Strong.tex",

functions:
  void Precache(void) {
    CWeaponItem_Precache();
  };

  // [Cecil] Physics overrides
  virtual INDEX GetPhysMaterial(void) const {
    switch (m_EwitType) {
      case WIT_CROWBAR: return SUR_METAL_NORMAL;
      case WIT_GRENADE: return SUR_PLASTIC_NORMAL; // [Cecil] TODO: Implement grenade surface
    }

    return SUR_WEAPON_NORMAL;
  };

  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_EwitType) {
      case WIT_CROWBAR:    vSize = FLOAT3D(0.3f, 0.05f, 1.7f); return COLSH_BOX;
      case WIT_USP:        vSize = FLOAT3D(0.3f, 0.075f, 0.5f); return COLSH_BOX;
      case WIT_SPAS:       vSize = FLOAT3D(0.4f, 0.075f, 1.5f); return COLSH_BOX;
      case WIT_SMG1:       vSize = FLOAT3D(0.45f, 0.075f, 0.9f); return COLSH_BOX;
      case WIT_GRENADE:    vSize = FLOAT3D(0.35f, 0.35f, 0.75f); return COLSH_CAPSULE;
      case WIT_CROSSBOW:   vSize = FLOAT3D(2.0f, 0.4f, 2.4f); return COLSH_BOX;
      case WIT_357:        vSize = FLOAT3D(0.35f, 0.08f, 0.7f); return COLSH_BOX;
      case WIT_GRAVITYGUN: vSize = FLOAT3D(0.6f, 0.4f, 1.5f); return COLSH_BOX;
      case WIT_AR2:        vSize = FLOAT3D(0.6f, 0.1f, 1.7f); return COLSH_BOX;
      case WIT_RPG:        vSize = FLOAT3D(0.6f, 0.25f, 2.2f); return COLSH_BOX;
    }

    return CItem::GetPhysCollision(vSize);
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    switch (m_EwitType) {
      case WIT_CROWBAR:    plOffset = CPlacement3D(FLOAT3D(-0.125f, 0.025f, -0.03125f), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_USP:        plOffset = CPlacement3D(FLOAT3D(0, 0.0375f, -0.03125f), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_SPAS:       plOffset = CPlacement3D(FLOAT3D(-0.03125f, 0.0375f, -0.09375f), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_SMG1:       plOffset = CPlacement3D(FLOAT3D(-0.03125f, 0.0375f, -0.09375f), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_GRENADE:    plOffset = CPlacement3D(FLOAT3D(0, 0.175f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_CROSSBOW:   plOffset = CPlacement3D(FLOAT3D(0, 0.2f, -0.03125f), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_357:        plOffset = CPlacement3D(FLOAT3D(-0.03125f, 0.04f, -0.0625f), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_GRAVITYGUN: plOffset = CPlacement3D(FLOAT3D(0, 0.2f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_AR2:        plOffset = CPlacement3D(FLOAT3D(0.03125f, 0.05f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case WIT_RPG:        plOffset = CPlacement3D(FLOAT3D(0.03125f, 0.125f, 0.05f), ANGLE3D(0, 0, 0)); return TRUE;
    }

    return CItem::GetPhysOffset(plOffset);
  };

  // [Cecil] TEMP: Special impact sounds for the crowbar
  virtual CTFileName PhysImpactSound(BOOL bHard) {
    if (m_EwitType == WIT_CROWBAR) {
      return CTString(0, "Models\\Weapons\\Crowbar\\Sounds\\Impact%d.wav", IRnd() % 2 + 1);
    }

    return CItem::PhysImpactSound(bHard);
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    pes->es_strName = m_strDescription; 
    pes->es_ctCount = 1;
    pes->es_ctAmmount = 1;
    pes->es_fValue = 1;
    pes->es_iScore = 0;//m_iScore;
    return TRUE;
  };

  // set weapon properties depending on weapon type
  void SetProperties(void) {
    // [Cecil] Patch types
    switch (m_EwitType) {
      case WIT_DOUBLESHOTGUN: m_EwitType = WIT_SMG1; break;
      case WIT_MINIGUN: m_EwitType = WIT_SPAS; break;
      case WIT_ROCKETLAUNCHER: m_EwitType = WIT_AR2; break;
    }

    StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
    ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);

    switch (m_EwitType) {
      case WIT_CROWBAR: {
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Crowbar");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_CROWBAR, MODEL_CROWBAR, TEXTURE_CROWBAR, 0, 0, 0);
      } break;

      case WIT_USP:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Colt");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_USP, MODEL_PISTOL, TEXTURE_PISTOL, 0, 0, 0);
        break;

      case WIT_SPAS:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Single Shotgun");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_SPAS, MODEL_SHOTGUN, TEXTURE_SHOTGUN, 0, 0, 0);
        break;

      case WIT_SMG1:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Tommygun");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_SMG1, MODEL_SMG1, TEXTURE_SMG1, 0, 0, 0);
        break;

      case WIT_GRENADE: {
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Grenade launcher");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_GRENADE, MODEL_GRENADE, TEXTURE_GRENADE, 0, 0, 0);
      } break;

      case WIT_CROSSBOW:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Sniper");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_CROSSBOW, MODEL_CROSSBOW, TEXTURE_CROSSBOW, 0, 0, 0);
        break;

      case WIT_357:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Flamer");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_357, MODEL_357, TEXTURE_357, 0, 0, 0);
        break;

      case WIT_GRAVITYGUN: {
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Chainsaw");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_GRAVITYGUN, MODEL_GRAVITYGUN, TEXTURE_GRAVITYGUN, 0, 0, 0);
        break; }
        
      case WIT_AR2:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Laser");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_AR2, MODEL_AR2, TEXTURE_AR2, 0, 0, 0);
        break;

      case WIT_RPG:
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Cannon");
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(WEAPONITEMHANDLER_ATTACHMENT_RPG, MODEL_RPG, TEXTURE_RPG, 0, 0, 0);
        break;
    }

    // [Cecil] Flare and bigger size
    AddFlare();
    StretchItem(FLOAT3D(2.0f, 2.0f, 2.0f));
  };

  // [Cecil] Reload model
  void AdjustDifficulty(void) {
    // Change type depending on gamemode
    INDEX iMode = GetSP()->sp_iHLGamemode;
    if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
      switch (iMode) {
        case HLGM_ARMSRACE: m_EwitType = WIT_CROWBAR; break;
        case HLGM_DISSOLVE: m_EwitType = WIT_AR2; break;
        case HLGM_BUNNYHUNT: m_EwitType = WIT_CROSSBOW; break;
        case HLGM_MINEKILL: m_EwitType = WIT_GRAVITYGUN; break;
        case HLGM_FLYROCKET: m_EwitType = WIT_RPG; break;
      }
    }

    RemoveSeeThroughFlag();

    SetModel(MODEL_ITEM);
    SetProperties();
  };

  // [Cecil]
  virtual BOOL IsItemLocal(void) const {
    return GetSP()->sp_bWeaponsStay;
  };

procedures:
  ItemCollected(EPass epass) : CItem::ItemCollected {
    ASSERT(epass.penOther!=NULL);

    // if weapons stays
    if (IsItemLocal() && !(m_bPickupOnce||m_bRespawn)) {
      // if already picked by this player
      BOOL bWasPicked = MarkPickedBy(epass.penOther);
      if (bWasPicked) {
        // don't pick again
        return;
      }
    }

    // send weapon to entity
    EWeaponItem eWeapon;
    eWeapon.iWeapon = m_EwitType;
    eWeapon.iAmmo = -1; // use default ammo amount
    eWeapon.bDropped = m_bDropped;
    // if weapon is received
    if (epass.penOther->ReceiveItem(eWeapon)) {
      if (!IsItemLocal() || m_bDropped || (m_bPickupOnce||m_bRespawn)) {
        jump CItem::ItemReceived();
      }
    }
    return;
  };

  Main() {
    Initialize(); // initialize base class
    SetProperties(); // set properties

    if (!m_bDropped) {
      jump CItem::ItemLoop();
    } else if (TRUE) {
      wait() {
        on (EBegin) : {
          // [Cecil] m_fRespawnTime -> m_fDropTime
          SpawnReminder(this, m_fDropTime, 0);
          call CItem::ItemLoop();
        }
        on (EReminder) : {
          SendEvent(EEnd()); 
          resume;
        }
      }
    }
  };
};
