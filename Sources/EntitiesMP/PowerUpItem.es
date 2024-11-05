808
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"

// [Cecil]
#include "EntitiesMP/AmmoItem.h"
#include "HL2Models/AmmoHandler.h"
%}

uses "EntitiesMP/Item";
uses "EntitiesMP/Player";

// health type 
enum PowerUpItemType {
  0 PUIT_INVISIB  "Invisibility",    // [Cecil] MP7 Grenades
  1 PUIT_INVULNER "Invulnerability", // [Cecil] Plasma Balls
  2 PUIT_DAMAGE   "SeriousDamage",   // [Cecil] Plasma Balls
  3 PUIT_SPEED    "SeriousSpeed",    // [Cecil] MP7 Grenades
  4 PUIT_BOMB     "SeriousBomb",     // [Cecil] 3x Plasma Balls
};

// event for sending through receive item
event EPowerUp {
  enum PowerUpItemType puitType,
};

%{
// [Cecil] Extracted from entity functions
void CPowerUpItem_Precache(void) {
  CDLLEntityClass *pdec = &CPowerUpItem_DLLClass;

  // [Cecil] MP7 Grenades and Plasma Balls
  pdec->PrecacheModel(MODEL_HANDLER);
  pdec->PrecacheModel(MODEL_AR2);
  pdec->PrecacheTexture(TEXTURE_AR2);
  pdec->PrecacheModel(MODEL_SMG1);
  pdec->PrecacheTexture(TEXTURE_SMG1);

  // [Cecil] Invisibility
  pdec->PrecacheModel(MODEL_INVIS);

  pdec->PrecacheTexture(TEXTURE_REFLECTION_METAL);
  pdec->PrecacheTexture(TEXTURE_SPECULAR_STRONG);
  pdec->PrecacheSound(SOUND_PICKUP);
};
%}

class CPowerUpItem : CItem 
{
name      "PowerUp Item";
thumbnail "Thumbnails\\PowerUpItem.tbn";

properties:
  1 enum PowerUpItemType m_puitType  "Type" 'Y' = PUIT_INVULNER,

components:
  0 class CLASS_BASE  "Classes\\Item.ecl",
  1 model MODEL_ITEM  "Models\\Items\\ItemHolder.mdl",
  2 model MODEL_INVIS "ModelsMP\\Items\\PowerUps\\Invisibility\\Invisibility.mdl",

// [Cecil] New ammo
  5 model   MODEL_HANDLER "Models\\Items\\AmmoHandler.mdl",
 10 model   MODEL_AR2     "Models\\Items\\CombineBall.mdl",
 11 texture TEXTURE_AR2   "Models\\Items\\CombineBall.tex",
 12 model   MODEL_SMG1    "Models\\Items\\SMG1Grenade.mdl",
 13 texture TEXTURE_SMG1  "Models\\Items\\SMG1Grenade.tex",

 30 texture TEXTURE_REFLECTION_METAL "ModelsMP\\ReflectionTextures\\LightMetal01.tex",
 31 texture TEXTURE_SPECULAR_STRONG  "ModelsMP\\SpecularTextures\\Strong.tex",

 50 sound SOUND_PICKUP "SoundsMP\\Items\\PowerUp.wav",

functions:
  void Precache(void) {
    CPowerUpItem_Precache();
  };

  // [Cecil] Physics overrides
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_puitType) {
      case PUIT_INVISIB:
      case PUIT_SPEED: vSize = FLOAT3D(0.2f, 0.2f, 0.85f); return COLSH_CAPSULE;
      case PUIT_INVULNER:
      case PUIT_DAMAGE:
      case PUIT_BOMB:  vSize = FLOAT3D(0.35f, 0.35f, 0.55f); return COLSH_CAPSULE;
    }

    return CItem::GetPhysCollision(vSize);
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    switch (m_puitType) {
      case PUIT_INVISIB:
      case PUIT_SPEED: plOffset = CPlacement3D(FLOAT3D(0, 0.1f, -0.025f), ANGLE3D(0, 0, 0)); return TRUE;
      case PUIT_INVULNER:
      case PUIT_DAMAGE:
      case PUIT_BOMB:  plOffset = CPlacement3D(FLOAT3D(0, 0.175f, -0.03125f), ANGLE3D(0, 0, 0)); return TRUE;
    }

    return CItem::GetPhysOffset(plOffset);
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    pes->es_strName = "PowerUp"; 
    pes->es_ctCount = 1;
    pes->es_ctAmmount = 1;
    pes->es_fValue = 0;
    pes->es_iScore = 0;
    
    switch (m_puitType) {
      case PUIT_INVISIB:  pes->es_strName += " invisibility"; break;
      case PUIT_INVULNER: pes->es_strName += " invulnerability"; break;
      case PUIT_DAMAGE:   pes->es_strName += " serious damage"; break;
      case PUIT_SPEED:    pes->es_strName += " serious speed"; break;
      case PUIT_BOMB:     pes->es_strName = "Serious Bomb!"; 
    }
    return TRUE;
  };

  // set health properties depending on health type
  void SetProperties(void) {
    switch (m_puitType) {
      case PUIT_INVISIB:
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 40.0f; 
        m_strDescription.PrintF("Invisibility");
        break;
      case PUIT_INVULNER:
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 60.0f; 
        m_strDescription.PrintF("Invulnerability");
        break;                                                               
      case PUIT_DAMAGE:
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 40.0f; 
        m_strDescription.PrintF("SeriousDamage");
        break;
      case PUIT_SPEED:
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 40.0f; 
        m_strDescription.PrintF("SeriousSpeed");
        break;
      case PUIT_BOMB:
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 40.0f; 
        m_strDescription.PrintF("Serious Bomb!");
        break;
    }

    // [Cecil] Gamemode-specific
    INDEX iMode = GetSP()->sp_iHLGamemode;

    switch (iMode) {
      case HLGM_BUNNYHUNT: case HLGM_MINEKILL: case HLGM_FLYROCKET:
        StartModelAnim(ITEMHOLDER_ANIM_SMALLOSCILATION, AOF_LOOPING|AOF_NORESTART);
        ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_BIG);

        AddItem(MODEL_INVIS, TEXTURE_REFLECTION_METAL, 0, TEXTURE_SPECULAR_STRONG, 0);
        StretchItem(FLOAT3D(0.75f, 0.75f, 0.75));
        break;

      default: {
        StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
        ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);

        switch (m_puitType) {
          // Grenades
          case PUIT_INVISIB: case PUIT_SPEED: {
            AddItem(MODEL_HANDLER, TEXTURE_SMG1, 0, 0, 0);
            AddItemAttachment(AMMOHANDLER_ATTACHMENT_SMG1GRENADE, MODEL_SMG1, TEXTURE_SMG1, 0, 0, 0);
          } break;

          // Plasma Balls
          default: {
            AddItem(MODEL_HANDLER, TEXTURE_AR2, 0, 0, 0);
            AddItemAttachment(AMMOHANDLER_ATTACHMENT_COMBINEBALL, MODEL_AR2, TEXTURE_AR2, 0, 0, 0);
          }
        }

        // [Cecil] Random rotation and bigger size
        //GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_plRelative.pl_OrientationAngle(1) = FRnd() * 360.0f;
        StretchItem(FLOAT3D(2.0f, 2.0f, 2.0f));
      }
    }
  };

  // [Cecil] Reload model
  void AdjustDifficulty(void) {
    if (!m_bRespawn && GetSP()->sp_iHLGamemode != HLGM_BUNNYHUNT) {
      SetFlags(GetFlags() & ~ENF_SEETHROUGH);
    }

    SetModel(MODEL_ITEM);
    SetProperties();
  };
 
procedures:

  ItemCollected( EPass epass) : CItem::ItemCollected
  {
    ASSERT( epass.penOther!=NULL);
 
    // [Cecil] No Serious Bombs
    // don't pick up more bombs then you can carry
    /*if (m_puitType == PUIT_BOMB) {
      if (IsOfClass(epass.penOther, "Player")) {
        if (((CPlayer &)*epass.penOther).m_iSeriousBombCount>=3) {
          return;
        }
      }
    }*/

    // [Cecil] Only use pickup masks in multiplayer
    const BOOL bStays = !GetSP()->sp_bSinglePlayer;

    if (bStays && !(m_bPickupOnce||m_bRespawn)) {
      // if already picked by this player
      BOOL bWasPicked = MarkPickedBy(epass.penOther);
      if( bWasPicked) {
        // don't pick again
        return;
      }
    }

    // [Cecil] Gamemode-specific
    INDEX iMode = GetSP()->sp_iHLGamemode;

    switch (iMode) {
      case HLGM_BUNNYHUNT:
      case HLGM_MINEKILL:
      case HLGM_FLYROCKET: {
        // send powerup to entity
        EPowerUp ePowerUp;
        ePowerUp.puitType = PUIT_INVISIB;

        // if powerup is received
        if (epass.penOther->ReceiveItem(ePowerUp)) {
          // play the pickup sound
          m_soPick.Set3DParameters(50.0f, 1.0f, 2.0f, 1.0f);
          PlaySound(m_soPick, SOUND_PICKUP, SOF_3D);
          m_fPickSoundLen = GetSoundLength(SOUND_PICKUP);

          if (!bStays || m_bPickupOnce || m_bRespawn) {
            jump CItem::ItemReceived();
          }
        }
      } break;

      default: {
        // [Cecil] Give Alt Ammo Instead
        EAmmoItem eAmmo;

        switch (m_puitType) {
          case PUIT_INVISIB: case PUIT_SPEED:
            eAmmo.EaitType = AIT_MP7GRENADES;
            eAmmo.iQuantity = 1.0f;
            break;

          case PUIT_INVULNER: case PUIT_DAMAGE:
            eAmmo.EaitType = AIT_ENERGYBALLS;
            eAmmo.iQuantity = 1.0f;
            break;

          case PUIT_BOMB:
            eAmmo.EaitType = AIT_ENERGYBALLS;
            eAmmo.iQuantity = 3.0f;
            break;
        }

        // if ammo is received
        if (epass.penOther->ReceiveItem(eAmmo)) {
          if (!bStays || m_bPickupOnce || m_bRespawn) {
            jump CItem::ItemReceived();
          }
        }
      }
    }
    return;
  };

  Main() {
    Initialize();     // initialize base class
    SetProperties();  // set properties

    // [Cecil] Added dropped actions
    if (!m_bDropped) {
      jump CItem::ItemLoop();
    } else if (TRUE) {
      wait() {
        on (EBegin) : {
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
