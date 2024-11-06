803
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"
#include "Models/Items/Ammo/Shells/Shells.h"
#include "Models/Items/Ammo/Bullets/Bullets.h"
#include "Models/Items/Ammo/Rockets/Rockets.h"
#include "Models/Weapons/RocketLauncher/Projectile/Rocket.h"
#include "Models/Items/Ammo/Grenades/Grenades.h"
#include "Models/Items/Ammo/Electricity/Electricity.h"
#include "Models/Items/Ammo/Cannonball/Cannonball.h"
#include "Models/Items/Ammo/Cannonball/CannonballQuad.h"
#include "ModelsMP/Items/Ammo/SniperBullets/SniperBullets.h"

// [Cecil]
#include "EntitiesMP/Cecil/Weapons.h"
#include "EntitiesMP/AmmoPack.h"
#include "EntitiesMP/WeaponItem.h"
#include "HL2Models/AmmoHandler.h"

extern const INDEX _aiMaxMag[7];
%}

uses "EntitiesMP/Item";

// ammo type 
enum AmmoItemType {
 1 AIT_BULLETS     "Bullets + Pistol",
 2 AIT_SPAS        "Shells",
 3 AIT_ROCKETS     "obsolete",
 4 AIT_GRENADES    "Grenades",
 5 AIT_AR2         "Cores",
 6 AIT_NUKEBALL    "obsolete",
 7 AIT_RPG         "Rockets",
 8 AIT_SERIOUSPACK "SeriousPack",
 9 AIT_BACKPACK    "BackPack",
10 AIT_357         "Rounds",
11 AIT_BOLTS       "Bolts",

// Alt ammo
12 AIT_MP7GRENADES "MP7 Grenades (internal)",
13 AIT_ENERGYBALLS "Energy Balls (internal)",

// Separate ammo boxes
14 AIT_SMG1        "Bullets",
15 AIT_USP         "Pistol",
};

// event for sending through receive item
event EAmmoItem {
  enum AmmoItemType EaitType, // ammo type
  INDEX iQuantity,            // ammo quantity
};

%{
// [Cecil] Extracted from entity functions
void CAmmoItem_Precache(void) {
  CDLLEntityClass *pdec = &CAmmoItem_DLLClass;

  pdec->PrecacheModel(MODEL_HANDLER);
  pdec->PrecacheModel(MODEL_357);
  pdec->PrecacheTexture(TEXTURE_357);
  pdec->PrecacheModel(MODEL_AR2);
  pdec->PrecacheTexture(TEXTURE_AR2);
  pdec->PrecacheModel(MODEL_BOLTS);
  pdec->PrecacheTexture(TEXTURE_BOLTS);
  pdec->PrecacheModel(MODEL_GRENADE);
  pdec->PrecacheTexture(TEXTURE_GRENADE);
  pdec->PrecacheModel(MODEL_PISTOL);
  pdec->PrecacheTexture(TEXTURE_PISTOL);
  pdec->PrecacheModel(MODEL_ROCKET);
  pdec->PrecacheTexture(TEXTURE_ROCKET);
  pdec->PrecacheModel(MODEL_SMG1);
  pdec->PrecacheTexture(TEXTURE_SMG1);
  pdec->PrecacheModel(MODEL_SPAS);
  pdec->PrecacheTexture(TEXTURE_SPAS);

  pdec->PrecacheModel(MODEL_CRATE);
  pdec->PrecacheTexture(TEXTURE_CRATEBULLETS);
  pdec->PrecacheTexture(TEXTURE_CRATEGRENADES);

  // reflections and specular
  pdec->PrecacheTexture(TEX_REFL_LIGHTMETAL);
  pdec->PrecacheTexture(TEX_SPEC_WEAK);
  pdec->PrecacheTexture(TEX_SPEC_MEDIUM);
  pdec->PrecacheTexture(TEX_SPEC_STRONG);
};
%}

class CAmmoItem : CItem {
name      "Ammo Item";
thumbnail "Thumbnails\\AmmoItem.tbn";

properties:
  1 enum AmmoItemType m_EaitType "Type" 'Y' = AIT_BULLETS,

components:
  0 class CLASS_BASE    "Classes\\Item.ecl",
  1 model MODEL_ITEM    "Models\\Items\\ItemHolder.mdl",

// [Cecil] New ammo
  5 model   MODEL_HANDLER   "Models\\Items\\AmmoHandler.mdl",
 10 model   MODEL_357       "Models\\Items\\357Ammo.mdl",
 11 texture TEXTURE_357     "Models\\Items\\357Ammo.tex",
 12 model   MODEL_AR2       "Models\\Items\\AR2Ammo.mdl",
 13 texture TEXTURE_AR2     "Models\\Items\\AR2Ammo.tex",
 14 model   MODEL_BOLTS     "Models\\Items\\CrossbowBolts.mdl",
 15 texture TEXTURE_BOLTS   "Models\\Items\\CrossbowBolts.tex",
 16 model   MODEL_GRENADE   "Models\\Items\\Grenade.mdl",
 17 texture TEXTURE_GRENADE "Models\\Items\\Grenade.tex",
 18 model   MODEL_PISTOL    "Models\\Items\\PistolAmmo.mdl",
 19 texture TEXTURE_PISTOL  "Models\\Items\\PistolAmmo.tex",
 20 model   MODEL_ROCKET    "Models\\Items\\RPGRocket.mdl",
 21 texture TEXTURE_ROCKET  "Models\\Items\\RPGRocket.tex",
 22 model   MODEL_SMG1      "Models\\Items\\SMG1Ammo.mdl",
 23 texture TEXTURE_SMG1    "Models\\Items\\SMG1Ammo.tex",
 24 model   MODEL_SPAS      "Models\\Items\\SPASAmmo.mdl",
 25 texture TEXTURE_SPAS    "Models\\Items\\SPASAmmo.tex",

 30 model   MODEL_CRATE           "Models\\Items\\Crate.mdl",
 31 texture TEXTURE_CRATEBULLETS  "Models\\Items\\CrateBullets.tex",
 32 texture TEXTURE_CRATEGRENADES "Models\\Items\\CrateGrenades.tex",

// [Cecil] Reflections and specular
200 texture TEX_REFL_LIGHTMETAL "Models\\ReflectionTextures\\LightMetal01.tex",
201 texture TEX_SPEC_WEAK       "Models\\SpecularTextures\\Weak.tex",
202 texture TEX_SPEC_MEDIUM     "Models\\SpecularTextures\\Medium.tex",
203 texture TEX_SPEC_STRONG     "Models\\SpecularTextures\\Strong.tex",

functions:
  // [Cecil] Precache just in case
  void Precache(void) {
    CAmmoItem_Precache();
  };

  // [Cecil] Physics overrides
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_EaitType) {
      case AIT_SPAS:        vSize = FLOAT3D(0.44f, 0.29f, 0.35f); return COLSH_BOX;
      case AIT_BULLETS:
      case AIT_SMG1:        vSize = FLOAT3D(0.95f, 0.66f, 0.6f); return COLSH_BOX;
      case AIT_USP:         vSize = FLOAT3D(0.94f, 0.57f, 0.29f); return COLSH_BOX;
      case AIT_RPG:         vSize = FLOAT3D(0.2f, 0.2f, 1.5f); return COLSH_CAPSULE;
      case AIT_GRENADES:    vSize = FLOAT3D(0.35f, 0.35f, 0.75f); return COLSH_CAPSULE;
      case AIT_ROCKETS:
      case AIT_AR2:         vSize = FLOAT3D(0.55f, 0.12f, 0.5f); return COLSH_BOX;
      case AIT_357:         vSize = FLOAT3D(0.45f, 0.225f, 0.3f); return COLSH_BOX;
      case AIT_BOLTS:       vSize = FLOAT3D(0.125f, 0.125f, 1.1f); return COLSH_CAPSULE;
      case AIT_BACKPACK:    vSize = FLOAT3D(2.1f, 1.2f, 1.2f); return COLSH_BOX;
      case AIT_SERIOUSPACK: vSize = FLOAT3D(2.1f, 1.2f, 1.2f); return COLSH_BOX;
    }

    return CItem::GetPhysCollision(vSize);
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    switch (m_EaitType) {
      case AIT_SPAS:        plOffset = CPlacement3D(FLOAT3D(-0.02f, 0.145f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_BULLETS:
      case AIT_SMG1:        plOffset = CPlacement3D(FLOAT3D(0, 0.33f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_USP:         plOffset = CPlacement3D(FLOAT3D(0, 0.285f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_RPG:         plOffset = CPlacement3D(FLOAT3D(0, 0.1f, -0.1f), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_GRENADES:    plOffset = CPlacement3D(FLOAT3D(0, 0.175f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_ROCKETS:
      case AIT_AR2:         plOffset = CPlacement3D(FLOAT3D(0, 0.06f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_357:         plOffset = CPlacement3D(FLOAT3D(0, 0.1125f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_BOLTS:       plOffset = CPlacement3D(FLOAT3D(0, 0.0625f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_BACKPACK:    plOffset = CPlacement3D(FLOAT3D(0, 0.6f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case AIT_SERIOUSPACK: plOffset = CPlacement3D(FLOAT3D(0, 0.6f, 0), ANGLE3D(0, 0, 0)); return TRUE;
    }

    return CItem::GetPhysOffset(plOffset);
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes)
  {
    pes->es_ctCount = 1;
    pes->es_ctAmmount = m_fValue;
    switch (m_EaitType) {
      case AIT_BULLETS:
      case AIT_SMG1:
        pes->es_strName = "Bullets"; 
        pes->es_fValue = m_fValue*AV_SHELLS;
        break;
      case AIT_USP:
        pes->es_strName = "Pistol"; 
        pes->es_fValue = m_fValue*AV_SHELLS;
        break;
      case AIT_SPAS:
        pes->es_strName = "Shells"; 
        pes->es_fValue = m_fValue*AV_BULLETS;
        break;
      case AIT_GRENADES:
        pes->es_strName = "Grenades"; 
        pes->es_fValue = m_fValue*AV_GRENADES;
        break;
      case AIT_ROCKETS:
      case AIT_AR2:
        pes->es_strName = "Cores"; 
        pes->es_fValue = m_fValue*AV_ELECTRICITY;
        break;
      case AIT_RPG:
        pes->es_strName = "Rockets"; 
        pes->es_fValue = m_fValue*AV_IRONBALLS;
        break;
      case AIT_SERIOUSPACK:
        pes->es_strName = "SeriousPack"; 
        pes->es_fValue = m_fValue*100000;
        break;
      case AIT_BACKPACK:
        pes->es_strName = "BackPack"; 
        pes->es_fValue = m_fValue*100000;
        break;
      case AIT_357:
        pes->es_strName = "Napalm"; 
        pes->es_fValue = m_fValue*AV_NAPALM;
        break;
      case AIT_BOLTS:
        pes->es_strName = "Sniper bullets"; 
        pes->es_fValue = m_fValue*AV_SNIPERBULLETS;
        break;
    }
    pes->es_iScore = 0;
    return TRUE;
  }


  // set ammo properties depending on ammo type
  void SetProperties(void) {
    // [Cecil] Patch types
    switch (m_EaitType) {
      case AIT_NUKEBALL:
      case AIT_MP7GRENADES: m_EaitType = AIT_SMG1; break;
      case AIT_ROCKETS:
      case AIT_ENERGYBALLS: m_EaitType = AIT_AR2; break;
    }

    StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
    ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);

    switch (m_EaitType) {
      case AIT_SPAS:
        m_fValue = _aiMaxMag[MAG_SPAS];
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Shells: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_SPAS, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_SPAS, MODEL_SPAS, TEXTURE_SPAS, 0, 0, 0);
        break;

      case AIT_BULLETS:
      case AIT_SMG1:
        m_fValue = _aiMaxMag[MAG_SMG1];
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Bullets: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_SMG1, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_SMG1, MODEL_SMG1, TEXTURE_SMG1, 0, 0, 0);
        break;

      case AIT_USP:
        m_fValue = _aiMaxMag[MAG_USP];
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Pistol: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_PISTOL, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_PISTOL, MODEL_PISTOL, TEXTURE_PISTOL, 0, 0, 0);
        break;

      case AIT_RPG:
        m_fValue = _aiMaxMag[MAG_RPG];
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Rockets: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_ROCKET, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_ROCKET, MODEL_ROCKET, TEXTURE_ROCKET, 0, 0, 0);
        break;

      case AIT_GRENADES: {
        m_fValue = 1.0f;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Grenades: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_GRENADE, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_GRENADE, MODEL_GRENADE, TEXTURE_GRENADE, 0, 0, 0);
      } break;

      case AIT_ROCKETS:
      case AIT_AR2:
        m_fValue = _aiMaxMag[MAG_AR2];
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Electricity: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_AR2, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_AR2, MODEL_AR2, TEXTURE_AR2, 0, 0, 0);
        break;

      case AIT_357:
        m_fValue = _aiMaxMag[MAG_357];
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Napalm: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_357, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_357, MODEL_357, TEXTURE_357, 0, 0, 0);
        break;

      case AIT_BOLTS:
        m_fValue = _aiMaxMag[MAG_CROSSBOW]*3;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("Sniper bullets: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_BOLTS, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_BOLTS, MODEL_BOLTS, TEXTURE_BOLTS, 0, 0, 0);
        break;

      case AIT_BACKPACK:
        m_fValue = 1.0f;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("BackPack: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_CRATEBULLETS, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_CRATE, MODEL_CRATE, TEXTURE_CRATEBULLETS, 0, 0, 0);

        StretchItem(FLOAT3D(1.5f, 1.5f, 1.5f));
        break;

      case AIT_SERIOUSPACK:
        m_fValue = 1.0f;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f; 
        m_strDescription.PrintF("SeriousPack: %d", (int)m_fValue);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_CRATEGRENADES, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_CRATE, MODEL_CRATE, TEXTURE_CRATEGRENADES, 0, 0, 0);

        StretchItem(FLOAT3D(1.5f, 1.5f, 1.5f));
        break;
    }

    // [Cecil] Random rotation and bigger size
    //GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_plRelative.pl_OrientationAngle(1) = FRnd() * 360.0f;

    if (m_EaitType != AIT_BACKPACK && m_EaitType != AIT_SERIOUSPACK) {
      StretchItem(FLOAT3D(2.0f, 2.0f, 2.0f));
    }
  };

  void AdjustDifficulty(void) {
    if (m_penTarget == NULL) {
      // [Cecil] Not needed
      if (GetSP()->sp_bInfiniteAmmo || GetSP()->sp_iHLGamemode == HLGM_MINEKILL) {
        Destroy();
        return;
      }
    }

    // [Cecil] Change type depending on gamemode
    INDEX iMode = GetSP()->sp_iHLGamemode;
    if (iMode > HLGM_NONE && iMode < HLGM_LAST) {
      switch (iMode) {
        case HLGM_ARMSRACE: m_EaitType = AIT_BACKPACK; break;
        case HLGM_DISSOLVE: m_EaitType = AIT_AR2; break;
        case HLGM_BUNNYHUNT: m_EaitType = AIT_BOLTS; break;
        case HLGM_FLYROCKET: m_EaitType = AIT_RPG; break;
      }
    }

    // [Cecil] Reload model
    if (!m_bRespawn) {
      SetFlags(GetFlags() & ~ENF_SEETHROUGH);
    }

    SetModel(MODEL_ITEM);
    SetProperties();

    // [Cecil] Recreate the physics object
    CreateObject();

    m_fValue = ceil(m_fValue * GetSP()->sp_fAmmoQuantity);
  };

procedures:
  ItemCollected(EPass epass) : CItem::ItemCollected {
    ASSERT(epass.penOther!=NULL);

    // if ammo stays
    if (GetSP()->sp_bAmmoStays && !(m_bPickupOnce||m_bRespawn)) {
      // if already picked by this player
      BOOL bWasPicked = MarkPickedBy(epass.penOther);
      if (bWasPicked) {
        // don't pick again
        return;
      }
    }

    // [Cecil] Send Backpack Ammo
    if (m_EaitType == AIT_BACKPACK || m_EaitType == AIT_SERIOUSPACK) {
      INDEX iShells        = ClampDn(INDEX(_aiMaxMag[MAG_SPAS]  * GetSP()->sp_fAmmoQuantity), (INDEX)1);
      INDEX iBullets       = ClampDn(INDEX(_aiMaxMag[MAG_SMG1]  * GetSP()->sp_fAmmoQuantity), (INDEX)1);
      INDEX iGrenades      = ClampDn(INDEX(1.0f                 * GetSP()->sp_fAmmoQuantity), (INDEX)1);
      INDEX iNapalm        = ClampDn(INDEX(_aiMaxMag[MAG_357]   * GetSP()->sp_fAmmoQuantity), (INDEX)1);
      INDEX iElectricity   = ClampDn(INDEX(_aiMaxMag[MAG_AR2]   * GetSP()->sp_fAmmoQuantity), (INDEX)1);
      INDEX iIronBalls     = ClampDn(INDEX(_aiMaxMag[MAG_RPG]*3 * GetSP()->sp_fAmmoQuantity), (INDEX)1);
      INDEX iSniperBullets = ClampDn(INDEX(_aiMaxMag[MAG_CROSSBOW] * GetSP()->sp_fAmmoQuantity), (INDEX)1);

      EAmmoPackItem eAmmoPack;
      eAmmoPack.iShells = iShells;
      eAmmoPack.iBullets = iBullets;
      eAmmoPack.iGrenades = iGrenades;
      eAmmoPack.iNapalm = iNapalm;
      eAmmoPack.iElectricity = iElectricity;
      eAmmoPack.iIronBalls = iIronBalls;
      eAmmoPack.iSniperBullets = iSniperBullets;

      if (epass.penOther->ReceiveItem(eAmmoPack)) {
        if (!GetSP()->sp_bAmmoStays || (m_bPickupOnce || m_bRespawn)) {
          jump CItem::ItemReceived();
        }
      }
      return;
    }

    // send ammo to entity
    EAmmoItem eAmmo;
    eAmmo.EaitType = m_EaitType;

    // [Cecil] Give different amount of ammo depending on the difficulty
    INDEX iDifficulty = 1; // 0 - Easy; 1 - Normal; 2 - Hard

    if (GetSP()->sp_gdGameDifficulty < CSessionProperties::GD_NORMAL) {
      iDifficulty = 0;
    } else if (GetSP()->sp_gdGameDifficulty > CSessionProperties::GD_NORMAL) {
      iDifficulty = 2;
    }

    switch (m_EaitType) {
      case AIT_BULLETS:
      case AIT_SMG1: {
        switch (iDifficulty) {
          case 0: eAmmo.iQuantity = 54; break;
          case 1: eAmmo.iQuantity = 45; break;
          case 2: eAmmo.iQuantity = 27; break;
        }
      } break;

      case AIT_SPAS:
      case AIT_USP:
      case AIT_ROCKETS:
      case AIT_AR2: {
        switch (iDifficulty) {
          case 0: eAmmo.iQuantity = 24; break;
          case 1: eAmmo.iQuantity = 20; break;
          case 2: eAmmo.iQuantity = 12; break;
        }
      } break;

      case AIT_RPG:
      case AIT_GRENADES: {
        eAmmo.iQuantity = 1;
      } break;

      case AIT_357:
      case AIT_BOLTS: {
        switch (iDifficulty) {
          case 0: eAmmo.iQuantity = 7; break;
          case 1: eAmmo.iQuantity = 6; break;
          case 2: eAmmo.iQuantity = 3; break;
        }
      } break;

      // Edge case
      default: eAmmo.iQuantity = (INDEX)m_fValue;
    }

    // if health is received
    if (epass.penOther->ReceiveItem(eAmmo)) {
      if (!GetSP()->sp_bAmmoStays || (m_bPickupOnce || m_bRespawn)) {
        jump CItem::ItemReceived();
      }
    }
    return;
  };

  Main() {
    Initialize(); // initialize base class
    StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
    ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);
    SetProperties(); // set properties

    jump CItem::ItemLoop();
  };
};
