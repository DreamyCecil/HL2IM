806
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"

// [Cecil] Half-Life 2 Weapons
#include "EntitiesMP/Cecil/Weapons.h"
#include "HL2Models/AmmoHandler.h"
extern const INDEX _aiMaxAmmo[10];
extern const INDEX _aiMaxMag[7];
%}

uses "EntitiesMP/Item";

// ammo type 
enum AmmoPackType {
  1 APT_CUSTOM        "Custom pack",
  2 APT_SERIOUS       "Serious pack",
};

// event for sending through receive item
event EAmmoPackItem {
  INDEX iShells,
  INDEX iBullets,
  INDEX iRockets,
  INDEX iGrenades,
  INDEX iNapalm,
  INDEX iElectricity,
  INDEX iIronBalls,
  INDEX iSniperBullets,
};

%{
// [Cecil] Extracted from entity functions
void CAmmoPack_Precache(void) {
  CDLLEntityClass *pdec = &CAmmoPack_DLLClass;

  pdec->PrecacheModel(MODEL_HANDLER);
  pdec->PrecacheModel(MODEL_CRATE);
  pdec->PrecacheTexture(TEXTURE_BULLETS);
  pdec->PrecacheTexture(TEXTURE_GRENADES);
};
%}

class CAmmoPack : CItem {
name      "Ammo Pack";
thumbnail "Thumbnails\\AmmoPack.tbn";

properties:
  1 enum AmmoPackType  m_aptPackType    "Type" 'Y' = APT_CUSTOM,     // pack type

 10 INDEX m_iShells        "SPAS-12 Shells" 'S' = 60,
 11 INDEX m_iBullets       "MP7 Bullets"    'B' = 225,
 12 INDEX m_iRockets       "AR2 Cores 2"    'C' = 120,
 13 INDEX m_iGrenades      "Grenades"       'G' = 10,
 14 INDEX m_iNapalm        ".357 Bullets"   'P' = 24,
 15 INDEX m_iElectricity   "AR2 Cores"      'E' = 120,
 16 INDEX m_iIronBalls     "RPG Rockets"    'I' = 9,
 17 INDEX m_iSniperBullets "Crossbow Rods"  'N' = 20,

// [Cecil] Special flag
 20 BOOL m_bHL2Init = FALSE,

components:
  0 class CLASS_BASE "Classes\\Item.ecl",
  1 model MODEL_ITEM "Models\\Items\\ItemHolder.mdl",

// [Cecil] New ammo
  5 model   MODEL_HANDLER    "Models\\Items\\AmmoHandler.mdl",
 10 model   MODEL_CRATE      "Models\\Items\\Crate.mdl",
 11 texture TEXTURE_BULLETS  "Models\\Items\\CrateBullets.tex",
 12 texture TEXTURE_GRENADES "Models\\Items\\CrateGrenades.tex",

functions:
  // [Cecil] Precache just in case
  void Precache(void) {
    CAmmoPack_Precache();
  };

  // [Cecil] Physics overrides
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_aptPackType) {
      case APT_CUSTOM:
      case APT_SERIOUS: vSize = FLOAT3D(2.1f, 1.2f, 1.2f); return COLSH_BOX;
    }

    return CItem::GetPhysCollision(vSize);
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    switch (m_aptPackType) {
      case APT_CUSTOM:
      case APT_SERIOUS: plOffset = CPlacement3D(FLOAT3D(0, 0.6f, 0), ANGLE3D(0, 0, 0)); return TRUE;
    }

    return CItem::GetPhysOffset(plOffset);
  };

  virtual BOOL UseRealisticPhysics(void) const {
    return FALSE;
  };

  virtual BOOL CanGravityGunInteract(CCecilPlayerEntity *penPlayer) const {
    return FALSE;
  };

  // [Cecil] Read special flag (0.7 compatibility)
  void Read_t(CTStream *istr) {
    CItem::Read_t(istr);

    // check if was marked with a HL2 flag
    if (istr->PeekID_t() == CChunkID("HL2F")) {
      istr->GetID_t();
    }
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    pes->es_ctCount = 1;
    pes->es_ctAmmount = 1;
    // compile description
    pes->es_strName.PrintF("Back pack: %d Shells, %d Bullets, %d Rockets, %d Grenades, %d Napalm, %d Electricity, %d Iron balls, %d Sniper bullets",
      m_iShells, m_iBullets, m_iRockets, m_iGrenades, m_iNapalm, m_iElectricity, m_iIronBalls, m_iSniperBullets); 

    // calculate value
    pes->es_fValue = 
      m_iShells*AV_SHELLS + 
      m_iBullets*AV_BULLETS + 
      m_iRockets*AV_ROCKETS + 
      m_iGrenades*AV_GRENADES + 
      m_iNapalm*AV_NAPALM + 
      m_iElectricity*AV_ELECTRICITY + 
      m_iIronBalls*AV_IRONBALLS +
      m_iSniperBullets*AV_SNIPERBULLETS;

    pes->es_iScore = 0;
    return TRUE;
  };

  // set ammo properties depending on ammo type
  void SetProperties(void) {
    StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
    ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);

    switch (m_aptPackType) {
      case APT_CUSTOM:
        m_strDescription = "Custom:";

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_BULLETS, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_CRATE, MODEL_CRATE, TEXTURE_BULLETS, 0, 0, 0);
        break;

      case APT_SERIOUS:
        m_strDescription = "Serious:";

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_GRENADES, 0, 0, 0);
        AddItemAttachment(AMMOHANDLER_ATTACHMENT_CRATE, MODEL_CRATE, TEXTURE_GRENADES, 0, 0, 0);
        break;
    }

    // [Cecil] Bigger size
    StretchItem(FLOAT3D(1.5f, 1.5f, 1.5f));

    m_fValue = 1.0f;
    m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 30.0f;

    if (m_iShells != 0)        { m_strDescription.PrintF("%s: Shells (%d)", m_strDescription, m_iShells);}
    if (m_iBullets != 0)       { m_strDescription.PrintF("%s: Bullets (%d)", m_strDescription, m_iBullets);}
    if (m_iRockets != 0)       { m_strDescription.PrintF("%s: Rockets (%d)", m_strDescription, m_iRockets);}
    if (m_iGrenades != 0)      { m_strDescription.PrintF("%s: Grenades (%d)", m_strDescription, m_iGrenades);}
    if (m_iNapalm != 0)        { m_strDescription.PrintF("%s: Napalm (%d)", m_strDescription, m_iNapalm);}
    if (m_iElectricity != 0)   { m_strDescription.PrintF("%s: Electricity (%d)", m_strDescription, m_iElectricity);}
    if (m_iIronBalls != 0)     { m_strDescription.PrintF("%s: Iron balls (%d)", m_strDescription, m_iIronBalls);}
    if (m_iSniperBullets != 0) { m_strDescription.PrintF("%s: Sniper bullets (%d)", m_strDescription, m_iSniperBullets);}
  }

  void AdjustDifficulty(void) {
    if (m_penTarget == NULL) {
      // [Cecil] Not needed
      if (GetSP()->sp_bInfiniteAmmo || GetSP()->sp_iHLGamemode == HLGM_MINEKILL) {
        Destroy();
        return;
      }
    }

    // [Cecil] Reload model
    SetModel(MODEL_ITEM);
    SetProperties();

    // [Cecil] Adjust values based on the gamemode
    INDEX iMode = GetSP()->sp_iHLGamemode;
    switch (iMode) {
      case HLGM_ARMSRACE:
        if (m_aptPackType == APT_SERIOUS) {
          m_iShells        = ClampDn(INDEX(_aiMaxAmmo[4] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iBullets       = ClampDn(INDEX(_aiMaxAmmo[2] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iRockets       = 0.0f;
          m_iGrenades      = ClampDn(INDEX(_aiMaxAmmo[6] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iNapalm        = ClampDn(INDEX(_aiMaxAmmo[1] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iElectricity   = ClampDn(INDEX(_aiMaxAmmo[3] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iIronBalls     = ClampDn(INDEX(_aiMaxAmmo[7] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iSniperBullets = ClampDn(INDEX(_aiMaxAmmo[5] * GetSP()->sp_fAmmoQuantity), (INDEX)1);

        } else {
          m_iShells        = ClampDn(INDEX(_aiMaxMag[MAG_SPAS]  * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iBullets       = ClampDn(INDEX(_aiMaxMag[MAG_SMG1]  * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iRockets       = 0.0f;
          m_iGrenades      = ClampDn(INDEX(1.0f                 * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iNapalm        = ClampDn(INDEX(_aiMaxMag[MAG_357]   * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iElectricity   = ClampDn(INDEX(_aiMaxMag[MAG_AR2]   * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iIronBalls     = ClampDn(INDEX(_aiMaxMag[MAG_RPG]*3 * GetSP()->sp_fAmmoQuantity), (INDEX)1);
          m_iSniperBullets = ClampDn(INDEX(_aiMaxMag[MAG_CROSSBOW] * GetSP()->sp_fAmmoQuantity), (INDEX)1);
        }
        break;

      default: {
        if (!m_bHL2Init) {
          m_iShells        = ceil(_aiMaxAmmo[4] * (FLOAT(m_iShells)/100.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iBullets       = ceil(_aiMaxAmmo[2] * (FLOAT(m_iBullets)/500.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iRockets       = ceil(_aiMaxAmmo[3] * (FLOAT(m_iRockets)/50.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iGrenades      = ceil(_aiMaxAmmo[6] * (FLOAT(m_iGrenades)/50.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iNapalm        = ceil(_aiMaxAmmo[1] * (FLOAT(m_iNapalm)/500.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iElectricity   = ceil(_aiMaxAmmo[3] * (FLOAT(m_iElectricity)/400.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iIronBalls     = ceil(_aiMaxAmmo[7] * (FLOAT(m_iIronBalls)/30.0f)) * GetSP()->sp_fAmmoQuantity;
          m_iSniperBullets = ceil(_aiMaxAmmo[5] * (FLOAT(m_iSniperBullets)/50.0f)) * GetSP()->sp_fAmmoQuantity;
        }
      } break;
    }
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

    // send ammo to entity
    EAmmoPackItem eAmmo;
    eAmmo.iShells = m_iShells;
    eAmmo.iBullets = m_iBullets;
    eAmmo.iRockets = m_iRockets;
    eAmmo.iGrenades = m_iGrenades;
    eAmmo.iNapalm = m_iNapalm;
    eAmmo.iElectricity = m_iElectricity;
    eAmmo.iIronBalls = m_iIronBalls;
    eAmmo.iSniperBullets = m_iSniperBullets;

    // if health is received
    if (epass.penOther->ReceiveItem(eAmmo)) {
      if (!GetSP()->sp_bAmmoStays || (m_bPickupOnce||m_bRespawn)) {
        jump CItem::ItemReceived();
      }
    }
    return;
  };

  Main() {
    m_iShells        = Clamp(m_iShells,        INDEX(0), _aiMaxAmmo[4]);
    m_iBullets       = Clamp(m_iBullets,       INDEX(0), _aiMaxAmmo[2]);
    m_iRockets       = Clamp(m_iRockets,       INDEX(0), _aiMaxAmmo[3]);
    m_iGrenades      = Clamp(m_iGrenades,      INDEX(0), _aiMaxAmmo[6]);
    m_iNapalm        = Clamp(m_iNapalm,        INDEX(0), _aiMaxAmmo[1]);
    m_iElectricity   = Clamp(m_iElectricity,   INDEX(0), _aiMaxAmmo[3]);
    m_iIronBalls     = Clamp(m_iIronBalls,     INDEX(0), _aiMaxAmmo[7]);
    m_iSniperBullets = Clamp(m_iSniperBullets, INDEX(0), _aiMaxAmmo[5]);

    // [Cecil] Special flag
    m_bHL2Init = TRUE;

    Initialize(); // initialize base class
    SetProperties(); // set properties

    jump CItem::ItemLoop();
  };
};
